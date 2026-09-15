import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IExpense extends Document {
  category: string
  vendorName?: string
  amount: number
  expenseDate: Date
  loggedById: mongoose.Types.ObjectId
  notes?: string
  isRecurring: boolean
}

const ExpenseSchema = new Schema<IExpense>({
  category: { type: String, required: true },
  vendorName: { type: String },
  amount: { type: Number, required: true },
  expenseDate: { type: Date, default: Date.now },
  loggedById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  notes: { type: String },
  isRecurring: { type: Boolean, default: false },
}, { timestamps: false })

const Expense: Model<IExpense> = mongoose.models.Expense || mongoose.model<IExpense>('Expense', ExpenseSchema)
export default Expense
