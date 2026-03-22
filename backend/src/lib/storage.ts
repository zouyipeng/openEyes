import fs from 'fs'
import path from 'path'

const DATA_DIR = path.join(__dirname, '..', '..', '..', 'public')
const SOURCES_CONFIG_PATH = path.join(__dirname, '..', '..', 'sources-config.json')
const PROCESSED_FILE = path.join(DATA_DIR, 'processed-articles.json')

export interface Source {
  id: string
  name: string
  type: string
  url: string
  category: string
  active: boolean
  config?: string
  aiPrompt?: string
  excludeAuthors?: string[]
}

export interface CategoryPrompt {
  summaryPrompt?: string
  categorySummaryPrompt?: string
}

export interface GlobalConfig {
  defaultSummaryPrompt: string
  defaultCategorySummaryPrompt: string
  categoryPrompts?: Record<string, CategoryPrompt>
}

export interface SourcesConfig {
  globalConfig: GlobalConfig
  sources: Source[]
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

export interface DatesIndex {
  dates: string[]
  lastUpdated: string
}

export interface ProcessedArticles {
  lastUpdated: string
  urls: string[]
}

export type PatchType = 'feature' | 'bugfix' | 'other'

export type KernelSubsystem = 'sched' | 'mm' | 'fs' | 'net' | 'driver' | 'security' | 'arch' | 'other'

export interface LKMLMessage {
  id: string
  url: string
  title: string
  author: string
  date: string
  content: string
  isReply: boolean
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
  highlight: boolean
  summary: string
  messages: LKMLMessage[]
  replyCount: number
}

function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

export function loadSources(): Source[] {
  try {
    if (!fs.existsSync(SOURCES_CONFIG_PATH)) {
      console.error('[Storage] 信息源配置文件不存在:', SOURCES_CONFIG_PATH)
      return []
    }
    const content = fs.readFileSync(SOURCES_CONFIG_PATH, 'utf8')
    const config: SourcesConfig = JSON.parse(content)
    return config.sources || []
  } catch (error) {
    console.error('[Storage] 加载信息源配置失败:', error)
    return []
  }
}

export function loadGlobalConfig(): GlobalConfig {
  const defaultConfig: GlobalConfig = {
    defaultSummaryPrompt: '你是一个专业的信息总结助手。请用简洁的中文总结以下文章的核心内容，控制在100字以内。',
    defaultCategorySummaryPrompt: '你是一个信息整合助手。请根据今日收集的文章，生成一份简洁的每日信息摘要。'
  }
  
  try {
    if (!fs.existsSync(SOURCES_CONFIG_PATH)) {
      return defaultConfig
    }
    const content = fs.readFileSync(SOURCES_CONFIG_PATH, 'utf8')
    const config: SourcesConfig = JSON.parse(content)
    return config.globalConfig || defaultConfig
  } catch (error) {
    console.error('[Storage] 加载全局配置失败:', error)
    return defaultConfig
  }
}

export function loadSourcesConfig(): SourcesConfig {
  try {
    if (!fs.existsSync(SOURCES_CONFIG_PATH)) {
      console.error('[Storage] 信息源配置文件不存在:', SOURCES_CONFIG_PATH)
      return { globalConfig: loadGlobalConfig(), sources: [] }
    }
    const content = fs.readFileSync(SOURCES_CONFIG_PATH, 'utf8')
    return JSON.parse(content)
  } catch (error) {
    console.error('[Storage] 加载信息源配置失败:', error)
    return { globalConfig: loadGlobalConfig(), sources: [] }
  }
}

export function loadArticlesByDate(dateStr: string): Article[] {
  try {
    const filePath = path.join(DATA_DIR, `${dateStr}.json`)
    if (!fs.existsSync(filePath)) {
      return []
    }
    const content = fs.readFileSync(filePath, 'utf8')
    const data: DayData = JSON.parse(content)
    return data.articles || []
  } catch (error) {
    console.error('[Storage] 加载文章失败:', error)
    return []
  }
}

export function loadAllProcessedArticles(): Article[] {
  const articles: Article[] = []
  try {
    if (!fs.existsSync(DATA_DIR)) {
      return articles
    }
    
    const files = fs.readdirSync(DATA_DIR)
    const dateFiles = files.filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    
    for (const file of dateFiles) {
      const dateStr = file.replace('.json', '')
      const dayArticles = loadArticlesByDate(dateStr)
      articles.push(...dayArticles)
    }
    
    return articles
  } catch (error) {
    console.error('[Storage] 加载所有文章失败:', error)
    return articles
  }
}

export function loadProcessedUrls(): Set<string> {
  try {
    if (!fs.existsSync(PROCESSED_FILE)) {
      return new Set<string>()
    }
    const content = fs.readFileSync(PROCESSED_FILE, 'utf8')
    const data: ProcessedArticles = JSON.parse(content)
    return new Set(data.urls || [])
  } catch (error) {
    console.error('[Storage] 加载已处理URL失败:', error)
    return new Set<string>()
  }
}

export function saveProcessedUrls(urls: Set<string>): void {
  ensureDirectoryExists(DATA_DIR)
  const data: ProcessedArticles = {
    lastUpdated: new Date().toISOString(),
    urls: Array.from(urls)
  }
  fs.writeFileSync(PROCESSED_FILE, JSON.stringify(data, null, 2), 'utf8')
  console.log(`[Storage] 已处理URL已保存: ${urls.size} 条`)
}

export function loadDayData(dateStr: string): DayData | null {
  try {
    const filePath = path.join(DATA_DIR, `${dateStr}.json`)
    if (!fs.existsSync(filePath)) {
      return null
    }
    const content = fs.readFileSync(filePath, 'utf8')
    return JSON.parse(content)
  } catch (error) {
    console.error('[Storage] 加载每日数据失败:', error)
    return null
  }
}

export function loadCategoryData(category: string, dateStr: string): CategoryData | null {
  try {
    const filePath = path.join(DATA_DIR, `${category}-${dateStr}.json`)
    if (!fs.existsSync(filePath)) {
      return null
    }
    const content = fs.readFileSync(filePath, 'utf8')
    return JSON.parse(content)
  } catch (error) {
    console.error('[Storage] 加载分类数据失败:', error)
    return null
  }
}

export function loadDatesIndex(): DatesIndex | null {
  try {
    const filePath = path.join(DATA_DIR, 'dates.json')
    if (!fs.existsSync(filePath)) {
      return null
    }
    const content = fs.readFileSync(filePath, 'utf8')
    return JSON.parse(content)
  } catch (error) {
    console.error('[Storage] 加载日期索引失败:', error)
    return null
  }
}

export function updateDatesIndex(): void {
  ensureDirectoryExists(DATA_DIR)
  
  if (!fs.existsSync(DATA_DIR)) {
    return
  }
  
  const files = fs.readdirSync(DATA_DIR)
  const dateFiles = files.filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
  const dates = dateFiles.map(f => f.replace('.json', '')).sort().reverse()
  
  const index: DatesIndex = {
    dates,
    lastUpdated: new Date().toISOString()
  }
  
  const filePath = path.join(DATA_DIR, 'dates.json')
  fs.writeFileSync(filePath, JSON.stringify(index, null, 2), 'utf8')
  console.log(`[Storage] 日期索引已更新: ${dates.length} 个日期`)
}

export function saveDayData(data: DayData): void {
  ensureDirectoryExists(DATA_DIR)
  const filePath = path.join(DATA_DIR, `${data.date}.json`)
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
  console.log(`[Storage] 数据已保存: ${filePath}`)
  updateDatesIndex()
}

export function saveCategoryData(data: CategoryData): void {
  ensureDirectoryExists(DATA_DIR)
  const filePath = path.join(DATA_DIR, `${data.category}-${data.date}.json`)
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
  console.log(`[Storage] 分类数据已保存: ${filePath}`)
}

export function saveAllCategoryData(articles: Article[], sources: Source[], dateStr: string, summaries: Record<string, string> = {}): void {
  ensureDirectoryExists(DATA_DIR)
  
  const categoryArticles: Record<string, Article[]> = {}
  const categorySources: Record<string, Source[]> = {}
  
  articles.forEach(article => {
    const source = sources.find(s => s.id === article.sourceId)
    const category = source?.category || '未分类'
    
    if (!categoryArticles[category]) {
      categoryArticles[category] = []
      categorySources[category] = []
    }
    
    categoryArticles[category].push(article)
    
    if (!categorySources[category].find(s => s.id === source?.id)) {
      if (source) {
        categorySources[category].push(source)
      }
    }
  })
  
  Object.keys(categoryArticles).forEach(category => {
    const data: CategoryData = {
      category,
      date: dateStr,
      generatedAt: new Date().toISOString(),
      summary: summaries[category] || '',
      articles: categoryArticles[category],
      sources: categorySources[category]
    }
    
    saveCategoryData(data)
  })
}

export function getTodayString(): string {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function generateArticleId(): string {
  return `art_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}
