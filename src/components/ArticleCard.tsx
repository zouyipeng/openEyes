import ReactMarkdown from 'react-markdown'

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

export default function ArticleCard({ article }: ArticleCardProps) {
  const displaySummary = article.summary || '暂无摘要'
  
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-colors">
      <div className="flex-1 min-w-0">
        <h3 className="text-base font-medium text-gray-100 mb-2 leading-relaxed">
          {article.url ? (
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-300 transition-colors"
            >
              {article.title}
            </a>
          ) : (
            article.title
          )}
        </h3>
        <div className="text-sm text-gray-400 leading-relaxed mb-3 prose prose-invert prose-sm max-w-none">
          <ReactMarkdown
            components={{
              p: ({ children }) => (
                <p className="text-sm text-gray-400 my-0 leading-relaxed">{children}</p>
              ),
              strong: ({ children }) => (
                <strong className="text-gray-300 font-medium">{children}</strong>
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
            }}
          >
            {displaySummary}
          </ReactMarkdown>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-500">📌</span>
          <span className="text-gray-500">{article.sourceName}</span>
        </div>
      </div>
    </div>
  )
}
