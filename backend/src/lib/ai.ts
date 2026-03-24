import OpenAI from 'openai'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import fs from 'fs'
import path from 'path'
import { Article, GlobalConfig, loadGlobalConfig } from './storage'

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

/** 将「子系统动态」里的 Markdown 表格转为每条独立一行的列表，便于前端展示 */
function normalizeSubsystemDynamicsSection(text: string): string {
  const marker = '### 子系统动态'
  const idx = text.indexOf(marker)
  if (idx < 0) return text

  const head = text.slice(0, idx + marker.length)
  let rest = text.slice(idx + marker.length)
  const nextSection = rest.search(/\n### [^#]/)
  let sectionBody: string
  let tail: string
  if (nextSection >= 0) {
    sectionBody = rest.slice(0, nextSection).trim()
    tail = rest.slice(nextSection)
  } else {
    sectionBody = rest.trim()
    tail = ''
  }

  if (!sectionBody.includes('|')) {
    return text
  }

  const lines = sectionBody.split('\n').map(l => l.trim()).filter(Boolean)
  const bullets: string[] = []
  for (const line of lines) {
    if (!line.includes('|')) continue
    const cells = line
      .split('|')
      .map(c => c.trim())
      .filter(c => c.length > 0)
    if (cells.length < 2) continue
    const rowText = cells.join('')
    if (/^[-:\s|]+$/.test(rowText)) continue
    const [a, b, ...restCells] = cells
    if (a === '子系统' && (b === '变化' || b?.includes('变化'))) continue
    const right = [b, ...restCells].filter(Boolean).join('；')
    const left = a.replace(/\*\*/g, '').trim()
    if (left && right) {
      bullets.push(`- **${left}**：${right}`)
    }
  }

  if (bullets.length === 0) {
    return text
  }

  const newSection = `\n\n${bullets.join('\n')}\n`
  return head + newSection + tail
}

function normalizeParagraphToBullets(text: string): string {
  const cleaned = text.trim()
  if (!cleaned) return '- 暂无内容'

  const existingBullets = cleaned
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('- '))
  if (existingBullets.length >= 2) {
    return existingBullets.join('\n')
  }

  const roughParts = cleaned
    .replace(/\r/g, '')
    .split(/\n+|(?<=[。！？；;])\s+/)
    .map(s => s.trim())
    .filter(Boolean)

  const normalized = roughParts
    .map(p => p.replace(/^[-*]\s*/, '').trim())
    .filter(p => p.length > 0)
    .slice(0, 10)

  if (normalized.length === 0) return '- 暂无内容'
  return normalized.map(p => `- ${p}`).join('\n')
}

function linuxOverviewHeadingWithModel(): string {
  const model = config.openai.model?.trim() || 'unknown'
  return `### 今日社区动态（${model}）`
}

function normalizeCategorySummary(content: string, category?: string): string {
  const cleaned = cleanAIResponse(content)
  if (!cleaned) return ''

  if (category === 'linux kernel') {
    const hasOverallSections =
      (cleaned.includes('今日补丁概览') || cleaned.includes('今日社区动态')) &&
      cleaned.includes('总体评价')
    if (hasOverallSections) {
      const blockAfterOverview = cleaned.split(/#{1,6}\s*(今日补丁概览|今日社区动态)\s*/)[2] || ''
      const overviewPart = blockAfterOverview.split(/#{1,6}\s*总体评价\s*/)[0]?.trim() || ''
      const reviewPart = cleaned.split(/#{1,6}\s*总体评价\s*/)[1]?.trim() || ''
      return [
        linuxOverviewHeadingWithModel(),
        normalizeParagraphToBullets(overviewPart || '今日补丁覆盖多个子系统，以修复与维护为主。'),
        '',
        '### 总体评价',
        normalizeParagraphToBullets(reviewPart || '整体改动风险可控，建议重点关注跨子系统依赖与回归验证。'),
      ].join('\n')
    }

    // 兼容旧结构：若模型仍输出「重点补丁/子系统动态」，保持原样（不再强制依赖）
    const hasLegacySections =
      cleaned.includes('### 重点补丁') && cleaned.includes('### 子系统动态')
    if (hasLegacySections) {
      return normalizeSubsystemDynamicsSection(cleaned)
    }

    const lines = cleaned
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
    const overview = lines.slice(0, 5).join(' ')
    const review = lines.slice(5).join(' ')
    return [
      linuxOverviewHeadingWithModel(),
      normalizeParagraphToBullets(overview || '今日补丁覆盖多个子系统，以修复与维护为主。'),
      '',
      '### 总体评价',
      normalizeParagraphToBullets(review || '整体改动风险可控，建议重点关注跨子系统依赖与回归验证。'),
    ].join('\n')
  }

  let result: string
  const hasKeySections =
    cleaned.includes('### 重点补丁') && cleaned.includes('### 子系统动态')
  if (hasKeySections) {
    result = cleaned
  } else {
    const lines = cleaned
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)

    const bullets = lines.map(line => (line.startsWith('- ') ? line : `- ${line}`))
    const primary = bullets.slice(0, 3)
    const secondary = bullets.slice(3)

    result = [
      '### 重点补丁',
      primary.length > 0 ? primary.join('\n') : '- 暂无重点补丁',
      '',
      '### 子系统动态',
      secondary.length > 0 ? secondary.join('\n') : '- 暂无子系统变化',
    ].join('\n')
  }

  return normalizeSubsystemDynamicsSection(result)
}

/** 与前端 `lkmlAnchorId` 规则一致，用于分类摘要中的 #fragment */
export function lkmlAnchorFragmentId(articleId: string): string {
  return `lkml-${articleId.replace(/[^a-zA-Z0-9_-]/g, '_')}`
}

function normalizeTitleForMatch(title: string): string {
  return title
    .toLowerCase()
    .replace(/\[[^\]]*\]\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function scoreTitleMatch(bulletNorm: string, titleNorm: string): number {
  if (!bulletNorm || !titleNorm) return 0
  const maxLen = Math.min(120, bulletNorm.length, titleNorm.length)
  let prefix = 0
  for (let i = 0; i < maxLen && bulletNorm[i] === titleNorm[i]; i++) prefix++
  if (titleNorm.includes(bulletNorm)) return Math.max(bulletNorm.length, prefix)
  if (bulletNorm.includes(titleNorm)) return Math.max(titleNorm.length, prefix)
  return prefix
}

function escapeMarkdownLinkLabel(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\]/g, '\\]').replace(/\[/g, '\\[')
}

/** 将「重点补丁」下的列表项改为指向下方补丁卡片的 Markdown 锚点链接 */
export function linkifyLinuxKernelPrimaryPatches(markdown: string, articles: Article[]): string {
  const marker = '### 重点补丁'
  const idx = markdown.indexOf(marker)
  if (idx < 0 || articles.length === 0) return markdown

  const afterMarker = markdown.slice(idx + marker.length)
  const nextH = afterMarker.search(/\n### [^#]/)
  const sectionBody = nextH >= 0 ? afterMarker.slice(0, nextH) : afterMarker
  const tail = nextH >= 0 ? afterMarker.slice(nextH) : ''

  const candidates = articles.map(a => ({
    id: a.id,
    norm: normalizeTitleForMatch(a.title),
  }))
  const used = new Set<string>()
  let fallbackIndex = 0

  const lines = sectionBody.split('\n')
  const outLines = lines.map(line => {
    const trimmed = line.trim()
    if (!trimmed.startsWith('-')) return line

    const raw = trimmed.replace(/^-\s+/, '').trim()
    if (/^\[.*\]\(#lkml-/.test(raw) || raw.includes('](#lkml-')) {
      return line
    }

    const plainForMatch = raw
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/^([^：:]+)[：:]\s+/, '')
      .trim()
    const bulletNorm = normalizeTitleForMatch(plainForMatch.length >= 8 ? plainForMatch : raw)

    let best: { id: string; score: number } | null = null
    for (const c of candidates) {
      if (used.has(c.id)) continue
      const s = scoreTitleMatch(bulletNorm, c.norm)
      if (!best || s > best.score) best = { id: c.id, score: s }
    }

    if (!best || best.score < 12) {
      while (fallbackIndex < candidates.length && used.has(candidates[fallbackIndex].id)) {
        fallbackIndex++
      }
      if (fallbackIndex >= candidates.length) return line
      best = { id: candidates[fallbackIndex].id, score: 0 }
      fallbackIndex++
    }

    const frag = lkmlAnchorFragmentId(best.id)
    used.add(best.id)
    return `- [${escapeMarkdownLinkLabel(raw)}](#${frag})`
  })

  return markdown.slice(0, idx + marker.length) + outLines.join('\n') + tail
}

function appendLinuxKernelFeatureLinks(markdown: string, articles: Article[]): string {
  if (articles.length === 0) return markdown
  if (!markdown.includes('### 今日补丁概览') && !markdown.includes('### 今日社区动态')) return markdown

  const featureArticles = articles
    .filter(a => a.patchData?.type === 'feature')
    .slice(0, 6)

  if (featureArticles.length === 0) return markdown

  const afterOverview = markdown.split(/#{1,6}\s*(今日补丁概览|今日社区动态)(?:（模型：[^\n）]+）)?\s*/)
  if (afterOverview.length < 3) return markdown

  const overviewAndTail = afterOverview[2]
  const reviewMatch = overviewAndTail.match(/\n#{1,6}\s*总体评价\s*/)
  if (!reviewMatch || reviewMatch.index === undefined) {
    return markdown
  }

  const splitAt = reviewMatch.index
  const overviewBody = overviewAndTail.slice(0, splitAt)
  const tail = overviewAndTail.slice(splitAt)
  if (overviewBody.includes('](#lkml-')) return markdown

  const overviewLines = overviewBody
    .split('\n')
    .map(line => line.trimEnd())
    .filter(Boolean)
  const parentBulletIdx: number[] = []
  overviewLines.forEach((line, idx) => {
    if (/^- /.test(line)) {
      parentBulletIdx.push(idx)
    }
  })
  if (parentBulletIdx.length === 0) return markdown

  const scoreLineForFeature = (line: string, title: string): number => {
    const lowerLine = line.toLowerCase()
    const lowerTitle = title.toLowerCase()
    let score = 0
    const rules: Array<{ line: RegExp; title: RegExp }> = [
      { line: /(网络|net|ethernet|switch|虚拟化)/i, title: /(net|ethernet|switch|nic|tcp|udp|ovs|openvswitch|qede|bnxt|mana)/i },
      { line: /(驱动|硬件|外设|平台|i2c|adc|hwmon|音频|soundwire)/i, title: /(driver|i2c|adc|hwmon|sound|audio|codec|pcie|phy|sensor|platform)/i },
      { line: /(图形|显示|多媒体|drm|gpu|camera)/i, title: /(drm|gpu|display|camera|media|panthor|msm)/i },
      { line: /(文件系统|存储|fs|ext4|f2fs|btrfs|ntfs|xfs)/i, title: /(fs|ext4|f2fs|btrfs|ntfs|xfs|erofs|storage)/i },
      { line: /(架构|risc|arm|loongarch)/i, title: /(risc|arm|loongarch|arch|dts)/i },
      { line: /(新特性|新增|支持|生态|趋势|总体)/i, title: /(add|support|enable|new|introduce|feature)/i },
    ]
    for (const r of rules) {
      if (r.line.test(lowerLine) && r.title.test(lowerTitle)) {
        score += 3
      }
    }
    const titleTokens = lowerTitle.split(/[^a-z0-9]+/).filter(t => t.length >= 3).slice(0, 8)
    for (const token of titleTokens) {
      if (lowerLine.includes(token)) score += 1
    }
    return score
  }

  const linksByParent = new Map<number, string[]>()
  for (const a of featureArticles) {
    const link = `[${escapeMarkdownLinkLabel(a.title)}](#${lkmlAnchorFragmentId(a.id)})`
    let bestParent = parentBulletIdx[parentBulletIdx.length - 1]
    let bestScore = -1
    for (const idx of parentBulletIdx) {
      const s = scoreLineForFeature(overviewLines[idx], a.title)
      if (s > bestScore) {
        bestScore = s
        bestParent = idx
      }
    }
    const arr = linksByParent.get(bestParent) || []
    arr.push(link)
    linksByParent.set(bestParent, arr)
  }

  const outLines: string[] = []
  for (let i = 0; i < overviewLines.length; i++) {
    const links = linksByParent.get(i)
    if (links && links.length > 0) {
      const inlineLinks = links.slice(0, 4).join(' ')
      outLines.push(`${overviewLines[i]} ${inlineLinks}`)
    } else {
      outLines.push(overviewLines[i])
    }
  }

  return `${afterOverview[0]}${linuxOverviewHeadingWithModel()}\n${outLines.join('\n')}\n${tail}`
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

export function clearAllCategoryContexts(): void {
  categoryContextCache.clear()
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
    const maxArticlesForSummary = category === 'linux kernel' ? 120 : 40
    const articlesText = articles
      .slice(0, maxArticlesForSummary)
      .map(a => `【${a.sourceName}】${a.title}${a.summary ? ': ' + a.summary.substring(0, 100) : ''}`)
      .join('\n\n')

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: prompt },
      ...context.messages.slice(-6).map(m => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      })),
      {
        role: 'user',
        content: `请为以下${category}分类的文章生成摘要。\n总文章数：${totalArticles}\n本次提供样本数：${Math.min(
          totalArticles,
          maxArticlesForSummary
        )}\n请在总结中体现“总量”和“整体趋势”，不要误写成仅有样本数。\n\n${articlesText}`,
      }
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
    let normalized = normalizeCategorySummary(rawContent, category)
    if (category === 'linux kernel' && articles.length > 0) {
      normalized = appendLinuxKernelFeatureLinks(normalized, articles)
      if (normalized.includes('### 重点补丁')) {
        normalized = linkifyLinuxKernelPrimaryPatches(normalized, articles)
      }
    }
    return normalized || `今日共收集到${totalArticles}篇文章，来自${sourceCount}个信息源。`
  } catch (error: any) {
    console.error('[AI] generateCategorySummary - 最终失败:', error.message)
    return `今日共收集到${totalArticles}篇文章，来自${sourceCount}个信息源。`
  }
}

export async function generateDailySummary(
  articles: { title: string; content?: string; sourceName: string }[]
): Promise<string> {
  const normalizedArticles: Article[] = articles.map((article, index) => ({
    id: `summary_${index}`,
    sourceId: article.sourceName,
    sourceName: article.sourceName,
    title: article.title,
    content: article.content,
    fetchedAt: new Date().toISOString(),
  }))

  const globalConfig = loadGlobalConfig()
  return generateCategorySummary(normalizedArticles, 'daily', globalConfig)
}

/**
 * 根据补丁主题行与正文（含 commit message）用规则推断类型，不调用 AI。
 * `title` 建议为原始主题（可含 `[PATCH]`），或至少保留 `子系统: 动词 ...` 段。
 */
export function inferPatchTypeRuleBased(title: string, body: string): 'feature' | 'bugfix' | 'other' {
  const combined = `${title}\n${body}`
  const lower = combined.toLowerCase()

  const bugfixInSubject =
    /\[patch[^\]]*\]\s*[^:]+:\s*(fix|fixes)\b/i.test(title) ||
    /^[^:]+:\s*(fix|fixes)\b/i.test(title.trim())
  const bugfixInText =
    /\b(fix(es|ed|ing)?|fixes:)\b/.test(lower) ||
    /\b(data\s+race|race\s+condition|kcsan)\b/.test(lower) ||
    /\b(leak|memory\s+leak|refcount)\b/.test(lower) ||
    /\b(crash|oops|panic|null\s*deref|null\s*pointer|use[-\s]after[-\s]free|\buaf\b)\b/.test(lower) ||
    /\b(overflow|underflow|deadlock|hang)\b/.test(lower) ||
    /\b(syzbot|regression)\b/.test(lower)

  const featureInSubject =
    /\[patch[^\]]*\]\s*[^:]+:\s*(add|adds|implement|introduce|support|enable)\b/i.test(title) ||
    /^[^:]+:\s*(add|adds|implement|introduce|support|enable)\b/i.test(title.trim())
  const featureInText =
    /\b(add(s|ing)?\s+support|implement(s|ed|ing)?|introduce(s|d)?)\b/.test(lower) ||
    /\benable\s+(new|the|a)\b/.test(lower) ||
    /\bnew\s+(driver|subsystem|api|helper|interface)\b/.test(lower)

  if (bugfixInSubject || bugfixInText) return 'bugfix'
  if (featureInSubject || featureInText) return 'feature'
  return 'other'
}

