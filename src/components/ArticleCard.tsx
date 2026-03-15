interface Article {
  id: string
  sourceId: string
  sourceName: string
  sourceUrl?: string | null
  title: string
  content?: string | null
  summary?: string | null
  url?: string | null
  author?: string | null
  publishedAt?: Date | null
  fetchedAt: Date
  isRead: boolean
  isFavorite: boolean
}

interface ArticleCardProps {
  article: Article
}

export default function ArticleCard({ article }: ArticleCardProps) {
  const timeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000)
    
    if (seconds < 60) return '刚刚'
    if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟前`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小时前`
    return `${Math.floor(seconds / 86400)} 天前`
  }

  return (
    <article className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-primary-50 text-primary-700">
          {article.sourceName}
        </span>
        <span className="text-xs text-gray-400">
          {timeAgo(article.fetchedAt)}
        </span>
      </div>
      
      <h3 className="text-lg font-medium text-gray-900 mb-2 line-clamp-2">
        {article.url ? (
          <a 
            href={article.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="hover:text-primary-600 transition-colors"
          >
            {article.title}
          </a>
        ) : (
          article.title
        )}
      </h3>

      {article.summary && (
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
          {article.summary}
        </p>
      )}

      {article.content && !article.summary && (
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
          {article.content.slice(0, 150)}...
        </p>
      )}

      <div className="flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center space-x-2">
          {article.author && (
            <span className="flex items-center">
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              {article.author}
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {article.isRead && (
            <span className="text-green-500">已读</span>
          )}
          {article.isFavorite && (
            <span className="text-yellow-500">★</span>
          )}
        </div>
      </div>

      {article.sourceUrl && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <a 
            href={article.sourceUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center"
          >
            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            来源: {new URL(article.sourceUrl).hostname}
          </a>
        </div>
      )}
    </article>
  )
}
