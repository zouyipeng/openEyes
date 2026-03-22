import RSSParser from 'rss-parser'
import axios from 'axios'
import * as cheerio from 'cheerio'
import { spawn } from 'child_process'
import { 
  loadSources, 
  loadProcessedUrls,
  saveProcessedUrls,
  getTodayString,
  generateArticleId,
  saveDayData,
  saveAllCategoryData,
  loadDayData,
  loadGlobalConfig,
  loadSourcesConfig,
  type Source,
  type Article,
  type DayData,
  type LKMLMessage,
  type LKMLPatch,
  type GlobalConfig
} from './storage'
import { 
  summarizeArticlesInCategory, 
  generateCategorySummary, 
  analyzePatch, 
  summarizePatchDiscussion,
  clearAllCategoryContexts,
  summarizeContent
} from './ai'
import path from 'path'

interface FetchOptions {
  force?: boolean
  skipRefresh?: boolean
  category?: string
  debug?: boolean
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

async function isWeWeRSSRunning(): Promise<boolean> {
  try {
    await axios.get(WEWE_RSS_URL, { timeout: 5000 })
    return true
  } catch {
    return false
  }
}

async function startWeWeRSS(): Promise<boolean> {
  try {
    console.log('[Fetcher] 正在启动 WeWe RSS 服务...')
    const composePath = path.join(__dirname, '..', '..', '..', 'docker-compose.wewe-rss.yml')
    
    return new Promise((resolve) => {
      const process = spawn('docker-compose', ['-f', composePath, 'up', '-d'], {
        stdio: 'inherit'
      })
      
      process.on('close', (code) => {
        if (code === 0) {
          console.log('[Fetcher] WeWe RSS 服务启动成功')
          resolve(true)
        } else {
          console.error('[Fetcher] WeWe RSS 服务启动失败，退出码:', code)
          resolve(false)
        }
      })
      
      process.on('error', (error) => {
        console.error('[Fetcher] 启动 WeWe RSS 服务时发生错误:', error)
        resolve(false)
      })
    })
  } catch (error) {
    console.error('[Fetcher] 启动 WeWe RSS 服务失败:', error)
    return false
  }
}

async function waitForWeWeRSS(startupTime = 30000): Promise<boolean> {
  const startTime = Date.now()
  
  while (Date.now() - startTime < startupTime) {
    if (await isWeWeRSSRunning()) {
      return true
    }
    await new Promise(resolve => setTimeout(resolve, 2000))
    console.log('[Fetcher] 等待 WeWe RSS 服务启动...')
  }
  
  return false
}

async function refreshWeWeRSS(): Promise<boolean> {
  try {
    // 检查 WeWe RSS 服务是否运行
    if (!(await isWeWeRSSRunning())) {
      console.log('[Fetcher] WeWe RSS 服务未运行')
      
      // 尝试启动服务
      if (!(await startWeWeRSS())) {
        return false
      }
      
      // 等待服务启动
      if (!(await waitForWeWeRSS())) {
        console.error('[Fetcher] WeWe RSS 服务启动超时')
        return false
      }
    }
    
    // WeWe RSS 服务已运行，从日志分析看，它会自动刷新内容，无需外部刷新请求
    console.log('[Fetcher] WeWe RSS 服务已运行')
    return true
  } catch (error: any) {
    console.warn('[Fetcher] WeWe RSS 状态检查失败:', error.message || error)
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

    const article: Article = {
      id: generateArticleId(),
      sourceId: source.id,
      sourceName: source.name,
      sourceUrl: source.url,
      title: item.title || '无标题',
      content,
      url: articleUrl,
      author: item.creator,
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

export async function fetchLKML(source: Source, processedUrls: Set<string>, force: boolean = false, debug: boolean = false): Promise<Article[]> {
  const excludeAuthors = source.excludeAuthors || []
  const maxPatches = debug ? 2 : 100
  
  try {
    const today = new Date()
    const todayUrl = new URL(`/lkml/${today.getFullYear()}/${today.getMonth() + 1}/${today.getDate()}`, source.url).href
    
    console.log(`[Fetcher] LKML - 正在访问: ${todayUrl}`)
    
    const response = await axios.get(todayUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    })
    
    console.log(`[Fetcher] LKML - 响应状态: ${response.status}`)
    
    const $ = cheerio.load(response.data)
    const messages: LKMLMessage[] = []
    
    const messageEntries = $('table.mh tr.c0, table.mh tr.c1')
    
    console.log(`[Fetcher] LKML - 找到 ${messageEntries.length} 条消息`)
    
    for (const element of messageEntries.toArray()) {
      const $entry = $(element)
      const $tds = $entry.find('td')
      
      const $titleTd = $tds.eq(1)
      const $link = $titleTd.find('a:first-child')
      const $authorTd = $tds.eq(2)
      const $dateTd = $tds.eq(0)
      
      const title = $link.text().trim()
      const link = $link.attr('href')
      const author = $authorTd.find('a').text().trim() || $authorTd.text().trim()
      const dateStr = $dateTd.text().trim()
      
      if (!title || !link) continue
      
      if (title.toLowerCase().startsWith('re:')) {
        continue
      }
      
      if (excludeAuthors.some(ex => author.toLowerCase().includes(ex.toLowerCase()))) {
        console.log(`[Fetcher] LKML - 排除作者: ${author}`)
        continue
      }
      
      if (!title.toLowerCase().includes('patch') && 
          !title.toLowerCase().includes('diff') &&
          !title.toLowerCase().includes('git pull') &&
          !title.toLowerCase().includes('rfc')) {
        continue
      }
      
      const fullUrl = link.startsWith('http') ? link : new URL(link, source.url).href
      
      let parsedDate = new Date().toISOString()
      
      const urlDateMatch = fullUrl.match(/\/(\d{4})\/(\d{1,2})\/(\d{1,2})\//)
      if (urlDateMatch) {
        try {
          const year = parseInt(urlDateMatch[1])
          const month = parseInt(urlDateMatch[2]) - 1
          const day = parseInt(urlDateMatch[3])
          parsedDate = new Date(year, month, day).toISOString()
        } catch {
          console.log(`[Fetcher] LKML - URL日期解析失败: ${fullUrl}`)
        }
      } else if (dateStr) {
        try {
          const dateMatch = dateStr.match(/(\w{3})\s+(\d{1,2}),\s+(\d{4})/)
          if (dateMatch) {
            const monthMap: Record<string, number> = {
              'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
              'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
            }
            const month = monthMap[dateMatch[1]] || 0
            const day = parseInt(dateMatch[2])
            const year = parseInt(dateMatch[3])
            parsedDate = new Date(year, month, day).toISOString()
          } else {
            const shortDateMatch = dateStr.match(/(\w{3})\s+(\d{1,2})/)
            if (shortDateMatch) {
              const monthMap: Record<string, number> = {
                'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
                'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
              }
              const month = monthMap[shortDateMatch[1]] || 0
              const day = parseInt(shortDateMatch[2])
              const year = new Date().getFullYear()
              parsedDate = new Date(year, month, day).toISOString()
            }
          }
        } catch {
          console.log(`[Fetcher] LKML - 日期解析失败: ${dateStr}`)
        }
      }
      
      const message: LKMLMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        url: fullUrl,
        title,
        author,
        date: parsedDate,
        content: '',
        isReply: false
      }
      
      messages.push(message)
      
      if (messages.length >= maxPatches) {
        console.log(`[Fetcher] LKML - 已达到最大数量限制: ${maxPatches}`)
        break
      }
    }
    
    console.log(`[Fetcher] LKML - 解析到 ${messages.length} 条patch相关消息`)
    
    const articles: Article[] = []
    
    for (const msg of messages) {
      if (!force && processedUrls.has(msg.url)) {
        console.log(`[Fetcher] LKML - 跳过已处理: ${msg.title.substring(0, 50)}...`)
        continue
      }
      
      console.log(`[Fetcher] LKML - 处理补丁: ${msg.title.substring(0, 50)}...`)
      
      const content = `Linux内核邮件列表: ${msg.title}\n链接: ${msg.url}`
      
      const analysis = await analyzePatch(msg.title, content, source.aiPrompt)
      
      const patchData: LKMLPatch = {
        id: `patch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: msg.title,
        url: msg.url,
        author: msg.author,
        date: msg.date,
        content,
        subsystem: analysis.subsystem,
        type: analysis.type,
        highlight: analysis.highlight,
        summary: analysis.summary,
        messages: [msg],
        replyCount: 0
      }
      
      const article: Article = {
        id: generateArticleId(),
        sourceId: source.id,
        sourceName: source.name,
        sourceUrl: source.url,
        title: msg.title,
        content,
        summary: analysis.summary,
        url: msg.url,
        author: msg.author,
        fetchedAt: new Date().toISOString(),
        highlight: analysis.highlight,
        patchData
      }
      
      articles.push(article)
    }
    
    const sortedArticles = articles.sort((a, b) => {
      if (a.highlight && !b.highlight) return -1
      if (!a.highlight && b.highlight) return 1
      
      const typeOrder = { 'feature': 0, 'bugfix': 1, 'other': 2 }
      const aType = a.patchData?.type || 'other'
      const bType = b.patchData?.type || 'other'
      const aOrder = typeOrder[aType as keyof typeof typeOrder] ?? 2
      const bOrder = typeOrder[bType as keyof typeof typeOrder] ?? 2
      return aOrder - bOrder
    })
    
    console.log(`[Fetcher] LKML - 最终获取 ${sortedArticles.length} 篇文章 (${sortedArticles.filter(a => a.highlight).length} 篇重点)`)
    return sortedArticles
  } catch (error) {
    console.error(`LKML抓取失败 [${source.name}]:`, error)
    return []
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

      const article: Article = {
        id: generateArticleId(),
        sourceId: source.id,
        sourceName: source.name,
        sourceUrl: source.url,
        title,
        content,
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

export async function fetchAllSources(processedUrls: Set<string>, force: boolean = false, category?: string, debug: boolean = false): Promise<Article[]> {
  let sources = loadSources().filter(s => s.active)
  
  if (category) {
    sources = sources.filter(s => s.category === category)
    console.log(`[Fetcher] 只抓取分类 "${category}" 的 ${sources.length} 个信息源`)
  } else {
    console.log(`[Fetcher] 开始抓取所有 ${sources.length} 个信息源`)
  }

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
        case 'lkml':
          articles = await fetchLKML(source, processedUrls, force, debug)
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
  const { force = false, skipRefresh = false, category, debug = false } = options
  const todayStr = getTodayString()
  const sourcesConfig = loadSourcesConfig()
  const sources = sourcesConfig.sources.filter(s => s.active)
  const globalConfig = sourcesConfig.globalConfig
  
  console.log(`[Fetcher] 开始抓取并保存数据...`)
  console.log(`[Fetcher] 选项: force=${force}, skipRefresh=${skipRefresh}${category ? `, category=${category}` : ''}${debug ? ', debug=true' : ''}`)
  
  if (!skipRefresh) {
    await refreshWeWeRSS()
  } else {
    console.log('[Fetcher] 跳过 WeWe RSS 刷新')
  }
  
  const processedUrls = loadProcessedUrls()
  console.log(`[Fetcher] 已加载 ${processedUrls.size} 条已处理URL记录`)
  
  const newArticles = await fetchAllSources(processedUrls, force, category, debug)
  
  if (newArticles.length === 0) {
    console.log(`[Fetcher] 没有新文章，跳过保存`)
    return
  }
  
  newArticles.forEach(article => {
    if (article.url) {
      processedUrls.add(article.url)
    }
  })
  saveProcessedUrls(processedUrls)
  
  let allArticles: Article[]
  
  if (debug) {
    allArticles = newArticles
    console.log(`[Fetcher] Debug 模式: 不合并旧数据，仅处理新抓取的 ${newArticles.length} 篇文章`)
  } else {
    let existingDayData = loadDayData(todayStr)
    allArticles = [...newArticles]
    
    if (existingDayData && existingDayData.articles.length > 0) {
      const existingUrls = new Set(existingDayData.articles.map(a => a.url))
      const uniqueNewArticles = newArticles.filter(a => !existingUrls.has(a.url))
      
      allArticles = [...existingDayData.articles, ...uniqueNewArticles]
      console.log(`[Fetcher] 合并新旧文章: 已有 ${existingDayData.articles.length} 篇，新增 ${uniqueNewArticles.length} 篇，总计 ${allArticles.length} 篇`)
    } else {
      console.log(`[Fetcher] 新增 ${newArticles.length} 篇文章`)
    }
  }
  
  clearAllCategoryContexts()
  
  const categoryArticles: Record<string, Article[]> = {}
  const categorySummaries: Record<string, string> = {}
  
  allArticles.forEach(article => {
    const source = sources.find(s => s.id === article.sourceId)
    const cat = source?.category || '未分类'
    
    if (!categoryArticles[cat]) {
      categoryArticles[cat] = []
    }
    categoryArticles[cat].push(article)
  })
  
  if (debug) {
    for (const cat of Object.keys(categoryArticles)) {
      if (categoryArticles[cat].length > 5) {
        console.log(`[Fetcher] Debug 模式: 限制分类 ${cat} 的文章数量为 5 篇`)
        categoryArticles[cat] = categoryArticles[cat].slice(0, 5)
      }
    }
  }
  
  const sourcePrompts = new Map<string, string>()
  sources.forEach(source => {
    if (source.aiPrompt) {
      sourcePrompts.set(source.id, source.aiPrompt)
    }
  })
  
  console.log(`[AI] 开始按分类进行 AI 总结...`)
  
  for (const cat of Object.keys(categoryArticles)) {
    console.log(`[AI] 处理分类: ${cat} (${categoryArticles[cat].length} 篇文章)`)
    
    await summarizeArticlesInCategory(
      categoryArticles[cat],
      cat,
      globalConfig,
      sourcePrompts
    )
    
    const catSummary = await generateCategorySummary(
      categoryArticles[cat],
      cat,
      globalConfig
    )
    categorySummaries[cat] = catSummary
    console.log(`[AI] 分类 ${cat} 摘要生成完成`)
  }
  
  const dayData: DayData = {
    date: todayStr,
    generatedAt: new Date().toISOString(),
    summary: '',
    articles: allArticles,
    sources
  }
  
  saveDayData(dayData)
  
  saveAllCategoryData(allArticles, sources, todayStr, categorySummaries)
  
  console.log(`[Fetcher] 数据保存完成！`)
  console.log(`[Fetcher] - 日期: ${todayStr}`)
  console.log(`[Fetcher] - 文章数: ${allArticles.length}`)
  console.log(`[Fetcher] - 分类数: ${Object.keys(categoryArticles).length}`)
}
