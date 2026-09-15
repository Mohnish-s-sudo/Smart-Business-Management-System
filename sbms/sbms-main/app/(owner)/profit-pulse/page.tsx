'use client'
import { useEffect, useState, useRef } from 'react'
import { useApi } from '@/hooks/useApi'
import { formatCurrency, formatPercent } from '@/lib/utils'
import {
  Brain, TrendingUp, TrendingDown, FileText, Sparkles,
  Lightbulb, Activity, ChevronRight, Send, Bot, User
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from 'recharts'
import type { BusinessSummary, HealthScore } from '@/modules/profitPulse/services/profitAnalysisService'
import type { AIInsight } from '@/modules/profitPulse/services/aiInsightService'
import type { Suggestion } from '@/modules/profitPulse/services/aiSuggestionService'
import type { MonthlyPoint } from '@/services/profitPulseService'

interface ChatMessage { role: 'user' | 'ai'; text: string }

const QUICK_QUESTIONS = [
  'How is my profit this month?',
  'What are my top selling products?',
  'How can I reduce losses?',
  'What is my business health score?',
  'Which products should I restock?',
]

export default function ProfitPulsePage() {
  const { apiFetch } = useApi()

  const [summary, setSummary] = useState<BusinessSummary | null>(null)
  const [health, setHealth] = useState<HealthScore | null>(null)
  const [trend, setTrend] = useState<MonthlyPoint[]>([])
  const [insights, setInsights] = useState<AIInsight[]>([])
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'ai', text: 'Hello! I\'m Profit Pulse AI. Ask me anything about your business performance, profits, inventory, or expenses.' }
  ])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    Promise.all([
      apiFetch<{ summary: BusinessSummary; health: HealthScore }>('/api/profit-pulse/summary'),
      apiFetch<MonthlyPoint[]>('/api/profit-pulse/trend'),
      apiFetch<AIInsight[]>('/api/profit-pulse/insights'),
      apiFetch<Suggestion[]>('/api/profit-pulse/suggestions'),
    ]).then(([s, t, i, sg]) => {
      setSummary(s.summary); setHealth(s.health)
      setTrend(t); setInsights(i); setSuggestions(sg)
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatMessages])

  async function handleChat(question?: string) {
    const q = question || chatInput.trim()
    if (!q) return
    setChatInput('')
    setChatMessages(prev => [...prev, { role: 'user', text: q }])
    setChatLoading(true)

    try {
      const data = await apiFetch<{ answer: string }>('/api/profit-pulse/chat', {
        method: 'POST',
        body: JSON.stringify({ question: q })
      })
      setChatMessages(prev => [...prev, { role: 'ai', text: data.answer }])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to get AI response. Please try again.'
      setChatMessages(prev => [...prev, { role: 'ai', text: msg }])
    } finally {
      setChatLoading(false)
    }
  }

  async function generatePDF() {
    setGenerating(true)
    try {
      const report = await apiFetch<{
        month: string; summary: BusinessSummary; health: HealthScore
        trend: MonthlyPoint[]; insights: AIInsight[]; suggestions: Suggestion[]
      }>('/api/profit-pulse/report')

      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF()
      let y = 18

      const line = (text: string, size = 10, bold = false) => {
        doc.setFontSize(size); doc.setFont('helvetica', bold ? 'bold' : 'normal')
        const lines = doc.splitTextToSize(text, 182)
        doc.text(lines, 14, y); y += lines.length * (size * 0.45) + 2
        if (y > 272) { doc.addPage(); y = 18 }
      }

      line('Profit Pulse AI – Monthly Business Report', 18, true)
      line(`Period: ${report.month}  |  Health Score: ${report.health.score}/100 (${report.health.status})`, 10)
      y += 4

      line('FINANCIAL SUMMARY', 13, true)
      line(`Revenue: ${formatCurrency(report.summary.revenue)}`)
      line(`Expenses: ${formatCurrency(report.summary.expenses)}`)
      line(`Profit: ${formatCurrency(report.summary.profit)}`)
      line(`Loss: ${formatCurrency(report.summary.loss)}`)
      line(`Profit Margin: ${report.summary.profitMargin}%`)
      line(`Damaged Stock: ${formatCurrency(report.summary.damagedStockValue)}`)
      line(`Dead Stock: ${formatCurrency(report.summary.deadStockValue)}`)
      line(`Low Stock Items: ${report.summary.lowStockCount}`)
      y += 4

      line('BUSINESS HEALTH SCORE', 13, true)
      report.health.breakdown.forEach(b => line(`${b.label}: ${b.score}/${b.max}`))
      y += 4

      line('PROFIT TREND (6 MONTHS)', 13, true)
      report.trend.forEach(m => line(`${m.month}: Revenue ₹${m.revenue.toLocaleString()} | Expenses ₹${m.expenses.toLocaleString()} | Profit ₹${m.profit.toLocaleString()}`))
      y += 4

      line('AI INSIGHTS', 13, true)
      report.insights.forEach(i => line(`${i.icon} ${i.text}`))
      y += 4

      line('AI SUGGESTIONS', 13, true)
      report.suggestions.forEach(s => line(`[${s.priority.toUpperCase()}] ${s.action} — ${s.reason}`))

      const month = report.month.replace(' ', '_')
      doc.save(`Monthly_Business_Report_${month}.pdf`)
    } catch (err) { console.error(err) }
    finally { setGenerating(false) }
  }

  const healthColor = (status?: string) => {
    if (status === 'Excellent') return { ring: 'ring-emerald-500', text: 'text-emerald-400', bg: 'bg-emerald-500' }
    if (status === 'Good') return { ring: 'ring-teal-500', text: 'text-teal-400', bg: 'bg-teal-500' }
    if (status === 'Average') return { ring: 'ring-amber-500', text: 'text-amber-400', bg: 'bg-amber-500' }
    if (status === 'Poor') return { ring: 'ring-orange-500', text: 'text-orange-400', bg: 'bg-orange-500' }
    return { ring: 'ring-red-500', text: 'text-red-400', bg: 'bg-red-500' }
  }

  const hc = healthColor(health?.status)

  const insightBg = (type: AIInsight['type']) => ({
    positive: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-300',
    negative: 'border-red-500/20 bg-red-500/5 text-red-300',
    alert: 'border-amber-500/20 bg-amber-500/5 text-amber-300',
    neutral: 'border-slate-500/20 bg-slate-500/5 text-slate-300',
  }[type])

  const priorityBadge = (p: Suggestion['priority']) => ({
    high: 'bg-red-500/20 text-red-400 border border-red-500/30',
    medium: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    low: 'bg-slate-500/20 text-slate-400 border border-slate-500/30',
  }[p])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-3">
        <Brain className="w-10 h-10 text-indigo-400 mx-auto animate-pulse" />
        <p className="text-slate-400 text-sm">Profit Pulse AI is analyzing your business…</p>
      </div>
    </div>
  )

  return (
    <div className="space-y-8 pb-12">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
            <Brain className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Profit Pulse AI</h1>
            <p className="text-xs text-slate-500">Business Intelligence Module · AI-powered analysis</p>
          </div>
        </div>
        <button onClick={generatePDF} disabled={generating}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-sm font-medium text-white transition-all">
          <FileText className="w-4 h-4" />
          {generating ? 'Generating PDF…' : 'Export Monthly Report'}
        </button>
      </div>

      {/* ── SECTION 1: Business Summary ── */}
      <section>
        <SectionLabel icon={<Activity className="w-4 h-4" />} title="Business Summary" />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <MetricTile label="Revenue" value={formatCurrency(summary?.revenue || 0)} trend="up" color="emerald" />
          <MetricTile label="Expenses" value={formatCurrency(summary?.expenses || 0)} trend="down" color="red" />
          <MetricTile label="Profit" value={formatCurrency(summary?.profit || 0)} trend={summary && summary.profit >= 0 ? 'up' : 'down'} color={summary && summary.profit >= 0 ? 'indigo' : 'red'} />
          <MetricTile label="Loss" value={formatCurrency(summary?.loss || 0)} trend="down" color="orange" />
          <MetricTile label="Profit Margin" value={formatPercent(summary?.profitMargin || 0)} trend={summary && summary.profitMargin >= 20 ? 'up' : 'down'} color={summary && summary.profitMargin >= 20 ? 'teal' : 'amber'} />
        </div>
      </section>

      {/* ── SECTION 2: Health Score ── */}
      <section>
        <SectionLabel icon={<Sparkles className="w-4 h-4" />} title="Business Health Score" />
        <div className="bg-[#1A1D27] border border-white/5 rounded-2xl p-6">
          <div className="flex flex-col lg:flex-row items-center gap-8">
            {/* Score ring */}
            <div className="flex-shrink-0 flex flex-col items-center gap-2">
              <div className={`w-32 h-32 rounded-full ring-4 ${hc.ring} flex flex-col items-center justify-center bg-[#0F1117]`}>
                <span className={`text-4xl font-black font-mono ${hc.text}`}>{health?.score}</span>
                <span className="text-xs text-slate-500">/ 100</span>
              </div>
              <span className={`text-sm font-bold ${hc.text}`}>{health?.status}</span>
            </div>
            {/* Breakdown bars */}
            <div className="flex-1 w-full space-y-3">
              {health?.breakdown.map(b => (
                <div key={b.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">{b.label}</span>
                    <span className="text-white font-medium">{b.score}/{b.max}</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${hc.bg}`} style={{ width: `${(b.score / b.max) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 3: Profit Trend ── */}
      <section>
        <SectionLabel icon={<TrendingUp className="w-4 h-4" />} title="Profit Trend" />
        <div className="bg-[#1A1D27] border border-white/5 rounded-2xl p-6">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={trend} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#14B8A6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#14B8A6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="month" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: '#1A1D27', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10 }} formatter={(v) => [formatCurrency(v as number), '']} />
              <Area type="monotone" dataKey="revenue" stroke="#6366F1" strokeWidth={2} fill="url(#gRevenue)" name="Revenue" />
              <Area type="monotone" dataKey="profit" stroke="#14B8A6" strokeWidth={2} fill="url(#gProfit)" name="Profit" />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex gap-6 mt-3 justify-center">
            <div className="flex items-center gap-2 text-xs text-slate-400"><span className="w-3 h-0.5 bg-indigo-500 inline-block" />Revenue</div>
            <div className="flex items-center gap-2 text-xs text-slate-400"><span className="w-3 h-0.5 bg-teal-500 inline-block" />Profit</div>
          </div>
        </div>
      </section>

      {/* ── SECTION 4 & 5: Insights + Suggestions side by side ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AI Insights */}
        <section>
          <SectionLabel icon={<Brain className="w-4 h-4" />} title="AI Insights" />
          <div className="space-y-2">
            {insights.map((ins, i) => (
              <div key={i} className={`flex items-start gap-3 p-4 rounded-xl border ${insightBg(ins.type)}`}>
                <span className="text-lg flex-shrink-0">{ins.icon}</span>
                <p className="text-xs leading-relaxed">{ins.text}</p>
              </div>
            ))}
            {insights.length === 0 && <EmptyState text="No insights yet — add more business data." />}
          </div>
        </section>

        {/* AI Suggestions */}
        <section>
          <SectionLabel icon={<Lightbulb className="w-4 h-4" />} title="AI Suggestions" />
          <div className="space-y-2">
            {suggestions.map((s, i) => (
              <div key={i} className="flex items-start gap-3 p-4 rounded-xl border border-white/5 bg-[#1A1D27]">
                <ChevronRight className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${priorityBadge(s.priority)}`}>{s.priority}</span>
                    <span className="text-[10px] text-slate-500 bg-white/5 px-2 py-0.5 rounded-full">{s.category}</span>
                  </div>
                  <p className="text-xs font-medium text-white">{s.action}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{s.reason}</p>
                </div>
              </div>
            ))}
            {suggestions.length === 0 && <EmptyState text="No suggestions yet." />}
          </div>
        </section>
      </div>

      {/* ── SECTION 7: AI Chat ── */}
      <section>
        <SectionLabel icon={<Bot className="w-4 h-4" />} title="Ask AI About Your Business" />
        <div className="bg-[#1A1D27] border border-white/5 rounded-2xl overflow-hidden">
          {/* Quick questions */}
          <div className="px-4 pt-4 flex flex-wrap gap-2">
            {QUICK_QUESTIONS.map(q => (
              <button key={q} onClick={() => handleChat(q)}
                className="text-xs px-3 py-1.5 rounded-full bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-600/20 transition-colors">
                {q}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div className="h-72 overflow-y-auto p-4 space-y-3">
            {chatMessages.map((m, i) => (
              <div key={i} className={`flex items-start gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${m.role === 'ai' ? 'bg-indigo-600/20' : 'bg-white/10'}`}>
                  {m.role === 'ai' ? <Bot className="w-3.5 h-3.5 text-indigo-400" /> : <User className="w-3.5 h-3.5 text-slate-400" />}
                </div>
                <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-xs leading-relaxed ${m.role === 'ai' ? 'bg-white/5 text-slate-300 rounded-tl-sm' : 'bg-indigo-600/20 text-indigo-200 rounded-tr-sm'}`}>
                  {m.text}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-indigo-600/20 flex items-center justify-center">
                  <Bot className="w-3.5 h-3.5 text-indigo-400" />
                </div>
                <div className="bg-white/5 px-4 py-2.5 rounded-2xl rounded-tl-sm">
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => <span key={i} className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-white/5 p-3 flex gap-2">
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleChat()}
              placeholder="Ask about profit, expenses, inventory…"
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50"
            />
            <button onClick={() => handleChat()} disabled={!chatInput.trim() || chatLoading}
              className="w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 flex items-center justify-center transition-colors">
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

function SectionLabel({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="text-indigo-400">{icon}</div>
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      <div className="flex-1 h-px bg-white/5" />
    </div>
  )
}

function MetricTile({ label, value, trend, color }: { label: string; value: string; trend: 'up' | 'down'; color: string }) {
  const colors: Record<string, string> = {
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    red: 'text-red-400 bg-red-500/10 border-red-500/20',
    indigo: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    orange: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    teal: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  }
  return (
    <div className={`rounded-xl border p-4 ${colors[color] || colors.indigo}`}>
      <p className="text-[10px] opacity-70 mb-2">{label}</p>
      <p className="text-lg font-bold font-mono">{value}</p>
      <div className="mt-1 opacity-60">
        {trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      </div>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-xs text-slate-500 text-center py-8 bg-[#1A1D27] rounded-xl border border-white/5">{text}</p>
}
