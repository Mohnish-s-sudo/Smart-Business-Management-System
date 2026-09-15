import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import 'dotenv/config'

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sbms'

const UserSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  role: String,
})

const User = mongoose.models.User || mongoose.model('User', UserSchema)

async function seed() {
  await mongoose.connect(MONGODB_URI)
  console.log('Connected to MongoDB:', MONGODB_URI)

  // Clear existing users
  await User.deleteMany({})
  console.log('Cleared existing users')

  const users = [
    {
      name: 'Owner',
      email: 'owner@sbms.com',
      password: await bcrypt.hash('password123', 10),
      role: 'owner',
    },
    {
      name: 'Staff',
      email: 'staff@sbms.com',
      password: await bcrypt.hash('password123', 10),
      role: 'staff',
    },
  ]

  await User.insertMany(users)
  console.log('Seeded users:')
  users.forEach(u => console.log(` - ${u.email} (${u.role})`))

  await mongoose.disconnect()
  console.log('Done.')
}

seed().catch(err => {
  console.error('Seed failed:', err)
  process.exit(1)
})
