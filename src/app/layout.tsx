import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Linux Kernel动态 - openEyes',
  description: '每日追踪 Linux Kernel 社区补丁动态与 AI 聚合总结',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN" className="bg-slate-50">
      <body className="bg-slate-50 min-h-screen font-sans">
        {children}
      </body>
    </html>
  )
}
