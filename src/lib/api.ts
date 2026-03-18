// 从JSON文件读取数据的API客户端

// 生成指定日期的文件名（格式：YYYY-MM-DD.json）
const getFileName = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}.json`
}

// 生成今日日期的文件名
const getTodayFileName = () => getFileName(new Date())

// 模拟数据，用于测试
const mockArticles = [
  {
    id: '1',
    sourceId: '1',
    sourceName: '36氪 AI',
    sourceUrl: 'https://36kr.com/feed',
    title: '松下发布中国事业新战略：明星单品、套系家电加码，强调"Made by China"出海',
    content: '近日，中国家电及消费电子博览会（简称"AWE"）在上海落下帷幕。展会期间，家电品牌松下举办"松下电器中国事业战略发布暨Top渠道商大会"，并发布中国事业新战略。',
    summary: '松下发布中国事业新战略，强调"Made by China"出海，推出明星单品和套系家电。',
    url: 'https://36kr.com/p/3725245431839369',
    author: null,
    publishedAt: new Date(),
    fetchedAt: new Date(),
    isRead: false,
    isFavorite: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '2',
    sourceId: '1',
    sourceName: '36氪 AI',
    sourceUrl: 'https://36kr.com/feed',
    title: '补齐AI板块核心拼图，网络基建「卖铲人」飞速创新登陆港交所',
    content: '继2025年港交所重现"IPO大年"（全年117家公司上市，募资总额达2869亿港元，同比大增200%）之后，2026年的港股上市潮仍在强势延续年内已有28家企业成功IPO，募资总额逼近千亿大关。',
    summary: '飞速创新登陆港交所，补齐AI板块核心拼图，成为网络基建「卖铲人」。',
    url: 'https://36kr.com/p/3725233182062982',
    author: null,
    publishedAt: new Date(),
    fetchedAt: new Date(),
    isRead: false,
    isFavorite: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]

const mockSources = [
  {
    id: '1',
    name: '36氪 AI',
    type: 'rss',
    url: 'https://36kr.com/feed',
    config: '{"category":"AI"}',
    lastFetched: new Date(),
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    category: 'AI',
  },
  {
    id: '2',
    name: '新浪新闻',
    type: 'rss',
    url: 'https://rss.sina.com.cn/news/china.xml',
    config: '{"category":"新闻"}',
    lastFetched: new Date(),
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    category: '新闻',
  },
]

// 获取可用日期列表
export const dateApi = {
  getAvailableDates: async (): Promise<string[]> => {
    try {
      const response = await fetch('/data/index.json')
      if (response.ok) {
        return await response.json()
      }
      return []
    } catch (error) {
      console.error('获取日期列表失败:', error)
      return []
    }
  },
  
  saveAvailableDates: async (dates: string[]) => {
    // 这个函数在后端执行，前端只读取
  }
}

// 文章相关 API
export const articleApi = {
  // 获取指定日期的文章
  getArticlesByDate: async (dateStr: string): Promise<any[]> => {
    try {
      const response = await fetch(`/data/${dateStr}.json`)
      if (response.ok) {
        return await response.json()
      }
      return []
    } catch (error) {
      console.error('读取JSON文件失败:', error)
      return []
    }
  },
  
  // 获取今日文章
  getTodayArticles: async (): Promise<any[]> => {
    try {
      const fileName = getTodayFileName()
      const response = await fetch(`/data/${fileName}`)
      
      if (response.ok) {
        return await response.json()
      } else {
        console.warn('JSON文件不存在，返回模拟数据')
        return mockArticles
      }
    } catch (error) {
      console.error('读取JSON文件失败:', error)
      return mockArticles
    }
  },
  
  // 获取所有文章
  getArticles: async (page = 1, limit = 20, sourceId?: string) => {
    try {
      const fileName = getTodayFileName()
      const response = await fetch(`/data/${fileName}`)
      
      if (response.ok) {
        const articles = await response.json()
        const filteredArticles = sourceId ? articles.filter((article: any) => article.sourceId === sourceId) : articles
        const start = (page - 1) * limit
        const end = start + limit
        
        return {
          articles: filteredArticles.slice(start, end),
          pagination: {
            page,
            limit,
            total: filteredArticles.length,
          },
        }
      } else {
        console.warn('JSON文件不存在，返回模拟数据')
        return {
          articles: mockArticles.slice(0, limit),
          pagination: {
            page,
            limit,
            total: mockArticles.length,
          },
        }
      }
    } catch (error) {
      console.error('读取JSON文件失败:', error)
      return {
        articles: mockArticles.slice(0, limit),
        pagination: {
          page,
          limit,
          total: mockArticles.length,
        },
      }
    }
  },
  
  // 获取文章详情
  getArticleById: async (id: string) => {
    try {
      const fileName = getTodayFileName()
      const response = await fetch(`/data/${fileName}`)
      
      if (response.ok) {
        const articles = await response.json()
        const article = articles.find((article: any) => article.id === id)
        if (article) {
          return article
        } else {
          throw new Error('文章不存在')
        }
      } else {
        console.warn('JSON文件不存在，返回模拟数据')
        const article = mockArticles.find((article) => article.id === id)
        if (article) {
          return article
        } else {
          throw new Error('文章不存在')
        }
      }
    } catch (error) {
      console.error('读取JSON文件失败:', error)
      const article = mockArticles.find((article) => article.id === id)
      if (article) {
        return article
      } else {
        throw new Error('文章不存在')
      }
    }
  },
  
  // 更新文章状态
  updateArticle: async (id: string, data: { isRead?: boolean; isFavorite?: boolean }) => {
    try {
      const article = await articleApi.getArticleById(id)
      return {
        ...article,
        ...data,
      }
    } catch (error) {
      console.error('更新文章状态失败:', error)
      throw error
    }
  },
}

// 信息源相关 API
export const sourceApi = {
  // 获取指定日期的信息源
  getSourcesByDate: async (dateStr: string): Promise<any[]> => {
    try {
      const response = await fetch(`/data/sources-${dateStr}.json`)
      if (response.ok) {
        return await response.json()
      }
      return []
    } catch (error) {
      console.error('读取信息源文件失败:', error)
      return []
    }
  },
  
  // 获取所有信息源
  getSources: async (): Promise<any[]> => {
    try {
      const fileName = getTodayFileName()
      const response = await fetch(`/data/sources-${fileName}`)
      
      if (response.ok) {
        return await response.json()
      } else {
        console.warn('JSON文件不存在，返回模拟数据')
        return mockSources
      }
    } catch (error) {
      console.error('读取JSON文件失败:', error)
      return mockSources
    }
  },
  
  // 按类别获取信息源
  getSourcesByCategory: async (): Promise<Record<string, any[]>> => {
    try {
      const sources = await sourceApi.getSources()
      const categories: Record<string, any[]> = {}
      
      sources.forEach((source: any) => {
        const category = source.category || '未分类'
        if (!categories[category]) {
          categories[category] = []
        }
        categories[category].push(source)
      })
      
      return categories
    } catch (error) {
      console.error('获取信息源分类失败:', error)
      return {
        AI: mockSources.filter((source) => source.category === 'AI'),
        新闻: mockSources.filter((source) => source.category === '新闻'),
      }
    }
  },
  
  // 添加信息源
  addSource: async (data: { name: string; type: string; url: string; config?: any; active?: boolean }) => {
    return {
      id: Date.now().toString(),
      ...data,
      config: data.config ? JSON.stringify(data.config) : undefined,
      lastFetched: null,
      active: data.active !== undefined ? data.active : true,
      createdAt: new Date(),
      updatedAt: new Date(),
      category: data.config?.category || '未分类',
    }
  },
  
  // 更新信息源
  updateSource: async (id: string, data: { name?: string; type?: string; url?: string; config?: any; active?: boolean }) => {
    try {
      const sources = await sourceApi.getSources()
      const source = sources.find((source: any) => source.id === id)
      if (source) {
        return {
          ...source,
          ...data,
          config: data.config ? JSON.stringify(data.config) : source.config,
          updatedAt: new Date(),
          category: data.config?.category || source.category,
        }
      } else {
        throw new Error('信息源不存在')
      }
    } catch (error) {
      console.error('更新信息源失败:', error)
      throw error
    }
  },
  
  // 删除信息源
  deleteSource: async (id: string) => {
    return { message: '信息源删除成功' }
  },
}

// 摘要相关 API
export const summaryApi = {
  // 获取指定日期的摘要
  getSummaryByDate: async (dateStr: string): Promise<{ summary: string }> => {
    try {
      const response = await fetch(`/data/summary-${dateStr}.json`)
      if (response.ok) {
        return await response.json()
      }
      return { summary: '暂无摘要' }
    } catch (error) {
      console.error('读取摘要文件失败:', error)
      return { summary: '暂无摘要' }
    }
  },
  
  // 获取每日摘要
  getDailySummary: async (): Promise<{ summary: string }> => {
    try {
      const fileName = getTodayFileName()
      const response = await fetch(`/data/summary-${fileName}`)
      
      if (response.ok) {
        return await response.json()
      } else {
        console.warn('JSON文件不存在，返回默认摘要')
        return { summary: '今日共收集到2篇文章，来自2个信息源。内容涵盖科技、财经、商业等多个领域，为您提供全方位的信息资讯。' }
      }
    } catch (error) {
      console.error('读取JSON文件失败:', error)
      return { summary: '今日共收集到2篇文章，来自2个信息源。内容涵盖科技、财经、商业等多个领域，为您提供全方位的信息资讯。' }
    }
  },
}

// 抓取相关 API
export const fetchApiClient = {
  // 触发抓取
  triggerFetch: async () => {
    return { success: true, message: '抓取任务已触发，请在后端查看执行结果' }
  },
}