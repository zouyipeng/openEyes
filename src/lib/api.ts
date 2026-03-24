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
  getAvailableDates: async (): Promise<string[]> => {
    try {
      const response = await fetch('/dates.json')
      if (response.ok) {
        const data = await response.json()
        return data.dates || []
      }
      return []
    } catch (error) {
      console.error('获取日期列表失败:', error)
      return []
    }
  },

  getDataByDate: async (dateStr: string): Promise<DayData | null> => {
    try {
      const response = await fetch(`/linux kernel-${dateStr}.json`)
      if (response.ok) {
        return await response.json()
      }
      return null
    } catch (error) {
      console.error('读取数据失败:', error)
      return null
    }
  },

  getLatestData: async (): Promise<DayData | null> => {
    try {
      const dates = await dayDataApi.getAvailableDates()
      if (dates.length === 0) return null
      
      const latestDate = dates[0]
      return await dayDataApi.getDataByDate(latestDate)
    } catch (error) {
      console.error('读取最新数据失败:', error)
      return null
    }
  }
}
