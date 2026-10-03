const MONEY_SCALE = 100;

export const DEFAULT_CUSTOMIZATION_ID =
  'urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0';
export const DEFAULT_PROFILE_ID = 'urn:fdc:peppol.eu:2017:poacc:billing:01:1.0';

export const VAT_RATES_LV = [0, 5, 12, 21];

export function defaultInvoice() {
  return {
    invoice: {
      number: '',
      issueDate: todayIso(),
      dueDate: '',
      currency: 'EUR',
      buyerReference: '',
      paymentTerms: '',
      note: ''
    },
    seller: emptyParty('Pārdevējs'),
    buyer: emptyParty('Pircējs'),
    lines: [emptyLine()]
  };
}

export function emptyParty(role = '') {
  return {
    role,
    name: '',
    regNo: '',
    vatNo: '',
    endpointScheme: '0218',
    endpointId: '',
    street: '',
    city: '',
    postalCode: '',
    country: 'LV',
    email: '',
    iban: ''
  };
}

export function emptyLine() {
  return {
    description: '',
    quantity: '1',
    unitCode: 'C62',
    unitPrice: '',
    vatRate: '21'
  };
}

export function demoInvoice() {
  return {
    invoice: {
      number: 'REK-2026-001',
      issueDate: '2026-09-19',
      dueDate: '2026-10-03',
      currency: 'EUR',
      buyerReference: 'IEPIRKUMS-2026',
      paymentTerms: 'Apmaksa 14 dienu laikā',
      note: 'Ģenerēts no e-rēķina pārveidotāja testa datiem.'
    },
    seller: {
      ...emptyParty('Pārdevējs'),
      name: 'SIA Piemērs',
      regNo: '40203000000',
      vatNo: 'LV40203000000',
      endpointId: '40203000000',
      street: 'Brīvības iela 1',
      city: 'Rīga',
      postalCode: 'LV-1010',
      email: 'rekini@example.lv',
      iban: 'LV80BANK0000435195001'
    },
    buyer: {
      ...emptyParty('Pircējs'),
      name: 'Pašvaldības iestāde',
      regNo: '90000000000',
      vatNo: '',
      endpointId: '90000000000',
      street: 'Rātslaukums 1',
      city: 'Rīga',
      postalCode: 'LV-1050',
      email: 'apmaksa@example.lv'
    },
    lines: [
      {
        description: 'Konsultāciju pakalpojumi',
        quantity: '3',
        unitCode: 'HUR',
        unitPrice: '75',
        vatRate: '21'
      },
      {
        description: 'Dokumentu sagatavošana',
        quantity: '1',
        unitCode: 'C62',
        unitPrice: '120',
        vatRate: '21'
      }
    ]
  };
}

export function parseInvoiceText(text) {
  const invoice = defaultInvoice();
  const source = normalizeText(text);
  const rows = source.split('\n').map((line) => line.trim()).filter(Boolean);

  invoice.invoice.number = firstMatch(source, [
    /(?:r[ēe]ķins|invoice)\s*(?:nr\.?|number|#)?\s*[:\-]?\s*([A-Z0-9\-\/.]+)/i,
    /(?:nr\.?|number|#)\s*[:\-]\s*([A-Z0-9\-\/.]+)/i
  ]);

  invoice.invoice.issueDate = isoDate(
    firstMatch(source, [
      /(?:datums|date|issue date)\s*[:\-]?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i,
      /\b(\d{4}-\d{2}-\d{2})\b/
    ])
  );
  invoice.invoice.dueDate = isoDate(
    firstMatch(source, [
      /(?:apmaks[āa]t l[īi]dz|apmaksas termi[nņ][šs]|due date)\s*[:\-]?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i,
      /(?:due date)\s*[:\-]?\s*(\d{4}-\d{2}-\d{2})/i
    ])
  );

  const ibans = uniqueMatches(source, /\bLV\d{2}[A-Z]{4}[A-Z0-9]{13}\b/gi);
  invoice.seller.iban = ibans[0] || '';

  const vatNumbers = uniqueMatches(source, /\bLV\d{11}\b/gi).map((value) => value.toUpperCase());
  invoice.seller.vatNo = vatNumbers[0] || '';
  invoice.buyer.vatNo = vatNumbers[1] || '';

  const regNumbers = uniqueMatches(source, /\b(?:LV)?(\d{11})\b/gi)
    .map((value) => value.replace(/^LV/i, ''));
  invoice.seller.regNo = regNumbers[0] || stripVatPrefix(invoice.seller.vatNo);
  invoice.buyer.regNo = regNumbers[1] || stripVatPrefix(invoice.buyer.vatNo);
  invoice.seller.endpointId = invoice.seller.regNo;
  invoice.buyer.endpointId = invoice.buyer.regNo;

  invoice.seller.name = partyNameAfter(rows, ['pārdevējs', 'piegādātājs', 'supplier', 'seller']);
  invoice.buyer.name = partyNameAfter(rows, ['pircējs', 'saņēmējs', 'customer', 'buyer']);
  invoice.lines = parseLineRows(rows);

  if (invoice.lines.length === 0) {
    invoice.lines = [emptyLine()];
  }

  return invoice;
}

export function normalizeInvoice(input) {
  const data = mergeInvoice(defaultInvoice(), input || {});
  data.invoice.currency = (data.invoice.currency || 'EUR').trim().toUpperCase();
  data.invoice.issueDate = isoDate(data.invoice.issueDate);
  data.invoice.dueDate = isoDate(data.invoice.dueDate);
  data.seller = normalizeParty(data.seller);
  data.buyer = normalizeParty(data.buyer);
  data.lines = (data.lines || [])
    .map(normalizeLine)
    .filter((line) => line.description || toNumber(line.quantity) || toNumber(line.unitPrice));

  if (data.lines.length === 0) {
    data.lines = [emptyLine()];
  }

  return data;
}

export function validateInvoice(input) {
  const data = normalizeInvoice(input);
  const errors = [];
  const warnings = [];
  const totals = computeTotals(data.lines);

  required(errors, data.invoice.number, 'Rēķina numurs ir obligāts.');
  required(errors, data.invoice.issueDate, 'Rēķina datums ir obligāts.');
  required(errors, data.invoice.dueDate, 'Apmaksas termiņš ir obligāts.');
  required(errors, data.invoice.currency, 'Valūta ir obligāta.');
  required(errors, data.invoice.buyerReference, 'Pircēja atsauce ir obligāta PEPPOL rēķinam.');

  validateParty(errors, warnings, data.seller, 'Pārdevējam');
  validateParty(errors, warnings, data.buyer, 'Pircējam');

  if (data.lines.length === 0) {
    errors.push('Vajadzīga vismaz viena rēķina rinda.');
  }

  data.lines.forEach((line, index) => {
    const label = `Rinda ${index + 1}`;
    required(errors, line.description, `${label}: apraksts ir obligāts.`);
    if (toNumber(line.quantity) <= 0) errors.push(`${label}: daudzumam jābūt lielākam par 0.`);
    if (toNumber(line.unitPrice) < 0) errors.push(`${label}: vienības cena nedrīkst būt negatīva.`);
    if (toNumber(line.vatRate) < 0) errors.push(`${label}: PVN likme nedrīkst būt negatīva.`);
    if (!VAT_RATES_LV.includes(toNumber(line.vatRate))) {
      warnings.push(`${label}: PVN likme nav tipiska Latvijas likme (${VAT_RATES_LV.join(', ')}%).`);
    }
  });

  if (totals.taxAmount > 0 && !data.seller.vatNo) {
    warnings.push('Rēķinā ir PVN, bet pārdevēja PVN numurs nav aizpildīts.');
  }

  if (!data.seller.iban) {
    warnings.push('Pārdevēja IBAN nav aizpildīts; bankas maksājuma bloks netiks pilnībā noderīgs.');
  }

  return { errors, warnings, totals, data };
}

export function computeTotals(lines) {
  const normalizedLines = (lines || []).map(normalizeLine);
  const enrichedLines = normalizedLines.map((line, index) => {
    const quantity = toNumber(line.quantity);
    const unitPrice = toNumber(line.unitPrice);
    const vatRate = toNumber(line.vatRate);
    const lineExtension = roundMoney(quantity * unitPrice);
    const taxAmount = roundMoney((lineExtension * vatRate) / 100);

    return {
      ...line,
      id: String(index + 1),
      quantity,
      unitPrice,
      vatRate,
      taxCategory: vatRate > 0 ? 'S' : 'Z',
      lineExtension,
      taxAmount
    };
  });

  const lineExtensionAmount = roundMoney(
    enrichedLines.reduce((sum, line) => sum + line.lineExtension, 0)
  );
  const taxAmount = roundMoney(enrichedLines.reduce((sum, line) => sum + line.taxAmount, 0));
  const payableAmount = roundMoney(lineExtensionAmount + taxAmount);
  const taxSubtotals = [];

  for (const line of enrichedLines) {
    let subtotal = taxSubtotals.find((item) => item.vatRate === line.vatRate);
    if (!subtotal) {
      subtotal = {
        vatRate: line.vatRate,
        taxCategory: line.taxCategory,
        taxableAmount: 0,
        taxAmount: 0
      };
      taxSubtotals.push(subtotal);
    }
    subtotal.taxableAmount = roundMoney(subtotal.taxableAmount + line.lineExtension);
    subtotal.taxAmount = roundMoney(subtotal.taxAmount + line.taxAmount);
  }

  return {
    lines: enrichedLines,
    lineExtensionAmount,
    taxExclusiveAmount: lineExtensionAmount,
    taxInclusiveAmount: payableAmount,
    taxAmount,
    payableAmount,
    taxSubtotals
  };
}

export function buildUblInvoice(input) {
  const validation = validateInvoice(input);
  if (validation.errors.length > 0) {
    const error = new Error('Rēķina dati nav pilnīgi.');
    error.details = validation.errors;
    throw error;
  }

  const { data, totals } = validation;
  const currency = data.invoice.currency;
  const note = data.invoice.note ? `  <cbc:Note>${xml(data.invoice.note)}</cbc:Note>` : '';
  const paymentTerms = data.invoice.paymentTerms || `Apmaksa līdz ${data.invoice.dueDate}`;

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"',
    '         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"',
    '         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">',
    '  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>',
    `  <cbc:CustomizationID>${DEFAULT_CUSTOMIZATION_ID}</cbc:CustomizationID>`,
    `  <cbc:ProfileID>${DEFAULT_PROFILE_ID}</cbc:ProfileID>`,
    `  <cbc:ID>${xml(data.invoice.number)}</cbc:ID>`,
    `  <cbc:IssueDate>${data.invoice.issueDate}</cbc:IssueDate>`,
    `  <cbc:DueDate>${data.invoice.dueDate}</cbc:DueDate>`,
    '  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>',
    note.trimEnd(),
    `  <cbc:DocumentCurrencyCode>${xml(currency)}</cbc:DocumentCurrencyCode>`,
    `  <cbc:BuyerReference>${xml(data.invoice.buyerReference)}</cbc:BuyerReference>`,
    partyBlock('AccountingSupplierParty', data.seller),
    partyBlock('AccountingCustomerParty', data.buyer),
    paymentMeansBlock(data, currency),
    `  <cac:PaymentTerms>\n    <cbc:Note>${xml(paymentTerms)}</cbc:Note>\n  </cac:PaymentTerms>`,
    taxTotalBlock(totals, currency),
    legalMonetaryTotalBlock(totals, currency),
    ...totals.lines.map((line) => invoiceLineBlock(line, currency)),
    '</Invoice>',
    ''
  ]
    .filter((line) => line !== '')
    .join('\n');
}

export function downloadFileName(invoiceNumber) {
  const clean = String(invoiceNumber || 'e-rekins')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return `${clean || 'e-rekins'}.xml`;
}

function mergeInvoice(base, patch) {
  return {
    invoice: { ...base.invoice, ...(patch.invoice || {}) },
    seller: { ...base.seller, ...(patch.seller || {}) },
    buyer: { ...base.buyer, ...(patch.buyer || {}) },
    lines: Array.isArray(patch.lines) ? patch.lines.map((line) => ({ ...emptyLine(), ...line })) : base.lines
  };
}

function normalizeParty(party) {
  const normalized = { ...emptyParty(party.role), ...party };
  normalized.country = (normalized.country || 'LV').trim().toUpperCase();
  normalized.regNo = compact(normalized.regNo).replace(/^LV/i, '');
  normalized.vatNo = compact(normalized.vatNo).toUpperCase();
  normalized.iban = compact(normalized.iban).toUpperCase();
  normalized.endpointScheme = compact(normalized.endpointScheme) || inferEndpointScheme(normalized);
  normalized.endpointId = compact(normalized.endpointId) || inferEndpointId(normalized);
  return normalized;
}

function normalizeLine(line) {
  return {
    ...emptyLine(),
    ...line,
    description: String(line.description || '').trim(),
    quantity: normalizeDecimal(line.quantity),
    unitCode: String(line.unitCode || 'C62').trim().toUpperCase(),
    unitPrice: normalizeDecimal(line.unitPrice),
    vatRate: normalizeDecimal(line.vatRate)
  };
}

function validateParty(errors, warnings, party, label) {
  required(errors, party.name, `${label} nosaukums ir obligāts.`);
  required(errors, party.regNo || party.vatNo, `${label} reģistrācijas vai PVN numurs ir obligāts.`);
  required(errors, party.endpointId, `${label} e-rēķina adreses identifikators ir obligāts.`);
  required(errors, party.street, `${label} adrese ir obligāta.`);
  required(errors, party.city, `${label} pilsēta ir obligāta.`);
  required(errors, party.country, `${label} valsts kods ir obligāts.`);

  if (party.country && party.country.length !== 2) {
    errors.push(`${label} valsts jānorāda kā 2 burtu kods, piemēram, LV.`);
  }

  if (party.vatNo && !/^LV\d{11}$/i.test(party.vatNo)) {
    warnings.push(`${label} PVN numurs neizskatās pēc Latvijas PVN numura.`);
  }

  if (party.endpointScheme === '0218' && party.endpointId && !/^\d{11}$/.test(party.endpointId)) {
    warnings.push(`${label} EAS 0218 parasti izmanto 11 ciparu Latvijas reģistrācijas numuru.`);
  }
}

function required(errors, value, message) {
  if (!String(value || '').trim()) errors.push(message);
}

function partyBlock(tag, party) {
  const taxScheme = party.vatNo
    ? [
        '      <cac:PartyTaxScheme>',
        `        <cbc:CompanyID>${xml(party.vatNo)}</cbc:CompanyID>`,
        '        <cac:TaxScheme>',
        '          <cbc:ID>VAT</cbc:ID>',
        '        </cac:TaxScheme>',
        '      </cac:PartyTaxScheme>'
      ].join('\n')
    : '';
  const contact = party.email
    ? [
        '      <cac:Contact>',
        `        <cbc:ElectronicMail>${xml(party.email)}</cbc:ElectronicMail>`,
        '      </cac:Contact>'
      ].join('\n')
    : '';

  return [
    `  <cac:${tag}>`,
    '    <cac:Party>',
    `      <cbc:EndpointID schemeID="${xml(party.endpointScheme)}">${xml(party.endpointId)}</cbc:EndpointID>`,
    '      <cac:PartyIdentification>',
    `        <cbc:ID schemeID="${xml(party.endpointScheme)}">${xml(party.endpointId)}</cbc:ID>`,
    '      </cac:PartyIdentification>',
    '      <cac:PartyName>',
    `        <cbc:Name>${xml(party.name)}</cbc:Name>`,
    '      </cac:PartyName>',
    '      <cac:PostalAddress>',
    `        <cbc:StreetName>${xml(party.street)}</cbc:StreetName>`,
    `        <cbc:CityName>${xml(party.city)}</cbc:CityName>`,
    party.postalCode ? `        <cbc:PostalZone>${xml(party.postalCode)}</cbc:PostalZone>` : '',
    '        <cac:Country>',
    `          <cbc:IdentificationCode>${xml(party.country)}</cbc:IdentificationCode>`,
    '        </cac:Country>',
    '      </cac:PostalAddress>',
    taxScheme,
    '      <cac:PartyLegalEntity>',
    `        <cbc:RegistrationName>${xml(party.name)}</cbc:RegistrationName>`,
    `        <cbc:CompanyID>${xml(party.regNo || stripVatPrefix(party.vatNo))}</cbc:CompanyID>`,
    '      </cac:PartyLegalEntity>',
    contact,
    '    </cac:Party>',
    `  </cac:${tag}>`
  ]
    .filter(Boolean)
    .join('\n');
}

function paymentMeansBlock(data) {
  if (!data.seller.iban) {
    return [
      '  <cac:PaymentMeans>',
      '    <cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>',
      `    <cbc:PaymentID>${xml(data.invoice.number)}</cbc:PaymentID>`,
      '  </cac:PaymentMeans>'
    ].join('\n');
  }

  return [
    '  <cac:PaymentMeans>',
    '    <cbc:PaymentMeansCode name="Credit transfer">30</cbc:PaymentMeansCode>',
    `    <cbc:PaymentID>${xml(data.invoice.number)}</cbc:PaymentID>`,
    '    <cac:PayeeFinancialAccount>',
    `      <cbc:ID>${xml(data.seller.iban)}</cbc:ID>`,
    `      <cbc:Name>${xml(data.seller.name)}</cbc:Name>`,
    '    </cac:PayeeFinancialAccount>',
    '  </cac:PaymentMeans>'
  ].join('\n');
}

function taxTotalBlock(totals, currency) {
  const subtotals = totals.taxSubtotals.map((subtotal) =>
    [
      '    <cac:TaxSubtotal>',
      `      <cbc:TaxableAmount currencyID="${xml(currency)}">${money(subtotal.taxableAmount)}</cbc:TaxableAmount>`,
      `      <cbc:TaxAmount currencyID="${xml(currency)}">${money(subtotal.taxAmount)}</cbc:TaxAmount>`,
      '      <cac:TaxCategory>',
      `        <cbc:ID>${subtotal.taxCategory}</cbc:ID>`,
      `        <cbc:Percent>${percent(subtotal.vatRate)}</cbc:Percent>`,
      '        <cac:TaxScheme>',
      '          <cbc:ID>VAT</cbc:ID>',
      '        </cac:TaxScheme>',
      '      </cac:TaxCategory>',
      '    </cac:TaxSubtotal>'
    ].join('\n')
  );

  return [
    '  <cac:TaxTotal>',
    `    <cbc:TaxAmount currencyID="${xml(currency)}">${money(totals.taxAmount)}</cbc:TaxAmount>`,
    ...subtotals,
    '  </cac:TaxTotal>'
  ].join('\n');
}

function legalMonetaryTotalBlock(totals, currency) {
  return [
    '  <cac:LegalMonetaryTotal>',
    `    <cbc:LineExtensionAmount currencyID="${xml(currency)}">${money(totals.lineExtensionAmount)}</cbc:LineExtensionAmount>`,
    `    <cbc:TaxExclusiveAmount currencyID="${xml(currency)}">${money(totals.taxExclusiveAmount)}</cbc:TaxExclusiveAmount>`,
    `    <cbc:TaxInclusiveAmount currencyID="${xml(currency)}">${money(totals.taxInclusiveAmount)}</cbc:TaxInclusiveAmount>`,
    `    <cbc:PayableAmount currencyID="${xml(currency)}">${money(totals.payableAmount)}</cbc:PayableAmount>`,
    '  </cac:LegalMonetaryTotal>'
  ].join('\n');
}

function invoiceLineBlock(line, currency) {
  return [
    '  <cac:InvoiceLine>',
    `    <cbc:ID>${line.id}</cbc:ID>`,
    `    <cbc:InvoicedQuantity unitCode="${xml(line.unitCode)}">${quantity(line.quantity)}</cbc:InvoicedQuantity>`,
    `    <cbc:LineExtensionAmount currencyID="${xml(currency)}">${money(line.lineExtension)}</cbc:LineExtensionAmount>`,
    '    <cac:Item>',
    `      <cbc:Name>${xml(line.description)}</cbc:Name>`,
    '      <cac:ClassifiedTaxCategory>',
    `        <cbc:ID>${line.taxCategory}</cbc:ID>`,
    `        <cbc:Percent>${percent(line.vatRate)}</cbc:Percent>`,
    '        <cac:TaxScheme>',
    '          <cbc:ID>VAT</cbc:ID>',
    '        </cac:TaxScheme>',
    '      </cac:ClassifiedTaxCategory>',
    '    </cac:Item>',
    '    <cac:Price>',
    `      <cbc:PriceAmount currencyID="${xml(currency)}">${money(line.unitPrice)}</cbc:PriceAmount>`,
    '    </cac:Price>',
    '  </cac:InvoiceLine>'
  ].join('\n');
}

function parseLineRows(rows) {
  const lines = [];
  for (const row of rows) {
    const csv = row.split(';').map((part) => part.trim());
    if (csv.length >= 4 && looksNumeric(csv[1]) && looksNumeric(csv[2])) {
      lines.push({
        description: csv[0],
        quantity: csv[1],
        unitCode: csv[4] || 'C62',
        unitPrice: csv[2],
        vatRate: csv[3].replace('%', '')
      });
      continue;
    }

    const compactRow = row.replace(/\s+/g, ' ');
    const match = compactRow.match(/^(.+?)\s+(\d+(?:[,.]\d+)?)\s+(?:x\s+)?(\d+(?:[,.]\d{1,4})?)\s+(\d{1,2})(?:%|,\d{2}%?)?$/i);
    if (match && !/kop[āa]|total|summa/i.test(match[1])) {
      lines.push({
        description: match[1].trim(),
        quantity: match[2],
        unitCode: 'C62',
        unitPrice: match[3],
        vatRate: match[4]
      });
    }
  }
  return lines;
}

function partyNameAfter(rows, labels) {
  for (const row of rows) {
    const lowered = row.toLowerCase();
    const label = labels.find((item) => lowered.startsWith(item));
    if (!label) continue;
    const [, value = ''] = row.split(/[:\-]/, 2);
    if (value.trim()) return value.trim();
  }
  return '';
}

function firstMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return '';
}

function uniqueMatches(text, pattern) {
  const values = [];
  for (const match of text.matchAll(pattern)) {
    const value = match[1] || match[0];
    if (!values.includes(value)) values.push(value);
  }
  return values;
}

function normalizeText(text) {
  return String(text || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function isoDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const match = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (!match) return raw;
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  return `${year}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
}

function inferEndpointId(party) {
  return party.regNo || party.vatNo || '';
}

function inferEndpointScheme(party) {
  if (party.vatNo && !party.regNo) return '9939';
  return '0218';
}

function stripVatPrefix(value) {
  return String(value || '').replace(/^LV/i, '');
}

function compact(value) {
  return String(value || '').replace(/\s+/g, '').trim();
}

function normalizeDecimal(value) {
  const text = String(value ?? '').trim().replace(/\s+/g, '').replace(',', '.');
  if (!text) return '';
  const number = Number(text);
  return Number.isFinite(number) ? String(number) : text;
}

function toNumber(value) {
  const number = Number(String(value ?? '').trim().replace(/\s+/g, '').replace(',', '.'));
  return Number.isFinite(number) ? number : 0;
}

function looksNumeric(value) {
  return Number.isFinite(toNumber(value));
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * MONEY_SCALE) / MONEY_SCALE;
}

function money(value) {
  return roundMoney(value).toFixed(2);
}

function quantity(value) {
  return Number(value).toFixed(2);
}

function percent(value) {
  return Number(value).toFixed(2);
}

function xml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
