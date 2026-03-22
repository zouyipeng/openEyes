export type SourceType = 'rss' | 'crawler' | 'manual' | 'social' | 'lkml'

export interface Source {
  id: string
  name: string
  type: SourceType
  url: string
  category: string
  config?: SourceConfig
  lastFetched?: Date
  active: boolean
  createdAt?: Date
  updatedAt?: Date
  aiPrompt?: string
  excludeAuthors?: string[]
}

export interface SourceConfig {
  selector?: string
  titleSelector?: string
  contentSelector?: string
  linkSelector?: string
  updateInterval?: number
}

export type PatchType = 'feature' | 'bugfix' | 'refactor' | 'test' | 'doc' | 'other'

export type PatchPriority = 'critical' | 'important' | 'normal' | 'low'

export type KernelSubsystem = 'sched' | 'mm' | 'fs' | 'net' | 'driver' | 'security' | 'arch' | 'other'

export interface LKMLMessage {
  id: string
  url: string
  title: string
  author: string
  date: string
  content: string
  isReply: boolean
  originalPatchUrl?: string
}

export interface LKMLPatch {
  id: string
  title: string
  url: string
  author: string
  date: string
  content: string
  subsystem: KernelSubsystem
  type: PatchType
  priority: PatchPriority
  highlight: boolean
  summary: string
  discussionSummary?: string
  messages: LKMLMessage[]
  replyCount: number
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
  publishedAt?: string
  fetchedAt: string
  highlight?: boolean
  patchData?: LKMLPatch
}

export interface DayData {
  date: string
  generatedAt: string
  summary: string
  articles: Article[]
  sources: Source[]
}

export interface CategoryData {
  category: string
  date: string
  generatedAt: string
  summary: string
  articles: Article[]
  sources: Source[]
}

export interface DailySummary {
  date: string
  totalArticles: number
  sources: string[]
  summary: string
  highlights: string[]
}
