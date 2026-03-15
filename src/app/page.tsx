import prisma from '@/lib/db'
import { generateDailySummary } from '@/lib/ai'
import ArticleCard from '@/components/ArticleCard'
import DailySummaryCard from '@/components/DailySummaryCard'

async function getTodayArticles() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const articles = await prisma.article.findMany({
    where: {
      fetchedAt: {
        gte: today
      }
    },
    orderBy: {
      fetchedAt: 'desc'
    },
    take: 50
  })
  
  return articles
}

async function getSources() {
  return prisma.source.findMany({
    where: { active: true },
    orderBy: { name: 'asc' }
  })
}

export default async function HomePage() {
  const [articles, sources] = await Promise.all([
    getTodayArticles(),
    getSources()
  ])

  const summary = articles.length > 0 
    ? await generateDailySummary(articles)
    : '今日暂无新内容'

  const groupedArticles = articles.reduce((acc, article) => {
    const sourceName = article.sourceName
    if (!acc[sourceName]) {
      acc[sourceName] = []
    }
    acc[sourceName].push(article)
    return acc
  }, {} as Record<string, typeof articles>)

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">今日信息</h1>
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
            共 {articles.length} 篇文章 · {sources.length} 个信息源
          </span>
          <form action="/api/fetch" method="POST">
            <button 
              type="submit"
              className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
            >
              立即抓取
            </button>
          </form>
        </div>
      </div>

      <DailySummaryCard summary={summary} />

      {Object.keys(groupedArticles).length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">📭</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">今日暂无新内容</h3>
          <p className="text-gray-500 mb-4">请添加信息源或手动触发抓取</p>
          <a 
            href="/sources" 
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            管理信息源 →
          </a>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedArticles).map(([sourceName, sourceArticles]) => (
            <section key={sourceName}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                  <span className="w-2 h-2 bg-primary-500 rounded-full mr-2"></span>
                  {sourceName}
                </h2>
                <span className="text-sm text-gray-500">
                  {sourceArticles.length} 篇
                </span>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {sourceArticles.map((article) => (
                  <ArticleCard key={article.id} article={article} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
