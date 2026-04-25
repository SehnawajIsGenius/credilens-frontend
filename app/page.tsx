'use client'
import { useState, useEffect } from 'react'
import axios from 'axios'
import { createClient } from '@supabase/supabase-js'
import { Plus_Jakarta_Sans } from 'next/font/google'

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'] })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const SUPPORT_EMAIL = 'clearstatement.billing@gmail.com' 

const SUPPORTED_BANKS = [
  'HDFC Bank', 'State Bank of India', 'ICICI Bank', 'Axis Bank', 
  'Kotak Mahindra', 'Punjab National Bank', 'Bank of Baroda', 
  'Yes Bank', 'IndusInd Bank', 'IDFC First Bank', 'Canara Bank', 'Union Bank'
]

export default function Home() {
  const [file, setFile] = useState<File | null>(null)
  const [pdfPassword, setPdfPassword] = useState('') 
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [loadingText, setLoadingText] = useState('Connecting to secure server...')
  const [result, setResult] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [scansUsed, setScansUsed] = useState(0)
  const [isPaid, setIsPaid] = useState(false)
  const [scansLeft, setScansLeft] = useState(0)
  const [authLoading, setAuthLoading] = useState(true)
  const [guestScanned, setGuestScanned] = useState(false)
  
  const [showPaywall, setShowPaywall] = useState(false)
  const [showSignupWall, setShowSignupWall] = useState(false)
  const [toast, setToast] = useState<{msg: string, type: 'error' | 'success'} | null>(null)

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

  useEffect(() => {
    let progressInterval: any;
    let textInterval: any;

    if (loading) {
      setProgress(0);
      setLoadingText('Connecting to secure banking server...');

      progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 98) return 98; 
          const inc = prev < 40 ? 3 : prev < 70 ? 1.5 : prev < 90 ? 0.5 : 0.2;
          return prev + inc;
        });
      }, 600);

      const texts = [
        'Unlocking PDF...',
        'Reading transactions...',
        'Filtering bounced cheques...',
        'Calculating verified income...',
        'Generating risk score...'
      ];
      let textIndex = 0;
      textInterval = setInterval(() => {
        textIndex = (textIndex + 1) % texts.length;
        setLoadingText(texts[textIndex]);
      }, 3000);
    } else {
      setProgress(100);
    }

    return () => {
      clearInterval(progressInterval);
      clearInterval(textInterval);
    };
  }, [loading]);

  const loadUser = async (u: any) => {
    const { data, error } = await supabase.from('user_scans').select('*').eq('id', u.id).single()

    if (error || !data) {
      await supabase.from('user_scans').insert({ id: u.id, email: u.email, scans_used: 0, is_paid: false, scans_purchased: 0 })
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
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    goHome()
  }

  const handleUpload = async () => {
    if (!file) return

    if (!user && guestScanned) {
      setShowSignupWall(true); return
    }
    if (user && !isPaid && scansUsed >= 2) {
      setShowPaywall(true); return
    }
    if (user && isPaid && scansLeft <= 0) {
      setShowPaywall(true); return
    }

    setLoading(true)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      if (pdfPassword) formData.append('password', pdfPassword)
      
      const res = await axios.post('https://credilens-api.onrender.com/upload', formData)

      if (res.data.error) throw new Error(res.data.error)

      if (!user) {
        localStorage.setItem('guest_scanned', 'true')
        setGuestScanned(true)
      } else {
        const newCount = scansUsed + 1
        await supabase.from('user_scans').update({ scans_used: newCount }).eq('id', user.id)
        setScansUsed(newCount)
        if (!isPaid) setScansLeft(Math.max(0, 2 - newCount))
        else setScansLeft(prev => prev - 1)
      }

      setResult(res.data)
      setPdfPassword('') 
      showToast('Analysis complete!', 'success')
    } catch (e: any) {
      const errorMsg = e.response?.data?.error || e.message || 'Connection failed.'
      if (errorMsg.toLowerCase().includes('password')) {
        showToast('Incorrect PDF password. Please try again.', 'error')
      } else {
        showToast(errorMsg, 'error')
      }
      setResult(null)
    }
    setLoading(false)
  }

  const getRiskColor = (s: number) => s >= 7 ? 'text-emerald-600' : s >= 4 ? 'text-amber-600' : 'text-rose-600'
  const getRiskBg = (s: number) => s >= 7 ? 'bg-emerald-50 border-emerald-200' : s >= 4 ? 'bg-amber-50 border-amber-200' : 'bg-rose-50 border-rose-200'
  const getRiskLabel = (s: number) => s >= 7 ? 'Low Risk' : s >= 4 ? 'Medium Risk' : 'High Risk'

  if (authLoading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </main>
    )
  }

  return (
    <div className={`min-h-screen bg-slate-50 text-slate-900 flex flex-col overflow-x-hidden ${jakarta.className}`}>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slide-up {
          0% { transform: translateY(100%); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up { animation: slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}} />

      {toast && (
        <div className={`fixed bottom-6 right-6 z-[100] px-5 py-4 rounded-xl shadow-xl flex items-center gap-3 animate-slide-up border-l-4 bg-white ${
          toast.type === 'error' ? 'border-rose-500 text-rose-700' : 'border-emerald-500 text-emerald-700'
        }`}>
          <p className="text-sm font-semibold tracking-wide">{toast.msg}</p>
        </div>
      )}

      {/* LIGHT NAVBAR */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 sm:px-8 py-4 flex items-center justify-between shrink-0">
        <button onClick={goHome} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-inner">
             <span className="text-white font-bold text-lg">C</span>
          </div>
          <span className="font-extrabold tracking-tight text-xl text-slate-800">
            ClearStatement
          </span>
        </button>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              {!isPaid && scansLeft > 0 && (
                <span className="text-xs text-slate-600 bg-slate-100 px-3 py-1.5 rounded-full font-medium hidden sm:block border border-slate-200">
                  {scansLeft} free scan{scansLeft > 1 ? 's' : ''} left
                </span>
              )}
              {isPaid && (
                <span className="text-xs text-blue-700 bg-blue-50 px-3 py-1.5 rounded-full font-medium hidden sm:block border border-blue-200">
                  {scansLeft} scans remaining
                </span>
              )}
              <div className="h-8 w-px bg-slate-200 hidden sm:block"></div>
              <img src={user.user_metadata?.avatar_url} className="w-8 h-8 rounded-full border border-slate-200" alt="Profile" />
              <button onClick={signOut} className="text-sm text-slate-500 hover:text-slate-800 transition-colors font-medium">
                Sign out
              </button>
            </>
          ) : (
            <button onClick={signInWithGoogle} className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-semibold transition-all shadow-sm">
              Sign In
            </button>
          )}
        </div>
      </nav>

      <div className="flex-grow w-full max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-20 relative z-10 flex flex-col items-center">
        
        {/* MAIN UPLOAD SECTION */}
        {!showPaywall && !showSignupWall && !result && (
          <div className="w-full flex flex-col items-center">
            
            {/* SIMPLIFIED HERO COPY */}
            <div className="text-center mb-10 max-w-2xl">
              <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 mb-4 tracking-tight leading-tight">
                Automate Bank Statement Analysis.
              </h1>
              <p className="text-slate-500 text-lg sm:text-xl font-medium leading-relaxed">
                Instantly verify income, extract EMIs, and assess risk. Just upload the PDF.
              </p>
            </div>

            {/* WHITE, CLEAN UPLOAD WIDGET */}
            <div className="w-full max-w-2xl bg-white rounded-2xl p-6 sm:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200">
              
              <label className={`flex flex-col items-center justify-center w-full h-48 sm:h-56 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 ${
                file ? 'border-blue-400 bg-blue-50' : 'border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/50'
              }`}>
                <div className="text-center px-4">
                  {file ? (
                    <>
                      <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-3 shadow-sm">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </div>
                      <p className="text-slate-800 text-base font-bold tracking-wide truncate max-w-[250px] mx-auto">{file.name}</p>
                      <p className="text-blue-600 text-xs mt-1.5 font-semibold uppercase tracking-widest">Document Attached</p>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-full bg-white shadow-sm border border-slate-200 flex items-center justify-center mx-auto mb-4 transition-transform group-hover:scale-105">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                      </div>
                      <p className="text-slate-700 text-lg font-semibold mb-1">Click to upload statement</p>
                      <p className="text-slate-500 text-sm font-medium">Supports single & multi-month PDFs</p>
                    </>
                  )}
                </div>
                <input type="file" accept=".pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </label>

              {file && !loading && (
                <div className="mt-5 animate-slide-up">
                  <input
                    type="password"
                    placeholder="PDF Password (Leave blank if not protected)"
                    value={pdfPassword}
                    onChange={(e) => setPdfPassword(e.target.value)}
                    className="w-full px-4 py-3.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm text-slate-800 placeholder-slate-400 font-medium shadow-sm"
                  />
                </div>
              )}

              {loading ? (
                <div className="w-full mt-6 bg-slate-50 border border-slate-200 rounded-lg p-5">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm text-blue-600 font-semibold">{loadingText}</span>
                    <span className="text-sm text-slate-600 font-bold">{Math.round(progress)}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                  </div>
                </div>
              ) : (
                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleUpload}
                    disabled={!file}
                    className={`flex-1 font-bold py-3.5 rounded-lg text-sm transition-all ${
                      file ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md' : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                    }`}
                  >
                    {!user ? 'Analyze Statement (Free)' : 'Run Analysis'}
                  </button>
                  {file && (
                    <button onClick={() => { setFile(null); setPdfPassword(''); }} className="px-6 py-3.5 font-semibold bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-lg transition-colors text-sm shadow-sm">
                      Cancel
                    </button>
                  )}
                </div>
              )}
            </div>
            
            <div className="mt-8 flex items-center justify-center gap-2 text-slate-500 text-sm font-medium">
              <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              Bank-grade encryption. Files are deleted instantly.
            </div>
          </div>
        )}

        {/* CLEAN FINTECH RESULTS DASHBOARD */}
        {result && !result.error && (
          <div className="w-full max-w-4xl mx-auto animate-slide-up">
            <div className="mb-8 pb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-200 gap-4">
              <div>
                <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Financial Summary</h2>
                <p className="text-slate-500 text-sm mt-1 font-medium">AI-verified extraction complete</p>
              </div>
              <span className={`px-4 py-1.5 rounded-full text-sm font-bold border shadow-sm ${getRiskBg(result.risk_score || 10)} ${getRiskColor(result.risk_score || 10)}`}>
                {getRiskLabel(result.risk_score || 10)}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
              <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-[0_2px_10px_rgb(0,0,0,0.02)]">
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Verified Monthly Income</p>
                <p className="text-4xl font-extrabold text-slate-900 mb-2">₹{(result.verified_monthly_salary || 0).toLocaleString('en-IN')}</p>
                <p className="text-sm text-slate-500 font-medium">Average across detected statement</p>
              </div>

              <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-[0_2px_10px_rgb(0,0,0,0.02)]">
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Risk Score</p>
                <p className={`text-4xl font-extrabold ${getRiskColor(result.risk_score || 10)} mb-2`}>
                  {result.risk_score || 0}<span className="text-slate-400 text-2xl">/10</span>
                </p>
                <p className="text-sm text-slate-500 font-medium">Higher score equals better credit profile</p>
              </div>

              <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-[0_2px_10px_rgb(0,0,0,0.02)]">
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Bounced Cheques</p>
                <p className={`text-4xl font-extrabold mb-2 ${(result.bounced_cheque_count || 0) === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {result.bounced_cheque_count || 0}
                </p>
                <p className="text-sm text-slate-500 font-medium">Inward & outward returns detected</p>
              </div>

              <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-[0_2px_10px_rgb(0,0,0,0.02)]">
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Total Monthly EMIs</p>
                <p className="text-4xl font-extrabold text-slate-900 mb-2">₹{(result.total_emi || 0).toLocaleString('en-IN')}</p>
                <p className="text-sm text-slate-500 font-medium">Auto-debits and loan obligations</p>
              </div>
            </div>

            <div className="flex justify-end">
               <button
                 onClick={goHome}
                 className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold py-3.5 px-6 rounded-lg transition-colors text-sm shadow-sm"
               >
                 Analyze Another Statement
               </button>
            </div>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <footer className="border-t border-slate-200 bg-white py-10 mt-auto relative z-20">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
             <div className="w-5 h-5 bg-slate-300 rounded flex items-center justify-center"><span className="text-white text-xs font-bold">C</span></div>
             <span className="font-bold text-slate-700 tracking-tight text-sm">ClearStatement</span>
          </div>
          <div className="text-xs text-slate-500 font-medium">
            Engineered by <span className="text-blue-600 font-bold">TheArise</span>
          </div>
        </div>
      </footer>
    </div>
  )
}


