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

export interface CategoryData {
  category: string
  date: string
  generatedAt: string
  summary: string
  articles: Article[]
  sources: Source[]
}

export interface DatesIndex {
  dates: string[]
  lastUpdated: string
}

export const dayDataApi = {
  getAvailableDates: async (): Promise<string[]> => {
    try {
      const response = await fetch('/dates.json')
      if (response.ok) {
        const data: DatesIndex = await response.json()
        return data.dates || []
      }
      return []
    } catch (error) {
      console.error('获取日期列表失败:', error)
      return []
    }
  },

  getDayData: async (dateStr: string): Promise<DayData | null> => {
    try {
      const response = await fetch(`/${dateStr}.json`)
      if (response.ok) {
        return await response.json()
      }
      return null
    } catch (error) {
      console.error('读取每日数据失败:', error)
      return null
    }
  },

  getCategoryData: async (category: string, dateStr: string): Promise<CategoryData | null> => {
    try {
      const url = `/${category}-${dateStr}.json`
      console.log('尝试加载分类数据:', url)
      const response = await fetch(url)
      console.log('分类数据响应状态:', response.status)
      if (response.ok) {
        const data = await response.json()
        console.log('加载到的分类数据:', { category: data.category, summaryLength: data.summary.length })
        return data
      }
      console.log('分类数据加载失败:', response.status, response.statusText)
      return null
    } catch (error) {
      console.error('读取分类数据失败:', error)
      return null
    }
  },

  getCategoriesFromDayData: (data: DayData): string[] => {
    const categories = new Set<string>()
    data.articles.forEach(article => {
      const source = data.sources.find(s => s.id === article.sourceId)
      if (source?.category) {
        categories.add(source.category)
      }
    })
    return Array.from(categories)
  }
}
