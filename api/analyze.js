const requests = new Map();

function allowRequest(ip) {
  const now = Date.now();
  const windowMs = 60_000;
  const limit = 8;
  const recent = (requests.get(ip) || []).filter((time) => now - time < windowMs);
  if (recent.length >= limit) return false;
  recent.push(now);
  requests.set(ip, recent);
  return true;
}

function fallbackAdvice(data) {
  if (!data.transactionCount) return 'Registra primero una venta y un gasto. Con dos datos reales ya podremos darte una orientación útil.';
  if (data.balance < 0) return `Este mes salió más dinero del que entró. Empieza revisando la categoría con el gasto más alto y busca una reducción pequeña que puedas mantener.`;
  if (data.personal > 0) return `Tu negocio dejó dinero, pero hay gastos de casa mezclados. Separarlos te ayudará a saber cuánto gana realmente el negocio.`;
  return 'Tu negocio dejó dinero este mes. Antes de gastarlo, separa una parte para emergencias y otra para la próxima compra de insumos.';
}

function extractText(response) {
  if (response.output_text) return response.output_text;
  return (response.output || [])
    .flatMap((item) => item.content || [])
    .filter((item) => item.type === 'output_text')
    .map((item) => item.text)
    .join('\n')
    .trim();
}

export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Método no permitido.' });
  const ip = String(request.headers['x-forwarded-for'] || request.socket?.remoteAddress || 'unknown').split(',')[0];
  if (!allowRequest(ip)) return response.status(429).json({ error: 'Espera un minuto antes de pedir otro análisis.' });

  const data = request.body || {};
  if (JSON.stringify(data).length > 12_000) return response.status(413).json({ error: 'El resumen es demasiado grande.' });
  const fallback = fallbackAdvice(data);
  if (!process.env.OPENAI_API_KEY) return response.status(200).json({ advice: fallback, ai: false });

  const safeSummary = {
    month: String(data.month || '').slice(0, 7),
    income: Number(data.income || 0),
    expense: Number(data.expense || 0),
    personal: Number(data.personal || 0),
    balance: Number(data.balance || 0),
    categories: Object.fromEntries(Object.entries(data.categories || {}).slice(0, 12).map(([name, value]) => [String(name).slice(0, 60), Number(value || 0)])),
    transactionCount: Number(data.transactionCount || 0),
  };

  try {
    const openaiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-5.6-terra',
        store: false,
        max_output_tokens: 180,
        input: [
          {
            role: 'developer',
            content: 'Eres Prospería, una guía financiera para microemprendimientos. Responde en español mexicano cotidiano, con máximo 65 palabras y sin tecnicismos. Da una sola observación y una acción concreta. No juzgues, no prometas resultados y no inventes cifras. Evita consejos fiscales, legales o de inversión.',
          },
          { role: 'user', content: `Explica este resumen de forma sencilla: ${JSON.stringify(safeSummary)}` },
        ],
      }),
    });
    const result = await openaiResponse.json();
    if (!openaiResponse.ok) throw new Error(result?.error?.message || 'Error del servicio de IA');
    return response.status(200).json({ advice: extractText(result) || fallback, ai: true });
  } catch (error) {
    console.error('OpenAI analysis failed:', error.message);
    return response.status(200).json({ advice: fallback, ai: false });
  }
}
