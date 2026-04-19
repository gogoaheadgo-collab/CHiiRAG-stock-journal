import React, { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import NavPill from '../components/NavPill'

const ADMIN_EMAIL = 'gogoaheadgo@gmail.com'

const INDIAN_BANKS = [
  'State Bank of India', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Bank of Baroda',
  'Punjab National Bank', 'Canara Bank', 'Union Bank of India', 'Kotak Mahindra Bank',
  'IndusInd Bank', 'Yes Bank', 'IDFC First Bank', 'Bank of India', 'Central Bank of India',
  'Indian Bank', 'UCO Bank', 'Bank of Maharashtra', 'Indian Overseas Bank', 'Federal Bank',
  'RBL Bank', 'South Indian Bank', 'DCB Bank', 'City Union Bank', 'Karur Vysya Bank',
  'Paytm Payments Bank', 'Airtel Payments Bank', 'Fino Payments Bank', 'NSDL Payments Bank',
]

const bankFmt = n => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ── Add Account Modal ─────────────────────────────────────────────
function AddAccountModal({ onClose, onAdd }) {
  const [addBankName, setAddBankName] = useState('')
  const [addHolder, setAddHolder] = useState('')
  const [addInitBal, setAddInitBal] = useState('')
  const [addBankSugs, setAddBankSugs] = useState([])
  const [addShowDrop, setAddShowDrop] = useState(false)
  const [addSaving, setAddSaving] = useState(false)
  const [addErr, setAddErr] = useState('')

  const bankSearch = q => {
    setAddBankName(q)
    if (!q) { setAddBankSugs([]); setAddShowDrop(false); return }
    const filtered = INDIAN_BANKS.filter(b => b.toLowerCase().includes(q.toLowerCase())).slice(0, 6)
    setAddBankSugs(filtered); setAddShowDrop(filtered.length > 0)
  }

  const handleAddSave = async () => {
    setAddErr('')
    if (!addBankName.trim()) return setAddErr('Bank name required')
    if (!addHolder.trim()) return setAddErr('Holder name required')
    setAddSaving(true)
    try {
      await onAdd({ bank_name: addBankName.trim(), holder_name: addHolder.trim(), balance: addInitBal ? parseFloat(addInitBal) : 0 })
      onClose()
    } catch (addE) { setAddErr(addE.message) }
    setAddSaving(false)
  }

  const addFld = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px 12px', color: 'var(--text)', fontSize: '13px', fontFamily: 'DM Mono, monospace', width: '100%', outline: 'none', boxSizing: 'border-box' }
  const addLbl = { fontSize: '10px', color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'DM Mono, monospace', display: 'block', marginBottom: '4px' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '28px', width: '100%', maxWidth: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ fontFamily: 'Bookman Old Style, serif', fontWeight: 700, fontSize: '17px', color: 'var(--text)' }}>Add Bank Account</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', color: 'var(--muted)', cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ marginBottom: '14px', position: 'relative' }}>
          <label style={addLbl}>Bank Name *</label>
          <input value={addBankName} onChange={e => bankSearch(e.target.value)} onBlur={() => setTimeout(() => setAddShowDrop(false), 200)} placeholder="e.g. HDFC Bank, SBI..." style={addFld} />
          {addShowDrop && addBankSugs.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999, background: 'var(--bg)', border: '1px solid var(--accent)', borderRadius: '6px', boxShadow: '0 8px 20px rgba(0,0,0,0.15)', maxHeight: '180px', overflowY: 'auto', marginTop: '2px' }}>
              {addBankSugs.map((bankOpt, bankIdx) => (
                <div key={bankIdx} onMouseDown={() => { setAddBankName(bankOpt); setAddShowDrop(false) }}
                  style={{ padding: '9px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)', fontSize: '12px', fontFamily: 'DM Mono, monospace' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>{bankOpt}</div>
              ))}
            </div>
          )}
        </div>
        <div style={{ marginBottom: '14px' }}>
          <label style={addLbl}>Account Holder Name *</label>
          <input value={addHolder} onChange={e => setAddHolder(e.target.value)} placeholder="e.g. Gopal Chavda" style={addFld} />
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label style={addLbl}>Current Balance (Rs.)</label>
          <input type="number" value={addInitBal} onChange={e => setAddInitBal(e.target.value)} placeholder="0.00" style={addFld} step="0.01" min="0" />
          <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '3px', fontFamily: 'DM Mono, monospace' }}>Enter your current account balance</div>
        </div>
        {addErr && <div style={{ color: 'var(--bear)', fontSize: '12px', marginBottom: '12px', fontFamily: 'DM Mono, monospace' }}>{addErr}</div>}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--muted)', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
          <button onClick={handleAddSave} disabled={addSaving} style={{ flex: 2, padding: '10px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', opacity: addSaving ? 0.7 : 1 }}>
            {addSaving ? 'Adding...' : 'Add Account'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Record Transaction Modal ─────────────────────────────────────
function RecordTransactionModal({ bankAcct, allBankAccts, onClose, onRecord }) {
  const [rtxSrc, setRtxSrc]           = useState('CASH_DEPOSIT')
  const [rtxA2aDir, setRtxA2aDir]     = useState('TO')      // TO = sending out, FROM = receiving
  const [rtxA2aPartner, setRtxA2aPartner] = useState('')    // partner account id
  const [rtxWdMode, setRtxWdMode]     = useState('')
  const [rtxAmount, setRtxAmount]     = useState('')
  const [rtxDate, setRtxDate]         = useState(new Date().toISOString().slice(0, 10))
  const [rtxNotes, setRtxNotes]       = useState('')
  const [rtxSaving, setRtxSaving]     = useState(false)
  const [rtxErr, setRtxErr]           = useState('')

  const otherAccts = allBankAccts.filter(a => a.id !== bankAcct.id)
  const rtxAmtNum  = parseFloat(rtxAmount) || 0

  // Derive credit/debit from source selection
  const rtxIsCredit = rtxSrc === 'CASH_DEPOSIT' || (rtxSrc === 'A2A_TRANSFER' && rtxA2aDir === 'FROM')
  const rtxTxnType  = rtxIsCredit ? 'CREDIT' : 'DEBIT'
  const rtxPreviewBal = rtxIsCredit ? bankAcct.balance + rtxAmtNum : bankAcct.balance - rtxAmtNum

  const rtxFld = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px 12px', color: 'var(--text)', fontSize: '13px', fontFamily: 'DM Mono, monospace', width: '100%', outline: 'none', boxSizing: 'border-box' }
  const rtxLbl = { fontSize: '10px', color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'DM Mono, monospace', display: 'block', marginBottom: '4px' }
  const rtxSec = { fontSize: '9px', color: 'var(--muted)', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'DM Mono, monospace', borderBottom: '1px solid var(--border)', paddingBottom: '6px', marginBottom: '12px', marginTop: '16px' }

  const handleSrcSwitch = newSrc => { setRtxSrc(newSrc); setRtxA2aPartner(''); setRtxWdMode('') }

  const handleRecordSave = async () => {
    setRtxErr('')
    if (!rtxAmount || rtxAmtNum <= 0) return setRtxErr('Enter a valid amount')
    if (rtxSrc === 'A2A_TRANSFER' && !rtxA2aPartner) return setRtxErr('Select the other account')
    setRtxSaving(true)
    try {
      let rtxSrcDetail = ''
      if (rtxSrc === 'CASH_DEPOSIT')    rtxSrcDetail = 'બેંકમાં જમા'
      if (rtxSrc === 'CASH_WITHDRAWAL') rtxSrcDetail = bankAcct.bank_name
      if (rtxSrc === 'A2A_TRANSFER') {
        const partnerAcct = otherAccts.find(a => a.id === rtxA2aPartner)
        rtxSrcDetail = partnerAcct ? `${partnerAcct.holder_name} (${partnerAcct.bank_name})` : ''
      }
      await onRecord({
        transaction_date:        rtxDate,
        transaction_type:        rtxTxnType,
        source_type:             rtxSrc,
        source_detail:           rtxSrcDetail,
        withdrawal_mode:         rtxWdMode || null,
        amount:                  rtxAmtNum,
        notes:                   rtxNotes || null,
        a2a_partner_account_id:  rtxSrc === 'A2A_TRANSFER' ? rtxA2aPartner : null,
      })
      onClose()
    } catch (rtxE) { setRtxErr(rtxE.message) }
    setRtxSaving(false)
  }

  // Source option config
  const rtxSrcOpts = [
    { val: 'CASH_DEPOSIT',    label: '↑ Cash Deposit',    sub: 'પૈસા આવ્યા', color: 'var(--bull)',  bg: 'rgba(14,165,233,0.08)',  border: 'var(--bull)'  },
    { val: 'CASH_WITHDRAWAL', label: '↓ Cash Withdrawal', sub: 'પૈસા ગયા',  color: 'var(--bear)',  bg: 'rgba(239,68,68,0.08)',   border: 'var(--bear)'  },
    { val: 'A2A_TRANSFER',    label: '↔ A2A Transfer',    sub: 'ખાતા બદલી', color: 'var(--gold)',  bg: 'rgba(245,158,11,0.08)',  border: 'var(--gold)'  },
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '28px', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <div style={{ fontFamily: 'Bookman Old Style, serif', fontWeight: 700, fontSize: '17px', color: 'var(--text)' }}>Record Transaction</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', color: 'var(--muted)', cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', marginBottom: '20px' }}>
          {bankAcct.holder_name} · {bankAcct.bank_name} · Balance: Rs.{bankFmt(bankAcct.balance)}
        </div>

        {/* Source — 3 primary options */}
        <div style={rtxSec}>Transaction Type</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '16px' }}>
          {rtxSrcOpts.map(opt => (
            <button key={opt.val} onClick={() => handleSrcSwitch(opt.val)} style={{
              padding: '10px 6px', borderRadius: '6px', cursor: 'pointer', textAlign: 'center',
              fontFamily: 'DM Mono, monospace', fontWeight: rtxSrc === opt.val ? 700 : 400,
              border: `2px solid ${rtxSrc === opt.val ? opt.border : 'var(--border)'}`,
              background: rtxSrc === opt.val ? opt.bg : 'var(--surface)',
              color: rtxSrc === opt.val ? opt.color : 'var(--muted)',
            }}>
              <div style={{ fontSize: '12px' }}>{opt.label}</div>
              <div style={{ fontSize: '10px', opacity: 0.75, marginTop: '2px' }}>{opt.sub}</div>
            </button>
          ))}
        </div>

        {/* A2A: direction + account picker */}
        {rtxSrc === 'A2A_TRANSFER' && (
          <>
            <div style={{ marginBottom: '10px' }}>
              <label style={rtxLbl}>Direction</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[
                  { val: 'TO',   label: '→ Transfer To',   sub: 'Send money out (Debit)',   color: 'var(--bear)' },
                  { val: 'FROM', label: '← Transfer From', sub: 'Receive money (Credit)',   color: 'var(--bull)' },
                ].map(dirOpt => (
                  <button key={dirOpt.val} onClick={() => setRtxA2aDir(dirOpt.val)} style={{
                    flex: 1, padding: '8px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px',
                    fontFamily: 'DM Mono, monospace', fontWeight: rtxA2aDir === dirOpt.val ? 700 : 400,
                    border: `1px solid ${rtxA2aDir === dirOpt.val ? dirOpt.color : 'var(--border)'}`,
                    background: rtxA2aDir === dirOpt.val ? (dirOpt.val === 'TO' ? 'rgba(239,68,68,0.06)' : 'rgba(14,165,233,0.06)') : 'var(--surface)',
                    color: rtxA2aDir === dirOpt.val ? dirOpt.color : 'var(--muted)',
                  }}>
                    <div>{dirOpt.label}</div>
                    <div style={{ fontSize: '9px', opacity: 0.7, marginTop: '2px' }}>{dirOpt.sub}</div>
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label style={rtxLbl}>{rtxA2aDir === 'TO' ? 'Transfer To Account' : 'Transfer From Account'} *</label>
              {otherAccts.length === 0 ? (
                <div style={{ padding: '10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--muted)', fontSize: '12px', fontFamily: 'DM Mono, monospace' }}>No other accounts — add another account first.</div>
              ) : (
                <select value={rtxA2aPartner} onChange={e => setRtxA2aPartner(e.target.value)} style={rtxFld}>
                  <option value="">— Select Account —</option>
                  {otherAccts.map(oa => <option key={oa.id} value={oa.id}>{oa.holder_name} — {oa.bank_name}</option>)}
                </select>
              )}
            </div>
            <div style={{ marginBottom: '14px', padding: '10px 14px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '6px', fontSize: '11px', color: 'var(--gold)', fontFamily: 'DM Mono, monospace' }}>
              ↔ This will automatically create entries in <strong>both accounts</strong>
            </div>
          </>
        )}

        {/* Cash Withdrawal: mode selector */}
        {rtxSrc === 'CASH_WITHDRAWAL' && (
          <div style={{ marginBottom: '14px' }}>
            <label style={rtxLbl}>Mode of Withdrawal</label>
            <select value={rtxWdMode} onChange={e => setRtxWdMode(e.target.value)} style={rtxFld}>
              <option value="">— Select Mode —</option>
              <option value="ATM">ATM</option>
              <option value="CHEQUE">Cheque</option>
              <option value="OTHER_TRANSFER">Other Account Transfer</option>
            </select>
          </div>
        )}

        {/* Cash Deposit: show bank name info */}
        {rtxSrc === 'CASH_DEPOSIT' && (
          <div style={{ marginBottom: '14px', padding: '8px 14px', background: 'rgba(14,165,233,0.05)', border: '1px solid rgba(14,165,233,0.2)', borderRadius: '6px', fontSize: '11px', color: 'var(--bull)', fontFamily: 'DM Mono, monospace' }}>
            💰 Depositing into: <strong>{bankAcct.holder_name} · {bankAcct.bank_name}</strong> — Source: બેંકમાં જમા
          </div>
        )}

        {/* Amount + Date */}
        <div style={rtxSec}>Amount & Date</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
          <div>
            <label style={rtxLbl}>Amount (Rs.) *</label>
            <input type="number" value={rtxAmount} onChange={e => setRtxAmount(e.target.value)} placeholder="0.00"
              style={{ ...rtxFld, borderColor: rtxAmount ? (rtxIsCredit ? 'var(--bull)' : 'var(--bear)') : 'var(--border)' }} step="0.01" min="0" />
            {rtxAmtNum > 0 && <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '3px', fontFamily: 'DM Mono, monospace' }}>Rs.{rtxAmtNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>}
          </div>
          <div>
            <label style={rtxLbl}>Date *</label>
            <input type="date" value={rtxDate} onChange={e => setRtxDate(e.target.value)} style={rtxFld} />
          </div>
        </div>

        <div style={{ marginBottom: '14px' }}>
          <label style={rtxLbl}>Notes (optional)</label>
          <input value={rtxNotes} onChange={e => setRtxNotes(e.target.value)} placeholder="Reference, reason, description..." style={rtxFld} />
        </div>

        {/* Balance preview */}
        {rtxAmtNum > 0 && (
          <div style={{ marginBottom: '16px', padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>
              {bankAcct.holder_name} balance after
            </div>
            <div style={{ fontWeight: 700, fontFamily: 'DM Mono, monospace', fontSize: '15px', color: rtxIsCredit ? 'var(--bull)' : 'var(--bear)' }}>
              Rs.{rtxPreviewBal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
        )}

        {rtxErr && <div style={{ color: 'var(--bear)', fontSize: '12px', marginBottom: '12px', fontFamily: 'DM Mono, monospace' }}>{rtxErr}</div>}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--muted)', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
          <button onClick={handleRecordSave} disabled={rtxSaving} style={{
            flex: 2, padding: '10px', border: 'none', borderRadius: '6px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', opacity: rtxSaving ? 0.7 : 1,
            background: rtxSrc === 'CASH_DEPOSIT' ? 'var(--bull)' : rtxSrc === 'CASH_WITHDRAWAL' ? 'var(--bear)' : 'var(--gold)', color: '#fff',
          }}>
            {rtxSaving ? 'Recording...' : rtxSrc === 'CASH_DEPOSIT' ? '↑ Record Deposit' : rtxSrc === 'CASH_WITHDRAWAL' ? '↓ Record Withdrawal' : '↔ Record Transfer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Edit Account Modal ───────────────────────────────────────────
function EditAccountModal({ bankAcct: editAcct, onClose, onSave }) {
  const [eaBankName, setEaBankName] = useState(editAcct.bank_name)
  const [eaHolder, setEaHolder]     = useState(editAcct.holder_name)
  const [eaSugs, setEaSugs]         = useState([])
  const [eaShowDrop, setEaShowDrop] = useState(false)
  const [eaSaving, setEaSaving]     = useState(false)
  const [eaErr, setEaErr]           = useState('')
  const eaFld = { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'6px', padding:'8px 12px', color:'var(--text)', fontSize:'13px', fontFamily:'DM Mono, monospace', width:'100%', outline:'none', boxSizing:'border-box' }
  const eaLbl = { fontSize:'10px', color:'var(--muted)', letterSpacing:'0.1em', textTransform:'uppercase', fontFamily:'DM Mono, monospace', display:'block', marginBottom:'4px' }
  const eaBankSearch = q => { setEaBankName(q); if (!q) { setEaSugs([]); setEaShowDrop(false); return }; const f = INDIAN_BANKS.filter(b => b.toLowerCase().includes(q.toLowerCase())).slice(0,6); setEaSugs(f); setEaShowDrop(f.length > 0) }
  const handleEaSave = async () => {
    setEaErr('')
    if (!eaBankName.trim()) return setEaErr('Bank name required')
    if (!eaHolder.trim()) return setEaErr('Holder name required')
    setEaSaving(true)
    try { await onSave({ id: editAcct.id, bank_name: eaBankName.trim(), holder_name: eaHolder.trim() }); onClose() }
    catch (eaE) { setEaErr(eaE.message) }
    setEaSaving(false)
  }
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'12px', padding:'28px', width:'100%', maxWidth:'400px', boxShadow:'0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
          <div style={{ fontFamily:'Bookman Old Style, serif', fontWeight:700, fontSize:'17px', color:'var(--text)' }}>Edit Account</div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:'20px', color:'var(--muted)', cursor:'pointer' }}>×</button>
        </div>
        <div style={{ marginBottom:'14px', position:'relative' }}>
          <label style={eaLbl}>Bank Name *</label>
          <input value={eaBankName} onChange={e => eaBankSearch(e.target.value)} onBlur={() => setTimeout(() => setEaShowDrop(false), 200)} style={eaFld} />
          {eaShowDrop && eaSugs.length > 0 && (
            <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:999, background:'var(--bg)', border:'1px solid var(--accent)', borderRadius:'6px', boxShadow:'0 8px 20px rgba(0,0,0,0.15)', maxHeight:'160px', overflowY:'auto', marginTop:'2px' }}>
              {eaSugs.map((bk, bi) => (<div key={bi} onMouseDown={() => { setEaBankName(bk); setEaShowDrop(false) }} style={{ padding:'8px 14px', cursor:'pointer', borderBottom:'1px solid var(--border)', fontSize:'12px', fontFamily:'DM Mono, monospace' }} onMouseEnter={e=>e.currentTarget.style.background='var(--surface)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>{bk}</div>))}
            </div>
          )}
        </div>
        <div style={{ marginBottom:'20px' }}>
          <label style={eaLbl}>Holder Name *</label>
          <input value={eaHolder} onChange={e => setEaHolder(e.target.value)} style={eaFld} />
        </div>
        {eaErr && <div style={{ color:'var(--bear)', fontSize:'12px', marginBottom:'12px', fontFamily:'DM Mono, monospace' }}>{eaErr}</div>}
        <div style={{ display:'flex', gap:'8px' }}>
          <button onClick={onClose} style={{ flex:1, padding:'10px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'6px', color:'var(--muted)', cursor:'pointer', fontSize:'13px' }}>Cancel</button>
          <button onClick={handleEaSave} disabled={eaSaving} style={{ flex:2, padding:'10px', background:'var(--accent)', color:'#fff', border:'none', borderRadius:'6px', fontWeight:700, fontSize:'13px', cursor:'pointer', opacity:eaSaving?0.7:1 }}>{eaSaving?'Saving...':'Save Changes'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Edit Transaction Modal ────────────────────────────────────────
function EditTransactionModal({ txn, bankAcct: etAcct, allBankAccts: etAllAccts, onClose, onUpdate }) {
  const [etType, setEtType]       = useState(txn.transaction_type)
  const [etSrc, setEtSrc]         = useState(txn.source_type)
  const [etSrcDetail, setEtSrcDetail] = useState(txn.source_detail || '')
  const [etWdMode, setEtWdMode]   = useState(txn.withdrawal_mode || '')
  const [etAmount, setEtAmount]   = useState(String(txn.amount))
  const [etDate, setEtDate]       = useState(txn.transaction_date)
  const [etNotes, setEtNotes]     = useState(txn.notes || '')
  const [etSaving, setEtSaving]   = useState(false)
  const [etErr, setEtErr]         = useState('')
  const etOtherAccts = etAllAccts.filter(a => a.id !== etAcct.id)
  const etAmtNum = parseFloat(etAmount) || 0
  const etFld = { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'6px', padding:'8px 12px', color:'var(--text)', fontSize:'13px', fontFamily:'DM Mono, monospace', width:'100%', outline:'none', boxSizing:'border-box' }
  const etLbl = { fontSize:'10px', color:'var(--muted)', letterSpacing:'0.1em', textTransform:'uppercase', fontFamily:'DM Mono, monospace', display:'block', marginBottom:'4px' }
  const etSec = { fontSize:'9px', color:'var(--muted)', letterSpacing:'0.12em', textTransform:'uppercase', fontFamily:'DM Mono, monospace', borderBottom:'1px solid var(--border)', paddingBottom:'6px', marginBottom:'12px', marginTop:'16px' }
  const handleEtTypeSwitch = v => { setEtType(v); setEtSrc(v==='CREDIT'?'CASH_DEPOSIT':'CASH_WITHDRAWAL'); setEtSrcDetail(''); setEtWdMode('') }
  const handleEtSave = async () => {
    setEtErr('')
    if (!etAmount || etAmtNum <= 0) return setEtErr('Enter a valid amount')
    if (etSrc === 'A2A_TRANSFER' && !etSrcDetail) return setEtErr('Select source/destination account')
    setEtSaving(true)
    try {
      const etSrcDetailVal = etSrc === 'CASH_DEPOSIT' ? 'બેંકમાં જમા' : etSrc === 'A2A_TRANSFER' ? etSrcDetail : etAcct.bank_name
      await onUpdate({ id: txn.id, transaction_date: etDate, transaction_type: etType, source_type: etSrc, source_detail: etSrcDetailVal, withdrawal_mode: etWdMode || null, amount: etAmtNum, notes: etNotes || null })
      onClose()
    } catch (etE) { setEtErr(etE.message) }
    setEtSaving(false)
  }
  const etCreditSrcOpts = [{ val:'CASH_DEPOSIT', lbl:'Cash Deposit' }, { val:'A2A_TRANSFER', lbl:'A2A Transfer' }]
  const etDebitSrcOpts  = [{ val:'CASH_WITHDRAWAL', lbl:'Cash Withdrawal' }, { val:'A2A_TRANSFER', lbl:'A2A Transfer' }]
  const etActiveSrcOpts = etType === 'CREDIT' ? etCreditSrcOpts : etDebitSrcOpts
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'12px', padding:'28px', width:'100%', maxWidth:'460px', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px' }}>
          <div style={{ fontFamily:'Bookman Old Style, serif', fontWeight:700, fontSize:'17px', color:'var(--text)' }}>Edit Transaction</div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:'20px', color:'var(--muted)', cursor:'pointer' }}>×</button>
        </div>
        <div style={{ fontSize:'11px', color:'var(--muted)', fontFamily:'DM Mono, monospace', marginBottom:'16px' }}>{etAcct.bank_name} · {etAcct.holder_name}</div>
        <div style={etSec}>Transaction Type</div>
        <div style={{ display:'flex', gap:'8px', marginBottom:'16px' }}>
          {[{ val:'CREDIT', label:'↑ પૈસા આવ્યા', color:'var(--bull)', bg:'rgba(14,165,233,0.08)' }, { val:'DEBIT', label:'↓ પૈસા ગયા', color:'var(--bear)', bg:'rgba(239,68,68,0.08)' }].map(etOpt => (
            <button key={etOpt.val} onClick={() => handleEtTypeSwitch(etOpt.val)} style={{ flex:1, padding:'10px 8px', borderRadius:'6px', cursor:'pointer', fontSize:'13px', fontFamily:'DM Mono, monospace', fontWeight:etType===etOpt.val?700:400, border:`2px solid ${etType===etOpt.val?etOpt.color:'var(--border)'}`, background:etType===etOpt.val?etOpt.bg:'var(--surface)', color:etType===etOpt.val?etOpt.color:'var(--muted)' }}>{etOpt.label}</button>
          ))}
        </div>
        <div style={etSec}>Source</div>
        <div style={{ display:'flex', gap:'8px', marginBottom:'14px' }}>
          {etActiveSrcOpts.map(etSrcOpt => (
            <button key={etSrcOpt.val} onClick={() => { setEtSrc(etSrcOpt.val); setEtSrcDetail(''); setEtWdMode('') }} style={{ flex:1, padding:'8px', borderRadius:'6px', cursor:'pointer', fontSize:'11px', fontFamily:'DM Mono, monospace', fontWeight:etSrc===etSrcOpt.val?700:400, border:`1px solid ${etSrc===etSrcOpt.val?(etType==='CREDIT'?'var(--bull)':'var(--bear)'):'var(--border)'}`, background:etSrc===etSrcOpt.val?(etType==='CREDIT'?'rgba(14,165,233,0.06)':'rgba(239,68,68,0.06)'):'var(--surface)', color:etSrc===etSrcOpt.val?(etType==='CREDIT'?'var(--bull)':'var(--bear)'):'var(--muted)' }}>{etSrcOpt.lbl}</button>
          ))}
        </div>
        {etSrc === 'A2A_TRANSFER' && (
          <div style={{ marginBottom:'14px' }}>
            <label style={etLbl}>{etType==='CREDIT'?'Transfer From':'Transfer To'} *</label>
            <select value={etSrcDetail} onChange={e => setEtSrcDetail(e.target.value)} style={etFld}>
              <option value="">— Select Account —</option>
              {etOtherAccts.map(oa => <option key={oa.id} value={`${oa.bank_name} (${oa.holder_name})`}>{oa.bank_name} — {oa.holder_name}</option>)}
            </select>
          </div>
        )}
        {etSrc === 'CASH_WITHDRAWAL' && (
          <div style={{ marginBottom:'14px' }}>
            <label style={etLbl}>Mode of Withdrawal</label>
            <select value={etWdMode} onChange={e => setEtWdMode(e.target.value)} style={etFld}>
              <option value="">— Select Mode —</option>
              <option value="ATM">ATM</option>
              <option value="CHEQUE">Cheque</option>
              <option value="OTHER_TRANSFER">Other Account Transfer</option>
            </select>
          </div>
        )}
        <div style={etSec}>Amount & Date</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'14px' }}>
          <div>
            <label style={etLbl}>Amount (Rs.) *</label>
            <input type="number" value={etAmount} onChange={e => setEtAmount(e.target.value)} style={{ ...etFld, borderColor: etAmount?(etType==='CREDIT'?'var(--bull)':'var(--bear)'):'var(--border)' }} step="0.01" min="0" />
          </div>
          <div>
            <label style={etLbl}>Date *</label>
            <input type="date" value={etDate} onChange={e => setEtDate(e.target.value)} style={etFld} />
          </div>
        </div>
        <div style={{ marginBottom:'14px' }}>
          <label style={etLbl}>Notes (optional)</label>
          <input value={etNotes} onChange={e => setEtNotes(e.target.value)} style={etFld} />
        </div>
        {etErr && <div style={{ color:'var(--bear)', fontSize:'12px', marginBottom:'12px', fontFamily:'DM Mono, monospace' }}>{etErr}</div>}
        <div style={{ display:'flex', gap:'8px' }}>
          <button onClick={onClose} style={{ flex:1, padding:'10px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'6px', color:'var(--muted)', cursor:'pointer', fontSize:'13px' }}>Cancel</button>
          <button onClick={handleEtSave} disabled={etSaving} style={{ flex:2, padding:'10px', background:etType==='CREDIT'?'var(--bull)':'var(--bear)', color:'#fff', border:'none', borderRadius:'6px', fontWeight:700, fontSize:'13px', cursor:'pointer', opacity:etSaving?0.7:1 }}>{etSaving?'Saving...':'Save Changes'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────
export default function BankPage() {
  const router = useRouter()
  const [bankSession, setBankSession] = useState(null)
  const [bankIsAdmin, setBankIsAdmin] = useState(false)
  const [bankPageLoad, setBankPageLoad] = useState(true)
  const [bankSubscribers, setBankSubscribers] = useState([])
  const [bankAllSubs, setBankAllSubs] = useState([])
  const [bankShowAddSub, setBankShowAddSub] = useState(false)
  const [bankSelSubId, setBankSelSubId] = useState(null)
  const [bankSelSubName, setBankSelSubName] = useState('')
  const [bankAccts, setBankAccts] = useState([])
  const [bankSelAcct, setBankSelAcct] = useState(null)
  const [bankTxns, setBankTxns] = useState([])
  const [bankTxnLoad, setBankTxnLoad] = useState(false)
  const [bankAcctsLoad, setBankAcctsLoad] = useState(false)
  const [bankShowAdd, setBankShowAdd] = useState(false)
  const [bankShowTxn, setBankShowTxn] = useState(false)
  const [bankEditAcct, setBankEditAcct] = useState(null)
  const [bankEditTxn, setBankEditTxn]   = useState(null)
  const [bankApproving, setBankApproving] = useState(null)

  // Close Add Subscriber dropdown on outside click
  useEffect(() => {
    if (!bankShowAddSub) return
    const closeAddSub = (e) => { if (!e.target.closest('.bank-add-sub-zone')) setBankShowAddSub(false) }
    document.addEventListener('mousedown', closeAddSub)
    return () => document.removeEventListener('mousedown', closeAddSub)
  }, [bankShowAddSub])

  const getToken = useCallback(async () => (await supabase.auth.getSession()).data.session?.access_token, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: bankSess } }) => {
      if (!bankSess) { router.push('/'); return }
      setBankSession(bankSess)
      setBankIsAdmin(bankSess.user.email === ADMIN_EMAIL)
      setBankPageLoad(false)
    })
    const { data: { subscription: bankAuthSub } } = supabase.auth.onAuthStateChange((_, bankS) => {
      if (!bankS) router.push('/')
    })
    return () => bankAuthSub.unsubscribe()
  }, [])

  const loadBankSubscribers = useCallback(async (token) => {
    const fetchToken = token || await getToken()
    const bankSubsRes = await fetch('/api/admin/subscribers', { headers: { Authorization: `Bearer ${fetchToken}` } })
    const bankSubsData = await bankSubsRes.json()
    if (Array.isArray(bankSubsData)) {
      const nonAdminSubs = bankSubsData.filter(subItem => !subItem.isAdmin)
      setBankAllSubs(nonAdminSubs)
      setBankSubscribers(nonAdminSubs.filter(subItem => subItem.status === 'approved'))
    }
  }, [getToken])

  useEffect(() => {
    if (!bankSession || !bankIsAdmin) return
    loadBankSubscribers()
  }, [bankSession, bankIsAdmin, loadBankSubscribers])

  const loadBankAccounts = useCallback(async (uid, preserveAcctId = null) => {
    setBankAcctsLoad(true)
    const bankAcctToken = await getToken()
    const bankAcctUrl = uid ? `/api/bank-accounts?user_id=${uid}` : '/api/bank-accounts'
    const bankAcctRes = await fetch(bankAcctUrl, { headers: { Authorization: `Bearer ${bankAcctToken}` } })
    const bankAcctData = await bankAcctRes.json()
    if (Array.isArray(bankAcctData)) {
      setBankAccts(bankAcctData)
      if (preserveAcctId) {
        const foundAcct = bankAcctData.find(a => a.id === preserveAcctId)
        if (foundAcct) setBankSelAcct(foundAcct)
        else { setBankSelAcct(null); setBankTxns([]) }
      } else { setBankSelAcct(null); setBankTxns([]) }
    }
    setBankAcctsLoad(false)
  }, [getToken])

  useEffect(() => {
    if (!bankSession || bankIsAdmin) return
    loadBankAccounts(null)
  }, [bankSession, bankIsAdmin, loadBankAccounts])

  const loadBankTxns = useCallback(async (acctId) => {
    setBankTxnLoad(true)
    const bankTxnToken = await getToken()
    const bankTxnRes = await fetch(`/api/bank-transactions?account_id=${acctId}`, { headers: { Authorization: `Bearer ${bankTxnToken}` } })
    const bankTxnData = await bankTxnRes.json()
    if (Array.isArray(bankTxnData)) setBankTxns(bankTxnData)
    setBankTxnLoad(false)
  }, [getToken])

  const handleSelectAcct = acct => {
    if (bankSelAcct?.id === acct.id) { setBankSelAcct(null); setBankTxns([]); return }
    setBankSelAcct(acct)
    loadBankTxns(acct.id)
  }

  const handleAddAcct = async acctFormData => {
    const bankAddToken = await getToken()
    const addBody = bankIsAdmin && bankSelSubId ? { ...acctFormData, user_id: bankSelSubId } : acctFormData
    const bankAddRes = await fetch('/api/bank-accounts', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bankAddToken}` }, body: JSON.stringify(addBody) })
    const bankAddData = await bankAddRes.json()
    if (bankAddData.error) throw new Error(bankAddData.error)
    await loadBankAccounts(bankIsAdmin ? bankSelSubId : null)
  }

  const handleDeleteAcct = async acctId => {
    if (!confirm('🗑 Delete this bank account?\n\nAll transactions will also be deleted permanently.')) return
    if (!confirm('⚠️ CONFIRM DELETE\n\nAre you absolutely sure? This cannot be undone.')) return
    const bankDelToken = await getToken()
    await fetch('/api/bank-accounts', { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bankDelToken}` }, body: JSON.stringify({ id: acctId }) })
    if (bankSelAcct?.id === acctId) { setBankSelAcct(null); setBankTxns([]) }
    await loadBankAccounts(bankIsAdmin ? bankSelSubId : null)
  }

  const handleRecordTxn = async txnFormData => {
    const bankTxnPostToken = await getToken()
    const bankTxnPostRes = await fetch('/api/bank-transactions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bankTxnPostToken}` }, body: JSON.stringify({ account_id: bankSelAcct.id, ...txnFormData }) })
    const bankTxnPostData = await bankTxnPostRes.json()
    if (bankTxnPostData.error) throw new Error(bankTxnPostData.error)
    const savedAcctId = bankSelAcct.id
    await loadBankTxns(savedAcctId)
    await loadBankAccounts(bankIsAdmin ? bankSelSubId : null, savedAcctId)
  }

  const handleDeleteTxn = async txnId => {
    if (!confirm('🗑 Delete this transaction?\n\nThe account balance will be recalculated automatically.')) return
    if (!confirm('⚠️ CONFIRM DELETE\n\nAre you sure? This cannot be undone.')) return
    const bankDelTxnToken = await getToken()
    await fetch('/api/bank-transactions', { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bankDelTxnToken}` }, body: JSON.stringify({ id: txnId }) })
    const currentAcctId = bankSelAcct.id
    await loadBankTxns(currentAcctId)
    await loadBankAccounts(bankIsAdmin ? bankSelSubId : null, currentAcctId)
  }

  const handleSelectSub = async sub => {
    if (bankSelSubId === sub.id) { setBankSelSubId(null); setBankSelSubName(''); setBankAccts([]); setBankSelAcct(null); setBankTxns([]); return }
    setBankSelSubId(sub.id)
    setBankSelSubName(sub.full_name || sub.email?.split('@')[0] || 'Subscriber')
    await loadBankAccounts(sub.id)
  }

  const signOut = async () => { await supabase.auth.signOut(); window.location.href = '/' }

  const handleApproveToggle = async (bankSub, forceStatus) => {
    setBankApproving(bankSub.id)
    const approveToken = await getToken()
    const newStatus = forceStatus || (bankSub.status === 'approved' ? 'rejected' : 'approved')
    await fetch('/api/admin/approve-user', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${approveToken}` }, body: JSON.stringify({ user_id: bankSub.id, status: newStatus }) })
    await loadBankSubscribers(approveToken)
    if (newStatus === 'rejected' && bankSelSubId === bankSub.id) { setBankSelSubId(null); setBankSelSubName(''); setBankAccts([]); setBankSelAcct(null); setBankTxns([]) }
    setBankApproving(null)
  }

  const handleEditAcct = async (editAcctData) => {
    const editAcctToken = await getToken()
    const editAcctRes = await fetch('/api/bank-accounts', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${editAcctToken}` }, body: JSON.stringify(editAcctData) })
    const editAcctResult = await editAcctRes.json()
    if (editAcctResult.error) throw new Error(editAcctResult.error)
    const preserveId = bankSelAcct?.id
    await loadBankAccounts(bankIsAdmin ? bankSelSubId : null, preserveId)
  }

  const handleEditTxn = async (editTxnData) => {
    const editTxnToken = await getToken()
    const editTxnRes = await fetch('/api/bank-transactions', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${editTxnToken}` }, body: JSON.stringify(editTxnData) })
    const editTxnResult = await editTxnRes.json()
    if (editTxnResult.error) throw new Error(editTxnResult.error)
    const savedAcctId2 = bankSelAcct.id
    await loadBankTxns(savedAcctId2)
    await loadBankAccounts(bankIsAdmin ? bankSelSubId : null, savedAcctId2)
  }

  if (bankPageLoad || !bankSession) return null

  return (
    <>
      <div className="tricolor-bar" />
      <Head><title>Bank Transfer — CHiiRAG Stock Journal</title></Head>
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="india-flag-logo-sm" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, background: '#FF9933' }} />
            <div style={{ flex: 1, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', border: '1.5px solid #000080' }} />
            </div>
            <div style={{ flex: 1, background: '#138808' }} />
          </div>
          <div className="header-brand" style={{ fontFamily: 'Bookman Old Style, serif', fontWeight: 800, fontSize: '15px', color: 'var(--text)' }}>CHiiRAG <span style={{ color: 'var(--accent)' }}>STOCK Journal</span></div>
        </div>
        <NavPill active="Bank" isAdmin={bankIsAdmin} />
        <button onClick={signOut} className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '11px' }}>Sign Out</button>
      </header>

      <main style={{ maxWidth: '100%', padding: '72px 20px 40px' }}>
        <div style={{ marginBottom: '20px' }}>
          <h1 style={{ fontFamily: 'Bookman Old Style, serif', fontWeight: 800, fontSize: '22px', color: 'var(--text)', margin: 0 }}>🏦 Bank Transfer</h1>
          <p style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '4px', fontFamily: 'DM Mono, monospace' }}>Track bank accounts and transactions</p>
        </div>

        {/* Admin: Subscriber Selector */}
        {bankIsAdmin && (
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', letterSpacing: '0.1em', marginBottom: '10px' }}>SELECT SUBSCRIBER</div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {bankSubscribers.length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: '12px', fontFamily: 'DM Mono, monospace', padding: '12px 0' }}>No approved subscribers found. Approve subscribers from the Subscribers page first.</div>
              ) : bankSubscribers.map(bankSub => {
                const subIsSelected = bankSelSubId === bankSub.id
                return (
                  <div key={bankSub.id} style={{ border: `2px solid ${subIsSelected ? 'var(--accent)' : 'var(--border)'}`, background: subIsSelected ? 'var(--accent-dim)' : 'var(--surface)', borderRadius: '10px', cursor: 'pointer', minWidth: '140px', transition: 'all 0.15s', overflow: 'hidden' }}>
                    <div onClick={() => handleSelectSub(bankSub)} style={{ padding: '14px 18px 10px' }}>
                      <div style={{ fontFamily: 'DM Mono, monospace', fontWeight: 700, fontSize: '13px', color: subIsSelected ? 'var(--accent)' : 'var(--text)' }}>
                        {bankSub.full_name || bankSub.email?.split('@')[0]}
                      </div>
                    <div style={{ fontSize: '9px', color: 'var(--bull)', background: 'rgba(14,165,233,0.08)', display: 'inline-block', padding: '1px 6px', borderRadius: '3px', fontFamily: 'DM Mono, monospace', fontWeight: 700, letterSpacing: '0.06em', marginTop: '3px', marginBottom: '3px' }}>✓ APPROVED</div>
                    <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px', fontFamily: 'DM Mono, monospace' }}>
                      {subIsSelected ? '▼ viewing' : '▶ click to view'}
                    </div>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); handleApproveToggle(bankSub) }}
                    disabled={bankApproving === bankSub.id}
                    style={{ width: '100%', padding: '5px', background: 'rgba(239,68,68,0.06)', border: 'none', borderTop: '1px solid var(--border)', color: 'var(--bear)', cursor: 'pointer', fontSize: '10px', fontFamily: 'DM Mono, monospace', fontWeight: 700, borderRadius: '0 0 8px 8px', opacity: bankApproving === bankSub.id ? 0.5 : 1 }}
                  >
                    {bankApproving === bankSub.id ? '...' : '✕ Disapprove'}
                  </button>
                </div>
                )
              })}

              {/* Add Subscriber tile — shows when there are unapproved subs */}
              {(() => {
                const unapprovedSubsList = bankAllSubs.filter(subU => subU.status !== 'approved')
                if (unapprovedSubsList.length === 0) return null
                return (
                  <div className="bank-add-sub-zone" style={{ position: 'relative' }}>
                    <div onClick={() => setBankShowAddSub(prev => !prev)} style={{ border: `2px dashed ${bankShowAddSub ? 'var(--accent)' : 'var(--border)'}`, background: bankShowAddSub ? 'var(--accent-dim)' : 'var(--surface)', borderRadius: '10px', minWidth: '140px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '18px 16px', color: bankShowAddSub ? 'var(--accent)' : 'var(--muted)', transition: 'all 0.15s' }}
                      onMouseEnter={e => { if (!bankShowAddSub) { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' } }}
                      onMouseLeave={e => { if (!bankShowAddSub) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' } }}>
                      <div style={{ fontSize: '22px', marginBottom: '4px' }}>👤+</div>
                      <div style={{ fontSize: '11px', fontFamily: 'DM Mono, monospace', fontWeight: 700 }}>Add Subscriber</div>
                      <div style={{ fontSize: '9px', fontFamily: 'DM Mono, monospace', marginTop: '2px', color: 'var(--gold)' }}>{unapprovedSubsList.length} waiting</div>
                    </div>
                    {bankShowAddSub && (
                      <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 200, background: 'var(--bg)', border: '2px solid var(--accent)', borderRadius: '10px', minWidth: '220px', boxShadow: '0 8px 32px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
                        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: '10px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', letterSpacing: '0.08em', fontWeight: 700 }}>
                          GRANT BANK ACCESS
                        </div>
                        {unapprovedSubsList.map(unapprovedSub => (
                          <div key={unapprovedSub.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                            <div>
                              <div style={{ fontFamily: 'DM Mono, monospace', fontWeight: 700, fontSize: '12px', color: 'var(--text)' }}>{unapprovedSub.full_name || unapprovedSub.email?.split('@')[0]}</div>
                              <div style={{ fontSize: '9px', color: unapprovedSub.status === 'pending' ? 'var(--gold)' : 'var(--bear)', fontFamily: 'DM Mono, monospace', fontWeight: 700, textTransform: 'uppercase', marginTop: '1px' }}>{unapprovedSub.status}</div>
                            </div>
                            <button
                              onClick={() => { handleApproveToggle(unapprovedSub, 'approved'); setBankShowAddSub(false) }}
                              disabled={bankApproving === unapprovedSub.id}
                              style={{ padding: '5px 12px', background: 'rgba(14,165,233,0.1)', border: '1px solid var(--accent)', color: 'var(--accent)', borderRadius: '5px', cursor: 'pointer', fontSize: '11px', fontFamily: 'DM Mono, monospace', fontWeight: 700, opacity: bankApproving === unapprovedSub.id ? 0.5 : 1 }}>
                              {bankApproving === unapprovedSub.id ? '...' : '✓ Allow'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          </div>
        )}

        {/* Accounts + Transactions — subscriber always sees, admin sees after selecting */}
        {(!bankIsAdmin || bankSelSubId) ? (
          <>
            {/* Account Tiles */}
            <div style={{ marginBottom: '24px' }}>
              {bankIsAdmin && bankSelSubId && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <div style={{ fontFamily: 'Bookman Old Style, serif', fontWeight: 700, fontSize: '15px', color: 'var(--text)' }}>{bankSelSubName}'s Bank Accounts</div>
                  <span style={{ fontSize: '10px', background: 'var(--accent-dim)', color: 'var(--accent)', padding: '2px 8px', borderRadius: '4px', fontFamily: 'DM Mono, monospace' }}>ADMIN VIEW · EDITABLE</span>
                </div>
              )}
              {/* Total Balance tile — shows when there are accounts */}
              {!bankAcctsLoad && bankAccts.length > 0 && (() => {
                const totalBankBalance = bankAccts.reduce((totalSum, acctItem) => totalSum + Number(acctItem.balance || 0), 0)
                return (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '20px', background: 'var(--surface)', border: '2px solid var(--accent)', borderRadius: '10px', padding: '14px 22px', marginBottom: '16px' }}>
                    <div>
                      <div style={{ fontSize: '9px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '4px' }}>
                        Total Balance · {bankAccts.length} Account{bankAccts.length > 1 ? 's' : ''}
                      </div>
                      <div style={{ fontFamily: 'DM Mono, monospace', fontWeight: 800, fontSize: '22px', color: totalBankBalance >= 0 ? 'var(--text)' : 'var(--bear)' }}>
                        Rs.{bankFmt(totalBankBalance)}
                      </div>
                    </div>
                    <div style={{ fontSize: '28px', opacity: 0.25 }}>🏦</div>
                  </div>
                )
              })()}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'stretch' }}>
                {bankAcctsLoad ? (
                  <div style={{ color: 'var(--muted)', fontSize: '12px', fontFamily: 'DM Mono, monospace', padding: '20px' }}>Loading accounts...</div>
                ) : (
                  <>
                    {bankAccts.map(bankAcctTile => {
                      const tileIsActive = bankSelAcct?.id === bankAcctTile.id
                      return (
                        <div key={bankAcctTile.id} style={{ border: `2px solid ${tileIsActive ? 'var(--accent)' : 'var(--border)'}`, background: tileIsActive ? 'var(--accent-dim)' : 'var(--surface)', borderRadius: '10px', minWidth: '185px', cursor: 'pointer', overflow: 'hidden', transition: 'all 0.15s' }}>
                          <div onClick={() => handleSelectAcct(bankAcctTile)} style={{ padding: '16px 18px 12px' }}>
                            <div style={{ fontFamily: 'DM Mono, monospace', fontWeight: 800, fontSize: '13px', color: tileIsActive ? 'var(--accent)' : 'var(--text)', marginBottom: '2px' }}>{bankAcctTile.holder_name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', marginBottom: '10px' }}>{bankAcctTile.bank_name}</div>
                            <div style={{ fontSize: '9px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '2px' }}>Balance</div>
                            <div style={{ fontFamily: 'DM Mono, monospace', fontWeight: 800, fontSize: '18px', color: bankAcctTile.balance >= 0 ? 'var(--text)' : 'var(--bear)' }}>
                              Rs.{bankFmt(bankAcctTile.balance)}
                            </div>
                          </div>
                          <div style={{ borderTop: '1px solid var(--border)', display: 'flex' }}>
                            <button onClick={e => { e.stopPropagation(); setBankEditAcct(bankAcctTile) }} style={{ flex: 1, padding: '6px', background: 'none', border: 'none', borderRight: '1px solid var(--border)', color: 'var(--accent)', cursor: 'pointer', fontSize: '12px' }} title="Edit account">✎ Edit</button>
                            <button onClick={e => { e.stopPropagation(); handleDeleteAcct(bankAcctTile.id) }} style={{ flex: 1, padding: '6px', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '12px' }} title="Delete account">🗑 Delete</button>
                          </div>
                        </div>
                      )
                    })}

                    {/* Add Account Tile */}
                    <div onClick={() => setBankShowAdd(true)} style={{ border: '2px dashed var(--border)', borderRadius: '10px', minWidth: '150px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', color: 'var(--muted)', transition: 'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' }}>
                      <div style={{ fontSize: '28px', marginBottom: '6px' }}>+</div>
                      <div style={{ fontSize: '11px', fontFamily: 'DM Mono, monospace', fontWeight: 600 }}>Add Account</div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Transactions Panel */}
            {bankSelAcct && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
                  <div style={{ fontFamily: 'Bookman Old Style, serif', fontWeight: 700, fontSize: '15px', color: 'var(--text)', marginBottom: '2px' }}>{bankSelAcct.holder_name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>
                    {bankSelAcct.bank_name} · Current Balance: <strong style={{ color: 'var(--text)', fontFamily: 'DM Mono, monospace' }}>Rs.{bankFmt(bankSelAcct.balance)}</strong>
                  </div>
                </div>

                {bankTxnLoad ? (
                  <div style={{ padding: '30px', textAlign: 'center', color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>Loading transactions...</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="trade-table" style={{ width: '100%' }}>
                      <thead>
                        <tr>
                          {['Transaction Date', 'Transaction Type', 'Source', 'Amount', 'Balance', 'Actions'].map((colHdr, colIdx) => (
                            <th key={colIdx} style={{ padding: '10px 14px', textAlign: colIdx >= 3 && colIdx < 5 ? 'right' : 'left', fontSize: '10px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{colHdr}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {/* Record Transaction Row */}
                        <tr style={{ background: 'var(--accent)', cursor: 'pointer' }} onClick={() => setBankShowTxn(true)}>
                          <td colSpan={6} style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
                            <span style={{ color: '#000', fontSize: '12px', fontFamily: 'DM Mono, monospace', fontWeight: 700, letterSpacing: '0.08em' }}>+ Record Transaction</span>
                          </td>
                        </tr>

                        {bankTxns.length === 0 ? (
                          <tr>
                            <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', fontSize: '12px' }}>
                              No transactions yet. Click "+ Record Transaction" above to add one.
                            </td>
                          </tr>
                        ) : bankTxns.map((bankTxnRow, bankTxnIdx) => {
                          const bankTxnIsCredit = bankTxnRow.transaction_type === 'CREDIT'
                          const bankTxnColor = bankTxnIsCredit ? 'var(--bull)' : 'var(--bear)'
                          const bankTxnLabel = bankTxnIsCredit ? 'પૈસા આવ્યા' : 'પૈસા ગયા'
                          const bankWdPart = bankTxnRow.withdrawal_mode ? ` · ${bankTxnRow.withdrawal_mode}` : ''
                          const bankSrcLabel = bankTxnRow.source_detail || (bankTxnRow.source_type === 'CASH_DEPOSIT' ? 'બેંકમાં જમા' : bankTxnRow.source_type)
                          return (
                            <tr key={bankTxnRow.id} style={{ background: bankTxnIdx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.01)', borderLeft: `3px solid ${bankTxnIsCredit ? 'rgba(14,165,233,0.4)' : 'rgba(239,68,68,0.4)'}` }}>
                              <td style={{ padding: '11px 14px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', fontSize: '12px' }}>{bankTxnRow.transaction_date}</td>
                              <td style={{ padding: '11px 14px' }}>
                                <span style={{ fontSize: '13px', fontWeight: 700, color: bankTxnColor, fontFamily: 'DM Mono, monospace' }}>{bankTxnLabel}</span>
                              </td>
                              <td style={{ padding: '11px 14px', fontSize: '12px', fontFamily: 'DM Mono, monospace', maxWidth: '200px' }}>
                                <div style={{ color: 'var(--text)' }}>{bankSrcLabel}{bankWdPart}</div>
                                {bankTxnRow.notes && <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '1px' }}>{bankTxnRow.notes}</div>}
                              </td>
                              <td style={{ padding: '11px 14px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontWeight: 700, color: bankTxnColor, fontSize: '13px' }}>
                                {bankTxnIsCredit ? '+' : '−'}Rs.{bankFmt(bankTxnRow.amount)}
                              </td>
                              <td style={{ padding: '11px 14px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontWeight: 600, color: 'var(--text)', fontSize: '13px' }}>
                                Rs.{bankFmt(bankTxnRow.balance_after)}
                              </td>
                              <td style={{ padding: '11px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                <button onClick={() => setBankEditTxn(bankTxnRow)} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--accent)', cursor: 'pointer', fontSize: '11px', padding: '3px 8px', borderRadius: '4px', fontFamily: 'DM Mono, monospace', marginRight: '4px' }} title="Edit">✎</button>
                                <button onClick={() => handleDeleteTxn(bankTxnRow.id)} style={{ background: 'none', border: 'none', color: 'var(--bear)', cursor: 'pointer', fontSize: '16px', padding: '0 4px' }} title="Delete">×</button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '80px', color: 'var(--muted)' }}>
            <div style={{ fontSize: '36px', marginBottom: '14px' }}>🏦</div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '13px' }}>Select a subscriber above to view and manage their bank accounts</div>
          </div>
        )}
      </main>

      {bankShowAdd && <AddAccountModal onClose={() => setBankShowAdd(false)} onAdd={handleAddAcct} />}
      {bankShowTxn && bankSelAcct && <RecordTransactionModal bankAcct={bankSelAcct} allBankAccts={bankAccts} onClose={() => setBankShowTxn(false)} onRecord={handleRecordTxn} />}
      {bankEditAcct && <EditAccountModal bankAcct={bankEditAcct} onClose={() => setBankEditAcct(null)} onSave={handleEditAcct} />}
      {bankEditTxn && bankSelAcct && <EditTransactionModal txn={bankEditTxn} bankAcct={bankSelAcct} allBankAccts={bankAccts} onClose={() => setBankEditTxn(null)} onUpdate={handleEditTxn} />}
    </>
  )
}
