'use client'

import { memo } from 'react'
import { lkmlAnchorId } from '@/lib/lkmlAnchor'

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
  isJumpHighlighted?: boolean
}

const typeColor: Record<string, string> = {
  feature: 'bg-emerald-100 text-emerald-700',
  bugfix: 'bg-rose-100 text-rose-700',
  other: 'bg-slate-100 text-slate-700',
}

const typeLabel: Record<string, string> = {
  feature: 'Feature',
  bugfix: 'Bugfix',
  other: 'Other',
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    return date.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

function LKMLPatchCardInner({ article, isJumpHighlighted = false }: LKMLPatchCardProps) {
  const patch = article.patchData
  const anchorId = lkmlAnchorId(article.id)

  if (!patch) {
    return (
      <div
        id={anchorId}
        className={`scroll-mt-20 sm:scroll-mt-24 bg-white rounded-lg p-2.5 border hover:border-slate-300 transition-all duration-300 ${
          isJumpHighlighted
            ? 'border-sky-400 ring-2 ring-sky-400/50 shadow-[0_0_0_1px_rgba(56,189,248,0.35)]'
            : 'border-slate-200'
        }`}
      >
        <div className="min-w-0 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-[12px] leading-5">
          <h3 className="min-w-0 flex-1 text-slate-900 font-medium">
            {article.url ? (
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-blue-600 transition-colors block truncate"
                title={article.title}
              >
                {article.title}
              </a>
            ) : (
              <span className="block truncate" title={article.title}>
                {article.title}
              </span>
            )}
          </h3>
          <div className="flex items-center gap-2 text-slate-400 shrink-0">
            {article.author && <span className="text-slate-500 truncate max-w-[100px] sm:max-w-[140px]">{article.author}</span>}
            {article.fetchedAt && <span>{formatDate(article.fetchedAt)}</span>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      id={anchorId}
      className={`scroll-mt-20 sm:scroll-mt-24 bg-white rounded-lg p-2.5 border transition-all duration-300 ${
        isJumpHighlighted
          ? 'border-sky-400 ring-2 ring-sky-400/50 shadow-[0_0_0_1px_rgba(56,189,248,0.35)]'
          : patch.highlight
            ? 'border-amber-400/60 hover:border-amber-500/70'
            : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      <div className="min-w-0 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-[12px] leading-5">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span
            className={`px-1.5 py-0.5 rounded text-[11px] leading-none font-medium flex-shrink-0 ${typeColor[patch.type] || typeColor.other}`}
          >
            {typeLabel[patch.type] || patch.type}
          </span>
          <h3 className="min-w-0 flex-1 text-slate-900 font-medium">
            <a
              href={patch.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-600 transition-colors block truncate"
              title={patch.title}
            >
              {patch.title}
            </a>
          </h3>
        </div>
        <div className="flex items-center gap-2 text-slate-400 shrink-0 pl-6 sm:pl-0">
          <span className="text-slate-500 truncate max-w-[80px] sm:max-w-[140px]">{patch.author}</span>
          {patch.date && <span className="hidden sm:inline">{formatDate(patch.date)}</span>}
        </div>
      </div>
    </div>
  )
}

export default memo(LKMLPatchCardInner)
