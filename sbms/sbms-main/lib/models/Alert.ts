import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IAlert extends Document {
  alertType: string
  severity: 'critical' | 'warning' | 'info'
  message: string
  triggerData?: Record<string, unknown>
  deliveryStatus: 'pending' | 'sent' | 'failed'
  channel: 'email' | 'whatsapp' | 'telegram' | 'in-app'
  createdAt: Date
  acknowledgedAt?: Date
}

const AlertSchema = new Schema<IAlert>({
  alertType: { type: String, required: true },
  severity: { type: String, enum: ['critical', 'warning', 'info'], required: true },
  message: { type: String, required: true },
  triggerData: { type: Schema.Types.Mixed },
  deliveryStatus: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
  channel: { type: String, enum: ['email', 'whatsapp', 'telegram', 'in-app'], default: 'in-app' },
  acknowledgedAt: { type: Date },
}, { timestamps: { createdAt: 'createdAt', updatedAt: false } })

const Alert: Model<IAlert> = mongoose.models.Alert || mongoose.model<IAlert>('Alert', AlertSchema)
export default Alert
