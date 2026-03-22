import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'
import { Article, GlobalConfig } from './storage'

const configPath = path.join(__dirname, '../../config.json')
let config = {
  openai: {
    apiKey: '',
    baseURL: 'https://api.openai.com/v1',
    model: 'gpt-3.5-turbo',
    maxTokens: 4096
  }
}

if (fs.existsSync(configPath)) {
  try {
    const configData = fs.readFileSync(configPath, 'utf8')
    const loadedConfig = JSON.parse(configData)
    config = {
      openai: {
        ...config.openai,
        ...loadedConfig.openai
      }
    }
    console.log('[AI] 配置文件加载成功')
    console.log('[AI] API Key:', config.openai.apiKey ? `${config.openai.apiKey.slice(0, 8)}...` : '未配置')
    console.log('[AI] Base URL:', config.openai.baseURL)
    console.log('[AI] Model:', config.openai.model)
    console.log('[AI] Max Tokens:', config.openai.maxTokens)
  } catch (error) {
    console.error('[AI] 读取配置文件失败:', error)
  }
} else {
  console.warn('[AI] 配置文件不存在:', configPath)
}

const openai = new OpenAI({
  apiKey: config.openai.apiKey || '',
  baseURL: config.openai.baseURL || 'https://api.openai.com/v1',
})

const MAX_RETRIES = 3
const RETRY_DELAY = 1000

const categoryContextCache = new Map<string, { messages: { role: string; content: string }[] }>()

function cleanAIResponse(content: string): string {
  if (!content) return ''
  
  let cleaned = content
  
  const thinkEndMatch = cleaned.match(/<\/think>/i)
  
  if (thinkEndMatch) {
    const afterThink = cleaned.substring(thinkEndMatch.index! + thinkEndMatch[0].length)
    cleaned = afterThink.trim()
  } else {
    const thinkStartMatch = cleaned.match(/<think[^>]*>/i)
    if (thinkStartMatch) {
      console.log('[AI] 发现 <think 标签但没有 </think，响应可能不完整')
      cleaned = ''
    }
  }
  
  cleaned = cleaned.replace(/^```json\s*/i, '')
  cleaned = cleaned.replace(/^```\s*/i, '')
  cleaned = cleaned.replace(/\s*```$/i, '')
  
  cleaned = cleaned.replace(/^\s*\n+/gm, '')
  cleaned = cleaned.trim()
  
  return cleaned
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T> {
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[AI] ${operationName} - 尝试 ${attempt}/${MAX_RETRIES}`)
      const startTime = Date.now()
      const result = await operation()
      const duration = Date.now() - startTime
      console.log(`[AI] ${operationName} - 成功 (耗时: ${duration}ms)`)
      return result
    } catch (error: any) {
      lastError = error
      console.error(`[AI] ${operationName} - 失败 (尝试 ${attempt}/${MAX_RETRIES}):`, error.message)
      
      if (error.status === 429) {
        console.log('[AI] 遇到限流，等待后重试...')
        await sleep(RETRY_DELAY * attempt * 2)
      } else if (error.status === 401) {
        console.error('[AI] API Key 无效，请检查配置')
        throw error
      } else if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY)
      }
    }
  }
  
  throw lastError
}

function getCategoryContext(category: string): { messages: { role: string; content: string }[] } {
  if (!categoryContextCache.has(category)) {
    categoryContextCache.set(category, { messages: [] })
  }
  return categoryContextCache.get(category)!
}

export function clearCategoryContext(category: string): void {
  categoryContextCache.delete(category)
}

export function clearAllCategoryContexts(): void {
  categoryContextCache.clear()
}

export async function summarizeContent(
  title: string,
  content: string,
  customPrompt?: string
): Promise<string> {
  if (!config.openai.apiKey) {
    console.log('[AI] summarizeContent - API Key 未配置，跳过')
    return content.substring(0, 100) + '...'
  }

  const truncatedContent = content.length > 2000 ? content.substring(0, 2000) + '...' : content
  
  const defaultPrompt = '你是一个专业的信息总结助手。请用简洁的中文总结以下文章的核心内容，控制在100字以内。直接输出总结内容，不要添加标题或额外格式。不要输出思考过程。'
  const systemPrompt = customPrompt || defaultPrompt
  
  try {
    const result = await withRetry(async () => {
      return await openai.chat.completions.create({
        model: config.openai.model,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: `标题：${title}\n\n内容：${truncatedContent}`
          }
        ],
        max_tokens: config.openai.maxTokens,
        temperature: 0.7,
      })
    }, `总结文章: ${title.substring(0, 30)}...`)

    const rawContent = result.choices[0]?.message?.content || ''
    console.log('[AI] 原始响应长度:', rawContent.length)
    const cleaned = cleanAIResponse(rawContent)
    console.log('[AI] 清理后长度:', cleaned.length)
    return cleaned || truncatedContent.substring(0, 100) + '...'
  } catch (error: any) {
    console.error('[AI] summarizeContent - 最终失败:', error.message)
    return truncatedContent.substring(0, 100) + '...'
  }
}

export async function summarizeArticlesInCategory(
  articles: Article[],
  category: string,
  globalConfig: GlobalConfig,
  sourcePrompts: Map<string, string>
): Promise<void> {
  if (!config.openai.apiKey) {
    console.log('[AI] summarizeArticlesInCategory - API Key 未配置，跳过')
    return
  }

  const context = getCategoryContext(category)
  
  const categoryPrompt = globalConfig.categoryPrompts?.[category]?.summaryPrompt
  
  for (const article of articles) {
    if (article.patchData?.summary && article.patchData.summary.length > 10) {
      console.log(`[AI] 分类 ${category} - 跳过已总结patch: ${article.title.substring(0, 30)}...`)
      context.messages.push(
        { role: 'user', content: `标题：${article.title}` },
        { role: 'assistant', content: article.patchData.summary }
      )
      continue
    }
    
    if (article.summary && article.summary.length > 20 && !article.summary.endsWith('...')) {
      console.log(`[AI] 分类 ${category} - 跳过已总结: ${article.title.substring(0, 30)}...`)
      context.messages.push(
        { role: 'user', content: `标题：${article.title}` },
        { role: 'assistant', content: article.summary }
      )
      continue
    }
    
    const prompt = sourcePrompts.get(article.sourceId) 
      || categoryPrompt 
      || globalConfig.defaultSummaryPrompt
    
    try {
      const truncatedContent = (article.content || article.title).length > 2000 
        ? (article.content || article.title).substring(0, 2000) + '...' 
        : (article.content || article.title)
      
      const messages: { role: string; content: string }[] = [
        { role: 'system', content: prompt },
        ...context.messages.slice(-4),
        { role: 'user', content: `标题：${article.title}\n\n内容：${truncatedContent}` }
      ]
      
      const result = await withRetry(async () => {
        return await openai.chat.completions.create({
          model: config.openai.model,
          messages,
          max_tokens: config.openai.maxTokens,
          temperature: 0.7,
        })
      }, `总结文章: ${article.title.substring(0, 30)}...`)

      const rawContent = result.choices[0]?.message?.content || ''
      const cleaned = cleanAIResponse(rawContent)
      
      article.summary = cleaned || article.title.substring(0, 100) + '...'
      
      context.messages.push(
        { role: 'user', content: `标题：${article.title}` },
        { role: 'assistant', content: article.summary }
      )
      
      console.log(`[AI] 分类 ${category} - 已总结文章: ${article.title.substring(0, 30)}...`)
    } catch (error: any) {
      console.error(`[AI] 总结文章失败: ${article.title}`, error.message)
      article.summary = article.title.substring(0, 100) + '...'
    }
  }
}

export async function generateCategorySummary(
  articles: Article[],
  category: string,
  globalConfig: GlobalConfig
): Promise<string> {
  if (articles.length === 0) {
    return ''
  }

  const totalArticles = articles.length
  const sourceCount = new Set(articles.map(a => a.sourceName)).size
  
  if (!config.openai.apiKey) {
    console.log('[AI] generateCategorySummary - API Key 未配置，使用默认摘要')
    return `今日共收集到${totalArticles}篇文章，来自${sourceCount}个信息源。`
  }

  const context = getCategoryContext(category)
  
  const categoryPrompt = globalConfig.categoryPrompts?.[category]?.categorySummaryPrompt
  const prompt = categoryPrompt || globalConfig.defaultCategorySummaryPrompt

  try {
    const articlesText = articles
      .slice(0, 20)
      .map(a => `【${a.sourceName}】${a.title}${a.summary ? ': ' + a.summary.substring(0, 100) : ''}`)
      .join('\n\n')

    const messages: { role: string; content: string }[] = [
      { role: 'system', content: prompt },
      ...context.messages.slice(-6),
      { role: 'user', content: `请为以下${category}分类的文章生成摘要：\n${articlesText}` }
    ]

    const result = await withRetry(async () => {
      return await openai.chat.completions.create({
        model: config.openai.model,
        messages,
        max_tokens: config.openai.maxTokens,
        temperature: 0.7,
      })
    }, `生成分类摘要: ${category}`)

    const rawContent = result.choices[0]?.message?.content || ''
    const cleaned = cleanAIResponse(rawContent)
    return cleaned || `今日共收集到${totalArticles}篇文章，来自${sourceCount}个信息源。`
  } catch (error: any) {
    console.error('[AI] generateCategorySummary - 最终失败:', error.message)
    return `今日共收集到${totalArticles}篇文章，来自${sourceCount}个信息源。`
  }
}

export async function extractKeywords(title: string, content: string): Promise<string[]> {
  if (!config.openai.apiKey) {
    console.log('[AI] extractKeywords - API Key 未配置，跳过')
    return []
  }

  const truncatedContent = content.length > 1000 ? content.substring(0, 1000) : content

  try {
    const result = await withRetry(async () => {
      return await openai.chat.completions.create({
        model: config.openai.model,
        messages: [
          {
            role: 'system',
            content: '请从以下文章中提取3-5个关键词，只返回关键词，用逗号分隔。不要输出思考过程。'
          },
          {
            role: 'user',
            content: `标题：${title}\n\n内容：${truncatedContent}`
          }
        ],
        max_tokens: config.openai.maxTokens,
        temperature: 0.5,
      })
    }, `提取关键词: ${title.substring(0, 20)}...`)

    const rawContent = result.choices[0]?.message?.content || ''
    const cleanedContent = cleanAIResponse(rawContent)
    const keywords = cleanedContent.split(/[,，]/).map(k => k.trim())
    return keywords.filter(k => k.length > 0)
  } catch (error: any) {
    console.error('[AI] extractKeywords - 最终失败:', error.message)
    return []
  }
}

export function isAIConfigured(): boolean {
  return !!config.openai.apiKey
}

export function getAIConfig() {
  return {
    configured: !!config.openai.apiKey,
    baseURL: config.openai.baseURL,
    model: config.openai.model,
    maxTokens: config.openai.maxTokens
  }
}

export async function analyzePatch(title: string, content: string, customPrompt?: string): Promise<{
  type: 'feature' | 'bugfix' | 'other'
  subsystem: 'sched' | 'mm' | 'fs' | 'net' | 'driver' | 'security' | 'arch' | 'other'
  highlight: boolean
  summary: string
}> {
  const defaultResult = {
    type: 'other' as const,
    subsystem: 'other' as const,
    highlight: false,
    summary: title.replace(/^\[[^\]]+\]\s*/, '').substring(0, 50)
  }

  if (!config.openai.apiKey) {
    console.log('[AI] analyzePatch - API Key 未配置，使用默认结果')
    return defaultResult
  }

  const patchTitle = title.replace(/^LKML:\s*[^:]+:\s*/i, '').replace(/^\[[^\]]+\]\s*/, '')
  
  try {
    const result = await withRetry(async () => {
      return await openai.chat.completions.create({
        model: config.openai.model,
        messages: [
          {
            role: 'system',
            content: '你是一个Linux内核开发专家。请根据补丁标题分析补丁信息。直接回答问题，不要输出思考过程。分析时要深入理解补丁的技术本质，提炼出核心改进点。'
          },
          {
            role: 'user',
            content: `补丁标题：${patchTitle}

请回答以下问题，每行一个答案：
1. 补丁类型（只回答：feature、bugfix 或 other）
2. 子系统（只回答：sched、mm、fs、net、driver、security、arch 或 other）
3. 是否重要（只回答：是 或 否）
4. 用一句话描述这个补丁的核心功能改进（20字以内，必须是有意义的描述，不能只是重复标题或文件名。要提炼出补丁的本质改进，例如：优化了XX性能、修复了XX条件下的崩溃、增加了XX新特性支持等）`
          }
        ],
        max_tokens: 150,
        temperature: 0.3,
      })
    }, `分析补丁: ${patchTitle.substring(0, 30)}...`)

    const rawContent = result.choices[0]?.message?.content || ''
    const cleaned = cleanAIResponse(rawContent)
    
    const lines = cleaned.split('\n').map(l => l.trim()).filter(l => l)
    
    let type: 'feature' | 'bugfix' | 'other' = 'other'
    const typeLine = lines[0] || ''
    if (typeLine.toLowerCase().includes('feature')) {
      type = 'feature'
    } else if (typeLine.toLowerCase().includes('bugfix') || typeLine.toLowerCase().includes('bug')) {
      type = 'bugfix'
    }
    console.log(`[AI] 补丁类型: ${type}`)

    let subsystem: 'sched' | 'mm' | 'fs' | 'net' | 'driver' | 'security' | 'arch' | 'other' = 'other'
    const subsystemLine = lines[1] || ''
    const subsystemMap: Record<string, typeof subsystem> = {
      'sched': 'sched', '调度': 'sched', 'scheduler': 'sched',
      'mm': 'mm', '内存': 'mm', 'memory': 'mm',
      'fs': 'fs', '文件': 'fs', 'filesystem': 'fs',
      'net': 'net', '网络': 'net', 'network': 'net',
      'driver': 'driver', '驱动': 'driver',
      'security': 'security', '安全': 'security',
      'arch': 'arch', '架构': 'arch', 'architecture': 'arch'
    }
    for (const [key, value] of Object.entries(subsystemMap)) {
      if (subsystemLine.toLowerCase().includes(key)) {
        subsystem = value
        break
      }
    }
    console.log(`[AI] 子系统: ${subsystem}`)

    const highlightLine = lines[2] || ''
    const highlight = highlightLine.includes('是') || highlightLine.toLowerCase().includes('yes')
    console.log(`[AI] 是否重点: ${highlight}`)

    let summary = lines[3] || ''
    if (!summary || summary.length < 5 || summary.toLowerCase().includes('convert') && summary.length < 30) {
      const patchTitleLower = patchTitle.toLowerCase()
      if (patchTitleLower.includes('fix') || patchTitleLower.includes('bug')) {
        summary = '修复了内核中的一个问题'
      } else if (patchTitleLower.includes('add') || patchTitleLower.includes('support')) {
        summary = '添加了新功能或支持'
      } else if (patchTitleLower.includes('remove') || patchTitleLower.includes('delete')) {
        summary = '移除了过时或冗余的代码'
      } else if (patchTitleLower.includes('update') || patchTitleLower.includes('improve')) {
        summary = '更新或改进了现有功能'
      } else if (patchTitleLower.includes('convert')) {
        summary = '将代码或文档转换为新的格式'
      } else if (patchTitleLower.includes('replace')) {
        summary = '替换了旧的实现方式'
      } else if (patchTitleLower.includes('clean') || patchTitleLower.includes('refactor')) {
        summary = '代码清理或重构'
      } else {
        summary = patchTitle.replace(/^\[[^\]]+\]\s*/, '').substring(0, 40)
      }
    }
    console.log(`[AI] 摘要: ${summary}`)

    return { type, subsystem, highlight, summary }
  } catch (error: any) {
    console.error('[AI] analyzePatch - 失败:', error.message)
    return defaultResult
  }
}

export async function summarizePatchDiscussion(
  patchTitle: string,
  patchContent: string,
  replies: { author: string; content: string }[]
): Promise<string> {
  if (!config.openai.apiKey) {
    console.log('[AI] summarizePatchDiscussion - API Key 未配置，跳过')
    return ''
  }

  if (replies.length === 0) {
    return ''
  }

  const repliesText = replies
    .map(r => `【${r.author}】${r.content.substring(0, 300)}`)
    .join('\n\n')

  try {
    const result = await withRetry(async () => {
      return await openai.chat.completions.create({
        model: config.openai.model,
        messages: [
          {
            role: 'system',
            content: '你是一个Linux内核开发专家。请总结以下补丁讨论的核心观点和结论。\n\n要求：\n1. 用中文回复\n2. 控制在150字以内\n3. 突出讨论的焦点和结论\n4. 不要输出思考过程'
          },
          {
            role: 'user',
            content: `原始补丁：${patchTitle}\n\n讨论内容：\n${repliesText}`
          }
        ],
        max_tokens: 300,
        temperature: 0.5,
      })
    }, `总结讨论: ${patchTitle.substring(0, 20)}...`)

    const rawContent = result.choices[0]?.message?.content || ''
    return cleanAIResponse(rawContent)
  } catch (error: any) {
    console.error('[AI] summarizePatchDiscussion - 最终失败:', error.message)
    return ''
  }
}
