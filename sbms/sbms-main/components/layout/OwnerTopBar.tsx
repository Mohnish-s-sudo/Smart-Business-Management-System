'use client'
import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/auth'
import { Bell, History, Search } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MobileSidebarTrigger } from './OwnerSidebar'

export function OwnerTopBar({
  alertCount = 0,
  onOpenTimeline,
}: {
  alertCount?: number
  onOpenTimeline?: () => void
}) {
  const user = useAuthStore(s => s.user)
  const token = useAuthStore(s => s.token)
  const updateUser = useAuthStore(s => s.updateUser)
  const router = useRouter()
  const [time, setTime] = useState(new Date())
  const [searchVal, setSearchVal] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [nameModalOpen, setNameModalOpen] = useState(false)
  const [nameDraft, setNameDraft] = useState(user?.name ?? 'Owner')
  const [savingName, setSavingName] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    setNameDraft(user?.name ?? 'Owner')
  }, [user?.name])

  const dateStr = time.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  const timeStr = time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) ?? 'OW'

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = searchVal.trim()
    if (!q) return
    router.push(`/inventory?q=${encodeURIComponent(q)}`)
    setSearchVal('')
  }

  const handleSaveName = async () => {
    const trimmed = nameDraft.trim()
    if (!trimmed || !user?.id) return

    setSavingName(true)

    try {
      const res = await fetch('/api/auth/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ name: trimmed }),
      })

      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || 'Unable to update owner name')
      }

      updateUser({ name: data.name || trimmed })
      setNameModalOpen(false)
      setMenuOpen(false)
    } catch (error) {
      console.error(error)
      alert(error instanceof Error ? error.message : 'Unable to update owner name')
    } finally {
      setSavingName(false)
    }
  }

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 20,
      background: 'rgba(248,250,252,0.95)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid #E2E8F0',
      padding: '0 24px',
    }}>
      <div style={{ height: 60, display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Mobile hamburger */}
        <div className="owner-mobile-only">
          <MobileSidebarTrigger />
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} style={{ flex: 1, maxWidth: 380, position: 'relative' }}>
          <Search style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            width: 14, height: 14, color: '#94A3B8', pointerEvents: 'none',
          }} />
          <input
            value={searchVal}
            onChange={e => setSearchVal(e.target.value)}
            placeholder="Search products, sales, expenses…"
            style={{
              width: '100%', padding: '8px 12px 8px 34px',
              background: '#F1F5F9', border: '1.5px solid #E2E8F0',
              borderRadius: 10, fontSize: 13, color: '#334155',
              outline: 'none', transition: 'border-color 0.15s',
            }}
            onFocus={e => (e.target.style.borderColor = '#2563EB')}
            onBlur={e => (e.target.style.borderColor = '#E2E8F0')}
            aria-label="Search dashboard"
          />
        </form>

        <div style={{ flex: 1 }} />

        {/* Date/time */}
        <div className="owner-desktop-only" style={{ textAlign: 'right' }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#334155', margin: 0, fontVariantNumeric: 'tabular-nums' }}>{timeStr}</p>
          <p style={{ fontSize: 11, color: '#94A3B8', margin: 0 }}>{dateStr}</p>
        </div>

        {onOpenTimeline && (
          <button
            type="button"
            onClick={onOpenTimeline}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '8px 12px', borderRadius: 10, border: '1.5px solid #DDD6FE',
              background: '#F5F3FF', color: '#6D28D9',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              transition: 'all 0.12s', flexShrink: 0,
              boxShadow: '0 1px 4px rgba(124,58,237,0.12)',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#E9D5FF' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#F5F3FF' }}
            title="Open Business Timeline"
          >
            <History style={{ width: 14, height: 14 }} />
            Business Timeline
          </button>
        )}

        {/* Notification bell */}
        <Link href="/alerts" aria-label={`${alertCount} alerts`}>
          <div style={{
            position: 'relative', width: 36, height: 36, borderRadius: 9,
            background: '#F1F5F9', border: '1.5px solid #E2E8F0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#64748B', transition: 'all 0.12s',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#2563EB'; (e.currentTarget as HTMLDivElement).style.color = '#2563EB' }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#E2E8F0'; (e.currentTarget as HTMLDivElement).style.color = '#64748B' }}
          >
            <Bell style={{ width: 15, height: 15 }} />
            {alertCount > 0 && (
              <span style={{
                position: 'absolute', top: 5, right: 5,
                width: 7, height: 7, borderRadius: '50%',
                background: '#EF4444', border: '2px solid #F8FAFC',
              }} />
            )}
          </div>
        </Link>

        {/* Avatar */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            title={user?.name ?? 'Owner'}
            aria-label="Owner profile menu"
            onClick={() => setMenuOpen(v => !v)}
            style={{
              width: 36, height: 36, borderRadius: 9,
              background: 'linear-gradient(135deg, #2563EB 0%, #4F46E5 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, color: '#fff',
              cursor: 'pointer', userSelect: 'none',
              boxShadow: '0 2px 8px rgba(37,99,235,0.25)',
              border: 'none',
            }}
          >
            {initials}
          </button>

          {menuOpen && (
            <div style={{
              position: 'absolute', right: 0, top: 'calc(100% + 10px)',
              minWidth: 170, background: '#fff', border: '1px solid #E2E8F0',
              borderRadius: 12, boxShadow: '0 16px 40px rgba(15,23,42,0.12)',
              overflow: 'hidden', zIndex: 30,
            }}>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  setNameModalOpen(true)
                }}
                style={{
                  width: '100%', background: 'transparent', border: 'none',
                  textAlign: 'left', padding: '10px 12px', color: '#0F172A',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Change Owner Name
              </button>
            </div>
          )}
        </div>
      </div>

      {nameModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.38)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 40,
        }}>
          <div style={{
            width: 360, maxWidth: 'calc(100vw - 24px)', background: '#fff',
            borderRadius: 16, padding: 20, boxShadow: '0 24px 60px rgba(15,23,42,0.18)',
          }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', margin: '0 0 12px' }}>Change Owner Name</h3>
            <input
              type="text"
              value={nameDraft}
              onChange={e => setNameDraft(e.target.value)}
              placeholder="Enter new owner name"
              autoFocus
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 10,
                border: '1px solid #CBD5E1', fontSize: 14, color: '#0F172A',
                outline: 'none', marginBottom: 14,
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                onClick={() => setNameModalOpen(false)}
                style={{
                  background: '#F1F5F9', border: '1px solid #E2E8F0', color: '#334155',
                  borderRadius: 10, padding: '8px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveName}
                disabled={savingName || !nameDraft.trim()}
                style={{
                  background: 'linear-gradient(135deg, #2563EB 0%, #4F46E5 100%)', border: 'none',
                  color: '#fff', borderRadius: 10, padding: '8px 12px', fontSize: 12,
                  fontWeight: 700, cursor: savingName || !nameDraft.trim() ? 'not-allowed' : 'pointer',
                  opacity: savingName || !nameDraft.trim() ? 0.7 : 1,
                }}
              >
                {savingName ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .owner-mobile-only { display: none; }
        .owner-desktop-only { display: block; }
        @media (max-width: 768px) {
          .owner-mobile-only { display: block; }
          .owner-desktop-only { display: none; }
        }
      `}</style>
    </header>
  )
}
