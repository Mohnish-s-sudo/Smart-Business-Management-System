'use client'
import { useEffect, useState } from 'react'
import { useApi } from '@/hooks/useApi'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface ShiftData { transactions: number; totalSales: number; totalExpenses: number; recentSales: { id: string; transactionRef: string; totalAmount: number; saleDate: string; paymentMethod: string }[] }

export default function ShiftPage() {
  const { apiFetch } = useApi()
  const [shift, setShift] = useState<ShiftData | null>(null)

  useEffect(() => {
    apiFetch<ShiftData>('/api/staff/shift').then(setShift).catch(console.error)
  }, [])

  return (
    <div className="py-4">
      <div className="flex items-center gap-3 mb-5">
        <Link href="/staff-ops" className="p-2 rounded-lg hover:bg-white/5 text-slate-400">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-lg font-bold text-white">My Shift</h1>
      </div>

      <p className="text-xs text-slate-500 mb-4">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>

      {shift && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: 'Transactions', value: String(shift.transactions) },
              { label: 'Total Sales', value: formatCurrency(shift.totalSales) },
              { label: 'Expenses', value: formatCurrency(shift.totalExpenses) },
            ].map(k => (
              <div key={k.label} className="bg-[#1A1D27] rounded-xl border border-white/5 p-3 text-center">
                <p className="text-lg font-bold text-white">{k.value}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{k.label}</p>
              </div>
            ))}
          </div>

          <div className="bg-[#1A1D27] rounded-2xl border border-white/5 p-4">
            <p className="text-xs text-slate-500 mb-3">Recent Transactions</p>
            {shift.recentSales.length === 0 ? (
              <p className="text-sm text-slate-600 text-center py-4">No transactions yet today</p>
            ) : (
              <div className="space-y-2">
                {shift.recentSales.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-2 rounded-lg bg-white/3">
                    <div>
                      <p className="text-xs font-medium text-white">{s.transactionRef}</p>
                      <p className="text-[10px] text-slate-500 capitalize">{s.paymentMethod}</p>
                    </div>
                    <p className="text-sm font-bold text-white">{formatCurrency(s.totalAmount)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
