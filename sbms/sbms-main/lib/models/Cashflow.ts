import mongoose, { Schema, Document, Model } from 'mongoose'

export interface ICashflow extends Document {
  type: 'receivable' | 'payable'
  customerOrVendor: string
  amount: number
  dueDate: Date
  status: 'pending' | 'paid' | 'overdue'
  saleId?: mongoose.Types.ObjectId
  notes?: string
  createdAt: Date
}

const CashflowSchema = new Schema<ICashflow>({
  type: { type: String, enum: ['receivable', 'payable'], required: true },
  customerOrVendor: { type: String, required: true },
  amount: { type: Number, required: true },
  dueDate: { type: Date, required: true },
  status: { type: String, enum: ['pending', 'paid', 'overdue'], default: 'pending' },
  saleId: { type: Schema.Types.ObjectId, ref: 'Sale' },
  notes: { type: String },
}, { timestamps: { createdAt: 'createdAt', updatedAt: false } })

const Cashflow: Model<ICashflow> = mongoose.models.Cashflow || mongoose.model<ICashflow>('Cashflow', CashflowSchema)
export default Cashflow
