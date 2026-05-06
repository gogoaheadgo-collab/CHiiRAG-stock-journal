import { supabase } from './supabase'

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://smk-stock-journal.vercel.app'

// ── Core fetch wrapper ───────────────────────────────────────────────────────
async function apiFetch(path: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('Not authenticated')

  const res = await fetch(`${BASE_URL}/api/${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  })

  const json = await res.json()
  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`)
  return json
}

// ── Trades ───────────────────────────────────────────────────────────────────
export const getTrades = async () => {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  const { data, error } = await supabase.from('trades').select('*').eq('user_id', session.user.id).order('entry_date', { ascending: false })
  if (error) throw new Error(error.message)
  return data || []
}
export const createTrade  = (body: any) => apiFetch('trades', { method: 'POST', body: JSON.stringify(body) })
export const updateTrade  = (body: any) => apiFetch('trades', { method: 'PUT',  body: JSON.stringify(body) })
export const deleteTrade  = (id: string) => apiFetch('trades', { method: 'DELETE', body: JSON.stringify({ id }) })

// ── Executions ───────────────────────────────────────────────────────────────
export const getExecutions = async (trade_id: string) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  const { data, error } = await supabase.from('executions').select('*').eq('trade_id', trade_id).eq('user_id', session.user.id).order('date', { ascending: true })
  if (error) throw new Error(error.message)
  return data || []
}
export const createExecution = (body: any)        => apiFetch('executions', { method: 'POST', body: JSON.stringify(body) })
export const deleteExecution = (id: string)       => apiFetch('executions', { method: 'DELETE', body: JSON.stringify({ id }) })

// ── Accounts ─────────────────────────────────────────────────────────────────
export const getAccounts = async () => {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  const { data, error } = await supabase.from('accounts').select('*').eq('user_id', session.user.id).order('name')
  if (error) throw new Error(error.message)
  return data || []
}
export const createAccount = (name: string) => apiFetch('accounts', { method: 'POST', body: JSON.stringify({ name }) })
export const deleteAccount = (id: string, name: string) => apiFetch('accounts', { method: 'DELETE', body: JSON.stringify({ id, name }) })

// ── Notes ────────────────────────────────────────────────────────────────────
export const getNotes      = (params?: { date?: string; search?: string; shared?: string }) => {
  const q = new URLSearchParams(params as any).toString()
  return apiFetch(`notes${q ? '?' + q : ''}`)
}
export const saveNote      = (body: any) => apiFetch('notes', { method: 'POST', body: JSON.stringify(body) })

// ── Price Alerts ─────────────────────────────────────────────────────────────
export const getPriceAlerts    = ()          => apiFetch('price-alerts')
export const createPriceAlert  = (body: any) => apiFetch('price-alerts', { method: 'POST', body: JSON.stringify(body) })
export const deletePriceAlert  = (id: string) => apiFetch('price-alerts', { method: 'DELETE', body: JSON.stringify({ id }) })

// ── Ticker Search ────────────────────────────────────────────────────────────
export const searchTicker = (q: string) => apiFetch(`ticker-search?q=${encodeURIComponent(q)}`)

// ── Stock Price ──────────────────────────────────────────────────────────────
export const getStockPrice = (symbol: string) => apiFetch(`stock/${symbol}`)

// ── Access / Approval ────────────────────────────────────────────────────────
export const checkAccess   = () => apiFetch('access')
export const checkApproval = () => apiFetch('check-approval', { method: 'POST' })

// ── Strategies ───────────────────────────────────────────────────────────────
export const getStrategies = () => apiFetch('strategies')

// ── Bank Accounts ────────────────────────────────────────────────────────────
export const getBankAccounts          = ()                  => apiFetch('bank-accounts')
export const getBankAccountsForUser   = (user_id: string)  => apiFetch(`bank-accounts?user_id=${user_id}`)
export const createBankAccount = (body: any) => apiFetch('bank-accounts', { method: 'POST', body: JSON.stringify(body) })
export const deleteBankAccount = (id: string) => apiFetch('bank-accounts', { method: 'DELETE', body: JSON.stringify({ id }) })

// ── Bank Transactions ────────────────────────────────────────────────────────
export const getBankTransactions   = (account_id: string) => apiFetch(`bank-transactions?account_id=${account_id}`)
export const createBankTransaction = (body: any)          => apiFetch('bank-transactions', { method: 'POST', body: JSON.stringify(body) })
export const deleteBankTransaction = (id: string)         => apiFetch('bank-transactions', { method: 'DELETE', body: JSON.stringify({ id }) })

// ── Shared Account Trades (subscribers) ──────────────────────────────────────
export const getSharedAccountTrades = () => apiFetch('shared-account-trades')

// ── Settlements ──────────────────────────────────────────────────────────────
export const getSettlements = (subscriber_id: string) => apiFetch(`settlements?subscriber_id=${subscriber_id}`)

// ── MTF Rates ────────────────────────────────────────────────────────────────
export const getMtfRates    = ()          => apiFetch('mtf-rates')
export const createMtfRate  = (body: any) => apiFetch('mtf-rates', { method: 'POST', body: JSON.stringify(body) })
export const deleteMtfRate  = (id: string) => apiFetch('mtf-rates', { method: 'DELETE', body: JSON.stringify({ id }) })

// ── Admin ────────────────────────────────────────────────────────────────────
export const getAdminMirror      = ()            => apiFetch('admin/mirror')
export const getSubscribers      = ()            => apiFetch('admin/subscribers')
export const getPendingUsers     = ()            => apiFetch('admin/pending-users')
export const approveUser         = (user_id: string, status: string) =>
  apiFetch('admin/approve-user', { method: 'POST', body: JSON.stringify({ user_id, status }) })
export const getSubscriberTrades = (user_id: string) => apiFetch(`admin/subscriber-trades?user_id=${user_id}`)
export const deleteSubscriber    = (user_id: string) =>
  apiFetch('admin/delete-subscriber', { method: 'DELETE', body: JSON.stringify({ user_id }) })
