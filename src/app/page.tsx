'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { dayDataApi, type SourceDatesIndex } from '@/lib/api'
import PenguinIcon from '@/components/PenguinIcon'

const SOURCE_CONFIG = [
  {
    name: 'Mailing List',
    description: 'Linux Kernel 邮件列表补丁动态',
    icon: '📧',
    color: 'bg-blue-50 border-blue-200 hover:border-blue-300',
    iconBg: 'bg-blue-100',
  },
  {
    name: 'Mainline',
    description: 'Linux Kernel 主线代码合入情况',
    icon: '🔀',
    color: 'bg-purple-50 border-purple-200 hover:border-purple-300',
    iconBg: 'bg-purple-100',
  },
]

function sourceNameToFileName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-')
}

export default function HomePage() {
  const [sourceIndex, setSourceIndex] = useState<SourceDatesIndex>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadIndex()
  }, [])

  const loadIndex = async () => {
    try {
      const index = await dayDataApi.getSourceDatesIndex()
      setSourceIndex(index)
    } catch (error) {
      console.error('加载数据源索引失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-')
    return `${month}月${day}日`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-slate-500">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-3 sm:px-4 py-8 sm:py-12">
        <div className="text-center mb-8 sm:mb-12">
          <div className="flex items-center justify-center gap-2 mb-4">
            <PenguinIcon className="h-8 w-8" />
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">openEyes</h1>
          </div>
          <p className="text-slate-600 text-sm sm:text-base">Linux Kernel 社区动态追踪</p>
        </div>

        <div className="grid gap-4 sm:gap-6">
          {SOURCE_CONFIG.map(source => {
            const key = sourceNameToFileName(source.name)
            const dates = sourceIndex[key]?.dates || []
            const latestDate = dates[0]
            const count = dates.length

            return (
              <Link
                key={source.name}
                href={latestDate ? `/${latestDate}/${key}` : '#'}
                className={`block rounded-xl border-2 p-4 sm:p-6 transition-all duration-200 ${source.color} ${
                  !latestDate ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl ${source.iconBg} flex items-center justify-center text-2xl sm:text-3xl flex-shrink-0`}>
                    {source.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg sm:text-xl font-semibold text-slate-900 mb-1">
                      {source.name}
                    </h2>
                    <p className="text-sm text-slate-600 mb-2 sm:mb-3">
                      {source.description}
                    </p>
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500">
                      {latestDate ? (
                        <>
                          <span className="text-emerald-600 font-medium">最新: {formatDate(latestDate)}</span>
                          {count > 1 && (
                            <>
                              <span className="text-slate-300">·</span>
                              <span>共 {count} 天数据</span>
                            </>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-400">暂无数据</span>
                      )}
                    </div>
                  </div>
                  {latestDate && (
                    <div className="text-slate-400 flex-shrink-0">
                      <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  )}
                </div>
              </Link>
            )
          })}
        </div>

        <div className="mt-8 sm:mt-12 text-center text-xs sm:text-sm text-slate-400">
          <p>每日自动抓取 · AI 智能总结</p>
        </div>
      </div>
    </div>
  )
}
