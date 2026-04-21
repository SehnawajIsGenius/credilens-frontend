'use client'
import { useState, useEffect } from 'react'
import axios from 'axios'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const SUPPORT_EMAIL = 'clearstatement.billing@gmail.com'

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 299,
    scans: 5,
    features: ['5 statement analyses', 'All Indian bank formats', 'Risk score + summary'],
    highlight: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 599,
    scans: 15,
    features: ['15 statement analyses', 'All Indian bank formats', 'Risk score + summary'],
    highlight: false,
  },
  {
    id: 'agency',
    name: 'Agency',
    price: 999,
    scans: 40,
    features: ['40 statement analyses', 'All Indian bank formats', 'Risk score + summary', 'Priority support'],
    highlight: true,
  },
]

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
  const [selectedPlan, setSelectedPlan] = useState<any>(null)
  const [emailSent, setEmailSent] = useState(false)

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
    setSelectedPlan(null)
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

  const handleSelectPlan = (plan: any) => {
    setSelectedPlan(plan)
    setEmailSent(false)
  }

  const handleSendEmail = (plan: any) => {
    const subject = `Payment Screenshot — ClearStatement ${plan.name} Plan (₹${plan.price})`
    const body = `Hello ClearStatement Team,

I have completed the UPI payment of ₹${plan.price} for the ${plan.name} Plan (${plan.scans} scans).

My account email is: ${user?.email || 'YOUR EMAIL HERE'}

Please find attached the payment screenshot.

Thank you.`

    const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    window.open(mailto)
    setEmailSent(true)
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
              {isPaid && scansLeft > 0 && (
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

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">

        {/* SIGNUP WALL */}
        {showSignupWall && !user && (
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
              className="inline-flex items-center gap-3 bg-white text-gray-900 font-semibold px-6 py-3 rounded-xl hover:bg-gray-100 transition-all shadow-lg mx-auto"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google — Free
            </button>
            <p className="text-gray-600 text-xs mt-3">No credit card. 2 more free scans after sign in.</p>
          </div>
        )}

        {/* PAYWALL */}
        {showPaywall && !selectedPlan && (
          <div className="py-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Choose your plan</h2>
              <p className="text-gray-400 text-sm">Your free scans are used up. Pay once, no subscription.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {PLANS.map(plan => (
                <div key={plan.id} className={`rounded-2xl p-5 relative ${plan.highlight ? 'bg-blue-500/10 border-2 border-blue-500/40' : 'bg-white/3 border border-white/10'}`}>
                  {plan.highlight && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs bg-blue-500 text-white px-3 py-1 rounded-full font-medium whitespace-nowrap">
                      Best Value
                    </span>
                  )}
                  <p className={`text-xs uppercase tracking-widest mb-2 ${plan.highlight ? 'text-blue-400' : 'text-gray-500'}`}>{plan.name}</p>
                  <p className="text-3xl font-bold text-white mb-1">₹{plan.price}</p>
                  <p className="text-gray-400 text-xs mb-4">{plan.scans} scans — no expiry</p>
                  <ul className="text-xs text-gray-400 space-y-2 mb-5">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-center gap-2">
                        <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => handleSelectPlan(plan)}
                    className={`w-full font-semibold py-2.5 rounded-xl text-center text-sm transition-all ${plan.highlight ? 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white' : 'bg-white/8 hover:bg-white/12 border border-white/10 text-white'}`}
                  >
                    Get {plan.scans} Scans — ₹{plan.price}
                  </button>
                </div>
              ))}
            </div>

            <p className="text-center text-gray-600 text-xs">
              Pay via UPI. Scans activated within 2 hours. Support: {SUPPORT_EMAIL}
            </p>
          </div>
        )}

        {/* PAYMENT QR SCREEN */}
        {showPaywall && selectedPlan && (
          <div className="py-6 max-w-sm mx-auto">
            <button
              onClick={() => setSelectedPlan(null)}
              className="flex items-center gap-2 text-gray-500 hover:text-white text-sm mb-6 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
              Back to plans
            </button>

            <div className="bg-white/3 border border-white/8 rounded-2xl p-6 text-center">
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">{selectedPlan.name} Plan</p>
              <p className="text-3xl font-bold text-white mb-1">₹{selectedPlan.price}</p>
              <p className="text-gray-400 text-xs mb-6">{selectedPlan.scans} scans — no expiry</p>

              <div className="bg-white rounded-2xl p-4 mb-4 mx-auto w-fit">
                <img
                  src="/qr.png"
                  alt="UPI QR Code"
                  className="w-48 h-48 object-contain"
                />
              </div>

              <p className="text-gray-300 text-sm font-medium mb-1">Scan with any UPI app</p>
              <p className="text-gray-500 text-xs mb-6">
                Google Pay, PhonePe, Paytm, or any UPI app
              </p>

              <div className="bg-white/5 border border-white/8 rounded-xl p-4 mb-5 text-left">
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">After payment</p>
                <p className="text-gray-300 text-xs leading-relaxed">
                  Click the button below to email us your payment screenshot. We will activate your {selectedPlan.scans} scans within 2 hours.
                </p>
              </div>

              {!emailSent ? (
                <button
                  onClick={() => handleSendEmail(selectedPlan)}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold py-3 rounded-xl text-sm transition-all mb-3"
                >
                  Send Payment Screenshot via Email
                </button>
              ) : (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 mb-3">
                  <p className="text-emerald-400 text-sm font-medium">Email opened successfully</p>
                  <p className="text-gray-500 text-xs mt-1">Attach your screenshot and send. We will activate your account within 2 hours.</p>
                </div>
              )}

              <p className="text-gray-600 text-xs">
                Questions? Email us at{' '}
                <span className="text-blue-400">{SUPPORT_EMAIL}</span>
              </p>
            </div>
          </div>
        )}

        {/* MAIN UPLOAD */}
        {!showPaywall && !showSignupWall && !result && (
          <>
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

            {user && !isPaid && (
              <div className="w-full bg-white/5 rounded-full h-1 mb-6">
                <div
                  className="bg-gradient-to-r from-blue-500 to-emerald-500 h-1 rounded-full transition-all"
                  style={{ width: `${(scansUsed / 2) * 100}%` }}
                ></div>
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
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    Analyzing Statement...
                  </span>
                ) : !user ? 'Analyze Free — No signup needed' : 'Analyze Statement'}
              </button>

              {error && (
                <div className="mt-4 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
                  <p className="text-rose-400 text-xs text-center">{error}</p>
                </div>
              )}

              {!user && (
                <p className="text-gray-600 text-xs text-center mt-3">
                  1 free scan without signup — sign in for 2 more free scans
                </p>
              )}
            </div>
          </>
        )}

        {/* RESULTS */}
        {result && (
          <div>
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

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 sm:gap-4 mb-5">
              <div className="sm:col-span-2 bg-white/3 border border-white/8 rounded-2xl p-5 sm:p-6">
                <p className="text-gray-500 text-xs uppercase tracking-widest mb-2">Avg Balance</p>
                <p className="text-2xl sm:text-3xl font-bold text-white">₹{result.average_balance?.toLocaleString('en-IN')}</p>
                <p className="text-gray-600 text-xs mt-2">Monthly average</p>
              </div>
              <div className="sm:col-span-3 bg-white/3 border border-white/8 rounded-2xl p-5 sm:p-6">
                <p className="text-gray-500 text-xs uppercase tracking-widest mb-2">AI Underwriter Summary</p>
                <p className="text-gray-300 text-sm leading-relaxed">{result.summary}</p>
              </div>
            </div>

            {!user && guestScanned && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-5 mb-4 text-center">
                <p className="text-blue-300 text-sm font-medium mb-3">Sign in to get 2 more free scans</p>
                <button
                  onClick={signInWithGoogle}
                  className="inline-flex items-center gap-2 bg-white text-gray-900 font-semibold px-5 py-2.5 rounded-xl hover:bg-gray-100 transition-all text-sm"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </button>
              </div>
            )}

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
