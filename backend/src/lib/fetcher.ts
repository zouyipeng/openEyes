import RSSParser from 'rss-parser'
import axios from 'axios'
import * as cheerio from 'cheerio'
import { 
  loadSources, 
  loadArticlesByDate, 
  getTodayString,
  generateArticleId,
  type Source,
  type Article 
} from './storage'
import { summarizeContent } from './ai'

interface SourceConfig {
  selector?: string
  titleSelector?: string
  linkSelector?: string
  contentSelector?: string
}

export async function fetchRSS(source: Source): Promise<Article[]> {
  try {
    const rssParser = new RSSParser()
    const feed = await rssParser.parseURL(source.url)
    const articles: Article[] = []

    if (!feed.items || !Array.isArray(feed.items) || feed.items.length === 0) {
      console.log(`RSS 源 [${source.name}] 没有可迭代的 items`)
      return articles
    }

    const todayStr = getTodayString()
    const existingArticles = loadArticlesByDate(todayStr)
    const existingUrls = new Set(existingArticles.map(a => a.url))

    const item = feed.items[0]
    const articleUrl = item.link || ''

    if (existingUrls.has(articleUrl)) {
      console.log(`[Fetcher] ${source.name} - 文章已存在，跳过`)
      return articles
    }

    const content = item.contentSnippet || item.content || ''
    let summary = ''
    try {
      summary = await summarizeContent(item.title || '无标题', content)
    } catch (error) {
      console.error('生成摘要失败:', error)
      summary = content.substring(0, 100) + '...'
    }

    const article: Article = {
      id: generateArticleId(),
      sourceId: source.id,
      sourceName: source.name,
      sourceUrl: source.url,
      title: item.title || '无标题',
      content,
      summary,
      url: articleUrl,
      author: item.creator || item.author,
      publishedAt: item.pubDate,
      fetchedAt: new Date().toISOString()
    }

    articles.push(article)
    console.log(`[Fetcher] ${source.name} - 获取 1 篇文章`)

    return articles
  } catch (error) {
    console.error(`RSS抓取失败 [${source.name}]:`, error)
    throw error
  }
}

export async function fetchCrawler(source: Source): Promise<Article[]> {
  try {
    const config: SourceConfig = source.config ? JSON.parse(source.config as any) : {}
    const response = await axios.get(source.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })
    const $ = cheerio.load(response.data)
    const articles: Article[] = []

    const todayStr = getTodayString()
    const existingArticles = loadArticlesByDate(todayStr)
    const existingUrls = new Set(existingArticles.map(a => a.url))

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

      if (existingUrls.has(fullUrl)) continue

      let summary = ''
      try {
        summary = await summarizeContent(title, content)
      } catch (error) {
        console.error('生成摘要失败:', error)
        summary = content.substring(0, 100) + '...'
      }

      const article: Article = {
        id: generateArticleId(),
        sourceId: source.id,
        sourceName: source.name,
        sourceUrl: source.url,
        title,
        content,
        summary,
        url: fullUrl,
        fetchedAt: new Date().toISOString()
      }

      articles.push(article)
    }

    return articles
  } catch (error) {
    console.error(`爬虫抓取失败 [${source.name}]:`, error)
    throw error
  }
}

export async function fetchAllSources(): Promise<Article[]> {
  const sources = loadSources().filter(s => s.active)

  console.log(`[Fetcher] 开始抓取 ${sources.length} 个信息源`)

  const results = {
    success: 0,
    failed: 0,
    articles: [] as Article[],
    disabledSources: [] as string[]
  }

  for (const source of sources) {
    try {
      console.log(`[Fetcher] 正在抓取: ${source.name} (${source.type})`)
      let articles: Article[] = []

      switch (source.type) {
        case 'rss':
          articles = await fetchRSS(source)
          break
        case 'crawler':
          articles = await fetchCrawler(source)
          break
        default:
          console.log(`[Fetcher] 跳过不支持的信息源类型: ${source.type}`)
      }

      results.success++
      results.articles.push(...articles)
      console.log(`[Fetcher] ${source.name} 完成，获取 ${articles.length} 篇文章`)

      if (results.articles.length >= 15) {
        console.log(`[Fetcher] 已达到 15 篇文章限制，停止抓取`)
        break
      }
    } catch (error: any) {
      results.failed++
      console.error(`[Fetcher] ${source.name} 抓取失败:`, error.message)
      results.disabledSources.push(source.name)
    }
  }

  console.log(`[Fetcher] 抓取完成: 成功 ${results.success}, 失败 ${results.failed}, 共 ${results.articles.length} 篇文章`)
  if (results.disabledSources.length > 0) {
    console.log(`[Fetcher] 失败的信息源: ${results.disabledSources.join(', ')}`)
  }

  return results.articles
}
