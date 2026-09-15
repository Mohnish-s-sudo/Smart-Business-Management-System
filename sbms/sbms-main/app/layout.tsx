import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'react-hot-toast'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'SBMS – Smart Business Monitor',
  description: 'Real-time profit intelligence for modern businesses',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-[#080B12] text-white antialiased font-sans">
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#0E1220',
              color: '#fff',
              border: '1px solid rgba(124,58,237,0.2)',
              borderRadius: '12px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
              fontSize: '13px',
            },
            duration: 4000,
          }}
        />
      </body>
    </html>
  )
}
