import { calculateMfeMae } from './mfeMae'

function todayIST() {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export async function updateMfeMaeForTrade(supabaseClient, tradeId) {
  try {
    const { data: trade, error: fetchError } = await supabaseClient
      .from('trades')
      .select('ticker, direction, entry_date, entry_price, exit_date, status, initial_stop_loss')
      .eq('id', tradeId)
      .single()
    if (fetchError || !trade) throw fetchError || new Error('Trade not found')

    const windowEnd = trade.exit_date ?? todayIST()

    const { data: bars, error: barsError } = await supabaseClient
      .from('price_history')
      .select('date, open, high, low, close, volume')
      .eq('ticker', trade.ticker)
      .gte('date', trade.entry_date)
      .lte('date', windowEnd)
      .order('date', { ascending: true })
    if (barsError) throw barsError

    const { mfe, mae, mfeR, maeR } = calculateMfeMae({
      direction: trade.direction,
      entryPrice: trade.entry_price,
      initialStopLoss: trade.initial_stop_loss,
      bars: bars || [],
    })

    const { error: updateError } = await supabaseClient
      .from('trades')
      .update({
        mfe,
        mae,
        mfe_r: mfeR,
        mae_r: maeR,
        mfe_mae_calculated_at: new Date().toISOString(),
      })
      .eq('id', tradeId)
    if (updateError) throw updateError
  } catch (e) {
    console.error(`updateMfeMaeForTrade failed for trade ${tradeId}:`, e.message)
  }
}
