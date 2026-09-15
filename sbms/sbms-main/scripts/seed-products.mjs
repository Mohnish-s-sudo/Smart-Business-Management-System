import mongoose from 'mongoose'
import 'dotenv/config'

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sbms'

const ProductSchema = new mongoose.Schema({
  name: String,
  sku: String,
  category: String,
  unitCost: Number,
  retailPrice: Number,
  stockQuantity: { type: Number, default: 0 },
  reorderThreshold: { type: Number, default: 10 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true })

const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema)

const products = [
  { name: 'Basmati Rice 5kg',   sku: 'RICE-5KG',   category: 'Grains',     unitCost: 280, retailPrice: 350, stockQuantity: 50,  reorderThreshold: 10 },
  { name: 'Sunflower Oil 1L',   sku: 'OIL-SFW-1L', category: 'Oils',       unitCost: 120, retailPrice: 150, stockQuantity: 30,  reorderThreshold: 8  },
  { name: 'Sugar 1kg',          sku: 'SUGAR-1KG',   category: 'Essentials', unitCost: 42,  retailPrice: 55,  stockQuantity: 5,   reorderThreshold: 15 },
  { name: 'Toor Dal 1kg',       sku: 'DAL-TOOR-1K', category: 'Pulses',     unitCost: 95,  retailPrice: 120, stockQuantity: 40,  reorderThreshold: 10 },
  { name: 'Wheat Flour 5kg',    sku: 'FLOUR-WHT-5K',category: 'Grains',     unitCost: 160, retailPrice: 200, stockQuantity: 25,  reorderThreshold: 8  },
  { name: 'Milk 500ml',         sku: 'MILK-500ML',  category: 'Dairy',      unitCost: 25,  retailPrice: 32,  stockQuantity: 3,   reorderThreshold: 20 },
  { name: 'Tea Powder 250g',    sku: 'TEA-250G',    category: 'Beverages',  unitCost: 60,  retailPrice: 80,  stockQuantity: 20,  reorderThreshold: 5  },
  { name: 'Salt 1kg',           sku: 'SALT-1KG',    category: 'Essentials', unitCost: 18,  retailPrice: 25,  stockQuantity: 60,  reorderThreshold: 10 },
]

async function seed() {
  await mongoose.connect(MONGODB_URI)
  console.log('Connected:', MONGODB_URI)

  const existing = await Product.countDocuments()
  if (existing > 0) {
    console.log(`Products already seeded (${existing} found). Skipping.`)
    await mongoose.disconnect()
    return
  }

  await Product.insertMany(products)
  console.log(`Seeded ${products.length} products:`)
  products.forEach(p => console.log(` - ${p.name} (stock: ${p.stockQuantity}, threshold: ${p.reorderThreshold})`))

  await mongoose.disconnect()
  console.log('Done.')
}

seed().catch(err => { console.error('Seed failed:', err); process.exit(1) })
