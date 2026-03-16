import RSSParser from 'rss-parser'
import axios from 'axios'
import * as cheerio from 'cheerio'
import prisma from './db'
import { summarizeContent } from './ai'

interface SourceConfig {
  selector?: string
  titleSelector?: string
  linkSelector?: string
  contentSelector?: string
}

interface Source {
  id: string
  name: string
  type: string
  url: string
  config?: string
  active: boolean
}

export async function fetchRSS(source: Source) {
  try {
    const rssParser = new RSSParser()
    
    // 直接使用 parseURL 方法，不使用 signal 参数
    const feed = await rssParser.parseURL(source.url)
    
    const articles = []

    // 检查 feed.items 是否存在且可迭代
    if (!feed.items || !Array.isArray(feed.items)) {
      console.log(`RSS 源 [${source.name}] 没有可迭代的 items`)
      return articles
    }

    for (const item of feed.items) {
      const existingArticle = await prisma.article.findFirst({
        where: { url: item.link || '', sourceId: source.id }
      })

      if (existingArticle) continue

      const content = item.contentSnippet || item.content || ''
      // 使用 AI 生成摘要
      let summary = ''
      try {
        summary = await summarizeContent(item.title || '无标题', content)
      } catch (error) {
        console.error('生成摘要失败:', error)
        // 失败时使用内容前100字作为摘要
        summary = content.substring(0, 100) + '...'
      }

      // 处理中文乱码问题
      const title = item.title || '无标题'

      const article = await prisma.article.create({
        data: {
          sourceId: source.id,
          sourceName: source.name,
          sourceUrl: source.url,
          title: title,
          content,
          summary,
          url: item.link,
          author: item.creator || item.author,
          publishedAt: item.pubDate ? new Date(item.pubDate) : null,
        }
      })
      articles.push(article)
    }

    await prisma.source.update({
      where: { id: source.id },
      data: { lastFetched: new Date() }
    })

    return articles
  } catch (error) {
    console.error(`RSS抓取失败 [${source.name}]:`, error)
    throw error
  }
}

export async function fetchCrawler(source: Source) {
  try {
    const config: SourceConfig = source.config ? JSON.parse(source.config) : {}
    const response = await axios.get(source.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })
    const $ = cheerio.load(response.data)
    const articles = []

    const items = $(config.selector || 'article, .post, .item')
    
    for (const element of items.toArray()) {
      const $item = $(element)
      const titleEl = config.titleSelector ? $item.find(config.titleSelector) : $item.find('h1, h2, h3, .title, a')
      const linkEl = config.linkSelector ? $item.find(config.linkSelector) : $item.find('a')
      const contentEl = config.contentSelector ? $item.find(config.contentSelector) : $item.find('p, .content, .summary')

      const title = titleEl.first().text().trim()
      const link = linkEl.first().attr('href')
      const content = contentEl.first().text().trim()

      if (!title || !link) continue

      const fullUrl = link.startsWith('http') ? link : new URL(link, source.url).href

      const existingArticle = await prisma.article.findFirst({
        where: { url: fullUrl, sourceId: source.id }
      })

      if (existingArticle) continue

      // 使用 AI 生成摘要
      let summary = ''
      try {
        summary = await summarizeContent(title, content)
      } catch (error) {
        console.error('生成摘要失败:', error)
        // 失败时使用内容前100字作为摘要
        summary = content.substring(0, 100) + '...'
      }

      const article = await prisma.article.create({
        data: {
          sourceId: source.id,
          sourceName: source.name,
          sourceUrl: source.url,
          title,
          content,
          summary,
          url: fullUrl,
        }
      })
      articles.push(article)
    }

    await prisma.source.update({
      where: { id: source.id },
      data: { lastFetched: new Date() }
    })

    return articles
  } catch (error) {
    console.error(`爬虫抓取失败 [${source.name}]:`, error)
    throw error
  }
}

export async function fetchAllSources() {
  const sources = await prisma.source.findMany({
    where: { active: true }
  })

  const results = {
    success: 0,
    failed: 0,
    articles: [] as any[]
  }

  for (const source of sources) {
    try {
      let articles: any[] = []
      
      switch (source.type) {
        case 'rss':
          articles = await fetchRSS(source)
          break
        case 'crawler':
          articles = await fetchCrawler(source)
          break
        default:
          console.log(`跳过不支持的信息源类型: ${source.type}`)
      }

      results.success++
      results.articles.push(...articles)
    } catch (error) {
      results.failed++
    }
  }

  return results
}