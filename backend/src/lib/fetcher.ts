import RSSParser from 'rss-parser'
import axios from 'axios'
import * as cheerio from 'cheerio'
import { 
  loadSources, 
  loadProcessedUrls,
  saveProcessedUrls,
  getTodayString,
  generateArticleId,
  saveDayData,
  saveAllCategoryData,
  type Source,
  type Article,
  type DayData 
} from './storage'
import { summarizeContent, generateDailySummary } from './ai'

interface FetchOptions {
  force?: boolean
  skipRefresh?: boolean
}

interface SourceConfig {
  selector?: string
  titleSelector?: string
  linkSelector?: string
  contentSelector?: string
}

const WEWE_RSS_URL = process.env.WEWE_RSS_URL || 'http://localhost:4000'

function extractTextFromHtml(html: string): string {
  const $ = cheerio.load(html)
  
  const richMediaContent = $('#js_content, .rich_media_content, .js_name, #js_name')
  
  if (richMediaContent.length > 0) {
    richMediaContent.find('script, style, noscript').remove()
    return richMediaContent.text().replace(/\s+/g, ' ').trim()
  }
  
  const articleContent = $('article, .article-content, .post-content, .entry-content')
  if (articleContent.length > 0) {
    articleContent.find('script, style, noscript').remove()
    return articleContent.text().replace(/\s+/g, ' ').trim()
  }
  
  $('script, style, noscript, head, nav, footer, aside').remove()
  return $('body').text().replace(/\s+/g, ' ').trim()
}

function cleanContent(content: string): string {
  return content
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim()
    .substring(0, 8000)
}

async function refreshWeWeRSS(): Promise<boolean> {
  try {
    console.log('[Fetcher] 正在刷新 WeWe RSS...')
    const response = await axios.post(`${WEWE_RSS_URL}/api/refresh`, {}, {
      timeout: 30000
    })
    console.log('[Fetcher] WeWe RSS 刷新成功')
    return true
  } catch (error: any) {
    console.warn('[Fetcher] WeWe RSS 刷新失败:', error.message || error)
    return false
  }
}

export async function fetchRSS(source: Source, processedUrls: Set<string>, force: boolean = false): Promise<Article[]> {
  try {
    const rssParser = new RSSParser({
      customFields: {
        item: ['content:encoded', 'encoded']
      }
    })
    const feed = await rssParser.parseURL(source.url)
    const articles: Article[] = []

    if (!feed.items || !Array.isArray(feed.items) || feed.items.length === 0) {
      console.log(`RSS 源 [${source.name}] 没有可迭代的 items`)
      return articles
    }

    const item = feed.items[0]
    const articleUrl = item.link || ''

    if (!force && processedUrls.has(articleUrl)) {
      console.log(`[Fetcher] ${source.name} - 文章已处理过，跳过`)
      return articles
    }

    let rawContent = ''
    const encodedContent = (item as any)['content:encoded'] || (item as any).encoded || ''
    
    if (encodedContent) {
      rawContent = extractTextFromHtml(encodedContent)
    }
    
    if (!rawContent || rawContent.length < 100) {
      rawContent = item.contentSnippet || item.content || ''
    }
    
    const content = cleanContent(rawContent)
    
    let summary = ''
    try {
      if (content && content.length > 50) {
        summary = await summarizeContent(item.title || '无标题', content)
      } else {
        summary = content.substring(0, 100) + '...'
      }
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
    console.log(`[Fetcher] ${source.name} - 获取 1 篇文章 (内容长度: ${content.length} 字符)`)

    return articles
  } catch (error) {
    console.error(`RSS抓取失败 [${source.name}]:`, error)
    throw error
  }
}

export async function fetchCrawler(source: Source, processedUrls: Set<string>, force: boolean = false): Promise<Article[]> {
  try {
    const config: SourceConfig = source.config ? JSON.parse(source.config as any) : {}
    const response = await axios.get(source.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })
    const $ = cheerio.load(response.data)
    const articles: Article[] = []

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

      if (!force && processedUrls.has(fullUrl)) continue

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

export async function fetchAllSources(processedUrls: Set<string>, force: boolean = false): Promise<Article[]> {
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
          articles = await fetchRSS(source, processedUrls, force)
          break
        case 'crawler':
          articles = await fetchCrawler(source, processedUrls, force)
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

export async function fetchAndSave(options: FetchOptions = {}): Promise<void> {
  const { force = false, skipRefresh = false } = options
  const todayStr = getTodayString()
  const sources = loadSources().filter(s => s.active)
  
  console.log(`[Fetcher] 开始抓取并保存数据...`)
  console.log(`[Fetcher] 选项: force=${force}, skipRefresh=${skipRefresh}`)
  
  if (!skipRefresh) {
    await refreshWeWeRSS()
  } else {
    console.log('[Fetcher] 跳过 WeWe RSS 刷新')
  }
  
  const processedUrls = loadProcessedUrls()
  console.log(`[Fetcher] 已加载 ${processedUrls.size} 条已处理URL记录`)
  
  const articles = await fetchAllSources(processedUrls, force)
  
  if (articles.length === 0) {
    console.log(`[Fetcher] 没有新文章，跳过保存`)
    return
  }
  
  articles.forEach(article => {
    if (article.url) {
      processedUrls.add(article.url)
    }
  })
  saveProcessedUrls(processedUrls)
  
  console.log(`[AI] 生成每日摘要...`)
  const summary = await generateDailySummary(articles.map(a => ({
    title: a.title,
    content: a.content,
    sourceName: a.sourceName
  })))
  
  const dayData: DayData = {
    date: todayStr,
    generatedAt: new Date().toISOString(),
    summary,
    articles,
    sources
  }
  
  saveDayData(dayData)
  
  const categorySummaries: Record<string, string> = {}
  const categoryArticles: Record<string, Article[]> = {}
  
  articles.forEach(article => {
    const source = sources.find(s => s.id === article.sourceId)
    const category = source?.category || '未分类'
    
    if (!categoryArticles[category]) {
      categoryArticles[category] = []
    }
    categoryArticles[category].push(article)
  })
  
  for (const category of Object.keys(categoryArticles)) {
    if (categoryArticles[category].length > 0) {
      try {
        const catSummary = await generateDailySummary(
          categoryArticles[category].map(a => ({
            title: a.title,
            content: a.content,
            sourceName: a.sourceName
          }))
        )
        categorySummaries[category] = catSummary
      } catch (error) {
        console.error(`[AI] 生成 ${category} 分类摘要失败:`, error)
      }
    }
  }
  
  saveAllCategoryData(articles, sources, todayStr, categorySummaries)
  
  console.log(`[Fetcher] 数据保存完成！`)
  console.log(`[Fetcher] - 日期: ${todayStr}`)
  console.log(`[Fetcher] - 文章数: ${articles.length}`)
  console.log(`[Fetcher] - 分类数: ${Object.keys(categoryArticles).length}`)
}
