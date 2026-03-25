"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchLKML = fetchLKML;
exports.fetchGitRepo = fetchGitRepo;
exports.fetchAllSources = fetchAllSources;
exports.fetchAndSave = fetchAndSave;
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
const simple_git_1 = __importDefault(require("simple-git"));
const storage_1 = require("./storage");
const ai_1 = require("./ai");
function buildLkmlDayPageUrl(baseUrl, day) {
    return new URL(`/lkml/${day.getFullYear()}/${day.getMonth() + 1}/${day.getDate()}`, baseUrl).href;
}
function collectLkmlPatchMessagesFromHtml(html, source, excludeAuthors, seenUrls, out, maxTotal, pageLabel) {
    const extractHourMinute = (text) => {
        const timeMatch = text.match(/(\d{1,2}):(\d{2})(?::\d{2})?/);
        if (!timeMatch)
            return null;
        const hour = parseInt(timeMatch[1], 10);
        const minute = parseInt(timeMatch[2], 10);
        if (Number.isNaN(hour) || Number.isNaN(minute))
            return null;
        if (hour < 0 || hour > 23 || minute < 0 || minute > 59)
            return null;
        return { hour, minute };
    };
    const $ = cheerio.load(html);
    const messageEntries = $('table.mh tr.c0, table.mh tr.c1');
    console.log(`[Fetcher] LKML (${pageLabel}) - 表格行数: ${messageEntries.length}`);
    for (const element of messageEntries.toArray()) {
        if (maxTotal !== undefined && out.length >= maxTotal) {
            console.log(`[Fetcher] LKML - 已达到最大数量限制: ${maxTotal}`);
            break;
        }
        const $entry = $(element);
        const $tds = $entry.find('td');
        const $statusTd = $tds.eq(0);
        const statusText = $statusTd.text().replace(/\s+/g, ' ').trim();
        if (!statusText.includes('[New]')) {
            continue;
        }
        const $titleTd = $tds.eq(1);
        const $link = $titleTd.find('a:first-child');
        const $authorTd = $tds.eq(2);
        const title = $link.text().trim();
        const link = $link.attr('href');
        const author = $authorTd.find('a').text().trim() || $authorTd.text().trim();
        const dateStr = statusText;
        if (!title || !link)
            continue;
        if (title.toLowerCase().startsWith('re:')) {
            continue;
        }
        if (excludeAuthors.some(ex => author.toLowerCase().includes(ex.toLowerCase()))) {
            console.log(`[Fetcher] LKML - 排除作者: ${author}`);
            continue;
        }
        if (!title.toLowerCase().includes('patch') &&
            !title.toLowerCase().includes('diff') &&
            !title.toLowerCase().includes('git pull') &&
            !title.toLowerCase().includes('rfc')) {
            continue;
        }
        const fullUrl = link.startsWith('http') ? link : new URL(link, source.url).href;
        if (seenUrls.has(fullUrl)) {
            continue;
        }
        let parsedDate = new Date().toISOString();
        const urlDateMatch = fullUrl.match(/\/(\d{4})\/(\d{1,2})\/(\d{1,2})\//);
        if (urlDateMatch) {
            try {
                const year = parseInt(urlDateMatch[1]);
                const month = parseInt(urlDateMatch[2]) - 1;
                const day = parseInt(urlDateMatch[3]);
                const date = new Date(year, month, day);
                const hm = extractHourMinute(dateStr);
                if (hm) {
                    date.setHours(hm.hour, hm.minute, 0, 0);
                }
                parsedDate = date.toISOString();
            }
            catch {
                console.log(`[Fetcher] LKML - URL日期解析失败: ${fullUrl}`);
            }
        }
        else if (dateStr) {
            try {
                const dateMatch = dateStr.match(/(\w{3})\s+(\d{1,2}),\s+(\d{4})/);
                if (dateMatch) {
                    const monthMap = {
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
                    };
                    const month = monthMap[dateMatch[1]] || 0;
                    const day = parseInt(dateMatch[2]);
                    const year = parseInt(dateMatch[3]);
                    const date = new Date(year, month, day);
                    const hm = extractHourMinute(dateStr);
                    if (hm) {
                        date.setHours(hm.hour, hm.minute, 0, 0);
                    }
                    parsedDate = date.toISOString();
                }
                else {
                    const shortDateMatch = dateStr.match(/(\w{3})\s+(\d{1,2})/);
                    if (shortDateMatch) {
                        const monthMap = {
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
                        };
                        const month = monthMap[shortDateMatch[1]] || 0;
                        const day = parseInt(shortDateMatch[2]);
                        const year = new Date().getFullYear();
                        const date = new Date(year, month, day);
                        const hm = extractHourMinute(dateStr);
                        if (hm) {
                            date.setHours(hm.hour, hm.minute, 0, 0);
                        }
                        parsedDate = date.toISOString();
                    }
                }
            }
            catch {
                console.log(`[Fetcher] LKML - 日期解析失败: ${dateStr}`);
            }
        }
        seenUrls.add(fullUrl);
        const message = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            url: fullUrl,
            title,
            author,
            date: parsedDate,
            content: '',
            isReply: false,
        };
        out.push(message);
    }
}
function parseLkmlPatchText(rawText) {
    const normalized = rawText.replace(/\r/g, '').trim();
    if (!normalized) {
        return { commitMessage: '', changedFiles: [] };
    }
    const lines = normalized.split('\n').map(line => line.trimEnd());
    const dividerIndex = lines.findIndex(line => line.trim() === '---');
    const messageLines = dividerIndex >= 0 ? lines.slice(0, dividerIndex) : lines;
    let commitMessage = messageLines
        .filter(line => line.trim().length > 0)
        .join('\n')
        .trim();
    if (!commitMessage || commitMessage.length < 10) {
        const cutByDiff = normalized.split(/\bdiff --git\b/i)[0];
        const cutByDivider = cutByDiff.split(/\n---\s|\s---\s/)[0];
        commitMessage = cutByDivider.trim();
    }
    const changedFiles = new Set();
    for (const line of lines) {
        const diffStatMatch = line.match(/^(.+?)\s+\|\s+\d+\s*[+\-]*\s*$/);
        if (diffStatMatch) {
            const filePath = diffStatMatch[1].trim();
            if (filePath && !filePath.includes('file changed')) {
                changedFiles.add(filePath);
            }
        }
        const diffGitMatch = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
        if (diffGitMatch) {
            changedFiles.add(diffGitMatch[2].trim());
        }
    }
    if (changedFiles.size === 0) {
        const inlineDiffStatRegex = /([A-Za-z0-9_./\-]+)\s*\|\s*\d+\s*[+\-]*/g;
        let match;
        while ((match = inlineDiffStatRegex.exec(normalized)) !== null) {
            const filePath = match[1]?.trim();
            if (filePath && !filePath.includes('file changed')) {
                changedFiles.add(filePath);
            }
        }
    }
    return {
        commitMessage,
        changedFiles: Array.from(changedFiles),
    };
}
function parseDateTextToIso(raw) {
    if (!raw)
        return null;
    const ts = Date.parse(raw);
    if (Number.isNaN(ts))
        return null;
    return new Date(ts).toISOString();
}
async function fetchLkmlPatchDetails(patchUrl, headers, timeoutMs) {
    let lastStatus;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const response = await axios_1.default.get(patchUrl, { headers, timeout: timeoutMs });
            const $ = cheerio.load(response.data);
            const rawPatchText = $('pre').first().text().trim();
            const parsed = parseLkmlPatchText(rawPatchText);
            const dateRow = $('tr').filter((_, tr) => {
                const firstCell = $(tr).find('th, td').first().text().replace(/\s+/g, ' ').trim();
                return firstCell === 'Date';
            }).first();
            const dateText = dateRow.find('td').last().text().replace(/\s+/g, ' ').trim();
            const sentAt = parseDateTextToIso(dateText);
            return { ...parsed, sentAt, rateLimited: false };
        }
        catch (error) {
            const status = error?.response?.status;
            lastStatus = status;
            const message = error?.message || String(error);
            const canRetry = attempt < 3 && (status === 429 || status >= 500 || error?.code === 'ECONNABORTED');
            if (canRetry) {
                const waitMs = 500 * Math.pow(2, attempt - 1);
                await new Promise(resolve => setTimeout(resolve, waitMs));
                continue;
            }
            console.error(`[Fetcher] LKML - 获取补丁详情失败: ${patchUrl} - ${message}`);
            return { commitMessage: '', changedFiles: [], sentAt: null, rateLimited: status === 429 };
        }
    }
    return { commitMessage: '', changedFiles: [], sentAt: null, rateLimited: lastStatus === 429 };
}
async function mapWithConcurrency(items, limit, mapper) {
    if (items.length === 0)
        return [];
    const size = Math.max(1, Math.floor(limit));
    const results = new Array(items.length);
    let cursor = 0;
    const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
        while (true) {
            const index = cursor++;
            if (index >= items.length)
                break;
            results[index] = await mapper(items[index], index);
        }
    });
    await Promise.all(workers);
    return results;
}
async function fetchLKML(source, processedUrls, force = false, debug = false) {
    const excludeAuthors = source.excludeAuthors || [];
    const maxPatches = debug ? 5 : undefined;
    const configuredConcurrency = source.lkmlDetailConcurrency ?? 12;
    let detailsConcurrency = debug ? Math.min(4, configuredConcurrency) : Math.max(1, configuredConcurrency);
    const detailTimeoutMs = source.lkmlDetailTimeoutMs ?? 8000;
    try {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayUrl = buildLkmlDayPageUrl(source.url, yesterday);
        const todayUrl = buildLkmlDayPageUrl(source.url, today);
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        };
        const messages = [];
        const seenUrls = new Set();
        for (const { url, label } of [
            { url: yesterdayUrl, label: '昨日' },
            { url: todayUrl, label: '今日' },
        ]) {
            if (maxPatches !== undefined && messages.length >= maxPatches)
                break;
            console.log(`[Fetcher] LKML - 正在访问 (${label}): ${url}`);
            try {
                const response = await axios_1.default.get(url, { headers, timeout: 10000 });
                console.log(`[Fetcher] LKML (${label}) - 响应状态: ${response.status}`);
                collectLkmlPatchMessagesFromHtml(response.data, source, excludeAuthors, seenUrls, messages, maxPatches, label);
            }
            catch (pageErr) {
                console.error(`[Fetcher] LKML (${label}) 页面抓取失败:`, pageErr);
            }
        }
        console.log(`[Fetcher] LKML - 解析到 ${messages.length} 条 [New] patch 消息（已去重）`);
        const candidateMessages = messages.filter(msg => {
            if (!force && processedUrls.has(msg.url)) {
                console.log(`[Fetcher] LKML - 跳过已处理: ${msg.title.substring(0, 50)}...`);
                return false;
            }
            return true;
        });
        console.log(`[Fetcher] LKML - 并发抓取补丁详情: ${candidateMessages.length} 条, 并发=${detailsConcurrency}, timeout=${detailTimeoutMs}ms`);
        const articles = [];
        const batchSize = 80;
        for (let start = 0; start < candidateMessages.length; start += batchSize) {
            const chunk = candidateMessages.slice(start, start + batchSize);
            let rateLimitedInBatch = 0;
            const chunkArticles = await mapWithConcurrency(chunk, detailsConcurrency, async (msg) => {
                console.log(`[Fetcher] LKML - 处理补丁: ${msg.title.substring(0, 50)}...`);
                const patchDetails = await fetchLkmlPatchDetails(msg.url, headers, detailTimeoutMs);
                if (patchDetails.rateLimited) {
                    rateLimitedInBatch++;
                }
                const filesSection = patchDetails.changedFiles.length > 0
                    ? patchDetails.changedFiles.map(file => `- ${file}`).join('\n')
                    : '- 未解析到修改文件';
                const commitMessageSection = patchDetails.commitMessage || '未解析到 commit message';
                const content = [
                    `补丁标题: ${msg.title}`,
                    `补丁链接: ${msg.url}`,
                    '',
                    'Commit message:',
                    commitMessageSection,
                    '',
                    '修改的文件:',
                    filesSection,
                ].join('\n');
                const type = (0, ai_1.inferPatchTypeRuleBased)(msg.title, content);
                const patchData = {
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
                };
                const article = {
                    id: (0, storage_1.generateArticleId)(),
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
                };
                return article;
            });
            articles.push(...chunkArticles);
            const ratio = chunk.length > 0 ? rateLimitedInBatch / chunk.length : 0;
            if (!debug && ratio >= 0.12 && detailsConcurrency > 2) {
                const old = detailsConcurrency;
                detailsConcurrency = Math.max(2, detailsConcurrency - 2);
                console.log(`[Fetcher] LKML - 检测到 429 偏高(${Math.round(ratio * 100)}%)，并发从 ${old} 自动降至 ${detailsConcurrency}`);
            }
        }
        const sortedArticles = articles.sort((a, b) => new Date(b.patchData?.date || 0).getTime() - new Date(a.patchData?.date || 0).getTime());
        console.log(`[Fetcher] LKML - 最终获取 ${sortedArticles.length} 篇文章`);
        return sortedArticles;
    }
    catch (error) {
        console.error(`LKML抓取失败 [${source.name}]:`, error);
        return [];
    }
}
function inferSubsystemFromFiles(files) {
    const subsystemPatterns = {
        'sched': /\/sched\/|\/kernel\/sched/,
        'mm': /\/mm\/|\/include\/linux\/mm\.h|\/include\/linux\/slab/,
        'fs': /\/fs\/|\/include\/linux\/fs\.h/,
        'net': /\/net\/|\/include\/linux\/net|\/include\/net\//,
        'driver': /\/drivers\//,
        'security': /\/security\/|\/include\/linux\/security/,
        'arch': /\/arch\//,
    };
    for (const [subsystem, pattern] of Object.entries(subsystemPatterns)) {
        if (files.some(f => pattern.test(f))) {
            return subsystem;
        }
    }
    return 'other';
}
async function fetchGitRepo(source, force = false, debug = false) {
    const gitConfig = source.gitConfig;
    if (!gitConfig) {
        console.error(`[Fetcher] Git - 缺少 gitConfig 配置: ${source.name}`);
        return [];
    }
    const localPath = gitConfig.localPath;
    if (!localPath) {
        console.error(`[Fetcher] Git - 缺少 localPath 配置: ${source.name}`);
        return [];
    }
    try {
        console.log(`[Fetcher] Git - 正在读取仓库: ${localPath}`);
        const git = (0, simple_git_1.default)(localPath);
        const isRepo = await git.checkIsRepo();
        if (!isRepo) {
            console.error(`[Fetcher] Git - 不是有效的 Git 仓库: ${localPath}`);
            return [];
        }
        const branch = gitConfig.branch || 'master';
        const sinceDays = gitConfig.sinceDays || 7;
        const maxCommits = debug ? 20 : (gitConfig.maxCommits || 200);
        const sinceDate = new Date();
        sinceDate.setDate(sinceDate.getDate() - sinceDays);
        const sinceStr = sinceDate.toISOString().split('T')[0];
        console.log(`[Fetcher] Git - 分支: ${branch}, 时间范围: ${sinceStr} 至今, 最大提交数: ${maxCommits}`);
        const logResult = await git.log([
            '--since', sinceStr,
            '--pretty=format:%H|%h|%s|%an|%ae|%aI',
            '--numstat',
            '--no-merges',
            `-${maxCommits}`
        ]);
        const commits = logResult.all;
        console.log(`[Fetcher] Git - 获取到 ${commits.length} 个提交`);
        const articles = [];
        const seenHashes = new Set();
        for (const commit of commits) {
            if (seenHashes.has(commit.hash))
                continue;
            seenHashes.add(commit.hash);
            const hash = commit.hash;
            const shortHash = commit.hash.substring(0, 7);
            const title = commit.message || '';
            const author = commit.author_name || '';
            const authorEmail = commit.author_email || '';
            const date = commit.date || '';
            const diffResult = await git.diffSummary([`${hash}^`, hash]);
            const files = diffResult.files.map(f => f.file);
            const additions = diffResult.insertions || 0;
            const deletions = diffResult.deletions || 0;
            const content = [
                `提交: ${shortHash}`,
                `作者: ${author} <${authorEmail}>`,
                `日期: ${date}`,
                `标题: ${title}`,
                '',
                '修改的文件:',
                ...files.map(f => `- ${f}`),
                '',
                `统计: +${additions} -${deletions}`
            ].join('\n');
            const type = (0, ai_1.inferPatchTypeRuleBased)(title, content);
            const subsystem = inferSubsystemFromFiles(files);
            const gitCommitData = {
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
                subsystem: subsystem,
                type: type,
                url: `${source.url}/commit/${hash}`
            };
            const article = {
                id: (0, storage_1.generateArticleId)(),
                sourceId: source.id,
                sourceName: source.name,
                sourceUrl: source.url,
                title: title,
                content,
                summary: '',
                url: gitCommitData.url,
                author,
                fetchedAt: new Date().toISOString(),
                highlight: false,
                gitCommitData
            };
            articles.push(article);
        }
        const sortedArticles = articles.sort((a, b) => new Date(b.gitCommitData?.date || 0).getTime() - new Date(a.gitCommitData?.date || 0).getTime());
        console.log(`[Fetcher] Git - 最终获取 ${sortedArticles.length} 篇文章`);
        return sortedArticles;
    }
    catch (error) {
        console.error(`Git抓取失败 [${source.name}]:`, error);
        return [];
    }
}
async function fetchAllSources(processedUrls, force = false, debug = false) {
    let sources = (0, storage_1.loadSources)().filter(s => s.active);
    console.log(`[Fetcher] 开始抓取 ${sources.length} 个Linux kernel信息源`);
    const results = {
        success: 0,
        failed: 0,
        articles: [],
        disabledSources: []
    };
    for (const source of sources) {
        try {
            console.log(`[Fetcher] 正在抓取: ${source.name} (${source.type})`);
            let articles = [];
            if (source.type === 'lkml') {
                articles = await fetchLKML(source, processedUrls, force, debug);
            }
            else if (source.type === 'git') {
                articles = await fetchGitRepo(source, force, debug);
            }
            else {
                console.log(`[Fetcher] 跳过不支持的信息源类型: ${source.type}`);
                continue;
            }
            results.success++;
            results.articles.push(...articles);
            console.log(`[Fetcher] ${source.name} 完成，获取 ${articles.length} 篇文章`);
            if (debug && results.articles.length >= 15) {
                console.log(`[Fetcher] 调试模式: 已达到 15 篇文章限制，停止抓取`);
                break;
            }
        }
        catch (error) {
            results.failed++;
            console.error(`[Fetcher] ${source.name} 抓取失败:`, error.message);
            results.disabledSources.push(source.name);
        }
    }
    console.log(`[Fetcher] 抓取完成: 成功 ${results.success}, 失败 ${results.failed}, 共 ${results.articles.length} 篇文章`);
    if (results.disabledSources.length > 0) {
        console.log(`[Fetcher] 失败的信息源: ${results.disabledSources.join(', ')}`);
    }
    return results.articles;
}
async function fetchAndSave(options = {}) {
    const { force = false, debug = false } = options;
    const todayStr = (0, storage_1.getTodayString)();
    const sourcesConfig = (0, storage_1.loadSourcesConfig)();
    const sources = sourcesConfig.sources.filter(s => s.active);
    const globalConfig = sourcesConfig.globalConfig;
    console.log(`[Fetcher] 开始抓取并保存Linux kernel补丁数据...`);
    console.log(`[Fetcher] 选项: force=${force}${debug ? ', debug=true' : ''}`);
    const processedUrls = (0, storage_1.loadProcessedUrls)();
    console.log(`[Fetcher] 已加载 ${processedUrls.size} 条已处理URL记录`);
    const newArticles = await fetchAllSources(processedUrls, force, debug);
    if (newArticles.length === 0) {
        console.log(`[Fetcher] 没有新文章，跳过保存`);
        return;
    }
    newArticles.forEach(article => {
        if (article.url) {
            processedUrls.add(article.url);
        }
    });
    (0, storage_1.saveProcessedUrls)(processedUrls);
    let allArticles;
    if (debug) {
        allArticles = newArticles;
        console.log(`[Fetcher] Debug 模式: 不合并旧数据，仅处理新抓取的 ${newArticles.length} 篇文章`);
    }
    else {
        let existingDayData = (0, storage_1.loadDayData)(todayStr);
        allArticles = [...newArticles];
        if (existingDayData && existingDayData.articles.length > 0) {
            if (force && newArticles.length > 0) {
                const byKey = new Map();
                const keyOf = (a) => a.url || a.id;
                for (const a of existingDayData.articles) {
                    byKey.set(keyOf(a), a);
                }
                for (const a of newArticles) {
                    byKey.set(keyOf(a), a);
                }
                allArticles = Array.from(byKey.values());
                console.log(`[Fetcher] force 合并: 同 URL/ID 以本次抓取为准，共 ${allArticles.length} 篇`);
            }
            else {
                const existingUrls = new Set(existingDayData.articles.map(a => a.url));
                const uniqueNewArticles = newArticles.filter(a => !existingUrls.has(a.url));
                allArticles = [...existingDayData.articles, ...uniqueNewArticles];
                console.log(`[Fetcher] 合并新旧文章: 已有 ${existingDayData.articles.length} 篇，新增 ${uniqueNewArticles.length} 篇，总计 ${allArticles.length} 篇`);
            }
        }
        else {
            console.log(`[Fetcher] 新增 ${newArticles.length} 篇文章`);
        }
    }
    (0, ai_1.clearAllCategoryContexts)();
    const categorySummaries = {};
    console.log(`[AI] 开始生成Linux kernel补丁总结...`);
    const catSummary = await (0, ai_1.generateCategorySummary)(allArticles, 'linux kernel', globalConfig);
    categorySummaries['linux kernel'] = catSummary;
    console.log(`[AI] Linux kernel 摘要生成完成`);
    const dayData = {
        date: todayStr,
        generatedAt: new Date().toISOString(),
        summary: catSummary,
        articles: allArticles,
        sources
    };
    (0, storage_1.saveDayData)(dayData);
    console.log(`[Fetcher] 数据保存完成！`);
    console.log(`[Fetcher] - 日期: ${todayStr}`);
    console.log(`[Fetcher] - 文章数: ${allArticles.length}`);
}
