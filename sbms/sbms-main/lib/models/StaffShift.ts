import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IStaffShift extends Document {
  staffId: mongoose.Types.ObjectId
  shiftStart: Date
  shiftEnd?: Date
  hoursWorked?: number
}

const StaffShiftSchema = new Schema<IStaffShift>({
  staffId:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
  shiftStart:  { type: Date, required: true },
  shiftEnd:    { type: Date },
  hoursWorked: { type: Number },
}, { timestamps: false })

const StaffShift: Model<IStaffShift> =
  mongoose.models.StaffShift ||
  mongoose.model<IStaffShift>('StaffShift', StaffShiftSchema)

export default StaffShift
