'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, TrendingUp, Shield, Sparkles, Eye, EyeOff, ArrowRight, Activity } from 'lucide-react'
import toast from 'react-hot-toast'

const STATS = [
  { label: "Revenue Today", value: '₹18,450', delta: '+12%', color: 'text-emerald-400' },
  { label: 'Gross Margin',  value: '31.2%',   delta: '+2.1%', color: 'text-violet-400' },
  { label: 'Low Stock',     value: '3 items',  delta: 'Alert', color: 'text-amber-400' },
]

const FEATURES = [
  { icon: TrendingUp, label: 'Live margin tracking across every sale', color: 'text-violet-400', bg: 'bg-violet-500/10' },
  { icon: Sparkles,   label: 'ProfitPulse AI surfaces actionable insights', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  { icon: Shield,     label: 'Multi-channel alerts: WhatsApp, Email & Telegram', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  { icon: Activity,   label: 'Real-time cashflow and receivables visibility', color: 'text-amber-400', bg: 'bg-amber-500/10' },
]

export default function LoginPage() {
  const router = useRouter()
  const setAuth = useAuthStore(s => s.setAuth)
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [showPw, setShowPw]     = useState(false)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  // Mouse parallax glow
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    }
    window.addEventListener('mousemove', handler)
    return () => window.removeEventListener('mousemove', handler)
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res  = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setAuth(data.user, data.token)
      router.push(data.user.role === 'owner' ? '/dashboard' : '/staff')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  function quickFill(role: 'owner' | 'staff') {
    setEmail(role === 'owner' ? 'owner@sbms.com' : 'staff@sbms.com')
    setPassword('password123')
  }

  return (
    <div ref={containerRef} className="min-h-screen flex overflow-hidden aurora-bg grid-bg relative">
      {/* Mouse-follow glow */}
      <div
        className="pointer-events-none absolute rounded-full transition-all duration-300 ease-out z-0"
        style={{
          width: 500, height: 500,
          left: mousePos.x - 250,
          top:  mousePos.y - 250,
          background: 'radial-gradient(circle, rgba(124,58,237,0.08) 0%, transparent 70%)',
        }}
      />

      {/* ── LEFT PANEL ── */}
      <motion.div
        initial={{ opacity: 0, x: -40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="hidden lg:flex flex-col justify-between w-[52%] relative p-14 overflow-hidden"
      >
        {/* Background blobs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-violet-600/8 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-blue-600/6 rounded-full blur-[100px]" />
        </div>

        {/* Brand */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/25">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-base font-bold text-white tracking-tight">SBMS</p>
            <p className="text-[11px] text-slate-500">Smart Business Monitor</p>
          </div>
        </div>

        {/* Hero copy */}
        <div className="relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            <h1 className="text-5xl font-bold leading-[1.1] mb-5 tracking-tight">
              Your business,<br />
              <span className="gradient-text">fully visible.</span>
            </h1>
            <p className="text-slate-400 text-base leading-relaxed mb-10 max-w-md">
              Real-time profit intelligence, inventory alerts, and AI-powered recommendations — built for SME owners who move fast.
            </p>
          </motion.div>

          <div className="space-y-3 mb-12">
            {FEATURES.map(({ icon: Icon, label, color, bg }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.08, duration: 0.5 }}
                className="flex items-center gap-3.5"
              >
                <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center flex-shrink-0 border border-white/5`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <p className="text-sm text-slate-300">{label}</p>
              </motion.div>
            ))}
          </div>

          {/* Live metrics strip */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65, duration: 0.6 }}
            className="grid grid-cols-3 gap-3"
          >
            {STATS.map((s, i) => (
              <motion.div
                key={s.label}
                whileHover={{ scale: 1.03, y: -2 }}
                transition={{ type: 'spring', stiffness: 300 }}
                className="glass rounded-2xl p-4 border border-white/6 float"
                style={{ animationDelay: `${i * 0.4}s` }}
              >
                <p className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider">{s.label}</p>
                <p className="text-lg font-bold text-white font-mono">{s.value}</p>
                <p className={`text-[11px] font-medium mt-0.5 ${s.color}`}>{s.delta}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Vertical divider */}
        <div className="absolute right-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/8 to-transparent" />
      </motion.div>

      {/* ── RIGHT PANEL (form) ── */}
      <motion.div
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="flex-1 flex items-center justify-center p-8 relative z-10"
      >
        <div className="w-full max-w-[400px]">
          {/* Mobile brand */}
          <div className="lg:hidden flex items-center gap-2.5 mb-10">
            <div className="w-9 h-9 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center">
              <Zap className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">SBMS</p>
              <p className="text-[10px] text-slate-500">Smart Business Monitor</p>
            </div>
          </div>

          {/* Form card */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.15, duration: 0.6, ease: 'easeOut' }}
            className="glass rounded-3xl p-8 border border-white/8 glow-purple"
          >
            <div className="mb-7">
              <h2 className="text-2xl font-bold text-white tracking-tight mb-1.5">Welcome back</h2>
              <p className="text-slate-500 text-sm">Sign in to your business dashboard</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Email</label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@business.com"
                    required
                    className="w-full bg-white/4 border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 focus:bg-white/6 transition-all duration-200"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full bg-white/4 border border-white/8 rounded-xl px-4 py-3 pr-11 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 focus:bg-white/6 transition-all duration-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <motion.button
                type="submit"
                disabled={loading}
                whileHover={{ scale: loading ? 1 : 1.01 }}
                whileTap={{ scale: loading ? 1 : 0.98 }}
                className="w-full relative overflow-hidden bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-60 text-white font-semibold py-3 rounded-xl text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-violet-500/25 mt-2"
              >
                <AnimatePresence mode="wait">
                  {loading ? (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-2"
                    >
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Signing in…
                    </motion.div>
                  ) : (
                    <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                      Sign in <ArrowRight className="w-4 h-4" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            </form>

            {/* Quick access */}
            <div className="mt-6 pt-6 border-t border-white/6">
              <p className="text-[11px] text-slate-600 text-center mb-3 uppercase tracking-wider">Demo accounts</p>
              <div className="grid grid-cols-2 gap-2">
                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={() => quickFill('owner')}
                  className="py-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20 text-xs font-medium text-violet-400 hover:bg-violet-500/15 transition-all duration-150"
                >
                  Owner demo
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={() => quickFill('staff')}
                  className="py-2.5 rounded-xl bg-white/4 border border-white/8 text-xs font-medium text-slate-400 hover:bg-white/7 transition-all duration-150"
                >
                  Staff demo
                </motion.button>
              </div>
            </div>
          </motion.div>

          <p className="text-center text-[11px] text-slate-600 mt-6">
            SBMS v1.0 · Smart Business Monitor
          </p>
        </div>
      </motion.div>
    </div>
  )
}
