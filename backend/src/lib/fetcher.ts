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
  loadSourcesConfig,
  type Source,
  type Article,
  type DayData,
  type LKMLMessage,
  type LKMLPatch,
  type GlobalConfig
} from './storage'
import { 
  generateCategorySummary, 
  inferPatchTypeRuleBased,
  clearAllCategoryContexts,
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

function buildLkmlDayPageUrl(baseUrl: string, day: Date): string {
  return new URL(
    `/lkml/${day.getFullYear()}/${day.getMonth() + 1}/${day.getDate()}`,
    baseUrl
  ).href
}

function collectLkmlPatchMessagesFromHtml(
  html: string,
  source: Source,
  excludeAuthors: string[],
  seenUrls: Set<string>,
  out: LKMLMessage[],
  maxTotal: number | undefined,
  pageLabel: string
): void {
  const extractHourMinute = (text: string): { hour: number; minute: number } | null => {
    const timeMatch = text.match(/(\d{1,2}):(\d{2})(?::\d{2})?/)
    if (!timeMatch) return null
    const hour = parseInt(timeMatch[1], 10)
    const minute = parseInt(timeMatch[2], 10)
    if (Number.isNaN(hour) || Number.isNaN(minute)) return null
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
    return { hour, minute }
  }

  const $ = cheerio.load(html)
  const messageEntries = $('table.mh tr.c0, table.mh tr.c1')
  console.log(`[Fetcher] LKML (${pageLabel}) - 表格行数: ${messageEntries.length}`)

  for (const element of messageEntries.toArray()) {
    if (maxTotal !== undefined && out.length >= maxTotal) {
      console.log(`[Fetcher] LKML - 已达到最大数量限制: ${maxTotal}`)
      break
    }

    const $entry = $(element)
    const $tds = $entry.find('td')

    const $statusTd = $tds.eq(0)
    const statusText = $statusTd.text().replace(/\s+/g, ' ').trim()
    if (!statusText.includes('[New]')) {
      continue
    }

    const $titleTd = $tds.eq(1)
    const $link = $titleTd.find('a:first-child')
    const $authorTd = $tds.eq(2)

    const title = $link.text().trim()
    const link = $link.attr('href')
    const author = $authorTd.find('a').text().trim() || $authorTd.text().trim()
    const dateStr = statusText

    if (!title || !link) continue

    if (title.toLowerCase().startsWith('re:')) {
      continue
    }

    if (excludeAuthors.some(ex => author.toLowerCase().includes(ex.toLowerCase()))) {
      console.log(`[Fetcher] LKML - 排除作者: ${author}`)
      continue
    }

    if (
      !title.toLowerCase().includes('patch') &&
      !title.toLowerCase().includes('diff') &&
      !title.toLowerCase().includes('git pull') &&
      !title.toLowerCase().includes('rfc')
    ) {
      continue
    }

    const fullUrl = link.startsWith('http') ? link : new URL(link, source.url).href

    if (seenUrls.has(fullUrl)) {
      continue
    }

    let parsedDate = new Date().toISOString()

    const urlDateMatch = fullUrl.match(/\/(\d{4})\/(\d{1,2})\/(\d{1,2})\//)
    if (urlDateMatch) {
      try {
        const year = parseInt(urlDateMatch[1])
        const month = parseInt(urlDateMatch[2]) - 1
        const day = parseInt(urlDateMatch[3])
        const date = new Date(year, month, day)
        const hm = extractHourMinute(dateStr)
        if (hm) {
          date.setHours(hm.hour, hm.minute, 0, 0)
        }
        parsedDate = date.toISOString()
      } catch {
        console.log(`[Fetcher] LKML - URL日期解析失败: ${fullUrl}`)
      }
    } else if (dateStr) {
      try {
        const dateMatch = dateStr.match(/(\w{3})\s+(\d{1,2}),\s+(\d{4})/)
        if (dateMatch) {
          const monthMap: Record<string, number> = {
            Jan: 0,
            Feb: 1,
            Mar: 2,
            Apr: 3,
            May: 4,
            Jun: 5,
            Jul: 6,
            Aug: 7,
            Sep: 8,
            Oct: 9,
            Nov: 10,
            Dec: 11,
          }
          const month = monthMap[dateMatch[1]] || 0
          const day = parseInt(dateMatch[2])
          const year = parseInt(dateMatch[3])
          const date = new Date(year, month, day)
          const hm = extractHourMinute(dateStr)
          if (hm) {
            date.setHours(hm.hour, hm.minute, 0, 0)
          }
          parsedDate = date.toISOString()
        } else {
          const shortDateMatch = dateStr.match(/(\w{3})\s+(\d{1,2})/)
          if (shortDateMatch) {
            const monthMap: Record<string, number> = {
              Jan: 0,
              Feb: 1,
              Mar: 2,
              Apr: 3,
              May: 4,
              Jun: 5,
              Jul: 6,
              Aug: 7,
              Sep: 8,
              Oct: 9,
              Nov: 10,
              Dec: 11,
            }
            const month = monthMap[shortDateMatch[1]] || 0
            const day = parseInt(shortDateMatch[2])
            const year = new Date().getFullYear()
            const date = new Date(year, month, day)
            const hm = extractHourMinute(dateStr)
            if (hm) {
              date.setHours(hm.hour, hm.minute, 0, 0)
            }
            parsedDate = date.toISOString()
          }
        }
      } catch {
        console.log(`[Fetcher] LKML - 日期解析失败: ${dateStr}`)
      }
    }

    seenUrls.add(fullUrl)

    const message: LKMLMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      url: fullUrl,
      title,
      author,
      date: parsedDate,
      content: '',
      isReply: false,
    }

    out.push(message)
  }
}

function parseLkmlPatchText(rawText: string): { commitMessage: string; changedFiles: string[] } {
  const normalized = rawText.replace(/\r/g, '').trim()
  if (!normalized) {
    return { commitMessage: '', changedFiles: [] }
  }

  const lines = normalized.split('\n').map(line => line.trimEnd())
  const dividerIndex = lines.findIndex(line => line.trim() === '---')
  const messageLines = dividerIndex >= 0 ? lines.slice(0, dividerIndex) : lines

  let commitMessage = messageLines
    .filter(line => line.trim().length > 0)
    .join('\n')
    .trim()
  if (!commitMessage || commitMessage.length < 10) {
    const cutByDiff = normalized.split(/\bdiff --git\b/i)[0]
    const cutByDivider = cutByDiff.split(/\n---\s|\s---\s/)[0]
    commitMessage = cutByDivider.trim()
  }

  const changedFiles = new Set<string>()

  for (const line of lines) {
    const diffStatMatch = line.match(/^(.+?)\s+\|\s+\d+\s*[+\-]*\s*$/)
    if (diffStatMatch) {
      const filePath = diffStatMatch[1].trim()
      if (filePath && !filePath.includes('file changed')) {
        changedFiles.add(filePath)
      }
    }

    const diffGitMatch = line.match(/^diff --git a\/(.+?) b\/(.+)$/)
    if (diffGitMatch) {
      changedFiles.add(diffGitMatch[2].trim())
    }
  }

  if (changedFiles.size === 0) {
    const inlineDiffStatRegex = /([A-Za-z0-9_./\-]+)\s*\|\s*\d+\s*[+\-]*/g
    let match: RegExpExecArray | null
    while ((match = inlineDiffStatRegex.exec(normalized)) !== null) {
      const filePath = match[1]?.trim()
      if (filePath && !filePath.includes('file changed')) {
        changedFiles.add(filePath)
      }
    }
  }

  return {
    commitMessage,
    changedFiles: Array.from(changedFiles),
  }
}

function parseDateTextToIso(raw: string): string | null {
  if (!raw) return null
  const ts = Date.parse(raw)
  if (Number.isNaN(ts)) return null
  return new Date(ts).toISOString()
}

async function fetchLkmlPatchDetails(
  patchUrl: string,
  headers: Record<string, string>,
  timeoutMs: number
): Promise<{ commitMessage: string; changedFiles: string[]; sentAt: string | null; rateLimited: boolean }> {
  let lastStatus: number | undefined
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await axios.get(patchUrl, { headers, timeout: timeoutMs })
      const $ = cheerio.load(response.data)
      const rawPatchText = $('pre').first().text().trim()
      const parsed = parseLkmlPatchText(rawPatchText)
      const dateRow = $('tr').filter((_, tr) => {
        const firstCell = $(tr).find('th, td').first().text().replace(/\s+/g, ' ').trim()
        return firstCell === 'Date'
      }).first()
      const dateText = dateRow.find('td').last().text().replace(/\s+/g, ' ').trim()
      const sentAt = parseDateTextToIso(dateText)
      return { ...parsed, sentAt, rateLimited: false }
    } catch (error: any) {
      const status = error?.response?.status
      lastStatus = status
      const message = error?.message || String(error)
      const canRetry = attempt < 3 && (status === 429 || status >= 500 || error?.code === 'ECONNABORTED')
      if (canRetry) {
        const waitMs = 500 * Math.pow(2, attempt - 1)
        await new Promise(resolve => setTimeout(resolve, waitMs))
        continue
      }
      console.error(`[Fetcher] LKML - 获取补丁详情失败: ${patchUrl} - ${message}`)
      return { commitMessage: '', changedFiles: [], sentAt: null, rateLimited: status === 429 }
    }
  }
  return { commitMessage: '', changedFiles: [], sentAt: null, rateLimited: lastStatus === 429 }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return []
  const size = Math.max(1, Math.floor(limit))
  const results = new Array<R>(items.length)
  let cursor = 0

  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (true) {
      const index = cursor++
      if (index >= items.length) break
      results[index] = await mapper(items[index], index)
    }
  })

  await Promise.all(workers)
  return results
}

export async function fetchLKML(source: Source, processedUrls: Set<string>, force: boolean = false, debug: boolean = false): Promise<Article[]> {
  const excludeAuthors = source.excludeAuthors || []
  const maxPatches: number | undefined = debug ? 5 : undefined
  const configuredConcurrency = source.lkmlDetailConcurrency ?? 12
    let detailsConcurrency = debug ? Math.min(4, configuredConcurrency) : Math.max(1, configuredConcurrency)
  const detailTimeoutMs = source.lkmlDetailTimeoutMs ?? 8000

  try {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    const yesterdayUrl = buildLkmlDayPageUrl(source.url, yesterday)
    const todayUrl = buildLkmlDayPageUrl(source.url, today)

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    }

    const messages: LKMLMessage[] = []
    const seenUrls = new Set<string>()

    for (const { url, label } of [
      { url: yesterdayUrl, label: '昨日' },
      { url: todayUrl, label: '今日' },
    ]) {
      if (maxPatches !== undefined && messages.length >= maxPatches) break

      console.log(`[Fetcher] LKML - 正在访问 (${label}): ${url}`)
      try {
        const response = await axios.get(url, { headers, timeout: 10000 })
        console.log(`[Fetcher] LKML (${label}) - 响应状态: ${response.status}`)
        collectLkmlPatchMessagesFromHtml(
          response.data,
          source,
          excludeAuthors,
          seenUrls,
          messages,
          maxPatches,
          label
        )
      } catch (pageErr) {
        console.error(`[Fetcher] LKML (${label}) 页面抓取失败:`, pageErr)
      }
    }

    console.log(`[Fetcher] LKML - 解析到 ${messages.length} 条 [New] patch 消息（已去重）`)

    const candidateMessages = messages.filter(msg => {
      if (!force && processedUrls.has(msg.url)) {
        console.log(`[Fetcher] LKML - 跳过已处理: ${msg.title.substring(0, 50)}...`)
        return false
      }
      return true
    })
    console.log(
      `[Fetcher] LKML - 并发抓取补丁详情: ${candidateMessages.length} 条, 并发=${detailsConcurrency}, timeout=${detailTimeoutMs}ms`
    )

    const articles: Article[] = []
    const batchSize = 80
    for (let start = 0; start < candidateMessages.length; start += batchSize) {
      const chunk = candidateMessages.slice(start, start + batchSize)
      let rateLimitedInBatch = 0
      const chunkArticles = await mapWithConcurrency(
        chunk,
        detailsConcurrency,
        async (msg) => {
        console.log(`[Fetcher] LKML - 处理补丁: ${msg.title.substring(0, 50)}...`)

        const patchDetails = await fetchLkmlPatchDetails(msg.url, headers, detailTimeoutMs)
        if (patchDetails.rateLimited) {
          rateLimitedInBatch++
        }
        const filesSection =
          patchDetails.changedFiles.length > 0
            ? patchDetails.changedFiles.map(file => `- ${file}`).join('\n')
            : '- 未解析到修改文件'
        const commitMessageSection = patchDetails.commitMessage || '未解析到 commit message'

        const content = [
          `补丁标题: ${msg.title}`,
          `补丁链接: ${msg.url}`,
          '',
          'Commit message:',
          commitMessageSection,
          '',
          '修改的文件:',
          filesSection,
        ].join('\n')

        const type = inferPatchTypeRuleBased(msg.title, content)

        const patchData: LKMLPatch = {
          id: `patch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          title: msg.title,
          url: msg.url,
          author: msg.author,
          date: patchDetails.sentAt || msg.date,
          content,
          subsystem: 'other',
          type,
          highlight: false,
          summary: '',
          messages: [msg],
          replyCount: 0,
        }

        const article: Article = {
          id: generateArticleId(),
          sourceId: source.id,
          sourceName: source.name,
          sourceUrl: source.url,
          title: msg.title,
          content,
          summary: '',
          url: msg.url,
          author: msg.author,
          fetchedAt: new Date().toISOString(),
          highlight: false,
          patchData,
        }
        return article
      }
      )
      articles.push(...chunkArticles)

      const ratio = chunk.length > 0 ? rateLimitedInBatch / chunk.length : 0
      if (!debug && ratio >= 0.12 && detailsConcurrency > 2) {
        const old = detailsConcurrency
        detailsConcurrency = Math.max(2, detailsConcurrency - 2)
        console.log(
          `[Fetcher] LKML - 检测到 429 偏高(${Math.round(ratio * 100)}%)，并发从 ${old} 自动降至 ${detailsConcurrency}`
        )
      }
    }

    const sortedArticles = articles.sort(
      (a, b) => new Date(b.patchData?.date || 0).getTime() - new Date(a.patchData?.date || 0).getTime()
    )

    console.log(`[Fetcher] LKML - 最终获取 ${sortedArticles.length} 篇文章`)
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

      if (debug && results.articles.length >= 15) {
        console.log(`[Fetcher] 调试模式: 已达到 15 篇文章限制，停止抓取`)
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
      if (force && newArticles.length > 0) {
        const byKey = new Map<string, Article>()
        const keyOf = (a: Article) => a.url || a.id
        for (const a of existingDayData.articles) {
          byKey.set(keyOf(a), a)
        }
        for (const a of newArticles) {
          byKey.set(keyOf(a), a)
        }
        allArticles = Array.from(byKey.values())
        console.log(
          `[Fetcher] force 合并: 同 URL/ID 以本次抓取为准，共 ${allArticles.length} 篇`
        )
      } else {
        const existingUrls = new Set(existingDayData.articles.map(a => a.url))
        const uniqueNewArticles = newArticles.filter(a => !existingUrls.has(a.url))

        allArticles = [...existingDayData.articles, ...uniqueNewArticles]
        console.log(
          `[Fetcher] 合并新旧文章: 已有 ${existingDayData.articles.length} 篇，新增 ${uniqueNewArticles.length} 篇，总计 ${allArticles.length} 篇`
        )
      }
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
  
  console.log(`[AI] 开始按分类进行 AI 总结...`)
  
  for (const cat of Object.keys(categoryArticles)) {
    console.log(`[AI] 处理分类: ${cat} (${categoryArticles[cat].length} 篇文章)`)

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
