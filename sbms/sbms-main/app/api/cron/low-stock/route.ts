import { NextRequest, NextResponse } from 'next/server'
import { checkLowStock } from '@/lib/checkLowStock'

// Call this endpoint every 5 minutes via a cron job or external scheduler
// e.g. Vercel Cron: { "path": "/api/cron/low-stock", "schedule": "*/5 * * * *" }
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await checkLowStock()
  return NextResponse.json({ ok: true, timestamp: new Date().toISOString() })
}
