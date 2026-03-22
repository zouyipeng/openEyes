'use client'

import ReactMarkdown from 'react-markdown'

interface LKMLMessage {
  id: string
  url: string
  title: string
  author: string
  date: string
  content: string
  isReply: boolean
}

interface LKMLPatch {
  id: string
  title: string
  url: string
  author: string
  date: string
  content: string
  subsystem: string
  type: string
  highlight: boolean
  summary: string
  messages: LKMLMessage[]
  replyCount: number
}

interface Article {
  id: string
  sourceId: string
  sourceName: string
  sourceUrl?: string
  title: string
  content?: string
  summary?: string
  url?: string
  author?: string
  publishedAt?: string
  fetchedAt: string
  highlight?: boolean
  patchData?: LKMLPatch
}

interface LKMLPatchCardProps {
  article: Article
}

const typeColor: Record<string, string> = {
  'feature': 'bg-green-900 text-green-300',
  'bugfix': 'bg-red-900 text-red-300',
  'other': 'bg-gray-700 text-gray-300'
}

const typeLabel: Record<string, string> = {
  'feature': 'Feature',
  'bugfix': 'Bugfix',
  'other': 'Other'
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

export default function LKMLPatchCard({ article }: LKMLPatchCardProps) {
  const patch = article.patchData
  
  if (!patch) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-colors">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-medium text-gray-100 mb-2 leading-relaxed">
            {article.title}
          </h3>
          <p className="text-sm text-gray-400 mt-2 mb-3">{article.summary}</p>
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              {article.author && (
                <>
                  <span className="text-gray-500">👤</span>
                  <span className="text-gray-400">{article.author}</span>
                </>
              )}
            </div>
            {article.url && (
              <a 
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 transition-colors"
              >
                查看原文 →
              </a>
            )}
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className={`bg-gray-800 rounded-lg p-4 border transition-colors ${
      patch.highlight 
        ? 'border-yellow-600/50 hover:border-yellow-500/50' 
        : 'border-gray-700 hover:border-gray-600'
    }`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <span className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${typeColor[patch.type] || typeColor.other}`}>
            {typeLabel[patch.type] || patch.type}
          </span>
          <h3 className="text-base font-medium text-gray-100 leading-relaxed truncate">
            {patch.title}
          </h3>
        </div>
        
        <div className="text-sm text-gray-400 leading-relaxed mb-3 prose prose-invert prose-sm max-w-none">
          <ReactMarkdown
            components={{
              p: ({ children }) => (
                <p className="text-sm text-gray-400 my-0 leading-relaxed">{children}</p>
              ),
              strong: ({ children }) => (
                <strong className="text-gray-300 font-medium">{children}</strong>
              ),
            }}
          >
            {patch.summary}
          </ReactMarkdown>
        </div>
        
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="text-gray-500">👤</span>
            <span className="text-gray-400">{patch.author}</span>
            {patch.date && (
              <>
                <span className="text-gray-600">·</span>
                <span className="text-gray-500">{formatDate(patch.date)}</span>
              </>
            )}
          </div>
          <a 
            href={patch.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 transition-colors"
          >
            查看原文 →
          </a>
        </div>
      </div>
    </div>
  )
}
