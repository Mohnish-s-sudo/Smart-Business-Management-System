import mongoose, { Schema, Document, Model } from 'mongoose'

export interface ISaleItem {
  productId: mongoose.Types.ObjectId
  productName: string
  quantity: number
  unitPrice: number
  unitCost: number
  lineMargin: number
}

export interface ISale extends Document {
  transactionRef: string
  staffId: mongoose.Types.ObjectId
  saleDate: Date
  paymentMethod: 'cash' | 'upi' | 'card' | 'credit'
  totalAmount: number
  totalCost: number
  grossMargin: number
  notes?: string
  items: ISaleItem[]
}

const SaleItemSchema = new Schema<ISaleItem>({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  productName: { type: String, required: true },
  quantity: { type: Number, required: true },
  unitPrice: { type: Number, required: true },
  unitCost: { type: Number, required: true },
  lineMargin: { type: Number, required: true },
}, { _id: false })

const SaleSchema = new Schema<ISale>({
  transactionRef: { type: String, required: true, unique: true },
  staffId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  saleDate: { type: Date, default: Date.now },
  paymentMethod: { type: String, enum: ['cash', 'upi', 'card', 'credit'], required: true },
  totalAmount: { type: Number, required: true },
  totalCost: { type: Number, required: true },
  grossMargin: { type: Number, required: true },
  notes: { type: String },
  items: [SaleItemSchema],
}, { timestamps: false })

const Sale: Model<ISale> = mongoose.models.Sale || mongoose.model<ISale>('Sale', SaleSchema)
export default Sale
