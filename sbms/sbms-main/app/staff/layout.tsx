'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { motion } from 'framer-motion'

export default function StaffPortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, token } = useAuthStore()

  useEffect(() => {
    if (!token || !user) { router.replace('/login'); return }
    if (user.role !== 'staff') router.replace('/dashboard')
  }, [token, user, router])

  if (!user || user.role !== 'staff') return null

  return (
    <div className="min-h-screen" style={{ background: '#F8FAFC', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="min-h-screen"
      >
        {children}
      </motion.div>
    </div>
  )
}
