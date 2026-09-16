/**
 * SBMS — Demo Data Seed Script
 * Purpose : Populate the local MongoDB `sbms` database with realistic demo
 *           business data for a small retail shop.
 * Safety  : Idempotent — checks for existing data before inserting.
 *           NEVER touches the users collection.
 *           NEVER deletes anything.
 * Run     : node scripts/seed-demo.mjs
 */

import { MongoClient, ObjectId } from 'mongodb'

const MONGO_URI = 'mongodb://127.0.0.1:27017'
const DB_NAME   = 'sbms'

// ── Known user IDs from the live database ─────────────────────────────────
const OWNER_ID = new ObjectId('6aa949bcfb02b79174183e25')
const STAFF_ID = new ObjectId('6aa949bcfb02b79174183e26')

// ── Helpers ────────────────────────────────────────────────────────────────
/** Return a random integer between min and max (inclusive) */
const rInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
/** Random element from array */
const pick  = arr => arr[rInt(0, arr.length - 1)]
/** Return a Date object N days before today */
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return d }
/** Return a Date within [startDate, endDate] */
const randDate = (start, end) =>
  new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
/** Zero-pad number */
const zp = (n, w = 2) => String(n).padStart(w, '0')

// ── 1. PRODUCTS ────────────────────────────────────────────────────────────
const PRODUCTS = [
  // Grocery
  { name: 'Basmati Rice 5 kg',      sku: 'GRC-001', category: 'Grocery',       unitCost: 280,  retailPrice: 355,  stockQuantity: 80,  reorderThreshold: 15 },
  { name: 'Sunflower Oil 1 L',       sku: 'GRC-002', category: 'Grocery',       unitCost: 118,  retailPrice: 150,  stockQuantity: 45,  reorderThreshold: 10 },
  { name: 'Toor Dal 1 kg',           sku: 'GRC-003', category: 'Grocery',       unitCost: 92,   retailPrice: 120,  stockQuantity: 60,  reorderThreshold: 10 },
  { name: 'Wheat Flour 5 kg',        sku: 'GRC-004', category: 'Grocery',       unitCost: 155,  retailPrice: 200,  stockQuantity: 35,  reorderThreshold: 8  },
  { name: 'Salt 1 kg',               sku: 'GRC-005', category: 'Grocery',       unitCost: 15,   retailPrice: 22,   stockQuantity: 120, reorderThreshold: 20 },
  { name: 'Sugar 1 kg',              sku: 'GRC-006', category: 'Grocery',       unitCost: 40,   retailPrice: 55,   stockQuantity: 4,   reorderThreshold: 15 }, // LOW STOCK
  // Dairy
  { name: 'Amul Butter 500 g',       sku: 'DRY-001', category: 'Dairy',         unitCost: 220,  retailPrice: 265,  stockQuantity: 20,  reorderThreshold: 8  },
  { name: 'Milk Powder 500 g',       sku: 'DRY-002', category: 'Dairy',         unitCost: 160,  retailPrice: 210,  stockQuantity: 3,   reorderThreshold: 10 }, // LOW STOCK
  // Beverages
  { name: 'Tea Powder 500 g',        sku: 'BEV-001', category: 'Beverages',     unitCost: 110,  retailPrice: 145,  stockQuantity: 50,  reorderThreshold: 10 },
  { name: 'Instant Coffee 200 g',    sku: 'BEV-002', category: 'Beverages',     unitCost: 220,  retailPrice: 290,  stockQuantity: 0,   reorderThreshold: 5  }, // OUT OF STOCK
  { name: 'Mineral Water 1 L',       sku: 'BEV-003', category: 'Beverages',     unitCost: 12,   retailPrice: 20,   stockQuantity: 200, reorderThreshold: 30 },
  { name: 'Orange Juice 1 L',        sku: 'BEV-004', category: 'Beverages',     unitCost: 55,   retailPrice: 75,   stockQuantity: 22,  reorderThreshold: 10 },
  // Snacks
  { name: 'Biscuits Assorted 400 g', sku: 'SNK-001', category: 'Snacks',        unitCost: 48,   retailPrice: 65,   stockQuantity: 70,  reorderThreshold: 15 },
  { name: 'Potato Chips 200 g',      sku: 'SNK-002', category: 'Snacks',        unitCost: 30,   retailPrice: 45,   stockQuantity: 55,  reorderThreshold: 10 },
  { name: 'Namkeen Mix 500 g',        sku: 'SNK-003', category: 'Snacks',        unitCost: 60,   retailPrice: 85,   stockQuantity: 12,  reorderThreshold: 10 }, // near threshold
  // Personal Care
  { name: 'Shampoo 400 ml',          sku: 'PRC-001', category: 'Personal Care', unitCost: 140,  retailPrice: 195,  stockQuantity: 25,  reorderThreshold: 8  },
  { name: 'Toothpaste 150 g',        sku: 'PRC-002', category: 'Personal Care', unitCost: 55,   retailPrice: 80,   stockQuantity: 40,  reorderThreshold: 10 },
  { name: 'Soap Bar 3-pack',         sku: 'PRC-003', category: 'Personal Care', unitCost: 65,   retailPrice: 95,   stockQuantity: 30,  reorderThreshold: 10 },
  // Stationery
  { name: 'Ruled Notebook 200 pg',   sku: 'STN-001', category: 'Stationery',    unitCost: 35,   retailPrice: 55,   stockQuantity: 45,  reorderThreshold: 10 },
  { name: 'Ball Pen Pack (10)',       sku: 'STN-002', category: 'Stationery',    unitCost: 40,   retailPrice: 60,   stockQuantity: 60,  reorderThreshold: 10 },
  { name: 'Stapler with Pins',       sku: 'STN-003', category: 'Stationery',    unitCost: 90,   retailPrice: 130,  stockQuantity: 8,   reorderThreshold: 5  },
  // Home Appliances
  { name: 'LED Bulb 9W (Pack of 4)', sku: 'HME-001', category: 'Home',          unitCost: 180,  retailPrice: 250,  stockQuantity: 30,  reorderThreshold: 8  },
  { name: 'Extension Cord 3 m',      sku: 'HME-002', category: 'Home',          unitCost: 140,  retailPrice: 200,  stockQuantity: 18,  reorderThreshold: 5  },
  { name: 'Pressure Cooker 3 L',     sku: 'HME-003', category: 'Home',          unitCost: 650,  retailPrice: 899,  stockQuantity: 7,   reorderThreshold: 3  },
  // Electronics
  { name: 'USB Type-C Cable 1 m',    sku: 'ELC-001', category: 'Electronics',   unitCost: 80,   retailPrice: 149,  stockQuantity: 40,  reorderThreshold: 10 },
  { name: 'Phone Charger 18W',       sku: 'ELC-002', category: 'Electronics',   unitCost: 250,  retailPrice: 399,  stockQuantity: 0,   reorderThreshold: 5  }, // OUT OF STOCK / dead (no sales > 90 days)
  { name: 'Earphones Wired',         sku: 'ELC-003', category: 'Electronics',   unitCost: 180,  retailPrice: 299,  stockQuantity: 15,  reorderThreshold: 5  },
  { name: 'Bluetooth Speaker Mini',  sku: 'ELC-004', category: 'Electronics',   unitCost: 550,  retailPrice: 899,  stockQuantity: 5,   reorderThreshold: 3  },
  // Dead-stock (no recent sales inserted for these)
  { name: 'Desk Calendar 2023',      sku: 'STN-004', category: 'Stationery',    unitCost: 80,   retailPrice: 120,  stockQuantity: 22,  reorderThreshold: 5  }, // dead stock
  { name: 'Old Model Adapter 5V',    sku: 'ELC-005', category: 'Electronics',   unitCost: 120,  retailPrice: 180,  stockQuantity: 14,  reorderThreshold: 5  }, // dead stock
]

// ── 2. EXPENSE categories ──────────────────────────────────────────────────
const EXPENSE_TEMPLATES = [
  { category: 'Rent',        vendor: 'Shree Properties',    min: 18000, max: 18000, recurring: true  },
  { category: 'Electricity', vendor: 'BESCOM',              min: 2200,  max: 4500,  recurring: true  },
  { category: 'Internet',    vendor: 'ACT Fibernet',        min: 999,   max: 999,   recurring: true  },
  { category: 'Salaries',    vendor: 'Staff Payroll',       min: 12000, max: 15000, recurring: true  },
  { category: 'Packaging',   vendor: 'Rajesh Plastics',     min: 800,   max: 2500,  recurring: false },
  { category: 'Transport',   vendor: 'Hanuman Logistics',   min: 1200,  max: 3000,  recurring: false },
  { category: 'Maintenance', vendor: 'FixIt Services',      min: 500,   max: 2000,  recurring: false },
  { category: 'Marketing',   vendor: 'Print & Go',          min: 1500,  max: 4000,  recurring: false },
  { category: 'Supplies',    vendor: 'Office Depot',        min: 400,   max: 1200,  recurring: false },
]

const PAYMENT_METHODS = ['cash', 'upi', 'card', 'credit']

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════
async function main() {
  const client = new MongoClient(MONGO_URI)
  await client.connect()
  const db = client.db(DB_NAME)

  console.log('Connected to MongoDB:', DB_NAME)

  // ── Guard: skip if demo products already exist ───────────────────────────
  const existingProducts = await db.collection('products').countDocuments({ sku: { $in: PRODUCTS.map(p => p.sku) } })
  if (existingProducts > 0) {
    console.log(`Demo data already present (${existingProducts} products found). Skipping insert.`)
    console.log('To re-seed, manually delete the demo documents first.')
    await client.close()
    return
  }

  // ── Insert products ───────────────────────────────────────────────────────
  const now = new Date()
  const prodDocs = PRODUCTS.map(p => ({
    _id: new ObjectId(),
    name:             p.name,
    sku:              p.sku,
    category:         p.category,
    unitCost:         p.unitCost,
    retailPrice:      p.retailPrice,
    stockQuantity:    p.stockQuantity,
    reorderThreshold: p.reorderThreshold,
    isActive:         true,
    createdAt:        daysAgo(rInt(90, 180)),
  }))
  await db.collection('products').insertMany(prodDocs)
  console.log(`Inserted ${prodDocs.length} products.`)

  // Build a quick lookup map  sku → product doc
  const prodMap = {}
  prodDocs.forEach(p => { prodMap[p.sku] = p })

  // Active products that can be sold (all except the two dead-stock ones)
  const DEAD_SKUS = new Set(['STN-004', 'ELC-005', 'ELC-002'])
  const sellableProds = prodDocs.filter(p => !DEAD_SKUS.has(p.sku))

  // ── Insert Sales (90 records spread over last 6 months) ───────────────────
  const START_DATE = daysAgo(180)
  const END_DATE   = new Date()  // today

  const saleDocs = []
  let txnCounter = 1

  for (let i = 0; i < 90; i++) {
    const saleDate = randDate(START_DATE, END_DATE)
    // 1–4 items per sale
    const itemCount = rInt(1, 4)
    // pick random unique products
    const shuffled = [...sellableProds].sort(() => Math.random() - 0.5)
    const chosenProds = shuffled.slice(0, Math.min(itemCount, shuffled.length))

    let totalAmount = 0, totalCost = 0, grossMargin = 0
    const items = chosenProds.map(prod => {
      const qty        = rInt(1, 5)
      const unitPrice  = prod.retailPrice
      const unitCost   = prod.unitCost
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

    const dateStr = `${saleDate.getFullYear()}${zp(saleDate.getMonth()+1)}${zp(saleDate.getDate())}`
    saleDocs.push({
      _id:            new ObjectId(),
      transactionRef: `TXN-${dateStr}-${zp(txnCounter++, 4)}`,
      staffId:        Math.random() > 0.5 ? STAFF_ID : OWNER_ID,
      saleDate,
      paymentMethod:  pick(PAYMENT_METHODS),
      totalAmount:    Math.round(totalAmount),
      totalCost:      Math.round(totalCost),
      grossMargin:    Math.round(grossMargin),
      items,
    })
  }
  await db.collection('sales').insertMany(saleDocs)
  console.log(`Inserted ${saleDocs.length} sales.`)

  // ── Insert Expenses (28 records over last 6 months) ───────────────────────
  const expenseDocs = []
  // Recurring expenses: one per month for each recurring category
  for (let monthsBack = 0; monthsBack < 6; monthsBack++) {
    const monthStart = new Date()
    monthStart.setDate(5)   // around 5th of each month
    monthStart.setMonth(monthStart.getMonth() - monthsBack)

    for (const tmpl of EXPENSE_TEMPLATES.filter(t => t.recurring)) {
      const expenseDate = new Date(monthStart)
      expenseDate.setDate(rInt(3, 8))
      expenseDocs.push({
        _id:         new ObjectId(),
        category:    tmpl.category,
        vendorName:  tmpl.vendor,
        amount:      rInt(tmpl.min, tmpl.max),
        expenseDate,
        loggedById:  OWNER_ID,
        notes:       `${tmpl.category} — month ${6 - monthsBack}`,
        isRecurring: true,
      })
    }
  }
  // One-off expenses scattered across the period
  const oneOffTemplates = EXPENSE_TEMPLATES.filter(t => !t.recurring)
  for (let i = 0; i < 18; i++) {
    const tmpl = pick(oneOffTemplates)
    expenseDocs.push({
      _id:         new ObjectId(),
      category:    tmpl.category,
      vendorName:  tmpl.vendor,
      amount:      rInt(tmpl.min, tmpl.max),
      expenseDate: randDate(START_DATE, END_DATE),
      loggedById:  OWNER_ID,
      notes:       null,
      isRecurring: false,
    })
  }
  await db.collection('expenses').insertMany(expenseDocs)
  console.log(`Inserted ${expenseDocs.length} expenses.`)

  // ── Insert Cashflows (25 records) ─────────────────────────────────────────
  const cashflowDocs = []
  // Receivables — linked to some sales (credit payments)
  const creditSales = saleDocs.filter(s => s.paymentMethod === 'credit').slice(0, 8)
  creditSales.forEach(sale => {
    const due = new Date(sale.saleDate)
    due.setDate(due.getDate() + rInt(15, 45))
    const isPast    = due < now
    const isPaid    = isPast && Math.random() > 0.3
    cashflowDocs.push({
      _id:               new ObjectId(),
      type:              'receivable',
      customerOrVendor:  `Customer ${rInt(100, 999)}`,
      amount:            sale.totalAmount,
      dueDate:           due,
      status:            isPaid ? 'paid' : (isPast ? 'overdue' : 'pending'),
      saleId:            sale._id,
      notes:             'Credit sale payment',
      createdAt:         sale.saleDate,
    })
  })
  // Payables — linked to suppliers/expenses
  const supplierPayables = [
    { cv: 'Rajesh Plastics',   amt: 14000, daysFromNow: -5  },
    { cv: 'Hanuman Logistics', amt: 8500,  daysFromNow: 10  },
    { cv: 'Fresh Farms Dairy', amt: 22000, daysFromNow: -10 },
    { cv: 'AK Distributors',   amt: 35000, daysFromNow: 5   },
    { cv: 'Star Electronics',  amt: 18000, daysFromNow: 20  },
    { cv: 'VK Wholesalers',    amt: 27500, daysFromNow: -3  },
  ]
  supplierPayables.forEach(p => {
    const due     = daysAgo(-p.daysFromNow)
    const isPast  = due < now
    const status  = isPast ? (Math.random() > 0.4 ? 'paid' : 'overdue') : 'pending'
    cashflowDocs.push({
      _id:               new ObjectId(),
      type:              'payable',
      customerOrVendor:  p.cv,
      amount:            p.amt,
      dueDate:           due,
      status,
      notes:             'Supplier invoice',
      createdAt:         daysAgo(rInt(5, 30)),
    })
  })
  // Additional paid payables (historical)
  for (let i = 0; i < 8; i++) {
    const due = randDate(daysAgo(150), daysAgo(10))
    cashflowDocs.push({
      _id:               new ObjectId(),
      type:              pick(['receivable', 'payable']),
      customerOrVendor:  pick(['Metro Supplier', 'GlobalGoods Ltd', 'City Distributors', 'Sunrise Traders']),
      amount:            rInt(5000, 40000),
      dueDate:           due,
      status:            'paid',
      notes:             'Settled',
      createdAt:         new Date(due.getTime() - rInt(1, 15) * 86400000),
    })
  }
  await db.collection('cashflows').insertMany(cashflowDocs)
  console.log(`Inserted ${cashflowDocs.length} cashflows.`)

  // ── Insert Stock Transactions (40 records) ───────────────────────────────
  const stxDocs = []

  // Initial stock-add transactions for each product (when they were stocked)
  for (const prod of prodDocs) {
    stxDocs.push({
      _id:       new ObjectId(),
      productId: prod._id,
      type:      'add',
      quantity:  prod.stockQuantity + rInt(10, 50),  // initial stock that was added
      note:      'Initial stock entry',
      staffId:   OWNER_ID,
      createdAt: daysAgo(rInt(120, 180)),
    })
  }

  // Damage transactions for a few products
  const damageProds = prodDocs.slice(0, 6)
  for (const prod of damageProds) {
    stxDocs.push({
      _id:       new ObjectId(),
      productId: prod._id,
      type:      'damage',
      quantity:  -rInt(2, 8),
      note:      'Damaged during handling / storage',
      staffId:   STAFF_ID,
      createdAt: randDate(daysAgo(90), daysAgo(5)),
    })
  }

  // Re-stock adjustments for low-stock products
  const restockProds = prodDocs.filter(p => p.stockQuantity < 10).slice(0, 4)
  for (const prod of restockProds) {
    stxDocs.push({
      _id:       new ObjectId(),
      productId: prod._id,
      type:      'add',
      quantity:  rInt(20, 50),
      note:      'Restock from supplier',
      staffId:   OWNER_ID,
      createdAt: randDate(daysAgo(30), daysAgo(2)),
    })
  }

  // Verify transactions
  for (let i = 0; i < 5; i++) {
    stxDocs.push({
      _id:       new ObjectId(),
      productId: pick(prodDocs)._id,
      type:      'verify',
      quantity:  0,
      note:      'Monthly stock verification',
      staffId:   OWNER_ID,
      createdAt: randDate(daysAgo(60), daysAgo(1)),
    })
  }

  await db.collection('stocktransactions').insertMany(stxDocs)
  console.log(`Inserted ${stxDocs.length} stock transactions.`)

  // ── Insert Alerts (10) ───────────────────────────────────────────────────
  const lowStockProds  = prodDocs.filter(p => p.stockQuantity <= p.reorderThreshold && p.stockQuantity > 0)
  const outOfStockProds = prodDocs.filter(p => p.stockQuantity === 0)
  const deadStockProds  = prodDocs.filter(p => DEAD_SKUS.has(p.sku))

  const alertDocs = []

  outOfStockProds.forEach(p => {
    alertDocs.push({
      _id:            new ObjectId(),
      alertType:      'out_of_stock',
      severity:       'critical',
      message:        `${p.name} is completely out of stock. Reorder immediately to avoid lost sales.`,
      triggerData:    { productId: p._id.toString(), productName: p.name, stockQuantity: 0 },
      deliveryStatus: 'sent',
      channel:        'in-app',
      createdAt:      daysAgo(rInt(1, 5)),
    })
  })

  lowStockProds.slice(0, 3).forEach(p => {
    alertDocs.push({
      _id:            new ObjectId(),
      alertType:      'low_stock',
      severity:       'warning',
      message:        `${p.name} stock is low (${p.stockQuantity} units remaining, reorder at ${p.reorderThreshold}).`,
      triggerData:    { productId: p._id.toString(), productName: p.name, stockQuantity: p.stockQuantity },
      deliveryStatus: 'sent',
      channel:        'in-app',
      createdAt:      daysAgo(rInt(1, 7)),
    })
  })

  deadStockProds.forEach(p => {
    alertDocs.push({
      _id:            new ObjectId(),
      alertType:      'dead_stock',
      severity:       'warning',
      message:        `${p.name} has had no sales in over 90 days. Consider discounting to clear inventory.`,
      triggerData:    { productId: p._id.toString(), productName: p.name, value: p.stockQuantity * p.unitCost },
      deliveryStatus: 'pending',
      channel:        'in-app',
      createdAt:      daysAgo(rInt(2, 10)),
    })
  })

  alertDocs.push({
    _id:            new ObjectId(),
    alertType:      'high_expense',
    severity:       'info',
    message:        'Monthly expenses exceeded Rs. 40,000. Review non-essential spending categories.',
    triggerData:    { month: new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) },
    deliveryStatus: 'sent',
    channel:        'in-app',
    createdAt:      daysAgo(rInt(3, 8)),
  })

  alertDocs.push({
    _id:            new ObjectId(),
    alertType:      'overdue_payment',
    severity:       'critical',
    message:        'Fresh Farms Dairy payment of Rs. 22,000 is overdue. Settle to maintain supplier credit.',
    triggerData:    { vendor: 'Fresh Farms Dairy', amount: 22000 },
    deliveryStatus: 'pending',
    channel:        'in-app',
    createdAt:      daysAgo(rInt(1, 4)),
  })

  await db.collection('alerts').insertMany(alertDocs)
  console.log(`Inserted ${alertDocs.length} alerts.`)

  // ── Insert Recommendations (8) ───────────────────────────────────────────
  const recDocs = [
    {
      _id:              new ObjectId(),
      module:           'Inventory',
      title:            'Restock Out-of-Stock Products',
      detectedPattern:  'Instant Coffee 200g and Phone Charger 18W show zero stock.',
      businessImpact:   'Each out-of-stock day costs an estimated Rs. 500–800 in lost sales.',
      confidence:       'high',
      urgency:          'urgent',
      ownerAction:      'Place purchase order with supplier within 48 hours.',
      dataBasis:        'Current stock = 0 for 2 products with consistent past sales.',
      status:           'active',
      createdAt:        daysAgo(3),
    },
    {
      _id:              new ObjectId(),
      module:           'Inventory',
      title:            'Clear Dead Stock via Discount Campaign',
      detectedPattern:  'Desk Calendar 2023 and Old Model Adapter 5V have not sold in 90+ days.',
      businessImpact:   'Rs. 3,320 locked in unsold inventory reducing cash availability.',
      confidence:       'high',
      urgency:          'urgent',
      ownerAction:      'Bundle dead stock with top sellers or offer 20–30% discount.',
      dataBasis:        'No sales recorded in last 90 days for these SKUs.',
      status:           'active',
      createdAt:        daysAgo(7),
    },
    {
      _id:              new ObjectId(),
      module:           'Finance',
      title:            'Review Recurring Expense Optimisation',
      detectedPattern:  'Electricity bill increased 18% in the last 2 months.',
      businessImpact:   'Additional Rs. 1,400/month if current trend continues.',
      confidence:       'medium',
      urgency:          'monitor',
      ownerAction:      'Audit after-hours energy consumption; consider LED upgrades.',
      dataBasis:        'Electricity expense data from last 3 months.',
      status:           'active',
      createdAt:        daysAgo(10),
    },
    {
      _id:              new ObjectId(),
      module:           'Sales',
      title:            'Increase Stock of Top-Selling Grocery Items',
      detectedPattern:  'Basmati Rice, Toor Dal, and Biscuits consistently sell 3–5 units/day.',
      businessImpact:   'Stocking 30% more could increase monthly revenue by Rs. 8,000–12,000.',
      confidence:       'high',
      urgency:          'monitor',
      ownerAction:      'Raise purchase quantity for these 3 SKUs in next supplier order.',
      dataBasis:        'Sales velocity from last 6 months.',
      status:           'active',
      createdAt:        daysAgo(5),
    },
    {
      _id:              new ObjectId(),
      module:           'Finance',
      title:            'Collect Overdue Receivables',
      detectedPattern:  'Two credit customers have overdue balances > 30 days.',
      businessImpact:   'Rs. 4,500+ receivable outstanding, affecting working capital.',
      confidence:       'high',
      urgency:          'urgent',
      ownerAction:      'Call or message customers with outstanding dues this week.',
      dataBasis:        'Cashflow receivable records with overdue status.',
      status:           'active',
      createdAt:        daysAgo(2),
    },
    {
      _id:              new ObjectId(),
      module:           'Pricing',
      title:            'Improve Margin on Personal Care Category',
      detectedPattern:  'Personal care products average 28% margin vs shop-wide 34%.',
      businessImpact:   'Raising prices by 5–8% could add Rs. 1,200/month in profit.',
      confidence:       'medium',
      urgency:          'informational',
      ownerAction:      'Review competitor pricing for Shampoo and Soap; adjust if possible.',
      dataBasis:        'Gross margin analysis across categories.',
      status:           'active',
      createdAt:        daysAgo(14),
    },
    {
      _id:              new ObjectId(),
      module:           'Inventory',
      title:            'Set Up Automatic Reorder Alerts',
      detectedPattern:  'Sugar 1kg and Milk Powder 500g frequently hit critical low stock.',
      businessImpact:   'Prevents stockouts and maintains customer satisfaction.',
      confidence:       'high',
      urgency:          'monitor',
      ownerAction:      'Set reorder threshold to 15 for Sugar and 12 for Milk Powder.',
      dataBasis:        'Stock transaction history and current quantities.',
      status:           'active',
      createdAt:        daysAgo(6),
    },
    {
      _id:              new ObjectId(),
      module:           'Marketing',
      title:            'Launch Weekend Bundle Offer',
      detectedPattern:  'Sales dip by ~22% on Mondays and Tuesdays compared to weekends.',
      businessImpact:   'Targeted promotions could reduce weekly sales variance.',
      confidence:       'medium',
      urgency:          'informational',
      ownerAction:      'Create a mid-week combo offer pairing slow-moving and fast-moving items.',
      dataBasis:        'Day-of-week sales distribution from last 2 months.',
      status:           'active',
      createdAt:        daysAgo(9),
    },
  ]
  await db.collection('recommendations').insertMany(recDocs)
  console.log(`Inserted ${recDocs.length} recommendations.`)

  // ── Final counts ─────────────────────────────────────────────────────────
  console.log('\n════ FINAL COLLECTION COUNTS ════')
  const collNames = ['users','products','sales','expenses','cashflows','stocktransactions','alerts','recommendations']
  for (const c of collNames) {
    const n = await db.collection(c).countDocuments()
    console.log(`  ${c.padEnd(20)} ${n}`)
  }

  // ── Verify existing users untouched ──────────────────────────────────────
  console.log('\n════ EXISTING USERS ════')
  const users = await db.collection('users').find({}).toArray()
  users.forEach(u => console.log(`  ${u.email}  (${u.role})`))

  await client.close()
  console.log('\nSeed complete. No application code was modified.')
}

main().catch(err => { console.error('Seed failed:', err); process.exit(1) })
