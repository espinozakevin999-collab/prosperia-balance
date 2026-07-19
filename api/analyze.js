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

export function cleanAdvice(text) {
  return String(text || '')
    .replace(/\*\*/g, '')
    .replace(/__/g, '')
    .replace(/`/g, '')
    .trim();
}

function finiteNumber(value, minimum = 0, maximum = 1_000_000_000_000) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : 0;
}

export function buildSafeSummary(data) {
  return {
    month: /^\d{4}-(0[1-9]|1[0-2])$/.test(String(data.month || '')) ? String(data.month) : '',
    income: finiteNumber(data.income),
    expense: finiteNumber(data.expense),
    businessExpense: finiteNumber(data.businessExpense),
    personal: finiteNumber(data.personal),
    balance: finiteNumber(data.balance, -1_000_000_000_000),
    categories: Object.fromEntries(Object.entries(data.categories && !Array.isArray(data.categories) ? data.categories : {}).slice(0, 12).map(([name, value]) => [String(name).slice(0, 60), finiteNumber(value)])),
    transactionCount: Math.round(finiteNumber(data.transactionCount, 0, 1_000_000)),
  };
}

async function authenticatedUser(request) {
  const authorization = String(request.headers.authorization || '');
  if (!authorization.startsWith('Bearer ')) return null;

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;

  const authResponse = await fetch(`${url.replace(/\/$/, '')}/auth/v1/user`, {
    headers: { authorization, apikey: key },
  });
  if (!authResponse.ok) return null;
  return authResponse.json();
}

export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Método no permitido.' });
  const ip = String(request.headers['x-forwarded-for'] || request.socket?.remoteAddress || 'unknown').split(',')[0];

  const data = request.body || {};
  if (JSON.stringify(data).length > 12_000) return response.status(413).json({ error: 'El resumen es demasiado grande.' });
  const fallback = fallbackAdvice(data);
  if (!process.env.OPENAI_API_KEY) return response.status(200).json({ advice: fallback, ai: false });

  let user;
  try {
    user = await authenticatedUser(request);
  } catch (error) {
    console.error('Supabase authentication failed:', error.message);
  }
  if (!user?.id) return response.status(401).json({ error: 'Entra a tu cuenta para usar el análisis con IA.' });
  if (!allowRequest(`user:${user.id}:${ip}`)) return response.status(429).json({ error: 'Espera un minuto antes de pedir otro análisis.' });

  const safeSummary = buildSafeSummary(data);

  try {
    const openaiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-5.6-terra',
        store: false,
        max_output_tokens: 160,
        input: [
          {
            role: 'developer',
            content: 'Eres Prospería, una guía financiera para microemprendimientos. Responde en español mexicano cotidiano, en texto plano, sin Markdown, asteriscos ni encabezados, con máximo 55 palabras y sin tecnicismos. Da una sola observación y una acción concreta; no repitas todo el desglose. No juzgues, no prometas resultados y no inventes cifras ni categorías. Usa los nombres de categorías exactamente como aparecen. No describas para qué se usó personal: llámalo únicamente gastos personales. Evita consejos fiscales, legales o de inversión. expense es el gasto total e incluye personal; personal es un subconjunto de expense; businessExpense excluye personal. Nunca sumes personal a expense ni lo cuentes dos veces.',
          },
          { role: 'user', content: `Explica este resumen de forma sencilla: ${JSON.stringify(safeSummary)}` },
        ],
      }),
    });
    const result = await openaiResponse.json();
    if (!openaiResponse.ok) throw new Error(result?.error?.message || 'Error del servicio de IA');
    return response.status(200).json({ advice: cleanAdvice(extractText(result)) || fallback, ai: true });
  } catch (error) {
    console.error('OpenAI analysis failed:', error.message);
    return response.status(200).json({ advice: fallback, ai: false });
  }
}
