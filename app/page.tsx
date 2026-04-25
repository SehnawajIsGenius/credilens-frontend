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
  { name: 'Raju kumar', role: 'Founder, LendFast', text: 'Finally a tool built for Indian bank statements. Handles SBI, HDFC, ICICI formats perfectly.', avatar: 'AV' },
  { name: 'Deepa Krishnan', role: 'Operations Head, Fintech Startup', text: 'Processing 500+ statements a month with zero manual effort. Password-protected PDF support is a game changer.', avatar: 'DK' },
  { name: 'Mohammed karim', role: 'Risk Manager, Microfinance', text: 'EMI detection accuracy is phenomenal. We caught overleveraged borrowers that slipped through our old process.', avatar: 'MF' },
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
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) { setUser(session.user); await loadUser(session.user) }
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

  if (authLoading) return (
    <main style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 36, height: 36, border: '2px solid #00d4ff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </main>
  )

  const PricingGrid = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14, maxWidth: 840, margin: '0 auto' }}>
      {PLANS.map(plan => (
        <div key={plan.id} style={{
          background: plan.popular ? '#040d10' : '#080808',
          // CHANGED: brighter borders on all pricing cards
          border: `1px solid ${plan.popular ? 'rgba(0,212,255,0.28)' : '#272727'}`,
          borderRadius: 16,
          padding: 26,
          position: 'relative',
          textAlign: 'left',
          // CHANGED: subtle glow on popular card
          boxShadow: plan.popular ? '0 0 30px rgba(0,212,255,0.07)' : 'none'
        }}>
          {plan.popular && (
            <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: '#00d4ff', color: '#000', fontSize: 11, fontWeight: 700, padding: '4px 14px', borderRadius: 20, whiteSpace: 'nowrap' }}>Most Popular</div>
          )}
          {plan.badge && (
            <div style={{ display: 'inline-block', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#10b981', fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 20, marginBottom: 12 }}>{plan.badge}</div>
          )}
          <div style={{ fontSize: 10, color: '#555', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 8 }}>{plan.label}</div>
          <div style={{ fontSize: 38, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 4 }}>{plan.price}</div>
          <div style={{ fontSize: 13, color: '#555', marginBottom: 22 }}>{plan.scans}</div>
          <div style={{ borderTop: '1px solid #181818', paddingTop: 18, marginBottom: 22 }}>
            {plan.features.map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '5px 0', color: '#888', fontSize: 13 }}>
                <span style={{ color: '#10b981', fontWeight: 700 }}>✓</span> {f}
              </div>
            ))}
          </div>
          <button
            onClick={() => setSelectedPlan(plan)}
            style={plan.popular
              ? { width: '100%', padding: '12px', borderRadius: 10, fontSize: 14, background: '#00d4ff', color: '#000', border: 'none', cursor: 'pointer', fontWeight: 700 }
              : { width: '100%', padding: '12px', borderRadius: 10, fontSize: 14, background: '#0d0d0d', border: '1px solid #2a2a2a', color: '#888', cursor: 'pointer', fontWeight: 600 }
            }
          >{plan.cta}</button>
        </div>
      ))}
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#000', color: '#e8e8e8', fontFamily: "'Inter',-apple-system,sans-serif", overflowX: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideUp { from { transform: translateY(14px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ticker { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
        @keyframes dot-glow { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input { font-family: 'Inter',sans-serif !important; background: #0d0d0d !important; border: 1px solid #222 !important; color: #e8e8e8 !important; border-radius: 10px; width: 100%; padding: 13px 16px; font-size: 14px; }
        input:focus { border-color: #00d4ff !important; outline: none !important; box-shadow: 0 0 0 3px rgba(0,212,255,0.07) !important; }
        input::placeholder { color: #444 !important; }
        button { font-family: 'Inter',sans-serif; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.95); z-index: 200; display: flex; align-items: center; justify-content: center; padding: 20px; animation: fadeIn 0.15s; }
        .modal-box { background: #080808; border: 1px solid #1a1a1a; border-radius: 20px; max-width: 500px; width: 100%; max-height: 84vh; overflow-y: auto; padding: 34px; position: relative; }
        ::-webkit-scrollbar { width: 3px; } ::-webkit-scrollbar-track { background: #000; } ::-webkit-scrollbar-thumb { background: #222; }
      `}</style>

      {/* TOAST */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 300, padding: '12px 18px', borderRadius: 10, background: '#0a0a0a', border: `1px solid ${toast.type === 'error' ? '#ef4444' : '#10b981'}`, color: toast.type === 'error' ? '#ef4444' : '#10b981', fontWeight: 600, fontSize: 13, animation: 'slideUp 0.25s', display: 'flex', alignItems: 'center', gap: 8 }}>
          {toast.type === 'success' ? '✓' : '✕'} {toast.msg}
        </div>
      )}

      {/* TERMS MODAL */}
      {showTerms && (
        <div className="modal-overlay" onClick={() => setShowTerms(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>Terms of Service</h2>
              <button onClick={() => setShowTerms(false)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
            <div style={{ color: '#888', fontSize: 13, lineHeight: 1.85 }}>
              {[['1. Acceptance','By accessing ClearStatement, you agree to these terms.'],['2. Service','ClearStatement provides smart bank statement analysis for financial verification. Results are informational and not a substitute for professional financial advice.'],['3. Data Privacy','Uploaded documents are processed in real-time and immediately deleted. We do not store, share, or sell your financial data.'],['4. Accuracy','Data should be verified by a qualified professional before making lending decisions.'],['5. Contact','clearstatement.billing@gmail.com']].map(([t,b]) => (
                <div key={t} style={{ marginBottom: 14 }}><div style={{ color: '#ccc', fontWeight: 600, marginBottom: 3 }}>{t}</div><div>{b}</div></div>
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
              <button onClick={() => setShowPrivacy(false)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
            <div style={{ color: '#888', fontSize: 13, lineHeight: 1.85 }}>
              {[['Data We Collect','We collect your email for authentication and temporarily process PDFs for analysis. No financial data is retained.'],['How We Use Data','Email is used for account management only. PDFs are processed in-memory and deleted immediately after analysis.'],['Third Parties','Groq for analysis, Supabase for auth, Vercel for hosting.'],['Your Rights','Request account deletion: clearstatement.billing@gmail.com']].map(([t,b]) => (
                <div key={t} style={{ marginBottom: 14 }}><div style={{ color: '#ccc', fontWeight: 600, marginBottom: 3 }}>{t}</div><div>{b}</div></div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* QR PAYMENT MODAL */}
      {selectedPlan && (
        <div className="modal-overlay" onClick={() => setSelectedPlan(null)}>
          <div className="modal-box" style={{ textAlign: 'center', maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedPlan(null)} style={{ position: 'absolute', top: 18, right: 18, background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 18 }}>✕</button>
            <div style={{ fontSize: 10, color: '#00d4ff', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>{selectedPlan.label} PLAN</div>
            <div style={{ fontSize: 38, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em', marginBottom: 4 }}>{selectedPlan.price}</div>
            <div style={{ fontSize: 13, color: '#666', marginBottom: 24 }}>{selectedPlan.scans}</div>
            <div style={{ background: '#fff', borderRadius: 14, padding: 14, display: 'inline-block', marginBottom: 18 }}>
              <img src="/qr.png" alt="UPI QR Code" style={{ width: 190, height: 190, display: 'block' }} />
            </div>
            <div style={{ fontSize: 14, color: '#ccc', marginBottom: 4, fontWeight: 500 }}>Scan with any UPI app</div>
            <div style={{ fontSize: 12, color: '#555', marginBottom: 22 }}>PhonePe · GPay · Paytm · BHIM</div>
            <div style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 12, padding: 16, marginBottom: 16, textAlign: 'left' }}>
              <div style={{ fontSize: 13, color: '#888', marginBottom: 6 }}>After payment, email your transaction ID to:</div>
              <div style={{ fontSize: 14, color: '#00d4ff', fontWeight: 700, marginBottom: 6 }}>clearstatement.billing@gmail.com</div>
              <div style={{ fontSize: 12, color: '#555' }}>Scans activated within 2 hours</div>
            </div>
            <button onClick={() => setSelectedPlan(null)} style={{ width: '100%', background: 'none', border: '1px solid #1a1a1a', color: '#666', padding: '11px', borderRadius: 10, cursor: 'pointer', fontSize: 13 }}>Close</button>
          </div>
        </div>
      )}

      {/* NAVBAR */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid #111', padding: '0 28px', height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
              <img src={user.user_metadata?.avatar_url} style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid #222' }} alt="Profile" />
              <button onClick={signOut} style={{ background: 'none', border: '1px solid #1a1a1a', color: '#888', padding: '5px 13px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>Sign out</button>
            </>
          ) : (
            <button onClick={signInWithGoogle} style={{ background: '#00d4ff', color: '#000', border: 'none', padding: '7px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Sign In</button>
          )}
        </div>
      </nav>

      {/* BANK TICKER */}
      <div style={{ background: '#020202', borderBottom: '1px solid #0d0d0d', padding: '7px 0', overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 60, background: 'linear-gradient(to right, #020202, transparent)', zIndex: 2 }} />
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 60, background: 'linear-gradient(to left, #020202, transparent)', zIndex: 2 }} />
        <div style={{ display: 'flex', animation: 'ticker 30s linear infinite', width: 'max-content' }}>
          {[...SUPPORTED_BANKS, ...SUPPORTED_BANKS].map((bank, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0 22px', whiteSpace: 'nowrap' }}>
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#00d4ff', opacity: 0.4 }} />
              <span style={{ fontSize: 10, color: '#444', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{bank}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1060, margin: '0 auto', padding: '0 22px' }}>

        {/* MAIN PAGE */}
        {!showPaywall && !showSignupWall && !result && (
          <div style={{ paddingBottom: 100 }}>

            {/* HERO — full viewport height, upload centered */}
            {/* CHANGED: removed paddingTop/paddingBottom, set to 0 so it's truly centered */}
            <div style={{ minHeight: 'calc(100vh - 115px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 0, paddingBottom: 0 }}>

              {/* BADGE */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.12)', borderRadius: 20, padding: '4px 13px', marginBottom: 22 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#00d4ff', animation: 'dot-glow 2s infinite' }} />
                <span style={{ fontSize: 10, color: '#00d4ff', fontWeight: 600, letterSpacing: '0.09em' }}>INSTANT · SECURE · ACCURATE</span>
              </div>

              <h1 style={{ fontSize: 'clamp(28px, 5vw, 58px)', fontWeight: 800, textAlign: 'center', lineHeight: 1.1, letterSpacing: '-0.035em', color: '#fff', marginBottom: 16, maxWidth: 700 }}>
                Bank Statement Analysis<br />
                <span style={{ background: 'linear-gradient(135deg, #00d4ff 0%, #0055cc 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>In Under 60 Seconds.</span>
              </h1>

              <p style={{ textAlign: 'center', fontSize: 16, color: '#888', maxWidth: 440, margin: '0 auto 36px', lineHeight: 1.7 }}>
                Verify income, detect EMIs, flag bounced cheques — any Indian bank, with or without password.
              </p>

              {/* STATS */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 36, marginBottom: 40, flexWrap: 'wrap' }}>
                {[['12+','Banks Supported'],['99.2%','Accuracy'],['< 60s','Analysis Time'],['0','Data Retained']].map(([v,l]) => (
                  <div key={l} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.025em' }}>{v}</div>
                    <div style={{ fontSize: 10, color: '#555', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 3 }}>{l}</div>
                  </div>
                ))}
              </div>

              {/* UPLOAD BOX */}
              <div style={{ width: '100%', maxWidth: 540 }}>
                {/* CHANGED: blue glowing border on outer box */}
                <div style={{
                  background: '#070707',
                  border: '1px solid rgba(0,212,255,0.28)',
                  borderRadius: 18,
                  padding: 24,
                  boxShadow: '0 0 40px rgba(0,212,255,0.09), 0 0 0 1px rgba(0,212,255,0.03)'
                }}>
                  <label
                    onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f?.type === 'application/pdf') setFile(f) }}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      height: 160,
                      // CHANGED: always visible blue dashed border, brighter on hover/file
                      border: `2px dashed ${dragOver ? '#00d4ff' : file ? '#00d4ff' : 'rgba(0,212,255,0.35)'}`,
                      borderRadius: 12,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      // CHANGED: subtle blue tint background
                      background: dragOver ? 'rgba(0,212,255,0.04)' : file ? 'rgba(0,212,255,0.02)' : 'rgba(0,212,255,0.015)',
                      marginBottom: 14
                    }}
                  >
                    {file ? (
                      <div style={{ textAlign: 'center', padding: 14 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                          <svg width="18" height="18" fill="none" stroke="#00d4ff" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                        </div>
                        <div style={{ color: '#ddd', fontWeight: 600, fontSize: 13, marginBottom: 3, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                        <div style={{ color: '#00d4ff', fontSize: 10, fontWeight: 600, letterSpacing: '0.07em' }}>PDF ATTACHED · {(file.size/1024).toFixed(0)} KB</div>
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: 14 }}>
                        {/* CHANGED: icon box now has blue tint to match border */}
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(0,212,255,0.07)', border: '1px solid rgba(0,212,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', animation: 'float 3s ease-in-out infinite' }}>
                          <svg width="18" height="18" fill="none" stroke="#00d4ff" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                        </div>
                        <div style={{ color: '#bbb', fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Drop your bank statement here</div>
                        <div style={{ color: '#555', fontSize: 12 }}>or click to browse · PDF only</div>
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
                    <div style={{ marginBottom: 12, background: '#050505', border: '1px solid #141414', borderRadius: 11, padding: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 9 }}>
                        <span style={{ fontSize: 12, color: '#00d4ff', fontWeight: 500 }}>{loadingText}</span>
                        <span style={{ fontSize: 12, color: '#fff', fontWeight: 700 }}>{Math.round(progress)}%</span>
                      </div>
                      <div style={{ height: 2, background: '#111', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #00d4ff, #0055cc)', borderRadius: 2, transition: 'width 0.6s ease' }} />
                      </div>
                    </div>
                  )}

                  {!loading && (
                    <div style={{ display: 'flex', gap: 9 }}>
                      <button onClick={handleUpload} disabled={!file} style={{ flex: 1, padding: '12px 18px', borderRadius: 10, fontSize: 14, background: file ? '#00d4ff' : '#0d0d0d', color: file ? '#000' : '#444', border: file ? 'none' : '1px solid #1a1a1a', cursor: file ? 'pointer' : 'not-allowed', fontWeight: 700, transition: 'all 0.15s' }}>
                        {!user ? '⚡ Analyse Free' : '⚡ Run Analysis'}
                      </button>
                      {file && <button onClick={() => { setFile(null); setPdfPassword('') }} style={{ background: 'none', border: '1px solid #1a1a1a', color: '#666', padding: '12px 16px', borderRadius: 10, cursor: 'pointer', fontSize: 13 }}>Clear</button>}
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, marginTop: 14, paddingTop: 14, borderTop: '1px solid #111' }}>
                    {[['🔐','256-bit SSL'],['🗑️','Deleted instantly'],['🇮🇳','Indian banks']].map(([icon,label]) => (
                      <div key={label as string} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 11 }}>{icon}</span>
                        <span style={{ fontSize: 10, color: '#555', fontWeight: 500 }}>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {!user && (
                  <p style={{ textAlign: 'center', fontSize: 12, color: '#444', marginTop: 12 }}>
                    1 free scan without signup · Sign in for 2 more free scans
                  </p>
                )}
              </div>
            </div>

            {/* REVIEWS */}
            <div style={{ marginTop: 20, paddingTop: 80, borderTop: '1px solid #0d0d0d' }}>
              <div style={{ textAlign: 'center', marginBottom: 36 }}>
                <div style={{ fontSize: 10, color: '#00d4ff', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 9 }}>Trusted by Professionals</div>
                <h2 style={{ fontSize: 'clamp(20px, 3vw, 30px)', fontWeight: 700, color: '#fff', letterSpacing: '-0.025em' }}>What underwriters say</h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                {REVIEWS.map((r, i) => (
                  // CHANGED: slightly brighter border + inset highlight
                  <div key={i} style={{ background: '#060606', border: '1px solid #1e1e1e', borderRadius: 14, padding: 20, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)' }}>
                    <div style={{ display: 'flex', gap: 2, marginBottom: 10 }}>{'★★★★★'.split('').map((s,j) => <span key={j} style={{ color: '#f59e0b', fontSize: 12 }}>{s}</span>)}</div>
                    <p style={{ color: '#777', fontSize: 13, lineHeight: 1.7, marginBottom: 16, fontStyle: 'italic' }}>"{r.text}"</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#0d0d0d', border: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#00d4ff' }}>{r.avatar}</div>
                      <div>
                        <div style={{ color: '#ccc', fontWeight: 600, fontSize: 12 }}>{r.name}</div>
                        <div style={{ color: '#555', fontSize: 11 }}>{r.role}</div>
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
                  // CHANGED: slightly brighter border + inset highlight
                  <div key={item.n} style={{ background: '#060606', border: '1px solid #1e1e1e', borderRadius: 14, padding: 24, textAlign: 'left', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.025)' }}>
                    <div style={{ fontSize: 36, fontWeight: 800, color: '#111', marginBottom: 12, lineHeight: 1, letterSpacing: '-0.04em' }}>{item.n}</div>
                    <div style={{ color: '#ccc', fontWeight: 600, fontSize: 14, marginBottom: 7 }}>{item.t}</div>
                    <div style={{ color: '#666', fontSize: 12, lineHeight: 1.65 }}>{item.d}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* PRICING */}
            <div style={{ marginTop: 90, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: '#00d4ff', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 9 }}>Pricing</div>
              <h2 style={{ fontSize: 'clamp(20px, 3vw, 30px)', fontWeight: 700, color: '#fff', marginBottom: 8, letterSpacing: '-0.025em' }}>Simple, transparent pricing</h2>
              <p style={{ color: '#666', fontSize: 13, marginBottom: 36 }}>Pay once, no subscription. Scans never expire.</p>
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
                <div key={card.label} style={{ background: '#060606', border: '1px solid #111', borderRadius: 14, padding: 22 }}>
                  <div style={{ fontSize: 9, color: '#444', fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 9 }}>{card.label}</div>
                  <div style={{ fontSize: 30, fontWeight: 800, color: card.color, marginBottom: 5, letterSpacing: '-0.025em' }}>{card.value}</div>
                  <div style={{ fontSize: 11, color: '#555' }}>{card.sub}</div>
                </div>
              ))}
              {result.summary && (
                <div style={{ background: '#060606', border: '1px solid #111', borderRadius: 14, padding: 22, gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: 9, color: '#444', fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 9 }}>Smart Summary</div>
                  <div style={{ color: '#888', fontSize: 13, lineHeight: 1.7 }}>{result.summary}</div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={goHome} style={{ background: 'none', border: '1px solid #1a1a1a', color: '#666', padding: '10px 20px', borderRadius: 10, cursor: 'pointer', fontSize: 13 }}>← Analyse Another</button>
            </div>
          </div>
        )}

        {/* SIGNUP WALL */}
        {showSignupWall && (
          <div style={{ paddingTop: 110, paddingBottom: 80, textAlign: 'center', maxWidth: 400, margin: '0 auto', animation: 'slideUp 0.3s' }}>
            <div style={{ fontSize: 42, marginBottom: 18 }}>🔒</div>
            <h2 style={{ fontSize: 26, fontWeight: 700, color: '#fff', marginBottom: 9, letterSpacing: '-0.025em' }}>Create a free account</h2>
            <p style={{ color: '#777', fontSize: 14, marginBottom: 28, lineHeight: 1.65 }}>You have used your guest scan. Sign in to get 2 more free scans — no card required.</p>
            <button onClick={signInWithGoogle} style={{ background: '#00d4ff', color: '#000', border: 'none', padding: '12px 26px', borderRadius: 11, cursor: 'pointer', fontSize: 15, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 9 }}>
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
              <p style={{ color: '#666', fontSize: 13 }}>Pay once. Scans never expire.</p>
            </div>
            <PricingGrid />
            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <button onClick={goHome} style={{ background: 'none', border: 'none', color: '#444', fontSize: 13, cursor: 'pointer' }}>← Go back</button>
            </div>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid #0d0d0d', background: '#000', padding: '40px 28px 24px', marginTop: 40 }}>
        <div style={{ maxWidth: 1060, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 28, marginBottom: 36 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
                <div style={{ width: 24, height: 24, background: 'linear-gradient(135deg, #00d4ff, #0055cc)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#fff', fontWeight: 800, fontSize: 12 }}>C</span>
                </div>
                <span style={{ fontWeight: 700, fontSize: 14, color: '#ddd', letterSpacing: '-0.02em' }}>ClearStatement</span>
              </div>
              <p style={{ color: '#333', fontSize: 11, maxWidth: 200, lineHeight: 1.65 }}>Smart bank statement analysis for Indian financial professionals.</p>
            </div>
            <div style={{ display: 'flex', gap: 44, flexWrap: 'wrap' }}>
              <div>
                <div style={{ color: '#333', fontSize: 9, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 12 }}>Legal</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  <button onClick={() => setShowPrivacy(true)} style={{ background: 'none', border: 'none', color: '#555', fontSize: 11, cursor: 'pointer', textAlign: 'left', padding: 0 }}>Privacy Policy</button>
                  <button onClick={() => setShowTerms(true)} style={{ background: 'none', border: 'none', color: '#555', fontSize: 11, cursor: 'pointer', textAlign: 'left', padding: 0 }}>Terms of Service</button>
                </div>
              </div>
              <div>
                <div style={{ color: '#333', fontSize: 9, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 12 }}>Support</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  <a href="mailto:clearstatement.billing@gmail.com" style={{ color: '#555', fontSize: 11, textDecoration: 'none' }}>Contact Us</a>
                  <span style={{ color: '#333', fontSize: 10 }}>clearstatement.billing@gmail.com</span>
                </div>
              </div>
            </div>
          </div>
          <div style={{ borderTop: '1px solid #0d0d0d', paddingTop: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ color: '#333', fontSize: 10 }}>© 2026 ClearStatement. All rights reserved.</span>
            <span style={{ color: '#333', fontSize: 10 }}>Engineered by <span style={{ color: '#00d4ff', fontWeight: 600 }}>TheArise</span></span>
          </div>
        </div>
      </footer>
    </div>
  )
}



