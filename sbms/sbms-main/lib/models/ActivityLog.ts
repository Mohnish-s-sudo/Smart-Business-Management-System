import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IActivityLog extends Document {
  staffId: mongoose.Types.ObjectId
  action: string
  detail: string
  createdAt: Date
}

const ActivityLogSchema = new Schema<IActivityLog>({
  staffId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  action:  { type: String, required: true },
  detail:  { type: String, required: true },
}, { timestamps: { createdAt: 'createdAt', updatedAt: false } })

const ActivityLog: Model<IActivityLog> =
  mongoose.models.ActivityLog ||
  mongoose.model<IActivityLog>('ActivityLog', ActivityLogSchema)

export default ActivityLog
