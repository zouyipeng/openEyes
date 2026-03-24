'use client'

import { useState, useEffect, useMemo, type ReactNode } from 'react'
import { dayDataApi, type DayData } from '@/lib/api'
import LKMLPatchCard from '@/components/LKMLPatchCard'
import PenguinIcon from '@/components/PenguinIcon'
import ReactMarkdown from 'react-markdown'
import { lkmlAnchorId } from '@/lib/lkmlAnchor'

const TYPE_ORDER: Record<string, number> = { feature: 0, bugfix: 1, other: 2 }
const LKML_COLLAPSE_DEFAULT = 3
const TYPE_LABEL: Record<string, string> = {
  feature: 'Feature',
  bugfix: 'Bugfix',
  other: 'Other',
}

function sortLinuxKernelArticles(articles: any[]) {
  return [...articles].sort((a, b) => {
    const ta = TYPE_ORDER[a.patchData?.type ?? 'other'] ?? 3
    const tb = TYPE_ORDER[b.patchData?.type ?? 'other'] ?? 3
    if (ta !== tb) return ta - tb
    if (a.highlight && !b.highlight) return -1
    if (!a.highlight && b.highlight) return 1
    return new Date(b.fetchedAt).getTime() - new Date(a.fetchedAt).getTime()
  })
}

function LkmlTypeStatsBar({ articles }: { articles: any[] }) {
  const stats = useMemo(() => {
    let feature = 0
    let bugfix = 0
    let other = 0
    let minTs = Number.POSITIVE_INFINITY
    let maxTs = Number.NEGATIVE_INFINITY

    const pickTs = (a: any) => {
      const raw = a?.patchData?.date || a?.fetchedAt
      if (!raw) return Number.NaN
      const ts = new Date(raw).getTime()
      return Number.isNaN(ts) ? Number.NaN : ts
    }

    for (const a of articles) {
      const t = a.patchData?.type
      if (t === 'feature') feature++
      else if (t === 'bugfix') bugfix++
      else other++

      const ts = pickTs(a)
      if (!Number.isNaN(ts)) {
        if (ts < minTs) minTs = ts
        if (ts > maxTs) maxTs = ts
      }
    }

    const formatDate = (ts: number) =>
      new Date(ts).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
        .replace(/\//g, '-')
        .replace(/\s/g, '')
    const dateRange =
      Number.isFinite(minTs) && Number.isFinite(maxTs)
        ? `${formatDate(minTs)} ~ ${formatDate(maxTs)}`
        : ''

    return { total: articles.length, feature, bugfix, other, dateRange }
  }, [articles])

  if (stats.total === 0) return null

  return (
    <div className="mb-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
      <span className="text-slate-500 mr-2">今日补丁</span>
      <span className="text-slate-900 font-medium">{stats.total}</span>
      <span className="text-slate-300 mx-2">·</span>
      <span className="text-emerald-600">Feature {stats.feature}</span>
      <span className="text-slate-300 mx-2">·</span>
      <span className="text-rose-600">Bugfix {stats.bugfix}</span>
      <span className="text-slate-300 mx-2">·</span>
      <span className="text-slate-500">Other {stats.other}</span>
      {stats.dateRange && (
        <>
          <span className="text-slate-300 mx-2">·</span>
          <span className="text-slate-500">{stats.dateRange}</span>
        </>
      )}
    </div>
  )
}

function LkmlGroupedList({
  articles,
  expanded,
  onToggle,
  activeAnchorId,
}: {
  articles: any[]
  expanded: Record<string, boolean>
  onToggle: (type: string) => void
  activeAnchorId: string | null
}) {
  const grouped = useMemo(() => {
    const groups: Record<string, any[]> = { feature: [], bugfix: [], other: [] }
    for (const a of articles) {
      const t = a.patchData?.type
      if (t === 'feature' || t === 'bugfix') groups[t].push(a)
      else groups.other.push(a)
    }
    return groups
  }, [articles])

  return (
    <div className="space-y-3">
      {(Object.keys(TYPE_ORDER) as Array<'feature' | 'bugfix' | 'other'>).map(type => {
        const list = grouped[type]
        if (!list || list.length === 0) return null
        const isExpanded = !!expanded[type]
        const visible = list.slice(0, LKML_COLLAPSE_DEFAULT)
        const hiddenCount = Math.max(0, list.length - LKML_COLLAPSE_DEFAULT)

        return (
          <div key={type} className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs text-slate-700 tracking-wide">
                <span className="font-medium">{TYPE_LABEL[type]}</span>
                <span className="text-slate-400 ml-1">({list.length})</span>
              </div>
              {list.length > LKML_COLLAPSE_DEFAULT && isExpanded && (
                <button
                  onClick={() => onToggle(type)}
                  className="rounded-md px-2 py-0.5 text-xs text-sky-600 hover:text-sky-700 hover:bg-sky-50 transition-colors"
                >
                  收起
                </button>
              )}
            </div>
            <div className="space-y-1.5">
              {visible.map(article => (
                <div key={article.id} className="lkml-fade-in">
                  <LKMLPatchCard
                    article={article}
                    isJumpHighlighted={activeAnchorId === lkmlAnchorId(article.id)}
                  />
                </div>
              ))}
              {list.length > LKML_COLLAPSE_DEFAULT && (
                <div className={`lkml-collapse-content ${isExpanded ? 'is-open' : ''}`}>
                  <div className="space-y-1.5">
                    {list.slice(LKML_COLLAPSE_DEFAULT).map(article => (
                      <div key={article.id} className="lkml-fade-in">
                        <LKMLPatchCard
                          article={article}
                          isJumpHighlighted={activeAnchorId === lkmlAnchorId(article.id)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {list.length > LKML_COLLAPSE_DEFAULT && !isExpanded && (
                <button
                  onClick={() => onToggle(type)}
                  className="w-full rounded-lg border border-dashed border-slate-300 py-1 text-center text-xs tracking-wide text-slate-500 hover:text-sky-600 hover:border-sky-300 transition-colors"
                  title={`展开其余 ${hiddenCount} 条`}
                >
                  ...
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

interface NewsDashboardProps {
  initialDate?: string
}

export default function NewsDashboard({ initialDate }: NewsDashboardProps) {
  const [dayData, setDayData] = useState<DayData | null>(null)
  const [loading, setLoading] = useState(true)
  const [availableDates, setAvailableDates] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState<string>(initialDate || '')
  const [expandedTypeMap, setExpandedTypeMap] = useState<Record<string, boolean>>({})
  const [activeAnchorId, setActiveAnchorId] = useState<string | null>(null)

  useEffect(() => {
    loadInitialData()
  }, [])

  useEffect(() => {
    if (selectedDate) {
      loadData(selectedDate)
    }
  }, [selectedDate])

  useEffect(() => {
    setExpandedTypeMap({})
    setActiveAnchorId(null)
  }, [selectedDate])

  const loadInitialData = async () => {
    const dates = await dayDataApi.getAvailableDates()
    setAvailableDates(dates)
    
    if (dates.length > 0) {
      setSelectedDate(dates[0])
    }
  }

  const loadData = async (dateStr: string) => {
    setLoading(true)
    try {
      const data = await dayDataApi.getDataByDate(dateStr)
      setDayData(data)
    } catch (error) {
      console.error('加载数据失败:', error)
      setDayData(null)
    } finally {
      setLoading(false)
    }
  }

  const articles = useMemo(() => {
    if (!dayData?.articles) return []
    return sortLinuxKernelArticles(dayData.articles)
  }, [dayData])

  const summary = dayData?.summary || ''

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

  const handlePatchAnchorJump = (anchorId: string) => {
    const id = decodeURIComponent(anchorId)
    const target = articles.find(a => lkmlAnchorId(a.id) === id)
    const t = target?.patchData?.type
    if (t === 'feature' || t === 'bugfix' || t === 'other') {
      setExpandedTypeMap(prev => ({ ...prev, [t]: true }))
    }

    setActiveAnchorId(id)
    window.setTimeout(() => setActiveAnchorId(prev => (prev === id ? null : prev)), 2200)
    window.setTimeout(() => {
      const el = document.getElementById(id)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 260)
  }

  const categorySummaryComponents = {
    h1: ({ children }: { children?: ReactNode }) => (
      <h1 className="text-lg font-bold text-slate-900 mt-0 mb-3">{children}</h1>
    ),
    h2: ({ children }: { children?: ReactNode }) => (
      <h2 className="text-base font-semibold text-slate-800 mt-0 mb-2">{children}</h2>
    ),
    h3: ({ children }: { children?: ReactNode }) => (
      <h3 className="text-sm font-bold text-sky-700 mt-4 mb-2 first:mt-0 border-l-2 border-sky-500/70 pl-2.5 [&_strong]:text-sky-800 [&_strong]:font-bold">
        {children}
      </h3>
    ),
    p: ({ children }: { children?: ReactNode }) => (
      <p className="text-sm text-slate-600 my-1 leading-relaxed">{children}</p>
    ),
    ul: ({ children }: { children?: ReactNode }) => (
      <ul className="text-sm text-slate-600 my-1 pl-4 list-disc">{children}</ul>
    ),
    ol: ({ children }: { children?: ReactNode }) => (
      <ol className="text-sm text-slate-600 my-1 pl-4 list-decimal">{children}</ol>
    ),
    li: ({ children }: { children?: ReactNode }) => (
      <li className="text-sm text-slate-600 my-0.5">{children}</li>
    ),
    strong: ({ children }: { children?: ReactNode }) => (
      <strong className="text-slate-800 font-medium">{children}</strong>
    ),
    blockquote: ({ children }: { children?: ReactNode }) => (
      <blockquote className="border-l-2 border-slate-300 pl-3 text-slate-600 my-2">{children}</blockquote>
    ),
    code: ({ children }: { children?: ReactNode }) => (
      <code className="bg-slate-100 px-1 py-0.5 rounded text-xs text-slate-700">{children}</code>
    ),
    pre: ({ children }: { children?: ReactNode }) => (
      <pre className="bg-slate-100 p-3 rounded overflow-x-auto text-xs my-2 text-slate-700">{children}</pre>
    ),
    hr: () => <hr className="border-slate-200 my-3" />,
    a: ({ href, children }: { href?: string; children?: ReactNode }) => {
      if (href?.startsWith('#')) {
        const id = href.slice(1)
        const isLkmlPatchAnchor = id.startsWith('lkml-')
        const labelText =
          typeof children === 'string'
            ? children
            : Array.isArray(children)
              ? children.map(c => (typeof c === 'string' ? c : '')).join('')
              : '跳转到补丁'
        return (
          <a
            href={href}
            className={
              isLkmlPatchAnchor
                ? 'inline-flex items-center justify-center rounded px-1.5 text-sky-600 hover:text-sky-700 transition-colors'
                : 'text-sky-600 hover:text-sky-700 underline underline-offset-2'
            }
            title={labelText || '跳转到补丁'}
            aria-label={labelText || '跳转到补丁'}
            onClick={e => {
              e.preventDefault()
              if (isLkmlPatchAnchor) {
                handlePatchAnchorJump(id)
              } else {
                const el = document.getElementById(id) || document.getElementById(decodeURIComponent(id))
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
              }
            }}
          >
            {isLkmlPatchAnchor ? '🔗' : children}
          </a>
        )
      }
      const external = href?.startsWith('http')
      return (
        <a
          href={href}
          className="text-sky-600 hover:text-sky-700 underline underline-offset-2"
          {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          {children}
        </a>
      )
    },
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-slate-500">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {availableDates.length > 0 && (
              <select
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-700 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 pr-8"
                style={{ minWidth: '140px' }}
              >
                {availableDates.map(date => (
                  <option key={date} value={date}>
                    {formatDateDisplay(date)}
                  </option>
                ))}
              </select>
            )}
            <h1 className="flex items-center gap-2 text-lg font-semibold tracking-wide text-slate-900">
              <PenguinIcon className="h-[18px] w-[18px] shrink-0" />
              <span>Linux Kernel动态</span>
            </h1>
          </div>
          <span className="text-sm text-slate-500">共 {articles.length} 篇</span>
        </div>

        {summary && (
          <div className="bg-white rounded-xl p-4 mb-6 border border-slate-200 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="text-2xl flex-shrink-0">💡</span>
              <div className="flex-1 prose prose-sm max-w-none">
                <ReactMarkdown components={categorySummaryComponents}>{summary}</ReactMarkdown>
              </div>
            </div>
          </div>
        )}

        {articles.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">📭</div>
            <h3 className="text-base font-medium text-slate-700 mb-2">暂无内容</h3>
            <p className="text-sm text-slate-500">还没有抓取到Linux kernel补丁</p>
          </div>
        ) : (
          <>
            <LkmlTypeStatsBar articles={articles} />
            <LkmlGroupedList
              articles={articles}
              expanded={expandedTypeMap}
              activeAnchorId={activeAnchorId}
              onToggle={(type) =>
                setExpandedTypeMap(prev => ({ ...prev, [type]: !prev[type] }))
              }
            />
          </>
        )}
      </div>
    </div>
  )
}
