"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSummary = generateSummary;
exports.inferPatchTypeRuleBased = inferPatchTypeRuleBased;
const openai_1 = __importDefault(require("openai"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const configPath = path_1.default.join(__dirname, '../../config.json');
let config = {
    openai: {
        apiKey: '',
        baseURL: 'https://api.openai.com/v1',
        model: 'gpt-3.5-turbo',
        maxTokens: 4096
    }
};
if (fs_1.default.existsSync(configPath)) {
    try {
        const configData = fs_1.default.readFileSync(configPath, 'utf8');
        const loadedConfig = JSON.parse(configData);
        config = {
            openai: {
                ...config.openai,
                ...loadedConfig.openai
            }
        };
        console.log('[AI] 配置文件加载成功');
    }
    catch (error) {
        console.error('[AI] 读取配置文件失败:', error);
    }
}
const openai = new openai_1.default({
    apiKey: config.openai.apiKey || '',
    baseURL: config.openai.baseURL || 'https://api.openai.com/v1',
});
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
function cleanAIResponse(content) {
    if (!content)
        return '';
    let cleaned = content;
    cleaned = cleaned.replace(/<think[^>]*>[\s\S]*?<\/think>/gi, '');
    const thinkEndMatch = cleaned.match(/<\/think>/i);
    if (thinkEndMatch) {
        const afterThink = cleaned.substring(thinkEndMatch.index + thinkEndMatch[0].length);
        cleaned = afterThink.trim();
    }
    const thinkStartMatch = cleaned.match(/<think[^>]*>/i);
    if (thinkStartMatch) {
        const beforeThink = cleaned.substring(0, thinkStartMatch.index);
        cleaned = beforeThink.trim();
    }
    cleaned = cleaned.replace(/^```json\s*/i, '');
    cleaned = cleaned.replace(/^```\s*/i, '');
    cleaned = cleaned.replace(/\s*```$/i, '');
    cleaned = formatSummaryItems(cleaned);
    cleaned = cleaned.trim();
    return cleaned;
}
function formatSummaryItems(content) {
    let cleaned = content;
    cleaned = cleaned.replace(/^\s*\n+/gm, '\n');
    cleaned = cleaned.trim();
    return cleaned;
}
function computeArticleDateRange(articles) {
    let minTs = Number.POSITIVE_INFINITY;
    let maxTs = Number.NEGATIVE_INFINITY;
    for (const a of articles) {
        const raw = a.patchData?.date || a.gitCommitData?.date || a.fetchedAt;
        if (!raw)
            continue;
        const ts = new Date(raw).getTime();
        if (Number.isNaN(ts))
            continue;
        if (ts < minTs)
            minTs = ts;
        if (ts > maxTs)
            maxTs = ts;
    }
    if (!Number.isFinite(minTs) || !Number.isFinite(maxTs))
        return '';
    const fmt = (ts) => new Date(ts)
        .toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
        .replace(/\//g, '-')
        .replace(/\s/g, '');
    return `${fmt(minTs)} ~ ${fmt(maxTs)}`;
}
async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
async function withRetry(operation, operationName) {
    let lastError = null;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            console.log(`[AI] ${operationName} - 尝试 ${attempt}/${MAX_RETRIES}`);
            const startTime = Date.now();
            const result = await operation();
            const duration = Date.now() - startTime;
            console.log(`[AI] ${operationName} - 成功 (耗时: ${duration}ms)`);
            return result;
        }
        catch (error) {
            lastError = error;
            console.error(`[AI] ${operationName} - 失败 (尝试 ${attempt}/${MAX_RETRIES}):`, error.message);
            if (error.status === 429) {
                console.log('[AI] 遇到限流，等待后重试...');
                await sleep(RETRY_DELAY * attempt * 2);
            }
            else if (error.status === 401) {
                console.error('[AI] API Key 无效，请检查配置');
                throw error;
            }
            else if (attempt < MAX_RETRIES) {
                await sleep(RETRY_DELAY);
            }
        }
    }
    throw lastError;
}
async function generateCategorySummary(articles, type, customPrompt) {
    if (articles.length === 0)
        return '';
    const typeLabel = type === 'feature' ? 'Feature' : 'Bugfix';
    const articlesWithLinks = articles
        .slice(0, 30)
        .map(a => {
        const anchorId = `lkml-${a.id}`;
        return `- [${a.title}](#${anchorId})`;
    })
        .join('\n');
    const defaultPrompt = `你是 Linux 内核开发专家。请分析以下${typeLabel}类补丁并输出总结。

要求：
- 用 Markdown 列表输出关键信息
- 每个列表项以 1 个语义匹配的 emoji 开头
- 每条总结必须包含补丁链接，链接统一放在该行最后，格式如 [标题](#lkml-xxx)
- 至少 3 条总结

限制：用中文回复，不要输出思考过程，不要输出"今日社区动态"、"总体评价"等标题，不要逐条罗列补丁标题。`;
    const prompt = customPrompt || defaultPrompt;
    const messages = [
        { role: 'system', content: prompt },
        {
            role: 'user',
            content: `请分析以下${typeLabel}类补丁：\n\n${articlesWithLinks}`,
        },
    ];
    const result = await withRetry(async () => {
        return await openai.chat.completions.create({
            model: config.openai.model,
            messages,
            max_tokens: config.openai.maxTokens,
            temperature: 0.7,
        });
    }, `生成${typeLabel}摘要`);
    const rawContent = result.choices[0]?.message?.content || '';
    let summary = cleanAIResponse(rawContent);
    summary = summary.replace(/^###\s*(今日社区动态|总体评价|本周合并动态|合并评价|Feature类补丁分析|总结|Bugfix类补丁分析)\s*$/gim, '');
    summary = summary.replace(/^###\s*总体评价[\s\S]*$/gim, '');
    summary = summary.replace(/^###\s*合并评价[\s\S]*$/gim, '');
    summary = summary.replace(/^\s*\n+/gm, '\n');
    summary = summary.trim();
    return summary;
}
async function generateSummary(articles, customPrompt) {
    if (articles.length === 0) {
        return '';
    }
    if (!config.openai.apiKey) {
        console.log('[AI] generateSummary - API Key 未配置，使用默认摘要');
        return `今日共收集到 ${articles.length} 条记录。`;
    }
    const featureArticles = articles.filter(a => (a.patchData?.type || a.gitCommitData?.type) === 'feature');
    const bugfixArticles = articles.filter(a => (a.patchData?.type || a.gitCommitData?.type) === 'bugfix');
    const otherArticles = articles.filter(a => (a.patchData?.type || a.gitCommitData?.type) === 'other' ||
        !(a.patchData?.type || a.gitCommitData?.type));
    console.log(`[AI] Feature: ${featureArticles.length} 条, Bugfix: ${bugfixArticles.length} 条, Other: ${otherArticles.length} 条`);
    const parts = [];
    parts.push(`# 今日社区动态`);
    parts.push('');
    if (featureArticles.length > 0) {
        console.log(`[AI] 正在生成 Feature 摘要...`);
        const featureSummary = await generateCategorySummary(featureArticles, 'feature', customPrompt);
        if (featureSummary) {
            parts.push(`## Feature速看`);
            parts.push(featureSummary);
        }
    }
    if (bugfixArticles.length > 0) {
        console.log(`[AI] 正在生成 Bugfix 摘要...`);
        const bugfixSummary = await generateCategorySummary(bugfixArticles, 'bugfix', customPrompt);
        if (bugfixSummary) {
            if (featureArticles.length > 0)
                parts.push('');
            parts.push(`## Bugfix`);
            parts.push(bugfixSummary);
        }
    }
    if (otherArticles.length > 0) {
        if (featureArticles.length > 0 || bugfixArticles.length > 0)
            parts.push('');
        parts.push(`## Other`);
        parts.push(`共 ${otherArticles.length} 条其他类型补丁（文档更新、代码整理等）`);
    }
    return parts.join('\n');
}
function inferPatchTypeRuleBased(title, body) {
    const combined = `${title}\n${body}`;
    const lower = combined.toLowerCase();
    const bugfixInSubject = /\[patch[^\]]*\]\s*[^:]+:\s*(fix|fixes)\b/i.test(title) ||
        /^[^:]+:\s*(fix|fixes)\b/i.test(title.trim());
    const bugfixInText = /\b(fix(es|ed|ing)?|fixes:)\b/.test(lower) ||
        /\b(data\s+race|race\s+condition|kcsan)\b/.test(lower) ||
        /\b(leak|memory\s+leak|refcount)\b/.test(lower) ||
        /\b(crash|oops|panic|null\s*deref|null\s*pointer|use[-\s]after[-\s]free|\buaf\b)\b/.test(lower) ||
        /\b(overflow|underflow|deadlock|hang)\b/.test(lower) ||
        /\b(syzbot|regression)\b/.test(lower);
    const featureInSubject = /\[patch[^\]]*\]\s*[^:]+:\s*(add|adds|implement|introduce|support|enable)\b/i.test(title) ||
        /^[^:]+:\s*(add|adds|implement|introduce|support|enable)\b/i.test(title.trim());
    const featureInText = /\b(add(s|ing)?\s+support|implement(s|ed|ing)?|introduce(s|d)?)\b/.test(lower) ||
        /\benable\s+(new|the|a)\b/.test(lower) ||
        /\bnew\s+(driver|subsystem|api|helper|interface)\b/.test(lower);
    if (bugfixInSubject || bugfixInText)
        return 'bugfix';
    if (featureInSubject || featureInText)
        return 'feature';
    return 'other';
}
