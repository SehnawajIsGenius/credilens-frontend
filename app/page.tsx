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
      const res = await axios.post('https://credilens-api-xyz.onrender.com/upload', formData)
      setResult(res.data)
    } catch (e) {
      setError('Something went wrong. Make sure your backend is running.')
    }
    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-8 selection:bg-blue-500/30">
      
      {/* Header Section */}
      <div className="mb-10 text-center relative mt-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-32 bg-blue-600/20 blur-[100px] rounded-full pointer-events-none"></div>
        <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 mb-3 tracking-tight">ClearStatement</h1>
        <p className="text-gray-300 text-lg font-medium tracking-wide">AI Bank Statement Analyzer</p>
        <p className="text-gray-500 text-sm mt-2">Upload a PDF — get verified income data in seconds</p>
      </div>

      {/* Upload Section */}
      {!result && (
        <div className="w-full max-w-lg bg-gray-900/40 backdrop-blur-xl border border-gray-800 rounded-3xl p-8 shadow-2xl">
          <label className={`flex flex-col items-center justify-center w-full h-56 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-300 group ${
            file ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-gray-700 hover:border-blue-500/50 hover:bg-blue-500/5'
          }`}>
            <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
              {file ? (
                <>
                  <svg className="w-12 h-12 text-emerald-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  <p className="text-emerald-400 text-sm font-semibold truncate w-full">{file.name}</p>
                  <p className="text-gray-500 text-xs mt-1">Ready to analyze</p>
                </>
              ) : (
                <>
                  <svg className="w-10 h-10 text-gray-500 mb-3 group-hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                  <p className="text-gray-300 text-sm mb-1 font-medium">Drop your statement here</p>
                  <p className="text-gray-600 text-xs">Only PDF files are supported</p>
                </>
              )}
            </div>
            <input type="file" accept=".pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>

          <button
            onClick={handleUpload}
            disabled={!file || loading}
            className={`w-full mt-6 text-white font-bold py-4 rounded-xl transition-all duration-300 shadow-lg ${
              loading 
                ? 'bg-blue-800 animate-pulse cursor-not-allowed' 
                : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 hover:shadow-blue-500/25 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100'
            }`}
          >
            {loading ? '⚡ Extracting AI Data...' : 'Analyze Statement'}
          </button>

          {error && <p className="text-red-400 text-sm mt-4 text-center bg-red-400/10 py-2 rounded-lg border border-red-400/20">{error}</p>}
        </div>
      )}

      {/* Results Dashboard */}
      {result && (
        <div className="w-full max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-2 gap-4 mb-4">
            
            <div className="bg-gray-900/40 backdrop-blur-md border border-gray-700/50 rounded-2xl p-6 shadow-xl hover:bg-gray-800/50 transition-all">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <p className="text-gray-400 text-xs uppercase tracking-widest">Monthly Income</p>
              </div>
              <p className="text-4xl font-bold text-emerald-400">
                ₹{result.verified_monthly_salary?.toLocaleString('en-IN')}
              </p>
            </div>

            <div className="bg-gray-900/40 backdrop-blur-md border border-gray-700/50 rounded-2xl p-6 shadow-xl hover:bg-gray-800/50 transition-all">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
                <p className="text-gray-400 text-xs uppercase tracking-widest">Risk Score</p>
              </div>
              <p className={`text-4xl font-bold ${result.risk_score >= 7 ? 'text-emerald-400' : result.risk_score >= 4 ? 'text-amber-400' : 'text-rose-400'}`}>
                {result.risk_score}/10
              </p>
            </div>

            <div className="bg-gray-900/40 backdrop-blur-md border border-gray-700/50 rounded-2xl p-6 shadow-xl hover:bg-gray-800/50 transition-all">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                <p className="text-gray-400 text-xs uppercase tracking-widest">Bounced Cheques</p>
              </div>
              <p className={`text-4xl font-bold ${result.bounced_cheque_count === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {result.bounced_cheque_count}
              </p>
            </div>

            <div className="bg-gray-900/40 backdrop-blur-md border border-gray-700/50 rounded-2xl p-6 shadow-xl hover:bg-gray-800/50 transition-all">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                <p className="text-gray-400 text-xs uppercase tracking-widest">Monthly EMI</p>
              </div>
              <p className="text-4xl font-bold text-white">
                ₹{result.total_emi?.toLocaleString('en-IN')}
              </p>
            </div>

          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="col-span-1 bg-gray-900/40 backdrop-blur-md border border-gray-700/50 rounded-2xl p-6 shadow-xl hover:bg-gray-800/50 transition-all">
              <p className="text-gray-400 text-xs uppercase tracking-widest mb-2">Avg Balance</p>
              <p className="text-2xl font-bold text-white">₹{result.average_balance?.toLocaleString('en-IN')}</p>
            </div>

            <div className="col-span-2 bg-gray-900/40 backdrop-blur-md border border-gray-700/50 rounded-2xl p-6 shadow-xl hover:bg-gray-800/50 transition-all">
              <p className="text-gray-400 text-xs uppercase tracking-widest mb-2">AI Underwriter Summary</p>
              <p className="text-gray-300 text-sm leading-relaxed">{result.summary}</p>
            </div>
          </div>

          <button
            onClick={() => { setResult(null); setFile(null) }}
            className="w-full bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700 text-gray-300 font-semibold py-4 rounded-xl transition-all shadow-lg hover:text-white"
          >
            Analyze Another Statement
          </button>
        </div>
      )}

    </main>
  )
}
