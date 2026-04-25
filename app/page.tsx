'use client'
import { useState, useEffect } from 'react'
import axios from 'axios'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const SUPPORTED_BANKS = [
  'HDFC Bank', 'State Bank of India', 'ICICI Bank', 'Axis Bank',
  'Kotak Mahindra', 'Punjab National Bank', 'Bank of Baroda',
  'Yes Bank', 'IndusInd Bank', 'IDFC First Bank', 'Canara Bank', 'Union Bank',
  'Federal Bank', 'RBL Bank', 'South Indian Bank', 'Bandhan Bank'
]

const REVIEWS = [
  { name: 'Rajesh Sharma', role: 'Loan Officer, Bajaj Finserv', text: 'Reduced our statement verification time from 2 days to under 3 minutes. The accuracy is remarkable.', avatar: 'RS' },
  { name: 'Priya Menon', role: 'Credit Analyst, NBFC', text: 'The risk scoring is incredibly accurate. We\'ve integrated this into our underwriting workflow and approval rates have improved.', avatar: 'PM' },
  { name: 'Ankit Verma', role: 'Founder, LendFast', text: 'Finally a tool built for Indian bank statements. Handles SBI, HDFC, ICICI formats perfectly.', avatar: 'AV' },
  { name: 'Deepa Krishnan', role: 'Operations Head, Fintech Startup', text: 'Processing 500+ statements a month with zero manual effort. Password-protected PDF support is a game changer.', avatar: 'DK' },
  { name: 'Mohammed Faiz', role: 'Risk Manager, Microfinance', text: 'EMI detection accuracy is phenomenal. We caught overleveraged borrowers that slipped through our old process.', avatar: 'MF' },
]

const PLANS = [
  {
    id: 'starter', label: 'STARTER', price: '₹299', scans: '5 Scans',
    features: ['5 statement analyses', 'No expiration date', 'Standard Support'],
    popular: false, cta: 'Get Starter', badge: ''
  },
  {
    id: 'pro', label: 'PRO', price: '₹599', scans: '15 Scans',
    features: ['15 statement analyses', 'Risk score + Summary', 'Priority Processing'],
    popular: true, cta: 'Get Pro', badge: ''
  },
  {
    id: 'business', label: 'BUSINESS', price: '₹999', scans: '40 Scans',
    features: ['40 statement analyses', 'Unlocks all features', 'Direct Founder Support'],
    popular: false, cta: 'Get Business', badge: 'Best Value'
  },
]

export default function Home() {
  const [file, setFile] = useState<File | null>(null)
  const [pdfPassword, setPdfPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [loadingText, setLoadingText] = useState('Connecting...')
  const [result, setResult] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [scansUsed, setScansUsed] = useState(0)
  const [isPaid, setIsPaid] = useState(false)
  const [scansLeft, setScansLeft] = useState(0)
  const [authLoading, setAuthLoading] = useState(true)
  const [guestScanned, setGuestScanned] = useState(false)
  const [showPaywall, setShowPaywall] = useState(false)
  const [showSignupWall, setShowSignupWall] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'error' | 'success' } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [showPrivacy, setShowPrivacy] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<typeof PLANS[0] | null>(null)
  const [timer, setTimer] = useState(600)

  // 10-min countdown — resets each time a plan modal opens
  useEffect(() => {
    if (!selectedPlan) return
    setTimer(600)
    const interval = setInterval(() => {
      setTimer(t => { if (t <= 1) { clearInterval(interval); return 0 } return t - 1 })
    }, 1000)
    return () => clearInterval(interval)
  }, [selectedPlan])

  const timerDisplay = `${String(Math.floor(timer / 60)).padStart(2, '0')}:${String(timer % 60).padStart(2, '0')}`
  const timerUrgent = timer < 120

  const showToast = (msg: string, type: 'error' | 'success' = 'error') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  const goHome = () => {
    setShowPaywall(false); setShowSignupWall(false); setResult(null)
    setFile(null); setPdfPassword(''); setSelectedPlan(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    const g = localStorage.getItem('guest_scanned')
    if (g) setGuestScanned(true)
    const init = async () => {
      try {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
        const sessionPromise = supabase.auth.getSession()
        const { data: { session } } = await Promise.race([sessionPromise, timeout]) as any
        if (session?.user) { setUser(session.user); await loadUser(session.user) }
      } catch (e) {}
      setAuthLoading(false)
    }
    init()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_e, session) => {
      if (session?.user) { setUser(session.user); await loadUser(session.user) }
      else { setUser(null); setScansUsed(0); setIsPaid(false); setScansLeft(0) }
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    let pi: any, ti: any
    if (loading) {
      setProgress(0)
      pi = setInterval(() => setProgress(p => p >= 98 ? 98 : p + (p < 40 ? 3 : p < 70 ? 1.5 : p < 90 ? 0.5 : 0.2)), 600)
      const texts = ['Unlocking PDF...', 'Reading transactions...', 'Detecting salary credits...', 'Filtering bounced cheques...', 'Computing risk score...', 'Finalising report...']
      let i = 0
      ti = setInterval(() => { i = (i + 1) % texts.length; setLoadingText(texts[i]) }, 2500)
    } else setProgress(100)
    return () => { clearInterval(pi); clearInterval(ti) }
  }, [loading])

  const loadUser = async (u: any) => {
    const { data, error } = await supabase.from('user_scans').select('*').eq('id', u.id).single()
    if (error || !data) {
      await supabase.from('user_scans').insert({ id: u.id, email: u.email, scans_used: 0, is_paid: false, scans_purchased: 0 })
      setScansUsed(0); setIsPaid(false); setScansLeft(2)
    } else {
      setScansUsed(data.scans_used); setIsPaid(data.is_paid)
      setScansLeft(data.is_paid ? data.scans_purchased - data.scans_used : Math.max(0, 2 - data.scans_used))
    }
  }

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
  }
  const signOut = async () => { await supabase.auth.signOut(); goHome() }

  const handleUpload = async () => {
    if (!file) return
    if (!user && guestScanned) { setShowSignupWall(true); return }
    if (user && !isPaid && scansUsed >= 2) { setShowPaywall(true); return }
    if (user && isPaid && scansLeft <= 0) { setShowPaywall(true); return }
    setLoading(true); setResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      if (pdfPassword) formData.append('password', pdfPassword)
      const res = await axios.post('https://credilens-api.onrender.com/upload', formData)
      if (res.data.error) throw new Error(res.data.error)
      if (!user) { localStorage.setItem('guest_scanned', 'true'); setGuestScanned(true) }
      else {
        const n = scansUsed + 1
        await supabase.from('user_scans').update({ scans_used: n }).eq('id', user.id)
        setScansUsed(n)
        if (!isPaid) setScansLeft(Math.max(0, 2 - n))
        else setScansLeft((p: number) => p - 1)
      }
      setResult(res.data); setPdfPassword(''); showToast('Analysis complete!', 'success')
    } catch (e: any) {
      const msg = e.response?.data?.error || e.message || 'Connection failed.'
      showToast(msg.toLowerCase().includes('password') ? 'Incorrect PDF password. Please try again.' : msg, 'error')
      setResult(null)
    }
    setLoading(false)
  }

  const riskColor = (s: number) => s >= 7 ? '#10b981' : s >= 4 ? '#f59e0b' : '#ef4444'
  const riskLabel = (s: number) => s >= 7 ? 'LOW RISK' : s >= 4 ? 'MEDIUM RISK' : 'HIGH RISK'

  // ─────────────────────────────────────────────────────────────
  // GMAIL WEB COMPOSE — works on every device & browser
  // Opens mail.google.com directly instead of the OS mail app
  // ─────────────────────────────────────────────────────────────
  const openGmailCompose = (plan: typeof PLANS[0]) => {
    const to = 'clearstatement.billing@gmail.com'
    const subject = `Payment Confirmation – ClearStatement ${plan.label} Plan (${plan.price})`
    const body =
      `Hi,\n\nI have completed the UPI payment for the following plan:\n\nPlan: ${plan.label} – ${plan.price} (${plan.scans})\nTransaction ID: [paste your transaction ID here]\nUPI App used: [PhonePe / GPay / Paytm / BHIM]\n\nPlease activate my scans at the earliest.\n\nThank you!`

    const gmailUrl =
      `https://mail.google.com/mail/?view=cm` +
      `&to=${encodeURIComponent(to)}` +
      `&su=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`

    window.open(gmailUrl, '_blank', 'noopener,noreferrer')
  }

  if (authLoading) return (
    <main style={{ minHeight: '100vh', background: '#020818', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 36, height: 36, border: '2px solid #00d4ff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </main>
  )

  const PricingGrid = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14, maxWidth: 840, margin: '0 auto' }}>
      {PLANS.map(plan => (
        <div key={plan.id} style={{
          background: plan.popular ? 'linear-gradient(145deg, #041628, #071e35)' : 'linear-gradient(145deg, #060e1a, #0a1628)',
          border: `1px solid ${plan.popular ? 'rgba(0,212,255,0.35)' : 'rgba(255,255,255,0.07)'}`,
          borderRadius: 16, padding: 26, position: 'relative', textAlign: 'left',
          boxShadow: plan.popular ? '0 0 40px rgba(0,212,255,0.1)' : '0 4px 24px rgba(0,0,0,0.3)'
        }}>
          {plan.popular && (
            <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(90deg, #00d4ff, #0077ff)', color: '#000', fontSize: 11, fontWeight: 700, padding: '4px 14px', borderRadius: 20, whiteSpace: 'nowrap' }}>Most Popular</div>
          )}
          {plan.badge && (
            <div style={{ display: 'inline-block', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981', fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 20, marginBottom: 12 }}>{plan.badge}</div>
          )}
          <div style={{ fontSize: 10, color: plan.popular ? '#00d4ff' : '#4a6080', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 8 }}>{plan.label}</div>
          <div style={{ fontSize: 38, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 4 }}>{plan.price}</div>
          <div style={{ fontSize: 13, color: '#4a6080', marginBottom: 22 }}>{plan.scans}</div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 18, marginBottom: 22 }}>
            {plan.features.map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '5px 0', color: '#8899aa', fontSize: 13 }}>
                <span style={{ color: '#10b981', fontWeight: 700 }}>✓</span> {f}
              </div>
            ))}
          </div>
          <button
            onClick={() => setSelectedPlan(plan)}
            style={plan.popular
              ? { width: '100%', padding: '12px', borderRadius: 10, fontSize: 14, background: 'linear-gradient(90deg, #00d4ff, #0077ff)', color: '#000', border: 'none', cursor: 'pointer', fontWeight: 700, boxShadow: '0 4px 20px rgba(0,212,255,0.25)' }
              : { width: '100%', padding: '12px', borderRadius: 10, fontSize: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#8899aa', cursor: 'pointer', fontWeight: 600 }
            }
          >{plan.cta}</button>
        </div>
      ))}
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#020818', color: '#e8e8e8', fontFamily: "'Inter',-apple-system,sans-serif", overflowX: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideUp { from { transform: translateY(14px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ticker { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
        @keyframes dot-glow { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes pulse-red { 0%,100% { opacity: 1; box-shadow: 0 0 0 0 rgba(239,68,68,0.3); } 50% { opacity: 0.85; box-shadow: 0 0 0 6px rgba(239,68,68,0); } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input { font-family: 'Inter',sans-serif !important; background: rgba(255,255,255,0.04) !important; border: 1px solid rgba(255,255,255,0.1) !important; color: #e8e8e8 !important; border-radius: 10px; width: 100%; padding: 13px 16px; font-size: 14px; }
        input:focus { border-color: #00d4ff !important; outline: none !important; box-shadow: 0 0 0 3px rgba(0,212,255,0.07) !important; }
        input::placeholder { color: #3a5070 !important; }
        button { font-family: 'Inter',sans-serif; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(1,4,16,0.85); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); z-index: 200; display: flex; align-items: center; justify-content: center; padding: 20px; animation: fadeIn 0.2s; }
        .modal-box { background: linear-gradient(160deg, #070f24 0%, #0a1630 60%, #060e20 100%); border: 1px solid rgba(0,212,255,0.18); border-radius: 24px; max-width: 500px; width: 100%; max-height: 90vh; overflow-y: auto; padding: 34px; position: relative; box-shadow: 0 32px 80px rgba(0,0,0,0.7), 0 0 60px rgba(0,100,255,0.08), inset 0 1px 0 rgba(255,255,255,0.05); }
        .gmail-btn { display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; padding: 14px 18px; border-radius: 13px; background: linear-gradient(135deg, #0a2a52, #0e3a70); border: 1px solid rgba(0,150,255,0.25); color: #fff; font-weight: 700; font-size: 14px; box-shadow: 0 6px 24px rgba(0,80,200,0.25); transition: all 0.18s; margin-bottom: 10px; cursor: pointer; letter-spacing: -0.01em; text-decoration: none; font-family: 'Inter',sans-serif; }
        .gmail-btn:hover { background: linear-gradient(135deg, #0d3570, #1050a0) !important; transform: translateY(-1px); box-shadow: 0 8px 28px rgba(0,100,255,0.35) !important; }
        ::-webkit-scrollbar { width: 3px; } ::-webkit-scrollbar-track { background: #020818; } ::-webkit-scrollbar-thumb { background: #1a3050; }
      `}</style>

      {/* TOAST */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 300, padding: '12px 18px', borderRadius: 10, background: '#060f22', border: `1px solid ${toast.type === 'error' ? '#ef4444' : '#10b981'}`, color: toast.type === 'error' ? '#ef4444' : '#10b981', fontWeight: 600, fontSize: 13, animation: 'slideUp 0.25s', display: 'flex', alignItems: 'center', gap: 8 }}>
          {toast.type === 'success' ? '✓' : '✕'} {toast.msg}
        </div>
      )}

      {/* TERMS MODAL */}
      {showTerms && (
        <div className="modal-overlay" onClick={() => setShowTerms(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>Terms of Service</h2>
              <button onClick={() => setShowTerms(false)} style={{ background: 'none', border: 'none', color: '#4a6080', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
            <div style={{ color: '#6680a0', fontSize: 13, lineHeight: 1.85 }}>
              {[['1. Acceptance','By accessing ClearStatement, you agree to these terms.'],['2. Service','ClearStatement provides smart bank statement analysis for financial verification. Results are informational and not a substitute for professional financial advice.'],['3. Data Privacy','Uploaded documents are processed in real-time and immediately deleted. We do not store, share, or sell your financial data.'],['4. Accuracy','Data should be verified by a qualified professional before making lending decisions.'],['5. Contact','clearstatement.billing@gmail.com']].map(([t,b]) => (
                <div key={t} style={{ marginBottom: 14 }}><div style={{ color: '#ccd6e8', fontWeight: 600, marginBottom: 3 }}>{t}</div><div>{b}</div></div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PRIVACY MODAL */}
      {showPrivacy && (
        <div className="modal-overlay" onClick={() => setShowPrivacy(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>Privacy Policy</h2>
              <button onClick={() => setShowPrivacy(false)} style={{ background: 'none', border: 'none', color: '#4a6080', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
            <div style={{ color: '#6680a0', fontSize: 13, lineHeight: 1.85 }}>
              {[['Data We Collect','We collect your email for authentication and temporarily process PDFs for analysis. No financial data is retained.'],['How We Use Data','Email is used for account management only. PDFs are processed in-memory and deleted immediately after analysis.'],['Third Parties','Groq for analysis, Supabase for auth, Vercel for hosting.'],['Your Rights','Request account deletion: clearstatement.billing@gmail.com']].map(([t,b]) => (
                <div key={t} style={{ marginBottom: 14 }}><div style={{ color: '#ccd6e8', fontWeight: 600, marginBottom: 3 }}>{t}</div><div>{b}</div></div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          PAYMENT MODAL
      ═══════════════════════════════════════ */}
      {selectedPlan && (
        <div className="modal-overlay" onClick={() => setSelectedPlan(null)}>
          <div className="modal-box" style={{ maxWidth: 420, padding: '28px 26px' }} onClick={e => e.stopPropagation()}>

            {/* Close */}
            <button
              onClick={() => setSelectedPlan(null)}
              style={{ position: 'absolute', top: 14, right: 14, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#6680a0', cursor: 'pointer', fontSize: 13, width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >✕</button>

            {/* ── TIMER ── */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: timerUrgent ? 'rgba(239,68,68,0.1)' : 'rgba(0,212,255,0.07)',
                border: `1px solid ${timerUrgent ? 'rgba(239,68,68,0.4)' : 'rgba(0,212,255,0.25)'}`,
                borderRadius: 24, padding: '6px 16px',
                animation: timerUrgent ? 'pulse-red 1.2s infinite' : 'none'
              }}>
                <span style={{ fontSize: 14 }}>{timerUrgent ? '🔴' : '⏱️'}</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: timerUrgent ? '#ef4444' : '#00d4ff', fontVariantNumeric: 'tabular-nums', letterSpacing: '0.04em' }}>
                  {timer === 0 ? 'Offer Expired' : `${timerDisplay} left`}
                </span>
                <span style={{ fontSize: 10, color: timerUrgent ? '#ef444480' : '#00d4ff60', fontWeight: 600 }}>· price holds</span>
              </div>
            </div>

            {/* Plan header */}
            <div style={{ textAlign: 'center', marginBottom: 18 }}>
              <div style={{ fontSize: 9, color: '#00d4ff', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>{selectedPlan.label} PLAN</div>
              <div style={{ fontSize: 44, fontWeight: 900, color: '#fff', letterSpacing: '-0.04em', lineHeight: 1, marginBottom: 8 }}>{selectedPlan.price}</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 20, padding: '3px 12px' }}>
                <span style={{ color: '#10b981', fontSize: 11, fontWeight: 600 }}>✓ {selectedPlan.scans} · Never expires</span>
              </div>
            </div>

            {/* QR Code */}
            <div style={{
              background: 'linear-gradient(135deg, #f8faff, #eef2ff)',
              borderRadius: 20, padding: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 16,
              boxShadow: '0 8px 40px rgba(0,100,255,0.15), 0 2px 8px rgba(0,0,0,0.3)'
            }}>
              <img src="/qr.png" alt="UPI QR Code" style={{ width: 200, height: 200, display: 'block', borderRadius: 10 }} />
            </div>

            {/* UPI apps */}
            <div style={{ textAlign: 'center', marginBottom: 18 }}>
              <div style={{ fontSize: 13, color: '#ccd6e8', fontWeight: 600, marginBottom: 8 }}>Scan with any UPI app</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
                {['PhonePe', 'GPay', 'Paytm', 'BHIM'].map(app => (
                  <span key={app} style={{ fontSize: 10, color: '#4a7090', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: '3px 9px', borderRadius: 6, fontWeight: 500 }}>{app}</span>
                ))}
              </div>
            </div>

            {/* ── PAYMENT INSTRUCTIONS ── */}
            <div style={{
              background: 'rgba(0,212,255,0.04)',
              border: '1px solid rgba(0,212,255,0.12)',
              borderRadius: 12,
              padding: '14px 16px',
              marginBottom: 18
            }}>
              <div style={{ fontSize: 9, color: '#00d4ff', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>How to Pay</div>
              {[
                { n: '1', t: 'Scan the QR code above using PhonePe, GPay, Paytm, or any UPI app and complete the payment.' },
                { n: '2', t: 'Click the button below — Gmail will open with your plan details pre-filled. Just paste your Transaction ID.' },
                { n: '3', t: 'Send the email and your scans will be activated within 2 hours.' },
              ].map(step => (
                <div key={step.n} style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,212,255,0.12)', border: '1px solid rgba(0,212,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                    <span style={{ fontSize: 9, color: '#00d4ff', fontWeight: 700 }}>{step.n}</span>
                  </div>
                  <p style={{ fontSize: 12, color: '#6680a0', lineHeight: 1.6, margin: 0 }}>{step.t}</p>
                </div>
              ))}
            </div>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
              <span style={{ fontSize: 9, color: '#2a4060', fontWeight: 700, letterSpacing: '0.1em' }}>CONFIRM PAYMENT</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
            </div>

            {/* ── GMAIL BUTTON — opens Gmail web compose on any device ── */}
            <button
              className="gmail-btn"
              onClick={() => openGmailCompose(selectedPlan)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#60c0ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2"/>
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
              </svg>
              Send Confirmation via Gmail →
            </button>

            <p style={{ textAlign: 'center', fontSize: 11, color: '#2a4060', marginBottom: 14, lineHeight: 1.6 }}>
              Opens Gmail in your browser · Works on mobile & desktop
            </p>

            {/* Close */}
            <button
              onClick={() => setSelectedPlan(null)}
              style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: '#3a5070', padding: '11px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
            >Close</button>
          </div>
        </div>
      )}

      {/* NAVBAR */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(2,8,24,0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '0 28px', height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={goHome} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 28, height: 28, background: 'linear-gradient(135deg, #00d4ff, #0055cc)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>C</span>
          </div>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#fff', letterSpacing: '-0.02em' }}>ClearStatement</span>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {user ? (
            <>
              {!isPaid && scansLeft > 0 && <span style={{ fontSize: 11, color: '#00d4ff', background: 'rgba(0,212,255,0.07)', border: '1px solid rgba(0,212,255,0.15)', padding: '3px 11px', borderRadius: 20, fontWeight: 600 }}>{scansLeft} free scan{scansLeft > 1 ? 's' : ''} left</span>}
              {isPaid && <span style={{ fontSize: 11, color: '#10b981', background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.15)', padding: '3px 11px', borderRadius: 20, fontWeight: 600 }}>{scansLeft} scans left</span>}
              <img src={user.user_metadata?.avatar_url} style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)' }} alt="Profile" />
              <button onClick={signOut} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.08)', color: '#6680a0', padding: '5px 13px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>Sign out</button>
            </>
          ) : (
            <button onClick={signInWithGoogle} style={{ background: 'linear-gradient(90deg, #00d4ff, #0077ff)', color: '#000', border: 'none', padding: '7px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Sign In</button>
          )}
        </div>
      </nav>

      {/* BANK TICKER */}
      <div style={{ background: '#010612', borderBottom: '1px solid rgba(255,255,255,0.03)', padding: '7px 0', overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 60, background: 'linear-gradient(to right, #010612, transparent)', zIndex: 2 }} />
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 60, background: 'linear-gradient(to left, #010612, transparent)', zIndex: 2 }} />
        <div style={{ display: 'flex', animation: 'ticker 30s linear infinite', width: 'max-content' }}>
          {[...SUPPORTED_BANKS, ...SUPPORTED_BANKS].map((bank, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0 22px', whiteSpace: 'nowrap' }}>
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#00d4ff', opacity: 0.4 }} />
              <span style={{ fontSize: 10, color: '#2a4060', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{bank}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1060, margin: '0 auto', padding: '0 22px' }}>

        {/* MAIN PAGE */}
        {!showPaywall && !showSignupWall && !result && (
          <div style={{ paddingBottom: 100 }}>

            {/* HERO */}
            <div style={{ minHeight: 'calc(100vh - 115px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 0, paddingBottom: 0 }}>

              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.15)', borderRadius: 20, padding: '4px 13px', marginBottom: 22 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#00d4ff', animation: 'dot-glow 2s infinite' }} />
                <span style={{ fontSize: 10, color: '#00d4ff', fontWeight: 600, letterSpacing: '0.09em' }}>INSTANT · SECURE · ACCURATE</span>
              </div>

              <h1 style={{ fontSize: 'clamp(28px, 5vw, 58px)', fontWeight: 800, textAlign: 'center', lineHeight: 1.1, letterSpacing: '-0.035em', color: '#fff', marginBottom: 16, maxWidth: 700 }}>
                Bank Statement Analysis<br />
                <span style={{ background: 'linear-gradient(135deg, #00d4ff 0%, #0055cc 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>In Under 60 Seconds.</span>
              </h1>

              <p style={{ textAlign: 'center', fontSize: 16, color: '#6680a0', maxWidth: 440, margin: '0 auto 36px', lineHeight: 1.7 }}>
                Verify income, detect EMIs, flag bounced cheques — any Indian bank, with or without password.
              </p>

              <div style={{ display: 'flex', justifyContent: 'center', gap: 36, marginBottom: 40, flexWrap: 'wrap' }}>
                {[['16+','Banks Supported'],['99%+','Accuracy'],['< 60s','Analysis Time'],['0','Data Retained']].map(([v,l]) => (
                  <div key={l} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.025em' }}>{v}</div>
                    <div style={{ fontSize: 10, color: '#2a4060', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 3 }}>{l}</div>
                  </div>
                ))}
              </div>

              {/* UPLOAD BOX */}
              <div style={{ width: '100%', maxWidth: 540 }}>
                <div style={{ background: 'linear-gradient(145deg, #050d1e, #081428)', border: '1px solid rgba(0,212,255,0.28)', borderRadius: 18, padding: 24, boxShadow: '0 0 40px rgba(0,212,255,0.09), 0 0 0 1px rgba(0,212,255,0.03)' }}>
                  <label
                    onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f?.type === 'application/pdf') setFile(f) }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 160, border: `2px dashed ${dragOver ? '#00d4ff' : file ? '#00d4ff' : 'rgba(0,212,255,0.35)'}`, borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s', background: dragOver ? 'rgba(0,212,255,0.04)' : file ? 'rgba(0,212,255,0.02)' : 'rgba(0,212,255,0.015)', marginBottom: 14 }}
                  >
                    {file ? (
                      <div style={{ textAlign: 'center', padding: 14 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                          <svg width="18" height="18" fill="none" stroke="#00d4ff" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                        </div>
                        <div style={{ color: '#ddd', fontWeight: 600, fontSize: 13, marginBottom: 3, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                        <div style={{ color: '#00d4ff', fontSize: 10, fontWeight: 600, letterSpacing: '0.07em' }}>PDF ATTACHED · {(file.size/1024).toFixed(0)} KB</div>
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: 14 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(0,212,255,0.07)', border: '1px solid rgba(0,212,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', animation: 'float 3s ease-in-out infinite' }}>
                          <svg width="18" height="18" fill="none" stroke="#00d4ff" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                        </div>
                        <div style={{ color: '#bbb', fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Drop your bank statement here</div>
                        <div style={{ color: '#3a5070', fontSize: 12 }}>or click to browse · PDF only</div>
                      </div>
                    )}
                    <input type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => setFile(e.target.files?.[0] || null)} />
                  </label>

                  {file && !loading && (
                    <div style={{ marginBottom: 12, animation: 'slideUp 0.22s' }}>
                      <input type="password" placeholder="PDF Password (leave blank if not protected)" value={pdfPassword} onChange={e => setPdfPassword(e.target.value)} />
                    </div>
                  )}

                  {loading && (
                    <div style={{ marginBottom: 12, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 11, padding: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 9 }}>
                        <span style={{ fontSize: 12, color: '#00d4ff', fontWeight: 500 }}>{loadingText}</span>
                        <span style={{ fontSize: 12, color: '#fff', fontWeight: 700 }}>{Math.round(progress)}%</span>
                      </div>
                      <div style={{ height: 2, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #00d4ff, #0055cc)', borderRadius: 2, transition: 'width 0.6s ease' }} />
                      </div>
                    </div>
                  )}

                  {!loading && (
                    <div style={{ display: 'flex', gap: 9 }}>
                      <button onClick={handleUpload} disabled={!file} style={{ flex: 1, padding: '12px 18px', borderRadius: 10, fontSize: 14, background: file ? 'linear-gradient(90deg, #00d4ff, #0077ff)' : 'rgba(255,255,255,0.03)', color: file ? '#000' : '#3a5070', border: file ? 'none' : '1px solid rgba(255,255,255,0.06)', cursor: file ? 'pointer' : 'not-allowed', fontWeight: 700, transition: 'all 0.15s', boxShadow: file ? '0 4px 20px rgba(0,212,255,0.2)' : 'none' }}>
                        {!user ? '⚡ Analyse Free' : '⚡ Run Analysis'}
                      </button>
                      {file && <button onClick={() => { setFile(null); setPdfPassword('') }} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.08)', color: '#4a6080', padding: '12px 16px', borderRadius: 10, cursor: 'pointer', fontSize: 13 }}>Clear</button>}
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    {[['🔐','256-bit SSL'],['🗑️','Deleted instantly'],['🇮🇳','Indian banks']].map(([icon,label]) => (
                      <div key={label as string} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 11 }}>{icon}</span>
                        <span style={{ fontSize: 10, color: '#2a4060', fontWeight: 500 }}>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {!user && (
                  <p style={{ textAlign: 'center', fontSize: 12, color: '#2a4060', marginTop: 12 }}>
                    1 free scan without signup · Sign in for 2 more free scans
                  </p>
                )}
              </div>
            </div>

            {/* REVIEWS */}
            <div style={{ marginTop: 20, paddingTop: 80, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ textAlign: 'center', marginBottom: 36 }}>
                <div style={{ fontSize: 10, color: '#00d4ff', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 9 }}>Trusted by Professionals</div>
                <h2 style={{ fontSize: 'clamp(20px, 3vw, 30px)', fontWeight: 700, color: '#fff', letterSpacing: '-0.025em' }}>What underwriters say</h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                {REVIEWS.map((r, i) => (
                  <div key={i} style={{ background: 'linear-gradient(145deg, #060e1a, #081428)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 20, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)' }}>
                    <div style={{ display: 'flex', gap: 2, marginBottom: 10 }}>{'★★★★★'.split('').map((s,j) => <span key={j} style={{ color: '#f59e0b', fontSize: 12 }}>{s}</span>)}</div>
                    <p style={{ color: '#6680a0', fontSize: 13, lineHeight: 1.7, marginBottom: 16, fontStyle: 'italic' }}>"{r.text}"</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#00d4ff' }}>{r.avatar}</div>
                      <div>
                        <div style={{ color: '#ccd6e8', fontWeight: 600, fontSize: 12 }}>{r.name}</div>
                        <div style={{ color: '#3a5070', fontSize: 11 }}>{r.role}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* HOW IT WORKS */}
            <div style={{ marginTop: 90, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: '#00d4ff', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 9 }}>Simple Process</div>
              <h2 style={{ fontSize: 'clamp(20px, 3vw, 30px)', fontWeight: 700, color: '#fff', marginBottom: 36, letterSpacing: '-0.025em' }}>Three steps to clarity</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 }}>
                {[{n:'01',t:'Upload PDF',d:'Drop any Indian bank statement. Password protected or not — handled automatically.'},{n:'02',t:'Smart Analysis',d:'Reads every transaction, detects salary, EMIs, and risk indicators instantly.'},{n:'03',t:'Get Report',d:'Verified summary with income, EMIs, bounces, and risk score in seconds.'}].map(item => (
                  <div key={item.n} style={{ background: 'linear-gradient(145deg, #060e1a, #081428)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 24, textAlign: 'left', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.025)' }}>
                    <div style={{ fontSize: 36, fontWeight: 800, color: 'rgba(0,212,255,0.12)', marginBottom: 12, lineHeight: 1, letterSpacing: '-0.04em' }}>{item.n}</div>
                    <div style={{ color: '#ccd6e8', fontWeight: 600, fontSize: 14, marginBottom: 7 }}>{item.t}</div>
                    <div style={{ color: '#4a6080', fontSize: 12, lineHeight: 1.65 }}>{item.d}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* PRICING */}
            <div style={{ marginTop: 90, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: '#00d4ff', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 9 }}>Pricing</div>
              <h2 style={{ fontSize: 'clamp(20px, 3vw, 30px)', fontWeight: 700, color: '#fff', marginBottom: 8, letterSpacing: '-0.025em' }}>Simple, transparent pricing</h2>
              <p style={{ color: '#4a6080', fontSize: 13, marginBottom: 36 }}>Pay once, no subscription. Scans never expire.</p>
              <PricingGrid />
            </div>
          </div>
        )}

        {/* RESULTS */}
        {result && !result.error && (
          <div style={{ paddingTop: 52, paddingBottom: 80, animation: 'slideUp 0.3s' }}>
            <div style={{ marginBottom: 32, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: '#00d4ff', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 7 }}>Analysis Complete</div>
                <h2 style={{ fontSize: 26, fontWeight: 700, color: '#fff', letterSpacing: '-0.025em' }}>Financial Summary</h2>
              </div>
              <div style={{ padding: '5px 14px', borderRadius: 20, background: `${riskColor(result.risk_score||5)}15`, border: `1px solid ${riskColor(result.risk_score||5)}30`, color: riskColor(result.risk_score||5), fontWeight: 700, fontSize: 10, letterSpacing: '0.09em' }}>
                {riskLabel(result.risk_score||5)}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12, marginBottom: 18 }}>
              {[
                {label:'Verified Monthly Income', value:`₹${(result.verified_monthly_salary||0).toLocaleString('en-IN')}`, sub:'Average salary credits', color:'#10b981'},
                {label:'Risk Score', value:`${result.risk_score||0}/10`, sub:'Higher = better credit profile', color:riskColor(result.risk_score||5)},
                {label:'Bounced Cheques', value:String(result.bounced_cheque_count||0), sub:'Returns & dishonours', color:(result.bounced_cheque_count||0)===0?'#10b981':'#ef4444'},
                {label:'Monthly EMI Load', value:`₹${(result.total_emi||0).toLocaleString('en-IN')}`, sub:'Auto-debits & loans', color:'#f59e0b'},
                {label:'Average Balance', value:`₹${(result.average_balance||0).toLocaleString('en-IN')}`, sub:'Across statement period', color:'#00d4ff'},
              ].map(card => (
                <div key={card.label} style={{ background: 'linear-gradient(145deg, #060e1a, #081428)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 22 }}>
                  <div style={{ fontSize: 9, color: '#2a4060', fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 9 }}>{card.label}</div>
                  <div style={{ fontSize: 30, fontWeight: 800, color: card.color, marginBottom: 5, letterSpacing: '-0.025em' }}>{card.value}</div>
                  <div style={{ fontSize: 11, color: '#3a5070' }}>{card.sub}</div>
                </div>
              ))}
              {result.summary && (
                <div style={{ background: 'linear-gradient(145deg, #060e1a, #081428)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 22, gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: 9, color: '#2a4060', fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 9 }}>Smart Summary</div>
                  <div style={{ color: '#6680a0', fontSize: 13, lineHeight: 1.7 }}>{result.summary}</div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={goHome} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.08)', color: '#4a6080', padding: '10px 20px', borderRadius: 10, cursor: 'pointer', fontSize: 13 }}>← Analyse Another</button>
            </div>
          </div>
        )}

        {/* SIGNUP WALL */}
        {showSignupWall && (
          <div style={{ paddingTop: 110, paddingBottom: 80, textAlign: 'center', maxWidth: 400, margin: '0 auto', animation: 'slideUp 0.3s' }}>
            <div style={{ fontSize: 42, marginBottom: 18 }}>🔒</div>
            <h2 style={{ fontSize: 26, fontWeight: 700, color: '#fff', marginBottom: 9, letterSpacing: '-0.025em' }}>Create a free account</h2>
            <p style={{ color: '#6680a0', fontSize: 14, marginBottom: 28, lineHeight: 1.65 }}>You have used your guest scan. Sign in to get 2 more free scans — no card required.</p>
            <button onClick={signInWithGoogle} style={{ background: 'linear-gradient(90deg, #00d4ff, #0077ff)', color: '#000', border: 'none', padding: '12px 26px', borderRadius: 11, cursor: 'pointer', fontSize: 15, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 9 }}>
              Continue with Google
            </button>
          </div>
        )}

        {/* PAYWALL */}
        {showPaywall && (
          <div style={{ paddingTop: 68, paddingBottom: 96, animation: 'slideUp 0.3s' }}>
            <div style={{ textAlign: 'center', marginBottom: 44 }}>
              <div style={{ fontSize: 10, color: '#00d4ff', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 9 }}>Scans Used Up</div>
              <h2 style={{ fontSize: 'clamp(20px, 3vw, 30px)', fontWeight: 700, color: '#fff', marginBottom: 8, letterSpacing: '-0.025em' }}>Choose a plan to continue</h2>
              <p style={{ color: '#4a6080', fontSize: 13 }}>Pay once. Scans never expire.</p>
            </div>
            <PricingGrid />
            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <button onClick={goHome} style={{ background: 'none', border: 'none', color: '#2a4060', fontSize: 13, cursor: 'pointer' }}>← Go back</button>
            </div>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.04)', background: '#010612', padding: '40px 28px 24px', marginTop: 40 }}>
        <div style={{ maxWidth: 1060, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 28, marginBottom: 36 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
                <div style={{ width: 24, height: 24, background: 'linear-gradient(135deg, #00d4ff, #0055cc)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#fff', fontWeight: 800, fontSize: 12 }}>C</span>
                </div>
                <span style={{ fontWeight: 700, fontSize: 14, color: '#ccd6e8', letterSpacing: '-0.02em' }}>ClearStatement</span>
              </div>
              <p style={{ color: '#1e3050', fontSize: 11, maxWidth: 200, lineHeight: 1.65 }}>Smart bank statement analysis for Indian financial professionals.</p>
            </div>
            <div style={{ display: 'flex', gap: 44, flexWrap: 'wrap' }}>
              <div>
                <div style={{ color: '#1e3050', fontSize: 9, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 12 }}>Legal</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  <button onClick={() => setShowPrivacy(true)} style={{ background: 'none', border: 'none', color: '#3a5070', fontSize: 11, cursor: 'pointer', textAlign: 'left', padding: 0 }}>Privacy Policy</button>
                  <button onClick={() => setShowTerms(true)} style={{ background: 'none', border: 'none', color: '#3a5070', fontSize: 11, cursor: 'pointer', textAlign: 'left', padding: 0 }}>Terms of Service</button>
                </div>
              </div>
              <div>
                <div style={{ color: '#1e3050', fontSize: 9, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 12 }}>Support</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  <a href="mailto:clearstatement.billing@gmail.com" style={{ color: '#3a5070', fontSize: 11, textDecoration: 'none' }}>Contact Us</a>
                  <span style={{ color: '#1e3050', fontSize: 10 }}>clearstatement.billing@gmail.com</span>
                </div>
              </div>
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ color: '#1e3050', fontSize: 10 }}>© 2026 ClearStatement. All rights reserved.</span>
            <span style={{ color: '#1e3050', fontSize: 10 }}>Engineered by <span style={{ color: '#00d4ff', fontWeight: 600 }}>TheArise</span></span>
          </div>
        </div>
      </footer>
    </div>
  )
}


