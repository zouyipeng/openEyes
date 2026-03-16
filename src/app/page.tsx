'use client'

import { useState, useEffect } from 'react'
import { articleApi, summaryApi, sourceApi } from '@/lib/api'
import ArticleCard from '@/components/ArticleCard'
import DailySummaryCard from '@/components/DailySummaryCard'

export default function HomePage() {
  const [articles, setArticles] = useState<any[]>([])
  const [sources, setSources] = useState<any[]>([])
  const [sourcesByCategory, setSourcesByCategory] = useState<Record<string, any[]>>({})
  const [summary, setSummary] = useState('')
  const [categorySummaries, setCategorySummaries] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      // 并行获取数据
      const [articlesData, sourcesData, sourcesByCategoryData, summaryData] = await Promise.all([
        articleApi.getTodayArticles(),
        sourceApi.getSources(),
        sourceApi.getSourcesByCategory(),
        summaryApi.getDailySummary()
      ])
      
      const activeSources = sourcesData.filter(source => source.active)
      
      setArticles(articlesData)
      setSources(activeSources)
      setSourcesByCategory(sourcesByCategoryData)
      setSummary(summaryData.summary)
      
      // 生成类别摘要
      generateCategorySummaries(articlesData, activeSources)
    } catch (error) {
      console.error('加载数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateCategorySummaries = (articlesData: any[], sourcesData: any[]) => {
    // 按类别分组文章
    const articlesByCategory: Record<string, any[]> = {}
    
    articlesData.forEach(article => {
      // 查找文章对应的信息源，获取类别
      const source = sourcesData.find(s => s.id === article.sourceId)
      const category = source?.category || '未分类'
      
      if (!articlesByCategory[category]) {
        articlesByCategory[category] = []
      }
      articlesByCategory[category].push(article)
    })
    
    // 为每个类别生成摘要（这里使用简单的摘要生成，实际项目中可以调用后端 API）
    const summaries: Record<string, string> = {}
    Object.entries(articlesByCategory).forEach(([category, categoryArticles]) => {
      if (categoryArticles.length > 0) {
        const titles = categoryArticles.map((article: any) => article.title).join('、')
        summaries[category] = `${category}类别今日有${categoryArticles.length}篇文章，主要内容包括：${titles.substring(0, 100)}...`
      }
    })
    
    setCategorySummaries(summaries)
  }

  const handleFetch = async () => {
    try {
      const response = await fetch('/api/fetch', { method: 'POST' })
      const data = await response.json()
      if (data.success) {
        alert(data.message)
        // 重新加载数据
        await loadData()
      } else {
        alert('抓取失败')
      }
    } catch (error) {
      console.error('抓取失败:', error)
      alert('抓取失败')
    }
  }

  // 按类别和信息源分组文章
  const getGroupedArticles = () => {
    const grouped: Record<string, Record<string, any[]>> = {}
    
    articles.forEach(article => {
      // 查找文章对应的信息源，获取类别
      const source = sources.find(s => s.id === article.sourceId)
      const category = source?.category || '未分类'
      const sourceName = article.sourceName
      
      if (!grouped[category]) {
        grouped[category] = {}
      }
      if (!grouped[category][sourceName]) {
        grouped[category][sourceName] = []
      }
      grouped[category][sourceName].push(article)
    })
    
    return grouped
  }

  const groupedArticles = getGroupedArticles()

  if (loading) {
    return (
      <div className="text-center py-12">
        <p>加载中...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* 页面标题 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">今日信息</h1>
          <p className="text-gray-500 mt-1">
            {new Date().toLocaleDateString('zh-CN', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              weekday: 'long'
            })}
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-500">
            共 {articles.length} 篇文章
          </span>
        </div>
      </div>

      {/* 每日摘要 */}
      <DailySummaryCard summary={summary} />

      {/* 文章列表 */}
      {Object.keys(groupedArticles).length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">📭</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">今日暂无新内容</h3>
          <p className="text-gray-500 mb-4">请手动触发抓取</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedArticles).map(([category, sourcesInCategory]) => (
            <div key={category}>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center mb-4">
                <span className="w-3 h-3 bg-primary-500 rounded-full mr-3"></span>
                {category}
              </h2>
              
              <div className="space-y-4">
                {Object.entries(sourcesInCategory).map(([sourceName, sourceArticles]) => (
                  <div key={sourceName}>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-800 flex items-center mb-3">
                      <span className="w-2 h-2 bg-primary-400 rounded-full mr-2"></span>
                      {sourceName}
                    </h3>
                    <div className="space-y-3">
                      {sourceArticles.map((article: any) => (
                        <ArticleCard key={article.id} article={article} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
