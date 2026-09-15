'use client'
import { useEffect, useState } from 'react'
import { useApi } from '@/hooks/useApi'
import { formatCurrency } from '@/lib/utils'
import { ShoppingCart, Receipt, Package, BarChart2 } from 'lucide-react'
import Link from 'next/link'

interface ShiftData { transactions: number; totalSales: number; totalExpenses: number }

export default function StaffOpsPage() {
  const { apiFetch } = useApi()
  const [shift, setShift] = useState<ShiftData | null>(null)

  useEffect(() => {
    apiFetch<ShiftData>('/api/staff/shift').then(setShift).catch(console.error)
  }, [])

  const actions = [
    { href: '/staff-ops/sale', label: 'Log Sale', icon: ShoppingCart, color: 'bg-indigo-600 hover:bg-indigo-500', desc: 'Record a new transaction' },
    { href: '/staff-ops/expense', label: 'Record Expense', icon: Receipt, color: 'bg-teal-600 hover:bg-teal-500', desc: 'Log a business expense' },
    { href: '/staff-ops/stock', label: 'Update Stock', icon: Package, color: 'bg-amber-600 hover:bg-amber-500', desc: 'Adjust inventory levels' },
    { href: '/staff-ops/shift', label: 'My Shift', icon: BarChart2, color: 'bg-slate-700 hover:bg-slate-600', desc: 'View today\'s summary' },
  ]

  return (
    <div className="py-4">
      <h1 className="text-xl font-bold text-white mb-1">Staff Operations</h1>
      <p className="text-sm text-slate-500 mb-6">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {actions.map(a => (
          <Link key={a.href} href={a.href} className={`${a.color} rounded-2xl p-5 flex flex-col gap-3 transition-colors active:scale-95`}>
            <a.icon className="w-7 h-7 text-white" />
            <div>
              <p className="text-base font-bold text-white">{a.label}</p>
              <p className="text-xs text-white/60">{a.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Shift summary */}
      {shift && (
        <div className="bg-[#1A1D27] rounded-2xl border border-white/5 p-4">
          <p className="text-xs text-slate-500 mb-3">Today&apos;s Shift Summary</p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xl font-bold text-white">{shift.transactions}</p>
              <p className="text-[10px] text-slate-500">Transactions</p>
            </div>
            <div>
              <p className="text-xl font-bold text-white">{formatCurrency(shift.totalSales)}</p>
              <p className="text-[10px] text-slate-500">Sales</p>
            </div>
            <div>
              <p className="text-xl font-bold text-white">{formatCurrency(shift.totalExpenses)}</p>
              <p className="text-[10px] text-slate-500">Expenses</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
