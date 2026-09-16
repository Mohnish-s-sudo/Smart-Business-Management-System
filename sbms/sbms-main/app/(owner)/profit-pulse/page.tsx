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
