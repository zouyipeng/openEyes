import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Linux Kernel 补丁日报 - openEyes',
  description: '每日追踪 Linux Kernel 社区补丁动态与 AI 聚合总结',
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
