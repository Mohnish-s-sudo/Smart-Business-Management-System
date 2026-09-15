import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IStockVerification extends Document {
  productId: mongoose.Types.ObjectId
  staffId: mongoose.Types.ObjectId
  systemStock: number
  actualStock: number
  difference: number
  createdAt: Date
}

const StockVerificationSchema = new Schema<IStockVerification>({
  productId:   { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  staffId:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
  systemStock: { type: Number, required: true },
  actualStock: { type: Number, required: true },
  difference:  { type: Number, required: true },
}, { timestamps: { createdAt: 'createdAt', updatedAt: false } })

const StockVerification: Model<IStockVerification> =
  mongoose.models.StockVerification ||
  mongoose.model<IStockVerification>('StockVerification', StockVerificationSchema)

export default StockVerification
