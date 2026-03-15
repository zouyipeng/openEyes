import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
  baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
})

export async function summarizeContent(title: string, content: string): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    return 'AI总结功能未配置，请设置OPENAI_API_KEY'
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: '你是一个专业的信息总结助手。请用简洁的中文总结以下文章的核心内容，控制在100字以内。'
        },
        {
          role: 'user',
          content: `标题：${title}\n\n内容：${content}`
        }
      ],
      max_tokens: 200,
      temperature: 0.7,
    })

    return response.choices[0]?.message?.content || '无法生成总结'
  } catch (error) {
    console.error('AI总结失败:', error)
    return 'AI总结生成失败'
  }
}

export async function generateDailySummary(articles: { title: string; content?: string; sourceName: string }[]): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    return 'AI总结功能未配置'
  }

  if (articles.length === 0) {
    return '今日暂无新内容'
  }

  try {
    const articlesText = articles
      .slice(0, 20)
      .map(a => `【${a.sourceName}】${a.title}: ${a.content?.slice(0, 200) || ''}`)
      .join('\n\n')

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
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

    return response.choices[0]?.message?.content || '无法生成摘要'
  } catch (error) {
    console.error('每日摘要生成失败:', error)
    return '摘要生成失败'
  }
}

export async function extractKeywords(title: string, content: string): Promise<string[]> {
  if (!process.env.OPENAI_API_KEY) {
    return []
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: '请从以下文章中提取3-5个关键词，只返回关键词，用逗号分隔。'
        },
        {
          role: 'user',
          content: `标题：${title}\n\n内容：${content}`
        }
      ],
      max_tokens: 50,
      temperature: 0.5,
    })

    const keywords = response.choices[0]?.message?.content?.split(/[,，]/).map(k => k.trim()) || []
    return keywords.filter(k => k.length > 0)
  } catch (error) {
    console.error('关键词提取失败:', error)
    return []
  }
}
