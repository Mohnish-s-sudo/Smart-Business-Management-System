import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import User from '@/lib/models/User'
import { signToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }

    await connectDB()

    const user = await User.findOne({ email })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 })
    }

    const bcrypt = await import('bcryptjs')
    const valid = await bcrypt.compare(password, user.password)

    if (!valid) {
      return NextResponse.json({ error: 'Wrong password' }, { status: 401 })
    }

    const token = signToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name
    })

    return NextResponse.json({
      message: "Login successful",
      user,
      token
    })

  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}