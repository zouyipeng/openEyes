'use client'

import { useState, useEffect, useMemo, type ReactNode } from 'react'
import { dayDataApi, type DayData, type CategoryData } from '@/lib/api'
import ArticleCard from '@/components/ArticleCard'
import LKMLPatchCard from '@/components/LKMLPatchCard'
import PenguinIcon from '@/components/PenguinIcon'
import ReactMarkdown from 'react-markdown'
import { lkmlAnchorId } from '@/lib/lkmlAnchor'

const categoryEmoji: Record<string, string> = {
  AI: '🤖',
  游戏: '🎮',
  技术: '💻',
  科技: '💻',
  开发者: '👨‍💻',
  财经: '💰',
  新闻: '📰',
  国际: '🌍',
  'linux kernel': '🐧',
  未分类: '📄',
}

const TYPE_ORDER: Record<string, number> = { feature: 0, bugfix: 1, other: 2 }
const LKML_COLLAPSE_DEFAULT = 3
const TYPE_LABEL: Record<string, string> = {
  feature: 'Feature',
  bugfix: 'Bugfix',
  other: 'Other',
}

function sortArticlesByHighlight(articles: any[]) {
  return [...articles].sort((a, b) => {
    if (a.highlight && !b.highlight) return -1
    if (!a.highlight && b.highlight) return 1
    return new Date(b.fetchedAt).getTime() - new Date(a.fetchedAt).getTime()
  })
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
    for (const a of articles) {
      const t = a.patchData?.type
      if (t === 'feature') feature++
      else if (t === 'bugfix') bugfix++
      else other++
    }
    return { total: articles.length, feature, bugfix, other }
  }, [articles])

  if (stats.total === 0) return null

  return (
    <div className="mb-3 rounded-xl border border-gray-800 bg-gray-900/70 px-3 py-2 text-sm text-gray-300">
      <span className="text-gray-500 mr-2">今日补丁</span>
      <span className="text-gray-200 font-medium">{stats.total}</span>
      <span className="text-gray-600 mx-2">·</span>
      <span className="text-green-400/90">Feature {stats.feature}</span>
      <span className="text-gray-600 mx-2">·</span>
      <span className="text-red-400/90">Bugfix {stats.bugfix}</span>
      <span className="text-gray-600 mx-2">·</span>
      <span className="text-gray-400">Other {stats.other}</span>
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
          <div key={type} className="rounded-xl border border-gray-800 bg-gray-900/50 p-2.5">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs text-gray-300 tracking-wide">
                <span className="font-medium">{TYPE_LABEL[type]}</span>
                <span className="text-gray-500 ml-1">({list.length})</span>
              </div>
              {list.length > LKML_COLLAPSE_DEFAULT && isExpanded && (
                <button
                  onClick={() => onToggle(type)}
                  className="rounded-md px-2 py-0.5 text-xs text-sky-300/90 hover:text-sky-200 hover:bg-sky-900/20 transition-colors"
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
                  className="w-full rounded-lg border border-dashed border-gray-700/90 py-1 text-center text-xs tracking-wide text-gray-500 hover:text-sky-300 hover:border-sky-700/70 transition-colors"
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
  initialCategory?: string
  initialDate?: string
}

export default function NewsDashboard({
  initialCategory = 'all',
  initialDate = '',
}: NewsDashboardProps) {
  const [dayData, setDayData] = useState<DayData | null>(null)
  const [categoryData, setCategoryData] = useState<CategoryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [availableDates, setAvailableDates] = useState<string[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory)
  const [selectedDate, setSelectedDate] = useState<string>(initialDate)
  const [expandedTypeMap, setExpandedTypeMap] = useState<Record<string, boolean>>({})
  const [activeAnchorId, setActiveAnchorId] = useState<string | null>(null)

  useEffect(() => {
    loadInitialData()
  }, [])

  useEffect(() => {
    if (selectedDate) {
      loadData()
    }
  }, [selectedDate, selectedCategory])

  useEffect(() => {
    setExpandedTypeMap({})
    setActiveAnchorId(null)
  }, [selectedDate, selectedCategory])

  const loadInitialData = async () => {
    const dates = await dayDataApi.getAvailableDates()
    setAvailableDates(dates)
    const urlDate =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('date') || ''
        : ''
    const preferredDate = initialDate || urlDate

    if (dates.length > 0) {
      if (preferredDate && dates.includes(preferredDate)) {
        setSelectedDate(preferredDate)
      } else {
        setSelectedDate(dates[0])
      }
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

        const fullDayData = await dayDataApi.getDayData(selectedDate)
        if (fullDayData) {
          const cats = dayDataApi.getCategoriesFromDayData(fullDayData)
          setCategories(cats)
        } else {
          setCategories([])
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

  const groupedArticles = useMemo(() => {
    const data = dayData || categoryData
    if (!data) return {}

    if (categoryData) {
      const arts =
        categoryData.category === 'linux kernel'
          ? sortLinuxKernelArticles(categoryData.articles)
          : sortArticlesByHighlight(categoryData.articles)
      return { [categoryData.category]: arts }
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

    Object.keys(grouped).forEach(category => {
      grouped[category] =
        category === 'linux kernel'
          ? sortLinuxKernelArticles(grouped[category])
          : sortArticlesByHighlight(grouped[category])
    })

    return grouped
  }, [dayData, categoryData])

  const articles = (dayData || categoryData)?.articles || []
  const summary = (categoryData || dayData)?.summary || ''

  const handlePatchAnchorJump = (anchorId: string) => {
    const id = decodeURIComponent(anchorId)
    const linuxList = (groupedArticles['linux kernel'] || []) as any[]
    const target = linuxList.find(a => lkmlAnchorId(a.id) === id)
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
      <h1 className="text-lg font-bold text-gray-100 mt-0 mb-3">{children}</h1>
    ),
    h2: ({ children }: { children?: ReactNode }) => (
      <h2 className="text-base font-semibold text-gray-200 mt-0 mb-2">{children}</h2>
    ),
    h3: ({ children }: { children?: ReactNode }) => (
      <h3 className="text-sm font-bold text-sky-200 mt-4 mb-2 first:mt-0 border-l-2 border-sky-500/60 pl-2.5 [&_strong]:text-sky-50 [&_strong]:font-bold">
        {children}
      </h3>
    ),
    p: ({ children }: { children?: ReactNode }) => (
      <p className="text-sm text-gray-400 my-1 leading-relaxed">{children}</p>
    ),
    ul: ({ children }: { children?: ReactNode }) => (
      <ul className="text-sm text-gray-400 my-1 pl-4 list-disc">{children}</ul>
    ),
    ol: ({ children }: { children?: ReactNode }) => (
      <ol className="text-sm text-gray-400 my-1 pl-4 list-decimal">{children}</ol>
    ),
    li: ({ children }: { children?: ReactNode }) => (
      <li className="text-sm text-gray-400 my-0.5">{children}</li>
    ),
    strong: ({ children }: { children?: ReactNode }) => (
      <strong className="text-gray-300 font-medium">{children}</strong>
    ),
    blockquote: ({ children }: { children?: ReactNode }) => (
      <blockquote className="border-l-2 border-gray-600 pl-3 text-gray-400 my-2">{children}</blockquote>
    ),
    code: ({ children }: { children?: ReactNode }) => (
      <code className="bg-gray-900/70 px-1 py-0.5 rounded text-xs text-gray-300">{children}</code>
    ),
    pre: ({ children }: { children?: ReactNode }) => (
      <pre className="bg-gray-900/70 p-3 rounded overflow-x-auto text-xs my-2">{children}</pre>
    ),
    hr: () => <hr className="border-gray-700 my-3" />,
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
                ? 'inline-flex items-center justify-center rounded px-1.5 text-sky-400 hover:text-sky-300 transition-colors'
                : 'text-sky-400 hover:text-sky-300 underline underline-offset-2'
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
          className="text-sky-400 hover:text-sky-300 underline underline-offset-2"
          {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          {children}
        </a>
      )
    },
  }

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
              onChange={e => setSelectedCategory(e.target.value)}
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
              onChange={e => setSelectedDate(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 pr-8"
              style={{ minWidth: '140px' }}
            >
              {availableDates.map(date => (
                <option key={date} value={date}>
                  {formatDateDisplay(date)}
                </option>
              ))}
            </select>
            <h1 className="flex items-center gap-2 text-lg font-semibold tracking-wide text-gray-100">
              <PenguinIcon className="h-[18px] w-[18px] shrink-0" />
              <span>Linux Kernel 补丁日报</span>
            </h1>
          </div>
          <span className="text-sm text-gray-400">共 {articles.length} 篇</span>
        </div>

        {selectedCategory !== 'all' && summary && (
          <div className="bg-gray-900/70 rounded-xl p-4 mb-6 border border-gray-800">
            <div className="flex items-start gap-3">
              <span className="text-2xl flex-shrink-0">💡</span>
              <div className="flex-1 prose prose-invert prose-sm max-w-none">
                <ReactMarkdown components={categorySummaryComponents}>{summary}</ReactMarkdown>
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
                {category === 'linux kernel' && <LkmlTypeStatsBar articles={categoryArticles} />}
                {category === 'linux kernel' ? (
                  <LkmlGroupedList
                    articles={categoryArticles}
                    expanded={expandedTypeMap}
                    activeAnchorId={activeAnchorId}
                    onToggle={(type) =>
                      setExpandedTypeMap(prev => ({ ...prev, [type]: !prev[type] }))
                    }
                  />
                ) : (
                  <div className="space-y-3">
                    {categoryArticles.map((article: any) => (
                      <ArticleCard key={article.id} article={article} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
