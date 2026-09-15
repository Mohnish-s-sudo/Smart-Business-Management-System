'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { Sidebar } from '@/components/layout/Sidebar'
import { motion } from 'framer-motion'

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const user   = useAuthStore(s => s.user)

  useEffect(() => {
    if (!user) { router.push('/login'); return }
    if (user.role !== 'owner') router.push('/staff-ops')
  }, [user, router])

  if (!user || user.role !== 'owner') return null

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <motion.main
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="flex-1 ml-64 p-7 max-w-[1360px] min-h-screen"
      >
        {children}
      </motion.main>
    </div>
  )
}
