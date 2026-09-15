import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, locale = 'en-IN'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function daysUntil(date: string | Date): number {
  const diff = new Date(date).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export function daysOverdue(date: string | Date): number {
  return -daysUntil(date)
}

export function getUrgencyColor(urgency: string): string {
  switch (urgency) {
    case 'urgent': return 'text-red-400 bg-red-400/10 border-red-400/20'
    case 'monitor': return 'text-amber-400 bg-amber-400/10 border-amber-400/20'
    default: return 'text-blue-400 bg-blue-400/10 border-blue-400/20'
  }
}

export function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical': return 'text-red-400 bg-red-400/10 border-red-400/20'
    case 'warning': return 'text-amber-400 bg-amber-400/10 border-amber-400/20'
    default: return 'text-blue-400 bg-blue-400/10 border-blue-400/20'
  }
}

export function getConfidenceColor(confidence: string): string {
  switch (confidence) {
    case 'high': return 'text-emerald-400 bg-emerald-400/10'
    case 'medium': return 'text-amber-400 bg-amber-400/10'
    default: return 'text-slate-400 bg-slate-400/10'
  }
}

export function getStockStatus(qty: number, threshold: number): { label: string; color: string } {
  if (qty === 0) return { label: 'Out of Stock', color: 'text-red-400 bg-red-400/10' }
  if (qty <= threshold) return { label: 'Low Stock', color: 'text-amber-400 bg-amber-400/10' }
  return { label: 'In Stock', color: 'text-emerald-400 bg-emerald-400/10' }
}
