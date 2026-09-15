import mongoose from 'mongoose'

const StockTransactionSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  },
  type: {
    type: String,
    enum: ['add', 'adjust', 'damage', 'verify'],
    required: true
  },
  quantity: Number,
  note: String,
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true })

export default mongoose.models.StockTransaction ||
  mongoose.model('StockTransaction', StockTransactionSchema)