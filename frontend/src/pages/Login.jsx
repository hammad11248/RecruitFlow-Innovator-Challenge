import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Mail, Lock, Loader2, ShieldAlert } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Retrieve preserved target URL or default to /hr
  const from = location.state?.from?.pathname || '/hr'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(email, password)
      navigate(from, { replace: true })
    } catch (err) {
      console.error("Login error details:", err)
      const errorMessages = {
        'auth/user-not-found': 'No account found with this email.',
        'auth/wrong-password': 'Incorrect password. Please try again.',
        'auth/invalid-email': 'Please enter a valid email address.',
        'auth/too-many-requests': 'Too many attempts. Please try again later.',
        'auth/invalid-credential': 'Invalid login credentials. Please check your email and password.',
      }
      setError(errorMessages[err.code] || err.message || 'Login failed. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden moving-gradient text-slate-100 font-sans">
      
      {/* Moving gradient background stylesheet */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        body { font-family: 'Inter', sans-serif; }
        
        @keyframes gradientBG {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .moving-gradient {
          background: linear-gradient(-45deg, #09090F, #10101E, #14142B, #09090F);
          background-size: 400% 400%;
          animation: gradientBG 12s ease infinite;
        }
      `}</style>

      {/* Decorative glows */}
      <div className="absolute top-1/3 left-1/3 w-80 h-80 bg-indigo-500/5 rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute bottom-1/3 right-1/3 w-80 h-80 bg-violet-500/5 rounded-full blur-[80px] pointer-events-none" />

      <div className="relative w-full max-w-md animate-slide-up z-10">
        
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-500 shadow-lg shadow-indigo-500/20 mb-4 hover:scale-105 transition-transform duration-300">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-50 tracking-tight">RecruitFlow HR</h1>
          <p className="text-slate-400 mt-2 text-sm">Sign in to coordinate candidate evaluation pipelines</p>
        </div>

        {/* Glass Login Card */}
        <div className="bg-[#1A1A2E]/40 backdrop-blur-xl border border-slate-800 rounded-xl p-8 shadow-[0_0_40px_rgba(99,102,241,0.05)] relative overflow-hidden">
          {/* Card subtle lighting filter */}
          <div className="absolute inset-0 bg-gradient-to-tr from-white/2 to-white/0 pointer-events-none" />

          <form onSubmit={handleSubmit} className="space-y-6 relative" id="login-form">
            {error && (
              <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 animate-fade-in" id="login-error">
                <ShieldAlert className="w-5 h-5 text-red-400 flex-shrink-0" />
                <span className="text-red-300 text-xs font-medium">{error}</span>
              </div>
            )}

            {/* Email field (icon prefixed) */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider" htmlFor="email">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="hr@recruitflow.com"
                  required
                  className="block w-full pl-10 pr-4 py-3 bg-[#16213E]/50 border border-slate-855 focus:border-indigo-500 rounded-lg text-slate-200 outline-none text-sm placeholder-slate-650 transition-all focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Password field (icon prefixed) */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="block w-full pl-10 pr-4 py-3 bg-[#16213E]/50 border border-slate-855 focus:border-indigo-500 rounded-lg text-slate-200 outline-none text-sm placeholder-slate-650 transition-all focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Glowing Submit Trigger */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 text-white font-medium rounded-lg py-3 text-sm transition-all shadow-lg hover:shadow-indigo-500/20 flex items-center justify-center gap-2 cursor-pointer border border-transparent"
              id="login-submit"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Authenticating credentials...</span>
                </>
              ) : (
                'Sign In to Dashboard'
              )}
            </button>
          </form>
        </div>

        {/* Back to Application link */}
        <p className="text-center text-slate-500 text-xs mt-6">
          Not an administrator?{' '}
          <Link to="/" className="text-indigo-400 hover:text-indigo-300 transition-colors font-medium">
            Candidate Application Form
          </Link>
        </p>
      </div>
    </div>
  )
}
