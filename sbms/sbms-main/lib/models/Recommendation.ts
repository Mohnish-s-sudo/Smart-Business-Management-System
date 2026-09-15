import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IRecommendation extends Document {
  module: string
  title: string
  detectedPattern: string
  businessImpact: string
  confidence: 'high' | 'medium' | 'low'
  urgency: 'urgent' | 'monitor' | 'informational'
  ownerAction: string
  dataBasis: string
  status: 'active' | 'resolved' | 'dismissed'
  createdAt: Date
}

const RecommendationSchema = new Schema<IRecommendation>({
  module: { type: String, required: true },
  title: { type: String, required: true },
  detectedPattern: { type: String, required: true },
  businessImpact: { type: String, required: true },
  confidence: { type: String, enum: ['high', 'medium', 'low'], required: true },
  urgency: { type: String, enum: ['urgent', 'monitor', 'informational'], required: true },
  ownerAction: { type: String, required: true },
  dataBasis: { type: String, required: true },
  status: { type: String, enum: ['active', 'resolved', 'dismissed'], default: 'active' },
}, { timestamps: { createdAt: 'createdAt', updatedAt: false } })

const Recommendation: Model<IRecommendation> = mongoose.models.Recommendation || mongoose.model<IRecommendation>('Recommendation', RecommendationSchema)
export default Recommendation
