export interface Article {
  id: string
  sourceName: string
  title: string
  content?: string
  url?: string
  author?: string
  fetchedAt: string
  patchData?: LKMLPatch
  gitCommitData?: GitCommit
}

export interface SourceDayData {
  date: string
  sourceName: string
  sourceType: string
  generatedAt: string
  summary: string
  articles?: Article[]
  stats?: {
    total: number
    feature: number
    bugfix: number
    other: number
    additions?: number
    deletions?: number
  }
}

export interface LKMLPatch {
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
  changedFiles?: string[]
  messages: LKMLMessage[]
  replyCount: number
}

export interface LKMLMessage {
  id: string
  url: string
  title: string
  author: string
  date: string
  content: string
  isReply: boolean
}

export interface GitCommit {
  hash: string
  shortHash: string
  title: string
  author: string
  authorEmail: string
  date: string
  content: string
  files: string[]
  additions: number
  deletions: number
  subsystem: string
  type: string
  url: string
}

export interface SourceDatesIndex {
  [sourceName: string]: {
    dates: string[]
    lastUpdated: string
  }
}

function sourceNameToFileName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-')
}

function normalizeBasePath(basePath: string): string {
  if (!basePath || basePath === '/') return ''
  return `/${basePath.replace(/^\/+|\/+$/g, '')}`
}

const BASE_PATH = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH || '')

function withBasePath(resourcePath: string): string {
  const normalizedPath = resourcePath.startsWith('/') ? resourcePath : `/${resourcePath}`
  return `${BASE_PATH}${normalizedPath}`
}

export const dayDataApi = {
  getSourceDatesIndex: async (): Promise<SourceDatesIndex> => {
    try {
      const response = await fetch(withBasePath('/source-dates.json'))
      if (response.ok) {
        return await response.json()
      }
      return {}
    } catch (error) {
      console.error('获取数据源日期索引失败:', error)
      return {}
    }
  },

  getSourceData: async (sourceName: string, dateStr: string): Promise<SourceDayData | null> => {
    try {
      const sourceFileName = sourceNameToFileName(sourceName)
      const fullFileName = `${sourceFileName}-${dateStr}.json`
      const fullResponse = await fetch(withBasePath(`/${fullFileName}`))
      if (!fullResponse.ok) return null
      return await fullResponse.json()
    } catch (error) {
      console.error('读取数据源数据失败:', error)
      return null
    }
  }
}
