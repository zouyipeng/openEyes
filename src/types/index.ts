export type SourceType = 'rss' | 'crawler' | 'manual' | 'social'

export interface Source {
  id: string
  name: string
  type: SourceType
  url: string
  config?: SourceConfig
  lastFetched?: Date
  active: boolean
  createdAt: Date
  updatedAt: Date
}

export interface SourceConfig {
  selector?: string
  titleSelector?: string
  contentSelector?: string
  linkSelector?: string
  updateInterval?: number
}

export interface Article {
  id: string
  sourceId: string
  sourceName: string
  sourceUrl?: string
  title: string
  content?: string
  summary?: string
  url?: string
  author?: string
  publishedAt?: Date
  fetchedAt: Date
  isRead: boolean
  isFavorite: boolean
  createdAt: Date
  updatedAt: Date
}

export interface DailySummary {
  date: string
  totalArticles: number
  sources: string[]
  summary: string
  highlights: string[]
}
