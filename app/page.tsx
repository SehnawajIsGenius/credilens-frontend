'use client'
import { useState } from 'react'
import axios from 'axios'

export default function Home() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  const handleUpload = async () => {
    if (!file) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await axios.post('https://credilens-api.onrender.com/upload', formData)
      setResult(res.data)
    } catch (e: any) {
      setError('Connection failed. Wait 60 seconds and try again — server may be waking up.')
    }
    setLoading(false)
  }

  const getRiskColor = (score: number) => {
    if (score >= 7) return 'text-emerald-400'
    if (score >= 4) return 'text-amber-400'
    return 'text-rose-400'
  }

  const getRiskLabel = (score: number) => {
    if (score >= 7) return 'Low Risk'
    if (score >= 4) return 'Medium Risk'
    return 'High Risk'
  }

  const getRiskBg = (score: number) => {
    if (score >= 7) return 'bg-emerald-500/10 border-emerald-500/20'
    if (score >= 4) return 'bg-amber-500/10 border-amber-500/20'
    return 'bg-rose-500/10 border-rose-500/20'
  }

  return (
    <main className="min-h-screen bg-[#080C14] text-white">
      
      <nav className="border-b border-white/5 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
          </div>
          <span className="font-semibold text-white">ClearStatement</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-3 py-1 rounded-full">AI Powered</span>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-16">

        {!result && (
          <>
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 text-xs text-blue-400 mb-6">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></div>
                Trusted by lending teams across India
              </div>
              <h1 className="text-5xl font-bold text-white mb-4 leading-tight">
                Verify income in
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400"> 8 seconds</span>
              </h1>
              <p className="text-gray-400 text-lg max-w-xl mx-auto">Upload any Indian bank statement PDF. Get verified salary, risk score, and underwriter summary instantly.</p>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-10">
              {[
                { label: 'Faster than manual review', value: '337x' },
                { label: 'Cheaper than Perfios', value: '10x' },
                { label: 'Bank formats supported', value: '12+' },
              ].map((stat) => (
                <div key={stat.label} className="bg-white/3 border border-white/8 rounded-2xl p-5 text-center">
                  <p className="text-2xl font-bold text-white mb-1">{stat.value}</p>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                </div>
              ))}
            </div>

            <div className="bg-white/3 border border-white/8 rounded-3xl p-8">
              <label className={`flex flex-col items-center justify-center w-full h-52 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-200 ${
                file ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/10 hover:border-blue-500/40 hover:bg-blue-500/3'
              }`}>
                <div className="text-center px-4">
                  {file ? (
                    <>
                      <div className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-3">
                        <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                      </div>
                      <p className="text-emerald-400 text-sm font-medium">{file.name}</p>
                      <p className="text-gray-600 text-xs mt-1">Ready to analyze</p>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3">
                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
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
                className={`w-full mt-5 font-semibold py-4 rounded-xl transition-all duration-200 text-sm ${
                  loading
                    ? 'bg-blue-600/50 text-blue-300 cursor-not-allowed'
                    : file
                    ? 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-lg shadow-blue-500/20'
                    : 'bg-white/5 text-gray-600 cursor-not-allowed'
                }`}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                    Analyzing Statement...
                  </span>
                ) : 'Analyze Statement'}
              </button>

              {error && (
                <div className="mt-4 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
                  <p className="text-rose-400 text-sm text-center">{error}</p>
                </div>
              )}
            </div>
          </>
        )}

        {result && (
          <div>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-white">Analysis Complete</h2>
                <p className="text-gray-500 text-sm mt-1">AI-verified financial summary</p>
              </div>
              <span className={`text-xs font-medium px-3 py-1.5 rounded-full border ${getRiskBg(result.risk_score)}`}>
                <span className={getRiskColor(result.risk_score)}>{getRiskLabel(result.risk_score)}</span>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-white/3 border border-white/8 rounded-2xl p-6">
                <p className="text-gray-500 text-xs uppercase tracking-widest mb-3">Monthly Income</p>
                <p className="text-4xl font-bold text-emerald-400">₹{result.verified_monthly_salary?.toLocaleString('en-IN')}</p>
                <p className="text-gray-600 text-xs mt-2">Verified salary credits</p>
              </div>

              <div className="bg-white/3 border border-white/8 rounded-2xl p-6">
                <p className="text-gray-500 text-xs uppercase tracking-widest mb-3">Risk Score</p>
                <p className={`text-4xl font-bold ${getRiskColor(result.risk_score)}`}>{result.risk_score}<span className="text-gray-600 text-2xl">/10</span></p>
                <p className="text-gray-600 text-xs mt-2">{getRiskLabel(result.risk_score)}</p>
              </div>

              <div className="bg-white/3 border border-white/8 rounded-2xl p-6">
                <p className="text-gray-500 text-xs uppercase tracking-widest mb-3">Bounced Cheques</p>
                <p className={`text-4xl font-bold ${result.bounced_cheque_count === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{result.bounced_cheque_count}</p>
                <p className="text-gray-600 text-xs mt-2">{result.bounced_cheque_count === 0 ? 'No bounces detected' : 'Bounces found'}</p>
              </div>

              <div className="bg-white/3 border border-white/8 rounded-2xl p-6">
                <p className="text-gray-500 text-xs uppercase tracking-widest mb-3">Monthly EMI</p>
                <p className="text-4xl font-bold text-white">₹{result.total_emi?.toLocaleString('en-IN')}</p>
                <p className="text-gray-600 text-xs mt-2">Total loan obligations</p>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-4 mb-6">
              <div className="col-span-2 bg-white/3 border border-white/8 rounded-2xl p-6">
                <p className="text-gray-500 text-xs uppercase tracking-widest mb-3">Avg Balance</p>
                <p className="text-3xl font-bold text-white">₹{result.average_balance?.toLocaleString('en-IN')}</p>
                <p className="text-gray-600 text-xs mt-2">Monthly average</p>
              </div>

              <div className="col-span-3 bg-white/3 border border-white/8 rounded-2xl p-6">
                <p className="text-gray-500 text-xs uppercase tracking-widest mb-3">AI Underwriter Summary</p>
                <p className="text-gray-300 text-sm leading-relaxed">{result.summary}</p>
              </div>
            </div>

            <button
              onClick={() => { setResult(null); setFile(null) }}
              className="w-full bg-white/3 hover:bg-white/6 border border-white/8 text-gray-400 hover:text-white font-medium py-4 rounded-xl transition-all text-sm"
            >
              Analyze Another Statement
            </button>
          </div>
        )}
      </div>
    </main>
  )
}


