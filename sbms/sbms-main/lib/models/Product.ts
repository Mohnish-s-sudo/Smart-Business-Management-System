import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IProduct extends Document {
  name: string
  sku: string
  category: string
  unitCost: number
  retailPrice: number
  stockQuantity: number
  reorderThreshold: number
  expiryDate?: Date
  isActive: boolean
  createdAt: Date
}

const ProductSchema = new Schema<IProduct>({
  name: { type: String, required: true },
  sku: { type: String, required: true, unique: true },
  category: { type: String, required: true },
  unitCost: { type: Number, required: true },
  retailPrice: { type: Number, required: true },
  stockQuantity: { type: Number, default: 0 },
  reorderThreshold: { type: Number, default: 10 },
  expiryDate: { type: Date },
  isActive: { type: Boolean, default: true },
}, { timestamps: { createdAt: 'createdAt', updatedAt: false } })

const Product: Model<IProduct> = mongoose.models.Product || mongoose.model<IProduct>('Product', ProductSchema)
export default Product
