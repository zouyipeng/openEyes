import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'

const configPath = path.join(__dirname, '../../config.json')
let config = {
  openai: {
    apiKey: '',
    baseURL: 'https://api.openai.com/v1',
    model: 'gpt-3.5-turbo'
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

function cleanAIResponse(content: string): string {
  let cleaned = content
  
  // 移除 <think...</think 格式
  cleaned = cleaned.replace(/<think[\s\S]*?<\/think>/gi, '')
  
  // 移除 <think 开头到结束的内容
  cleaned = cleaned.replace(/<think[\s\S]*$/gi, '')
  
  // 找到第一个 markdown 标题或列表项的位置
  const match = cleaned.search(/^(#{1,3}\s|\d+\.\s|###)/m)
  if (match > 0) {
    cleaned = cleaned.substring(match)
  }
  
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

export async function summarizeContent(title: string, content: string): Promise<string> {
  if (!config.openai.apiKey) {
    console.log('[AI] summarizeContent - API Key 未配置，跳过')
    return content.substring(0, 100) + '...'
  }

  const truncatedContent = content.length > 2000 ? content.substring(0, 2000) + '...' : content
  
  try {
    const result = await withRetry(async () => {
      return await openai.chat.completions.create({
        model: config.openai.model,
        messages: [
          {
            role: 'system',
            content: '你是一个专业的信息总结助手。请用简洁的中文总结以下文章的核心内容，控制在100字以内。'
          },
          {
            role: 'user',
            content: `标题：${title}\n\n内容：${truncatedContent}`
          }
        ],
        max_tokens: 200,
        temperature: 0.7,
      })
    }, `总结文章: ${title.substring(0, 30)}...`)

    const rawContent = result.choices[0]?.message?.content || '无法生成总结'
    return cleanAIResponse(rawContent)
  } catch (error: any) {
    console.error('[AI] summarizeContent - 最终失败:', error.message)
    return truncatedContent.substring(0, 100) + '...'
  }
}

export async function generateDailySummary(articles: { title: string; content?: string; sourceName: string }[]): Promise<string> {
  if (articles.length === 0) {
    return '今日暂无新内容'
  }

  const totalArticles = articles.length
  const sourceCount = new Set(articles.map(a => a.sourceName)).size
  
  if (!config.openai.apiKey) {
    console.log('[AI] generateDailySummary - API Key 未配置，使用默认摘要')
    return `今日共收集到${totalArticles}篇文章，来自${sourceCount}个信息源。内容涵盖科技、财经、商业等多个领域，为您提供全方位的信息资讯。`
  }

  try {
    const articlesText = articles
      .slice(0, 20)
      .map(a => `【${a.sourceName}】${a.title}: ${a.content?.slice(0, 200) || ''}`)
      .join('\n\n')

    const result = await withRetry(async () => {
      return await openai.chat.completions.create({
        model: config.openai.model,
        messages: [
          {
            role: 'system',
            content: '你是一个信息整合助手。请根据今日收集的文章，生成一份简洁的每日信息摘要，包括：1. 主要话题和趋势 2. 重要信息点 3. 推荐阅读。用中文回复，控制在300字以内。'
          },
          {
            role: 'user',
            content: `今日文章：\n${articlesText}`
          }
        ],
        max_tokens: 500,
        temperature: 0.7,
      })
    }, '生成每日摘要')

    const rawContent = result.choices[0]?.message?.content || '无法生成摘要'
    return cleanAIResponse(rawContent)
  } catch (error: any) {
    console.error('[AI] generateDailySummary - 最终失败:', error.message)
    return `今日共收集到${totalArticles}篇文章，来自${sourceCount}个信息源。内容涵盖科技、财经、商业等多个领域，为您提供全方位的信息资讯。`
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
            content: '请从以下文章中提取3-5个关键词，只返回关键词，用逗号分隔。'
          },
          {
            role: 'user',
            content: `标题：${title}\n\n内容：${truncatedContent}`
          }
        ],
        max_tokens: 50,
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
    baseURL: config.openai.baseURL
  }
}