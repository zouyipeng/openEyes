import axios from 'axios'
import * as cheerio from 'cheerio'
import simpleGit from 'simple-git'
import { 
  loadSourcesConfig,
  getTodayString,
  generateArticleId,
  saveSourceData,
  type Source,
  type Article,
  type LKMLMessage,
  type LKMLPatch,
  type GitCommit,
  type SourceDayData
} from './storage'
import { 
  generateSummary, 
  inferPatchTypeRuleBased,
} from './ai'

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
    const $entry = $(element)
    const $tds = $entry.find('td')

    const $statusTd = $tds.eq(0)
    const statusText = $statusTd.text().replace(/\s+/g, ' ').trim()
    if (!statusText.includes('[New]')) continue

    const $titleTd = $tds.eq(1)
    const $link = $titleTd.find('a:first-child')
    const $authorTd = $tds.eq(2)

    const title = $link.text().trim()
    const link = $link.attr('href')
    const author = $authorTd.find('a').text().trim() || $authorTd.text().trim()

    if (!title || !link) continue
    if (title.toLowerCase().startsWith('re:')) continue
    if (excludeAuthors.some(ex => author.toLowerCase().includes(ex.toLowerCase()))) continue

    if (
      !title.toLowerCase().includes('patch') &&
      !title.toLowerCase().includes('diff') &&
      !title.toLowerCase().includes('git pull') &&
      !title.toLowerCase().includes('rfc')
    ) continue

    const fullUrl = link.startsWith('http') ? link : new URL(link, source.url).href
    if (seenUrls.has(fullUrl)) continue

    let parsedDate = new Date().toISOString()
    const urlDateMatch = fullUrl.match(/\/(\d{4})\/(\d{1,2})\/(\d{1,2})\//)
    if (urlDateMatch) {
      try {
        const year = parseInt(urlDateMatch[1])
        const month = parseInt(urlDateMatch[2]) - 1
        const day = parseInt(urlDateMatch[3])
        const date = new Date(year, month, day)
        const hm = extractHourMinute(statusText)
        if (hm) date.setHours(hm.hour, hm.minute, 0, 0)
        parsedDate = date.toISOString()
      } catch {}
    }

    seenUrls.add(fullUrl)
    out.push({
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      url: fullUrl,
      title,
      author,
      date: parsedDate,
      content: '',
      isReply: false,
    })
  }
}

function parseLkmlPatchText(rawText: string): { commitMessage: string; changedFiles: string[] } {
  const normalized = rawText.replace(/\r/g, '').trim()
  if (!normalized) return { commitMessage: '', changedFiles: [] }

  const lines = normalized.split('\n').map(line => line.trimEnd())
  const dividerIndex = lines.findIndex(line => line.trim() === '---')
  const messageLines = dividerIndex >= 0 ? lines.slice(0, dividerIndex) : lines

  let commitMessage = messageLines.filter(line => line.trim().length > 0).join('\n').trim()
  if (!commitMessage || commitMessage.length < 10) {
    const cutByDiff = normalized.split(/\bdiff --git\b/i)[0]
    commitMessage = cutByDiff.split(/\n---\s|\s---\s/)[0].trim()
  }

  const changedFiles = new Set<string>()
  for (const line of lines) {
    const diffStatMatch = line.match(/^(.+?)\s+\|\s+\d+\s*[+\-]*\s*$/)
    if (diffStatMatch) {
      const filePath = diffStatMatch[1].trim()
      if (filePath && !filePath.includes('file changed')) changedFiles.add(filePath)
    }
    const diffGitMatch = line.match(/^diff --git a\/(.+?) b\/(.+)$/)
    if (diffGitMatch) changedFiles.add(diffGitMatch[2].trim())
  }

  return { commitMessage, changedFiles: Array.from(changedFiles) }
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
): Promise<{ commitMessage: string; changedFiles: string[]; sentAt: string | null }> {
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
      return { ...parsed, sentAt: parseDateTextToIso(dateText) }
    } catch (error: any) {
      const status = error?.response?.status
      if (attempt < 3 && (status === 429 || status >= 500 || error?.code === 'ECONNABORTED')) {
        await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt - 1)))
        continue
      }
      console.error(`[Fetcher] LKML - 获取补丁详情失败: ${patchUrl}`)
      return { commitMessage: '', changedFiles: [], sentAt: null }
    }
  }
  return { commitMessage: '', changedFiles: [], sentAt: null }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return []
  const results = new Array<R>(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor++
      if (index >= items.length) break
      results[index] = await mapper(items[index], index)
    }
  })
  await Promise.all(workers)
  return results
}

async function fetchLKML(source: Source): Promise<Article[]> {
  const excludeAuthors = source.excludeAuthors || []
  const concurrency = source.lkmlDetailConcurrency ?? 12
  const timeoutMs = source.lkmlDetailTimeoutMs ?? 8000

  try {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    const messages: LKMLMessage[] = []
    const seenUrls = new Set<string>()

    for (const { url, label } of [
      { url: buildLkmlDayPageUrl(source.url, yesterday), label: '昨日' },
      { url: buildLkmlDayPageUrl(source.url, today), label: '今日' },
    ]) {
      console.log(`[Fetcher] LKML - 正在访问 (${label}): ${url}`)
      try {
        const response = await axios.get(url, { headers, timeout: 10000 })
        collectLkmlPatchMessagesFromHtml(response.data, source, excludeAuthors, seenUrls, messages, label)
      } catch (pageErr) {
        console.error(`[Fetcher] LKML (${label}) 页面抓取失败:`, pageErr)
      }
    }

    console.log(`[Fetcher] LKML - 解析到 ${messages.length} 条 [New] patch 消息`)

    const articles: Article[] = []
    const batchSize = 80
    for (let start = 0; start < messages.length; start += batchSize) {
      const chunk = messages.slice(start, start + batchSize)
      const chunkArticles = await mapWithConcurrency(chunk, concurrency, async (msg) => {
        console.log(`[Fetcher] LKML - 处理补丁: ${msg.title.substring(0, 50)}...`)
        const patchDetails = await fetchLkmlPatchDetails(msg.url, headers, timeoutMs)
        
        const content = [
          `补丁标题: ${msg.title}`,
          `补丁链接: ${msg.url}`,
          '',
          'Commit message:',
          patchDetails.commitMessage || '未解析到 commit message',
          '',
          '修改的文件:',
          patchDetails.changedFiles.length > 0 
            ? patchDetails.changedFiles.map(f => `- ${f}`).join('\n')
            : '- 未解析到修改文件',
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

        return {
          id: generateArticleId(),
          sourceName: source.name,
          title: msg.title,
          content,
          url: msg.url,
          author: msg.author,
          fetchedAt: new Date().toISOString(),
          patchData,
        }
      })
      articles.push(...chunkArticles)
    }

    return articles.sort(
      (a, b) => new Date(b.patchData?.date || 0).getTime() - new Date(a.patchData?.date || 0).getTime()
    )
  } catch (error) {
    console.error(`LKML抓取失败 [${source.name}]:`, error)
    return []
  }
}

function inferSubsystemFromFiles(files: string[]): string {
  const patterns: Record<string, RegExp> = {
    'sched': /\/sched\/|\/kernel\/sched/,
    'mm': /\/mm\/|\/include\/linux\/mm\.h/,
    'fs': /\/fs\/|\/include\/linux\/fs\.h/,
    'net': /\/net\/|\/include\/linux\/net/,
    'driver': /\/drivers\//,
    'security': /\/security\/|\/include\/linux\/security/,
    'arch': /\/arch\//,
  }
  for (const [subsystem, pattern] of Object.entries(patterns)) {
    if (files.some(f => pattern.test(f))) return subsystem
  }
  return 'other'
}

async function fetchGitRepo(source: Source): Promise<Article[]> {
  const gitConfig = source.gitConfig
  if (!gitConfig?.localPath) {
    console.error(`[Fetcher] Git - 缺少 localPath 配置: ${source.name}`)
    return []
  }

  try {
    console.log(`[Fetcher] Git - 正在读取仓库: ${gitConfig.localPath}`)
    const git = simpleGit(gitConfig.localPath)
    
    if (!await git.checkIsRepo()) {
      console.error(`[Fetcher] Git - 不是有效的 Git 仓库: ${gitConfig.localPath}`)
      return []
    }

    const sinceDays = gitConfig.sinceDays || 7
    const maxCommits = gitConfig.maxCommits || 200
    const sinceDate = new Date()
    sinceDate.setDate(sinceDate.getDate() - sinceDays)
    const sinceStr = sinceDate.toISOString().split('T')[0]

    console.log(`[Fetcher] Git - 时间范围: ${sinceStr} 至今, 最大提交数: ${maxCommits}`)

    const logResult = await git.log(['--since', sinceStr, '--no-merges', `-${maxCommits}`])
    console.log(`[Fetcher] Git - 获取到 ${logResult.all.length} 个提交`)

    const articles: Article[] = []
    for (const commit of logResult.all) {
      const hash = commit.hash
      const shortHash = hash.substring(0, 7)
      const title = commit.message?.split('\n')[0] || ''
      const author = commit.author_name || ''
      const authorEmail = commit.author_email || ''
      const date = commit.date || ''

      let files: string[] = []
      let additions = 0
      let deletions = 0

      try {
        const diffResult = await git.diffSummary([`${hash}^`, hash])
        files = diffResult.files.map(f => f.file)
        additions = diffResult.insertions || 0
        deletions = diffResult.deletions || 0
      } catch {}

      const content = [
        `提交: ${shortHash}`,
        `作者: ${author} <${authorEmail}>`,
        `日期: ${date}`,
        `标题: ${title}`,
        '',
        '修改的文件:',
        ...files.slice(0, 20).map(f => `- ${f}`),
        files.length > 20 ? `... 还有 ${files.length - 20} 个文件` : '',
        '',
        `统计: +${additions} -${deletions}`
      ].filter(Boolean).join('\n')

      const type = inferPatchTypeRuleBased(title, content)
      const subsystem = inferSubsystemFromFiles(files)

      const gitCommitData: GitCommit = {
        hash,
        shortHash,
        title,
        author,
        authorEmail,
        date,
        content,
        files,
        additions,
        deletions,
        subsystem: subsystem as any,
        type: type as any,
        url: `https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/commit/?id=${hash}`
      }

      articles.push({
        id: generateArticleId(),
        sourceName: source.name,
        title,
        content,
        url: gitCommitData.url,
        author,
        fetchedAt: new Date().toISOString(),
        gitCommitData,
      })
    }

    return articles.sort(
      (a, b) => new Date(b.gitCommitData?.date || 0).getTime() - new Date(a.gitCommitData?.date || 0).getTime()
    )
  } catch (error) {
    console.error(`Git抓取失败 [${source.name}]:`, error)
    return []
  }
}

export async function fetchAll(): Promise<void> {
  const todayStr = getTodayString()
  const config = loadSourcesConfig()
  const sources = config.sources.filter(s => s.active)
  
  console.log(`[Fetcher] 开始抓取 ${sources.length} 个信息源...`)
  
  for (const source of sources) {
    try {
      console.log(`\n[Fetcher] 正在抓取: ${source.name} (${source.type})`)
      
      let articles: Article[]
      if (source.type === 'lkml') {
        articles = await fetchLKML(source)
      } else if (source.type === 'git') {
        articles = await fetchGitRepo(source)
      } else {
        console.log(`[Fetcher] 跳过不支持的信息源类型: ${source.type}`)
        continue
      }

      if (articles.length === 0) {
        console.log(`[Fetcher] ${source.name} 无数据`)
        continue
      }

      console.log(`[Fetcher] ${source.name} 完成，获取 ${articles.length} 条记录`)

      console.log(`[AI] 正在生成 ${source.name} 摘要...`)
      const summary = await generateSummary(articles, source.summaryPrompt)

      const sourceDayData: SourceDayData = {
        date: todayStr,
        sourceName: source.name,
        sourceType: source.type,
        generatedAt: new Date().toISOString(),
        summary,
        articles
      }

      saveSourceData(sourceDayData)
      console.log(`[Fetcher] ${source.name} 数据已保存`)
    } catch (error: any) {
      console.error(`[Fetcher] ${source.name} 抓取失败:`, error.message)
    }
  }
  
  console.log(`\n[Fetcher] 全部抓取完成！`)
}
