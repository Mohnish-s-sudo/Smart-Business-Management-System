import { NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET || 'sbms-secret'

export interface JWTPayload {
  userId: string
  email: string
  role: 'owner' | 'staff'
  name: string
}

export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, SECRET) as JWTPayload
  } catch {
    return null
  }
}

export function getTokenFromRequest(req: NextRequest): JWTPayload | null {
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return verifyToken(authHeader.slice(7))
  }
  const cookie = req.cookies.get('sbms-token')?.value
  if (cookie) return verifyToken(cookie)
  return null
}

export function requireRole(payload: JWTPayload | null, role: 'owner' | 'staff'): boolean {
  if (!payload) return false
  if (role === 'staff') return payload.role === 'staff' || payload.role === 'owner'
  return payload.role === role
}
