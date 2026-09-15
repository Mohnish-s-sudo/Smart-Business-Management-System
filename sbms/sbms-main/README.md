# SBMS – Smart Business Monitoring System

A hackathon-ready, investor-demo-grade SaaS platform for SME business intelligence.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up database and seed demo data
npm run db:setup

# 3. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Demo Accounts

| Role  | Email              | Password  |
|-------|--------------------|-----------|
| Owner | owner@sbms.com     | owner123  |
| Staff | priya@sbms.com     | staff123  |
| Staff | ravi@sbms.com      | staff123  |

## Stack

- **Frontend**: Next.js 16 (App Router), TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: SQLite via Prisma 7 + libSQL adapter
- **Auth**: JWT (cookie-based)
- **Charts**: Recharts
- **State**: Zustand + React Query

## Modules

- **Dashboard** — Executive KPI strip, revenue charts, ProfitPulse cards
- **SalesTrack** — Transaction logging with live margin preview
- **InventoryGuard** — Stock management with expiry and reorder alerts
- **ExpenseLens** — Categorized expense tracking with trend analysis
- **CashFlow360** — Receivables and payables with aging indicators
- **ProfitPulse AI** — 8 pre-loaded AI recommendations with impact estimates
- **AlertCommand** — Alert feed with WhatsApp/Email/Telegram delivery status
- **ReportHub** — Exportable CSV reports
- **StaffOps** — Mobile-optimized staff panel

## Re-seed Database

```bash
node prisma/seed.js
```
