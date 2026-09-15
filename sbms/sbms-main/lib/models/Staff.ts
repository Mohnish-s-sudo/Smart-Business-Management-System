import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IShift {
  date: Date
  clockIn: Date
  clockOut?: Date
  hoursWorked?: number
}

export interface IStaff extends Document {
  userId: mongoose.Types.ObjectId
  shifts: IShift[]
}

const ShiftSchema = new Schema<IShift>({
  date: { type: Date, required: true },
  clockIn: { type: Date, required: true },
  clockOut: { type: Date },
  hoursWorked: { type: Number },
}, { _id: false })

const StaffSchema = new Schema<IStaff>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  shifts: [ShiftSchema],
})

const Staff: Model<IStaff> = mongoose.models.Staff || mongoose.model<IStaff>('Staff', StaffSchema)
export default Staff
