const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || ''

async function postWebhook(event: string, data: Record<string, unknown>): Promise<void> {
  if (!N8N_WEBHOOK_URL) return
  try {
    await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, timestamp: new Date().toISOString(), data }),
    })
  } catch (err) {
    console.error(`[n8n] Failed to send webhook for event "${event}":`, err)
  }
}

export async function sendSaleWebhook(sale: Record<string, unknown>): Promise<void> {
  await postWebhook('new_sale', sale)
}

export async function sendExpenseWebhook(expense: Record<string, unknown>): Promise<void> {
  await postWebhook('new_expense', expense)
}

export async function sendLowStockAlert(product: Record<string, unknown>): Promise<void> {
  await postWebhook('low_stock_alert', product)
}

export async function sendDailyReport(report: Record<string, unknown>): Promise<void> {
  await postWebhook('daily_report', report)
}

export async function sendNewStaffWebhook(staff: Record<string, unknown>): Promise<void> {
  await postWebhook('new_staff', staff)
}
