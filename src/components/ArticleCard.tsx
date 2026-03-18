interface Article {
  id: string
  sourceId: string
  sourceName: string
  sourceUrl?: string | null
  title: string
  summary?: string | null
  url?: string | null
  fetchedAt: string
}

interface ArticleCardProps {
  article: Article
}

const categoryEmoji: Record<string, string> = {
  'AI': '🤖',
  '科技': '💻',
  '开发者': '👨‍💻',
  '财经': '💰',
  '新闻': '📰',
  '国际': '🌍',
  '未分类': '📄'
}

export default function ArticleCard({ article }: ArticleCardProps) {
  const displaySummary = article.summary || '暂无摘要'
  
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-colors">
      <div className="flex items-start gap-3">
        <span className="text-2xl flex-shrink-0">
          {categoryEmoji[article.sourceName] || '📄'}
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-medium text-gray-100 mb-2 leading-relaxed">
            {article.title}
          </h3>
          <p className="text-sm text-gray-400 leading-relaxed mb-3">
            {displaySummary}
          </p>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-500">📌</span>
            {article.url ? (
              <a 
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 transition-colors"
              >
                {article.sourceName}
              </a>
            ) : (
              <span className="text-gray-500">{article.sourceName}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
