import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'openEyes - 互联网信息整合平台',
  description: '每日整合来自多个信息源的内容，AI智能总结',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN" className="bg-gray-900">
      <body className={`${inter.className} bg-gray-900 min-h-screen`}>
        {children}
      </body>
    </html>
  )
}
