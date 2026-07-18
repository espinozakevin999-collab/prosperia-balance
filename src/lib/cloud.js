import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const cloudConfigured = Boolean(url && key && !url.includes('TU-PROYECTO'));
export const supabase = cloudConfigured
  ? createClient(url, key, { auth: { persistSession: true, detectSessionInUrl: true } })
  : null;

function toRow(item, userId) {
  return {
    id: item.id,
    user_id: userId,
    type: item.type,
    amount: Number(item.amount),
    date: item.date,
    description: item.description,
    category: item.category,
    personal: Boolean(item.personal),
    notes: item.notes || '',
    created_at: item.created_at || new Date().toISOString(),
  };
}

export async function getSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function sendMagicLink(email) {
  if (!supabase) throw new Error('Supabase todavía no está configurado.');
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) throw error;
}

export async function signOut() {
  if (supabase) await supabase.auth.signOut();
}

export async function loadCloudData(userId) {
  const [{ data: transactions, error: transactionError }, { data: preferences, error: preferenceError }] = await Promise.all([
    supabase.from('transactions').select('*').eq('user_id', userId).order('date', { ascending: false }),
    supabase.from('preferences').select('*').eq('user_id', userId).maybeSingle(),
  ]);
  if (transactionError) throw transactionError;
  if (preferenceError) throw preferenceError;
  return { transactions: transactions || [], budget: Number(preferences?.monthly_budget || 0) };
}

export async function saveCloudTransaction(item, userId) {
  const { error } = await supabase.from('transactions').upsert(toRow(item, userId));
  if (error) throw error;
}

export async function saveManyCloudTransactions(items, userId) {
  if (!items.length) return;
  const { error } = await supabase.from('transactions').upsert(items.map((item) => toRow(item, userId)));
  if (error) throw error;
}

export async function deleteCloudTransaction(id, userId) {
  const { error } = await supabase.from('transactions').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

export async function deleteAllCloudData(userId) {
  const { error: transactionError } = await supabase.from('transactions').delete().eq('user_id', userId);
  if (transactionError) throw transactionError;
  const { error: preferenceError } = await supabase.from('preferences').delete().eq('user_id', userId);
  if (preferenceError) throw preferenceError;
}

export async function saveCloudBudget(monthlyBudget, userId) {
  const { error } = await supabase.from('preferences').upsert({ user_id: userId, monthly_budget: Number(monthlyBudget || 0) });
  if (error) throw error;
}
