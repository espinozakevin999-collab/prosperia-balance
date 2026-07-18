function quote(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function transactionsToCsv(transactions) {
  const headers = ['fecha', 'tipo', 'monto', 'concepto', 'categoria', 'personal', 'notas'];
  const rows = transactions.map((item) => [
    item.date,
    item.type === 'income' ? 'ingreso' : 'gasto',
    Number(item.amount || 0).toFixed(2),
    item.description,
    item.category,
    item.personal ? 'sí' : 'no',
    item.notes || '',
  ]);
  return [headers, ...rows].map((row) => row.map(quote).join(',')).join('\n');
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"' && quoted && text[index + 1] === '"') {
      field += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      row.push(field.trim()); field = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field.trim()); field = '';
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else {
      field += character;
    }
  }
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2) return [];

  const keys = rows[0].map((key) => key.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
  const read = (values, names) => {
    const position = keys.findIndex((key) => names.includes(key));
    return position >= 0 ? values[position] : '';
  };

  return rows.slice(1).map((values, index) => {
    const rawType = read(values, ['tipo', 'type']).toLowerCase();
    const rawPersonal = read(values, ['personal', 'es_personal']).toLowerCase();
    const amount = Number(read(values, ['monto', 'amount']).replace(/[$,\s]/g, ''));
    return {
      id: crypto.randomUUID?.() || `import-${Date.now()}-${index}`,
      date: read(values, ['fecha', 'date']) || new Date().toISOString().slice(0, 10),
      type: ['ingreso', 'income', 'entrada'].includes(rawType) ? 'income' : 'expense',
      amount,
      description: read(values, ['concepto', 'descripcion', 'description']) || 'Movimiento importado',
      category: read(values, ['categoria', 'category']) || 'Sin categoría',
      personal: ['si', 'sí', 'true', '1', 'yes'].includes(rawPersonal),
      notes: read(values, ['notas', 'nota', 'notes', 'observaciones']),
      created_at: new Date().toISOString(),
    };
  }).filter((item) => Number.isFinite(item.amount) && item.amount > 0);
}
