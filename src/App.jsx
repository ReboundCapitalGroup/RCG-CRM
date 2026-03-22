import React, { useState, useEffect, useRef } from 'react'
import { Search, LogOut, Eye, Plus, Upload, Download, Users as UsersIcon, FileText, DollarSign, Calendar, TrendingUp, MapPin, User, Trash2, Phone, Mail, ChevronDown, ChevronUp, Clock, AlertTriangle, CheckSquare, Folder, Zap, X } from 'lucide-react'
import { Device } from '@twilio/voice-sdk'
import { supabase } from './supabase'
import ContractModal from './ContractModal'

// ─── Twilio Dialer ────────────────────────────────────────────────────────────
const TWILIO_TOKEN_URL = 'https://fzievaswtkuguwyscngt.supabase.co/functions/v1/twilio-token'


// ─── Mobile Hook ─────────────────────────────────────────────────────────────
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return isMobile
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const parseAuctionDate = (d) => {
  if (!d) return null
  if (d.includes('/')) {
    const [m, day, y] = d.split('/')
    return new Date(`${y}-${m.padStart(2,'0')}-${day.padStart(2,'0')}T00:00:00`)
  }
  return new Date(d.includes('T') ? d : d + 'T00:00:00')
}

const formatDate = (d) => {
  if (!d) return '—'
  const date = parseAuctionDate(d)
  if (!date || isNaN(date.getTime())) return d
  return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })
}

const formatSurplus = (s) => {
  if (!s) return null
  const raw = parseFloat(String(s).replace(/[$,]/g, ''))
  if (isNaN(raw)) return null
  return raw
}

const normalizeCounty = (c) => {
  if (!c) return ''
  const trimmed = c.trim()
  if (trimmed.includes('-')) {
    const idx = trimmed.indexOf('-')
    const st = trimmed.slice(0, idx).trim().toUpperCase()
    const county = trimmed.slice(idx + 1).trim()
      .replace(/_/g, ' ')           // underscores → spaces
      .replace(/\b\w/g, l => l.toUpperCase())  // title case
    return `${st}-${county}`
  }
  return trimmed.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}


const NOTE_TYPES = [
  'General Note',
  'Contacted - Interested',
  'Contacted - Not Interested',
  'Left Voicemail',
  'Wrong Number',
  'No Answer',
  'Contract Sent',
  'Contract Signed',
  'Filed with Clerk',
  'Do Not Contact',
  'Follow Up Needed',
]

const CONTACT_TYPES = ['Owner', 'Relative', 'Attorney', 'LLC / Entity', 'Estate / PR', 'Other']

// ─── Power Lists ──────────────────────────────────────────────────────────────
const DEFAULT_LIST_NAMES = ['Follow-Up', 'Hot Leads', 'Dead Leads']

const PowerListsPanel = ({ user, leads, onLoadQueue, onClose }) => {
  const [lists, setLists] = useState([])
  const [newListName, setNewListName] = useState('')
  const [loading, setLoading] = useState(true)
  const [expandedList, setExpandedList] = useState(null)
  const [listLeads, setListLeads] = useState({})
  const [addingTo, setAddingTo] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => { loadLists() }, [])

  const loadLists = async () => {
    setLoading(true)
    const query = supabase.from('power_lists').select('*').order('created_at', { ascending: true })
    if (user?.role !== 'admin') query.eq('owner', user?.name)
    const { data } = await query
    setLists(data || [])
    setLoading(false)
  }

  const createList = async () => {
    const name = newListName.trim()
    if (!name) return
    await supabase.from('power_lists').insert({ name, owner: user?.name, created_at: new Date().toISOString() })
    setNewListName('')
    loadLists()
  }

  const deleteList = async (id) => {
    if (!window.confirm('Delete this list?')) return
    await supabase.from('power_list_leads').delete().eq('list_id', id)
    await supabase.from('power_lists').delete().eq('id', id)
    loadLists()
  }

  const loadListLeads = async (listId) => {
    const { data } = await supabase.from('power_list_leads').select('*, leads(*)').eq('list_id', listId).order('created_at', { ascending: true })
    setListLeads(prev => ({ ...prev, [listId]: data || [] }))
  }

  const removeFromList = async (listId, leadId) => {
    await supabase.from('power_list_leads').delete().eq('list_id', listId).eq('lead_id', leadId)
    loadListLeads(listId)
    loadLists()
  }

  const toggleExpand = (id) => {
    if (expandedList === id) { setExpandedList(null) }
    else { setExpandedList(id); loadListLeads(id) }
  }

  // Search leads to add
  const matchedLeads = searchTerm.length > 1
    ? leads.filter(l => (l.property_address || '').toLowerCase().includes(searchTerm.toLowerCase()) || (l.case_number || '').toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 8)
    : []

  const addLeadToList = async (listId, leadId) => {
    const exists = await supabase.from('power_list_leads').select('id').eq('list_id', listId).eq('lead_id', leadId).single()
    if (exists.data) return
    await supabase.from('power_list_leads').insert({ list_id: listId, lead_id: leadId, added_by: user?.name, created_at: new Date().toISOString() })
    loadListLeads(listId)
    loadLists()
    setSearchTerm('')
    setAddingTo(null)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:200, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
      <div style={{ background:'#111827', border:'1px solid #1f2937', borderRadius:'16px 16px 0 0', width:'100%', maxWidth:560, maxHeight:'85vh', display:'flex', flexDirection:'column' }}>
        {/* Header */}
        <div style={{ padding:'14px 18px', borderBottom:'1px solid #1f2937', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <CheckSquare size={15} style={{ color:'#C9A84C' }} />
            <span style={{ color:'white', fontWeight:600, fontSize:14 }}>Power Lists</span>
            {user?.role === 'admin' && <span style={{ fontSize:10, color:'#4b5563' }}>all agents</span>}
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#64748b', cursor:'pointer' }}><X size={17} /></button>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'14px 18px', display:'flex', flexDirection:'column', gap:10 }}>

          {/* Create new list */}
          <div style={{ display:'flex', gap:8 }}>
            <input value={newListName} onChange={e => setNewListName(e.target.value)} placeholder="New list name..."
              onKeyDown={e => e.key === 'Enter' && createList()}
              style={{ flex:1, padding:'8px 10px', background:'rgba(15,23,42,0.6)', border:'1px solid rgba(71,85,105,0.4)', borderRadius:7, color:'white', fontSize:13, outline:'none' }} />
            <button onClick={createList} style={{ padding:'8px 14px', background:'#C9A84C', border:'none', borderRadius:7, color:'#1a1a1a', fontSize:13, fontWeight:600, cursor:'pointer' }}>+ Add</button>
          </div>

          {/* Default list shortcuts */}
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {DEFAULT_LIST_NAMES.map(n => (
              <button key={n} onClick={() => setNewListName(n)}
                style={{ padding:'3px 10px', background:'rgba(71,85,105,0.2)', border:'1px solid rgba(71,85,105,0.3)', borderRadius:20, color:'#94a3b8', fontSize:11, cursor:'pointer' }}>
                {n}
              </button>
            ))}
          </div>

          {loading && <div style={{ color:'#4b5563', fontSize:12, textAlign:'center', padding:20 }}>Loading...</div>}

          {!loading && lists.length === 0 && (
            <div style={{ color:'#4b5563', fontSize:12, textAlign:'center', padding:20 }}>No lists yet — create one above</div>
          )}

          {lists.map(list => {
            const items = listLeads[list.id] || []
            const isExpanded = expandedList === list.id
            return (
              <div key={list.id} style={{ background:'#1f2937', borderRadius:10, border:'1px solid #374151', overflow:'hidden' }}>
                {/* List header */}
                <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', cursor:'pointer' }} onClick={() => toggleExpand(list.id)}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:'#e5e7eb' }}>{list.name}</div>
                    <div style={{ fontSize:10, color:'#4b5563' }}>{list.owner} · {list.lead_count || 0} leads</div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); onLoadQueue && onLoadQueue(list) }}
                    style={{ padding:'5px 12px', background:'#1a3a1a', border:'1px solid #2d5a2d', borderRadius:6, color:'#4ade80', fontSize:11, fontWeight:600, cursor:'pointer', flexShrink:0 }}>
                    ▶ Dial
                  </button>
                  <button onClick={e => { e.stopPropagation(); setAddingTo(addingTo === list.id ? null : list.id); setSearchTerm('') }}
                    style={{ padding:'5px 10px', background:'rgba(201,168,76,0.1)', border:'1px solid rgba(201,168,76,0.3)', borderRadius:6, color:'#C9A84C', fontSize:11, cursor:'pointer', flexShrink:0 }}>
                    + Add
                  </button>
                  {user?.role === 'admin' && (
                    <button onClick={e => { e.stopPropagation(); deleteList(list.id) }}
                      style={{ padding:'5px 8px', background:'rgba(239,68,68,0.1)', border:'none', borderRadius:6, color:'#f87171', fontSize:11, cursor:'pointer', flexShrink:0 }}>✕</button>
                  )}
                  <span style={{ color:'#4b5563', fontSize:11, flexShrink:0 }}>{isExpanded ? '▲' : '▼'}</span>
                </div>

                {/* Add lead search */}
                {addingTo === list.id && (
                  <div style={{ padding:'0 14px 10px', borderTop:'1px solid #374151' }}>
                    <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search by address or case #..."
                      autoFocus
                      style={{ width:'100%', padding:'7px 10px', background:'rgba(15,23,42,0.6)', border:'1px solid rgba(71,85,105,0.4)', borderRadius:6, color:'white', fontSize:12, outline:'none', boxSizing:'border-box', marginTop:8 }} />
                    {matchedLeads.map(l => (
                      <div key={l.id} onClick={() => addLeadToList(list.id, l.id)}
                        style={{ padding:'6px 10px', background:'rgba(15,23,42,0.4)', borderRadius:5, marginTop:4, cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span style={{ fontSize:11, color:'#e5e7eb', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{l.property_address || l.case_number}</span>
                        <span style={{ fontSize:10, color:'#C9A84C', flexShrink:0, marginLeft:8 }}>+ Add</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Lead items */}
                {isExpanded && (
                  <div style={{ borderTop:'1px solid #374151', maxHeight:200, overflowY:'auto' }}>
                    {items.length === 0 && <div style={{ padding:'12px 14px', fontSize:11, color:'#4b5563' }}>No leads in this list yet</div>}
                    {items.map((item, i) => (
                      <div key={item.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 14px', borderBottom:'1px solid #1f2937' }}>
                        <span style={{ fontSize:10, color:'#4b5563', width:18, flexShrink:0 }}>{i + 1}</span>
                        <span style={{ fontSize:11, color:'#e5e7eb', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.leads?.property_address || item.lead_id}</span>
                        <span style={{ fontSize:10, color:'#4b5563', flexShrink:0 }}>{item.leads?.status}</span>
                        <button onClick={() => removeFromList(list.id, item.lead_id)}
                          style={{ background:'none', border:'none', color:'#6b7280', cursor:'pointer', fontSize:12, flexShrink:0 }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Gmail helpers ────────────────────────────────────────────────────────────
const GMAIL_CLIENT_ID = import.meta.env.VITE_GMAIL_CLIENT_ID
const GMAIL_REDIRECT_URI = 'https://rcg-crm-v2.vercel.app/auth/callback'
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://fzievaswtkuguwyscngt.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

const gmailConnect = () => {
  const params = new URLSearchParams({
    client_id: GMAIL_CLIENT_ID,
    redirect_uri: GMAIL_REDIRECT_URI,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/gmail.send',
    access_type: 'offline',
    prompt: 'consent',
  })
  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

const gmailCheckConnection = async () => {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/gmail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'apikey': SUPABASE_ANON_KEY },
      body: JSON.stringify({ action: 'check_connection' }),
    })
    const data = await res.json()
    return data.connected === true
  } catch { return false }
}

const gmailSend = async ({ to, subject, body }) => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/gmail`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'apikey': SUPABASE_ANON_KEY },
    body: JSON.stringify({ action: 'send_email', to, subject, body, isHtml: true }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data
}

// ─── Signature Builder ────────────────────────────────────────────────────────
const buildSignature = (sender) => `
<table border="1" style="margin:0px;padding:0px;table-layout:fixed;width:0px;border-collapse:collapse;empty-cells:show;overflow:visible;background:transparent;border-spacing:0px">
  <tbody>
    <tr style="height:59px">
      <td rowspan="2" style="padding:0px;overflow:visible;vertical-align:middle;background-color:rgb(0,0,0);border:2px solid;width:174px">
        <div style="margin:0px;padding:0px 7px;overflow:visible">
          <img width="96" height="64" src="https://lh3.googleusercontent.com/d/1_K7WOpoH_bAtoQbPpiGfIbfgBxqybPPW">
        </div>
      </td>
      <td style="padding:0px;overflow:visible;vertical-align:middle;border:2px solid;width:305px">
        <div style="margin:0px;padding:0px 7px">
          <p style="margin:0px 0px 0px 19px;padding:0px;font-weight:bold;text-transform:uppercase">
            <span style="font-family:tahoma,sans-serif;font-size:10pt;color:#351c75">Rebound Capital Group</span>
          </p>
          <p style="margin:0px 0px 0px 19px;padding:0px">
            <span style="font-family:tahoma,sans-serif;font-size:10pt;color:#351c75">${sender.name} - ${sender.title}</span>
          </p>
        </div>
      </td>
    </tr>
    <tr style="height:59px">
      <td style="padding:0px;overflow:visible;vertical-align:middle;border:2px solid;width:305px">
        <div style="margin:0px;padding:0px 7px">
          <p style="margin:0px 0px 0px 19px;padding:0px"><span style="font-family:tahoma,sans-serif;font-size:8pt;color:#311b80">(305) 563-4920</span></p>
          <p style="margin:0px 0px 0px 19px;padding:0px"><span style="font-family:tahoma,sans-serif;font-size:8pt;color:#311b80">Contact@ReboundCapitalGroup.com</span></p>
          <p style="margin:0px 0px 0px 19px;padding:0px"><a href="http://www.ReboundCapitalGroup.com" style="font-family:tahoma,sans-serif;font-size:8pt;color:#311b80">www.ReboundCapitalGroup.com</a></p>
        </div>
      </td>
    </tr>
  </tbody>
</table>`

// ─── Build full HTML email ────────────────────────────────────────────────────
const buildHtmlEmail = (bodyText, sender) => `
<div style="font-family:Arial,sans-serif;font-size:10pt;color:#000;line-height:1.6">
  ${bodyText.split('\n').map(line => line.trim() === '' ? '<br>' : `<p style="margin:0 0 8px 0">${line}</p>`).join('')}
  <br>
  ${buildSignature(sender)}
</div>`

// ─── Email Templates ──────────────────────────────────────────────────────────
const EMAIL_TEMPLATES = [
  {
    id: 'intro',
    label: 'Initial Outreach',
    subject: 'Important Notice Regarding Your Property Funds',
    body: (name, address, amount, sender) =>
`Dear ${name},

My name is ${sender.name} and I represent Rebound Capital Group LLC, a surplus funds recovery firm based in Florida.

I am reaching out because our records indicate there may be funds held on your behalf by the court in connection with the property located at ${address}.

The amount available is approximately ${amount}. These funds have a limited claim window and may be forfeited if not claimed in time.

There is absolutely no upfront cost to you. We work on a contingency basis — you only pay if we successfully recover your funds.

If you would like to learn more or begin the claim process, please contact me at your earliest convenience.`
  },
  {
    id: 'followup',
    label: 'Follow Up',
    subject: 'Following Up — Unclaimed Surplus Funds',
    body: (name, address, amount, sender) =>
`Dear ${name},

I wanted to follow up on my previous message regarding unclaimed surplus funds connected to ${address}.

The approximate amount of ${amount} is still available for claim. The deadline to file is approaching and I want to make sure you have the opportunity to recover what is rightfully yours.

Please feel free to call or email me directly. I am happy to walk you through the process at no obligation.`
  },
  {
    id: 'contract',
    label: 'Contract Reminder',
    subject: 'Contract Reminder — Surplus Funds Recovery',
    body: (name, address, amount, sender) =>
`Dear ${name},

Thank you for speaking with me regarding the surplus funds related to ${address}.

As discussed, I am following up to remind you that the signed agreement is needed to begin the formal claim process for your ${amount} in surplus funds.

Please review and return the agreement at your earliest convenience so we can meet the filing deadline.

If you have any questions please do not hesitate to reach out.`
  },
]

// ─── Send Email Modal ─────────────────────────────────────────────────────────
const SendEmailModal = ({ contact, lead, onClose, onSent, user, allContacts = [], preSelectedEmail = null }) => {
  const [template, setTemplate] = useState(EMAIL_TEMPLATES[0])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)

  // Build a flat list of all emails across all contacts
  const allEmailOptions = []
  const seen = new Set()
  const contactsToSearch = allContacts.length > 0 ? allContacts : (contact ? [contact] : [])
  contactsToSearch.forEach(c => {
    const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Contact'
    let parsed = {}
    try { parsed = c.notes ? JSON.parse(c.notes) : {} } catch(e) {}
    const emails = [c.email, ...(parsed.all_emails || [])].filter(Boolean)
    emails.forEach(email => {
      if (!seen.has(email)) { seen.add(email); allEmailOptions.push({ email, name, contactId: c.id }) }
    })
  })

  const defaultEmail = preSelectedEmail || allEmailOptions[0]?.email || contact?.email || ''
  const [to, setTo] = useState(defaultEmail)
  const selectedContact = contactsToSearch.find(c => {
    let parsed = {}; try { parsed = c.notes ? JSON.parse(c.notes) : {} } catch(e) {}
    return c.email === to || (parsed.all_emails || []).includes(to)
  }) || contact

  const ownerName = [selectedContact?.first_name, selectedContact?.last_name].filter(Boolean).join(' ') || 'Property Owner'
  const address = lead?.property_address || 'your property'
  const amount = lead?.surplus ? `$${parseFloat(String(lead.surplus).replace(/[$,]/g, '')).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : 'the available amount'
  const sender = { name: user?.name || 'Rebound Capital Group', title: user?.role === 'admin' ? 'President' : 'Recovery Agent' }

  const [subject, setSubject] = useState(template.subject)
  const [body, setBody] = useState(template.body(ownerName, address, amount, sender))

  useEffect(() => {
    setSubject(template.subject)
    setBody(template.body(ownerName, address, amount, sender))
  }, [template, to])

  const handleSend = async () => {
    if (!to) { setError('Email address required'); return }
    setSending(true); setError(null)
    try {
      const htmlBody = buildHtmlEmail(body, sender)
      await gmailSend({ to, subject, body: htmlBody })
      onSent({ to, subject })
    } catch (err) { setError(err.message) }
    setSending(false)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'#1e293b', border:'1px solid rgba(71,85,105,0.5)', borderRadius:12, width:'100%', maxWidth:600, maxHeight:'90vh', overflow:'hidden', display:'flex', flexDirection:'column' }}>
        {/* Header */}
        <div style={{ padding:'14px 18px', borderBottom:'1px solid rgba(71,85,105,0.4)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <Mail size={15} style={{ color:'#60a5fa' }} />
            <span style={{ color:'white', fontWeight:600, fontSize:14 }}>Send Email</span>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#64748b', cursor:'pointer' }}><X size={17} /></button>
        </div>

        <div style={{ padding:'14px 18px', overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:11 }}>

          {/* Template selector */}
          <div>
            <label style={{ fontSize:11, color:'#64748b', display:'block', marginBottom:5 }}>TEMPLATE</label>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {EMAIL_TEMPLATES.map(t => (
                <button key={t.id} onClick={() => setTemplate(t)}
                  style={{ padding:'5px 12px', borderRadius:6, fontSize:12, fontWeight:500, cursor:'pointer', border:'1px solid',
                    background: template.id === t.id ? 'rgba(245,158,11,0.2)' : 'rgba(30,41,59,0.6)',
                    borderColor: template.id === t.id ? '#f59e0b' : 'rgba(71,85,105,0.4)',
                    color: template.id === t.id ? '#fbbf24' : '#94a3b8' }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* To — email picker dropdown if multiple options */}
          <div>
            <label style={{ fontSize:11, color:'#64748b', display:'block', marginBottom:5 }}>TO</label>
            {allEmailOptions.length > 1 ? (
              <select value={to} onChange={e => setTo(e.target.value)}
                style={{ width:'100%', padding:'8px 10px', background:'rgba(15,23,42,0.6)', border:'1px solid rgba(71,85,105,0.4)', borderRadius:6, color:'white', fontSize:13, boxSizing:'border-box' }}>
                {allEmailOptions.map(opt => (
                  <option key={opt.email} value={opt.email}>{opt.name} — {opt.email}</option>
                ))}
              </select>
            ) : (
              <input value={to} onChange={e => setTo(e.target.value)} placeholder="recipient@email.com"
                style={{ width:'100%', padding:'8px 10px', background:'rgba(15,23,42,0.6)', border:'1px solid rgba(71,85,105,0.4)', borderRadius:6, color:'white', fontSize:13, boxSizing:'border-box' }} />
            )}
          </div>

          {/* Subject */}
          <div>
            <label style={{ fontSize:11, color:'#64748b', display:'block', marginBottom:5 }}>SUBJECT</label>
            <input value={subject} onChange={e => setSubject(e.target.value)}
              style={{ width:'100%', padding:'8px 10px', background:'rgba(15,23,42,0.6)', border:'1px solid rgba(71,85,105,0.4)', borderRadius:6, color:'white', fontSize:13, boxSizing:'border-box' }} />
          </div>

          {/* Body */}
          <div style={{ flex:1 }}>
            <label style={{ fontSize:11, color:'#64748b', display:'block', marginBottom:5 }}>MESSAGE</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={10}
              style={{ width:'100%', padding:'10px', background:'rgba(15,23,42,0.6)', border:'1px solid rgba(71,85,105,0.4)', borderRadius:6, color:'white', fontSize:12, resize:'vertical', fontFamily:'inherit', lineHeight:1.6, boxSizing:'border-box' }} />
          </div>

          {error && <div style={{ padding:'8px 12px', background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:6, color:'#f87171', fontSize:12 }}>{error}</div>}
          <div style={{ fontSize:11, color:'#475569' }}>Sending from: contact@reboundcapitalgroup.com</div>
        </div>

        <div style={{ padding:'12px 18px', borderTop:'1px solid rgba(71,85,105,0.4)', display:'flex', gap:8 }}>
          <button onClick={handleSend} disabled={sending}
            style={{ flex:1, padding:'10px', background:'linear-gradient(90deg,#3b82f6,#2563eb)', color:'white', border:'none', borderRadius:6, fontSize:13, fontWeight:600, cursor:sending ? 'not-allowed' : 'pointer', opacity:sending ? 0.7 : 1 }}>
            {sending ? 'Sending...' : 'Send Email'}
          </button>
          <button onClick={onClose}
            style={{ padding:'10px 18px', background:'rgba(51,65,85,0.8)', border:'1px solid rgba(71,85,105,0.5)', color:'white', borderRadius:6, fontSize:13, cursor:'pointer' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}



// ─── Login Page ───────────────────────────────────────────────────────────────
const LoginPage = ({ onLogin }) => {
  const titleRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    const fitTitle = () => {
      const el = titleRef.current
      const container = containerRef.current
      if (!el || !container) return
      // Reset to max then shrink until it fits on one line
      let size = 48
      el.style.fontSize = size + 'px'
      el.style.whiteSpace = 'nowrap'
      while (el.scrollWidth > container.clientWidth - 48 && size > 16) {
        size -= 1
        el.style.fontSize = size + 'px'
      }
    }
    fitTitle()
    window.addEventListener('resize', fitTitle)
    return () => window.removeEventListener('resize', fitTitle)
  }, [])

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 420,
        background: 'rgba(30,41,59,0.7)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(71,85,105,0.4)',
        borderRadius: 20,
        padding: '40px 32px',
        boxSizing: 'border-box',
      }} ref={containerRef}>
        {/* Logo / Title */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <h1
              ref={titleRef}
              style={{
                color: 'white',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                margin: 0,
                lineHeight: 1.1,
                whiteSpace: 'nowrap',
              }}
            >
              Rebound Capital Group
            </h1>
          </div>
          <p style={{ color: '#64748b', fontSize: 13, margin: 0, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Lead Management System
          </p>
        </div>

        {/* Form */}
        <form onSubmit={onLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <input
            name="username"
            placeholder="Username"
            autoCapitalize="none"
            autoCorrect="off"
            required
            style={{
              width: '100%', padding: '13px 16px', background: 'rgba(15,23,42,0.6)',
              border: '1px solid rgba(71,85,105,0.5)', borderRadius: 10, color: 'white',
              fontSize: 15, outline: 'none', boxSizing: 'border-box',
              WebkitAppearance: 'none',
            }}
          />
          <input
            name="password"
            type="password"
            placeholder="Password"
            required
            style={{
              width: '100%', padding: '13px 16px', background: 'rgba(15,23,42,0.6)',
              border: '1px solid rgba(71,85,105,0.5)', borderRadius: 10, color: 'white',
              fontSize: 15, outline: 'none', boxSizing: 'border-box',
              WebkitAppearance: 'none',
            }}
          />
          <button
            type="submit"
            style={{
              width: '100%', padding: '14px', marginTop: 4,
              background: 'linear-gradient(90deg, #f59e0b, #ea580c)',
              color: 'white', border: 'none', borderRadius: 10,
              fontSize: 15, fontWeight: 700, cursor: 'pointer',
              letterSpacing: '0.02em',
            }}
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Phone Panel ─────────────────────────────────────────────────────────────
const PhonePanel = ({ user, leads, onClose }) => {
  const isMobile = useIsMobile()
  const [panelTab, setPanelTab] = useState('session')
  const [rightTab, setRightTab] = useState('numbers')
  const [showMobileNumSheet, setShowMobileNumSheet] = useState(false)

  // Queue + filters
  const [allQueueItems, setAllQueueItems] = useState([]) // full unfiltered list
  const [queue, setQueue] = useState([])
  const [queueIdx, setQueueIdx] = useState(0)
  const [queueFilters, setQueueFilters] = useState({ state: 'all', county: 'all', status: 'all', type: 'all', surplusMin: '', surplusMax: '', contactsOnly: true })
  const [showQueueFilters, setShowQueueFilters] = useState(false)

  // Active lead
  const [activeLead, setActiveLead] = useState(null)
  const [activeContacts, setActiveContacts] = useState([])
  const [selectedContactIdx, setSelectedContactIdx] = useState(0)
  const [callNote, setCallNote] = useState('')
  const [callOutcome, setCallOutcome] = useState('General Note')
  const [callHistory, setCallHistory] = useState([])
  const [leadNotes, setLeadNotes] = useState([])
  const [queueOutcomes, setQueueOutcomes] = useState({})

  // Shared call state (used by both queue dialer and independent dialer)
  const [callStatus, setCallStatus] = useState('idle')
  const [callDuration, setCallDuration] = useState(0)
  const [activeCall, setActiveCall] = useState(null)
  const [device, setDevice] = useState(null)
  const [deviceReady, setDeviceReady] = useState(false)
  const [muted, setMuted] = useState(false)
  const [callMode, setCallMode] = useState('queue') // 'queue' | 'independent'

  // Independent dialer
  const [dialPad, setDialPad] = useState('')
  const [indCallStatus, setIndCallStatus] = useState('idle')
  const [indCallDuration, setIndCallDuration] = useState(0)
  const [indActiveCall, setIndActiveCall] = useState(null)
  const indTimerRef = useRef(null)

  // VM drop — placeholder, ready to wire up
  const [vmRecordingUrl, setVmRecordingUrl] = useState('') // set via settings when recording is ready
  const [vmDropped, setVmDropped] = useState(false)

  // SMS
  const [smsConvos, setSmsConvos] = useState([])
  const [selectedConvo, setSelectedConvo] = useState(null)

  const timerRef = useRef(null)
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6aWV2YXN3dGt1Z3V3eXNjbmd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNTQxODIsImV4cCI6MjA4NjkzMDE4Mn0.lODeKd6YoXpHBqIkNlj7vE0PQ3FtEm2z2dMRwQ'

  // Derived filter options from leads
  const allStates = [...new Set(leads.map(l => { const c = l.county || ''; if (c.includes('-')) return c.split('-')[0].trim().toUpperCase(); return null }).filter(Boolean))].sort()
  const allCounties = [...new Set(leads.map(l => normalizeCounty(l.county)).filter(Boolean))].sort()

  useEffect(() => {
    buildQueue()
    initDevice()
    loadSmsConvos()
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (indTimerRef.current) clearInterval(indTimerRef.current)
    }
  }, [])

  // Re-filter queue when filters change
  useEffect(() => {
    applyQueueFilters(allQueueItems, queueFilters)
  }, [queueFilters, allQueueItems])

  const applyQueueFilters = (items, f) => {
    if (!items || items.length === 0) return
    const filtered = items.filter(({ lead, contacts }) => {
      if (f.contactsOnly && (!contacts || contacts.length === 0)) return false
      if (f.state !== 'all') {
        const c = lead.county || ''
        if (!c.includes('-') || c.split('-')[0].trim().toUpperCase() !== f.state) return false
      }
      if (f.county !== 'all' && normalizeCounty(lead.county) !== f.county) return false
      if (f.status !== 'all' && lead.status !== f.status) return false
      if (f.type !== 'all') {
        const lt = (lead.lead_type || '').toUpperCase()
        if (f.type === 'FC' && lt.includes('TAX')) return false
        if (f.type === 'TD' && !lt.includes('TAX')) return false
      }
      const surp = parseFloat(String(lead.surplus || '0').replace(/[$,]/g, '')) || 0
      if (f.surplusMin !== '' && surp < parseFloat(f.surplusMin)) return false
      if (f.surplusMax !== '' && surp > parseFloat(f.surplusMax)) return false
      return true
    })
    setQueue(filtered)
    if (filtered.length > 0) loadActiveLead(filtered[0], 0)
    else { setActiveLead(null); setActiveContacts([]) }
  }

  const buildQueue = async () => {
    const { data: allContacts } = await supabase
      .from('contacts')
      .select('*')
      .order('is_primary', { ascending: false })

    const contactsByLead = {}
    if (allContacts) {
      allContacts.forEach(c => {
        const lid = String(c.lead_id)
        if (!contactsByLead[lid]) contactsByLead[lid] = []
        contactsByLead[lid].push(c)
      })
    }

    const eligibleLeads = leads.filter(l => ['Surplus','Interested','Contacted','New'].includes(l.status))

    // Build ALL items — some may have empty contacts array
    const allItems = eligibleLeads.map(lead => ({
      lead,
      contacts: contactsByLead[String(lead.id)] || []
    }))

    setAllQueueItems(allItems)
    applyQueueFilters(allItems, queueFilters)
  }

  const initDevice = async () => {
    try {
      const identity = (user?.name || 'agent').replace(/[^a-zA-Z0-9]/g, '_')
      const resp = await fetch(TWILIO_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON}`, 'apikey': SUPABASE_ANON },
        body: JSON.stringify({ identity })
      })
      const { token } = await resp.json()
      if (!token) return
      const dev = new Device(token, { codecPreferences: ['opus', 'pcmu'] })
      dev.on('incoming', handleIncoming)
      await dev.register()
      setDevice(dev)
      setDeviceReady(true)
    } catch (err) { console.error('Phone panel device init:', err) }
  }

  const handleIncoming = (call) => {
    if (window.confirm(`Incoming call from ${call.parameters.From}. Answer?`)) {
      call.accept()
      setActiveCall(call)
      setCallStatus('active')
      setCallMode('queue')
      timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000)
      call.on('disconnect', () => { setCallStatus('ended'); clearInterval(timerRef.current) })
    } else { call.reject() }
  }

  const loadActiveLead = async (item, idx) => {
    setQueueIdx(idx)
    setActiveLead(item.lead)
    setActiveContacts(item.contacts)
    setSelectedContactIdx(0)
    setVmDropped(false)
    const { data: notes } = await supabase.from('notes').select('*').eq('lead_id', item.lead.id).order('created_at', { ascending: false })
    setLeadNotes(notes || [])
    setCallHistory((notes || []).filter(n => ['Call Log','Left Voicemail','No Answer'].includes(n.note_type) || n.text?.startsWith('📞')))
  }

  const loadSmsConvos = async () => {
    const { data } = await supabase.from('notes').select('*, leads(property_address, county)').eq('note_type', 'SMS Sent').order('created_at', { ascending: false }).limit(50)
    setSmsConvos(data || [])
  }

  const getActivePhone = () => {
    const c = activeContacts[selectedContactIdx]
    return c ? (c.phone || c.secondary_phone || null) : null
  }

  const getAllPhones = (contact) => {
    const phones = []
    if (!contact) return phones
    if (contact.phone) phones.push({ number: contact.phone, label: 'Primary' })
    if (contact.secondary_phone) phones.push({ number: contact.secondary_phone, label: 'Alt' })
    try {
      const parsed = contact.notes ? JSON.parse(contact.notes) : {}
      const seen = new Set(phones.map(p => p.number))
      ;(parsed.all_phones || []).forEach(p => { if (p.number && !seen.has(p.number)) { seen.add(p.number); phones.push({ number: p.number, label: p.type || 'Skip trace' }) } })
    } catch {}
    return phones
  }

  // ── Queue call ──
  const startCall = async (phoneOverride) => {
    const phone = phoneOverride || getActivePhone()
    if (!phone || !device) return
    try {
      setCallMode('queue')
      setCallStatus('connecting')
      setCallDuration(0)
      setVmDropped(false)
      const clean = phone.replace(/[^0-9]/g, '')
      const toNumber = clean.length === 11 ? `+${clean}` : `+1${clean}`
      const call = await device.connect({ params: { To: toNumber } })
      setActiveCall(call)
      setCallStatus('active')
      call.on('disconnect', () => { setCallStatus('ended'); clearInterval(timerRef.current); autoLogCall(phone) })
      call.on('error', () => { setCallStatus('idle'); clearInterval(timerRef.current) })
      timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000)
    } catch (err) { console.error('startCall error:', err); setCallStatus('idle') }
  }

  const endCall = () => {
    if (activeCall) activeCall.disconnect()
    setCallStatus('ended')
    clearInterval(timerRef.current)
    autoLogCall(getActivePhone())
  }

  const autoLogCall = async (phone) => {
    if (!activeLead?.id) return
    const contact = activeContacts[selectedContactIdx]
    const contactName = contact ? [contact.first_name, contact.last_name].filter(Boolean).join(' ') : 'Contact'
    const dur = callDuration
    await supabase.from('notes').insert({
      lead_id: activeLead.id,
      text: `📞 Call to ${contactName} (${phone}) — ${Math.floor(dur/60)}m ${dur%60}s — ${user?.name}`,
      note_type: 'Call Log',
      author: user?.name,
      created_at: new Date().toISOString()
    })
  }

  // ── Independent dialer — fully isolated, never writes to any lead ──
  const startIndCall = async () => {
    if (!dialPad || !device) return
    try {
      setCallMode('independent')
      setIndCallStatus('connecting')
      setIndCallDuration(0)
      const clean = dialPad.replace(/[^0-9]/g, '')
      const toNumber = clean.length === 11 ? `+${clean}` : `+1${clean}`
      const call = await device.connect({ params: { To: toNumber } })
      setIndActiveCall(call)
      setIndCallStatus('active')
      call.on('disconnect', () => {
        setIndCallStatus('ended')
        clearInterval(indTimerRef.current)
        logStandaloneCall(toNumber)
      })
      call.on('error', () => { setIndCallStatus('idle'); clearInterval(indTimerRef.current) })
      indTimerRef.current = setInterval(() => setIndCallDuration(d => d + 1), 1000)
    } catch (err) { console.error('indCall error:', err); setIndCallStatus('idle') }
  }

  const endIndCall = () => {
    if (indActiveCall) indActiveCall.disconnect()
    setIndCallStatus('ended')
    clearInterval(indTimerRef.current)
    logStandaloneCall(dialPad)
  }

  const logStandaloneCall = async (phone) => {
    const dur = indCallDuration
    try {
      await supabase.from('notes').insert({
        lead_id: null,
        text: `📞 Independent call to ${phone} — ${Math.floor(dur/60)}m ${dur%60}s — ${user?.name}`,
        note_type: 'Call Log',
        author: user?.name,
        created_at: new Date().toISOString()
      })
    } catch (err) { console.error('logStandaloneCall:', err) }
  }

  const saveNoteAndOutcome = async () => {
    if (!callNote.trim() || !activeLead?.id) return
    await supabase.from('notes').insert({ lead_id: activeLead.id, text: callNote, note_type: callOutcome, author: user?.name, created_at: new Date().toISOString() })
    const statusMap = { 'Contacted - Interested': 'Interested', 'Contacted - Not Interested': 'Not Interested', 'Contract Sent': 'Interested', 'Contract Signed': 'Interested' }
    if (statusMap[callOutcome]) await supabase.from('leads').update({ status: statusMap[callOutcome] }).eq('id', activeLead.id)
    setQueueOutcomes(prev => ({ ...prev, [activeLead.id]: callOutcome }))
    setCallNote('')
    const { data } = await supabase.from('notes').select('*').eq('lead_id', activeLead.id).order('created_at', { ascending: false })
    setLeadNotes(data || [])
    setCallStatus('idle')
    // Auto-advance to next lead after 2.5 seconds
    setTimeout(() => {
      const next = queueIdx + 1
      if (next < queue.length) { loadActiveLead(queue[next], next); setCallStatus('idle'); setCallDuration(0) }
    }, 2500)
  }

  const nextLead = () => {
    const next = queueIdx + 1
    if (next < queue.length) { loadActiveLead(queue[next], next); setCallStatus('idle'); setCallDuration(0) }
  }

  const fmt = (sec) => `${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`

  const outcomeTag = (leadId) => {
    const tag = queueOutcomes[leadId]
    if (!tag) return null
    const map = {
      'Contacted - Interested': { label: 'Interested', bg: '#1e3a5f', color: '#60a5fa' },
      'Contacted - Not Interested': { label: 'No Int', bg: '#1f2937', color: '#6b7280' },
      'Left Voicemail': { label: 'Voicemail', bg: '#3a2a0a', color: '#fbbf24' },
      'No Answer': { label: 'No Ans', bg: '#1f2937', color: '#6b7280' },
      'Contract Sent': { label: 'Contract', bg: '#1a3a1a', color: '#4ade80' },
      'Do Not Contact': { label: 'DNC', bg: '#3a0a0a', color: '#f87171' },
    }
    return map[tag] || { label: tag, bg: '#1f2937', color: '#9ca3af' }
  }

  // ── Draggable floating mini-dialer ──
  const [minimized, setMinimized] = useState(false)
  const [miniPos, setMiniPos] = useState({ x: window.innerWidth - 280, y: window.innerHeight - 140 })
  const dragRef = useRef(null)

  const onMiniMouseDown = (e) => {
    e.preventDefault()
    const startX = e.clientX, startY = e.clientY
    const startPx = miniPos.x, startPy = miniPos.y
    const onMove = (me) => setMiniPos({
      x: Math.max(0, Math.min(window.innerWidth - 264, startPx + me.clientX - startX)),
      y: Math.max(0, Math.min(window.innerHeight - 110, startPy + me.clientY - startY)),
    })
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const isOnAnyCall = callStatus === 'active' || callStatus === 'connecting' || indCallStatus === 'active' || indCallStatus === 'connecting'
  const activeCallPhone = callMode === 'queue' ? getActivePhone() : dialPad
  const activeCallName = callMode === 'queue'
    ? (activeContacts[selectedContactIdx] ? [activeContacts[selectedContactIdx].first_name, activeContacts[selectedContactIdx].last_name].filter(Boolean).join(' ') : 'Contact')
    : dialPad
  const activeCallDur = callMode === 'queue' ? callDuration : indCallDuration

  // When minimized — floating draggable chip, CRM fully accessible beneath
  if (minimized) {
    return (
      <div
        ref={dragRef}
        onMouseDown={onMiniMouseDown}
        style={{ position:'fixed', left:miniPos.x, top:miniPos.y, zIndex:400, background:'#111827', border:`1px solid ${isOnAnyCall ? '#2d5a2d' : '#374151'}`, borderRadius:12, padding:'10px 14px', width:264, cursor:'grab', userSelect:'none', boxShadow:'0 4px 24px rgba(0,0,0,0.7)' }}
      >
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: isOnAnyCall ? 8 : 0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background: isOnAnyCall ? '#4ade80' : '#6b7280', flexShrink:0 }} />
            <span style={{ fontSize:12, fontWeight:500, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:110 }}>
              {isOnAnyCall ? activeCallName : 'Phone · idle'}
            </span>
            {isOnAnyCall && <span style={{ fontSize:13, fontWeight:700, color:'#4ade80', fontVariantNumeric:'tabular-nums', marginLeft:4 }}>{fmt(activeCallDur)}</span>}
          </div>
          <div style={{ display:'flex', gap:4, flexShrink:0 }}>
            <button onMouseDown={e => e.stopPropagation()} onClick={() => setMinimized(false)} style={{ background:'#1f2937', border:'none', color:'#9ca3af', borderRadius:4, padding:'2px 7px', fontSize:10, cursor:'pointer' }}>Open</button>
            <button onMouseDown={e => e.stopPropagation()} onClick={onClose} style={{ background:'none', border:'none', color:'#6b7280', cursor:'pointer', fontSize:14, lineHeight:1, padding:'0 2px' }}>✕</button>
          </div>
        </div>
        {isOnAnyCall && (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:6 }}>
            <span style={{ fontSize:10, color:'#4b5563', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{activeCallPhone}</span>
            <div style={{ display:'flex', gap:4, flexShrink:0 }}>
              <button
                onMouseDown={e => e.stopPropagation()}
                onClick={() => { const c = callMode === 'queue' ? activeCall : indActiveCall; if (c) { const m = !muted; c.mute(m); setMuted(m) } }}
                style={{ padding:'3px 8px', borderRadius:4, background:'#1f2937', border:'none', color: muted ? '#f87171' : '#9ca3af', fontSize:10, cursor:'pointer' }}>
                {muted ? '🔇' : '🎙'}
              </button>
              <button
                onMouseDown={e => e.stopPropagation()}
                onClick={() => { callMode === 'queue' ? endCall() : endIndCall() }}
                style={{ padding:'3px 10px', borderRadius:20, background:'#7f1d1d', border:'none', color:'#fca5a5', fontSize:10, fontWeight:600, cursor:'pointer' }}>
                End
              </button>
            </div>
          </div>
        )}
        {!isOnAnyCall && <div style={{ fontSize:10, color:'#374151', textAlign:'center', marginTop:4 }}>No active call · drag to move</div>}
      </div>
    )
  }

  const s = {
    panel: isMobile
      ? { position:'fixed', inset:0, background:'#111827', zIndex:300, display:'flex', flexDirection:'column' }
      : { position:'fixed', top:0, right:0, bottom:0, width:'920px', background:'#111827', borderLeft:'1px solid #1f2937', zIndex:300, display:'flex', flexDirection:'column', boxShadow:'-4px 0 24px rgba(0,0,0,0.5)' },
    overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:299 },
    topBar: { background:'#0d1117', borderBottom:'1px solid #1f2937', padding:'10px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 },
    modeTabs: { background:'#0d1117', borderBottom:'1px solid #1f2937', display:'flex', padding:'0 14px', flexShrink:0 },
    callBar: { background:'#0f1e0a', borderBottom:'1px solid #2d5a2d', padding:'8px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 },
    body: { flex:1, display:'flex', overflow:'hidden', minHeight:0 },
    colQ: { width: isMobile ? '100%' : 220, flexShrink:0, borderRight: isMobile ? 'none' : '1px solid #1f2937', background:'#111827', display:'flex', flexDirection:'column', overflow:'hidden' },
    colMid: { flex:1, display:'flex', flexDirection:'column', background:'#0d1117', overflow:'hidden', minWidth:0 },
    colRight: { width:200, flexShrink:0, borderLeft:'1px solid #1f2937', background:'#111827', display:'flex', flexDirection:'column', overflow:'hidden' },
  }

  return (
    <>
      {/* Clicking overlay minimizes so active calls aren't killed — desktop only */}
      {!isMobile && <div style={s.overlay} onClick={() => setMinimized(true)} />}
      <div style={s.panel}>

        {/* TOP BAR */}
        <div style={s.topBar}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            {isMobile && (
              <button onClick={onClose} style={{ background:'none', border:'none', color:'#9ca3af', cursor:'pointer', fontSize:18, lineHeight:1, marginRight:4 }}>←</button>
            )}
            <Phone size={14} style={{ color:'#4CAF50' }} />
            <span style={{ color:'white', fontSize:13, fontWeight:500 }}>Phone</span>
            <div style={{ display:'flex', alignItems:'center', gap:5, background:'#1a2e1a', border:'1px solid #2d5a2d', borderRadius:20, padding:'3px 9px', fontSize:10, color:'#4CAF50' }}>
              <div style={{ width:6, height:6, borderRadius:'50%', background: deviceReady ? '#4CAF50' : '#6b7280' }} />
              {deviceReady ? `Ready · (786) 741-7270` : 'Initializing...'}
            </div>
          </div>
          <div style={{ display:'flex', gap:6 }}>
            {!isMobile && <button onClick={() => setMinimized(true)} style={{ background:'#1f2937', border:'none', color:'#9ca3af', borderRadius:5, padding:'3px 9px', fontSize:10, cursor:'pointer' }}>Minimize</button>}
            {isMobile
              ? <button onClick={() => setMinimized(true)} style={{ background:'#1f2937', border:'none', color:'#9ca3af', borderRadius:5, padding:'3px 9px', fontSize:10, cursor:'pointer' }}>Minimize</button>
              : <button onClick={onClose} style={{ background:'none', border:'none', color:'#6b7280', cursor:'pointer' }}><X size={16} /></button>
            }
          </div>
        </div>

        {/* MODE TABS */}
        <div style={s.modeTabs}>
          {[['session','Call Session'],['conversations','SMS / Inbox'],['log','Call Log']].map(([id, label]) => (
            <button key={id} onClick={() => setPanelTab(id)} style={{ padding:'9px 14px', fontSize:11, color: panelTab===id ? '#C9A84C' : '#6b7280', border:'none', borderBottom: panelTab===id ? '2px solid #C9A84C' : '2px solid transparent', background:'none', cursor:'pointer', whiteSpace:'nowrap' }}>{label}</button>
          ))}
        </div>

        {/* ── CALL SESSION TAB ── */}
        {panelTab === 'session' && (
          <>
            {/* Active call bar */}
            {(callStatus === 'active' || callStatus === 'connecting') && (
              <div style={s.callBar}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:'#4ade80', flexShrink:0 }} />
                  <span style={{ fontSize:13, fontWeight:500, color:'#fff' }}>
                    {activeContacts[selectedContactIdx] ? [activeContacts[selectedContactIdx].first_name, activeContacts[selectedContactIdx].last_name].filter(Boolean).join(' ') : 'Unknown'}
                  </span>
                  <span style={{ fontSize:10, color:'#6b7280' }}>{getActivePhone()}</span>
                  <span style={{ fontSize:13, fontWeight:600, color:'#4ade80', fontVariantNumeric:'tabular-nums' }}>{fmt(callDuration)}</span>
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  {isMobile && (
                    <button onClick={() => setShowMobileNumSheet(s => !s)} style={{ padding:'5px 9px', borderRadius:5, fontSize:10, fontWeight:500, cursor:'pointer', border:'none', background:'#1a3a1a', color:'#4ade80' }}>📋 #s</button>
                  )}
                  <button onClick={() => { setMuted(!muted); if(activeCall) muted ? activeCall.mute(false) : activeCall.mute(true) }} style={{ padding:'5px 11px', borderRadius:5, fontSize:10, fontWeight:500, cursor:'pointer', border:'none', background:'#1f2937', color: muted ? '#f87171' : '#9ca3af' }}>{muted ? '🔇 Muted' : '🎙 Mute'}</button>
                  <button onClick={endCall} style={{ padding:'5px 11px', borderRadius:5, fontSize:10, fontWeight:500, cursor:'pointer', border:'none', background:'#7f1d1d', color:'#fca5a5' }}>End call</button>
                  <button onClick={nextLead} style={{ padding:'5px 11px', borderRadius:5, fontSize:10, fontWeight:500, cursor:'pointer', border:'none', background:'#C9A84C', color:'#1a1a1a' }}>Next →</button>
                </div>
              </div>
            )}

            {/* Mobile Numbers bottom sheet */}
            {isMobile && showMobileNumSheet && activeLead && (
              <div style={{ position:'fixed', inset:0, zIndex:300, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'flex-end' }}
                onClick={() => setShowMobileNumSheet(false)}>
                <div style={{ width:'100%', background:'#111827', borderRadius:'16px 16px 0 0', padding:'16px', maxHeight:'60vh', overflowY:'auto' }}
                  onClick={e => e.stopPropagation()}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                    <span style={{ fontSize:13, fontWeight:600, color:'#e5e7eb' }}>Numbers — {activeLead.property_address || activeLead.case_number}</span>
                    <button onClick={() => setShowMobileNumSheet(false)} style={{ background:'none', border:'none', color:'#6b7280', fontSize:18, cursor:'pointer' }}>✕</button>
                  </div>
                  {activeContacts.map((contact, ci) => {
                    const phones = getAllPhones(contact)
                    const name = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || 'Unknown'
                    return (
                      <div key={contact.id} style={{ marginBottom:14 }}>
                        <div style={{ fontSize:10, color:'#4b5563', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>{name} — {contact.contact_type}</div>
                        {phones.length === 0 && <div style={{ fontSize:11, color:'#4b5563' }}>No numbers</div>}
                        {phones.map((p, pi) => (
                          <div key={pi} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', background:'#0d1117', borderRadius:7, marginBottom:5 }}>
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:9, color:'#4b5563' }}>{p.label}</div>
                              <div style={{ fontSize:13, color:'#e5e7eb', fontWeight:500 }}>{p.number}</div>
                            </div>
                            <button onClick={() => { startCall(p.number); setShowMobileNumSheet(false) }}
                              style={{ padding:'8px 18px', background:'#1a3a1a', border:'1px solid #2d5a2d', borderRadius:8, color:'#4ade80', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                              Dial
                            </button>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                  {activeContacts.length === 0 && <div style={{ fontSize:12, color:'#4b5563', textAlign:'center', padding:20 }}>No contacts on this lead</div>}
                </div>
              </div>
            )}

            <div style={{ ...s.body, flexDirection: isMobile ? 'column' : 'row' }}>
              {/* Queue — full width on mobile, collapsible */}
              <div style={{ ...s.colQ, width: isMobile ? '100%' : 220, maxHeight: isMobile ? (showQueueFilters ? 280 : 220) : 'unset', borderRight: isMobile ? 'none' : '1px solid #1f2937', borderBottom: isMobile ? '1px solid #1f2937' : 'none' }}>
                <div style={{ padding:'9px 12px', borderBottom:'1px solid #1f2937', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
                  <span style={{ fontSize:11, fontWeight:500, color:'#e5e7eb' }}>Call queue</span>
                  <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                    <span style={{ fontSize:9, color:'#4b5563', background:'#1f2937', padding:'1px 6px', borderRadius:10 }}>{queue.length}</span>
                    <button onClick={() => setShowQueueFilters(f => !f)} style={{ background: showQueueFilters ? '#C9A84C' : '#1f2937', border:'none', color: showQueueFilters ? '#1a1a1a' : '#9ca3af', borderRadius:4, padding:'2px 6px', fontSize:9, cursor:'pointer' }}>Filter</button>
                  </div>
                </div>
                {/* Queue filters */}
                {showQueueFilters && (
                  <div style={{ padding:'8px 10px', borderBottom:'1px solid #1f2937', background:'#0d1117', display:'flex', flexDirection:'column', gap:5, flexShrink:0 }}>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
                      <select value={queueFilters.state} onChange={e => setQueueFilters(f => ({ ...f, state: e.target.value, county: 'all' }))} style={{ background:'#1f2937', border:'1px solid #374151', borderRadius:4, padding:'3px 5px', fontSize:9, color:'#e5e7eb', outline:'none' }}>
                        <option value="all">All states</option>
                        {allStates.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <select value={queueFilters.county} onChange={e => setQueueFilters(f => ({ ...f, county: e.target.value }))} style={{ background:'#1f2937', border:'1px solid #374151', borderRadius:4, padding:'3px 5px', fontSize:9, color:'#e5e7eb', outline:'none' }}>
                        <option value="all">All counties</option>
                        {allCounties.filter(c => queueFilters.state === 'all' || c.startsWith(queueFilters.state + '-')).map(c => <option key={c} value={c}>{c.includes('-') ? c.split('-').slice(1).join(' ') : c}</option>)}
                      </select>
                      <select value={queueFilters.status} onChange={e => setQueueFilters(f => ({ ...f, status: e.target.value }))} style={{ background:'#1f2937', border:'1px solid #374151', borderRadius:4, padding:'3px 5px', fontSize:9, color:'#e5e7eb', outline:'none' }}>
                        <option value="all">All statuses</option>
                        {['New','Contacted','Interested','Surplus'].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <select value={queueFilters.type} onChange={e => setQueueFilters(f => ({ ...f, type: e.target.value }))} style={{ background:'#1f2937', border:'1px solid #374151', borderRadius:4, padding:'3px 5px', fontSize:9, color:'#e5e7eb', outline:'none' }}>
                        <option value="all">FC + TD</option>
                        <option value="FC">FC only</option>
                        <option value="TD">TD only</option>
                      </select>
                    </div>
                    <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                      <span style={{ fontSize:9, color:'#4b5563', flexShrink:0 }}>Surplus $</span>
                      <input type="number" placeholder="Min" value={queueFilters.surplusMin} onChange={e => setQueueFilters(f => ({ ...f, surplusMin: e.target.value }))} style={{ flex:1, background:'#1f2937', border:'1px solid #374151', borderRadius:4, padding:'3px 5px', fontSize:9, color:'#e5e7eb', outline:'none', minWidth:0 }} />
                      <span style={{ fontSize:9, color:'#4b5563' }}>–</span>
                      <input type="number" placeholder="Max" value={queueFilters.surplusMax} onChange={e => setQueueFilters(f => ({ ...f, surplusMax: e.target.value }))} style={{ flex:1, background:'#1f2937', border:'1px solid #374151', borderRadius:4, padding:'3px 5px', fontSize:9, color:'#e5e7eb', outline:'none', minWidth:0 }} />
                      <button onClick={() => setQueueFilters({ state:'all', county:'all', status:'all', type:'all', surplusMin:'', surplusMax:'', contactsOnly: true })} style={{ background:'#374151', border:'none', color:'#9ca3af', borderRadius:4, padding:'3px 6px', fontSize:9, cursor:'pointer', flexShrink:0 }}>Reset</button>
                    </div>
                    {/* Contacts-only toggle */}
                    <button
                      onClick={() => setQueueFilters(f => ({ ...f, contactsOnly: !f.contactsOnly }))}
                      style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 8px', borderRadius:4, border:'none', cursor:'pointer', width:'100%', background: queueFilters.contactsOnly ? 'rgba(74,222,128,0.12)' : '#1f2937', color: queueFilters.contactsOnly ? '#4ade80' : '#6b7280', fontSize:9, fontWeight:500 }}>
                      <div style={{ width:10, height:10, borderRadius:'50%', background: queueFilters.contactsOnly ? '#4ade80' : '#374151', flexShrink:0 }} />
                      {queueFilters.contactsOnly ? '● With contacts only' : '○ Show all leads'}
                    </button>
                  </div>
                )}
                <div style={{ flex:1, overflowY:'auto' }}>
                  {queue.length === 0 && (
                    <div style={{ padding:16, fontSize:11, color:'#4b5563', textAlign:'center' }}>
                      {queueFilters.contactsOnly
                        ? <>No leads with contacts match filters.<br/>Toggle filter or add contacts to leads.</>
                        : 'No leads match the current filters.'}
                    </div>
                  )}
                  {queue.map((item, idx) => {
                    const tag = outcomeTag(item.lead.id)
                    const isActive = idx === queueIdx
                    const isDone = tag !== null
                    const hasContacts = item.contacts && item.contacts.length > 0
                    return (
                      <div key={item.lead.id} onClick={() => loadActiveLead(item, idx)} style={{ padding:'9px 12px', borderBottom:'1px solid #1f2937', cursor:'pointer', borderLeft: isActive ? '2px solid #C9A84C' : '2px solid transparent', background: isActive ? 'rgba(201,168,76,0.07)' : 'transparent', opacity: isDone && !isActive ? 0.45 : 1 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:4, marginBottom:2 }}>
                          <span style={{ fontSize:11, fontWeight:500, color: hasContacts ? '#e5e7eb' : '#6b7280', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {hasContacts ? [item.contacts[0].first_name, item.contacts[0].last_name].filter(Boolean).join(' ') : item.lead.property_address}
                          </span>
                          <span style={{ fontSize:10, color:'#4ade80', flexShrink:0 }}>
                            {item.lead.surplus ? `$${Math.round(parseFloat(String(item.lead.surplus).replace(/[$,]/g,''))).toLocaleString()}` : ''}
                          </span>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                          <span style={{ fontSize:9, color:'#6b7280' }}>{item.lead.county?.includes('-') ? item.lead.county.split('-').slice(1).join(' ') : item.lead.county}</span>
                          {!hasContacts
                            ? <span style={{ fontSize:9, padding:'1px 5px', borderRadius:3, background:'rgba(239,68,68,0.15)', color:'#f87171' }}>No contacts</span>
                            : tag
                              ? <span style={{ fontSize:9, padding:'1px 5px', borderRadius:3, background:tag.bg, color:tag.color }}>{tag.label}</span>
                              : isActive
                                ? <span style={{ fontSize:9, padding:'1px 5px', borderRadius:3, background:'#1a3a1a', color:'#4ade80' }}>{callStatus === 'active' ? 'On call' : 'Active'}</span>
                                : <span style={{ fontSize:9, padding:'1px 5px', borderRadius:3, background:'#1f2937', color:'#6b7280' }}>Queued</span>
                          }
                        </div>
                        <div style={{ fontSize:9, color:'#4b5563', marginTop:2 }}>
                          {hasContacts ? `${item.contacts.length} contact${item.contacts.length !== 1 ? 's' : ''}` : item.lead.property_address}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* CENTER: Lead workspace */}
              <div style={{ ...s.colMid, minHeight: isMobile ? 300 : 'unset' }}>
                {!activeLead ? (
                  <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'#4b5563', fontSize:12 }}>Select a lead from the queue</div>
                ) : (
                  <>
                    {/* Lead header */}
                    <div style={{ background:'#111827', borderBottom:'1px solid #1f2937', padding:'10px 14px', flexShrink:0 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                        <div>
                          <div style={{ fontSize:14, fontWeight:600, color:'#fff' }}>{activeLead.property_address || 'No Address'}</div>
                          <div style={{ fontSize:10, color:'#6b7280', marginTop:1 }}>{activeLead.county} · Case {activeLead.case_number}</div>
                          <div style={{ display:'flex', gap:4, marginTop:5 }}>
                            <span style={{ padding:'2px 6px', borderRadius:3, fontSize:9, fontWeight:600, background:'rgba(249,115,22,0.2)', color:'#fb923c' }}>{activeLead.lead_type?.toUpperCase().includes('TAX') ? 'Tax Deed' : 'Foreclosure'}</span>
                            <span style={{ padding:'2px 6px', borderRadius:3, fontSize:9, fontWeight:600, background:'rgba(16,185,129,0.2)', color:'#34d399' }}>{activeLead.status}</span>
                          </div>
                        </div>
                        <div style={{ textAlign:'right' }}>
                          <div style={{ fontSize:9, color:'#4b5563' }}>Surplus</div>
                          <div style={{ fontSize:18, fontWeight:700, color:'#4ade80' }}>
                            {activeLead.surplus ? `$${Math.round(parseFloat(String(activeLead.surplus).replace(/[$,]/g,''))).toLocaleString()}` : '—'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Multiple contacts tabs */}
                    <div style={{ background:'#0d1117', borderBottom:'1px solid #1f2937', padding:'8px 14px', flexShrink:0 }}>
                      <div style={{ fontSize:9, color:'#4b5563', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>Contacts on this lead</div>
                      <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                        {activeContacts.map((c, i) => {
                          const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Unknown'
                          const initials = name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()
                          const isSelected = i === selectedContactIdx
                          const isOnCall = isSelected && callStatus === 'active'
                          return (
                            <div key={c.id} onClick={() => setSelectedContactIdx(i)} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 9px', borderRadius:6, border: `1px solid ${isSelected ? '#C9A84C' : '#1f2937'}`, background: isSelected ? 'rgba(201,168,76,0.07)' : '#111827', cursor:'pointer' }}>
                              <div style={{ width:22, height:22, borderRadius:'50%', background:'#1e3a5f', display:'flex', alignItems:'center', justifyContent:'center', fontSize:8, fontWeight:600, color:'#60a5fa', flexShrink:0 }}>{initials}</div>
                              <div>
                                <div style={{ fontSize:10, fontWeight:500, color:'#e5e7eb' }}>{name}{isOnCall ? <span style={{ color:'#4ade80', marginLeft:4 }}>● on call</span> : ''}</div>
                                <div style={{ fontSize:9, color:'#4b5563' }}>{c.contact_type}{c.do_not_contact ? ' · DNC' : ''}</div>
                              </div>
                            </div>
                          )
                        })}
                        {activeContacts.length === 0 && <span style={{ fontSize:11, color:'#4b5563' }}>No contacts on this lead</span>}
                      </div>
                    </div>

                    {/* Call history */}
                    {callHistory.length > 0 && (
                      <div style={{ padding:'8px 14px', borderBottom:'1px solid #1f2937', flexShrink:0 }}>
                        <div style={{ fontSize:9, color:'#4b5563', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:5 }}>Call history</div>
                        {callHistory.slice(0, 3).map((n, i) => (
                          <div key={i} style={{ display:'flex', alignItems:'center', gap:7, marginBottom:4 }}>
                            <div style={{ width:20, height:20, borderRadius:'50%', background: n.note_type === 'Left Voicemail' ? '#3a2a0a' : n.text?.includes('missed') ? '#3a0a0a' : '#1a3a1a', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, flexShrink:0 }}>
                              {n.note_type === 'Left Voicemail' ? '📬' : n.text?.includes('missed') ? '📵' : '📞'}
                            </div>
                            <div style={{ flex:1, fontSize:10, color:'#d1d5db', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{n.text}</div>
                            <div style={{ fontSize:9, color:'#4b5563', flexShrink:0 }}>{new Date(n.created_at).toLocaleDateString()}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Notes + outcome entry */}
                    <div style={{ flex:1, overflowY:'auto', padding:'10px 14px', display:'flex', flexDirection:'column', gap:7 }}>
                      <div style={{ fontSize:9, color:'#4b5563', textTransform:'uppercase', letterSpacing:'0.05em' }}>Notes</div>
                      {leadNotes.filter(n => !n.text?.startsWith('📞')).slice(0, 5).map((n, i) => (
                        <div key={i} style={{ background:'#111827', border:'1px solid #1f2937', borderRadius:6, padding:'7px 10px' }}>
                          <div style={{ fontSize:11, color:'#d1d5db', lineHeight:1.5 }}>{n.text}</div>
                          <div style={{ fontSize:9, color:'#4b5563', marginTop:3 }}>{n.author} · {n.note_type} · {new Date(n.created_at).toLocaleDateString()}</div>
                        </div>
                      ))}
                      <textarea value={callNote} onChange={e => setCallNote(e.target.value)} placeholder="Add note..." style={{ background:'#111827', border:'1px solid #374151', borderRadius:6, padding:'8px 10px', fontSize:11, color:'#e5e7eb', fontFamily:'inherit', resize:'none', outline:'none', minHeight:52 }} />

                      {/* Quick-tap outcome buttons — 3 columns */}
                      <div style={{ fontSize:9, color:'#4b5563', textTransform:'uppercase', letterSpacing:'0.05em' }}>Log outcome</div>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:5 }}>
                        {[
                          { label:'✅ Interested',   type:'Contacted - Interested',     bg:'#1a3a1a', color:'#4ade80', status:'Interested' },
                          { label:'❌ Not Interested',type:'Contacted - Not Interested',  bg:'#1f2937', color:'#9ca3af', status:'Contacted' },
                          { label:'📬 Voicemail',    type:'Left Voicemail',              bg:'#2d2000', color:'#fbbf24', status:'Contacted' },
                          { label:'🔇 No Answer',    type:'No Answer',                   bg:'#1f2937', color:'#6b7280', status:'Contacted' },
                          { label:'📞 Callback',     type:'Follow Up Needed',            bg:'#1e3a5f', color:'#60a5fa', status:'Contacted' },
                          { label:'❓ Wrong #',      type:'Wrong Number',                bg:'#3a1a1a', color:'#f87171', status: null },
                          { label:'👤 Not Owner',    type:'General Note',                bg:'#1f2937', color:'#9ca3af', status: null },
                          { label:'🏦 Claimed',      type:'General Note',                bg:'#3a1a1a', color:'#f87171', status:'Dead' },
                          { label:'🔕 VM Drop',      type:'Left Voicemail',              bg:'#2d2000', color:'#f59e0b', status:'Contacted' },
                        ].map(o => (
                          <button key={o.label} onClick={async () => {
                            setCallOutcome(o.type)
                            const note = callNote.trim() || o.label.replace(/^[^ ]+ /,'')
                            await supabase.from('notes').insert({ lead_id: activeLead.id, text: note, note_type: o.type, author: user?.name, created_at: new Date().toISOString() })
                            if (o.status) await supabase.from('leads').update({ status: o.status }).eq('id', activeLead.id)
                            setQueueOutcomes(prev => ({ ...prev, [activeLead.id]: o.type }))
                            setCallNote('')
                            const { data } = await supabase.from('notes').select('*').eq('lead_id', activeLead.id).order('created_at', { ascending: false })
                            setLeadNotes(data || [])
                            setCallStatus('idle')
                            setTimeout(() => {
                              const next = queueIdx + 1
                              if (next < queue.length) { loadActiveLead(queue[next], next); setCallStatus('idle'); setCallDuration(0) }
                            }, 2500)
                          }}
                          style={{ padding:'7px 4px', background:o.bg, border:`1px solid ${o.color}30`, borderRadius:6, color:o.color, fontSize:10, fontWeight:600, cursor:'pointer', textAlign:'center', lineHeight:1.3 }}>
                            {o.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* RIGHT: Numbers + Dialer — bottom sheet on mobile, side column on desktop */}
              <div style={{ ...s.colRight, display: isMobile ? 'none' : 'flex' }}>
                {/* Tab switcher */}
                <div style={{ display:'flex', borderBottom:'1px solid #1f2937', flexShrink:0 }}>
                  {[['numbers','Numbers'],['dialer','Dialer']].map(([id, label]) => (
                    <button key={id} onClick={() => setRightTab(id)} style={{ flex:1, padding:'8px 0', textAlign:'center', fontSize:10, color: rightTab===id ? '#C9A84C' : '#6b7280', border:'none', borderBottom: rightTab===id ? '2px solid #C9A84C' : '2px solid transparent', background:'none', cursor:'pointer' }}>{label}</button>
                  ))}
                </div>

                {/* NUMBERS TAB */}
                {rightTab === 'numbers' && (
                  <div style={{ flex:1, overflowY:'auto', padding:'10px 12px' }}>
                    {activeContacts.map((contact, ci) => {
                      const phones = getAllPhones(contact)
                      const name = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || 'Unknown'
                      return (
                        <div key={contact.id} style={{ marginBottom:12 }}>
                          <div style={{ fontSize:9, color:'#4b5563', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:5 }}>{name} — {contact.contact_type}</div>
                          {phones.length === 0 && <div style={{ fontSize:10, color:'#4b5563' }}>No numbers</div>}
                          {phones.map((p, pi) => {
                            const isOnCall = ci === selectedContactIdx && callStatus === 'active' && pi === 0
                            return (
                              <div key={pi} style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 8px', background:'#0d1117', borderRadius:5, marginBottom:4 }}>
                                <div style={{ flex:1, minWidth:0 }}>
                                  <div style={{ fontSize:9, color:'#4b5563' }}>{p.label}</div>
                                  <div style={{ fontSize:11, color:'#e5e7eb', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.number}</div>
                                </div>
                                {isOnCall
                                  ? <span style={{ fontSize:9, color:'#4ade80', flexShrink:0 }}>● on call</span>
                                  : <button onClick={() => startCall(p.number)}
                                      style={{ padding:'5px 12px', background:'#1a3a1a', border:'1px solid #2d5a2d', borderRadius:6, color:'#4ade80', fontSize:11, fontWeight:600, cursor:'pointer', flexShrink:0 }}>
                                      Dial
                                    </button>
                                }
                              </div>
                            )
                          })}
                          {contact.do_not_contact && <div style={{ fontSize:9, color:'#f87171', marginTop:2 }}>⚠ Do Not Contact</div>}
                        </div>
                      )
                    })}
                    {activeContacts.length === 0 && <div style={{ fontSize:11, color:'#4b5563', textAlign:'center', marginTop:20 }}>No contacts on this lead</div>}

                    {/* Call controls when idle */}
                    {callStatus === 'idle' && activeContacts.length > 0 && getActivePhone() && (
                      <button onClick={() => startCall()} style={{ width:'100%', padding:'7px 0', borderRadius:6, background: deviceReady ? '#C9A84C' : '#1f2937', border:'none', color: deviceReady ? '#1a1a1a' : '#6b7280', fontSize:11, fontWeight:600, cursor: deviceReady ? 'pointer' : 'not-allowed', marginTop:8 }}>
                        {deviceReady ? '📞 Call primary' : 'Initializing...'}
                      </button>
                    )}
                    {callStatus === 'ended' && (
                      <button onClick={() => setCallStatus('idle')} style={{ width:'100%', padding:'7px 0', borderRadius:6, background:'#1f2937', border:'1px solid #374151', color:'#d1d5db', fontSize:11, cursor:'pointer', marginTop:8 }}>Call again</button>
                    )}
                  </div>
                )}

                {/* MANUAL DIALER TAB */}
                {rightTab === 'dialer' && (
                  <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', padding:'14px 12px', gap:8 }}>
                    <div style={{ fontSize:9, color:'#4b5563', textTransform:'uppercase', letterSpacing:'0.05em', alignSelf:'flex-start' }}>Manual dial</div>
                    <div style={{ width:'100%', background:'#0d1117', border:'1px solid #1f2937', borderRadius:6, padding:'10px 12px', textAlign:'center' }}>
                      <div style={{ fontSize:18, fontWeight:500, color:'#fff', letterSpacing:2, minHeight:26, fontVariantNumeric:'tabular-nums' }}>{dialPad || '—'}</div>
                      <div style={{ fontSize:9, color:'#4b5563', marginTop:2 }}>Independent of queue</div>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:5, width:'100%' }}>
                      {['1','2','3','4','5','6','7','8','9','*','0','#'].map(k => (
                        <button key={k} onClick={() => setDialPad(d => d + k)} style={{ padding:'8px 0', borderRadius:6, background:'#1f2937', border:'none', color:'#e5e7eb', fontSize:13, fontWeight:500, cursor:'pointer' }}>{k}</button>
                      ))}
                    </div>
                    {indCallStatus === 'idle' || indCallStatus === 'ended' ? (
                      <button onClick={startIndCall} disabled={!dialPad || !deviceReady} style={{ width:'100%', padding:'8px 0', borderRadius:20, background: dialPad && deviceReady ? '#4ade80' : '#1f2937', border:'none', color: dialPad && deviceReady ? '#0d1117' : '#6b7280', fontSize:12, fontWeight:600, cursor: dialPad && deviceReady ? 'pointer' : 'not-allowed' }}>
                        {indCallStatus === 'ended' ? 'Call again' : '📞 Call'}
                      </button>
                    ) : (
                      <div style={{ display:'flex', gap:5 }}>
                        <div style={{ flex:1, textAlign:'center', fontSize:13, fontWeight:700, color:'#4ade80', fontVariantNumeric:'tabular-nums', padding:'7px 0' }}>{fmt(indCallDuration)}</div>
                        <button onClick={endIndCall} style={{ flex:1, padding:'7px 0', borderRadius:20, background:'#7f1d1d', border:'none', color:'#fca5a5', fontSize:11, fontWeight:600, cursor:'pointer' }}>End call</button>
                      </div>
                    )}
                    <button onClick={() => setDialPad('')} style={{ width:'100%', padding:'5px 0', borderRadius:5, background:'transparent', border:'1px solid #374151', color:'#6b7280', fontSize:10, cursor:'pointer' }}>Clear</button>
                    <div style={{ width:'100%', padding:'8px 10px', background:'#0d1117', borderRadius:6, border:'1px solid #1f2937' }}>
                      <div style={{ fontSize:9, color:'#4b5563', marginBottom:4 }}>⚠ Independent mode</div>
                      <div style={{ fontSize:9, color:'#374151', lineHeight:1.4 }}>Calls here log to Call Log only — never attached to any lead or contact.</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
        {panelTab === 'conversations' && (
          <div style={{ flex:1, display:'flex', flexDirection: isMobile ? 'column' : 'row', overflow:'hidden' }}>
            <div style={{ width: isMobile ? '100%' : 220, flexShrink:0, borderRight: isMobile ? 'none' : '1px solid #1f2937', borderBottom: isMobile ? '1px solid #1f2937' : 'none', overflowY:'auto', maxHeight: isMobile ? 200 : 'unset' }}>
              {smsConvos.length === 0 && <div style={{ padding:16, fontSize:11, color:'#4b5563', textAlign:'center' }}>No SMS sent yet</div>}
              {smsConvos.map((n, i) => (
                <div key={i} onClick={() => setSelectedConvo(n)} style={{ padding:'10px 12px', borderBottom:'1px solid #1f2937', cursor:'pointer', background: selectedConvo?.id === n.id ? 'rgba(201,168,76,0.07)' : 'transparent' }}>
                  <div style={{ fontSize:11, fontWeight:500, color:'#e5e7eb', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{n.author || 'Agent'}</div>
                  <div style={{ fontSize:10, color:'#6b7280', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginTop:2 }}>{n.text}</div>
                  <div style={{ fontSize:9, color:'#4b5563', marginTop:2 }}>{new Date(n.created_at).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
            <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'#4b5563', fontSize:12, flexDirection:'column', gap:8 }}>
              <Phone size={24} style={{ opacity:0.3 }} />
              <div>Select a conversation</div>
              <div style={{ fontSize:10, color:'#374151' }}>SMS replies appear here when configured in Twilio webhook</div>
            </div>
          </div>
        )}

        {/* ── CALL LOG TAB ── */}
        {panelTab === 'log' && (
          <div style={{ flex:1, overflowY:'auto', padding:'12px 16px' }}>
            <CallLogTab user={user} />
          </div>
        )}

      </div>
    </>
  )
}

// ─── Call Log Tab ─────────────────────────────────────────────────────────────
const CallLogTab = ({ user }) => {
  const [logs, setLogs] = useState([])
  const [filter, setFilter] = useState('all') // all | lead | standalone
  useEffect(() => {
    supabase.from('notes').select('*, leads(property_address, county)').eq('note_type', 'Call Log').order('created_at', { ascending: false }).limit(200)
      .then(({ data }) => setLogs(data || []))
  }, [])
  const filtered = logs.filter(n => {
    if (filter === 'lead') return n.lead_id !== null
    if (filter === 'standalone') return n.lead_id === null
    return true
  })
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
        <div style={{ fontSize:9, color:'#4b5563', textTransform:'uppercase', letterSpacing:'0.05em' }}>Call log · {filtered.length} entries</div>
        <div style={{ display:'flex', gap:3 }}>
          {[['all','All'],['lead','Lead calls'],['standalone','Independent']].map(([v,l]) => (
            <button key={v} onClick={() => setFilter(v)} style={{ padding:'2px 8px', borderRadius:4, fontSize:9, cursor:'pointer', border:'none', background: filter===v ? '#C9A84C' : '#1f2937', color: filter===v ? '#1a1a1a' : '#9ca3af' }}>{l}</button>
          ))}
        </div>
      </div>
      {filtered.length === 0 && <div style={{ fontSize:11, color:'#4b5563', textAlign:'center', marginTop:20 }}>No call logs yet</div>}
      {filtered.map((n, i) => (
        <div key={i} style={{ background:'#111827', border:'1px solid #1f2937', borderRadius:6, padding:'8px 12px', display:'flex', gap:10, alignItems:'flex-start' }}>
          <div style={{ width:22, height:22, borderRadius:'50%', background: n.lead_id ? '#1a3a1a' : '#1e3a5f', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, flexShrink:0 }}>📞</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:11, color:'#d1d5db', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{n.text}</div>
            {n.leads?.property_address
              ? <div style={{ fontSize:10, color:'#4b5563', marginTop:2 }}>{n.leads.property_address} · {n.leads.county}</div>
              : <div style={{ fontSize:10, color:'#1e3a5f', marginTop:2, color:'#374151' }}>Independent call</div>
            }
          </div>
          <div style={{ fontSize:9, color:'#4b5563', flexShrink:0, textAlign:'right' }}>
            <div>{new Date(n.created_at).toLocaleDateString()}</div>
            <div>{new Date(n.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Twilio Dialer Modal ──────────────────────────────────────────────────────
const DialerModal = ({ phoneNumber, contact, lead, user, onClose, onCallLogged }) => {
  const [status, setStatus] = useState('idle')
  const [duration, setDuration] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')
  const [device, setDevice] = useState(null)
  const [activeCall, setActiveCall] = useState(null)
  const [outcome, setOutcome] = useState(null)
  const [outcomeNote, setOutcomeNote] = useState('')
  const [saving, setSaving] = useState(false)
  const timerRef = useRef(null)
  const contactName = [contact?.first_name, contact?.last_name].filter(Boolean).join(' ') || 'Contact'

  const OUTCOMES = [
    { label: 'Spoke — Interested', color: '#22c55e', bg: 'rgba(34,197,94,0.15)', noteType: 'Contacted - Interested', status: 'Interested' },
    { label: 'Spoke — Not Interested', color: '#94a3b8', bg: 'rgba(100,116,139,0.15)', noteType: 'Contacted - Not Interested', status: 'Contacted' },
    { label: 'Left Voicemail', color: '#fbbf24', bg: 'rgba(245,158,11,0.15)', noteType: 'Left Voicemail', status: 'Contacted' },
    { label: 'No Answer', color: '#64748b', bg: 'rgba(71,85,105,0.15)', noteType: 'No Answer', status: 'Contacted' },
    { label: 'Wrong Number', color: '#f87171', bg: 'rgba(239,68,68,0.15)', noteType: 'Wrong Number', status: null },
    { label: 'Callback Requested', color: '#60a5fa', bg: 'rgba(59,130,246,0.15)', noteType: 'Follow Up Needed', status: 'Contacted' },
    { label: 'Not Owner', color: '#94a3b8', bg: 'rgba(100,116,139,0.15)', noteType: 'General Note', status: null },
    { label: 'Already Claimed', color: '#f87171', bg: 'rgba(239,68,68,0.15)', noteType: 'General Note', status: 'Dead' },
  ]

  useEffect(() => {
    initDevice()
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (activeCall) activeCall.disconnect()
    }
  }, [])

  const initDevice = async () => {
    try {
      setStatus('connecting')
      const identity = (user?.name || user?.email || 'agent').replace(/[^a-zA-Z0-9]/g, '_')
      const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6aWV2YXN3dGt1Z3V3eXNjbmd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNTQxODIsImV4cCI6MjA4NjkzMDE4Mn0.lODeKd6YoXpHPAGQHBqIkNlj7vE0PQ3FtEm2z2dMRwQ'
      const resp = await fetch(TWILIO_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON}`, 'apikey': SUPABASE_ANON },
        body: JSON.stringify({ identity })
      })
      const respText = await resp.text()
      let respData = {}
      try { respData = JSON.parse(respText) } catch(e) {}
      const { token, error } = respData
      if (error || !token) throw new Error(error || `HTTP ${resp.status}: ${respText.slice(0,100)}`)
      const dev = new Device(token, { codecPreferences: ['opus', 'pcmu'], logLevel: 'debug' })
      dev.on('error', (err) => { setStatus('error'); setErrorMsg(`${err.code}: ${err.message}`) })
      await dev.register()
      setDevice(dev)
      setStatus('idle')
    } catch (err) { setStatus('error'); setErrorMsg(err.message || String(err)) }
  }

  const startCall = async () => {
    if (!device) return
    try {
      setStatus('active')
      const clean = phoneNumber.replace(/[^0-9]/g, '')
      const toNumber = clean.length === 11 ? `+${clean}` : `+1${clean}`
      const call = await device.connect({ params: { To: toNumber } })
      setActiveCall(call)
      call.on('disconnect', () => { setStatus('ended'); clearInterval(timerRef.current); autoLogCall() })
      call.on('error', (err) => { setStatus('error'); setErrorMsg(err.message || String(err)); clearInterval(timerRef.current) })
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
    } catch(err) { setStatus('error'); setErrorMsg(err.message || String(err)) }
  }

  const endCall = () => {
    if (activeCall) activeCall.disconnect()
    setStatus('ended')
    clearInterval(timerRef.current)
    autoLogCall()
  }

  const autoLogCall = async () => {
    if (!lead?.id) return
    const dur = duration
    const callText = `📞 Call to ${contactName} (${phoneNumber}) — ${Math.floor(dur/60)}m ${dur%60}s — ${user?.name || 'Agent'}`
    await supabase.from('notes').insert({
      lead_id: lead.id, text: callText, note_type: 'Call Log', author: user?.name, created_at: new Date().toISOString()
    })
    // Increment attempt count
    await supabase.rpc('increment_attempt_count', { lead_id_arg: lead.id }).catch(() =>
      supabase.from('leads').update({ attempt_count: (lead.attempt_count || 0) + 1 }).eq('id', lead.id)
    )
    if (onCallLogged) onCallLogged()
  }

  const saveOutcome = async (o) => {
    if (!lead?.id) { onClose(); return }
    setSaving(true)
    const noteText = `${o.label}${outcomeNote ? ` — ${outcomeNote}` : ''} · ${contactName} (${phoneNumber}) · ${user?.name}`
    await supabase.from('notes').insert({ lead_id: lead.id, text: noteText, note_type: o.noteType, author: user?.name, created_at: new Date().toISOString() })
    if (o.status) await supabase.from('leads').update({ status: o.status }).eq('id', lead.id)
    if (onCallLogged) onCallLogged()
    setSaving(false)
    onClose()
  }

  const fmt = (s) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`
  const statusColor = { idle:'#64748b', connecting:'#f59e0b', active:'#34d399', ended:'#64748b', error:'#f87171' }[status]
  const statusLabel = { idle:'Ready to call', connecting:'Connecting...', active:'On Call', ended:'Call Ended', error:'Error' }[status]

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:200, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
      <div style={{ background:'#1e293b', border:'1px solid rgba(71,85,105,0.5)', borderRadius:'16px 16px 0 0', width:'100%', maxWidth:480, padding:'20px 20px 32px', display:'flex', flexDirection:'column', gap:14, maxHeight:'90vh', overflowY:'auto' }}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ color:'white', fontWeight:600, fontSize:15 }}>{contactName}</div>
            <div style={{ color:'#94a3b8', fontSize:12 }}>{phoneNumber}</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#64748b', cursor:'pointer' }}><X size={18} /></button>
        </div>

        {/* Status + timer */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:7 }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:statusColor }} />
            <span style={{ fontSize:13, color:statusColor }}>{statusLabel}</span>
          </div>
          {status === 'active' && (
            <div style={{ fontSize:22, fontWeight:700, color:'#34d399', fontVariantNumeric:'tabular-nums' }}>{fmt(duration)}</div>
          )}
        </div>

        {status === 'error' && <div style={{ fontSize:11, color:'#f87171', padding:'8px', background:'rgba(239,68,68,0.1)', borderRadius:6 }}>{errorMsg}</div>}

        {/* Main call button */}
        <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
          {(status === 'idle' || status === 'connecting') && (
            <button onClick={startCall} disabled={status === 'connecting' || !device}
              style={{ flex:1, padding:'14px', borderRadius:12, background: device && status === 'idle' ? '#22c55e' : 'rgba(30,41,59,0.8)', border:'none', cursor: device && status === 'idle' ? 'pointer' : 'not-allowed', display:'flex', alignItems:'center', justifyContent:'center', gap:8, fontSize:15, fontWeight:700, color: device && status === 'idle' ? '#0f172a' : '#475569' }}>
              <Phone size={18} /> {status === 'connecting' ? 'Connecting...' : !device ? 'Initializing...' : 'Call'}
            </button>
          )}
          {status === 'active' && (
            <button onClick={endCall}
              style={{ flex:1, padding:'14px', borderRadius:12, background:'#ef4444', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, fontSize:15, fontWeight:700, color:'white' }}>
              <Phone size={18} style={{ transform:'rotate(135deg)' }} /> End Call
            </button>
          )}
        </div>

        {/* Outcome buttons — shown after call ends or during call */}
        {(status === 'ended' || status === 'active') && (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <div style={{ fontSize:11, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em' }}>Log Outcome</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {OUTCOMES.map(o => (
                <button key={o.label} onClick={() => saveOutcome(o)} disabled={saving}
                  style={{ padding:'10px 8px', borderRadius:10, background:o.bg, border:`1px solid ${o.color}40`, color:o.color, fontSize:12, fontWeight:600, cursor:'pointer', textAlign:'center', opacity: saving ? 0.6 : 1 }}>
                  {o.label}
                </button>
              ))}
            </div>
            <textarea value={outcomeNote} onChange={e => setOutcomeNote(e.target.value)} placeholder="Optional note..." rows={2}
              style={{ width:'100%', padding:'8px 10px', background:'rgba(15,23,42,0.6)', border:'1px solid rgba(71,85,105,0.4)', borderRadius:8, color:'white', fontSize:12, resize:'none', fontFamily:'inherit', boxSizing:'border-box' }} />
          </div>
        )}

        {status !== 'ended' && status !== 'active' && (
          <button onClick={onClose} style={{ padding:'10px', background:'rgba(51,65,85,0.6)', border:'1px solid rgba(71,85,105,0.4)', color:'#94a3b8', borderRadius:8, fontSize:13, cursor:'pointer' }}>Cancel</button>
        )}
      </div>
    </div>
  )
}

// ─── Contact Card ─────────────────────────────────────────────────────────────
const ContactCard = ({ contact, onEdit, onDelete, isAdmin, onEmail, onCall, onContract, onMarkDead }) => {
  const [expanded, setExpanded] = useState(false)
  const typeBadge = {
    'Owner':       { bg:'rgba(245,158,11,0.2)',  color:'#fbbf24' },
    'Relative':    { bg:'rgba(59,130,246,0.2)',  color:'#60a5fa' },
    'Attorney':    { bg:'rgba(168,85,247,0.2)',  color:'#c084fc' },
    'LLC / Entity':{ bg:'rgba(249,115,22,0.2)',  color:'#fb923c' },
    'Estate / PR': { bg:'rgba(20,184,166,0.2)',  color:'#2dd4bf' },
  }[contact.contact_type] || { bg:'rgba(100,116,139,0.2)', color:'#94a3b8' }

  const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || 'Unnamed'

  let parsedNotes = {}
  try { parsedNotes = contact.notes ? JSON.parse(contact.notes) : {} } catch(e) {}
  const allPhones = parsedNotes.all_phones || []
  const allEmails = parsedNotes.all_emails || []
  const deadNumbers = new Set(parsedNotes.dead_numbers || [])

  const phonesSeen = new Set()
  const phoneListRaw = []
  if (contact.phone) { phonesSeen.add(contact.phone); phoneListRaw.push({ number: contact.phone, type: '' }) }
  allPhones.forEach(p => { if (p.number && !phonesSeen.has(p.number)) { phonesSeen.add(p.number); phoneListRaw.push(p) } })
  if (contact.secondary_phone && !phonesSeen.has(contact.secondary_phone)) { phoneListRaw.push({ number: contact.secondary_phone, type: 'alt' }) }
  // Sort: active numbers first, dead to bottom
  const phoneList = [
    ...phoneListRaw.filter(p => !deadNumbers.has(p.number)),
    ...phoneListRaw.filter(p => deadNumbers.has(p.number)),
  ]

  const emailsSeen = new Set()
  const emailList = []
  if (contact.email) { emailsSeen.add(contact.email); emailList.push(contact.email) }
  allEmails.forEach(e => { if (e && !emailsSeen.has(e)) { emailsSeen.add(e); emailList.push(e) } })

  return (
    <div style={{ border:'1px solid rgba(71,85,105,0.4)', borderRadius:10, overflow:'hidden', background:'rgba(15,23,42,0.4)' }}>

      {/* ── Header ── */}
      <div style={{ padding:'10px 12px', cursor:'pointer', background: expanded ? 'rgba(30,41,59,0.9)' : 'rgba(30,41,59,0.6)' }}
        onClick={() => setExpanded(!expanded)}>
        {/* Row 1: type badge + name + chevron */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0, flex:1 }}>
            <span style={{ padding:'2px 8px', borderRadius:4, fontSize:10, fontWeight:700, background:typeBadge.bg, color:typeBadge.color, flexShrink:0, whiteSpace:'nowrap' }}>
              {contact.contact_type || 'Contact'}
            </span>
            <span style={{ fontSize:14, fontWeight:600, color:'white', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{fullName}</span>
            {contact.is_primary && <span style={{ fontSize:10, color:'#f59e0b', flexShrink:0 }}>★</span>}
            {contact.do_not_contact && <span style={{ fontSize:10, color:'#f87171', fontWeight:700, flexShrink:0 }}>DNC</span>}
          </div>
          <span style={{ color:'#64748b', fontSize:11, flexShrink:0 }}>{expanded ? '▲' : '▼'}</span>
        </div>
        {/* Row 2: quick-tap actions */}
        <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:8, flexWrap:'wrap' }}>
          {contact.phone && !deadNumbers.has(contact.phone) && (
            <button onClick={e => { e.stopPropagation(); if(onCall) onCall(contact.phone, contact) }}
              style={{ display:'flex', alignItems:'center', gap:5, background:'rgba(16,185,129,0.12)', border:'1px solid rgba(16,185,129,0.3)', borderRadius:20, padding:'4px 12px', cursor:'pointer', color:'#34d399', fontSize:12 }}>
              <Phone size={12} /> {contact.phone}
            </button>
          )}
          {contact.email && (
            <button onClick={e => { e.stopPropagation(); if(onEmail) onEmail(contact) }}
              style={{ display:'flex', alignItems:'center', gap:5, background:'rgba(59,130,246,0.12)', border:'1px solid rgba(59,130,246,0.3)', borderRadius:20, padding:'4px 12px', cursor:'pointer', color:'#60a5fa', fontSize:12 }}>
              <Mail size={12} /> Email
            </button>
          )}
          {contact.phone && !deadNumbers.has(contact.phone) && (
            <button onClick={e => { e.stopPropagation(); alert('SMS integration coming soon — will open iMessage with pre-filled template.') }}
              style={{ display:'flex', alignItems:'center', gap:5, background:'rgba(100,116,139,0.12)', border:'1px solid rgba(100,116,139,0.3)', borderRadius:20, padding:'4px 10px', cursor:'pointer', color:'#94a3b8', fontSize:12 }}
              title="Text (coming soon)">
              💬
            </button>
          )}
          {contact.email && onContract && (
            <button onClick={e => { e.stopPropagation(); onContract(contact) }} title="Send Contract"
              style={{ background:'none', border:'none', cursor:'pointer', color:'#f59e0b', lineHeight:1, padding:0, display:'flex', alignItems:'center' }}>
              <FileText size={16} />
            </button>
          )}
        </div>
      </div>

      {/* ── Expanded body ── */}
      {expanded && (
        <div style={{ padding:'12px', borderTop:'1px solid rgba(71,85,105,0.3)', display:'flex', flexDirection:'column', gap:8 }}>

          {/* Phones — active first, dead at bottom grayed out */}
          {phoneList.length > 0 && (
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <div style={{ fontSize:10, color:'#475569', textTransform:'uppercase', letterSpacing:'0.06em' }}>Phone numbers</div>
              {phoneList.map((p, i) => {
                const isDead = deadNumbers.has(p.number)
                return (
                  <div key={p.number} style={{ display:'flex', alignItems:'center', gap:6, background: isDead ? 'rgba(30,41,59,0.3)' : 'rgba(16,185,129,0.08)', border:`1px solid ${isDead ? 'rgba(71,85,105,0.2)' : 'rgba(16,185,129,0.2)'}`, borderRadius:8, padding:'7px 10px', opacity: isDead ? 0.5 : 1 }}>
                    <Phone size={13} style={{ color: isDead ? '#475569' : '#34d399', flexShrink:0 }} />
                    <span style={{ fontSize:13, color: isDead ? '#64748b' : '#e2e8f0', flex:1, textDecoration: isDead ? 'line-through' : 'none' }}>{p.number}</span>
                    {p.type && p.type !== '' && <span style={{ fontSize:10, color:'#475569' }}>{p.type}</span>}
                    {isDead && <span style={{ fontSize:9, color:'#f87171', background:'rgba(239,68,68,0.1)', padding:'1px 5px', borderRadius:3, flexShrink:0 }}>Dead</span>}
                    {!isDead && (
                      <button onClick={() => onCall && onCall(p.number, contact)}
                        style={{ padding:'4px 10px', background:'rgba(34,197,94,0.15)', border:'1px solid rgba(34,197,94,0.3)', borderRadius:6, color:'#22c55e', fontSize:11, fontWeight:600, cursor:'pointer', flexShrink:0 }}>
                        Dial
                      </button>
                    )}
                    {/* Dead number toggle */}
                    <button
                      onClick={() => onMarkDead && onMarkDead(contact, p.number, !isDead)}
                      title={isDead ? 'Restore number' : 'Mark disconnected'}
                      style={{ padding:'4px 7px', background: isDead ? 'rgba(71,85,105,0.2)' : 'rgba(239,68,68,0.12)', border:`1px solid ${isDead ? 'rgba(71,85,105,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius:5, color: isDead ? '#64748b' : '#f87171', fontSize:11, cursor:'pointer', flexShrink:0, lineHeight:1 }}>
                      {isDead ? '↩' : '✕'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Emails */}
          {emailList.length > 0 && (
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <div style={{ fontSize:10, color:'#475569', textTransform:'uppercase', letterSpacing:'0.06em' }}>Emails</div>
              {emailList.map((email, i) => (
                <button key={i} onClick={() => onEmail && onEmail(contact, email)}
                  style={{ display:'flex', alignItems:'center', gap:10, background:'rgba(59,130,246,0.08)', border:'1px solid rgba(59,130,246,0.2)', borderRadius:8, padding:'8px 12px', cursor:'pointer', textAlign:'left', width:'100%' }}>
                  <Mail size={13} style={{ color:'#60a5fa', flexShrink:0 }} />
                  <span style={{ fontSize:12, color:'#e2e8f0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{email}</span>
                  <span style={{ fontSize:10, color:'#3b82f6', flexShrink:0 }}>Send →</span>
                </button>
              ))}
            </div>
          )}

          {contact.address && (
            <div style={{ display:'flex', alignItems:'flex-start', gap:8, fontSize:12, color:'#94a3b8' }}>
              <MapPin size={13} style={{ color:'#64748b', flexShrink:0, marginTop:1 }} />
              {[contact.address, contact.city, contact.state, contact.zip].filter(Boolean).join(', ')}
            </div>
          )}
          {contact.relationship && <div style={{ fontSize:11, color:'#64748b' }}>Relationship: {contact.relationship}</div>}

          {/* Action buttons */}
          <div style={{ display:'flex', gap:8, paddingTop:4, borderTop:'1px solid rgba(71,85,105,0.3)' }}>
            <button onClick={() => onEdit(contact)} style={{ flex:1, padding:'8px', background:'rgba(51,65,85,0.8)', border:'1px solid rgba(71,85,105,0.5)', borderRadius:8, color:'white', fontSize:12, cursor:'pointer' }}>Edit</button>
            {emailList.length > 0 && onEmail && (
              <button onClick={() => onEmail(contact)} style={{ flex:1, padding:'8px', background:'rgba(59,130,246,0.2)', border:'1px solid rgba(59,130,246,0.4)', borderRadius:8, color:'#60a5fa', fontSize:12, cursor:'pointer' }}>Send Email</button>
            )}
            {emailList.length > 0 && onContract && (
              <button onClick={() => onContract(contact)} style={{ flex:1, padding:'8px', background:'rgba(245,158,11,0.15)', border:'1px solid rgba(245,158,11,0.35)', borderRadius:8, color:'#fbbf24', fontSize:12, cursor:'pointer' }}>📄 Contract</button>
            )}
            {isAdmin && (
              <button onClick={() => onDelete(contact.id)} style={{ flex:1, padding:'8px', background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:8, color:'#f87171', fontSize:12, cursor:'pointer' }}>Delete</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}


// ─── Add/Edit Contact Modal ───────────────────────────────────────────────────
const ContactModal = ({ contact, onSave, onClose }) => {
  const [form, setForm] = useState({
    contact_type: contact?.contact_type || 'Owner',
    first_name: contact?.first_name || '',
    last_name: contact?.last_name || '',
    phone: contact?.phone || '',
    secondary_phone: contact?.secondary_phone || '',
    email: contact?.email || '',
    address: contact?.address || '',
    city: contact?.city || '',
    state: contact?.state || '',
    zip: contact?.zip || '',
    relationship: contact?.relationship || '',
    additional_info: contact?.additional_info || '',
    is_primary: contact?.is_primary || false,
    do_not_contact: contact?.do_not_contact || false,
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h3 className="text-white font-bold">{contact ? 'Edit Contact' : 'Add Contact'}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Type</label>
              <select value={form.contact_type} onChange={e => set('contact_type', e.target.value)} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white text-sm">
                {CONTACT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Relationship (optional)</label>
              <input value={form.relationship} onChange={e => set('relationship', e.target.value)} placeholder="e.g. son, managing member" className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">First Name</label>
              <input value={form.first_name} onChange={e => set('first_name', e.target.value)} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Last Name</label>
              <input value={form.last_name} onChange={e => set('last_name', e.target.value)} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Phone</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="(305) 000-0000" className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Alt Phone</label>
              <input value={form.secondary_phone} onChange={e => set('secondary_phone', e.target.value)} placeholder="(305) 000-0000" className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white text-sm" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-slate-400 mb-1 block">Email</label>
              <input value={form.email} onChange={e => set('email', e.target.value)} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white text-sm" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-slate-400 mb-1 block">Mailing Address</label>
              <input value={form.address} onChange={e => set('address', e.target.value)} placeholder="Street address" className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">City</label>
              <input value={form.city} onChange={e => set('city', e.target.value)} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">State</label>
                <input value={form.state} onChange={e => set('state', e.target.value.toUpperCase())} maxLength={2} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">ZIP</label>
                <input value={form.zip} onChange={e => set('zip', e.target.value)} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white text-sm" />
              </div>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-slate-400 mb-1 block">Notes</label>
              <textarea value={form.additional_info} onChange={e => set('additional_info', e.target.value)} rows={2} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white text-sm resize-none" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input type="checkbox" checked={form.is_primary} onChange={e => set('is_primary', e.target.checked)} className="w-4 h-4" />
              Primary Contact
            </label>
            <label className="flex items-center gap-2 text-sm text-red-400 cursor-pointer">
              <input type="checkbox" checked={form.do_not_contact} onChange={e => set('do_not_contact', e.target.checked)} className="w-4 h-4" />
              Do Not Contact
            </label>
          </div>
        </div>
        <div className="flex gap-3 p-4 border-t border-slate-700">
          <button onClick={() => onSave(form)} className="flex-1 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg font-semibold">Save</button>
          <button onClick={onClose} className="px-4 py-2 bg-slate-700 text-white rounded-lg">Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ─── Qualification Tab ────────────────────────────────────────────────────────
const QualificationTab = ({ lead }) => {
  const [liens, setLiens] = useState({ hud: '', irs: '', mortgage: '', utility: '', other: '' })
  const surplus = formatSurplus(lead.surplus) || 0
  const totalLiens = Object.values(liens).reduce((sum, v) => sum + (parseFloat(v) || 0), 0)
  const netSurplus = surplus - totalLiens

  const checks = [
    { label: 'Surplus amount ≥ $10,000', pass: surplus >= 10000 },
    { label: 'Net surplus after liens ≥ $10,000', pass: netSurplus >= 10000 },
    { label: 'No HUD / HECM reverse mortgage (verify)', pass: null },
    { label: 'No IRS federal tax lien (verify)', pass: null },
    { label: 'Surplus funds not yet disbursed (verify)', pass: null },
    { label: 'No surplus claim already filed (verify)', pass: null },
    { label: 'No motion to vacate sale pending (verify)', pass: null },
    { label: 'Owner contact info located', pass: null },
  ]

  return (
    <div className="space-y-4">
      <div className="bg-slate-900/50 border border-slate-700/30 rounded-lg p-4">
        <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-amber-400" /> Lien Calculator
        </h4>
        <div className="grid grid-cols-2 gap-3 mb-3">
          {[['hud', 'HUD / Gov Lien'], ['irs', 'IRS Tax Lien'], ['mortgage', 'Mortgage Balance'], ['utility', 'Utility Liens'], ['other', 'Other Liens']].map(([key, label]) => (
            <div key={key}>
              <label className="text-xs text-slate-400 mb-1 block">{label}</label>
              <input type="number" value={liens[key]} onChange={e => setLiens(l => ({ ...l, [key]: e.target.value }))} placeholder="0.00" className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-slate-700/30">
          <div className="p-2 bg-slate-800 rounded text-center">
            <p className="text-xs text-slate-400">Gross Surplus</p>
            <p className="text-emerald-400 font-bold">${surplus.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="p-2 bg-slate-800 rounded text-center">
            <p className="text-xs text-slate-400">Total Liens</p>
            <p className="text-red-400 font-bold">${totalLiens.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className={`p-2 rounded text-center ${netSurplus >= 10000 ? 'bg-emerald-500/20 border border-emerald-500/30' : 'bg-red-500/20 border border-red-500/30'}`}>
            <p className="text-xs text-slate-400">Net Surplus</p>
            <p className={`font-bold ${netSurplus >= 10000 ? 'text-emerald-400' : 'text-red-400'}`}>${netSurplus.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
      </div>
      <div className="bg-slate-900/50 border border-slate-700/30 rounded-lg p-4">
        <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-amber-400" /> Qualification Checklist
        </h4>
        <div className="space-y-2">
          {checks.map((c, i) => (
            <div key={i} className="flex items-center gap-3 p-2 bg-slate-800/50 rounded">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${c.pass === true ? 'bg-emerald-500/20 text-emerald-400' : c.pass === false ? 'bg-red-500/20 text-red-400' : 'bg-slate-600/50 text-slate-400'}`}>
                {c.pass === true ? '✓' : c.pass === false ? '✗' : '?'}
              </div>
              <span className={`text-sm ${c.pass === true ? 'text-emerald-300' : c.pass === false ? 'text-red-300' : 'text-slate-300'}`}>{c.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-slate-700/30">
          <p className="text-xs text-slate-400 mb-2 font-semibold uppercase tracking-wide">Final Decision</p>
          <div className="grid grid-cols-3 gap-2">
            <button className="py-2 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-lg text-sm font-semibold hover:bg-emerald-500/30">✓ Pursue</button>
            <button className="py-2 bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-lg text-sm font-semibold hover:bg-amber-500/30">⚠ Hold</button>
            <button className="py-2 bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg text-sm font-semibold hover:bg-red-500/30">✗ Skip</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Documents Tab ────────────────────────────────────────────────────────────
const DocumentsTab = ({ leadId, onSendContract, contacts }) => {
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [sendingContract, setSendingContract] = useState(null) // file being sent
  const fileRef = useRef()

  const loadFiles = async () => {
    const { data } = await supabase.from('lead_files').select('*').eq('lead_id', leadId).order('created_at', { ascending: false })
    setFiles(data || [])
  }

  useEffect(() => { loadFiles() }, [leadId])

  const uploadFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    try {
      const path = `leads/${leadId}/${Date.now()}_${file.name}`
      const { error: uploadError } = await supabase.storage.from('lead-files').upload(path, file)
      if (uploadError) throw uploadError
      await supabase.from('lead_files').insert({ lead_id: leadId, file_name: file.name, file_url: path, file_type: file.type })
      loadFiles()
    } catch (err) {
      alert('Upload failed: ' + err.message)
    }
    setUploading(false)
    e.target.value = ''
  }

  const openFile = async (path) => {
    try {
      const { data, error } = await supabase.storage.from('lead-files').createSignedUrl(path, 60)
      if (error) throw error
      window.open(data.signedUrl, '_blank')
    } catch (err) {
      alert('Could not open file: ' + err.message)
    }
  }

  const deleteFile = async (id, path) => {
    if (!window.confirm('Delete this file?')) return
    await supabase.storage.from('lead-files').remove([path])
    await supabase.from('lead_files').delete().eq('id', id)
    loadFiles()
  }

  const handleSendContract = async (f) => {
    try {
      // 7-day signed URL so recipient can download
      const { data, error } = await supabase.storage.from('lead-files').createSignedUrl(f.file_url, 60 * 60 * 24 * 7)
      if (error) throw error
      if (onSendContract) onSendContract({ file: f, signedUrl: data.signedUrl })
    } catch (err) {
      alert('Could not generate link: ' + err.message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-slate-400 text-sm">{files.length} file{files.length !== 1 ? 's' : ''} attached</p>
        <button onClick={() => fileRef.current?.click()} disabled={uploading} className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg text-sm font-semibold hover:from-amber-600 hover:to-orange-700 disabled:opacity-50">
          {uploading ? 'Uploading...' : '+ Upload File'}
        </button>
        <input ref={fileRef} type="file" className="hidden" onChange={uploadFile} />
      </div>
      {files.length === 0 ? (
        <div className="text-center py-12 bg-slate-900/50 border border-dashed border-slate-600 rounded-lg cursor-pointer hover:border-amber-500/50" onClick={() => fileRef.current?.click()}>
          <Folder className="w-10 h-10 text-slate-500 mx-auto mb-2" />
          <p className="text-slate-400 text-sm">No files yet — click to upload</p>
          <p className="text-slate-500 text-xs mt-1">Contracts, court docs, O&E reports, correspondence</p>
        </div>
      ) : (
        <div className="space-y-2">
          {files.map(f => (
            <div key={f.id} className="flex items-center justify-between p-3 bg-slate-900/50 border border-slate-700/30 rounded-lg">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <FileText className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <button onClick={() => openFile(f.file_url)} className="text-white text-sm hover:text-amber-400 truncate block text-left bg-transparent border-none cursor-pointer p-0">{f.file_name}</button>
                  <p className="text-slate-500 text-xs">{new Date(f.created_at).toLocaleDateString()}</p>
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0, marginLeft:8 }}>
                {/* Send Contract button — only show if Gmail connected and contacts exist */}
                {contacts && contacts.length > 0 && onSendContract && (
                  <button
                    onClick={() => handleSendContract(f)}
                    style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 10px', background:'rgba(59,130,246,0.15)', border:'1px solid rgba(59,130,246,0.35)', borderRadius:6, color:'#60a5fa', fontSize:11, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}
                  >
                    <Mail size={12} /> Send
                  </button>
                )}
                <button onClick={() => deleteFile(f.id, f.file_url)} className="text-red-400 hover:text-red-300 flex-shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Send Contract Modal ──────────────────────────────────────────────────────
const SendContractModal = ({ file, signedUrl, lead, contacts, user, onClose, onSent }) => {
  const emailContacts = contacts.filter(c => c.email && !c.do_not_contact)
  const [selectedContactId, setSelectedContactId] = useState(emailContacts[0]?.id || '')
  const [subject, setSubject] = useState(`Contract — Surplus Funds Recovery · ${lead?.property_address || 'Your Property'}`)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)

  const selectedContact = contacts.find(c => c.id === selectedContactId)
  const ownerName = selectedContact ? [selectedContact.first_name, selectedContact.last_name].filter(Boolean).join(' ') : 'Property Owner'
  const address = lead?.property_address || 'your property'
  const amount = lead?.surplus ? `$${parseFloat(String(lead.surplus).replace(/[$,]/g,'')).toLocaleString('en-US',{minimumFractionDigits:2})}` : 'the available amount'
  const sender = { name: user?.name || 'Rebound Capital Group', title: user?.role === 'admin' ? 'President' : 'Recovery Agent' }

  const bodyText = `Dear ${ownerName},

Thank you for speaking with us regarding the surplus funds connected to ${address}.

As discussed, please find your recovery agreement attached below. The approximate amount available for claim is ${amount}.

To review and sign your contract, please click the link below:

${signedUrl}

This link is valid for 7 days. Once signed, we will begin the formal filing process on your behalf.

If you have any questions please do not hesitate to reach out.`

  const handleSend = async () => {
    if (!selectedContact?.email) { setError('No email on selected contact'); return }
    setSending(true)
    setError(null)
    try {
      const htmlBody = buildHtmlEmail(bodyText, sender)
      await gmailSend({ to: selectedContact.email, subject, body: htmlBody })
      // Auto-log
      await supabase.from('notes').insert([{
        lead_id: lead.id,
        text: `📄 Contract sent to ${ownerName} (${selectedContact.email}) — File: ${file.file_name}`,
        note_type: 'Contract Sent',
        author: user?.name,
        created_at: new Date().toISOString()
      }])
      // Update status
      await supabase.from('leads').update({ status: 'Interested' }).eq('id', lead.id)
      onSent && onSent()
    } catch (err) {
      setError(err.message)
    }
    setSending(false)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'#1e293b', border:'1px solid rgba(71,85,105,0.5)', borderRadius:14, width:'100%', maxWidth:520, maxHeight:'90vh', overflow:'hidden', display:'flex', flexDirection:'column' }}>

        {/* Header */}
        <div style={{ padding:'14px 18px', borderBottom:'1px solid rgba(71,85,105,0.4)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <FileText size={15} style={{ color:'#f59e0b' }} />
            <span style={{ color:'white', fontWeight:600, fontSize:14 }}>Send Contract</span>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#64748b', cursor:'pointer' }}><X size={17} /></button>
        </div>

        <div style={{ padding:'16px 18px', overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:12 }}>

          {/* File being sent */}
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:8 }}>
            <FileText size={16} style={{ color:'#f59e0b', flexShrink:0 }} />
            <div>
              <div style={{ fontSize:13, color:'white', fontWeight:500 }}>{file.file_name}</div>
              <div style={{ fontSize:11, color:'#64748b' }}>7-day download link will be included</div>
            </div>
          </div>

          {/* Contact picker */}
          <div>
            <label style={{ fontSize:11, color:'#64748b', display:'block', marginBottom:5 }}>SEND TO</label>
            {emailContacts.length === 0 ? (
              <div style={{ padding:'10px', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:6, color:'#f87171', fontSize:12 }}>
                No contacts with email addresses on this lead. Add an email to a contact first.
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {emailContacts.map(c => {
                  const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Unnamed'
                  const selected = c.id === selectedContactId
                  return (
                    <button key={c.id} onClick={() => setSelectedContactId(c.id)}
                      style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', background: selected ? 'rgba(59,130,246,0.15)' : 'rgba(15,23,42,0.5)', border:`1px solid ${selected ? 'rgba(59,130,246,0.5)' : 'rgba(71,85,105,0.3)'}`, borderRadius:8, cursor:'pointer', textAlign:'left' }}>
                      <div style={{ width:8, height:8, borderRadius:'50%', background: selected ? '#60a5fa' : '#374151', flexShrink:0 }} />
                      <div>
                        <div style={{ fontSize:13, color:'white', fontWeight:500 }}>{name}</div>
                        <div style={{ fontSize:11, color:'#64748b' }}>{c.email} · {c.contact_type}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Subject */}
          <div>
            <label style={{ fontSize:11, color:'#64748b', display:'block', marginBottom:4 }}>SUBJECT</label>
            <input value={subject} onChange={e => setSubject(e.target.value)}
              style={{ width:'100%', padding:'8px 10px', background:'rgba(15,23,42,0.6)', border:'1px solid rgba(71,85,105,0.4)', borderRadius:6, color:'white', fontSize:13, boxSizing:'border-box' }} />
          </div>

          {/* Preview */}
          <div>
            <label style={{ fontSize:11, color:'#64748b', display:'block', marginBottom:4 }}>EMAIL PREVIEW</label>
            <div style={{ padding:'10px', background:'rgba(15,23,42,0.5)', border:'1px solid rgba(71,85,105,0.3)', borderRadius:6, fontSize:12, color:'#94a3b8', lineHeight:1.6, whiteSpace:'pre-wrap', maxHeight:160, overflowY:'auto' }}>{bodyText}</div>
          </div>

          {error && <div style={{ padding:'8px 12px', background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:6, color:'#f87171', fontSize:12 }}>{error}</div>}
          <div style={{ fontSize:11, color:'#475569' }}>Sending from: contact@reboundcapitalgroup.com · Status will update to Interested</div>
        </div>

        {/* Footer */}
        <div style={{ padding:'12px 18px', borderTop:'1px solid rgba(71,85,105,0.4)', display:'flex', gap:8 }}>
          <button onClick={handleSend} disabled={sending || emailContacts.length === 0}
            style={{ flex:1, padding:'10px', background: emailContacts.length === 0 ? '#1f2937' : 'linear-gradient(90deg,#3b82f6,#2563eb)', color:'white', border:'none', borderRadius:6, fontSize:13, fontWeight:600, cursor: emailContacts.length === 0 ? 'not-allowed' : 'pointer', opacity: sending ? 0.7 : 1 }}>
            {sending ? 'Sending...' : '📄 Send Contract'}
          </button>
          <button onClick={onClose} style={{ padding:'10px 18px', background:'rgba(51,65,85,0.8)', border:'1px solid rgba(71,85,105,0.5)', color:'white', borderRadius:6, fontSize:13, cursor:'pointer' }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}


const OverviewTab = ({
  leadContacts, selectedLead, user, isMobile, gmailConnected,
  handleEmailContact, handleCall, setEditingContact, setShowContactModal,
  deleteContact, note, setNote, noteType, setNoteType, addNote,
  editingNote, setEditingNote, editNoteText, setEditNoteText, updateNote, deleteNote,
  onContract, onMarkDead
}) => {
  const [notesOpen, setNotesOpen] = useState(false)
  const [addingNote, setAddingNote] = useState(false)
  const notes = selectedLead.notes || []

  return (
    <div style={{ flex:1, display:'flex', flexDirection: isMobile ? 'column' : 'row', overflow: isMobile ? 'visible' : 'hidden', minHeight:0 }}>

      {/* ── Contacts column ── */}
      <div style={{ flex:1, borderRight: isMobile ? 'none' : '1px solid rgba(71,85,105,0.3)', borderBottom: isMobile ? '1px solid rgba(71,85,105,0.3)' : 'none', display:'flex', flexDirection:'column', overflow: isMobile ? 'visible' : 'hidden', padding:'12px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10, flexShrink:0 }}>
          <span style={{ fontSize:11, fontWeight:600, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em' }}>
            Contacts ({leadContacts.length})
          </span>
          <button onClick={() => { setEditingContact(null); setShowContactModal(true) }}
            style={{ padding:'4px 12px', background:'linear-gradient(90deg,#f59e0b,#ea580c)', color:'white', border:'none', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer' }}>
            + Add
          </button>
        </div>

        <div style={{ flex:1, overflowY: isMobile ? 'visible' : 'auto', minHeight:0 }}>
          {leadContacts.length === 0 ? (
            <div style={{ border:'1px dashed rgba(71,85,105,0.5)', borderRadius:8, padding:'20px', textAlign:'center' }}>
              <User size={24} style={{ color:'#334155', margin:'0 auto 6px' }} />
              <div style={{ fontSize:12, color:'#64748b' }}>No contacts yet</div>
              <div style={{ fontSize:11, color:'#475569', marginTop:2 }}>Owner, relatives, attorneys, LLCs</div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {leadContacts.map(c => (
                <ContactCard key={c.id} contact={c} isAdmin={user?.role==='admin'}
                  onEdit={(contact) => { setEditingContact(contact); setShowContactModal(true) }}
                  onDelete={deleteContact}
                  onEmail={gmailConnected ? handleEmailContact : null}
                  onCall={handleCall}
                  onContract={onContract}
                  onMarkDead={onMarkDead} />
              ))}
            </div>
          )}
        </div>

        {/* Skip Trace */}
        <div style={{ flexShrink:0, marginTop:10, paddingTop:10, borderTop:'1px solid rgba(71,85,105,0.3)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
            <span style={{ fontSize:10, fontWeight:600, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em' }}>Skip Trace</span>
            <span style={{ fontSize:10, background:'rgba(30,41,59,0.8)', padding:'2px 7px', borderRadius:4, color:'#475569', border:'1px solid rgba(71,85,105,0.4)' }}>API soon</span>
          </div>
          <div style={{ border:'1px dashed rgba(71,85,105,0.4)', borderRadius:6, padding:'8px', textAlign:'center' }}>
            <Zap size={13} style={{ color:'#334155', margin:'0 auto 3px' }} />
            <div style={{ fontSize:10, color:'#475569' }}>Bulk API auto-populates contacts after each scrape</div>
          </div>
        </div>
      </div>

      {/* ── Notes column — minimized with expand ── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow: isMobile ? 'visible' : 'hidden', padding:'12px' }}>

        {/* Notes header — always visible, tappable to expand list */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, marginBottom: notesOpen ? 8 : 0 }}>
          <button onClick={() => setNotesOpen(o => !o)}
            style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none', cursor:'pointer', padding:0 }}>
            <span style={{ fontSize:11, fontWeight:600, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em' }}>
              Notes
            </span>
            <span style={{ fontSize:11, background: notes.length > 0 ? 'rgba(245,158,11,0.2)' : 'rgba(71,85,105,0.3)', color: notes.length > 0 ? '#fbbf24' : '#64748b', borderRadius:10, padding:'1px 7px', fontSize:10, fontWeight:600 }}>
              {notes.length}
            </span>
            <span style={{ fontSize:10, color:'#475569' }}>{notesOpen ? '▲' : '▼'}</span>
          </button>
          <button onClick={() => setAddingNote(o => !o)}
            style={{ padding:'3px 10px', background: addingNote ? 'rgba(245,158,11,0.2)' : 'rgba(51,65,85,0.6)', border:`1px solid ${addingNote ? 'rgba(245,158,11,0.4)' : 'rgba(71,85,105,0.4)'}`, borderRadius:6, color: addingNote ? '#fbbf24' : '#94a3b8', fontSize:11, cursor:'pointer' }}>
            {addingNote ? '✕ Cancel' : '+ Note'}
          </button>
        </div>

        {/* Quick last note preview when collapsed */}
        {!notesOpen && notes.length > 0 && (
          <div onClick={() => setNotesOpen(true)}
            style={{ padding:'7px 10px', background:'rgba(30,41,59,0.5)', borderRadius:6, border:'1px solid rgba(71,85,105,0.25)', cursor:'pointer', marginTop:6 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
              <span style={{ fontSize:10, color:'#64748b' }}>{notes[0].author}</span>
              <span style={{ fontSize:10, color:'#475569' }}>{new Date(notes[0].created_at).toLocaleDateString()}</span>
            </div>
            <div style={{ fontSize:11, color:'#94a3b8', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{notes[0].text}</div>
            {notes.length > 1 && <div style={{ fontSize:10, color:'#475569', marginTop:3 }}>+{notes.length - 1} more — tap to expand</div>}
          </div>
        )}
        {!notesOpen && notes.length === 0 && (
          <div style={{ fontSize:11, color:'#475569', marginTop:6 }}>No notes yet</div>
        )}

        {/* Expanded notes list */}
        {notesOpen && (
          <div style={{ flex:1, overflowY: isMobile ? 'visible' : 'auto', minHeight:0, display:'flex', flexDirection:'column', gap:5 }}>
            {notes.map(n => (
              <div key={n.id} style={{ padding:'7px 10px', background:'rgba(30,41,59,0.6)', borderRadius:6, border:'1px solid rgba(71,85,105,0.3)' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:3 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                    <span style={{ fontSize:10, color:'#64748b' }}>{n.author}</span>
                    {n.note_type && n.note_type !== 'General Note' && (
                      <span style={{ padding:'1px 6px', background:'rgba(245,158,11,0.2)', color:'#fbbf24', borderRadius:8, fontSize:9, fontWeight:500 }}>{n.note_type}</span>
                    )}
                  </div>
                  <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                    <span style={{ fontSize:9, color:'#475569' }}>{new Date(n.created_at).toLocaleDateString()}</span>
                    <button onClick={() => { setEditingNote(n.id); setEditNoteText(n.text) }} style={{ fontSize:10, color:'#f59e0b', background:'none', border:'none', cursor:'pointer', padding:0 }}>Edit</button>
                    <button onClick={() => deleteNote(n.id)} style={{ fontSize:10, color:'#f87171', background:'none', border:'none', cursor:'pointer', padding:0 }}>Del</button>
                  </div>
                </div>
                {editingNote === n.id ? (
                  <div>
                    <textarea value={editNoteText} onChange={e => setEditNoteText(e.target.value)} rows={2}
                      style={{ width:'100%', padding:'5px 8px', background:'#0f172a', border:'1px solid #475569', borderRadius:4, color:'white', fontSize:12, resize:'none', fontFamily:'inherit', boxSizing:'border-box' }} />
                    <div style={{ display:'flex', gap:5, marginTop:3 }}>
                      <button onClick={() => updateNote(n.id, editNoteText)} style={{ padding:'3px 10px', background:'#f59e0b', color:'white', border:'none', borderRadius:4, fontSize:11, cursor:'pointer' }}>Save</button>
                      <button onClick={() => { setEditingNote(null); setEditNoteText('') }} style={{ padding:'3px 10px', background:'#334155', color:'white', border:'none', borderRadius:4, fontSize:11, cursor:'pointer' }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize:12, color:'white', lineHeight:1.4 }}>{n.text}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add note — compact, shown when + Note tapped */}
        {addingNote && (
          <div style={{ flexShrink:0, marginTop:8, padding:'10px', background:'rgba(15,23,42,0.6)', borderRadius:8, border:'1px solid rgba(71,85,105,0.4)' }}>
            <select value={noteType} onChange={e => setNoteType(e.target.value)}
              style={{ width:'100%', padding:'6px 8px', background:'rgba(30,41,59,0.8)', border:'1px solid #475569', color:'white', borderRadius:6, fontSize:12, marginBottom:6, boxSizing:'border-box' }}>
              {NOTE_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Add note..." rows={2}
              style={{ width:'100%', padding:'7px 10px', background:'rgba(30,41,59,0.8)', border:'1px solid #475569', color:'white', borderRadius:6, fontSize:12, resize:'none', fontFamily:'inherit', boxSizing:'border-box' }} />
            <button onClick={() => { addNote(); setAddingNote(false); setNotesOpen(true) }}
              style={{ marginTop:6, width:'100%', padding:'8px', background:'linear-gradient(90deg,#f59e0b,#ea580c)', color:'white', border:'none', borderRadius:6, fontSize:13, fontWeight:600, cursor:'pointer' }}>
              Add Note
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const TELEGRAM_TOKEN = '8663455405:AAE_GLqQQpPZcggWpC7QzPtN4JE5u7jEje4'
  const TELEGRAM_CHAT_ID = '1505862740'

  const sendTelegram = async (message) => {
    try {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: 'HTML' })
      })
    } catch (err) { console.error('Telegram failed:', err) }
  }

  const [user, setUser] = useState(null)
  const [leads, setLeads] = useState([])
  const [users, setUsers] = useState([])
  const [view, setView] = useState('login')
  const [selectedLead, setSelectedLead] = useState(null)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ status: 'all', type: 'all', county: 'all', state: 'all' })
  const [note, setNote] = useState('')
  const [noteType, setNoteType] = useState('General Note')
  const [loading, setLoading] = useState(false)
  const [uploadText, setUploadText] = useState('')
  const [leadContacts, setLeadContacts] = useState([])
  const [selectedLeads, setSelectedLeads] = useState([])
  const [sortBy, setSortBy] = useState('date')
  const [sortOrder, setSortOrder] = useState('desc')
  const [editingNote, setEditingNote] = useState(null)
  const [editNoteText, setEditNoteText] = useState('')
  const [newUser, setNewUser] = useState({ name: '', username: '', password: '', role: 'user' })
  const [activeTab, setActiveTab] = useState('qualification')
  const [showContactModal, setShowContactModal] = useState(false)
  const [editingContact, setEditingContact] = useState(null)
  const [gmailConnected, setGmailConnected] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [emailContact, setEmailContact] = useState(null)
  const [showDialer, setShowDialer] = useState(false)
  const [dialerPhone, setDialerPhone] = useState('')
  const [dialerContact, setDialerContact] = useState(null)
  const [contactedLeadIds, setContactedLeadIds] = useState(new Set())
  const [showPhonePanel, setShowPhonePanel] = useState(false)
  const [showPowerLists, setShowPowerLists] = useState(false)
  const [showContractModal, setShowContractModal] = useState(false)
  const [contractContact, setContractContact] = useState(null) // single contact for contract
  const [detailLeadList, setDetailLeadList] = useState([]) // filtered list when entering detail view
  const [detailLeadIndex, setDetailLeadIndex] = useState(0) // current position in that list

  useEffect(() => {
    gmailCheckConnection().then(setGmailConnected)
  }, [])

  useEffect(() => { if (user) loadData() }, [user])

  useEffect(() => {
    if (!user || user?.role === 'admin') return
    const style = document.createElement('style')
    style.innerHTML = `* { -webkit-user-select: none !important; user-select: none !important; } input, textarea { -webkit-user-select: text !important; user-select: text !important; }`
    document.head.appendChild(style)
    const blockContext = (e) => e.preventDefault()
    const blockCopy = (e) => e.preventDefault()
    document.addEventListener('contextmenu', blockContext)
    document.addEventListener('copy', blockCopy)
    let screenshotAttempts = 0
    const handleScreenshot = async () => {
      screenshotAttempts++
      navigator.clipboard.writeText('')
      if (screenshotAttempts === 1) { alert('⚠️ SECURITY ALERT ⚠️\n\nScreenshot detected! Admin has been notified.\n\nUser: ' + user.name + '\n' + new Date().toLocaleString()); await sendTelegram(`📸 <b>SCREENSHOT ATTEMPT</b>\n👤 User: ${user.name} (@${user.username})\n🕐 Time: ${new Date().toLocaleString()}`) }
      else if (screenshotAttempts >= 2) { await sendTelegram(`📸 <b>SCREENSHOT #${screenshotAttempts}</b>\n👤 User: ${user.name} (@${user.username})\n🕐 Time: ${new Date().toLocaleString()}`) }
    }
    const handleKeyUp = (e) => { if (e.key === 'PrintScreen') handleScreenshot() }
    const handleKeyDown = async (e) => {
      if (e.ctrlKey && e.shiftKey && ['I','J','C'].includes(e.key)) { e.preventDefault(); await sendTelegram(`🔧 DEV TOOLS\n👤 ${user.name}\n🕐 ${new Date().toLocaleString()}`); return false }
      if (e.key === 'F12') { e.preventDefault(); await sendTelegram(`🔧 F12\n👤 ${user.name}`); return false }
    }
    document.addEventListener('keyup', handleKeyUp)
    document.addEventListener('keydown', handleKeyDown)
    const clipboardInterval = setInterval(() => { navigator.clipboard.writeText('') }, 1000)
    return () => {
      document.head.removeChild(style)
      document.removeEventListener('contextmenu', blockContext)
      document.removeEventListener('copy', blockCopy)
      document.removeEventListener('keyup', handleKeyUp)
      document.removeEventListener('keydown', handleKeyDown)
      clearInterval(clipboardInterval)
    }
  }, [user])

  const loadData = async () => {
    setLoading(true)
    try {
      let allLeads = [], from = 0
      while (true) {
        const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false }).range(from, from + 999)
        if (error) throw error
        if (!data || data.length === 0) break
        allLeads = [...allLeads, ...data]
        if (data.length < 1000) break
        from += 1000
      }
      const processed = allLeads.map(l => {
        if (l.surplus && l.status === 'New') {
          const raw = parseFloat(String(l.surplus).replace(/[$,]/g, ''))
          if (!isNaN(raw) && raw < 0) {
            supabase.from('leads').update({ status: 'Dead' }).eq('id', l.id)
            return { ...l, status: 'Dead' }
          }
        }
        return l
      })
      setLeads(processed)
      // Fetch which leads have contacts for indicator in list
      try {
        const { data: contactLeads } = await supabase.from('contacts').select('lead_id')
        if (contactLeads) setContactedLeadIds(new Set(contactLeads.map(c => c.lead_id)))
      } catch {}
      const { data: usersData } = await supabase.from('users').select('*')
      if (usersData) setUsers(usersData)
    } catch (err) { console.error('Error loading data:', err) }
    setLoading(false)
  }

  const loadNotes = async (leadId) => {
    try {
      const { data } = await supabase.from('notes').select('*').eq('lead_id', leadId).order('created_at', { ascending: false })
      return data || []
    } catch { return [] }
  }

  const loadContacts = async (leadId) => {
    try {
      const { data } = await supabase.from('contacts').select('*').eq('lead_id', String(leadId)).order('is_primary', { ascending: false })
      return data || []
    } catch { return [] }
  }

  const saveContactModal = async (formData) => {
    if (!selectedLead?.id) return
    if (!formData.first_name?.trim() && !formData.last_name?.trim()) { alert('Enter at least a name'); return }
    const contactData = {
      lead_id: String(selectedLead.id),
      contact_type: formData.contact_type || 'Owner',
      first_name: formData.first_name?.trim() || null,
      last_name: formData.last_name?.trim() || null,
      phone: formData.phone?.trim() || null,
      secondary_phone: formData.secondary_phone?.trim() || null,
      email: formData.email?.trim() || null,
      address: formData.address?.trim() || null,
      city: formData.city?.trim() || null,
      state: formData.state?.trim()?.toUpperCase() || null,
      zip: formData.zip?.trim() || null,
      relationship: formData.relationship?.trim() || null,
      additional_info: formData.additional_info?.trim() || null,
      is_primary: formData.is_primary || false,
      do_not_contact: formData.do_not_contact || false,
      updated_at: new Date().toISOString()
    }
    if (editingContact?.id) {
      await supabase.from('contacts').update(contactData).eq('id', editingContact.id)
    } else {
      await supabase.from('contacts').insert([{ ...contactData, created_at: new Date().toISOString() }])
    }
    const updated = await loadContacts(selectedLead.id)
    setLeadContacts(updated)
    setShowContactModal(false)
    setEditingContact(null)
  }

  const handleEmailContact = (contact, specificEmail = null) => {
    setEmailContact(contact)
    setShowEmailModal(true)
  }

  const deleteContact = async (contactId) => {
    if (!window.confirm('Delete this contact?')) return
    await supabase.from('contacts').delete().eq('id', contactId)
    const updated = await loadContacts(selectedLead.id)
    setLeadContacts(updated)
  }

  const handleEmailSent = async ({ to, subject }) => {
    setShowEmailModal(false)
    // Auto-log as note
    try {
      await supabase.from('notes').insert([{
        lead_id: selectedLead.id,
        text: `Email sent to ${to}\nSubject: ${subject}`,
        note_type: 'Email Sent',
        author: user.name,
        created_at: new Date().toISOString()
      }])
      const notes = await loadNotes(selectedLead.id)
      setSelectedLead({ ...selectedLead, notes })
    } catch (err) {
      console.error('Failed to log email note:', err)
    }
  }

  const handleCall = (phone, contact) => {
    setDialerPhone(phone)
    setDialerContact(contact)
    setShowDialer(true)
  }

  const markNumberDead = async (contact, phoneNumber, isDead) => {
    // Store dead number flags in contact.notes JSON under dead_numbers array
    let parsedNotes = {}
    try { parsedNotes = contact.notes ? JSON.parse(contact.notes) : {} } catch(e) {}
    const deadNums = new Set(parsedNotes.dead_numbers || [])
    if (isDead) deadNums.add(phoneNumber)
    else deadNums.delete(phoneNumber)
    const updatedNotes = JSON.stringify({ ...parsedNotes, dead_numbers: [...deadNums] })
    await supabase.from('contacts').update({ notes: updatedNotes }).eq('id', contact.id)
    const updated = await loadContacts(selectedLead.id)
    setLeadContacts(updated)
    // Log note
    await supabase.from('notes').insert({ lead_id: selectedLead.id, text: `📵 Number ${phoneNumber} marked as ${isDead ? 'disconnected' : 'active'} — ${user?.name}`, note_type: 'General Note', author: user?.name, created_at: new Date().toISOString() })
    const notes = await loadNotes(selectedLead.id)
    setSelectedLead(prev => ({ ...prev, notes }))
  }

  const login = async (e) => {
    e.preventDefault()
    const form = new FormData(e.target)
    const { data } = await supabase.from('users').select('*').eq('username', form.get('username')).eq('password', form.get('password')).single()
    if (data) { setUser(data); loadData(); setView('dashboard'); sendTelegram(`🔐 <b>LOGIN</b>\n👤 ${data.name} (@${data.username})\n🕐 ${new Date().toLocaleString()}`) }
    else alert('Invalid credentials')
  }

  const logout = () => { setUser(null); setView('login'); setSelectedLead(null); setLeadContacts([]) }

  const updateStatus = async (id, status) => {
    try {
      await supabase.from('leads').update({ status, last_modified: new Date().toISOString() }).eq('id', id)
      setLeads(leads.map(l => l.id === id ? { ...l, status } : l))
      if (selectedLead?.id === id) setSelectedLead({ ...selectedLead, status })
    } catch { alert('Failed to update status') }
  }

  const createUser = async () => {
    if (!newUser.name.trim() || !newUser.username.trim() || !newUser.password.trim()) { alert('Fill all fields'); return }
    try {
      await supabase.from('users').insert([{ id: 'user_' + Date.now(), name: newUser.name.trim(), username: newUser.username.trim().toLowerCase(), password: newUser.password.trim(), role: newUser.role }])
      setNewUser({ name: '', username: '', password: '', role: 'user' })
      const { data } = await supabase.from('users').select('*')
      setUsers(data || [])
      alert('User created!')
    } catch (err) { alert('Failed: ' + err.message) }
  }

  const deleteUser = async (id) => {
    if (!window.confirm('Delete user?')) return
    await supabase.from('users').delete().eq('id', id)
    setUsers(users.filter(u => u.id !== id))
  }

  const deleteLead = async (id) => {
    await supabase.from('leads').delete().eq('id', id)
    setLeads(leads.filter(l => l.id !== id))
  }

  const bulkDeleteLeads = async (ids) => {
    if (!ids.length) return
    const batchSize = 100
    for (let i = 0; i < ids.length; i += batchSize) {
      await supabase.from('leads').delete().in('id', ids.slice(i, i + batchSize))
    }
    setLeads(leads.filter(l => !ids.includes(l.id)))
    setSelectedLeads([])
    alert(`Deleted ${ids.length} leads!`)
  }

  const addNote = async () => {
    if (!note.trim() || !selectedLead) return
    try {
      await supabase.from('notes').insert([{ lead_id: selectedLead.id, text: note, note_type: noteType, author: user.name, created_at: new Date().toISOString() }])
      setNote('')
      const notes = await loadNotes(selectedLead.id)
      setSelectedLead({ ...selectedLead, notes })
    } catch { alert('Failed to add note') }
  }

  const updateNote = async (noteId, newText) => {
    if (!newText.trim()) return
    await supabase.from('notes').update({ text: newText }).eq('id', noteId)
    const notes = await loadNotes(selectedLead.id)
    setSelectedLead({ ...selectedLead, notes })
    setEditingNote(null)
    setEditNoteText('')
  }

  const deleteNote = async (noteId) => {
    if (!window.confirm('Delete note?')) return
    await supabase.from('notes').delete().eq('id', noteId)
    const notes = await loadNotes(selectedLead.id)
    setSelectedLead({ ...selectedLead, notes })
  }

  const uploadLeads = async () => {
    if (!uploadText.trim()) return alert('Paste JSON data')
    try {
      const data = JSON.parse(uploadText)
      const formatted = data.map(l => ({
        id: l.id, case_number: l.caseNumber, county: l.county, lead_type: l.leadType,
        auction_date: l.auctionDate, property_address: l.propertyAddress, property_city: l.propertyCity,
        property_zip: l.propertyZip, assessed_value: l.assessedValue, judgment_amount: l.judgmentAmount,
        sold_amount: l.soldAmount, surplus: l.surplus, defendants: l.defendants, plaintiffs: l.plaintiffs,
        parcel_id: l.parcelId, case_url: l.caseUrl, zillow_url: l.zillowUrl,
        property_appraiser_url: l.propertyAppraiserUrl, final_judgment_url: l.finalJudgmentUrl,
        clerk_of_courts_url: l.clerkOfCourtsUrl, street_map_url: l.streetMapUrl,
        satellite_url: l.satelliteUrl, status: l.status || 'New'
      }))
      await supabase.from('leads').upsert(formatted)
      loadData(); setUploadText(''); alert(`Uploaded ${data.length} leads!`)
    } catch { alert('Invalid JSON or upload failed') }
  }

  const exportData = () => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `leads_${new Date().toISOString().split('T')[0]}.json`; a.click()
  }

  const viewLead = async (lead, listContext = null, indexInList = 0) => {
    try {
      const [notes, contacts] = await Promise.all([loadNotes(lead.id), loadContacts(lead.id)])
      setSelectedLead({ ...lead, notes })
      setLeadContacts(contacts)
      setActiveTab('overview')
      setDetailLeadList(listContext || sortedFiltered)
      setDetailLeadIndex(listContext ? indexInList : sortedFiltered.findIndex(l => l.id === lead.id))
      setView('detail')
      if (user?.role !== 'admin') sendTelegram(`👁 <b>LEAD VIEWED</b>\n👤 ${user.name}\n🏠 ${lead.property_address || 'N/A'}\n📋 ${lead.case_number || 'N/A'}\n💰 ${lead.surplus || 'N/A'}\n🕐 ${new Date().toLocaleString()}`)
    } catch { alert('Error loading lead') }
  }

  const navigateDetail = async (direction) => {
    const newIdx = detailLeadIndex + direction
    if (newIdx < 0 || newIdx >= detailLeadList.length) return
    const lead = detailLeadList[newIdx]
    const [notes, contacts] = await Promise.all([loadNotes(lead.id), loadContacts(lead.id)])
    setSelectedLead({ ...lead, notes })
    setLeadContacts(contacts)
    setDetailLeadIndex(newIdx)
    setActiveTab('overview')
  }

  // ── Filters ──
  const filtered = leads.filter(l => {
    if (filters.status !== 'all' && l.status !== filters.status) return false
    if (filters.type !== 'all') {
      const lt = (l.lead_type || '').toUpperCase().replace('_', ' ').trim()
      if (filters.type === 'Surplus' && l.status !== 'Surplus') return false
      else if (filters.type === 'Future Auction') {
        if (!l.auction_date) return false
        const today = new Date(); today.setHours(0, 0, 0, 0)
        const d = parseAuctionDate(l.auction_date)
        if (!d || isNaN(d.getTime()) || d < today) return false
      } else if (filters.type === 'Foreclosure' && lt !== 'FORECLOSURE') return false
      else if (filters.type === 'Tax Deed' && !['TAXDEED', 'TAX DEED'].includes(lt)) return false
    }
    // ── FIXED: county filter uses normalized value correctly ──
    if (filters.county !== 'all') {
      if (normalizeCounty(l.county) !== filters.county) return false
    }
    if (filters.state !== 'all') {
      const county = l.county || ''
      if (county.includes('-')) {
        if (county.split('-')[0].trim().toUpperCase() !== filters.state) return false
      } else return false
    }
    if (search) {
      const s = search.toLowerCase()
      return (l.case_number?.toLowerCase().includes(s)) || (l.property_address?.toLowerCase().includes(s)) || (l.county?.toLowerCase().includes(s)) || (l.defendants?.toLowerCase().includes(s))
    }
    return true
  })

  const sortedFiltered = [...filtered].sort((a, b) => {
    if (sortBy === 'date') {
      const dA = parseAuctionDate(a.auction_date) || new Date(0)
      const dB = parseAuctionDate(b.auction_date) || new Date(0)
      return sortOrder === 'desc' ? dB - dA : dA - dB
    }
    if (sortBy === 'surplus') {
      const sA = parseFloat((a.surplus || '0').replace(/[$,]/g, '')) || 0
      const sB = parseFloat((b.surplus || '0').replace(/[$,]/g, '')) || 0
      return sortOrder === 'desc' ? sB - sA : sA - sB
    }
    return 0
  })

  const stats = {
    total: leads.length,
    new: leads.filter(l => l.status === 'New').length,
    contacted: leads.filter(l => l.status === 'Contacted').length,
    interested: leads.filter(l => l.status === 'Interested').length,
    surplus: leads.filter(l => l.status === 'Surplus').length,
    future: leads.filter(l => { const d = parseAuctionDate(l.auction_date); const t = new Date(); t.setHours(0,0,0,0); return d && !isNaN(d) && d >= t }).length,
    totalSurplus: Math.round(leads.reduce((sum, l) => { if (l.surplus && l.status !== 'Dead') { const a = parseFloat(String(l.surplus).replace(/[$,]/g, '')) || 0; return sum + (a > 0 ? a : 0) } return sum }, 0) * 100) / 100
  }

  // ── FIXED: consistent county normalization for dropdown ──
  const counties = [...new Set(leads.map(l => normalizeCounty(l.county)).filter(Boolean))].sort()
  const states = [...new Set(leads.map(l => { const c = l.county || ''; if (c.includes('-')) { const s = c.split('-')[0].trim(); if (s.length === 2) return s.toUpperCase() } return null }).filter(Boolean))].sort()

  const isTaxDeed = ['TAXDEED', 'TAX DEED'].includes((selectedLead?.lead_type || '').toUpperCase())
  const surplusNum = formatSurplus(selectedLead?.surplus) || 0

  // ── Views ──
  const isMobile = useIsMobile()

  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><div className="text-amber-400 text-xl">Loading...</div></div>

  if (view === 'login') return <LoginPage onLogin={login} />

  if (view === 'admin') return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="bg-slate-800/50 border-b border-slate-700/50 px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <button onClick={() => setView('dashboard')} className="text-slate-400 hover:text-white">← Back</button>
          <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
          <button onClick={logout} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg flex items-center gap-2"><LogOut className="w-4 h-4" /> Logout</button>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Upload className="w-5 h-5 text-amber-400" /> Upload Leads</h2>
          <textarea value={uploadText} onChange={e => setUploadText(e.target.value)} placeholder='Paste JSON: [{"id":"LEAD_00001",...}]' className="w-full h-64 px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-amber-500" />
          <button onClick={uploadLeads} className="mt-4 px-6 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg font-semibold">Upload</button>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><UsersIcon className="w-5 h-5 text-amber-400" /> Users</h2>
          <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-4 mb-6">
            <h3 className="text-white font-semibold mb-3">Create New User</h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div><label className="text-xs text-slate-400 mb-1 block">Full Name</label><input value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} placeholder="John Smith" className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm" /></div>
              <div><label className="text-xs text-slate-400 mb-1 block">Username</label><input value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} placeholder="johnsmith" className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm" /></div>
              <div><label className="text-xs text-slate-400 mb-1 block">Password</label><input value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm" /></div>
              <div><label className="text-xs text-slate-400 mb-1 block">Role</label><select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"><option value="user">Agent</option><option value="admin">Admin</option></select></div>
            </div>
            <button onClick={createUser} className="px-6 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg font-semibold">Create User</button>
          </div>
          <div className="space-y-3">
            {users.map(u => (
              <div key={u.id} className="flex items-center justify-between p-4 bg-slate-900/30 rounded-lg">
                <div><p className="text-white font-medium">{u.name}</p><p className="text-slate-400 text-sm">@{u.username} • {u.role}</p></div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${u.role === 'admin' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>{u.role.toUpperCase()}</span>
                  {u.id !== user.id && <button onClick={() => deleteUser(u.id)} className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded"><Trash2 className="w-4 h-4" /></button>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )

  // ── Detail View ──────────────────────────────────────────────────────────────
  if (view === 'detail' && selectedLead) {
    const tabs = [
      { id: 'overview', label: 'Overview' },
      { id: 'documents', label: 'Documents' },
    ]

    return (
      <div style={{ height:'100vh', overflow:'hidden', display:'flex', flexDirection:'column', background:'#0f172a' }}>
        {showContactModal && (
          <ContactModal contact={editingContact} onSave={saveContactModal} onClose={() => { setShowContactModal(false); setEditingContact(null) }} />
        )}
        {showEmailModal && emailContact && (
          <SendEmailModal contact={emailContact} lead={selectedLead} user={user} allContacts={leadContacts} onClose={() => setShowEmailModal(false)} onSent={handleEmailSent} />
        )}
        {showContractModal && (
          <ContractModal
            lead={selectedLead}
            contact={contractContact || leadContacts.find(c => c.is_primary) || leadContacts[0]}
            user={user}
            onClose={() => { setShowContractModal(false); setContractContact(null) }}
            onSent={async ({ to, subject }) => {
              setShowContractModal(false); setContractContact(null)
              // Auto-log note
              try {
                await supabase.from('notes').insert([{
                  lead_id: selectedLead.id,
                  text: `📄 Contract sent to ${to} — ${subject}`,
                  note_type: 'Contract Sent',
                  author: user?.name,
                  created_at: new Date().toISOString()
                }])
                await supabase.from('leads').update({ status: 'Interested' }).eq('id', selectedLead.id)
                const notes = await loadNotes(selectedLead.id)
                setSelectedLead(prev => ({ ...prev, notes, status: 'Interested' }))
              } catch(e) { console.error(e) }
            }}
          />
        )}
        {showDialer && dialerContact && (
          <DialerModal phoneNumber={dialerPhone} contact={dialerContact} lead={selectedLead} user={user}
            onClose={() => { setShowDialer(false); loadNotes(selectedLead.id).then(notes => setSelectedLead(prev => ({ ...prev, notes }))) }}
            onCallLogged={() => loadNotes(selectedLead.id).then(notes => setSelectedLead(prev => ({ ...prev, notes })))}
          />
        )}

        {/* ── Top Header Bar ── */}
        <div style={{ flexShrink:0, background:'rgba(30,41,59,0.9)', borderBottom:'1px solid rgba(71,85,105,0.4)', padding: isMobile ? '8px 14px' : '8px 20px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap: isMobile ? 6 : 10 }}>
            <button onClick={() => setView('dashboard')} style={{ background:'none', border:'none', color:'#94a3b8', cursor:'pointer', fontSize: isMobile ? 14 : 13, display:'flex', alignItems:'center', gap:4 }}>
              ← {isMobile ? '' : 'Back'}
            </button>
            {/* Next/Prev navigation */}
            {detailLeadList.length > 1 && (
              <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                <button onClick={() => navigateDetail(-1)} disabled={detailLeadIndex === 0}
                  style={{ padding:'4px 8px', background: detailLeadIndex === 0 ? 'rgba(51,65,85,0.3)' : 'rgba(51,65,85,0.8)', border:'1px solid rgba(71,85,105,0.4)', color: detailLeadIndex === 0 ? '#475569' : '#94a3b8', borderRadius:6, fontSize:12, cursor: detailLeadIndex === 0 ? 'not-allowed' : 'pointer' }}>
                  ‹
                </button>
                <span style={{ fontSize:11, color:'#64748b', minWidth:50, textAlign:'center' }}>
                  {detailLeadIndex + 1} / {detailLeadList.length}
                </span>
                <button onClick={() => navigateDetail(1)} disabled={detailLeadIndex === detailLeadList.length - 1}
                  style={{ padding:'4px 8px', background: detailLeadIndex === detailLeadList.length - 1 ? 'rgba(51,65,85,0.3)' : 'rgba(51,65,85,0.8)', border:'1px solid rgba(71,85,105,0.4)', color: detailLeadIndex === detailLeadList.length - 1 ? '#475569' : '#94a3b8', borderRadius:6, fontSize:12, cursor: detailLeadIndex === detailLeadList.length - 1 ? 'not-allowed' : 'pointer' }}>
                  ›
                </button>
              </div>
            )}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap: isMobile ? 6 : 10 }}>
            {!isMobile && (!gmailConnected ? (
              <button onClick={gmailConnect} style={{ padding:'5px 10px', background:'rgba(59,130,246,0.2)', border:'1px solid rgba(59,130,246,0.4)', color:'#60a5fa', borderRadius:6, fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>
                <Mail size={13} /> Connect Gmail
              </button>
            ) : (
              <div style={{ padding:'4px 10px', background:'rgba(16,185,129,0.15)', border:'1px solid rgba(16,185,129,0.3)', color:'#34d399', borderRadius:6, fontSize:11, display:'flex', alignItems:'center', gap:4 }}>
                <Mail size={12} /> Gmail
              </div>
            ))}
            <select value={selectedLead.status} onChange={e => updateStatus(selectedLead.id, e.target.value)}
              style={{ padding: isMobile ? '5px 8px' : '5px 10px', background:'#334155', border:'1px solid #475569', color:'white', borderRadius:6, fontSize: isMobile ? 12 : 13, cursor:'pointer' }}>
              <option>New</option><option>Contacted</option><option>Interested</option><option>Not Interested</option><option value="Surplus">Surplus</option><option>Dead</option>
            </select>
            <button onClick={logout} style={{ padding:'5px 8px', background:'#334155', border:'1px solid #475569', color:'#94a3b8', borderRadius:6, fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>
              <LogOut size={14} />
            </button>
          </div>
        </div>

        {/* ── Tab Bar ── */}
        <div style={{ flexShrink:0, background:'rgba(30,41,59,0.6)', borderBottom:'1px solid rgba(71,85,105,0.4)', display:'flex', padding: isMobile ? '0 8px' : '0 20px', overflowX:'auto' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              padding: isMobile ? '10px 14px' : '10px 20px', fontSize: isMobile ? 12 : 13, fontWeight:500, border:'none',
              borderBottom: activeTab===t.id ? '2px solid #f59e0b' : '2px solid transparent',
              color: activeTab===t.id ? '#f59e0b' : '#94a3b8', background:'none', cursor:'pointer', whiteSpace:'nowrap', flexShrink:0
            }}>{t.label}</button>
          ))}
        </div>

        {/* ── Body ── */}
        <div style={{ flex:1, display: isMobile ? 'block' : 'flex', overflow: isMobile ? 'auto' : 'hidden', minHeight:0 }}>

          {/* LEFT — case info */}
          <div style={{ width: isMobile ? '100%' : '32%', flexShrink:0, borderRight: isMobile ? 'none' : '1px solid rgba(71,85,105,0.4)', borderBottom: isMobile ? '1px solid rgba(71,85,105,0.4)' : 'none', background:'rgba(30,41,59,0.3)', overflow: isMobile ? 'visible' : 'hidden', display:'flex', flexDirection:'column', padding:'10px', gap:6 }}>

            {/* Title */}
            <div style={{ background:'rgba(30,41,59,0.8)', border:'1px solid rgba(71,85,105,0.4)', borderRadius:10, padding:'10px 12px', flexShrink:0 }}>
              <div style={{ display:'flex', gap:6, marginBottom:6, flexWrap:'wrap' }}>
                <span style={{ padding:'2px 7px', borderRadius:4, fontSize:11, fontWeight:600, background: isTaxDeed ? 'rgba(168,85,247,0.2)' : 'rgba(249,115,22,0.2)', color: isTaxDeed ? '#c084fc' : '#fb923c' }}>
                  {isTaxDeed ? 'Tax Deed' : 'Foreclosure'}
                </span>
                {selectedLead.status === 'Surplus' && <span style={{ padding:'2px 7px', borderRadius:4, fontSize:11, fontWeight:600, background:'rgba(16,185,129,0.2)', color:'#34d399' }}>Surplus</span>}
              </div>
              <div style={{ fontSize:13, fontWeight:700, color:'white', marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{selectedLead.property_address || 'No Address'}</div>
              <div style={{ fontSize:11, color:'#94a3b8', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {[selectedLead.property_city, selectedLead.property_zip].filter(Boolean).join(', ')}{selectedLead.property_city || selectedLead.property_zip ? ' • ' : ''}{selectedLead.county} • {selectedLead.case_number}
              </div>
              {surplusNum > 0 && (
                <div style={{ marginTop:8, padding:'6px 10px', background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.3)', borderRadius:6, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:11, color:'#34d399', fontWeight:600 }}>Surplus</span>
                  <span style={{ fontSize:15, color:'#34d399', fontWeight:700 }}>${surplusNum.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                </div>
              )}
            </div>

            {/* Case Parties */}
            <div style={{ background:'rgba(30,41,59,0.8)', border:'1px solid rgba(71,85,105,0.4)', borderRadius:10, padding:'6px 12px', flexShrink:1, minHeight:0, overflow:'hidden', display:'flex', flexDirection:'column' }}>
              <div style={{ fontSize:10, fontWeight:600, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6, flexShrink:0 }}>Case Parties</div>
              <div style={{ overflowY:'auto', flex:1, minHeight:0 }}>
              {selectedLead.defendants && (
                <div style={{ marginBottom:4 }}>
                  <div style={{ fontSize:10, color:'#64748b', marginBottom:3 }}>Defendants</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                    {selectedLead.defendants.split(';').map((d,i) => (
                      <div key={i} style={{ padding:'3px 8px', background:'rgba(15,23,42,0.6)', borderRadius:4, fontSize:11, color:'white', border:'1px solid rgba(71,85,105,0.3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.trim()}</div>
                    ))}
                  </div>
                </div>
              )}
              {selectedLead.plaintiffs && (
                <div>
                  <div style={{ fontSize:10, color:'#64748b', marginBottom:3 }}>Plaintiffs</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                    {selectedLead.plaintiffs.split(';').map((p,i) => (
                      <div key={i} style={{ padding:'3px 8px', background:'rgba(15,23,42,0.6)', borderRadius:4, fontSize:11, color:'white', borderLeft:'2px solid rgba(59,130,246,0.5)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.trim()}</div>
                    ))}
                  </div>
                </div>
              )}
              </div>
            </div>

            {/* Property Details */}
            <div style={{ background:'rgba(30,41,59,0.8)', border:'1px solid rgba(71,85,105,0.4)', borderRadius:10, padding:'6px 12px', flexShrink:0 }}>
              <div style={{ fontSize:10, fontWeight:600, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>Property Details</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
                {[
                  ['Address', selectedLead.property_address],
                  ['City', selectedLead.property_city],
                  ['Zip', selectedLead.property_zip],
                  ['Parcel ID', selectedLead.parcel_id],
                  ['Assessed', selectedLead.assessed_value],
                  [isTaxDeed ? 'Opening Bid' : 'Judgment', selectedLead.judgment_amount],
                  ['Sold Amt', selectedLead.sold_amount],
                  ['Auction', formatDate(selectedLead.auction_date)],
                ].filter(([,v]) => v).map(([label, val]) => (
                  <div key={label} style={{ padding:'4px 6px', background:'rgba(15,23,42,0.5)', borderRadius:4 }}>
                    <div style={{ fontSize:10, color:'#64748b' }}>{label}</div>
                    <div style={{ fontSize:11, color:'white', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{val}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Links */}
            <div style={{ background:'rgba(30,41,59,0.8)', border:'1px solid rgba(71,85,105,0.4)', borderRadius:10, padding:'6px 12px', flexShrink:0 }}>
              <div style={{ fontSize:10, fontWeight:600, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>Quick Links</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                {[
                  [selectedLead.case_url,'View Case'],
                  [selectedLead.clerk_of_courts_url,'Clerk'],
                  [selectedLead.final_judgment_url,'Judgment'],
                  [selectedLead.property_appraiser_url,'Appraiser'],
                  [selectedLead.street_map_url,'Street Map'],
                  [selectedLead.satellite_url,'Satellite'],
                  [selectedLead.zillow_url,'Zillow'],
                ].filter(([url]) => url).map(([url, label]) => (
                  <a key={label} href={url} target="_blank" rel="noopener noreferrer"
                    style={{ padding:'3px 8px', background:'rgba(51,65,85,0.8)', border:'1px solid rgba(71,85,105,0.5)', borderRadius:4, fontSize:11, color:'white', textDecoration:'none' }}>
                    {label} →
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT — tab content */}
          <div style={{ flex:1, overflow: isMobile ? 'visible' : 'hidden', display:'flex', flexDirection:'column', minWidth:0 }}>

            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <OverviewTab
                leadContacts={leadContacts}
                selectedLead={selectedLead}
                user={user}
                isMobile={isMobile}
                gmailConnected={gmailConnected}
                handleEmailContact={handleEmailContact}
                handleCall={handleCall}
                setEditingContact={setEditingContact}
                setShowContactModal={setShowContactModal}
                deleteContact={deleteContact}
                note={note} setNote={setNote}
                noteType={noteType} setNoteType={setNoteType}
                addNote={addNote}
                editingNote={editingNote} setEditingNote={setEditingNote}
                editNoteText={editNoteText} setEditNoteText={setEditNoteText}
                updateNote={updateNote}
                deleteNote={deleteNote}
                onContract={gmailConnected ? (contact) => {
                  setContractContact(contact)
                  setShowContractModal(true)
                } : null}
                onMarkDead={markNumberDead}
              />
            )}

            {activeTab === 'documents' && (
              <div style={{ flex:1, overflowY:'auto', padding:'16px' }}>
                <DocumentsTab
                  leadId={selectedLead.id}
                  contacts={leadContacts}
                  onSendContract={gmailConnected ? () => {
                    setContractContact(leadContacts.find(c => c.is_primary) || leadContacts[0] || null)
                    setShowContractModal(true)
                  } : null}
                />
              </div>
            )}

          </div>
        </div>
      </div>
    )
  }
  // ── Dashboard View ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {showPhonePanel && <PhonePanel user={user} leads={leads} onClose={() => setShowPhonePanel(false)} />}
      {showPowerLists && (
        <PowerListsPanel
          user={user}
          leads={leads}
          onClose={() => setShowPowerLists(false)}
          onLoadQueue={(list) => {
            setShowPowerLists(false)
            setShowPhonePanel(true)
            // PhonePanel will pick up list via a global signal — we store it
            window._rcgLoadList = list
          }}
        />
      )}

      {/* ── Nav Bar ── */}
      <div style={{
        background: 'rgba(30,41,59,0.95)', backdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(71,85,105,0.4)',
        position: 'sticky', top: 0, zIndex: 50,
        padding: isMobile ? '10px 14px' : '12px 24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 1280, margin: '0 auto' }}>

          {/* Left: logo + title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12, minWidth: 0, flex: 1 }}>
            <FileText size={isMobile ? 18 : 22} style={{ color: '#f59e0b', flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{
                color: 'white', fontWeight: 700,
                fontSize: isMobile ? 'clamp(11px, 3.8vw, 18px)' : 18,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                letterSpacing: '-0.01em',
              }}>
                Rebound Capital Group
              </div>
              {!isMobile && <div style={{ fontSize: 11, color: '#64748b' }}>Lead Management</div>}
            </div>
          </div>

          {/* Right: actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12, flexShrink: 0 }}>
            {user?.role === 'admin' && !isMobile && (
              <>
                <button onClick={() => setView('admin')} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg flex items-center gap-2 text-sm"><UsersIcon className="w-4 h-4" /> Admin</button>
                <button onClick={exportData} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg flex items-center gap-2 text-sm"><Download className="w-4 h-4" /> Export</button>
              </>
            )}
            {user?.role === 'admin' && isMobile && (
              <button onClick={() => setView('admin')} style={{ padding: '7px 10px', background: 'rgba(71,85,105,0.4)', border: '1px solid rgba(71,85,105,0.4)', borderRadius: 8, color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}>
                Admin
              </button>
            )}
            {/* Power Lists button */}
            <button
              onClick={() => setShowPowerLists(p => !p)}
              style={{
                width: isMobile ? 36 : 38, height: isMobile ? 36 : 38,
                borderRadius: 8,
                background: showPowerLists ? '#C9A84C' : 'rgba(30,41,59,0.8)',
                border: `1px solid ${showPowerLists ? '#C9A84C' : 'rgba(71,85,105,0.4)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                flexShrink: 0,
              }}
              title="Power Lists"
            >
              <CheckSquare size={15} style={{ color: showPowerLists ? '#1a1a1a' : '#94a3b8' }} />
            </button>
            {/* Dialer button */}
            <button
              onClick={() => setShowPhonePanel(p => !p)}
              style={{
                width: isMobile ? 36 : 38, height: isMobile ? 36 : 38,
                borderRadius: 8,
                background: showPhonePanel ? '#C9A84C' : '#1a2e1a',
                border: `1px solid ${showPhonePanel ? '#C9A84C' : '#2d5a2d'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                flexShrink: 0,
              }}
              title="Open Dialer"
            >
              <Phone size={15} style={{ color: showPhonePanel ? '#1a1a1a' : '#4CAF50' }} />
            </button>
            {!isMobile && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'rgba(51,65,85,0.5)', borderRadius: 8 }}>
                <span style={{ color: 'white', fontSize: 13, fontWeight: 500 }}>{user?.name}</span>
                <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: user?.role === 'admin' ? 'rgba(245,158,11,0.2)' : 'rgba(59,130,246,0.2)', color: user?.role === 'admin' ? '#fbbf24' : '#60a5fa' }}>{user?.role?.toUpperCase()}</span>
              </div>
            )}
            <button onClick={logout} style={{ padding: isMobile ? '7px 8px' : '7px 10px', background: 'rgba(71,85,105,0.3)', border: 'none', borderRadius: 8, color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: isMobile ? '12px 12px' : '32px 24px' }}>

        {/* ── Stats ── */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(6, 1fr)', gap: isMobile ? 8 : 16, marginBottom: isMobile ? 16 : 32 }}>
          {[
            { label: 'Total', value: stats.total, color: '#64748b', bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.3)' },
            { label: 'New', value: stats.new, color: '#60a5fa', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.3)' },
            { label: 'Contacted', value: stats.contacted, color: '#fbbf24', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)' },
            { label: 'Interested', value: stats.interested, color: '#34d399', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)' },
            { label: 'Surplus', value: stats.surplus, color: '#34d399', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)' },
            { label: 'Future', value: stats.future, color: '#60a5fa', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.3)' },
          ].map(({ label, value, color, bg, border }) => (
            <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: isMobile ? '10px 8px' : 16 }}>
              <div style={{ fontSize: isMobile ? 10 : 12, color: '#64748b', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: isMobile ? 20 : 28, fontWeight: 700, color }}>{value}</div>
            </div>
          ))}
          <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 12, padding: isMobile ? '10px 8px' : 16, gridColumn: isMobile ? 'span 3' : 'span 6' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: isMobile ? 10 : 12, color: '#64748b', marginBottom: 4 }}>Total Recoverable</div>
                <div style={{ fontSize: isMobile ? 20 : 28, fontWeight: 700, color: '#34d399' }}>${stats.totalSurplus.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
              </div>
              <DollarSign size={isMobile ? 20 : 28} style={{ color: '#34d399', opacity: 0.4 }} />
            </div>
          </div>
        </div>

        {/* ── Sort row ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <span style={{ color: '#64748b', fontSize: 13 }}>Sort:</span>
          <button onClick={() => { setSortBy('date'); setSortOrder(sortBy === 'date' && sortOrder === 'desc' ? 'asc' : 'desc') }} style={{ padding: '4px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer', background: sortBy === 'date' ? '#f59e0b' : 'rgba(51,65,85,0.8)', color: sortBy === 'date' ? 'white' : '#94a3b8', border: 'none' }}>Date {sortBy === 'date' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}</button>
          <button onClick={() => { setSortBy('surplus'); setSortOrder(sortBy === 'surplus' && sortOrder === 'desc' ? 'asc' : 'desc') }} style={{ padding: '4px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer', background: sortBy === 'surplus' ? '#f59e0b' : 'rgba(51,65,85,0.8)', color: sortBy === 'surplus' ? 'white' : '#94a3b8', border: 'none' }}>Surplus {sortBy === 'surplus' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}</button>
          <span style={{ color: '#475569', fontSize: 12, marginLeft: 'auto' }}>
            {sortedFiltered.length.toLocaleString()} / {leads.length.toLocaleString()} leads
          </span>
        </div>

        {/* ── Filters ── */}
        {isMobile ? (
          /* Mobile: horizontal scroll chips */
          <div style={{ marginBottom: 12, overflowX: 'auto', display: 'flex', gap: 8, paddingBottom: 4 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
              style={{ minWidth: 140, padding: '7px 12px', background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(71,85,105,0.5)', borderRadius: 20, color: 'white', fontSize: 13, outline: 'none', flexShrink: 0 }} />
            {[
              ['status', [['all','All'],['New','New'],['Contacted','Contacted'],['Interested','Int'],['Surplus','Surplus'],['Dead','Dead']]],
              ['type', [['all','All Types'],['Surplus','Surplus'],['Foreclosure','FC'],['Tax Deed','TD']]],
            ].map(([key, opts]) => (
              <select key={key} value={filters[key]} onChange={e => setFilters({ ...filters, [key]: e.target.value })}
                style={{ padding: '7px 10px', background: filters[key] !== 'all' ? 'rgba(245,158,11,0.2)' : 'rgba(15,23,42,0.7)', border: `1px solid ${filters[key] !== 'all' ? '#f59e0b' : 'rgba(71,85,105,0.5)'}`, borderRadius: 20, color: filters[key] !== 'all' ? '#fbbf24' : 'white', fontSize: 12, outline: 'none', flexShrink: 0 }}>
                {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            ))}
            <select value={filters.state} onChange={e => setFilters({ ...filters, state: e.target.value, county: 'all' })}
              style={{ padding: '7px 10px', background: filters.state !== 'all' ? 'rgba(245,158,11,0.2)' : 'rgba(15,23,42,0.7)', border: `1px solid ${filters.state !== 'all' ? '#f59e0b' : 'rgba(71,85,105,0.5)'}`, borderRadius: 20, color: filters.state !== 'all' ? '#fbbf24' : 'white', fontSize: 12, outline: 'none', flexShrink: 0 }}>
              <option value="all">All States</option>
              {states.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        ) : (
          /* Desktop: grid filters */
          <div style={{ background: 'rgba(30,41,59,0.5)', border: '1px solid rgba(71,85,105,0.4)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search leads..."
                  style={{ width: '100%', paddingLeft: 34, paddingRight: 12, paddingTop: 10, paddingBottom: 10, background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(71,85,105,0.5)', borderRadius: 8, color: 'white', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })} style={{ padding: '10px 12px', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(71,85,105,0.5)', color: 'white', borderRadius: 8, fontSize: 13 }}>
                <option value="all">All Statuses</option>
                <option>New</option><option>Contacted</option><option>Interested</option><option>Not Interested</option><option>Surplus</option><option>Dead</option>
              </select>
              <select value={filters.type} onChange={e => setFilters({ ...filters, type: e.target.value })} style={{ padding: '10px 12px', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(71,85,105,0.5)', color: 'white', borderRadius: 8, fontSize: 13 }}>
                <option value="all">All Types</option>
                <option value="Surplus">Surplus</option><option value="Future Auction">Future Auction</option><option value="Foreclosure">Foreclosure</option><option value="Tax Deed">Tax Deed</option>
              </select>
              <select value={filters.state} onChange={e => setFilters({ ...filters, state: e.target.value, county: 'all' })} style={{ padding: '10px 12px', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(71,85,105,0.5)', color: 'white', borderRadius: 8, fontSize: 13 }}>
                <option value="all">All States</option>
                {states.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={filters.county} onChange={e => setFilters({ ...filters, county: e.target.value })} style={{ padding: '10px 12px', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(71,85,105,0.5)', color: 'white', borderRadius: 8, fontSize: 13 }}>
                <option value="all">All Counties</option>
                {counties.filter(c => filters.state === 'all' || c.startsWith(filters.state + '-')).map(c => {
                  const display = c.includes('-') ? c.split('-').slice(1).join(' ') : c
                  return <option key={c} value={c}>{display}</option>
                })}
              </select>
            </div>
          </div>
        )}

        {/* ── Bulk Actions ── */}
        {selectedLeads.length > 0 && (
          <div style={{ background: 'rgba(71,85,105,0.3)', border: '1px solid rgba(71,85,105,0.5)', borderRadius: 12, padding: '12px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: 'white', fontWeight: 500 }}>{selectedLeads.length} selected</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {user?.role === 'admin' && <button onClick={() => { if (window.confirm(`Delete ${selectedLeads.length} leads?`)) bulkDeleteLeads(selectedLeads) }} style={{ padding: '6px 14px', background: '#dc2626', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Delete</button>}
              <button onClick={() => setSelectedLeads([])} style={{ padding: '6px 14px', background: 'rgba(71,85,105,0.5)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Clear</button>
            </div>
          </div>
        )}

        {/* ── Lead List: mobile cards vs desktop table ── */}
        {isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sortedFiltered.length === 0 && <div style={{ textAlign: 'center', padding: '40px 0', color: '#475569' }}>No leads found</div>}
            {sortedFiltered.map(l => {
              const surpVal = formatSurplus(l.surplus)
              const lt = (l.lead_type || '').toUpperCase()
              const isTD = ['TAXDEED','TAX DEED'].includes(lt)
              const county = l.county?.includes('-') ? l.county.split('-').slice(1).join(' ') : l.county
              const statusColors = {
                New: { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa' },
                Contacted: { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24' },
                Interested: { bg: 'rgba(16,185,129,0.15)', color: '#34d399' },
                Surplus: { bg: 'rgba(16,185,129,0.15)', color: '#6ee7b7' },
                'Not Interested': { bg: 'rgba(100,116,139,0.15)', color: '#64748b' },
                Dead: { bg: 'rgba(239,68,68,0.15)', color: '#f87171' },
              }
              const sc = statusColors[l.status] || { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8' }
              return (
                <div key={l.id} style={{ background: 'rgba(30,41,59,0.7)', border: '1px solid rgba(71,85,105,0.35)', borderRadius: 14, padding: '12px 14px' }}>
                  {/* Row 1: name + status badge */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {contactedLeadIds.has(l.id) && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />}
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.property_address || l.case_number}</div>
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{county} · {l.property_city} {l.property_zip} · <span style={{ color: isTD ? '#c084fc' : '#fb923c' }}>{isTD ? 'TD' : 'FC'}</span></div>
                    </div>
                    <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: sc.bg, color: sc.color, flexShrink: 0, marginLeft: 8 }}>
                      {l.status === 'Not Interested' ? 'No Int' : l.status}
                    </span>
                  </div>
                  {/* Row 2: surplus + date + actions */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      {surpVal !== null ? (
                        <span style={{ fontSize: 16, fontWeight: 700, color: surpVal < 0 ? '#f87171' : '#34d399' }}>
                          {surpVal < 0 ? '-' : ''}${Math.abs(surpVal).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </span>
                      ) : (
                        <span style={{ fontSize: 13, color: '#475569' }}>—</span>
                      )}
                      <span style={{ fontSize: 11, color: '#475569', marginLeft: 8 }}>{formatDate(l.auction_date)}</span>
                      {l.attempt_count > 0 && (
                        <span style={{ fontSize: 10, color: '#C9A84C', fontWeight: 600, marginLeft: 8 }} title="Call attempts">{l.attempt_count}× called</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {/* Green phone icon → dialer */}
                      <button
                        onClick={() => { setShowPhonePanel(true) }}
                        style={{ width: 34, height: 34, borderRadius: 8, background: '#1a2e1a', border: '1px solid #2d5a2d', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                      >
                        <Phone size={15} style={{ color: '#4CAF50' }} />
                      </button>
                      {/* View → lead detail */}
                      <button
                        onClick={() => viewLead(l, sortedFiltered, sortedFiltered.findIndex(x => x.id === l.id))}
                        style={{ padding: '6px 14px', background: 'rgba(51,65,85,0.8)', border: '1px solid rgba(71,85,105,0.4)', color: 'white', borderRadius: 8, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        <Eye size={13} /> View
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ background: 'rgba(30,41,59,0.5)', border: '1px solid rgba(71,85,105,0.4)', borderRadius: 12, overflow: 'hidden' }}>
          <table className="w-full" style={{tableLayout:'fixed'}}>
            <thead>
              <tr className="bg-slate-900/50 border-b border-slate-700/50">
                <th className="text-left px-2 py-2 text-xs font-semibold text-slate-300" style={{width:'40px'}}>
                  <input type="checkbox" checked={sortedFiltered.length > 0 && selectedLeads.length === sortedFiltered.length} onChange={e => setSelectedLeads(e.target.checked ? sortedFiltered.map(l => l.id) : [])} className="w-4 h-4 rounded border-slate-600 bg-slate-700" />
                </th>
                <th className="text-left px-2 py-2 text-xs font-semibold text-slate-300" style={{width:'100px'}}>Case #</th>
                <th className="text-left px-2 py-2 text-xs font-semibold text-slate-300" style={{width:'75px'}}>County</th>
                <th className="text-left px-2 py-2 text-xs font-semibold text-slate-300" style={{width:'200px'}}>Property</th>
                <th className="text-left px-2 py-2 text-xs font-semibold text-slate-300" style={{width:'72px'}}>City</th>
                <th className="text-left px-2 py-2 text-xs font-semibold text-slate-300" style={{width:'48px'}}>Zip</th>
                <th className="text-left px-2 py-2 text-xs font-semibold text-slate-300" style={{width:'45px'}}>Type</th>
                <th className="text-left px-2 py-2 text-xs font-semibold text-slate-300" style={{width:'65px'}}>Date</th>
                <th className="text-left px-2 py-2 text-xs font-semibold text-slate-300" style={{width:'75px'}}>Surplus</th>
                <th className="text-left px-2 py-2 text-xs font-semibold text-slate-300" style={{width:'70px'}}>Status</th>
                <th className="text-center px-2 py-2 text-xs font-semibold text-slate-300" style={{width:'40px'}}>Att.</th>
                <th className="text-left px-2 py-2 text-xs font-semibold text-slate-300" style={{width:'95px'}}>Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedFiltered.map((l, i) => {
                const lt = (l.lead_type || '').toUpperCase()
                const surpVal = formatSurplus(l.surplus)
                return (
                  <tr key={l.id} className={`border-b border-slate-700/30 hover:bg-slate-700/30 ${i % 2 === 0 ? 'bg-slate-900/20' : ''}`}>
                    <td className="px-2 py-2" style={{width:'40px'}}>
                      <input type="checkbox" checked={selectedLeads.includes(l.id)} onChange={e => setSelectedLeads(e.target.checked ? [...selectedLeads, l.id] : selectedLeads.filter(id => id !== l.id))} className="w-4 h-4 rounded border-slate-600 bg-slate-700" />
                    </td>
                    <td className="px-2 py-2 text-white font-mono text-xs truncate" style={{width:'110px'}}>{l.case_number}</td>
                    <td className="px-2 py-2 text-slate-300 text-xs truncate" style={{width:'90px'}}>{l.county?.includes('-') ? l.county.split('-').slice(1).join(' ') : l.county}</td>
                    <td className="px-2 py-2 text-white text-xs truncate">{l.property_address}</td>
                    <td className="px-2 py-2 text-slate-300 text-xs truncate" style={{width:'70px'}}>{l.property_city}</td>
                    <td className="px-2 py-2 text-slate-300 text-xs" style={{width:'55px'}}>{l.property_zip}</td>
                    <td className="px-2 py-2" style={{width:'60px'}}>
                      <span className={`px-1 py-0.5 rounded text-xs font-semibold block text-center ${['TAXDEED','TAX DEED'].includes(lt) ? 'bg-purple-500/20 text-purple-400' : 'bg-orange-500/20 text-orange-400'}`}>
                        {['TAXDEED','TAX DEED'].includes(lt) ? 'TD' : 'FC'}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-slate-300 text-xs" style={{width:'75px'}}>{formatDate(l.auction_date)}</td>
                    <td className="px-2 py-2 font-semibold text-xs truncate" style={{width:'90px'}}>
                      {surpVal !== null ? (
                        surpVal < 0
                          ? <span className="text-red-400">-${Math.abs(surpVal).toLocaleString('en-US', {minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                          : <span className="text-emerald-400">${surpVal.toLocaleString('en-US', {minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                      ) : '—'}
                    </td>
                    <td className="px-2 py-2" style={{width:'75px'}}>
                      <div className="flex items-center gap-1">
                        {contactedLeadIds.has(l.id) && (
                          <div title="Has contacts" style={{width:7,height:7,borderRadius:'50%',background:'#22c55e',flexShrink:0}} />
                        )}
                        <span className={`px-1 py-0.5 rounded text-xs font-semibold block text-center flex-1 ${
                          l.status === 'New' ? 'bg-blue-500/20 text-blue-400' :
                          l.status === 'Contacted' ? 'bg-amber-500/20 text-amber-400' :
                          l.status === 'Interested' ? 'bg-emerald-500/20 text-emerald-400' :
                          l.status === 'Surplus' ? 'bg-emerald-500/20 text-emerald-300' :
                          l.status === 'Not Interested' ? 'bg-slate-500/20 text-slate-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>{l.status === 'Not Interested' ? 'NoInt' : l.status}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-center" style={{width:'40px'}}>
                      {l.attempt_count > 0
                        ? <span style={{ fontSize:10, color:'#C9A84C', fontWeight:600 }} title="Call attempts">{l.attempt_count}×</span>
                        : <span style={{ fontSize:10, color:'#374151' }}>—</span>
                      }
                    </td>
                    <td className="px-2 py-2" style={{width:'80px'}}>
                      <div className="flex items-center gap-1">
                        <button onClick={() => viewLead(l, sortedFiltered, i)} className="flex items-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs"><Eye className="w-3 h-3" /> View</button>
                        {user?.role === 'admin' && <button onClick={() => { if (window.confirm(`Delete ${l.case_number}?`)) deleteLead(l.id) }} className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs">Del</button>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {sortedFiltered.length === 0 && <div className="text-center py-12 text-slate-400">No leads found</div>}
          </div>
        )}

      </div>
    </div>
  )
}
