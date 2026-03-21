'use client'

import { useState, useEffect } from 'react'
import { dayDataApi, type DayData, type CategoryData } from '@/lib/api'
import ArticleCard from '@/components/ArticleCard'
import ReactMarkdown from 'react-markdown'

const categoryEmoji: Record<string, string> = {
  'AI': '🤖',
  '游戏': '🎮',
  '技术': '💻',
  '科技': '💻',
  '开发者': '👨‍💻',
  '财经': '💰',
  '新闻': '📰',
  '国际': '🌍',
  '未分类': '📄'
}

export default function HomePage() {
  const [dayData, setDayData] = useState<DayData | null>(null)
  const [categoryData, setCategoryData] = useState<CategoryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [availableDates, setAvailableDates] = useState<string[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedDate, setSelectedDate] = useState<string>('')

  useEffect(() => {
    loadInitialData()
  }, [])

  useEffect(() => {
    if (selectedDate) {
      loadData()
    }
  }, [selectedDate, selectedCategory])

  const loadInitialData = async () => {
    const dates = await dayDataApi.getAvailableDates()
    setAvailableDates(dates)
    
    if (dates.length > 0) {
      setSelectedDate(dates[0])
    }
  }

  const loadData = async () => {
    setLoading(true)
    try {
      if (selectedCategory === 'all') {
        const data = await dayDataApi.getDayData(selectedDate)
        setDayData(data)
        setCategoryData(null)
        
        if (data) {
          const cats = dayDataApi.getCategoriesFromDayData(data)
          setCategories(cats)
        } else {
          setCategories([])
        }
      } else {
        const data = await dayDataApi.getCategoryData(selectedCategory, selectedDate)
        setCategoryData(data)
        setDayData(null)
        
        if (dayData) {
          const cats = dayDataApi.getCategoriesFromDayData(dayData)
          setCategories(cats)
        }
      }
    } catch (error) {
      console.error('加载数据失败:', error)
      setDayData(null)
      setCategoryData(null)
    } finally {
      setLoading(false)
    }
  }

  const formatDateDisplay = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    
    if (dateStr === todayStr) {
      return `今天 (${month}月${day}日 ${weekdays[date.getDay()]})`
    }
    return `${month}月${day}日 ${weekdays[date.getDay()]}`
  }

  const getGroupedArticles = () => {
    const data = dayData || categoryData
    if (!data) return {}
    
    if (categoryData) {
      return { [categoryData.category]: categoryData.articles }
    }
    
    const grouped: Record<string, any[]> = {}
    
    data.articles.forEach(article => {
      const source = data.sources.find(s => s.id === article.sourceId)
      const category = source?.category || '未分类'
      
      if (!grouped[category]) {
        grouped[category] = []
      }
      grouped[category].push(article)
    })
    
    return grouped
  }

  const getArticles = () => {
    return (dayData || categoryData)?.articles || []
  }

  const getSummary = () => {
    return (dayData || categoryData)?.summary || ''
  }

  const groupedArticles = getGroupedArticles()
  const articles = getArticles()
  const summary = getSummary()

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
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 pr-8"
              style={{ minWidth: '100px' }}
            >
              <option value="all">全部分类</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {categoryEmoji[cat] || '📄'} {cat}
                </option>
              ))}
            </select>
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
            共 {articles.length} 篇
          </span>
        </div>

        {summary && (
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
                  {summary}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        )}

        {Object.keys(groupedArticles).length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">📭</div>
            <h3 className="text-base font-medium text-gray-300 mb-2">暂无内容</h3>
            <p className="text-sm text-gray-500">该分类或日期还没有抓取信息</p>
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
