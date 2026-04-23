'use client'
import { useState, useEffect } from 'react'
import axios from 'axios'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// --- YOUR PAYMENT & CONTACT DETAILS ---
const SUPPORT_EMAIL = 'akingak315@gmail.com' 
const INSTA_STARTER = 'PASTE_YOUR_STARTER_LINK_HERE'
const INSTA_PRO = 'PASTE_YOUR_PRO_LINK_HERE'
const INSTA_AGENCY = 'PASTE_YOUR_AGENCY_LINK_HERE'
// --------------------------------------

export default function Home() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [user, setUser] = useState<any>(null)
  const [scansUsed, setScansUsed] = useState(0)
  const [isPaid, setIsPaid] = useState(false)
  const [scansLeft, setScansLeft] = useState(0)
  const [authLoading, setAuthLoading] = useState(true)
  const [guestScanned, setGuestScanned] = useState(false)
  const [showPaywall, setShowPaywall] = useState(false)
  const [showSignupWall, setShowSignupWall] = useState(false)
  const [showCheckout, setShowCheckout] = useState<{show: boolean, amount: string, planName: string, scans: number, link: string}>({show: false, amount: '', planName: '', scans: 0, link: ''})

  useEffect(() => {
    const g = localStorage.getItem('guest_scanned')
    if (g) setGuestScanned(true)

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
        await loadUser(session.user)
      }
      setAuthLoading(false)
    }
    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_e, session) => {
        if (session?.user) {
          setUser(session.user)
          await loadUser(session.user)
        } else {
          setUser(null)
          setScansUsed(0)
          setIsPaid(false)
          setScansLeft(0)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const loadUser = async (u: any) => {
    const { data, error } = await supabase
      .from('user_scans')
      .select('*')
      .eq('id', u.id)
      .single()

    if (error || !data) {
      await supabase.from('user_scans').insert({
        id: u.id,
        email: u.email,
        scans_used: 0,
        is_paid: false,
        scans_purchased: 0,
      })
      setScansUsed(0)
      setIsPaid(false)
      setScansLeft(2)
    } else {
      setScansUsed(data.scans_used)
      setIsPaid(data.is_paid)
      if (data.is_paid) {
        setScansLeft(data.scans_purchased - data.scans_used)
      } else {
        setScansLeft(Math.max(0, 2 - data.scans_used))
      }
    }
  }

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    })
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setResult(null)
    setFile(null)
    setShowPaywall(false)
    setShowSignupWall(false)
  }

  const handleUpload = async () => {
    if (!file) return

    if (!user && guestScanned) {
      setShowSignupWall(true)
      return
    }

    if (user && !isPaid && scansUsed >= 2) {
      setShowPaywall(true)
      return
    }

    if (user && isPaid && scansLeft <= 0) {
      setShowPaywall(true)
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      
      const res = await axios.post('https://credilens-api.onrender.com/upload', formData)

      if (!user) {
        localStorage.setItem('guest_scanned', 'true')
        setGuestScanned(true)
      } else {
        const newCount = scansUsed + 1
        await supabase
          .from('user_scans')
          .update({ scans_used: newCount })
          .eq('id', user.id)
        
        setScansUsed(newCount)
        if (!isPaid) setScansLeft(Math.max(0, 2 - newCount))
        else setScansLeft(prev => prev - 1)
      }

      setResult(res.data)
    } catch (e: any) {
      setError('Connection failed. Wait 60 seconds and try again.')
    }
    setLoading(false)
  }

  const getRiskColor = (s: number) =>
    s >= 7 ? 'text-emerald-400' : s >= 4 ? 'text-amber-400' : 'text-rose-400'
  
  const getRiskLabel = (s: number) =>
    s >= 7 ? 'Low Risk' : s >= 4 ? 'Medium Risk' : 'High Risk'

  if (authLoading) {
    return (
      <main className="min-h-screen bg-[#080C14] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#080C14] text-white">
      <nav className="border-b border-white/5 px-4 sm:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <span className="font-semibold text-sm sm:text-base">ClearStatement</span>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              {!isPaid && scansLeft > 0 && (
                <span className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 px-3 py-1 rounded-full hidden sm:block">
                  {scansLeft} free scan{scansLeft > 1 ? 's' : ''} left
                </span>
              )}
              {isPaid && (
                <span className="text-xs text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-3 py-1 rounded-full hidden sm:block">
                  {scansLeft} scans remaining
                </span>
              )}
              <img src={user.user_metadata?.avatar_url} className="w-7 h-7 rounded-full" alt="" />
              <button onClick={signOut} className="text-xs text-gray-500 hover:text-white transition-colors">
                Sign out
              </button>
            </>
          ) : (
            <button
              onClick={signInWithGoogle}
              className="text-xs text-white bg-white/10 hover:bg-white/15 border border-white/10 px-3 py-1.5 rounded-lg transition-all"
            >
              Sign in
            </button>
          )}
        </div>
      </nav>

      {/* PROFESSIONAL CHECKOUT MODAL - INSTAMOJO VERSION */}
      {showCheckout.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0f1522] border border-white/10 rounded-2xl p-6 sm:p-8 max-w-md w-full relative shadow-2xl">
            <button 
              onClick={() => setShowCheckout({show: false, amount: '', planName: '', scans: 0, link: ''})}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-white mb-1">Complete Payment</h3>
              <p className="text-gray-400 text-sm">{showCheckout.planName} Plan • ₹{showCheckout.amount}</p>
            </div>

            <div className="space-y-6 mb-8 text-sm text-gray-300">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">1</div>
                <div>
                  <p className="mb-3">Pay securely via Instamojo (UPI, Credit Card, or Netbanking).</p>
                  <a 
                    href={showCheckout.link} 
                    target="_blank" 
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 px-5 rounded-lg transition-all"
                  >
                    Pay ₹{showCheckout.amount} on Instamojo
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">2</div>
                <p>After successful payment, click the button below to email us your payment confirmation so we can instantly unlock your account.</p>
              </div>
            </div>
            
            <a 
              href={`mailto:${SUPPORT_EMAIL}?subject=Payment%20Confirmation%20-%20${showCheckout.planName}%20Plan&body=Hello%20ClearStatement%20Billing%20Team,%0A%0AI%20have%20completed%20the%20payment%20of%20Rs%20${showCheckout.amount}%20on%20Instamojo%20for%20the%20${showCheckout.planName}%20Plan%20(${showCheckout.scans}%20scans).%0A%0AMy%20account%20email%20is:%20${user?.email}%0A%0A[PLEASE ATTACH YOUR PAYMENT SCREENSHOT HERE]%0A%0AThank%20you.`}
              className="flex items-center justify-center gap-2 w-full bg-white text-gray-900 hover:bg-gray-100 font-semibold py-3.5 rounded-xl transition-all shadow-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
              Email Us the Confirmation
            </a>
            <p className="text-center text-gray-500 text-xs mt-4">
              Your account will be credited within 10-15 minutes of verification.
            </p>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        {/* SIGNUP WALL */}
        {showSignupWall && (
          <div className="text-center py-10">
            <div className="w-16 h-16 rounded-full bg-blue-500/15 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Get 2 more free scans</h2>
            <p className="text-gray-400 text-sm mb-8 max-w-sm mx-auto">
              You used your 1 guest scan. Sign in with Google to unlock 2 more free scans — no credit card needed.
            </p>
            <button
              onClick={signInWithGoogle}
              className="inline-flex items-center gap-3 bg-white text-gray-900 font-semibold px-6 py-3 rounded-xl hover:bg-gray-100 transition-all shadow-lg mx-auto mb-4"
            >
              Continue with Google — Free
            </button>
          </div>
        )}

        {/* PAYWALL - 3 TIERS */}
        {showPaywall && (
          <div className="py-6">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold text-white mb-2">Upgrade Your Workspace</h2>
              <p className="text-gray-400 text-sm">Choose the plan that fits your volume.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-5xl mx-auto">
              
              {/* TIER 1 - STARTER */}
              <div className="bg-white/3 border border-white/10 rounded-2xl p-6 flex flex-col">
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Starter</p>
                <p className="text-3xl font-bold text-white mb-1">₹299</p>
                <p className="text-gray-400 text-sm mb-6 pb-6 border-b border-white/5">5 AI Scans</p>
                <ul className="text-sm text-gray-400 space-y-3 mb-8 flex-grow">
                  <li className="flex items-center gap-2"><svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>5 statement analyses</li>
                  <li className="flex items-center gap-2"><svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>No expiration date</li>
                  <li className="flex items-center gap-2"><svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>Standard Support</li>
                </ul>
                <button
                  onClick={() => setShowCheckout({show: true, amount: '299', planName: 'Starter', scans: 5, link: INSTA_STARTER})}
                  className="w-full bg-white/10 hover:bg-white/15 border border-white/10 text-white font-semibold py-3 rounded-xl transition-all"
                >
                  Get Starter
                </button>
              </div>

              {/* TIER 2 - PRO */}
              <div className="bg-blue-500/10 border-2 border-blue-500/40 rounded-2xl p-6 relative flex flex-col transform sm:-translate-y-4 shadow-2xl">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs bg-blue-500 text-white px-3 py-1 rounded-full font-medium">Most Popular</span>
                <p className="text-xs text-blue-400 uppercase tracking-widest mb-1">Pro</p>
                <p className="text-3xl font-bold text-white mb-1">₹599</p>
                <p className="text-gray-400 text-sm mb-6 pb-6 border-b border-white/5">15 AI Scans</p>
                <ul className="text-sm text-gray-400 space-y-3 mb-8 flex-grow">
                  <li className="flex items-center gap-2"><svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>15 statement analyses</li>
                  <li className="flex items-center gap-2"><svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>Risk score + Summary</li>
                  <li className="flex items-center gap-2"><svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>Priority Processing</li>
                </ul>
                <button
                  onClick={() => setShowCheckout({show: true, amount: '599', planName: 'Pro', scans: 15, link: INSTA_PRO})}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold py-3 rounded-xl transition-all"
                >
                  Get Pro
                </button>
              </div>

              {/* TIER 3 - BUSINESS */}
              <div className="bg-white/3 border border-white/10 rounded-2xl p-6 flex flex-col">
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Business</p>
                <p className="text-3xl font-bold text-white mb-1">₹999</p>
                <p className="text-gray-400 text-sm mb-6 pb-6 border-b border-white/5">40 AI Scans <span className="text-emerald-400 text-xs ml-2">(Best Value)</span></p>
                <ul className="text-sm text-gray-400 space-y-3 mb-8 flex-grow">
                  <li className="flex items-center gap-2"><svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>40 statement analyses</li>
                  <li className="flex items-center gap-2"><svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>Unlocks all features</li>
                  <li className="flex items-center gap-2"><svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>Direct Founder Support</li>
                </ul>
                <button
                  onClick={() => setShowCheckout({show: true, amount: '999', planName: 'Business', scans: 40, link: INSTA_AGENCY})}
                  className="w-full bg-white/10 hover:bg-white/15 border border-white/10 text-white font-semibold py-3 rounded-xl transition-all"
                >
                  Get Business
                </button>
              </div>

            </div>
          </div>
        )}

        {/* MAIN UPLOAD */}
        {!showPaywall && !showSignupWall && !result && (
          <div className="max-w-3xl mx-auto">
            {!user && !guestScanned && (
              <div className="text-center mb-10">
                <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 text-xs text-blue-400 mb-5">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></div>
                  No signup needed for your first scan
                </div>
                <h1 className="text-3xl sm:text-5xl font-bold text-white mb-4 leading-tight">
                  Verify income in
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400"> 8 seconds</span>
                </h1>
                <p className="text-gray-400 text-sm sm:text-lg max-w-xl mx-auto">
                  Upload any Indian bank statement PDF. Get verified salary, risk score and underwriter summary instantly.
                </p>
              </div>
            )}

            {user && (
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">Welcome back</h2>
                  <p className="text-gray-500 text-sm mt-0.5">{user.email}</p>
                </div>
                {!isPaid && (
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Free scans left</p>
                    <p className="text-2xl font-bold text-white">{scansLeft}</p>
                  </div>
                )}
              </div>
            )}

            <div className="bg-white/3 border border-white/8 rounded-2xl sm:rounded-3xl p-5 sm:p-8">
              <label className={`flex flex-col items-center justify-center w-full h-44 sm:h-52 border-2 border-dashed rounded-xl sm:rounded-2xl cursor-pointer transition-all duration-200 ${
                file ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/10 hover:border-blue-500/40'
              }`}>
                <div className="text-center px-4">
                  {file ? (
                    <>
                      <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-3">
                        <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <p className="text-emerald-400 text-sm font-medium truncate max-w-xs mx-auto">{file.name}</p>
                      <p className="text-gray-600 text-xs mt-1">Ready to analyze</p>
                    </>
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </div>
                      <p className="text-gray-300 text-sm font-medium mb-1">Drop bank statement PDF here</p>
                      <p className="text-gray-600 text-xs">HDFC, SBI, ICICI, Axis, Kotak and more</p>
                    </>
                  )}
                </div>
                <input type="file" accept=".pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </label>

              <button
                onClick={handleUpload}
                disabled={!file || loading}
                className={`w-full mt-4 font-semibold py-3.5 rounded-xl transition-all text-sm ${
                  loading ? 'bg-blue-600/50 text-blue-300 cursor-not-allowed'
                  : file ? 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white'
                  : 'bg-white/5 text-gray-600 cursor-not-allowed'
                }`}
              >
                {loading ? 'Analyzing Statement...' : !user ? 'Analyze Free — No signup needed' : 'Analyze Statement'}
              </button>

              {error && (
                <div className="mt-4 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
                  <p className="text-rose-400 text-xs text-center">{error}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* RESULTS */}
        {result && (
          <div className="max-w-3xl mx-auto">
            <div className="flex items-start sm:items-center justify-between mb-6 gap-3">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white">Analysis Complete</h2>
                <p className="text-gray-500 text-xs sm:text-sm mt-1">AI-verified financial summary</p>
              </div>
              <span className={`text-xs font-medium px-3 py-1.5 rounded-full border shrink-0 ${
                result.risk_score >= 7 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : result.risk_score >= 4 ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
              }`}>
                {getRiskLabel(result.risk_score)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4">
              {[
                { label: 'Monthly Income', value: `₹${result.verified_monthly_salary?.toLocaleString('en-IN')}`, sub: 'Verified salary credits', color: 'text-emerald-400' },
                { label: 'Risk Score', value: `${result.risk_score}/10`, sub: getRiskLabel(result.risk_score), color: getRiskColor(result.risk_score) },
                { label: 'Bounced Cheques', value: String(result.bounced_cheque_count), sub: result.bounced_cheque_count === 0 ? 'No bounces detected' : 'Bounces found', color: result.bounced_cheque_count === 0 ? 'text-emerald-400' : 'text-rose-400' },
                { label: 'Monthly EMI', value: `₹${result.total_emi?.toLocaleString('en-IN')}`, sub: 'Total loan obligations', color: 'text-white' },
              ].map((item) => (
                <div key={item.label} className="bg-white/3 border border-white/8 rounded-2xl p-5 sm:p-6">
                  <p className="text-gray-500 text-xs uppercase tracking-widest mb-2">{item.label}</p>
                  <p className={`text-3xl sm:text-4xl font-bold ${item.color}`}>{item.value}</p>
                  <p className="text-gray-600 text-xs mt-2">{item.sub}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => { setResult(null); setFile(null) }}
              className="w-full bg-white/3 hover:bg-white/6 border border-white/8 text-gray-400 hover:text-white font-medium py-3.5 rounded-xl transition-all text-sm"
            >
              Analyze Another Statement
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
