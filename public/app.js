import {
  buildUblInvoice,
  computeTotals,
  defaultInvoice,
  demoInvoice,
  downloadFileName,
  emptyLine,
  parseInvoiceText,
  validateInvoice
} from './einvoice.js';

let state = defaultInvoice();
let latestXml = '';

const form = document.querySelector('#invoiceForm');
const lineTable = document.querySelector('#lineTable');
const rawText = document.querySelector('#rawText');
const xmlOutput = document.querySelector('#xmlOutput');
const messages = document.querySelector('#messages');
const statusPill = document.querySelector('#statusPill');
const totalsSummary = document.querySelector('#totalsSummary');
const downloadButton = document.querySelector('#downloadXml');
const copyButton = document.querySelector('#copyXml');

renderAll();

document.querySelector('#parseText').addEventListener('click', () => {
  const parsed = parseInvoiceText(rawText.value);
  state = mergePreferParsed(readForm(), parsed);
  renderAll();
  showMessages([{ type: 'ok', text: 'Teksts atpazīts. Pārbaudi laukus pirms XML ģenerēšanas.' }]);
});

document.querySelector('#loadDemo').addEventListener('click', () => {
  state = demoInvoice();
  renderAll();
  generateXml();
});

document.querySelector('#fileInput').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  if (file.name.toLowerCase().endsWith('.json')) {
    try {
      state = JSON.parse(text);
      renderAll();
      showMessages([{ type: 'ok', text: 'JSON dati ielādēti.' }]);
      return;
    } catch {
      showMessages([{ type: 'error', text: 'JSON failu neizdevās nolasīt.' }]);
      return;
    }
  }
  rawText.value = text;
  const parsed = parseInvoiceText(text);
  state = mergePreferParsed(readForm(), parsed);
  renderAll();
  showMessages([{ type: 'ok', text: 'Fails ielādēts un atpazīts.' }]);
});

document.querySelector('#addLine').addEventListener('click', () => {
  state = readForm();
  state.lines.push(emptyLine());
  renderAll();
});

document.querySelector('#generateXml').addEventListener('click', generateXml);

downloadButton.addEventListener('click', () => {
  if (!latestXml) return;
  const blob = new Blob([latestXml], { type: 'application/xml;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = downloadFileName(state.invoice.number);
  link.click();
  URL.revokeObjectURL(link.href);
});

copyButton.addEventListener('click', async () => {
  if (!latestXml) return;
  await navigator.clipboard.writeText(latestXml);
  showMessages([{ type: 'ok', text: 'XML nokopēts.' }]);
});

form.addEventListener('input', (event) => {
  const target = event.target;
  if (target.closest('#lineTable')) {
    const row = target.closest('.line-row');
    const index = Number(row?.dataset.index);
    if (Number.isInteger(index) && state.lines[index]) {
      state.lines[index][target.dataset.field] = target.value;
    }
  } else if (target.name) {
    setPath(state, target.name, target.value);
  }
  refreshTotals();
  markDirty();
});

lineTable.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-remove]');
  if (!button) return;
  state = readForm();
  state.lines.splice(Number(button.dataset.remove), 1);
  if (state.lines.length === 0) state.lines.push(emptyLine());
  renderAll();
});

function renderAll() {
  fillForm(state);
  renderLines(state.lines);
  refreshTotals();
  markDirty();
}

function fillForm(data) {
  for (const element of form.elements) {
    if (!element.name) continue;
    const value = getPath(data, element.name);
    element.value = value ?? '';
  }
}

function renderLines(lines) {
  lineTable.innerHTML = '';
  const head = document.createElement('div');
  head.className = 'line-head';
  head.innerHTML = '<span>Apraksts</span><span>Daudzums</span><span>Mērv.</span><span>Cena</span><span>PVN %</span><span></span>';
  lineTable.append(head);

  lines.forEach((line, index) => {
    const row = document.createElement('div');
    row.className = 'line-row';
    row.dataset.index = String(index);
    row.append(
      lineInput('description', line.description, 'Apraksts'),
      lineInput('quantity', line.quantity, 'Daudzums', 'number', '0.01'),
      lineInput('unitCode', line.unitCode, 'Mērv.'),
      lineInput('unitPrice', line.unitPrice, 'Cena', 'number', '0.01'),
      lineInput('vatRate', line.vatRate, 'PVN %', 'number', '0.01'),
      removeButton(index)
    );
    lineTable.append(row);
  });
}

function lineInput(field, value, label, type = 'text', step = '') {
  const input = document.createElement('input');
  input.dataset.field = field;
  input.value = value ?? '';
  input.placeholder = label;
  input.type = type;
  if (step) input.step = step;
  if (type === 'number') input.inputMode = 'decimal';
  return input;
}

function removeButton(index) {
  const button = document.createElement('button');
  button.className = 'icon-button';
  button.type = 'button';
  button.dataset.remove = String(index);
  button.title = 'Dzēst rindu';
  button.textContent = '×';
  return button;
}

function readForm() {
  const data = defaultInvoice();
  for (const element of form.elements) {
    if (element.name) setPath(data, element.name, element.value);
  }
  data.lines = Array.from(lineTable.querySelectorAll('.line-row')).map((row) => {
    const line = emptyLine();
    for (const input of row.querySelectorAll('input')) {
      line[input.dataset.field] = input.value;
    }
    return line;
  });
  return data;
}

function generateXml() {
  state = readForm();
  const validation = validateInvoice(state);

  if (validation.errors.length > 0) {
    latestXml = '';
    xmlOutput.value = '';
    downloadButton.disabled = true;
    copyButton.disabled = true;
    setStatus('Kļūdas', 'error');
    showMessages([
      ...validation.errors.map((text) => ({ type: 'error', text })),
      ...validation.warnings.map((text) => ({ type: 'warn', text }))
    ]);
    return;
  }

  latestXml = buildUblInvoice(state);
  xmlOutput.value = latestXml;
  downloadButton.disabled = false;
  copyButton.disabled = false;
  setStatus('XML gatavs', 'ok');
  showMessages([
    { type: 'ok', text: 'XML sagatavots.' },
    ...validation.warnings.map((text) => ({ type: 'warn', text }))
  ]);
}

function refreshTotals() {
  const data = readForm();
  const totals = computeTotals(data.lines);
  const currency = data.invoice.currency || 'EUR';
  totalsSummary.textContent = `${totals.payableAmount.toFixed(2)} ${currency.toUpperCase()}`;
}

function markDirty() {
  latestXml = '';
  downloadButton.disabled = true;
  copyButton.disabled = true;
  setStatus('Nav ģenerēts', '');
}

function showMessages(items) {
  messages.innerHTML = '';
  for (const item of items.slice(0, 8)) {
    const node = document.createElement('div');
    node.className = `message ${item.type}`;
    node.textContent = item.text;
    messages.append(node);
  }
}

function setStatus(text, kind) {
  statusPill.textContent = text;
  statusPill.className = `status-pill ${kind || ''}`.trim();
}

function mergePreferParsed(current, parsed) {
  const merged = structuredClone(current);
  mergeObject(merged.invoice, parsed.invoice);
  mergeObject(merged.seller, parsed.seller);
  mergeObject(merged.buyer, parsed.buyer);
  if (parsed.lines.some((line) => line.description || line.unitPrice)) {
    merged.lines = parsed.lines;
  }
  return merged;
}

function mergeObject(target, source) {
  for (const [key, value] of Object.entries(source || {})) {
    if (String(value || '').trim()) target[key] = value;
  }
}

function setPath(object, path, value) {
  const [group, key] = path.split('.');
  object[group][key] = value;
}

function getPath(object, path) {
  const [group, key] = path.split('.');
  return object[group]?.[key];
}
