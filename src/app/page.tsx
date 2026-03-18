'use client'

import { useState, useEffect } from 'react'
import { dayDataApi, type DayData } from '@/lib/api'
import ArticleCard from '@/components/ArticleCard'
import ReactMarkdown from 'react-markdown'

const categoryEmoji: Record<string, string> = {
  'AI': '🤖',
  '科技': '💻',
  '开发者': '👨‍💻',
  '财经': '💰',
  '新闻': '📰',
  '国际': '🌍',
  '未分类': '📄'
}

export default function HomePage() {
  const [dayData, setDayData] = useState<DayData | null>(null)
  const [loading, setLoading] = useState(true)
  const [availableDates, setAvailableDates] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState<string>('')

  useEffect(() => {
    loadAvailableDates()
  }, [])

  useEffect(() => {
    if (selectedDate) {
      loadData(selectedDate)
    }
  }, [selectedDate])

  const getTodayString = () => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const loadAvailableDates = async () => {
    const today = getTodayString()
    const dates: string[] = []
    
    for (let i = 0; i < 30; i++) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const dateStr = `${year}-${month}-${day}`
      
      try {
        const response = await fetch(`/data/${dateStr}.json`)
        if (response.ok) {
          dates.push(dateStr)
        }
      } catch {
        // 文件不存在，跳过
      }
    }
    
    if (dates.length === 0) {
      dates.push(today)
    }
    
    setAvailableDates(dates)
    setSelectedDate(dates[0])
  }

  const loadData = async (dateStr: string) => {
    setLoading(true)
    try {
      const data = await dayDataApi.getDayData(dateStr)
      setDayData(data)
    } catch (error) {
      console.error('加载数据失败:', error)
      setDayData(null)
    } finally {
      setLoading(false)
    }
  }

  const formatDateDisplay = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    const today = getTodayString()
    
    if (dateStr === today) {
      return `今天 (${month}月${day}日 ${weekdays[date.getDay()]})`
    }
    return `${month}月${day}日 ${weekdays[date.getDay()]}`
  }

  const getGroupedArticles = () => {
    if (!dayData) return {}
    
    const grouped: Record<string, any[]> = {}
    
    dayData.articles.forEach(article => {
      const source = dayData.sources.find(s => s.id === article.sourceId)
      const category = source?.category || '未分类'
      
      if (!grouped[category]) {
        grouped[category] = []
      }
      grouped[category].push(article)
    })
    
    return grouped
  }

  const groupedArticles = getGroupedArticles()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-gray-400">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 pr-8"
              style={{ minWidth: '140px' }}
            >
              {availableDates.map(date => (
                <option key={date} value={date}>
                  {formatDateDisplay(date)}
                </option>
              ))}
            </select>
            <h1 className="text-lg font-bold text-gray-100">📰 今日信息</h1>
          </div>
          <span className="text-sm text-gray-400">
            共 {dayData?.articles.length || 0} 篇
          </span>
        </div>

        {dayData?.summary && (
          <div className="bg-gray-800 rounded-lg p-4 mb-6 border border-gray-700">
            <div className="flex items-start gap-3">
              <span className="text-2xl flex-shrink-0">💡</span>
              <div className="flex-1 prose prose-invert prose-sm max-w-none">
                <ReactMarkdown
                  components={{
                    h1: ({ children }) => (
                      <h1 className="text-lg font-bold text-gray-100 mt-0 mb-3">{children}</h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="text-base font-semibold text-gray-200 mt-0 mb-2">{children}</h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="text-sm font-semibold text-gray-300 mt-3 mb-1">{children}</h3>
                    ),
                    p: ({ children }) => (
                      <p className="text-sm text-gray-400 my-1 leading-relaxed">{children}</p>
                    ),
                    ul: ({ children }) => (
                      <ul className="text-sm text-gray-400 my-1 pl-4 list-disc">{children}</ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="text-sm text-gray-400 my-1 pl-4 list-decimal">{children}</ol>
                    ),
                    li: ({ children }) => (
                      <li className="text-sm text-gray-400 my-0.5">{children}</li>
                    ),
                    strong: ({ children }) => (
                      <strong className="text-gray-300 font-medium">{children}</strong>
                    ),
                    hr: () => (
                      <hr className="border-gray-700 my-3" />
                    ),
                  }}
                >
                  {dayData.summary}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        )}

        {Object.keys(groupedArticles).length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">📭</div>
            <h3 className="text-base font-medium text-gray-300 mb-2">暂无内容</h3>
            <p className="text-sm text-gray-500">该日期还没有抓取信息</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedArticles).map(([category, categoryArticles]) => (
              <div key={category}>
                <h2 className="text-base font-semibold text-gray-300 flex items-center gap-2 mb-3">
                  <span>{categoryEmoji[category] || '📄'}</span>
                  <span>{category}</span>
                  <span className="text-xs text-gray-500 font-normal">({categoryArticles.length})</span>
                </h2>
                <div className="space-y-3">
                  {categoryArticles.map((article: any) => (
                    <ArticleCard key={article.id} article={article} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
