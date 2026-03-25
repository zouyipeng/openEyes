import fs from 'fs'
import path from 'path'

const DATA_DIR = path.join(__dirname, '..', '..', '..', 'public')
const SOURCES_CONFIG_PATH = path.join(__dirname, '..', '..', 'sources-config.json')

export interface GitConfig {
  branch: string
  sinceDays: number
  maxCommits: number
  localPath?: string
}

export interface Source {
  name: string
  type: string
  url: string
  active: boolean
  excludeAuthors?: string[]
  lkmlDetailConcurrency?: number
  lkmlDetailTimeoutMs?: number
  gitConfig?: GitConfig
  summaryPrompt?: string
}

export interface SourcesConfig {
  sources: Source[]
}

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
  articles: Article[]
}

export interface SourceDatesIndex {
  [sourceName: string]: {
    dates: string[]
    lastUpdated: string
  }
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
  subsystem: KernelSubsystem
  type: PatchType
  url: string
}

function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

export function loadSourcesConfig(): SourcesConfig {
  try {
    if (!fs.existsSync(SOURCES_CONFIG_PATH)) {
      console.error('[Storage] 信息源配置文件不存在:', SOURCES_CONFIG_PATH)
      return { sources: [] }
    }
    const content = fs.readFileSync(SOURCES_CONFIG_PATH, 'utf8')
    return JSON.parse(content)
  } catch (error) {
    console.error('[Storage] 加载信息源配置失败:', error)
    return { sources: [] }
  }
}

function sourceNameToFileName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-')
}

export function loadSourceData(sourceName: string, dateStr: string): SourceDayData | null {
  try {
    const fileName = `${sourceNameToFileName(sourceName)}-${dateStr}.json`
    const filePath = path.join(DATA_DIR, fileName)
    if (!fs.existsSync(filePath)) {
      return null
    }
    const content = fs.readFileSync(filePath, 'utf8')
    return JSON.parse(content)
  } catch (error) {
    console.error('[Storage] 加载数据源数据失败:', error)
    return null
  }
}

export function saveSourceData(data: SourceDayData): void {
  ensureDirectoryExists(DATA_DIR)
  const fileName = `${sourceNameToFileName(data.sourceName)}-${data.date}.json`
  const filePath = path.join(DATA_DIR, fileName)
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
  console.log(`[Storage] 数据已保存: ${filePath}`)
  updateSourceDatesIndex(data.sourceName, data.date)
}

export function updateSourceDatesIndex(sourceName: string, dateStr: string): void {
  ensureDirectoryExists(DATA_DIR)
  
  const indexPath = path.join(DATA_DIR, 'source-dates.json')
  let index: SourceDatesIndex = {}
  
  if (fs.existsSync(indexPath)) {
    try {
      const content = fs.readFileSync(indexPath, 'utf8')
      index = JSON.parse(content)
    } catch {
      index = {}
    }
  }
  
  const key = sourceNameToFileName(sourceName)
  if (!index[key]) {
    index[key] = { dates: [], lastUpdated: '' }
  }
  
  if (!index[key].dates.includes(dateStr)) {
    index[key].dates.push(dateStr)
    index[key].dates.sort().reverse()
  }
  
  index[key].lastUpdated = new Date().toISOString()
  
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8')
  console.log(`[Storage] 数据源日期索引已更新: ${sourceName} - ${index[key].dates.length} 个日期`)
}

export function loadSourceDatesIndex(): SourceDatesIndex {
  try {
    const filePath = path.join(DATA_DIR, 'source-dates.json')
    if (!fs.existsSync(filePath)) {
      return {}
    }
    const content = fs.readFileSync(filePath, 'utf8')
    return JSON.parse(content)
  } catch (error) {
    console.error('[Storage] 加载数据源日期索引失败:', error)
    return {}
  }
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
