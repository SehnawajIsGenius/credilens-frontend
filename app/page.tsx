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

const FAQS = [
  { q: "Is it safe to upload client bank statements?", a: "Absolutely. We employ bank-grade encryption. PDFs are processed in secure memory and permanently deleted instantly after the risk score is generated. We never store financial data." },
  { q: "What if the PDF is password protected?", a: "Simply enter the password in the optional field before clicking Analyze. We use it once to unlock the file in secure memory and immediately discard it. We never save your passwords." },
  { q: "How accurate is the AI Parsing?", a: "Our proprietary AI is trained specifically on Indian banking formats, achieving 99% accuracy in detecting verified salary credits and bounced cheques." },
  { q: "Do my unused scans expire?", a: "No. Once you purchase a Pro or Business plan, your scans remain in your account indefinitely until you use them." }
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
  const [showPrivacy, setShowPrivacy] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  
  const [toast, setToast] = useState<{msg: string, type: 'error' | 'success'} | null>(null)
  const [showCheckout, setShowCheckout] = useState<{show: boolean, amount: string, planName: string, scans: number}>({show: false, amount: '', planName: '', scans: 0})
  const [timeLeft, setTimeLeft] = useState(600)

  const showToast = (msg: string, type: 'error' | 'success' = 'error') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000) 
  }

  // LOGO CLICK HANDLER (WORKS AS HOME BUTTON)
  const goHome = () => {
    setShowPaywall(false)
    setShowSignupWall(false)
    setShowCheckout({show: false, amount: '', planName: '', scans: 0})
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
    let timer: any;
    if (showCheckout.show && timeLeft > 0) {
      timer = setInterval(() => { setTimeLeft((prev) => prev - 1); }, 1000);
    } else if (!showCheckout.show) {
      setTimeLeft(600);
    }
    return () => clearInterval(timer);
  }, [showCheckout.show, timeLeft]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    let progressInterval: any;
    let textInterval: any;

    if (loading) {
      setProgress(0);
      setLoadingText('Connecting to secure server...');

      progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 98) return 98; 
          const inc = prev < 40 ? 3 : prev < 70 ? 1.5 : prev < 90 ? 0.5 : 0.2;
          return prev + inc;
        });
      }, 600);

      const texts = [
        'Unlocking document...',
        'Reading bank format...',
        'Extracting transaction history...',
        'Filtering bounced cheques...',
        'Calculating verified income...',
        'Running AI risk analysis...',
        'Finalizing underwriter report...'
      ];
      let textIndex = 0;
      textInterval = setInterval(() => {
        textIndex = (textIndex + 1) % texts.length;
        setLoadingText(texts[textIndex]);
      }, 3500);

    } else {
      setProgress(100);
    }

    return () => {
      clearInterval(progressInterval);
      clearInterval(textInterval);
    };
  }, [loading]);

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
    goHome()
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
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      if (pdfPassword) {
        formData.append('password', pdfPassword)
      }
      
      const res = await axios.post('https://credilens-api.onrender.com/upload', formData)

      if (res.data.error) {
        throw new Error(res.data.error)
      }

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

  const getRiskColor = (s: number) =>
    s >= 7 ? 'text-[#3ECF8E]' : s >= 4 ? 'text-[#F9C513]' : 'text-[#FF5A5F]'
  
  const getRiskLabel = (s: number) =>
    s >= 7 ? 'Low Risk' : s >= 4 ? 'Medium Risk' : 'High Risk'

  if (authLoading) {
    return (
      <main className="min-h-screen bg-[#000000] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-[#3ECF8E] border-t-transparent rounded-full animate-spin"></div>
      </main>
    )
  }

  return (
    <div className={`min-h-screen bg-[#000000] text-white flex flex-col overflow-x-hidden ${jakarta.className}`}>
      
      {/* GLOBAL CSS FOR SUPABASE-STYLE GRID AND SCROLL */}
      <style dangerouslySetInnerHTML={{__html: `
        ::selection { background: #3ECF8E; color: #000; }
        .bg-grid-pattern {
          background-size: 40px 40px;
          background-image: linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
        }
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-scroll {
          animation: scroll 40s linear infinite;
          display: flex;
          width: max-content;
        }
        .animate-scroll:hover { animation-play-state: paused; }
        .glass-panel {
          background: rgba(26, 26, 26, 0.6);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
      `}} />

      {toast && (
        <div className="fixed bottom-6 right-6 z-[100] px-5 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-slide-up glass-panel border-l-4" style={{ borderLeftColor: toast.type === 'error' ? '#FF5A5F' : '#3ECF8E' }}>
          <p className="text-sm font-semibold tracking-wide text-white">{toast.msg}</p>
        </div>
      )}

      {/* TOP NAVIGATION */}
      <nav className="sticky top-0 z-50 glass-panel px-4 sm:px-8 py-4 flex items-center justify-between shrink-0">
        <button 
          onClick={goHome}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <img src="/logo.png" alt="ClearStatement Logo" className="w-7 h-7 rounded object-contain shrink-0" />
          <span className="font-bold tracking-tight text-lg text-white">
            ClearStatement
          </span>
        </button>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              {!isPaid && scansLeft > 0 && (
                <span className="text-xs text-[#F9C513] font-medium hidden sm:block">
                  {scansLeft} free scan{scansLeft > 1 ? 's' : ''}
                </span>
              )}
              {isPaid && (
                <span className="text-xs text-[#3ECF8E] font-medium hidden sm:block">
                  {scansLeft} scans left
                </span>
              )}
              <img src={user.user_metadata?.avatar_url} className="w-7 h-7 rounded-full border border-white/20" alt="Profile" />
              <button onClick={signOut} className="text-xs text-gray-400 hover:text-white transition-colors font-medium">
                Sign out
              </button>
            </>
          ) : (
            <button
              onClick={signInWithGoogle}
              className="text-xs bg-[#3ECF8E] text-black hover:bg-[#32a873] px-4 py-2 rounded font-bold transition-all"
            >
              Start building
            </button>
          )}
        </div>
      </nav>

      {/* BACKGROUND GRID */}
      <div className="absolute inset-0 z-0 pointer-events-none bg-grid-pattern opacity-30" style={{ maskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)' }}></div>

      <div className="flex-grow max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 w-full relative z-10 flex flex-col items-center">
        
        {/* MAIN UPLOAD SECTION */}
        {!showPaywall && !showSignupWall && !result && (
          <div className="w-full flex flex-col items-center">
            
            <div className="text-center mb-12 max-w-3xl">
              <div className="inline-flex items-center gap-2 border border-white/10 rounded-full px-4 py-1.5 text-xs text-gray-300 mb-8 bg-[#1A1A1A] hover:bg-[#222222] transition-colors cursor-default">
                <span className="w-2 h-2 rounded-full bg-[#3ECF8E] animate-pulse"></span>
                ClearStatement 2.0 is live. <span className="text-[#3ECF8E] ml-1">Read the docs →</span>
              </div>
              <h1 className="text-5xl sm:text-7xl font-semibold text-white mb-6 tracking-tight leading-[1.1]">
                Underwrite in seconds. <br/>
                <span className="text-[#3ECF8E]">Scale to millions.</span>
              </h1>
              <p className="text-gray-400 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed">
                The AI-powered parsing platform for Indian banking. Drop a statement, extract verified income, and assess risk instantly.
              </p>
            </div>

            {/* UPLOAD WIDGET */}
            <div className="w-full max-w-3xl glass-panel rounded-2xl p-6 sm:p-10 shadow-[0_0_40px_rgba(62,207,142,0.05)] border border-[#3ECF8E]/20">
              
              {user && (
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
                  <span className="text-sm font-medium text-gray-300">Workspace: <span className="text-white">{user.email}</span></span>
                  {!isPaid && (
                    <span className="text-xs bg-[#1A1A1A] text-gray-300 border border-white/10 px-3 py-1 rounded-md font-mono">
                      Quota: {scansLeft}/2
                    </span>
                  )}
                </div>
              )}

              <label className={`flex flex-col items-center justify-center w-full h-48 sm:h-64 border border-dashed rounded-xl cursor-pointer transition-all duration-200 ${
                file ? 'border-[#3ECF8E] bg-[#3ECF8E]/5' : 'border-white/20 bg-[#111111] hover:border-[#3ECF8E]/50 hover:bg-[#1A1A1A]'
              }`}>
                <div className="text-center px-4">
                  {file ? (
                    <>
                      <div className="w-12 h-12 rounded-lg bg-[#3ECF8E]/20 flex items-center justify-center mx-auto mb-4 border border-[#3ECF8E]/30">
                        <svg className="w-6 h-6 text-[#3ECF8E]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </div>
                      <p className="text-white text-base font-semibold tracking-wide truncate max-w-[250px] mx-auto">{file.name}</p>
                      <p className="text-[#3ECF8E] text-xs mt-2 font-mono uppercase tracking-widest">Document Secured</p>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-lg bg-[#1A1A1A] border border-white/10 flex items-center justify-center mx-auto mb-4 transition-transform group-hover:scale-110">
                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                      </div>
                      <p className="text-white text-lg font-medium mb-1">Click to upload statement</p>
                      <p className="text-gray-500 text-sm">PDF formats up to 50MB supported</p>
                    </>
                  )}
                </div>
                <input type="file" accept=".pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </label>

              {file && !loading && (
                <div className="mt-5 animate-slide-up">
                  <input
                    type="password"
                    placeholder="PDF Password (Optional)"
                    value={pdfPassword}
                    onChange={(e) => setPdfPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-[#111111] border border-white/10 rounded-lg focus:outline-none focus:border-[#3ECF8E] text-sm text-white placeholder-gray-500 transition-colors font-mono"
                  />
                </div>
              )}

              {loading ? (
                <div className="w-full mt-6 bg-[#111111] border border-white/10 rounded-lg p-5">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs text-[#3ECF8E] font-mono animate-pulse">{loadingText}</span>
                    <span className="text-xs text-white font-mono">{Math.round(progress)}%</span>
                  </div>
                  <div className="w-full bg-[#1A1A1A] rounded-full h-1.5 overflow-hidden">
                    <div className="bg-[#3ECF8E] h-1.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                  </div>
                </div>
              ) : (
                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleUpload}
                    disabled={!file}
                    className={`flex-1 font-semibold py-3.5 rounded-lg text-sm transition-all ${
                      file ? 'bg-[#3ECF8E] hover:bg-[#32a873] text-black shadow-lg' : 'bg-[#1A1A1A] text-gray-500 cursor-not-allowed border border-white/10'
                    }`}
                  >
                    {!user ? 'Start project (Free)' : 'Execute Analysis'}
                  </button>
                  {file && (
                    <button onClick={() => { setFile(null); setPdfPassword(''); }} className="px-6 py-3.5 font-medium bg-[#111111] hover:bg-[#1A1A1A] border border-white/10 text-white rounded-lg transition-colors text-sm">
                      Clear
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* MARQUEE */}
            <div className="mt-20 w-full overflow-hidden border-y border-white/5 py-8 bg-[#0a0a0a]">
              <p className="text-center text-xs text-gray-500 font-mono mb-6 uppercase tracking-widest">Supported Infrastructure</p>
              <div className="relative flex">
                <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[#000000] to-transparent z-10"></div>
                <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-[#000000] to-transparent z-10"></div>
                <div className="animate-scroll">
                  {SUPPORTED_BANKS.map((bank, index) => (
                    <div key={`bank-1-${index}`} className="flex items-center justify-center px-8">
                      <span className="text-lg font-bold text-gray-600/50 whitespace-nowrap">{bank}</span>
                    </div>
                  ))}
                  {SUPPORTED_BANKS.map((bank, index) => (
                    <div key={`bank-2-${index}`} className="flex items-center justify-center px-8">
                      <span className="text-lg font-bold text-gray-600/50 whitespace-nowrap">{bank}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* SUPABASE-STYLE BENTO BOX FEATURES */}
            <div className="mt-24 w-full max-w-5xl">
               <h2 className="text-3xl font-semibold text-white mb-10 text-center tracking-tight">Best of breed analytics.<br/><span className="text-gray-500">Integrated as a platform.</span></h2>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Card 1 */}
                  <div className="bg-[#111111] border border-white/5 p-8 rounded-2xl hover:border-white/10 transition-colors">
                    <div className="flex items-center gap-3 mb-4">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                      <h3 className="text-white font-semibold">AI Database</h3>
                    </div>
                    <p className="text-gray-400 text-sm leading-relaxed">
                      Every statement is processed via a high-capacity Groq LLM cluster. Easily extract income, EMIs, and transactional history from unstructured PDFs.
                    </p>
                  </div>
                  {/* Card 2 */}
                  <div className="bg-[#111111] border border-white/5 p-8 rounded-2xl hover:border-white/10 transition-colors">
                    <div className="flex items-center gap-3 mb-4">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                      <h3 className="text-white font-semibold">Fraud Authentication</h3>
                    </div>
                    <p className="text-gray-400 text-sm leading-relaxed">
                      Add instant fraud detection securing your underwriting pipeline. Automatically flags bounced cheques and hidden loan obligations.
                    </p>
                  </div>
                  {/* Card 3 */}
                  <div className="bg-[#111111] border border-white/5 p-8 rounded-2xl hover:border-white/10 transition-colors">
                    <div className="flex items-center gap-3 mb-4">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                      <h3 className="text-white font-semibold">Edge Security</h3>
                    </div>
                    <p className="text-gray-400 text-sm leading-relaxed">
                      Execute financial processing directly in secure memory. Files are instantly and permanently purged. Zero data retention policies applied.
                    </p>
                  </div>
                  {/* Card 4 */}
                  <div className="bg-[#111111] border border-white/5 p-8 rounded-2xl hover:border-white/10 transition-colors">
                    <div className="flex items-center gap-3 mb-4">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      <h3 className="text-white font-semibold">Instant Outputs</h3>
                    </div>
                    <p className="text-gray-400 text-sm leading-relaxed">
                      Build lending decisions faster with real-time data synchronization. Get an underwriter-ready risk score formatted in JSON in under 10 seconds.
                    </p>
                  </div>
               </div>
            </div>
          </div>
        )}

        {/* RESULTS DASHBOARD */}
        {result && !result.error && (
          <div className="w-full max-w-4xl mx-auto animate-slide-up">
            <div className="mb-8 border-b border-white/10 pb-6 flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-semibold text-white tracking-tight">Database Execution Success</h2>
                <p className="text-gray-500 text-sm mt-2">Parsed response via LLM cluster</p>
              </div>
              <span className="px-3 py-1 bg-[#1A1A1A] border border-white/10 rounded-full text-xs font-mono text-[#3ECF8E]">
                Status 200 OK
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <div className="bg-[#111111] border border-white/5 p-6 rounded-xl hover:border-white/10 transition-colors">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-gray-400 text-sm font-medium">Verified Salary Credits</p>
                  <svg className="w-4 h-4 text-[#3ECF8E]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                </div>
                <p className="text-4xl font-semibold text-white">₹{(result.verified_monthly_salary || 0).toLocaleString('en-IN')}</p>
              </div>

              <div className="bg-[#111111] border border-white/5 p-6 rounded-xl hover:border-white/10 transition-colors">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-gray-400 text-sm font-medium">Algorithmic Risk Score</p>
                  <span className={`text-xs font-mono px-2 py-0.5 rounded border border-white/10 ${getRiskColor(result.risk_score || 10)} bg-black/50`}>
                    {getRiskLabel(result.risk_score || 10)}
                  </span>
                </div>
                <p className="text-4xl font-semibold text-white">
                  {result.risk_score || 0}<span className="text-gray-600 text-2xl">/10</span>
                </p>
              </div>

              <div className="bg-[#111111] border border-white/5 p-6 rounded-xl hover:border-white/10 transition-colors">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-gray-400 text-sm font-medium">Bounced Cheques</p>
                </div>
                <p className={`text-4xl font-semibold ${(result.bounced_cheque_count || 0) === 0 ? 'text-[#3ECF8E]' : 'text-[#FF5A5F]'}`}>
                  {result.bounced_cheque_count || 0}
                </p>
              </div>

              <div className="bg-[#111111] border border-white/5 p-6 rounded-xl hover:border-white/10 transition-colors">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-gray-400 text-sm font-medium">Total EMIs Detected</p>
                </div>
                <p className="text-4xl font-semibold text-white">₹{(result.total_emi || 0).toLocaleString('en-IN')}</p>
              </div>
            </div>

            <div className="flex justify-end">
               <button
                 onClick={goHome}
                 className="bg-[#1A1A1A] hover:bg-[#222222] border border-white/10 text-white font-medium py-3 px-6 rounded-lg transition-colors text-sm"
               >
                 Execute New Query
               </button>
            </div>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <footer className="border-t border-white/10 bg-[#000000] py-12 mt-auto relative z-20">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
             <img src="/logo.png" alt="ClearStatement Logo" className="w-6 h-6 grayscale hover:grayscale-0 transition-all cursor-pointer" onClick={goHome} />
             <span className="font-semibold text-white tracking-tight">ClearStatement</span>
          </div>
          <div className="flex gap-8 text-sm text-gray-500 font-medium">
             <button className="hover:text-white transition-colors">Product</button>
             <button className="hover:text-white transition-colors">Developers</button>
             <button className="hover:text-white transition-colors">Pricing</button>
             <button className="hover:text-white transition-colors">Privacy</button>
          </div>
          <div className="text-xs text-gray-600 font-mono">
            Deployed by <span className="text-white">TheArise</span>
          </div>
        </div>
      </footer>
    </div>
  )
}


