import RSSParser from 'rss-parser'
import axios from 'axios'
import * as cheerio from 'cheerio'
import prisma from './db'
import type { Source, SourceConfig } from '@/types'

const rssParser = new RSSParser()

export async function fetchRSS(source: Source) {
  try {
    const feed = await rssParser.parseURL(source.url)
    const articles = []

    for (const item of feed.items) {
      const existingArticle = await prisma.article.findFirst({
        where: { url: item.link || '', sourceId: source.id }
      })

      if (existingArticle) continue

      const article = await prisma.article.create({
        data: {
          sourceId: source.id,
          sourceName: source.name,
          sourceUrl: source.url,
          title: item.title || '无标题',
          content: item.contentSnippet || item.content || '',
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
    const config: SourceConfig = source.config ? JSON.parse(source.config as unknown as string) : {}
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

      const article = await prisma.article.create({
        data: {
          sourceId: source.id,
          sourceName: source.name,
          sourceUrl: source.url,
          title,
          content,
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
          articles = await fetchRSS(source as any)
          break
        case 'crawler':
          articles = await fetchCrawler(source as any)
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
