import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildUblInvoice,
  computeTotals,
  demoInvoice,
  downloadFileName,
  parseInvoiceText,
  validateInvoice
} from '../public/einvoice.js';

test('computes line and VAT totals', () => {
  const totals = computeTotals([
    { description: 'A', quantity: '2', unitPrice: '10', vatRate: '21', unitCode: 'C62' },
    { description: 'B', quantity: '1', unitPrice: '5', vatRate: '0', unitCode: 'C62' }
  ]);

  assert.equal(totals.lineExtensionAmount, 25);
  assert.equal(totals.taxAmount, 4.2);
  assert.equal(totals.payableAmount, 29.2);
  assert.equal(totals.taxSubtotals.length, 2);
});

test('validates mandatory PEPPOL fields', () => {
  const invoice = demoInvoice();
  invoice.invoice.buyerReference = '';
  const result = validateInvoice(invoice);

  assert.ok(result.errors.some((message) => message.includes('Pircēja atsauce')));
});

test('builds UBL invoice XML with expected identifiers', () => {
  const xml = buildUblInvoice(demoInvoice());

  assert.match(xml, /<cbc:CustomizationID>urn:cen\.eu:en16931:2017#compliant#urn:fdc:peppol\.eu:2017:poacc:billing:3\.0<\/cbc:CustomizationID>/);
  assert.match(xml, /<cbc:ProfileID>urn:fdc:peppol\.eu:2017:poacc:billing:01:1\.0<\/cbc:ProfileID>/);
  assert.match(xml, /<cac:AccountingSupplierParty>/);
  assert.match(xml, /<cac:AccountingCustomerParty>/);
  assert.match(xml, /<cbc:PayableAmount currencyID="EUR">417\.45<\/cbc:PayableAmount>/);
});

test('escapes XML-sensitive text', () => {
  const invoice = demoInvoice();
  invoice.lines[0].description = 'Atbalsts & apkope <A>';
  const xml = buildUblInvoice(invoice);

  assert.match(xml, /Atbalsts &amp; apkope &lt;A&gt;/);
});

test('parses common invoice text snippets', () => {
  const parsed = parseInvoiceText(`
    Pārdevējs: SIA Alfa
    Pircējs: SIA Beta
    Rēķins nr. A-15
    Datums: 19.09.2026
    Apmaksāt līdz: 03.10.2026
    PVN nr. LV40203000000
    LV80BANK0000435195001
    Pakalpojums;2;50.00;21
  `);

  assert.equal(parsed.invoice.number, 'A-15');
  assert.equal(parsed.invoice.issueDate, '2026-09-19');
  assert.equal(parsed.invoice.dueDate, '2026-10-03');
  assert.equal(parsed.seller.name, 'SIA Alfa');
  assert.equal(parsed.lines[0].description, 'Pakalpojums');
});

test('creates stable XML file names', () => {
  assert.equal(downloadFileName('RĒĶINS 2026/001'), 'rekins-2026-001.xml');
});
