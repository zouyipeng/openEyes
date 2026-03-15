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
    <html lang="zh-CN">
      <body className={inter.className}>
        <div className="min-h-screen bg-gray-50">
          <header className="bg-white shadow-sm border-b">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-16">
                <a href="/" className="flex items-center space-x-2">
                  <span className="text-2xl">👁️</span>
                  <span className="text-xl font-bold text-gray-900">openEyes</span>
                </a>
                <nav className="flex space-x-4">
                  <a href="/" className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium">
                    今日信息
                  </a>
                  <a href="/sources" className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium">
                    信息源
                  </a>
                  <a href="/articles" className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium">
                    全部文章
                  </a>
                </nav>
              </div>
            </div>
          </header>
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
