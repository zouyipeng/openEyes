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

export interface Source {
  id: string
  name: string
  type: string
  url: string
  category: string
  active: boolean
}

export interface DayData {
  date: string
  generatedAt: string
  summary: string
  articles: Article[]
  sources: Source[]
}

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
  subsystem: string
  type: string
  priority: string
  highlight: boolean
  summary: string
  discussionSummary?: string
  messages: LKMLMessage[]
  replyCount: number
}

export const dayDataApi = {
  getLatestData: async (): Promise<DayData | null> => {
    try {
      const response = await fetch('/linux kernel-2026-03-24.json')
      if (response.ok) {
        return await response.json()
      }
      return null
    } catch (error) {
      console.error('读取数据失败:', error)
      return null
    }
  }
}
