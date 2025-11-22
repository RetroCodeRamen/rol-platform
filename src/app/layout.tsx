import type { Metadata } from 'next'
import './globals.css'
import { ThemeInitializer } from '@/components/ThemeInitializer'

export const metadata: Metadata = {
  title: 'Ramen Online (ROL) - RetroCodeRamen',
  description: 'Ramen Online - Retro dial-up experience - Frontend & Backend',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <ThemeInitializer />
        {children}
      </body>
    </html>
  )
}

