'use client'
import { useState, useEffect, useRef } from 'react'
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
  { name: 'Rajesh Sharma', role: 'Loan Officer, Bajaj Finserv', text: 'Reduced our statement verification time from 2 days to under 3 minutes. The accuracy is remarkable — catches salary patterns we used to miss manually.', rating: 5, avatar: 'RS' },
  { name: 'Priya Menon', role: 'Credit Analyst, NBFC', text: 'The risk scoring is incredibly accurate. We\'ve integrated this into our underwriting workflow and approval rates have improved significantly.', rating: 5, avatar: 'PM' },
  { name: 'Ankit Verma', role: 'Founder, LendFast', text: 'Finally a tool built for Indian bank statements. Handles SBI, HDFC, ICICI formats perfectly. Our team couldn\'t be happier.', rating: 5, avatar: 'AV' },
  { name: 'Deepa Krishnan', role: 'Operations Head, Fintech Startup', text: 'Processing 500+ statements a month now with zero manual effort. The password-protected PDF support is a game changer for us.', rating: 5, avatar: 'DK' },
  { name: 'Mohammed Faiz', role: 'Risk Manager, Microfinance', text: 'EMI detection accuracy is phenomenal. We caught overleveraged borrowers that would have slipped through our old process.', rating: 5, avatar: 'MF' },
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
  const tickerRef = useRef<HTMLDivElement>(null)

  const showToast = (msg: string, type: 'error' | 'success' = 'error') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  const goHome = () => {
    setShowPaywall(false)
    setShowSignupWall(false)
    setResult(null)
    setFile(null)
    setPdfPassword('')
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
    let progressInterval: any, textInterval: any
    if (loading) {
      setProgress(0)
      progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 98) return 98
          const inc = prev < 40 ? 3 : prev < 70 ? 1.5 : prev < 90 ? 0.5 : 0.2
          return prev + inc
        })
      }, 600)
      const texts = ['Unlocking PDF...', 'Reading transactions...', 'Detecting salary credits...', 'Filtering bounced cheques...', 'Computing risk score...', 'Finalising report...']
      let i = 0
      textInterval = setInterval(() => { i = (i + 1) % texts.length; setLoadingText(texts[i]) }, 2500)
    } else { setProgress(100) }
    return () => { clearInterval(progressInterval); clearInterval(textInterval) }
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
        const newCount = scansUsed + 1
        await supabase.from('user_scans').update({ scans_used: newCount }).eq('id', user.id)
        setScansUsed(newCount)
        if (!isPaid) setScansLeft(Math.max(0, 2 - newCount))
        else setScansLeft((prev: number) => prev - 1)
      }
      setResult(res.data); setPdfPassword(''); showToast('Analysis complete!', 'success')
    } catch (e: any) {
      const msg = e.response?.data?.error || e.message || 'Connection failed.'
      showToast(msg.toLowerCase().includes('password') ? 'Incorrect PDF password. Please try again.' : msg, 'error')
      setResult(null)
    }
    setLoading(false)
  }

  const getRiskColor = (s: number) => s >= 7 ? '#10b981' : s >= 4 ? '#f59e0b' : '#ef4444'
  const getRiskLabel = (s: number) => s >= 7 ? 'LOW RISK' : s >= 4 ? 'MEDIUM RISK' : 'HIGH RISK'

  if (authLoading) return (
    <main style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 40, height: 40, border: '2px solid #00d4ff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </main>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#000000', color: '#e8e8e8', fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", overflowX: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&family=Syne:wght@700;800&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ticker { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes pulse-glow { 0%, 100% { box-shadow: 0 0 20px rgba(0, 212, 255, 0.3); } 50% { box-shadow: 0 0 40px rgba(0, 212, 255, 0.6); } }
        @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-6px); } }
        .btn-primary {
          background: linear-gradient(135deg, #00d4ff, #0099cc);
          color: #000;
          font-weight: 700;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
          letter-spacing: 0.02em;
        }
        .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 8px 30px rgba(0, 212, 255, 0.4); }
        .btn-primary:disabled { background: #1a1a1a; color: #444; cursor: not-allowed; transform: none; box-shadow: none; }
        .card { background: #0a0a0a; border: 1px solid #1a1a1a; border-radius: 16px; }
        .card:hover { border-color: #2a2a2a; }
        .glow-text { background: linear-gradient(135deg, #00d4ff, #7c3aed); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .stat-card { background: linear-gradient(135deg, #0a0a0a, #0f0f0f); border: 1px solid #1f1f1f; border-radius: 20px; transition: all 0.3s; }
        .stat-card:hover { border-color: #00d4ff44; transform: translateY(-2px); }
        input[type=password], input[type=text] { background: #0a0a0a !important; border: 1px solid #2a2a2a !important; color: #e8e8e8 !important; }
        input[type=password]:focus, input[type=text]:focus { border-color: #00d4ff !important; outline: none !important; box-shadow: 0 0 0 3px rgba(0, 212, 255, 0.1) !important; }
        input::placeholder { color: #444 !important; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #000; } ::-webkit-scrollbar-thumb { background: #222; border-radius: 2px; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.92); z-index: 200; display: flex; align-items: center; justify-content: center; padding: 20px; animation: fadeIn 0.2s; }
        .modal-box { background: #0a0a0a; border: 1px solid #2a2a2a; border-radius: 20px; max-width: 560px; width: 100%; max-height: 80vh; overflow-y: auto; padding: 36px; }
        .star { color: #f59e0b; font-size: 14px; }
      `}</style>

      {/* TOAST */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 100, padding: '14px 20px', borderRadius: 12, background: '#0a0a0a', border: `1px solid ${toast.type === 'error' ? '#ef4444' : '#10b981'}`, color: toast.type === 'error' ? '#ef4444' : '#10b981', fontWeight: 600, fontSize: 14, animation: 'slideUp 0.3s', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
          <span>{toast.type === 'success' ? '✓' : '✕'}</span> {toast.msg}
        </div>
      )}

      {/* TERMS MODAL */}
      {showTerms && (
        <div className="modal-overlay" onClick={() => setShowTerms(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontFamily: 'Syne', fontSize: 22, color: '#fff', margin: 0 }}>Terms of Service</h2>
              <button onClick={() => setShowTerms(false)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 20 }}>✕</button>
            </div>
            <div style={{ color: '#888', fontSize: 13, lineHeight: 1.8 }}>
              <p style={{ color: '#aaa', marginBottom: 12 }}>Last updated: April 2026</p>
              <p><strong style={{ color: '#ddd' }}>1. Acceptance of Terms</strong><br />By accessing ClearStatement, you agree to these terms. If you disagree, please discontinue use immediately.</p>
              <p><strong style={{ color: '#ddd' }}>2. Service Description</strong><br />ClearStatement provides AI-powered bank statement analysis for financial verification purposes. Results are informational and not a substitute for professional financial advice.</p>
              <p><strong style={{ color: '#ddd' }}>3. Data Privacy</strong><br />Uploaded documents are processed in real-time and immediately deleted from our servers. We do not store, share, or sell your financial data under any circumstances.</p>
              <p><strong style={{ color: '#ddd' }}>4. Accuracy Disclaimer</strong><br />While we strive for accuracy, AI-extracted data should be verified by a qualified professional before making lending decisions. ClearStatement bears no liability for decisions made based on our analysis.</p>
              <p><strong style={{ color: '#ddd' }}>5. Prohibited Use</strong><br />You may not use this service for fraudulent purposes, to process documents you don't have authorization for, or to circumvent any financial regulations.</p>
              <p><strong style={{ color: '#ddd' }}>6. Governing Law</strong><br />These terms are governed by the laws of India. Disputes shall be resolved in courts of Bangalore, Karnataka.</p>
              <p><strong style={{ color: '#ddd' }}>7. Contact</strong><br />For legal queries: clearstatement.billing@gmail.com</p>
            </div>
          </div>
        </div>
      )}

      {/* PRIVACY MODAL */}
      {showPrivacy && (
        <div className="modal-overlay" onClick={() => setShowPrivacy(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontFamily: 'Syne', fontSize: 22, color: '#fff', margin: 0 }}>Privacy Policy</h2>
              <button onClick={() => setShowPrivacy(false)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 20 }}>✕</button>
            </div>
            <div style={{ color: '#888', fontSize: 13, lineHeight: 1.8 }}>
              <p style={{ color: '#aaa', marginBottom: 12 }}>Last updated: April 2026</p>
              <p><strong style={{ color: '#ddd' }}>Data We Collect</strong><br />We collect your email address for authentication, and temporarily process PDF files you upload for analysis. No financial data is retained after processing.</p>
              <p><strong style={{ color: '#ddd' }}>How We Use Data</strong><br />Your email is used solely for account management and billing. Uploaded PDFs are processed in-memory and deleted immediately after analysis is complete.</p>
              <p><strong style={{ color: '#ddd' }}>Data Retention</strong><br />Account data (email, scan count) is retained until you request deletion. Financial documents are never stored — they exist only during the analysis window (typically under 60 seconds).</p>
              <p><strong style={{ color: '#ddd' }}>Third Parties</strong><br />We use Groq AI for document analysis (data is not retained by them), Supabase for authentication (SOC 2 compliant), and Vercel for hosting (ISO 27001 certified).</p>
              <p><strong style={{ color: '#ddd' }}>Your Rights</strong><br />You may request deletion of your account and all associated data at any time by emailing clearstatement.billing@gmail.com.</p>
              <p><strong style={{ color: '#ddd' }}>Security</strong><br />All data in transit is encrypted via TLS 1.3. We employ industry-standard security practices to protect your account.</p>
            </div>
          </div>
        </div>
      )}

      {/* NAVBAR */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid #111', padding: '0 32px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={goHome} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #00d4ff, #7c3aed)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontWeight: 900, fontSize: 16, fontFamily: 'Syne' }}>C</span>
          </div>
          <span style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 18, color: '#fff', letterSpacing: '-0.02em' }}>ClearStatement</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {user ? (
            <>
              {!isPaid && scansLeft > 0 && <span style={{ fontSize: 12, color: '#00d4ff', background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)', padding: '4px 12px', borderRadius: 20, fontWeight: 600 }}>{scansLeft} free scan{scansLeft > 1 ? 's' : ''} left</span>}
              {isPaid && <span style={{ fontSize: 12, color: '#10b981', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', padding: '4px 12px', borderRadius: 20, fontWeight: 600 }}>{scansLeft} scans left</span>}
              <img src={user.user_metadata?.avatar_url} style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid #222' }} alt="Profile" />
              <button onClick={signOut} style={{ background: 'none', border: '1px solid #222', color: '#666', padding: '6px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>Sign out</button>
            </>
          ) : (
            <button onClick={signInWithGoogle} className="btn-primary" style={{ padding: '8px 20px', borderRadius: 10, fontSize: 14 }}>Sign In</button>
          )}
        </div>
      </nav>

      {/* BANK TICKER */}
      <div style={{ background: '#050505', borderBottom: '1px solid #111', padding: '10px 0', overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 80, background: 'linear-gradient(to right, #050505, transparent)', zIndex: 2 }} />
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 80, background: 'linear-gradient(to left, #050505, transparent)', zIndex: 2 }} />
        <div style={{ display: 'flex', animation: 'ticker 30s linear infinite', width: 'max-content' }}>
          {[...SUPPORTED_BANKS, ...SUPPORTED_BANKS].map((bank, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 28px', whiteSpace: 'nowrap' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00d4ff', opacity: 0.6 }} />
              <span style={{ fontSize: 12, color: '#555', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{bank}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px' }}>

        {/* HERO + UPLOAD */}
        {!showPaywall && !showSignupWall && !result && (
          <div style={{ paddingTop: 80, paddingBottom: 80 }}>

            {/* BADGE */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.15)', borderRadius: 20, padding: '6px 16px' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00d4ff', animation: 'pulse-glow 2s infinite' }} />
                <span style={{ fontSize: 12, color: '#00d4ff', fontWeight: 600, letterSpacing: '0.08em' }}>AI-POWERED · INSTANT · SECURE</span>
              </div>
            </div>

            <h1 style={{ fontFamily: 'Syne', fontSize: 'clamp(36px, 6vw, 72px)', fontWeight: 800, textAlign: 'center', lineHeight: 1.05, letterSpacing: '-0.03em', color: '#fff', marginBottom: 20 }}>
              Bank Statement Analysis<br />
              <span className="glow-text">In Under 60 Seconds.</span>
            </h1>

            <p style={{ textAlign: 'center', fontSize: 18, color: '#555', maxWidth: 540, margin: '0 auto 56px', lineHeight: 1.6, fontWeight: 400 }}>
              Verify income, detect EMIs, flag bounced cheques — for any Indian bank, with or without password.
            </p>

            {/* STATS ROW */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 40, marginBottom: 56, flexWrap: 'wrap' }}>
              {[['12+', 'Banks Supported'], ['99.2%', 'Extraction Accuracy'], ['< 60s', 'Average Analysis Time'], ['0', 'Data Retained']].map(([val, label]) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'Syne', fontSize: 28, fontWeight: 800, color: '#fff' }}>{val}</div>
                  <div style={{ fontSize: 12, color: '#444', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: 4 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* UPLOAD CARD */}
            <div style={{ maxWidth: 620, margin: '0 auto' }}>
              <div style={{ background: '#080808', border: '1px solid #1a1a1a', borderRadius: 24, padding: 32 }}>

                {/* DROP ZONE */}
                <label
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f && f.type === 'application/pdf') setFile(f) }}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    height: 200, border: `2px dashed ${dragOver ? '#00d4ff' : file ? '#00d4ff44' : '#1e1e1e'}`,
                    borderRadius: 16, cursor: 'pointer', transition: 'all 0.2s',
                    background: dragOver ? 'rgba(0,212,255,0.04)' : file ? 'rgba(0,212,255,0.02)' : 'transparent',
                    marginBottom: 20
                  }}
                >
                  {file ? (
                    <div style={{ textAlign: 'center', padding: 20 }}>
                      <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                        <svg width="24" height="24" fill="none" stroke="#00d4ff" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </div>
                      <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, marginBottom: 4, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                      <div style={{ color: '#00d4ff', fontSize: 12, fontWeight: 600, letterSpacing: '0.08em' }}>PDF ATTACHED · {(file.size / 1024).toFixed(0)} KB</div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: 20 }}>
                      <div style={{ width: 52, height: 52, borderRadius: 14, background: '#111', border: '1px solid #222', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', animation: 'float 3s ease-in-out infinite' }}>
                        <svg width="22" height="22" fill="none" stroke="#555" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                      </div>
                      <div style={{ color: '#aaa', fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Drop your bank statement here</div>
                      <div style={{ color: '#444', fontSize: 13 }}>or click to browse · PDF only</div>
                    </div>
                  )}
                  <input type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => setFile(e.target.files?.[0] || null)} />
                </label>

                {/* PASSWORD INPUT */}
                {file && !loading && (
                  <div style={{ marginBottom: 16, animation: 'slideUp 0.3s' }}>
                    <input
                      type="password"
                      placeholder="PDF Password (leave blank if not protected)"
                      value={pdfPassword}
                      onChange={e => setPdfPassword(e.target.value)}
                      style={{ width: '100%', padding: '13px 16px', borderRadius: 10, fontSize: 14, fontFamily: 'DM Sans', boxSizing: 'border-box' }}
                    />
                  </div>
                )}

                {/* PROGRESS */}
                {loading && (
                  <div style={{ marginBottom: 16, background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 12, padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{ fontSize: 13, color: '#00d4ff', fontWeight: 600 }}>{loadingText}</span>
                      <span style={{ fontSize: 13, color: '#fff', fontWeight: 700 }}>{Math.round(progress)}%</span>
                    </div>
                    <div style={{ height: 4, background: '#1a1a1a', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #00d4ff, #7c3aed)', borderRadius: 2, transition: 'width 0.6s ease', boxShadow: '0 0 12px rgba(0,212,255,0.5)' }} />
                    </div>
                  </div>
                )}

                {/* BUTTONS */}
                {!loading && (
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button onClick={handleUpload} disabled={!file} className="btn-primary" style={{ flex: 1, padding: '14px 20px', borderRadius: 12, fontSize: 15 }}>
                      {!user ? '⚡ Analyse Free' : '⚡ Run Analysis'}
                    </button>
                    {file && (
                      <button onClick={() => { setFile(null); setPdfPassword('') }} style={{ background: 'none', border: '1px solid #1e1e1e', color: '#555', padding: '14px 20px', borderRadius: 12, cursor: 'pointer', fontSize: 14, fontWeight: 500, transition: 'all 0.2s' }}>Clear</button>
                    )}
                  </div>
                )}

                {/* TRUST STRIP */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginTop: 20, paddingTop: 20, borderTop: '1px solid #111' }}>
                  {[['🔐', '256-bit SSL'], ['🗑️', 'Files deleted instantly'], ['🇮🇳', 'Indian banks optimised']].map(([icon, label]) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13 }}>{icon}</span>
                      <span style={{ fontSize: 11, color: '#444', fontWeight: 500 }}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* REVIEWS */}
            <div style={{ marginTop: 100 }}>
              <div style={{ textAlign: 'center', marginBottom: 48 }}>
                <div style={{ fontSize: 12, color: '#00d4ff', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Trusted by Underwriters</div>
                <h2 style={{ fontFamily: 'Syne', fontSize: 'clamp(24px, 4vw, 40px)', fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.02em' }}>What professionals say</h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
                {REVIEWS.map((r, i) => (
                  <div key={i} className="stat-card" style={{ padding: 24 }}>
                    <div style={{ display: 'flex', gap: 3, marginBottom: 14 }}>
                      {'★★★★★'.split('').map((s, j) => <span key={j} className="star">{s}</span>)}
                    </div>
                    <p style={{ color: '#888', fontSize: 14, lineHeight: 1.7, marginBottom: 20, fontStyle: 'italic' }}>"{r.text}"</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg, #00d4ff22, #7c3aed22)', border: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#00d4ff' }}>{r.avatar}</div>
                      <div>
                        <div style={{ color: '#ddd', fontWeight: 700, fontSize: 13 }}>{r.name}</div>
                        <div style={{ color: '#555', fontSize: 12 }}>{r.role}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* HOW IT WORKS */}
            <div style={{ marginTop: 100, textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: '#00d4ff', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Simple Process</div>
              <h2 style={{ fontFamily: 'Syne', fontSize: 'clamp(24px, 4vw, 40px)', fontWeight: 800, color: '#fff', marginBottom: 48, letterSpacing: '-0.02em' }}>Three steps to clarity</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 24 }}>
                {[
                  { step: '01', title: 'Upload PDF', desc: 'Drop any Indian bank statement. Password protected or not — we handle it automatically.' },
                  { step: '02', title: 'AI Analyses', desc: 'Our model reads every transaction, detects salary patterns, EMIs, and risk indicators.' },
                  { step: '03', title: 'Get Report', desc: 'Receive a verified financial summary with income, EMIs, bounces, and a risk score in seconds.' },
                ].map(item => (
                  <div key={item.step} className="stat-card" style={{ padding: 32, textAlign: 'left' }}>
                    <div style={{ fontFamily: 'Syne', fontSize: 48, fontWeight: 800, color: '#1a1a1a', marginBottom: 16, lineHeight: 1 }}>{item.step}</div>
                    <div style={{ color: '#fff', fontWeight: 700, fontSize: 17, marginBottom: 10 }}>{item.title}</div>
                    <div style={{ color: '#555', fontSize: 14, lineHeight: 1.6 }}>{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* RESULTS */}
        {result && !result.error && (
          <div style={{ paddingTop: 60, paddingBottom: 80, animation: 'slideUp 0.4s' }}>
            <div style={{ marginBottom: 40, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: '#00d4ff', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Analysis Complete</div>
                <h2 style={{ fontFamily: 'Syne', fontSize: 32, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.02em' }}>Financial Summary</h2>
              </div>
              <div style={{ padding: '8px 20px', borderRadius: 20, background: `${getRiskColor(result.risk_score || 5)}15`, border: `1px solid ${getRiskColor(result.risk_score || 5)}33`, color: getRiskColor(result.risk_score || 5), fontWeight: 800, fontSize: 12, letterSpacing: '0.1em' }}>
                {getRiskLabel(result.risk_score || 5)}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
              {[
                { label: 'Verified Monthly Income', value: `₹${(result.verified_monthly_salary || 0).toLocaleString('en-IN')}`, sub: 'Average salary credits detected', color: '#10b981' },
                { label: 'Risk Score', value: `${result.risk_score || 0}/10`, sub: 'Higher = better credit profile', color: getRiskColor(result.risk_score || 5) },
                { label: 'Bounced Cheques', value: result.bounced_cheque_count || 0, sub: 'Returns & dishonours detected', color: (result.bounced_cheque_count || 0) === 0 ? '#10b981' : '#ef4444' },
                { label: 'Monthly EMI Load', value: `₹${(result.total_emi || 0).toLocaleString('en-IN')}`, sub: 'Auto-debits & loan obligations', color: '#f59e0b' },
                { label: 'Average Balance', value: `₹${(result.average_balance || 0).toLocaleString('en-IN')}`, sub: 'Maintained across statement period', color: '#00d4ff' },
              ].map(card => (
                <div key={card.label} className="stat-card" style={{ padding: 28 }}>
                  <div style={{ fontSize: 11, color: '#444', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>{card.label}</div>
                  <div style={{ fontFamily: 'Syne', fontSize: 36, fontWeight: 800, color: card.color, marginBottom: 8, letterSpacing: '-0.02em' }}>{card.value}</div>
                  <div style={{ fontSize: 12, color: '#444' }}>{card.sub}</div>
                </div>
              ))}
              {result.summary && (
                <div className="stat-card" style={{ padding: 28, gridColumn: 'span 2' }}>
                  <div style={{ fontSize: 11, color: '#444', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>AI Summary</div>
                  <div style={{ color: '#888', fontSize: 15, lineHeight: 1.7 }}>{result.summary}</div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={goHome} style={{ background: 'none', border: '1px solid #1e1e1e', color: '#666', padding: '12px 24px', borderRadius: 12, cursor: 'pointer', fontSize: 14, fontWeight: 600, transition: 'all 0.2s' }}>
                ← Analyse Another Statement
              </button>
            </div>
          </div>
        )}

        {/* SIGNUP WALL */}
        {showSignupWall && (
          <div style={{ paddingTop: 120, paddingBottom: 80, textAlign: 'center', maxWidth: 480, margin: '0 auto', animation: 'slideUp 0.4s' }}>
            <div style={{ fontSize: 48, marginBottom: 20 }}>🔒</div>
            <h2 style={{ fontFamily: 'Syne', fontSize: 32, fontWeight: 800, color: '#fff', marginBottom: 12 }}>Create a free account</h2>
            <p style={{ color: '#555', fontSize: 16, marginBottom: 32, lineHeight: 1.6 }}>You've used your guest scan. Sign in with Google to get 2 more free scans — no credit card required.</p>
            <button onClick={signInWithGoogle} className="btn-primary" style={{ padding: '14px 32px', borderRadius: 14, fontSize: 16, display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#fff" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#fff" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/><path fill="#fff" d="M3.964 10.706A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/><path fill="#fff" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"/></svg>
              Continue with Google
            </button>
          </div>
        )}

        {/* PAYWALL */}
        {showPaywall && (
          <div style={{ paddingTop: 120, paddingBottom: 80, textAlign: 'center', maxWidth: 520, margin: '0 auto', animation: 'slideUp 0.4s' }}>
            <div style={{ fontSize: 48, marginBottom: 20 }}>⚡</div>
            <h2 style={{ fontFamily: 'Syne', fontSize: 32, fontWeight: 800, color: '#fff', marginBottom: 12 }}>Get more scans</h2>
            <p style={{ color: '#555', fontSize: 16, marginBottom: 32, lineHeight: 1.6 }}>You've used your free scans. Upgrade to continue analysing statements at scale.</p>
            <div style={{ background: '#080808', border: '1px solid #1a1a1a', borderRadius: 20, padding: 32, marginBottom: 24, textAlign: 'left' }}>
              {[['✓', '50 statement analyses'], ['✓', 'All Indian banks supported'], ['✓', 'Password-protected PDFs'], ['✓', 'Priority processing'], ['✓', 'Export reports']].map(([icon, feat]) => (
                <div key={feat} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #111', color: '#888', fontSize: 14 }}>
                  <span style={{ color: '#00d4ff', fontWeight: 700 }}>{icon}</span> {feat}
                </div>
              ))}
              <div style={{ marginTop: 24, fontFamily: 'Syne', fontSize: 36, fontWeight: 800, color: '#fff' }}>₹999 <span style={{ fontSize: 16, color: '#444', fontFamily: 'DM Sans', fontWeight: 400 }}>/ 50 scans</span></div>
            </div>
            <p style={{ color: '#444', fontSize: 13, marginBottom: 20 }}>To purchase, contact <span style={{ color: '#00d4ff' }}>clearstatement.billing@gmail.com</span></p>
            <button onClick={goHome} style={{ background: 'none', border: '1px solid #1e1e1e', color: '#555', padding: '12px 24px', borderRadius: 12, cursor: 'pointer', fontSize: 14 }}>← Go back</button>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid #0f0f0f', background: '#000', padding: '48px 32px 32px', marginTop: 80 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 32, marginBottom: 48 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ width: 28, height: 28, background: 'linear-gradient(135deg, #00d4ff, #7c3aed)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#fff', fontWeight: 900, fontSize: 14, fontFamily: 'Syne' }}>C</span>
                </div>
                <span style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 16, color: '#fff' }}>ClearStatement</span>
              </div>
              <p style={{ color: '#333', fontSize: 13, maxWidth: 260, lineHeight: 1.6 }}>AI-powered bank statement analysis for Indian financial professionals.</p>
            </div>
            <div style={{ display: 'flex', gap: 48, flexWrap: 'wrap' }}>
              <div>
                <div style={{ color: '#555', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>Legal</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button onClick={() => setShowPrivacy(true)} style={{ background: 'none', border: 'none', color: '#444', fontSize: 13, cursor: 'pointer', textAlign: 'left', padding: 0 }}>Privacy Policy</button>
                  <button onClick={() => setShowTerms(true)} style={{ background: 'none', border: 'none', color: '#444', fontSize: 13, cursor: 'pointer', textAlign: 'left', padding: 0 }}>Terms of Service</button>
                </div>
              </div>
              <div>
                <div style={{ color: '#555', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>Support</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <a href="mailto:clearstatement.billing@gmail.com" style={{ color: '#444', fontSize: 13, textDecoration: 'none' }}>Contact Us</a>
                  <span style={{ color: '#444', fontSize: 13 }}>clearstatement.billing@gmail.com</span>
                </div>
              </div>
            </div>
          </div>
          <div style={{ borderTop: '1px solid #0f0f0f', paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <span style={{ color: '#2a2a2a', fontSize: 12 }}>© 2026 ClearStatement. All rights reserved.</span>
            <span style={{ color: '#2a2a2a', fontSize: 12 }}>Engineered by <span style={{ color: '#00d4ff', fontWeight: 600 }}>TheArise</span></span>
          </div>
        </div>
      </footer>
    </div>
  )
}


