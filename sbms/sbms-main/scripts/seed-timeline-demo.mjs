/**
 * seed-timeline-demo.mjs
 *
 * Adds realistic historical sales data for the past 7 days so the
 * Business Timeline feature can showcase different dates.
 *
 * SAFETY RULES
 *  ✅ Uses products already in the database (looked up by SKU).
 *  ✅ Idempotent — checks for the `businessTimelineDemo: true` marker
 *     before inserting; skips if records already exist.
 *  ✅ Never modifies today's data.
 *  ✅ Never modifies existing records.
 *  ✅ Never modifies the users collection.
 *  ✅ Read-only when run a second time.
 *
 * Run: node scripts/seed-timeline-demo.mjs
 */

import { MongoClient, ObjectId } from 'mongodb'

const MONGO_URI = 'mongodb://127.0.0.1:27017'
const DB_NAME   = 'sbms'

// ── Helpers ────────────────────────────────────────────────────────────────
const rInt  = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const pick  = arr => arr[Math.floor(Math.random() * arr.length)]
const round = n => Math.round(n)

/** ISO date string for N days ago */
function daysAgoDate(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]   // YYYY-MM-DD
}

/** Date object for a specific wall-clock time on a given YYYY-MM-DD string */
function dateAt(ymd, hours, minutes = 0) {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d, hours, minutes, 0, 0)
}

/** Zero-pad to width */
const zp = (n, w = 2) => String(n).padStart(w, '0')

// ── Per-day scenarios ──────────────────────────────────────────────────────
// Each day has a "flavour": different number of transactions, payment mix,
// and time distribution to make the timeline feel realistic.
const DAY_SCENARIOS = [
  // daysAgo → 1  (yesterday)
  {
    daysAgo: 1,
    label: 'Yesterday',
    txnCount: 24,
    paymentMix: ['cash','cash','cash','upi','upi','card'],
    openHour: 9, closeHour: 21,
  },
  // daysAgo → 2
  {
    daysAgo: 2,
    label: '2 days ago',
    txnCount: 31,
    paymentMix: ['cash','upi','upi','card'],
    openHour: 9, closeHour: 21,
  },
  // daysAgo → 3
  {
    daysAgo: 3,
    label: '3 days ago',
    txnCount: 19,
    paymentMix: ['cash','cash','upi'],
    openHour: 9, closeHour: 20,
  },
  // daysAgo → 4
  {
    daysAgo: 4,
    label: '4 days ago',
    txnCount: 36,
    paymentMix: ['cash','upi','upi','upi','card'],
    openHour: 9, closeHour: 21,
  },
  // daysAgo → 5
  {
    daysAgo: 5,
    label: '5 days ago',
    txnCount: 27,
    paymentMix: ['cash','cash','upi','card'],
    openHour: 9, closeHour: 21,
  },
  // daysAgo → 6
  {
    daysAgo: 6,
    label: '6 days ago',
    txnCount: 22,
    paymentMix: ['cash','cash','cash','upi'],
    openHour: 9, closeHour: 20,
  },
  // daysAgo → 7
  {
    daysAgo: 7,
    label: '7 days ago',
    txnCount: 33,
    paymentMix: ['cash','upi','upi','card','card'],
    openHour: 9, closeHour: 21,
  },
]

// ── SKUs that appear more frequently in sales (fast-movers) ───────────────
// These are looked up in the DB — if not found they are skipped gracefully.
const FAST_MOVER_SKUS = [
  'GRC-001', // Basmati Rice
  'GRC-002', // Sunflower Oil
  'GRC-003', // Toor Dal
  'GRC-005', // Salt
  'GRC-006', // Sugar
  'DRY-001', // Amul Butter
  'BEV-001', // Tea Powder
  'BEV-003', // Mineral Water
  'SNK-001', // Biscuits
  'SNK-002', // Potato Chips
  'PRC-002', // Toothpaste
  'PRC-003', // Soap Bar
  'STN-002', // Ball Pen Pack
]

const SLOW_MOVER_SKUS = [
  'GRC-004', // Wheat Flour
  'BEV-002', // Instant Coffee (0 stock — skip if stockQuantity=0)
  'BEV-004', // Orange Juice
  'SNK-003', // Namkeen Mix
  'PRC-001', // Shampoo
  'STN-001', // Notebook
  'STN-003', // Stapler
  'HME-001', // LED Bulb
  'HME-002', // Extension Cord
  'ELC-001', // USB Cable
  'ELC-003', // Earphones
  'ELC-004', // Bluetooth Speaker
]

// ═══════════════════════════════════════════════════════════════════════════
async function main() {
  const client = new MongoClient(MONGO_URI)
  await client.connect()
  const db = client.db(DB_NAME)
  console.log(`\n[seed-timeline-demo] Connected to MongoDB: ${DB_NAME}`)

  // ── 0. Idempotency check ────────────────────────────────────────────────
  const existingCount = await db.collection('sales').countDocuments({ businessTimelineDemo: true })
  if (existingCount > 0) {
    console.log(`[seed-timeline-demo] Demo data already exists (${existingCount} sale records with businessTimelineDemo: true).`)
    console.log('[seed-timeline-demo] Skipping insert — run is idempotent.')
    await client.close()
    return
  }

  // ── 1. Load existing products from the database ─────────────────────────
  const allProducts = await db.collection('products')
    .find({ isActive: true })
    .toArray()

  if (allProducts.length === 0) {
    console.error('[seed-timeline-demo] ERROR: No active products found in the database.')
    console.error('  Run `node scripts/seed-demo.mjs` first to create products.')
    await client.close()
    process.exit(1)
  }
  console.log(`[seed-timeline-demo] Loaded ${allProducts.length} active products.`)

  // Build lookup maps
  const bySkuMap = {}
  allProducts.forEach(p => { bySkuMap[p.sku] = p })

  // Fast movers available in DB
  const fastMovers = FAST_MOVER_SKUS
    .map(sku => bySkuMap[sku])
    .filter(p => p && p.retailPrice > 0)

  const slowMovers = SLOW_MOVER_SKUS
    .map(sku => bySkuMap[sku])
    .filter(p => p && p.retailPrice > 0)

  // Fallback: if named SKUs don't exist, use whatever products are there
  const sellable = fastMovers.length >= 3
    ? [...fastMovers, ...slowMovers]
    : allProducts.filter(p => p.retailPrice > 0)

  if (sellable.length === 0) {
    console.error('[seed-timeline-demo] ERROR: No sellable products found.')
    await client.close()
    process.exit(1)
  }

  // ── 2. Load an existing owner/staff user ID ─────────────────────────────
  const ownerUser = await db.collection('users').findOne({ role: 'owner' })
  const staffUser = await db.collection('users').findOne({ role: 'staff' })
  const ownerOrStaffId = ownerUser?._id ?? staffUser?._id ?? new ObjectId()
  const staffId        = staffUser?._id ?? ownerOrStaffId
  console.log(`[seed-timeline-demo] Using staffId: ${staffId}`)

  // ── 3. Generate sales for each day ─────────────────────────────────────
  const today = new Date().toISOString().split('T')[0]
  const allSaleDocs = []
  let globalCounter = 1000  // start high to avoid collisions with existing txn numbers

  for (const scenario of DAY_SCENARIOS) {
    const ymd = daysAgoDate(scenario.daysAgo)

    // Extra guard: never insert on today
    if (ymd === today) {
      console.warn(`[seed-timeline-demo] SKIP: ${ymd} is today — not inserting demo data for today.`)
      continue
    }

    console.log(`[seed-timeline-demo] Building ${scenario.txnCount} transactions for ${ymd} (${scenario.label})...`)

    // Spread transactions across business hours
    const totalMinutes = (scenario.closeHour - scenario.openHour) * 60
    const minutesPerSlot = totalMinutes / scenario.txnCount

    for (let t = 0; t < scenario.txnCount; t++) {
      // Assign a realistic time slot with some jitter
      const baseMinute = t * minutesPerSlot
      const jitter     = rInt(-8, 8)
      const absMinute  = Math.max(0, Math.min(baseMinute + jitter, totalMinutes - 1))
      const hour       = scenario.openHour + Math.floor(absMinute / 60)
      const minute     = Math.floor(absMinute % 60)
      const saleDate   = dateAt(ymd, hour, minute)

      // Choose 1–4 products per transaction
      // Bias toward fast movers (appear 3x more often)
      const itemCount  = rInt(1, 4)
      const pool       = fastMovers.length >= 3
        ? [...fastMovers, ...fastMovers, ...fastMovers, ...slowMovers]
        : sellable
      const shuffled   = [...pool].sort(() => Math.random() - 0.5)
      // Deduplicate by _id
      const seen       = new Set()
      const chosen     = []
      for (const p of shuffled) {
        const key = p._id.toString()
        if (!seen.has(key)) { seen.add(key); chosen.push(p) }
        if (chosen.length >= itemCount) break
      }

      let totalAmount = 0, totalCost = 0, grossMargin = 0
      const items = chosen.map(prod => {
        const qty        = rInt(1, 5)
        const unitPrice  = prod.retailPrice
        const unitCost   = prod.unitCost ?? 0
        const lineMargin = (unitPrice - unitCost) * qty
        totalAmount  += unitPrice * qty
        totalCost    += unitCost  * qty
        grossMargin  += lineMargin
        return {
          productId:   prod._id,
          productName: prod.name,
          quantity:    qty,
          unitPrice,
          unitCost,
          lineMargin,
        }
      })

      const dateTag = ymd.replace(/-/g, '')
      const ref     = `DEMO-${dateTag}-${zp(globalCounter++, 4)}`

      // Alternate between owner and staff
      const usedStaffId = t % 3 === 0 ? ownerOrStaffId : staffId

      allSaleDocs.push({
        _id:                  new ObjectId(),
        transactionRef:       ref,
        staffId:              usedStaffId,
        saleDate,
        paymentMethod:        pick(scenario.paymentMix),
        totalAmount:          round(totalAmount),
        totalCost:            round(totalCost),
        grossMargin:          round(grossMargin),
        items,
        // ── Marker — identifies this as demo data ──────────────────────
        businessTimelineDemo: true,
        notes:                `Timeline demo — ${scenario.label}`,
      })
    }
  }

  // ── 4. Insert ────────────────────────────────────────────────────────────
  if (allSaleDocs.length === 0) {
    console.log('[seed-timeline-demo] Nothing to insert (all dates were skipped).')
    await client.close()
    return
  }

  await db.collection('sales').insertMany(allSaleDocs)
  console.log(`\n[seed-timeline-demo] ✅ Inserted ${allSaleDocs.length} demo sale records across ${DAY_SCENARIOS.length} days.`)

  // ── 5. Summary ───────────────────────────────────────────────────────────
  console.log('\n════ DEMO DATA SUMMARY ════')
  for (const scenario of DAY_SCENARIOS) {
    const ymd = daysAgoDate(scenario.daysAgo)
    const dayDocs = allSaleDocs.filter(s =>
      s.saleDate.toISOString().split('T')[0] === ymd
    )
    const revenue    = dayDocs.reduce((s, d) => s + d.totalAmount, 0)
    const itemsSold  = dayDocs.reduce((s, d) => s + d.items.reduce((a, i) => a + i.quantity, 0), 0)
    console.log(
      `  ${ymd} (${scenario.label.padEnd(12)}) | Bills: ${String(dayDocs.length).padStart(2)} | Items: ${String(itemsSold).padStart(3)} | Revenue: ₹${revenue.toLocaleString('en-IN')}`
    )
  }

  // ── 6. Verify today is untouched ─────────────────────────────────────────
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999)
  const todayDemoCount = await db.collection('sales').countDocuments({
    businessTimelineDemo: true,
    saleDate: { $gte: todayStart, $lte: todayEnd },
  })
  if (todayDemoCount > 0) {
    console.warn(`\n⚠ WARNING: ${todayDemoCount} demo records found for today — this should not happen!`)
  } else {
    console.log("\n✅ Today's data is untouched — no demo records inserted for today.")
  }

  await client.close()
  console.log('[seed-timeline-demo] Done.')
}

main().catch(err => {
  console.error('[seed-timeline-demo] FAILED:', err)
  process.exit(1)
})
