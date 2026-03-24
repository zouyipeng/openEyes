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
    <div className="bg-white rounded-xl p-4 border border-slate-200 hover:border-slate-300 shadow-sm transition-colors">
      <div className="flex-1 min-w-0">
        <h3 className="text-base font-medium text-slate-900 mb-2 leading-relaxed">
          {article.url ? (
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-600 transition-colors"
            >
              {article.title}
            </a>
          ) : (
            article.title
          )}
        </h3>
        <div className="text-sm text-slate-600 leading-relaxed mb-3 prose prose-sm max-w-none">
          <ReactMarkdown
            components={{
              p: ({ children }) => (
                <p className="text-sm text-slate-600 my-0 leading-relaxed">{children}</p>
              ),
              strong: ({ children }) => (
                <strong className="text-slate-800 font-medium">{children}</strong>
              ),
              ul: ({ children }) => (
                <ul className="text-sm text-slate-600 my-1 pl-4 list-disc">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="text-sm text-slate-600 my-1 pl-4 list-decimal">{children}</ol>
              ),
              li: ({ children }) => (
                <li className="text-sm text-slate-600 my-0.5">{children}</li>
              ),
            }}
          >
            {displaySummary}
          </ReactMarkdown>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">📌</span>
          <span className="text-slate-500">{article.sourceName}</span>
        </div>
      </div>
    </div>
  )
}
