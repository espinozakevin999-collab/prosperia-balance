export const money = (value, currency = 'MXN') =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

export function monthKey(date = new Date()) {
  const value = typeof date === 'string' ? new Date(`${date.slice(0, 10)}T12:00:00`) : date;
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
}

export function inMonth(transaction, month) {
  return !month || String(transaction.date || '').slice(0, 7) === month;
}

export function summarize(transactions, month) {
  const selected = transactions.filter((item) => inMonth(item, month));
  const income = selected
    .filter((item) => item.type === 'income')
    .reduce((total, item) => total + Number(item.amount || 0), 0);
  const expenses = selected.filter((item) => item.type === 'expense');
  const expense = expenses.reduce((total, item) => total + Number(item.amount || 0), 0);
  const personal = expenses
    .filter((item) => item.personal)
    .reduce((total, item) => total + Number(item.amount || 0), 0);
  const businessExpense = expense - personal;

  const categories = expenses.reduce((result, item) => {
    const category = item.category || 'Sin categoría';
    result[category] = (result[category] || 0) + Number(item.amount || 0);
    return result;
  }, {});

  return {
    selected,
    income,
    expense,
    personal,
    businessExpense,
    balance: income - expense,
    businessBalance: income - businessExpense,
    categories,
    incomeCount: selected.filter((item) => item.type === 'income').length,
    expenseCount: expenses.length,
  };
}

export function localInsights(summary, budget = 0) {
  const insights = [];
  const topCategory = Object.entries(summary.categories).sort((a, b) => b[1] - a[1])[0];

  if (!summary.selected.length) {
    return [{ tone: 'neutral', icon: '✍️', title: 'Empieza con un movimiento', text: 'Anota una venta o un gasto. Con eso Prospería comenzará a ayudarte.' }];
  }

  if (summary.balance >= 0) {
    insights.push({
      tone: 'good', icon: '🌱', title: 'Te quedó dinero',
      text: `Después de tus gastos te quedaron ${money(summary.balance)}. Separa una parte antes de volver a gastarla.`,
    });
  } else {
    insights.push({
      tone: 'danger', icon: '🧭', title: 'Salió más dinero del que entró',
      text: `Te faltaron ${money(Math.abs(summary.balance))}. Revisa primero el gasto más grande del mes.`,
    });
  }

  if (summary.personal > 0) {
    insights.push({
      tone: 'warn', icon: '🏠', title: 'Hay gastos de casa mezclados',
      text: `${money(summary.personal)} fueron gastos personales. Marcarlos por separado te muestra mejor cómo va tu negocio.`,
    });
  }

  if (topCategory) {
    insights.push({
      tone: 'neutral', icon: '🔎', title: `Tu mayor gasto fue ${topCategory[0]}`,
      text: `Ahí gastaste ${money(topCategory[1])}. Una reducción pequeña puede hacer una diferencia.`,
    });
  }

  if (budget > 0 && summary.expense > budget) {
    insights.unshift({
      tone: 'danger', icon: '⚠️', title: 'Pasaste tu límite de gastos',
      text: `Tu meta era gastar hasta ${money(budget)} y llevas ${money(summary.expense)}.`,
    });
  }

  return insights.slice(0, 4);
}

export function healthScore(summary, budget = 0) {
  if (!summary.selected.length || summary.income <= 0) return 0;
  let score = 55;
  const margin = summary.balance / summary.income;
  score += Math.max(-35, Math.min(30, margin * 80));
  if (summary.personal === 0) score += 8;
  if (budget > 0 && summary.expense <= budget) score += 7;
  return Math.round(Math.max(0, Math.min(100, score)));
}
