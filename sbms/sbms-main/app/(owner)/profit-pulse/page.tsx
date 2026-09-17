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
    // Capture current history before appending the new user message
    const historySnapshot = [...chatMessages]
    setChatMessages(prev => [...prev, { role: 'user', text: q }])
    setChatLoading(true)

    try {
      const data = await apiFetch<{ answer: string }>('/api/profit-pulse/chat', {
        method: 'POST',
        body: JSON.stringify({
          question: q,
          history: historySnapshot.slice(-6), // send last 6 messages for context
        })
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
        deadStock: { name: string; sku: string; stockQuantity: number; value: number }[]
        lowStock: { name: string; stockQuantity: number; reorderThreshold: number }[]
        topProducts: { name: string; revenue: number; quantity: number; margin: number }[]
      }>('/api/profit-pulse/report')

      const { jsPDF } = await import('jspdf')

      // ── Colour palette (professional, restrained) ──────────────────────────
      const C = {
        navy:      [15,  23,  42]  as [number,number,number], // #0F172A  page backgrounds / fills
        ink:       [30,  41,  59]  as [number,number,number], // #1E293B  dark text
        slate:     [71,  85, 105]  as [number,number,number], // #475569  secondary text
        muted:     [148,163,184]   as [number,number,number], // #94A3B8  captions
        rule:      [226,232,240]   as [number,number,number], // #E2E8F0  dividers / borders
        accent:    [79,  70, 229]  as [number,number,number], // #4F46E5  indigo accent
        accentLt:  [238,242,255]   as [number,number,number], // #EEF2FF  accent tint
        emerald:   [16, 185, 129]  as [number,number,number], // #10B981
        emeraldLt: [236,253,245]   as [number,number,number], // #ECFDF5
        red:       [239, 68,  68]  as [number,number,number], // #EF4444
        redLt:     [254,242,242]   as [number,number,number], // #FEF2F2
        amber:     [245,158, 11]   as [number,number,number], // #F59E0B
        amberLt:   [255,251,235]   as [number,number,number], // #FFFBEB
        white:     [255,255,255]   as [number,number,number],
        black:     [0,    0,   0]  as [number,number,number],
      }

      // ── jsPDF A4 document ──────────────────────────────────────────────────
      const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
      const PW = 210; const PH = 297  // A4 dimensions mm
      const ML = 14; const MR = 14    // left / right margins
      const CW = PW - ML - MR         // usable column width = 182 mm
      const generatedOn = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })

      // ── Currency helper: avoids ₹ glyph issue in jsPDF built-in fonts ──────
      // jsPDF Helvetica/Courier do not carry the ₹ codepoint; we use "Rs." safely.
      const fmtINR = (n: number): string => {
        const abs = Math.abs(Math.round(n))
        const s = abs.toLocaleString('en-IN')
        return (n < 0 ? '-' : '') + 'Rs. ' + s
      }

      // ── Page state ──────────────────────────────────────────────────────────
      let pageNum  = 1
      let totalPagesPlaceholder = '##'  // we'll patch after last page
      let y = 0

      // ── Helpers ─────────────────────────────────────────────────────────────

      // Draw the slim running header (pages > 1)
      const drawRunningHeader = () => {
        doc.setFillColor(...C.accent)
        doc.rect(0, 0, PW, 8, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7)
        doc.setTextColor(...C.white)
        doc.text('SMART BUSINESS MANAGEMENT SYSTEM', ML, 5.5)
        doc.setFont('helvetica', 'normal')
        doc.text('Monthly Business Performance Report', PW - MR, 5.5, { align: 'right' })
        doc.setTextColor(...C.ink)
      }

      // Draw the footer on current page
      const drawFooter = (pg: number) => {
        const fy = PH - 8
        doc.setDrawColor(...C.rule)
        doc.setLineWidth(0.3)
        doc.line(ML, fy - 1, PW - MR, fy - 1)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.setTextColor(...C.muted)
        doc.text('Smart Business Management System  |  Profit Pulse AI', ML, fy + 3)
        doc.text(`Generated: ${generatedOn}`, PW / 2, fy + 3, { align: 'center' })
        // Page number placeholder — we use pageNum directly
        doc.text(`Page ${pg} of ${totalPagesPlaceholder}`, PW - MR, fy + 3, { align: 'right' })
      }

      // Add a new page and reset y, draw header + footer skeleton
      const addPage = () => {
        drawFooter(pageNum)    // finish current page footer
        doc.addPage()
        pageNum++
        drawRunningHeader()
        y = 16
      }

      // Guard: if remaining space on page is less than `need` mm, add page
      const ensureSpace = (need: number) => {
        if (y + need > PH - 18) addPage()
      }

      // Draw a section heading bar
      const sectionHead = (title: string) => {
        ensureSpace(12)
        doc.setFillColor(...C.accentLt)
        doc.roundedRect(ML, y, CW, 8, 1.5, 1.5, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(...C.accent)
        doc.text(title, ML + 4, y + 5.4)
        doc.setTextColor(...C.ink)
        y += 11
      }

      // Horizontal rule — used for optional visual separators
      const hrule = (margin = 0) => {
        doc.setDrawColor(...C.rule)
        doc.setLineWidth(0.25)
        doc.line(ML + margin, y, PW - MR - margin, y)
        y += 3
      }
      void hrule // referenced to prevent unused-variable lint warning

      // Text block (auto-wrap, auto page-break) — used for multi-line prose
      const textBlock = (
        text: string,
        size = 9,
        style: 'normal' | 'bold' = 'normal',
        color: [number,number,number] = C.ink,
        x = ML,
        maxW = CW,
        indent = 0
      ) => {
        doc.setFont('helvetica', style)
        doc.setFontSize(size)
        doc.setTextColor(...color)
        const lines = doc.splitTextToSize(text, maxW - indent)
        lines.forEach((ln: string) => {
          ensureSpace(size * 0.4 + 2)
          doc.text(ln, x + indent, y)
          y += size * 0.4 + 1.8
        })
      }
      void textBlock // referenced to prevent unused-variable lint warning

      // ═══════════════════════════════════════════════════════════════════════
      // PAGE 1 — COVER
      // ═══════════════════════════════════════════════════════════════════════

      // Full-width cover banner
      doc.setFillColor(...C.navy)
      doc.rect(0, 0, PW, 60, 'F')

      // Accent stripe at very top
      doc.setFillColor(...C.accent)
      doc.rect(0, 0, PW, 3, 'F')

      // Organization name
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(148, 163, 184)   // muted slate on dark bg
      doc.text('SMART BUSINESS MANAGEMENT SYSTEM', PW / 2, 20, { align: 'center' })

      // Report title
      doc.setFontSize(18)
      doc.setTextColor(...C.white)
      doc.text('MONTHLY BUSINESS', PW / 2, 32, { align: 'center' })
      doc.text('PERFORMANCE REPORT', PW / 2, 42, { align: 'center' })

      // Accent underline
      doc.setDrawColor(...C.accent)
      doc.setLineWidth(1)
      doc.line(PW / 2 - 30, 46, PW / 2 + 30, 46)

      y = 68

      // Period + generated-on block
      doc.setFillColor(...C.rule)
      doc.roundedRect(ML, y, CW, 16, 2, 2, 'F')
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(...C.slate)
      doc.text('REPORTING PERIOD', ML + 6, y + 5.5)
      doc.text('GENERATED ON', ML + CW / 2 + 6, y + 5.5)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(...C.ink)
      doc.text(report.month, ML + 6, y + 12)
      doc.text(generatedOn, ML + CW / 2 + 6, y + 12)
      // vertical divider
      doc.setDrawColor(...C.muted)
      doc.setLineWidth(0.3)
      doc.line(ML + CW / 2, y + 2, ML + CW / 2, y + 14)
      y += 22

      // ── KPI CARDS ──────────────────────────────────────────────────────────
      sectionHead('KEY PERFORMANCE INDICATORS')

      type KPI = { label: string; value: string; sub?: string; fillRGB: [number,number,number]; textRGB: [number,number,number] }
      const kpis: KPI[] = [
        { label: 'REVENUE',       value: fmtINR(report.summary.revenue),    sub: 'Total Income',        fillRGB: C.emeraldLt, textRGB: C.emerald },
        { label: 'EXPENSES',      value: fmtINR(report.summary.expenses),   sub: 'Total Costs',         fillRGB: C.redLt,     textRGB: C.red     },
        { label: 'NET PROFIT',    value: fmtINR(report.summary.profit),     sub: report.summary.profitMargin + '% margin', fillRGB: C.accentLt, textRGB: C.accent  },
        { label: 'PROFIT MARGIN', value: report.summary.profitMargin + '%', sub: 'Of Revenue',          fillRGB: C.amberLt,   textRGB: C.amber   },
      ]

      const kpiW = (CW - 9) / 4
      const kpiH = 22
      kpis.forEach((k, i) => {
        const kx = ML + i * (kpiW + 3)
        doc.setFillColor(...k.fillRGB)
        doc.roundedRect(kx, y, kpiW, kpiH, 2, 2, 'F')
        doc.setDrawColor(...k.textRGB)
        doc.setLineWidth(0.5)
        doc.line(kx, y, kx + kpiW, y)   // top accent line
        doc.setFontSize(7)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...C.slate)
        doc.text(k.label, kx + kpiW / 2, y + 5, { align: 'center' })
        doc.setFontSize(10)
        doc.setTextColor(...k.textRGB)
        doc.text(k.value, kx + kpiW / 2, y + 13, { align: 'center' })
        if (k.sub) {
          doc.setFontSize(7)
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(...C.slate)
          doc.text(k.sub, kx + kpiW / 2, y + 19, { align: 'center' })
        }
      })
      y += kpiH + 6

      // Second row of KPIs: Loss, Damaged Stock, Dead Stock Value, Low Stock Items
      const kpis2: KPI[] = [
        { label: 'TOTAL LOSS',      value: fmtINR(report.summary.loss),             sub: 'Damaged + Dead',   fillRGB: [254,242,242], textRGB: C.red    },
        { label: 'DAMAGED STOCK',   value: fmtINR(report.summary.damagedStockValue), sub: 'Inventory Loss',   fillRGB: C.amberLt,    textRGB: C.amber  },
        { label: 'DEAD STOCK',      value: fmtINR(report.summary.deadStockValue),   sub: '90+ days unsold',  fillRGB: C.amberLt,    textRGB: C.amber  },
        { label: 'LOW STOCK ITEMS', value: String(report.summary.lowStockCount),    sub: 'Below Threshold',  fillRGB: C.accentLt,   textRGB: C.accent },
      ]
      kpis2.forEach((k, i) => {
        const kx = ML + i * (kpiW + 3)
        doc.setFillColor(...k.fillRGB)
        doc.roundedRect(kx, y, kpiW, kpiH, 2, 2, 'F')
        doc.setDrawColor(...k.textRGB)
        doc.setLineWidth(0.5)
        doc.line(kx, y, kx + kpiW, y)
        doc.setFontSize(7)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...C.slate)
        doc.text(k.label, kx + kpiW / 2, y + 5, { align: 'center' })
        doc.setFontSize(10)
        doc.setTextColor(...k.textRGB)
        doc.text(k.value, kx + kpiW / 2, y + 13, { align: 'center' })
        if (k.sub) {
          doc.setFontSize(7)
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(...C.slate)
          doc.text(k.sub, kx + kpiW / 2, y + 19, { align: 'center' })
        }
      })
      y += kpiH + 8

      drawFooter(pageNum)

      // ═══════════════════════════════════════════════════════════════════════
      // PAGE 2 — FINANCIAL SUMMARY + HEALTH SCORE
      // ═══════════════════════════════════════════════════════════════════════
      doc.addPage(); pageNum++
      drawRunningHeader()
      y = 16

      // ── FINANCIAL SUMMARY TABLE ────────────────────────────────────────────
      sectionHead('FINANCIAL SUMMARY')

      const fRows: [string, string, string][] = [
        ['Metric',         'Value',                              'Notes'],
        ['Total Revenue',  fmtINR(report.summary.revenue),      'All sales income'],
        ['Total Expenses', fmtINR(report.summary.expenses),     'Operating costs'],
        ['Net Profit',     fmtINR(report.summary.profit),       'Revenue - Expenses - Damaged'],
        ['Total Loss',     fmtINR(report.summary.loss),         'Damaged + Dead stock'],
        ['Profit Margin',  report.summary.profitMargin + '%',   'Profit / Revenue'],
        ['Damaged Stock',  fmtINR(report.summary.damagedStockValue), 'Inventory loss'],
        ['Dead Stock',     fmtINR(report.summary.deadStockValue),    '90+ days unsold'],
        ['Low Stock Items',String(report.summary.lowStockCount),     'Below reorder threshold'],
      ]

      const col1 = ML
      const col2 = ML + 72
      const col3 = ML + 130
      const rowH = 7

      fRows.forEach((row, ri) => {
        ensureSpace(rowH + 1)
        const isHeader = ri === 0
        if (isHeader) {
          doc.setFillColor(...C.navy)
          doc.rect(ML, y, CW, rowH, 'F')
          doc.setTextColor(...C.white)
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(8)
        } else {
          doc.setFillColor(ri % 2 === 0 ? 248 : 255, ri % 2 === 0 ? 250 : 255, ri % 2 === 0 ? 252 : 255)
          doc.rect(ML, y, CW, rowH, 'F')
          doc.setTextColor(...C.ink)
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(8.5)
        }
        doc.text(row[0], col1 + 3, y + 4.8)
        doc.text(row[1], col2, y + 4.8)
        doc.text(row[2], col3, y + 4.8)
        // bottom border
        doc.setDrawColor(...C.rule)
        doc.setLineWidth(0.2)
        doc.line(ML, y + rowH, ML + CW, y + rowH)
        y += rowH
      })
      // outer border
      doc.setDrawColor(...C.slate)
      doc.setLineWidth(0.3)
      doc.rect(ML, y - fRows.length * rowH, CW, fRows.length * rowH)
      y += 8

      // ── BUSINESS HEALTH SCORE ──────────────────────────────────────────────
      ensureSpace(60)
      sectionHead('BUSINESS HEALTH SCORE')

      // Score badge (large circle-like box on left)
      const healthX = ML
      const healthY = y
      const scoreColor: [number,number,number] =
        report.health.status === 'Excellent' ? C.emerald :
        report.health.status === 'Good'      ? [20, 184, 166] :
        report.health.status === 'Average'   ? C.amber :
        report.health.status === 'Poor'      ? [249, 115, 22] :
        C.red

      doc.setFillColor(...scoreColor)
      doc.roundedRect(healthX, healthY, 36, 36, 4, 4, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(22)
      doc.setTextColor(...C.white)
      doc.text(String(report.health.score), healthX + 18, healthY + 17, { align: 'center' })
      doc.setFontSize(8)
      doc.text('/ 100', healthX + 18, healthY + 24, { align: 'center' })
      doc.setFontSize(9)
      doc.text(report.health.status.toUpperCase(), healthX + 18, healthY + 32, { align: 'center' })

      // Breakdown bars
      const bx = healthX + 42
      const bw = CW - 42
      report.health.breakdown.forEach((b, bi) => {
        const by = healthY + bi * 9
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(...C.ink)
        doc.text(b.label, bx, by + 5.5)
        // score number right
        doc.setFont('helvetica', 'bold')
        doc.text(`${b.score}/${b.max}`, bx + bw, by + 5.5, { align: 'right' })
        // bar background
        const barX = bx + 42
        const barW = bw - 50
        const barH = 3.5
        const barY = by + 2.5
        doc.setFillColor(...C.rule)
        doc.roundedRect(barX, barY, barW, barH, 1, 1, 'F')
        // bar fill
        doc.setFillColor(...scoreColor)
        const fillW = Math.max(1, (b.score / b.max) * barW)
        doc.roundedRect(barX, barY, fillW, barH, 1, 1, 'F')
      })
      y = healthY + Math.max(38, report.health.breakdown.length * 9) + 8

      drawFooter(pageNum)

      // ═══════════════════════════════════════════════════════════════════════
      // PAGE 3 — 6-MONTH TREND + TOP PRODUCTS
      // ═══════════════════════════════════════════════════════════════════════
      doc.addPage(); pageNum++
      drawRunningHeader()
      y = 16

      // ── 6-MONTH TREND: mini bar chart ─────────────────────────────────────
      sectionHead('6-MONTH PERFORMANCE TREND')

      if (report.trend.length > 0) {
        const chartLeft = ML
        const chartTop  = y
        const chartW    = CW
        const chartH    = 52
        const barGroupW = chartW / report.trend.length
        const maxVal    = Math.max(...report.trend.map(m => Math.max(m.revenue, m.expenses, Math.max(0, m.profit))), 1)
        const chartBottom = chartTop + chartH

        // Axes
        doc.setDrawColor(...C.rule)
        doc.setLineWidth(0.3)
        doc.line(chartLeft, chartTop, chartLeft, chartBottom)
        doc.line(chartLeft, chartBottom, chartLeft + chartW, chartBottom)

        // Y-axis labels (3 steps)
        for (let step = 0; step <= 2; step++) {
          const val = Math.round((maxVal / 2) * step)
          const ly = chartBottom - (val / maxVal) * chartH
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(6)
          doc.setTextColor(...C.muted)
          doc.text(fmtINR(val).replace('Rs. ', ''), chartLeft - 1, ly + 1.5, { align: 'right' })
          doc.setDrawColor(...C.rule)
          doc.setLineWidth(0.15)
          doc.line(chartLeft, ly, chartLeft + chartW, ly)
        }

        const barColors: [number,number,number][] = [C.accent, C.red, C.emerald]
        const barLabels = ['Revenue', 'Expenses', 'Profit']
        const barWUnit = (barGroupW * 0.7) / 3
        const barGap = barWUnit * 0.2

        report.trend.forEach((m, mi) => {
          const groupX = chartLeft + mi * barGroupW + barGroupW * 0.15
          const vals = [m.revenue, m.expenses, m.profit]
          vals.forEach((v, vi) => {
            const bx2 = groupX + vi * (barWUnit + barGap)
            const bh = Math.max(0, (v / maxVal) * chartH)
            const by2 = chartBottom - bh
            doc.setFillColor(...barColors[vi])
            if (bh > 0) doc.rect(bx2, by2, barWUnit, bh, 'F')
          })
          // X label
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(6.5)
          doc.setTextColor(...C.slate)
          doc.text(m.month, chartLeft + mi * barGroupW + barGroupW / 2, chartBottom + 4, { align: 'center' })
        })

        // Legend
        y = chartBottom + 8
        barLabels.forEach((lbl, li) => {
          const lx = ML + li * 30
          doc.setFillColor(...barColors[li])
          doc.rect(lx, y, 6, 3, 'F')
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(7)
          doc.setTextColor(...C.slate)
          doc.text(lbl, lx + 8, y + 2.8)
        })
        y += 8

        // Trend data table
        sectionHead('TREND DATA TABLE')
        const tHead: [string,string,string,string] = ['Month', 'Revenue', 'Expenses', 'Profit']
        const tRows = report.trend.map(m => [m.month, fmtINR(m.revenue), fmtINR(m.expenses), fmtINR(m.profit)] as [string,string,string,string])
        const tCols = [ML + 3, ML + 50, ML + 100, ML + 148]
        const tRowH = 6.5

        ;[tHead, ...tRows].forEach((row, ri) => {
          ensureSpace(tRowH + 1)
          const isH = ri === 0
          if (isH) {
            doc.setFillColor(...C.navy)
            doc.rect(ML, y, CW, tRowH, 'F')
            doc.setTextColor(...C.white)
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(8)
          } else {
            doc.setFillColor(ri % 2 === 0 ? 248 : 255, ri % 2 === 0 ? 250 : 255, ri % 2 === 0 ? 252 : 255)
            doc.rect(ML, y, CW, tRowH, 'F')
            doc.setTextColor(...C.ink)
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(8)
          }
          doc.text(row[0], tCols[0], y + 4.3)
          doc.text(row[1], tCols[1], y + 4.3)
          doc.text(row[2], tCols[2], y + 4.3)
          doc.text(row[3], tCols[3], y + 4.3)
          doc.setDrawColor(...C.rule)
          doc.setLineWidth(0.2)
          doc.line(ML, y + tRowH, ML + CW, y + tRowH)
          y += tRowH
        })
        doc.setDrawColor(...C.slate)
        doc.setLineWidth(0.3)
        doc.rect(ML, y - (tRows.length + 1) * tRowH, CW, (tRows.length + 1) * tRowH)
        y += 8
      }

      // ── TOP SELLING PRODUCTS ───────────────────────────────────────────────
      if (report.topProducts && report.topProducts.length > 0) {
        ensureSpace(12)
        sectionHead('TOP SELLING PRODUCTS')

        const pHead: [string,string,string,string] = ['Product Name', 'Revenue', 'Qty Sold', 'Margin']
        const pRows = report.topProducts.map(p => [
          p.name.length > 30 ? p.name.slice(0, 28) + '...' : p.name,
          fmtINR(p.revenue),
          String(p.quantity),
          fmtINR(p.margin),
        ] as [string,string,string,string])
        const pCols = [ML + 3, ML + 80, ML + 128, ML + 155]
        const pRowH = 6.5

        ;[pHead, ...pRows].forEach((row, ri) => {
          ensureSpace(pRowH + 1)
          const isH = ri === 0
          if (isH) {
            doc.setFillColor(...C.navy)
            doc.rect(ML, y, CW, pRowH, 'F')
            doc.setTextColor(...C.white)
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(8)
          } else {
            doc.setFillColor(ri % 2 === 0 ? 248 : 255, ri % 2 === 0 ? 250 : 255, ri % 2 === 0 ? 252 : 255)
            doc.rect(ML, y, CW, pRowH, 'F')
            doc.setTextColor(...C.ink)
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(8)
          }
          doc.text(row[0], pCols[0], y + 4.3)
          doc.text(row[1], pCols[1], y + 4.3)
          doc.text(row[2], pCols[2], y + 4.3)
          doc.text(row[3], pCols[3], y + 4.3)
          doc.setDrawColor(...C.rule)
          doc.setLineWidth(0.2)
          doc.line(ML, y + pRowH, ML + CW, y + pRowH)
          y += pRowH
        })
        doc.setDrawColor(...C.slate)
        doc.setLineWidth(0.3)
        doc.rect(ML, y - (pRows.length + 1) * pRowH, CW, (pRows.length + 1) * pRowH)
        y += 8
      }

      drawFooter(pageNum)

      // ═══════════════════════════════════════════════════════════════════════
      // PAGE 4 — INVENTORY HEALTH
      // ═══════════════════════════════════════════════════════════════════════
      doc.addPage(); pageNum++
      drawRunningHeader()
      y = 16

      sectionHead('INVENTORY HEALTH')

      // Inventory KPI row
      const invKPIs = [
        { label: 'DEAD STOCK VALUE',  value: fmtINR(report.summary.deadStockValue),    sub: report.deadStock?.length ? `${report.deadStock.length} products` : '0 products', fillRGB: C.amberLt, textRGB: C.amber },
        { label: 'DAMAGED STOCK',     value: fmtINR(report.summary.damagedStockValue), sub: 'Inventory loss',   fillRGB: C.redLt,     textRGB: C.red   },
        { label: 'LOW STOCK ITEMS',   value: String(report.summary.lowStockCount),     sub: 'Below threshold',  fillRGB: C.accentLt,  textRGB: C.accent},
      ]
      const invW = (CW - 6) / 3
      invKPIs.forEach((k, i) => {
        const kx = ML + i * (invW + 3)
        doc.setFillColor(...k.fillRGB)
        doc.roundedRect(kx, y, invW, 20, 2, 2, 'F')
        doc.setDrawColor(...k.textRGB)
        doc.setLineWidth(0.5)
        doc.line(kx, y, kx + invW, y)
        doc.setFontSize(7)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...C.slate)
        doc.text(k.label, kx + invW / 2, y + 5, { align: 'center' })
        doc.setFontSize(10)
        doc.setTextColor(...k.textRGB)
        doc.text(k.value, kx + invW / 2, y + 12.5, { align: 'center' })
        doc.setFontSize(7)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...C.slate)
        doc.text(k.sub, kx + invW / 2, y + 18, { align: 'center' })
      })
      y += 26

      // Dead Stock table
      if (report.deadStock && report.deadStock.length > 0) {
        ensureSpace(12)
        sectionHead('DEAD STOCK  (No Sales in 90+ Days)')

        const dHead: [string,string,string,string] = ['Product Name', 'SKU', 'Stock Qty', 'Est. Value']
        const dRows = report.deadStock.slice(0, 15).map(d => [
          d.name.length > 28 ? d.name.slice(0, 26) + '...' : d.name,
          d.sku || '—',
          String(d.stockQuantity),
          fmtINR(d.value),
        ] as [string,string,string,string])
        const dCols = [ML + 3, ML + 80, ML + 128, ML + 155]
        const dRowH = 6.5

        ;[dHead, ...dRows].forEach((row, ri) => {
          ensureSpace(dRowH + 1)
          const isH = ri === 0
          if (isH) {
            doc.setFillColor(...C.navy)
            doc.rect(ML, y, CW, dRowH, 'F')
            doc.setTextColor(...C.white)
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(8)
          } else {
            doc.setFillColor(ri % 2 === 0 ? 248 : 255, ri % 2 === 0 ? 250 : 255, ri % 2 === 0 ? 252 : 255)
            doc.rect(ML, y, CW, dRowH, 'F')
            doc.setTextColor(...C.ink)
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(8)
          }
          doc.text(row[0], dCols[0], y + 4.3)
          doc.text(row[1], dCols[1], y + 4.3)
          doc.text(row[2], dCols[2], y + 4.3)
          doc.text(row[3], dCols[3], y + 4.3)
          doc.setDrawColor(...C.rule)
          doc.setLineWidth(0.2)
          doc.line(ML, y + dRowH, ML + CW, y + dRowH)
          y += dRowH
        })
        doc.setDrawColor(...C.slate)
        doc.setLineWidth(0.3)
        doc.rect(ML, y - (dRows.length + 1) * dRowH, CW, (dRows.length + 1) * dRowH)
        y += 8
      } else {
        doc.setFillColor(...C.emeraldLt)
        doc.roundedRect(ML, y, CW, 10, 2, 2, 'F')
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8.5)
        doc.setTextColor(...C.emerald)
        doc.text('No dead stock detected. All products have recorded sales in the last 90 days.', ML + 4, y + 6.5)
        y += 16
      }

      // Low Stock table
      if (report.lowStock && report.lowStock.length > 0) {
        ensureSpace(12)
        sectionHead('LOW STOCK ITEMS  (Below Reorder Threshold)')

        const lHead: [string,string,string] = ['Product Name', 'Current Stock', 'Reorder At']
        const lRows = report.lowStock.slice(0, 15).map(l => [
          l.name.length > 40 ? l.name.slice(0, 38) + '...' : l.name,
          l.stockQuantity === 0 ? 'OUT OF STOCK' : String(l.stockQuantity),
          String(l.reorderThreshold),
        ] as [string,string,string])
        const lCols = [ML + 3, ML + 110, ML + 155]
        const lRowH = 6.5

        ;[lHead, ...lRows].forEach((row, ri) => {
          ensureSpace(lRowH + 1)
          const isH = ri === 0
          if (isH) {
            doc.setFillColor(...C.navy)
            doc.rect(ML, y, CW, lRowH, 'F')
            doc.setTextColor(...C.white)
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(8)
          } else {
            doc.setFillColor(ri % 2 === 0 ? 248 : 255, ri % 2 === 0 ? 250 : 255, ri % 2 === 0 ? 252 : 255)
            doc.rect(ML, y, CW, lRowH, 'F')
            // Out of stock rows: tint red
            if (lRows[ri - 1]?.[1] === 'OUT OF STOCK') {
              doc.setFillColor(...C.redLt)
              doc.rect(ML, y, CW, lRowH, 'F')
            }
            doc.setTextColor(...C.ink)
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(8)
            if (row[1] === 'OUT OF STOCK') doc.setTextColor(...C.red)
          }
          doc.text(row[0], lCols[0], y + 4.3)
          doc.text(row[1], lCols[1], y + 4.3)
          doc.text(row[2], lCols[2], y + 4.3)
          doc.setDrawColor(...C.rule)
          doc.setLineWidth(0.2)
          doc.line(ML, y + lRowH, ML + CW, y + lRowH)
          y += lRowH
        })
        doc.setDrawColor(...C.slate)
        doc.setLineWidth(0.3)
        doc.rect(ML, y - (lRows.length + 1) * lRowH, CW, (lRows.length + 1) * lRowH)
        y += 8
      }

      drawFooter(pageNum)

      // ═══════════════════════════════════════════════════════════════════════
      // PAGE 5 — AI INSIGHTS + AI RECOMMENDATIONS
      // ═══════════════════════════════════════════════════════════════════════
      doc.addPage(); pageNum++
      drawRunningHeader()
      y = 16

      // ── AI INSIGHTS ────────────────────────────────────────────────────────
      sectionHead('AI BUSINESS INSIGHTS')

      if (report.insights && report.insights.length > 0) {
        report.insights.forEach(ins => {
          ensureSpace(18)
          const insightTypeColor: [number,number,number] =
            ins.type === 'positive' ? C.emerald :
            ins.type === 'negative' ? C.red :
            ins.type === 'alert'    ? C.amber :
            C.slate
          const insightBgColor: [number,number,number] =
            ins.type === 'positive' ? C.emeraldLt :
            ins.type === 'negative' ? C.redLt :
            ins.type === 'alert'    ? C.amberLt :
            [248, 250, 252] as [number,number,number]

          // Card background
          const wrappedLines = doc.splitTextToSize(ins.text, CW - 16)
          const cardH = 8 + wrappedLines.length * 4.5
          ensureSpace(cardH + 2)

          doc.setFillColor(...insightBgColor)
          doc.roundedRect(ML, y, CW, cardH, 2, 2, 'F')
          doc.setDrawColor(...insightTypeColor)
          doc.setLineWidth(0.8)
          doc.line(ML, y, ML, y + cardH)  // left accent bar

          // Type badge
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(6.5)
          doc.setTextColor(...insightTypeColor)
          doc.text(ins.type.toUpperCase(), ML + 5, y + 5)

          // Insight text (strip emoji for PDF font safety)
          const cleanText = ins.text.replace(/[\u{1F000}-\u{1FFFF}]/gu, '').replace(/[^\x00-\x7F]/g, '').trim()
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(8.5)
          doc.setTextColor(...C.ink)
          const textLines = doc.splitTextToSize(cleanText || ins.text, CW - 16)
          textLines.forEach((ln: string, li: number) => {
            doc.text(ln, ML + 5, y + 5 + 4.5 + li * 4.5)
          })
          y += cardH + 3
        })
      } else {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8.5)
        doc.setTextColor(...C.muted)
        doc.text('No AI insights available. Add more business data to generate insights.', ML, y + 6)
        y += 14
      }

      y += 4
      ensureSpace(12)

      // ── AI RECOMMENDATIONS ─────────────────────────────────────────────────
      sectionHead('AI RECOMMENDATIONS')

      if (report.suggestions && report.suggestions.length > 0) {
        // Group by priority
        const priorities: Array<'high' | 'medium' | 'low'> = ['high', 'medium', 'low']
        const priorityLabel: Record<string, string> = { high: 'HIGH PRIORITY', medium: 'MEDIUM PRIORITY', low: 'LOW PRIORITY' }
        const priorityFill: Record<string, [number,number,number]> = { high: C.redLt, medium: C.amberLt, low: C.accentLt }
        const priorityText: Record<string, [number,number,number]> = { high: C.red, medium: C.amber, low: C.accent }

        priorities.forEach(pri => {
          const group = report.suggestions.filter(s => s.priority === pri)
          if (group.length === 0) return

          ensureSpace(10)
          // Priority sub-header
          doc.setFillColor(...priorityFill[pri])
          doc.roundedRect(ML, y, CW, 7, 1.5, 1.5, 'F')
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(8)
          doc.setTextColor(...priorityText[pri])
          doc.text(priorityLabel[pri], ML + 4, y + 4.8)
          y += 10

          group.forEach(sg => {
            const actionLines = doc.splitTextToSize(sg.action, CW - 8)
            const reasonLines = doc.splitTextToSize(sg.reason, CW - 12)
            const cardH = 6 + actionLines.length * 4.5 + reasonLines.length * 4 + 3
            ensureSpace(cardH + 2)

            doc.setFillColor(250, 251, 252)
            doc.roundedRect(ML, y, CW, cardH, 1.5, 1.5, 'F')
            doc.setDrawColor(...priorityText[pri])
            doc.setLineWidth(0.5)
            doc.line(ML, y, ML, y + cardH)

            doc.setFont('helvetica', 'bold')
            doc.setFontSize(8.5)
            doc.setTextColor(...C.ink)
            actionLines.forEach((ln: string, li: number) => {
              doc.text(ln, ML + 5, y + 5 + li * 4.5)
            })

            doc.setFont('helvetica', 'normal')
            doc.setFontSize(7.5)
            doc.setTextColor(...C.slate)
            const reasonY = y + 5 + actionLines.length * 4.5 + 1
            reasonLines.forEach((ln: string, li: number) => {
              doc.text(ln, ML + 5, reasonY + li * 4)
            })

            // Category tag
            if (sg.category) {
              doc.setFont('helvetica', 'bold')
              doc.setFontSize(6.5)
              doc.setTextColor(...priorityText[pri])
              doc.text(`[${sg.category}]`, ML + CW - 4, y + 5, { align: 'right' })
            }
            y += cardH + 3
          })
          y += 3
        })
      } else {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8.5)
        doc.setTextColor(...C.muted)
        doc.text('No recommendations available at this time.', ML, y + 6)
        y += 14
      }

      drawFooter(pageNum)

      // ── Patch total page count in all footers ──────────────────────────────
      // jsPDF does not have native page-count patching; we use a post-process
      // by re-rendering page numbers. Instead we recorded pageNum at end.
      totalPagesPlaceholder = String(pageNum)
      // Redraw footers with correct total (loop through all pages)
      for (let p = 1; p <= pageNum; p++) {
        doc.setPage(p)
        // Erase old footer text area and redraw
        doc.setFillColor(...C.white)
        doc.rect(PW - MR - 40, PH - 10, 40, 8, 'F')
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.setTextColor(...C.muted)
        doc.text(`Page ${p} of ${totalPagesPlaceholder}`, PW - MR, PH - 8 + 3, { align: 'right' })
      }

      const safeName = report.month.replace(/\s+/g, '_')
      doc.save(`SBMS_Business_Report_${safeName}.pdf`)

    } catch (err) { console.error(err) }
    finally { setGenerating(false) }
  }

  // ── Light-theme design tokens (matches Owner Dashboard) ──────────────────
  const T = {
    bg: '#F8FAFC', card: '#FFFFFF', border: '#E2E8F0',
    text: '#0F172A', textSub: '#475569', textMuted: '#94A3B8',
    blue: '#2563EB', blueLt: '#EFF6FF', blueMid: '#BFDBFE',
    green: '#16A34A', greenLt: '#F0FDF4', greenMid: '#BBF7D0',
    amber: '#D97706', amberLt: '#FFFBEB', amberMid: '#FDE68A',
    red: '#DC2626', redLt: '#FEF2F2', redMid: '#FECACA',
    purple: '#7C3AED', purpleLt: '#F5F3FF', purpleMid: '#DDD6FE',
    shadow: '0 1px 3px rgba(0,0,0,0.06)',
    shadowMd: '0 4px 16px rgba(0,0,0,0.07)',
  }

  // Health score color based on status
  const healthAccent = (() => {
    const s = health?.status
    if (s === 'Excellent') return { color: T.green, lt: T.greenLt, mid: T.greenMid }
    if (s === 'Good')      return { color: '#0D9488', lt: '#F0FDFA', mid: '#99F6E4' }
    if (s === 'Average')   return { color: T.amber,  lt: T.amberLt, mid: T.amberMid }
    if (s === 'Poor')      return { color: '#EA580C', lt: '#FFF7ED', mid: '#FED7AA' }
    return                        { color: T.red,    lt: T.redLt,   mid: T.redMid }
  })()

  const insightStyle = (type: AIInsight['type']) => ({
    positive: { bg: T.greenLt, border: T.greenMid, text: T.green },
    negative: { bg: T.redLt,   border: T.redMid,   text: T.red },
    alert:    { bg: T.amberLt, border: T.amberMid, text: T.amber },
    neutral:  { bg: '#F8FAFC', border: T.border,   text: T.textSub },
  }[type] ?? { bg: '#F8FAFC', border: T.border, text: T.textSub })

  const priorityStyle = (p: Suggestion['priority']) => ({
    high:   { bg: T.redLt,    border: T.redMid,    text: T.red },
    medium: { bg: T.amberLt,  border: T.amberMid,  text: T.amber },
    low:    { bg: '#F8FAFC',  border: T.border,    text: T.textMuted },
  }[p] ?? { bg: '#F8FAFC', border: T.border, text: T.textMuted })

  if (loading) return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.bg }}>
      <div style={{ textAlign: 'center' }}>
        <Brain style={{ width: 40, height: 40, color: T.purple, margin: '0 auto 12px', opacity: 0.7 }} />
        <p style={{ fontSize: 14, color: T.textMuted }}>Profit Pulse AI is analysing your business…</p>
      </div>
    </div>
  )

  // ── Card wrapper ──────────────────────────────────────────────────────────
  const Card = ({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) => (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 20, boxShadow: T.shadow, ...style }}>
      {children}
    </div>
  )

  return (
    <div style={{ background: T.bg, minHeight: '100vh', padding: '24px 24px 48px', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* ── Page header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: T.purpleLt, border: `1px solid ${T.purpleMid}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Brain style={{ width: 20, height: 20, color: T.purple }} />
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: T.text, margin: 0, letterSpacing: '-0.4px' }}>Profit Pulse AI</h1>
              <p style={{ fontSize: 12, color: T.textMuted, margin: 0 }}>Business Intelligence Module · AI-powered analysis</p>
            </div>
          </div>
          <button
            onClick={generatePDF}
            disabled={generating}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 18px', borderRadius: 10, border: 'none',
              background: T.blue, color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: generating ? 'not-allowed' : 'pointer', opacity: generating ? 0.65 : 1,
              boxShadow: '0 2px 8px rgba(37,99,235,0.25)', transition: 'opacity 0.15s',
            }}
          >
            <FileText style={{ width: 15, height: 15 }} />
            {generating ? 'Generating PDF…' : 'Export Monthly Report'}
          </button>
        </div>

        {/* ── Section 1: Business Summary ── */}
        <PPSection icon={<Activity style={{ width: 15, height: 15, color: T.blue }} />} title="Business Summary" T={T}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }} className="pp-summary-grid">
            {[
              { label: 'Revenue',       value: formatCurrency(summary?.revenue ?? 0),     accent: T.green,  accentLt: T.greenLt,  accentMid: T.greenMid,  icon: <TrendingUp style={{ width: 14, height: 14 }} /> },
              { label: 'Expenses',      value: formatCurrency(summary?.expenses ?? 0),    accent: T.red,    accentLt: T.redLt,    accentMid: T.redMid,    icon: <TrendingDown style={{ width: 14, height: 14 }} /> },
              { label: 'Net Profit',    value: formatCurrency(summary?.profit ?? 0),      accent: (summary?.profit ?? 0) >= 0 ? T.blue : T.red, accentLt: (summary?.profit ?? 0) >= 0 ? T.blueLt : T.redLt, accentMid: (summary?.profit ?? 0) >= 0 ? T.blueMid : T.redMid, icon: <TrendingUp style={{ width: 14, height: 14 }} /> },
              { label: 'Total Loss',    value: formatCurrency(summary?.loss ?? 0),        accent: T.amber,  accentLt: T.amberLt,  accentMid: T.amberMid,  icon: <TrendingDown style={{ width: 14, height: 14 }} /> },
              { label: 'Profit Margin', value: formatPercent(summary?.profitMargin ?? 0), accent: (summary?.profitMargin ?? 0) >= 20 ? T.green : T.amber, accentLt: (summary?.profitMargin ?? 0) >= 20 ? T.greenLt : T.amberLt, accentMid: (summary?.profitMargin ?? 0) >= 20 ? T.greenMid : T.amberMid, icon: <Activity style={{ width: 14, height: 14 }} /> },
            ].map(m => (
              <div key={m.label} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: '14px 16px', boxShadow: T.shadow, transition: 'border-color 0.15s' }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = m.accentMid}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = T.border}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: T.textSub, margin: 0 }}>{m.label}</p>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: m.accentLt, border: `1px solid ${m.accentMid}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: m.accent }}>
                    {m.icon}
                  </div>
                </div>
                <p style={{ fontSize: 18, fontWeight: 800, color: m.accent, margin: 0, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.3px' }}>{m.value}</p>
              </div>
            ))}
          </div>
        </PPSection>

        {/* ── Section 2: Health Score ── */}
        <PPSection icon={<Sparkles style={{ width: 15, height: 15, color: T.purple }} />} title="Business Health Score" T={T}>
          <Card>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} className="pp-health-inner">
              {/* Score badge + label */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <div style={{
                    width: 100, height: 100, borderRadius: '50%',
                    background: healthAccent.lt,
                    border: `4px solid ${healthAccent.color}`,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: 32, fontWeight: 900, color: healthAccent.color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{health?.score ?? '—'}</span>
                    <span style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>/ 100</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: healthAccent.color, padding: '3px 10px', borderRadius: 20, background: healthAccent.lt, border: `1px solid ${healthAccent.mid}` }}>
                    {health?.status ?? '—'}
                  </span>
                </div>

                {/* Breakdown bars */}
                <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {health?.breakdown.map(b => (
                    <div key={b.label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: 12, color: T.textSub, fontWeight: 500 }}>{b.label}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: T.text, fontVariantNumeric: 'tabular-nums' }}>{b.score}/{b.max}</span>
                      </div>
                      <div style={{ height: 7, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(b.score / b.max) * 100}%`, background: healthAccent.color, borderRadius: 4, transition: 'width 0.6s ease' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </PPSection>

        {/* ── Section 3: Profit Trend ── */}
        <PPSection icon={<TrendingUp style={{ width: 15, height: 15, color: T.blue }} />} title="Profit Trend" T={T}>
          <Card>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="ppGradRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={T.blue}  stopOpacity={0.15} />
                    <stop offset="95%" stopColor={T.blue}  stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="ppGradPro" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={T.green} stopOpacity={0.12} />
                    <stop offset="95%" stopColor={T.green} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: T.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: T.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 12, color: T.text }}
                  labelStyle={{ color: T.textSub, fontWeight: 600 }}
                  formatter={(v) => [formatCurrency(v as number), '']}
                />
                <Area type="monotone" dataKey="revenue"  stroke={T.blue}  strokeWidth={2} fill="url(#ppGradRev)" name="Revenue" />
                <Area type="monotone" dataKey="profit"   stroke={T.green} strokeWidth={2} fill="url(#ppGradPro)" name="Profit" />
              </AreaChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: 20, marginTop: 12, justifyContent: 'center' }}>
              {[{ color: T.blue, label: 'Revenue' }, { color: T.green, label: 'Profit' }].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.textSub }}>
                  <div style={{ width: 14, height: 3, borderRadius: 2, background: l.color }} />{l.label}
                </div>
              ))}
            </div>
          </Card>
        </PPSection>

        {/* ── Sections 4 & 5: Insights + Suggestions ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }} className="pp-two-col">
          {/* AI Insights */}
          <div>
            <PPSectionHead icon={<Brain style={{ width: 14, height: 14, color: T.purple }} />} title="AI Insights" T={T} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {insights.length === 0
                ? <PPEmpty text="No insights yet — add more business data." T={T} />
                : insights.map((ins, i) => {
                    const s = insightStyle(ins.type)
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', borderRadius: 12, background: s.bg, border: `1px solid ${s.border}` }}>
                        <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1.4 }}>{ins.icon}</span>
                        <p style={{ fontSize: 12, color: T.text, lineHeight: 1.6, margin: 0 }}>{ins.text}</p>
                      </div>
                    )
                  })
              }
            </div>
          </div>

          {/* AI Suggestions */}
          <div>
            <PPSectionHead icon={<Lightbulb style={{ width: 14, height: 14, color: T.amber }} />} title="AI Suggestions" T={T} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {suggestions.length === 0
                ? <PPEmpty text="No suggestions yet." T={T} />
                : suggestions.map((s, i) => {
                    const ps = priorityStyle(s.priority)
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', borderRadius: 12, background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow }}>
                        <ChevronRight style={{ width: 14, height: 14, color: T.blue, flexShrink: 0, marginTop: 2 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', gap: 6, marginBottom: 5, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: ps.bg, color: ps.text, border: `1px solid ${ps.border}`, textTransform: 'uppercase' }}>{s.priority}</span>
                            {s.category && <span style={{ fontSize: 10, color: T.textMuted, padding: '2px 7px', borderRadius: 5, background: '#F8FAFC', border: `1px solid ${T.border}` }}>{s.category}</span>}
                          </div>
                          <p style={{ fontSize: 12, fontWeight: 600, color: T.text, margin: '0 0 3px' }}>{s.action}</p>
                          <p style={{ fontSize: 11, color: T.textSub, margin: 0, lineHeight: 1.5 }}>{s.reason}</p>
                        </div>
                      </div>
                    )
                  })
              }
            </div>
          </div>
        </div>

        {/* ── Section 6: AI Chat ── */}
        <PPSection icon={<Bot style={{ width: 15, height: 15, color: T.purple }} />} title="Ask AI About Your Business" T={T}>
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: T.shadow }}>
            {/* Quick questions */}
            <div style={{ padding: '14px 16px 10px', borderBottom: `1px solid ${T.border}`, display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {QUICK_QUESTIONS.map(q => (
                <button key={q} onClick={() => handleChat(q)} style={{
                  fontSize: 11, padding: '5px 12px', borderRadius: 20,
                  background: T.purpleLt, border: `1px solid ${T.purpleMid}`,
                  color: T.purple, cursor: 'pointer', fontWeight: 500,
                  transition: 'background 0.12s',
                }}>
                  {q}
                </button>
              ))}
            </div>

            {/* Messages */}
            <div style={{ height: 300, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10, background: '#FAFBFC' }}>
              {chatMessages.map((m, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: m.role === 'ai' ? T.purpleLt : T.blueLt, border: `1px solid ${m.role === 'ai' ? T.purpleMid : T.blueMid}` }}>
                    {m.role === 'ai' ? <Bot style={{ width: 13, height: 13, color: T.purple }} /> : <User style={{ width: 13, height: 13, color: T.blue }} />}
                  </div>
                  <div style={{
                    maxWidth: '78%', padding: '9px 13px', borderRadius: 14, fontSize: 12, lineHeight: 1.6,
                    background: m.role === 'ai' ? T.card : T.blueLt,
                    color: m.role === 'ai' ? T.text : T.blue,
                    border: `1px solid ${m.role === 'ai' ? T.border : T.blueMid}`,
                    borderTopLeftRadius: m.role === 'ai' ? 4 : 14,
                    borderTopRightRadius: m.role === 'user' ? 4 : 14,
                  }}>
                    {m.text}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: T.purpleLt, border: `1px solid ${T.purpleMid}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Bot style={{ width: 13, height: 13, color: T.purple }} />
                  </div>
                  <div style={{ padding: '10px 14px', borderRadius: 14, background: T.card, border: `1px solid ${T.border}`, display: 'flex', gap: 4 }}>
                    {[0, 1, 2].map(j => (
                      <span key={j} style={{ width: 6, height: 6, borderRadius: '50%', background: T.textMuted, display: 'inline-block', animation: 'ppBounce 1.2s ease infinite', animationDelay: `${j * 0.2}s` }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div style={{ borderTop: `1px solid ${T.border}`, padding: '12px 14px', display: 'flex', gap: 8, background: T.card }}>
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleChat()}
                placeholder="Ask about profit, expenses, inventory…"
                style={{
                  flex: 1, padding: '9px 14px', borderRadius: 10,
                  border: `1.5px solid ${T.border}`, background: '#F8FAFC',
                  fontSize: 13, color: T.text, outline: 'none', transition: 'border-color 0.15s',
                }}
                onFocus={e => (e.target.style.borderColor = T.purple)}
                onBlur={e => (e.target.style.borderColor = T.border)}
              />
              <button
                onClick={() => handleChat()}
                disabled={!chatInput.trim() || chatLoading}
                style={{
                  width: 40, height: 40, borderRadius: 10, border: 'none',
                  background: chatInput.trim() && !chatLoading ? T.blue : '#E2E8F0',
                  color: chatInput.trim() && !chatLoading ? '#fff' : T.textMuted,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: chatInput.trim() && !chatLoading ? 'pointer' : 'not-allowed',
                  transition: 'background 0.15s',
                  flexShrink: 0,
                }}
              >
                <Send style={{ width: 15, height: 15 }} />
              </button>
            </div>
          </div>
        </PPSection>

      </div>

      <style>{`
        .pp-summary-grid { grid-template-columns: repeat(5, 1fr) !important; }
        .pp-two-col { grid-template-columns: 1fr 1fr !important; }
        @media (max-width: 1024px) {
          .pp-summary-grid { grid-template-columns: repeat(3, 1fr) !important; }
        }
        @media (max-width: 768px) {
          .pp-summary-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .pp-two-col { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 480px) {
          .pp-summary-grid { grid-template-columns: 1fr !important; }
        }
        @keyframes ppBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

// ── Shared sub-components (light theme) ───────────────────────────────────────
function PPSection({ icon, title, children, T }: { icon: React.ReactNode; title: string; children: React.ReactNode; T: Record<string, string> }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <PPSectionHead icon={icon} title={title} T={T} />
      {children}
    </section>
  )
}

function PPSectionHead({ icon, title, T }: { icon: React.ReactNode; title: string; T: Record<string, string> }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      {icon}
      <h2 style={{ fontSize: 13, fontWeight: 700, color: T.text, margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</h2>
      <div style={{ flex: 1, height: 1, background: T.border }} />
    </div>
  )
}

function PPEmpty({ text, T }: { text: string; T: Record<string, string> }) {
  return (
    <div style={{ textAlign: 'center', padding: '28px 16px', borderRadius: 12, background: '#F8FAFC', border: `1px solid ${T.border}` }}>
      <p style={{ fontSize: 12, color: T.textMuted, margin: 0 }}>{text}</p>
    </div>
  )
}
