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
  const [pdfPassword, setPdfPassword] = useState('') // NEW: Password State
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [loadingText, setLoadingText] = useState('Connecting to secure server...')
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
    setUser(null)
    setResult(null)
    setFile(null)
    setPdfPassword('')
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
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      // NEW: Send password to the API if user typed one
      if (pdfPassword) {
        formData.append('password', pdfPassword)
      }
      
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
      setPdfPassword('') // Clear password after success
      showToast('Analysis complete!', 'success')
    } catch (e: any) {
      showToast('Connection failed or incorrect password. Please try again.', 'error')
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
    <div className={`min-h-screen bg-[#080C14] text-white flex flex-col overflow-x-hidden ${jakarta.className}`}>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-scroll {
          animation: scroll 50s linear infinite;
          display: flex;
          width: max-content;
        }
        .animate-scroll:hover {
          animation-play-state: paused;
        }
        @keyframes slide-up {
          0% { transform: translateY(100%); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up {
          animation: slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}} />

      {toast && (
        <div className={`fixed bottom-6 right-6 z-[100] px-5 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-slide-up border backdrop-blur-md ${
          toast.type === 'error' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
        }`}>
          {toast.type === 'error' ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
          )}
          <p className="text-sm font-semibold tracking-wide">{toast.msg}</p>
        </div>
      )}

      <nav className="border-b border-white/5 px-4 sm:px-8 py-4 flex items-center justify-between shrink-0 relative z-20 bg-[#080C14]">
        <button 
          onClick={() => { setShowPaywall(false); setShowSignupWall(false); setShowCheckout({show: false, amount: '', planName: '', scans: 0}); }}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <img src="/logo.png" alt="ClearStatement Logo" className="w-8 h-8 rounded-lg object-contain shrink-0" />
          <span className="font-extrabold tracking-tight text-lg sm:text-xl text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">
            ClearStatement
          </span>
        </button>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              {!isPaid && scansLeft > 0 && (
                <span className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 px-3 py-1 rounded-full hidden sm:block font-medium">
                  {scansLeft} free scan{scansLeft > 1 ? 's' : ''} left
                </span>
              )}
              {isPaid && (
                <span className="text-xs text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-3 py-1 rounded-full hidden sm:block font-medium">
                  {scansLeft} scans remaining
                </span>
              )}
              <img src={user.user_metadata?.avatar_url} className="w-7 h-7 rounded-full" alt="" />
              <button onClick={signOut} className="text-xs text-gray-500 hover:text-white transition-colors font-semibold tracking-wide">
                Sign out
              </button>
            </>
          ) : (
            <button
              onClick={signInWithGoogle}
              className="text-xs text-white bg-white/10 hover:bg-white/15 border border-white/10 px-4 py-2 rounded-lg font-semibold transition-all tracking-wide"
            >
              Sign in
            </button>
          )}
        </div>
      </nav>

      {/* PRIVACY MODAL */}
      {showPrivacy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0f1522] border border-white/10 rounded-2xl p-6 sm:p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto relative shadow-2xl">
            <button onClick={() => setShowPrivacy(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            <h3 className="text-2xl font-bold text-white mb-6">Privacy Policy</h3>
            <div className="text-gray-300 text-sm space-y-4">
              <p><strong>1. Data Security:</strong> ClearStatement employs bank-grade encryption to process your documents. We do not store, sell, or share your financial data.</p>
              <p><strong>2. Document Handling:</strong> Uploaded bank statement PDFs are held in temporary memory strictly for the duration of the AI analysis (typically under 10 seconds). They are permanently and irreversibly destroyed immediately after the risk score is generated.</p>
              <p><strong>3. Authentication:</strong> We use secure OAuth via Google. We only access your basic profile information (email, name) to provide core account functionality and scan tracking.</p>
              <p><strong>4. Contact:</strong> For detailed privacy inquiries, please reach out to our team via the Support link.</p>
            </div>
            <button onClick={() => setShowPrivacy(false)} className="mt-8 w-full bg-white/10 hover:bg-white/15 text-white py-3 rounded-xl font-bold transition-all tracking-wide">Close</button>
          </div>
        </div>
      )}

      {/* TERMS MODAL */}
      {showTerms && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0f1522] border border-white/10 rounded-2xl p-6 sm:p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto relative shadow-2xl">
            <button onClick={() => setShowTerms(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            <h3 className="text-2xl font-bold text-white mb-6">Terms of Service</h3>
            <div className="text-gray-300 text-sm space-y-4">
              <p><strong>1. Service Usage:</strong> ClearStatement provides AI-driven financial analysis to assist in underwriter risk assessment. The results are algorithmic estimates and should not be used as the sole basis for lending decisions.</p>
              <p><strong>2. Accuracy:</strong> While our parsing models are highly accurate, users are responsible for verifying final figures. ClearStatement is not liable for financial losses incurred due to discrepancies in risk scoring.</p>
              <p><strong>3. Payments & Subscriptions:</strong> All scan packages are non-refundable once utilized. Account credits do not expire unless explicitly stated in the selected tier.</p>
              <p><strong>4. Fair Use:</strong> Automated scraping or API abuse is strictly prohibited and will result in immediate account termination without refund.</p>
            </div>
            <button onClick={() => setShowTerms(false)} className="mt-8 w-full bg-white/10 hover:bg-white/15 text-white py-3 rounded-xl font-bold transition-all tracking-wide">Close</button>
          </div>
        </div>
      )}

      {/* CHECKOUT MODAL */}
      {showCheckout.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0f1522] border border-white/10 rounded-2xl p-6 sm:p-8 max-w-md w-full relative shadow-2xl">
            <button 
              onClick={() => setShowCheckout({show: false, amount: '', planName: '', scans: 0})}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1 mb-4">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                <span className="text-xs text-emerald-400 font-bold tracking-wide">Secure Checkout Session</span>
              </div>
              <h3 className="text-2xl font-bold text-white mb-1">Pay ₹{showCheckout.amount}</h3>
              <p className="text-gray-400 text-sm font-medium">{showCheckout.planName} Plan • {showCheckout.scans} Scans</p>
            </div>

            {timeLeft > 0 ? (
              <>
                <div className="flex flex-col items-center mb-6">
                  <div className="bg-white p-3 rounded-2xl shadow-inner mb-4 relative">
                    <img src="/qr.png" alt="UPI QR Code" className="w-48 h-48 object-cover rounded-lg" />
                  </div>
                  
                  <div className="flex items-center gap-2 text-rose-400 bg-rose-400/10 px-4 py-2 rounded-lg border border-rose-400/20">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    <span className="text-sm font-semibold">QR Expires in: </span>
                    <span className="text-lg font-bold font-mono tracking-widest">{formatTime(timeLeft)}</span>
                  </div>
                </div>

                <div className="space-y-4 mb-6 text-sm text-gray-300 bg-white/5 p-4 rounded-xl border border-white/10 font-medium">
                  <p className="flex items-start gap-2">
                    <span className="text-blue-400 font-bold">1.</span> Scan with GPay, PhonePe, or Paytm.
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-blue-400 font-bold">2.</span> Take a screenshot of the successful payment.
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-blue-400 font-bold">3.</span> Email us the screenshot to instantly unlock.
                  </p>
                </div>
                
                <a 
                  href={`https://mail.google.com/mail/?view=cm&fs=1&to=${SUPPORT_EMAIL}&su=Payment%20Confirmation%20-%20${showCheckout.planName}%20Plan&body=Hello%20ClearStatement%20Billing%20Team,%0A%0AI%20have%20completed%20the%20payment%20of%20Rs%20${showCheckout.amount}%20for%20the%20${showCheckout.planName}%20Plan%20(${showCheckout.scans}%20scans).%0A%0AMy%20account%20email%20is:%20${user?.email}%0A%0A[PLEASE ATTACH YOUR PAYMENT SCREENSHOT HERE]%0A%0AThank%20you.`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 w-full bg-white text-gray-900 hover:bg-gray-100 font-bold py-3.5 rounded-xl transition-all shadow-lg tracking-wide"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                  Email Screenshot via Gmail
                </a>
              </>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center mx-auto mb-4 border border-rose-500/20">
                  <svg className="w-8 h-8 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </div>
                <h4 className="text-xl font-bold text-white mb-2 tracking-tight">Session Expired</h4>
                <p className="text-gray-400 text-sm mb-6 font-medium">Your payment session has timed out for security reasons.</p>
                <button 
                  onClick={() => setTimeLeft(600)}
                  className="bg-white/10 hover:bg-white/15 text-white px-6 py-2 rounded-lg text-sm font-bold transition-all tracking-wide"
                >
                  Generate New QR Code
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex-grow max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14 w-full relative z-10">
        
        {/* SIGNUP WALL */}
        {showSignupWall && (
          <div className="text-center py-10">
            <div className="w-16 h-16 rounded-full bg-blue-500/15 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Get 2 more free scans</h2>
            <p className="text-gray-400 text-sm mb-8 max-w-sm mx-auto font-medium">
              You used your 1 guest scan. Sign in with Google to unlock 2 more free scans — no credit card needed.
            </p>
            <button
              onClick={signInWithGoogle}
              className="inline-flex items-center gap-3 bg-white text-gray-900 font-bold px-6 py-3 rounded-xl hover:bg-gray-100 transition-all shadow-lg mx-auto mb-4 tracking-wide"
            >
              Continue with Google — Free
            </button>
          </div>
        )}

        {/* PAYWALL */}
        {showPaywall && (
          <div className="py-6">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-extrabold text-white mb-2 tracking-tight">Upgrade Your Workspace</h2>
              <p className="text-gray-400 text-sm font-medium">Choose the plan that fits your volume.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-5xl mx-auto">
              <div className="bg-white/3 border border-white/10 rounded-2xl p-6 flex flex-col">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Starter</p>
                <p className="text-3xl font-extrabold text-white mb-1">₹299</p>
                <p className="text-gray-400 text-sm font-medium mb-6 pb-6 border-b border-white/5">10 Scans</p>
                <ul className="text-sm font-medium text-gray-400 space-y-3 mb-8 flex-grow">
                  <li className="flex items-center gap-2"><svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>10 statement analyses</li>
                  <li className="flex items-center gap-2"><svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>No expiration date</li>
                  <li className="flex items-center gap-2"><svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>Standard Support</li>
                </ul>
                <button
                  onClick={() => setShowCheckout({show: true, amount: '299', planName: 'Starter', scans: 10})}
                  className="w-full bg-white/10 hover:bg-white/15 border border-white/10 text-white font-bold py-3 rounded-xl transition-all tracking-wide"
                >
                  Get Starter
                </button>
              </div>

              <div className="bg-blue-500/10 border-2 border-blue-500/40 rounded-2xl p-6 relative flex flex-col transform sm:-translate-y-4 shadow-2xl">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs bg-blue-500 text-white px-3 py-1 rounded-full font-bold tracking-wide">Most Popular</span>
                <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-1">Pro</p>
                <p className="text-3xl font-extrabold text-white mb-1">₹599</p>
                <p className="text-gray-400 text-sm font-medium mb-6 pb-6 border-b border-white/5">25 Scans</p>
                <ul className="text-sm font-medium text-gray-400 space-y-3 mb-8 flex-grow">
                  <li className="flex items-center gap-2"><svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>25 statement analyses</li>
                  <li className="flex items-center gap-2"><svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>Risk score + Summary</li>
                  <li className="flex items-center gap-2"><svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>Priority Processing</li>
                </ul>
                <button
                  onClick={() => setShowCheckout({show: true, amount: '599', planName: 'Pro', scans: 25})}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold py-3 rounded-xl transition-all tracking-wide"
                >
                  Get Pro
                </button>
              </div>

              <div className="bg-white/3 border border-white/10 rounded-2xl p-6 flex flex-col">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Business</p>
                <p className="text-3xl font-extrabold text-white mb-1">₹999</p>
                <p className="text-gray-400 text-sm font-medium mb-6 pb-6 border-b border-white/5">50 Scans <span className="text-emerald-400 text-xs ml-2">(Best Value)</span></p>
                <ul className="text-sm font-medium text-gray-400 space-y-3 mb-8 flex-grow">
                  <li className="flex items-center gap-2"><svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>50 statement analyses</li>
                  <li className="flex items-center gap-2"><svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>Unlocks all features</li>
                  <li className="flex items-center gap-2"><svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>Direct Founder Support</li>
                </ul>
                <button
                  onClick={() => setShowCheckout({show: true, amount: '999', planName: 'Business', scans: 50})}
                  className="w-full bg-white/10 hover:bg-white/15 border border-white/10 text-white font-bold py-3 rounded-xl transition-all tracking-wide"
                >
                  Get Business
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MAIN UPLOAD SECTION */}
        {!showPaywall && !showSignupWall && !result && (
          <>
            <div className="max-w-4xl mx-auto relative group mt-4 sm:mt-10">
              <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-emerald-500/5 rounded-[2rem] blur-2xl opacity-50 pointer-events-none"></div>
              
              <div className="relative bg-[#0B101A] border border-white/10 rounded-[2rem] p-6 sm:p-12 shadow-2xl overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-px bg-gradient-to-r from-transparent via-blue-400/50 to-transparent"></div>

                {!user && !guestScanned && (
                  <div className="text-center mb-10">
                    <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 text-xs text-blue-400 mb-6 shadow-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></div>
                      <span className="font-semibold tracking-wide">No signup needed for your first scan</span>
                    </div>
                    <h1 className="text-4xl sm:text-6xl font-extrabold text-white mb-5 leading-tight tracking-tight">
                      Verify income in
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400"> 8 seconds</span>
                    </h1>
                    <p className="text-gray-400 text-sm sm:text-lg max-w-xl mx-auto leading-relaxed font-medium">
                      Upload any Indian bank statement PDF. Get verified salary, risk score and underwriter summary instantly.
                    </p>
                  </div>
                )}

                {user && (
                  <div className="mb-8 flex items-center justify-between pb-6 border-b border-white/5">
                    <div>
                      <h2 className="text-2xl font-bold text-white tracking-tight">Workspace</h2>
                      <p className="text-gray-500 text-sm mt-1 font-medium">{user.email}</p>
                    </div>
                    {!isPaid && (
                      <div className="text-right bg-white/5 px-4 py-2 rounded-xl border border-white/10">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-0.5">Free scans left</p>
                        <p className="text-2xl font-extrabold text-white">{scansLeft}</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="bg-white/3 border border-white/5 rounded-2xl sm:rounded-3xl p-5 sm:p-8 relative">
                  <label className={`flex flex-col items-center justify-center w-full h-44 sm:h-56 border-2 border-dashed rounded-xl sm:rounded-2xl cursor-pointer transition-all duration-300 ${
                    file ? 'border-emerald-500/50 bg-emerald-500/5 shadow-[0_0_30px_-10px_rgba(16,185,129,0.2)]' : 'border-white/10 hover:border-blue-500/40 hover:bg-blue-500/5'
                  }`}>
                    <div className="text-center px-4">
                      {file ? (
                        <>
                          <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4 shadow-inner">
                            <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <p className="text-emerald-400 text-base font-bold tracking-wide truncate max-w-xs mx-auto">{file.name}</p>
                          <p className="text-gray-500 text-xs mt-1.5 font-bold uppercase tracking-wider">Ready to analyze</p>
                        </>
                      ) : (
                        <>
                          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4 transition-transform group-hover:scale-110">
                            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                          </div>
                          <p className="text-gray-200 text-base font-semibold mb-1.5 tracking-wide">Drop bank statement PDF here</p>
                          <p className="text-gray-500 text-xs font-medium">Supports PDF statements up to 10MB</p>
                        </>
                      )}
                    </div>
                    <input type="file" accept=".pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                  </label>

                  {/* NEW: OPTIONAL PASSWORD INPUT */}
                  {file && !loading && (
                    <div className="mt-4 animate-slide-up">
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                        </div>
                        <input
                          type="password"
                          placeholder="PDF Password (Leave blank if not protected)"
                          value={pdfPassword}
                          onChange={(e) => setPdfPassword(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 text-sm text-white placeholder-gray-500 transition-all"
                        />
                      </div>
                    </div>
                  )}

                  {loading ? (
                    <div className="w-full mt-6 bg-[#080c14] border border-white/10 rounded-xl p-5 shadow-inner">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-sm text-blue-400 font-bold tracking-wide animate-pulse">{loadingText}</span>
                        <span className="text-sm text-gray-400 font-mono font-bold">{Math.round(progress)}%</span>
                      </div>
                      <div className="w-full bg-white/5 rounded-full h-2.5 overflow-hidden">
                        <div 
                          className="bg-gradient-to-r from-blue-600 to-emerald-400 h-2.5 rounded-full transition-all duration-300 ease-out relative"
                          style={{ width: `${progress}%` }}
                        >
                          <div className="absolute top-0 right-0 bottom-0 left-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMSIvPgo8L3N2Zz4=')] opacity-50"></div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-3 mt-4">
                      <button
                        onClick={handleUpload}
                        disabled={!file}
                        className={`flex-1 font-bold py-4 rounded-xl transition-all text-sm tracking-wide ${
                          file ? 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-[0_4px_14px_0_rgba(59,130,246,0.39)]'
                          : 'bg-white/5 text-gray-600 cursor-not-allowed'
                        }`}
                      >
                        {!user ? 'Analyze Free — No signup needed' : 'Analyze Statement'}
                      </button>
                      
                      {file && (
                        <button
                          onClick={(e) => { e.preventDefault(); setFile(null); setPdfPassword(''); }}
                          className="px-6 sm:px-8 font-bold py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white rounded-xl transition-all text-sm tracking-wide"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  )}

                  <div className="mt-6 flex items-start sm:items-center justify-center gap-2.5 text-center sm:text-left px-2 bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-3">
                    <svg className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5 sm:mt-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <p className="text-xs text-gray-400 leading-relaxed font-medium">
                      <span className="font-bold text-emerald-400/90">Bank-Grade Security.</span> All PDFs are encrypted and instantly deleted after analysis. We never store your financial data.
                    </p>
                  </div>
                </div>
              </div>

              {/* INFINITE MARQUEE SLIDER */}
              <div className="mt-16 sm:mt-24">
                <p className="text-center text-xs font-bold text-gray-600 uppercase tracking-widest mb-8">Seamlessly processes statements from</p>
                <div className="relative flex overflow-hidden group">
                  <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#080C14] to-transparent z-10 pointer-events-none"></div>
                  <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#080C14] to-transparent z-10 pointer-events-none"></div>
                  <div className="animate-scroll">
                    {SUPPORTED_BANKS.map((bank, index) => (
                      <div key={`bank-1-${index}`} className="flex items-center justify-center px-6 sm:px-10">
                        <span className="text-base sm:text-lg font-bold text-gray-500/40 whitespace-nowrap tracking-wide">{bank}</span>
                      </div>
                    ))}
                    {SUPPORTED_BANKS.map((bank, index) => (
                      <div key={`bank-2-${index}`} className="flex items-center justify-center px-6 sm:px-10">
                        <span className="text-base sm:text-lg font-bold text-gray-500/40 whitespace-nowrap tracking-wide">{bank}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* FEATURES GRID */}
              <div className="mt-24 sm:mt-32 max-w-5xl mx-auto px-4">
                <div className="text-center mb-12">
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Underwriting on Autopilot</h2>
                  <p className="text-gray-400 text-sm sm:text-base mt-3 font-medium max-w-2xl mx-auto">Stop wasting hours with highlighters and calculators. Let our AI do the heavy lifting.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-[#0B101A] border border-white/5 p-6 rounded-2xl shadow-lg hover:border-blue-500/30 transition-colors">
                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-5 border border-blue-500/20">
                      <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2 tracking-wide">AI-Powered Parsing</h3>
                    <p className="text-sm text-gray-400 font-medium leading-relaxed">Instantly extracts verified salary credits from messy, unstructured PDF bank statements.</p>
                  </div>
                  <div className="bg-[#0B101A] border border-white/5 p-6 rounded-2xl shadow-lg hover:border-emerald-500/30 transition-colors">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-5 border border-emerald-500/20">
                      <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2 tracking-wide">Fraud Detection</h3>
                    <p className="text-sm text-gray-400 font-medium leading-relaxed">Automatically detects and flags bounced cheques, hidden loan EMIs, and risky transactional behavior.</p>
                  </div>
                  <div className="bg-[#0B101A] border border-white/5 p-6 rounded-2xl shadow-lg hover:border-purple-500/30 transition-colors">
                    <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mb-5 border border-purple-500/20">
                      <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2 tracking-wide">Underwriter Ready</h3>
                    <p className="text-sm text-gray-400 font-medium leading-relaxed">Generates a clean, highly accurate, and exportable financial summary for immediate loan processing.</p>
                  </div>
                </div>
              </div>

              {/* FAQ SECTION */}
              <div className="mt-24 sm:mt-32 max-w-3xl mx-auto px-4 pb-10">
                <div className="text-center mb-10">
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Frequently Asked Questions</h2>
                </div>
                <div className="space-y-4">
                  {FAQS.map((faq, idx) => (
                    <div key={idx} className="bg-[#0B101A] border border-white/5 rounded-2xl overflow-hidden transition-all">
                      <button 
                        onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                        className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors"
                      >
                        <span className="font-bold text-white tracking-wide">{faq.q}</span>
                        <svg className={`w-5 h-5 text-gray-400 transform transition-transform duration-200 ${openFaq === idx ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                      </button>
                      {openFaq === idx && (
                        <div className="px-6 pb-5 pt-1 text-sm text-gray-400 font-medium leading-relaxed border-t border-white/5 mt-1">
                          {faq.a}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </>
        )}

        {/* RESULTS */}
        {result && (
          <div className="max-w-3xl mx-auto mt-8">
            <div className="flex items-start sm:items-center justify-between mb-6 gap-3">
              <div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">Analysis Complete</h2>
                <p className="text-gray-500 text-xs sm:text-sm mt-1 font-medium">AI-verified financial summary</p>
              </div>
              <span className={`text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-lg border shrink-0 shadow-sm ${
                result.risk_score >= 7 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : result.risk_score >= 4 ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
              }`}>
                {getRiskLabel(result.risk_score)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6">
              {[
                { label: 'Monthly Income', value: `₹${result.verified_monthly_salary?.toLocaleString('en-IN')}`, sub: 'Verified salary credits', color: 'text-emerald-400' },
                { label: 'Risk Score', value: `${result.risk_score}/10`, sub: getRiskLabel(result.risk_score), color: getRiskColor(result.risk_score) },
                { label: 'Bounced Cheques', value: String(result.bounced_cheque_count), sub: result.bounced_cheque_count === 0 ? 'No bounces detected' : 'Bounces found', color: result.bounced_cheque_count === 0 ? 'text-emerald-400' : 'text-rose-400' },
                { label: 'Monthly EMI', value: `₹${result.total_emi?.toLocaleString('en-IN')}`, sub: 'Total loan obligations', color: 'text-white' },
              ].map((item) => (
                <div key={item.label} className="bg-[#0B101A] border border-white/5 rounded-2xl p-6 sm:p-8 shadow-xl">
                  <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-3">{item.label}</p>
                  <p className={`text-4xl sm:text-5xl font-extrabold tracking-tight ${item.color}`}>{item.value}</p>
                  <p className="text-gray-500 text-sm mt-3 font-medium">{item.sub}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => { setResult(null); setFile(null); setPdfPassword(''); }}
              className="w-full bg-[#0B101A] hover:bg-white/5 border border-white/10 text-gray-300 hover:text-white font-bold tracking-wide py-4 rounded-xl transition-all text-sm shadow-md"
            >
              Analyze Another Statement
            </button>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <footer className="border-t border-white/5 py-10 mt-auto shrink-0 relative z-20 bg-[#080C14]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex flex-col items-center sm:items-start">
            <div className="flex items-center gap-3 mb-3">
              <img src="/logo.png" alt="ClearStatement Logo" className="w-6 h-6 rounded object-contain shrink-0" />
              <span className="font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">ClearStatement</span>
            </div>
            <p className="text-xs text-gray-600 font-medium">© 2026 ClearStatement. All rights reserved.</p>
          </div>
          
          <div className="flex items-center gap-8 text-xs font-bold tracking-wide text-gray-500">
            <button onClick={() => setShowPrivacy(true)} className="hover:text-gray-300 transition-colors">Privacy Policy</button>
            <button onClick={() => setShowTerms(true)} className="hover:text-gray-300 transition-colors">Terms of Service</button>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-gray-300 transition-colors">Support</a>
          </div>
          
          <div className="text-xs text-gray-600 font-medium px-4 py-2 bg-white/5 rounded-full border border-white/5">
            Engineered by <span className="text-blue-400/90 font-bold tracking-wide">TheArise</span>
          </div>
        </div>
      </footer>

    </div>
  )
}


