import fs from 'fs'
import path from 'path'

const DATA_DIR = path.join(__dirname, '..', '..', '..', 'public', 'data')
const SOURCES_CONFIG_PATH = path.join(__dirname, '..', '..', 'sources-config.json')

export interface Source {
  id: string
  name: string
  type: string
  url: string
  category: string
  active: boolean
  config?: string
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
  articles: Article[]
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
    const config = JSON.parse(content)
    return config.sources || []
  } catch (error) {
    console.error('[Storage] 加载信息源配置失败:', error)
    return []
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

export function saveDayData(data: DayData): void {
  ensureDirectoryExists(DATA_DIR)
  const filePath = path.join(DATA_DIR, `${data.date}.json`)
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
  console.log(`[Storage] 数据已保存: ${filePath}`)
}

export function saveCategoryData(dateStr: string, category: string, articles: Article[]): void {
  const categoryDir = path.join(DATA_DIR, 'categories', dateStr)
  ensureDirectoryExists(categoryDir)
  
  const categoryData: CategoryData = {
    category,
    date: dateStr,
    articles
  }
  
  const filePath = path.join(categoryDir, `${category}.json`)
  fs.writeFileSync(filePath, JSON.stringify(categoryData, null, 2), 'utf8')
  console.log(`[Storage] 分类数据已保存: ${filePath}`)
}

export function loadAvailableDates(): string[] {
  try {
    const indexPath = path.join(DATA_DIR, 'index.json')
    if (!fs.existsSync(indexPath)) {
      return []
    }
    const content = fs.readFileSync(indexPath, 'utf8')
    return JSON.parse(content)
  } catch (error) {
    console.error('[Storage] 加载日期索引失败:', error)
    return []
  }
}

export function saveAvailableDates(dates: string[]): void {
  ensureDirectoryExists(DATA_DIR)
  const indexPath = path.join(DATA_DIR, 'index.json')
  fs.writeFileSync(indexPath, JSON.stringify(dates, null, 2), 'utf8')
  console.log(`[Storage] 日期索引已更新: ${indexPath}`)
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
