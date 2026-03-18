const getTodayFileName = () => {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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

export const dayDataApi = {
  getDayData: async (dateStr: string): Promise<DayData | null> => {
    try {
      const response = await fetch(`/data/${dateStr}.json`)
      if (response.ok) {
        return await response.json()
      }
      return null
    } catch (error) {
      console.error('读取每日数据失败:', error)
      return null
    }
  }
}
