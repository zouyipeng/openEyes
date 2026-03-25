"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadSources = loadSources;
exports.loadGlobalConfig = loadGlobalConfig;
exports.loadSourcesConfig = loadSourcesConfig;
exports.loadArticlesByDate = loadArticlesByDate;
exports.loadAllProcessedArticles = loadAllProcessedArticles;
exports.loadProcessedUrls = loadProcessedUrls;
exports.saveProcessedUrls = saveProcessedUrls;
exports.loadDayData = loadDayData;
exports.loadCategoryData = loadCategoryData;
exports.loadDatesIndex = loadDatesIndex;
exports.updateDatesIndex = updateDatesIndex;
exports.saveDayData = saveDayData;
exports.saveCategoryData = saveCategoryData;
exports.saveAllCategoryData = saveAllCategoryData;
exports.getTodayString = getTodayString;
exports.generateArticleId = generateArticleId;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const DATA_DIR = path_1.default.join(__dirname, '..', '..', '..', 'public');
const SOURCES_CONFIG_PATH = path_1.default.join(__dirname, '..', '..', 'sources-config.json');
const PROCESSED_FILE = path_1.default.join(DATA_DIR, 'processed-articles.json');
function ensureDirectoryExists(dirPath) {
    if (!fs_1.default.existsSync(dirPath)) {
        fs_1.default.mkdirSync(dirPath, { recursive: true });
    }
}
function loadSources() {
    try {
        if (!fs_1.default.existsSync(SOURCES_CONFIG_PATH)) {
            console.error('[Storage] 信息源配置文件不存在:', SOURCES_CONFIG_PATH);
            return [];
        }
        const content = fs_1.default.readFileSync(SOURCES_CONFIG_PATH, 'utf8');
        const config = JSON.parse(content);
        return config.sources || [];
    }
    catch (error) {
        console.error('[Storage] 加载信息源配置失败:', error);
        return [];
    }
}
function loadGlobalConfig() {
    const defaultConfig = {
        defaultSummaryPrompt: '你是一个专业的信息总结助手。请用简洁的中文总结以下文章的核心内容，控制在100字以内。',
        defaultCategorySummaryPrompt: '你是一个信息整合助手。请根据今日收集的文章，生成一份简洁的每日信息摘要。'
    };
    try {
        if (!fs_1.default.existsSync(SOURCES_CONFIG_PATH)) {
            return defaultConfig;
        }
        const content = fs_1.default.readFileSync(SOURCES_CONFIG_PATH, 'utf8');
        const config = JSON.parse(content);
        return config.globalConfig || defaultConfig;
    }
    catch (error) {
        console.error('[Storage] 加载全局配置失败:', error);
        return defaultConfig;
    }
}
function loadSourcesConfig() {
    try {
        if (!fs_1.default.existsSync(SOURCES_CONFIG_PATH)) {
            console.error('[Storage] 信息源配置文件不存在:', SOURCES_CONFIG_PATH);
            return { globalConfig: loadGlobalConfig(), sources: [] };
        }
        const content = fs_1.default.readFileSync(SOURCES_CONFIG_PATH, 'utf8');
        return JSON.parse(content);
    }
    catch (error) {
        console.error('[Storage] 加载信息源配置失败:', error);
        return { globalConfig: loadGlobalConfig(), sources: [] };
    }
}
function loadArticlesByDate(dateStr) {
    try {
        const filePath = path_1.default.join(DATA_DIR, `${dateStr}.json`);
        if (!fs_1.default.existsSync(filePath)) {
            return [];
        }
        const content = fs_1.default.readFileSync(filePath, 'utf8');
        const data = JSON.parse(content);
        return data.articles || [];
    }
    catch (error) {
        console.error('[Storage] 加载文章失败:', error);
        return [];
    }
}
function loadAllProcessedArticles() {
    const articles = [];
    try {
        if (!fs_1.default.existsSync(DATA_DIR)) {
            return articles;
        }
        const files = fs_1.default.readdirSync(DATA_DIR);
        const dateFiles = files.filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f));
        for (const file of dateFiles) {
            const dateStr = file.replace('.json', '');
            const dayArticles = loadArticlesByDate(dateStr);
            articles.push(...dayArticles);
        }
        return articles;
    }
    catch (error) {
        console.error('[Storage] 加载所有文章失败:', error);
        return articles;
    }
}
function loadProcessedUrls() {
    try {
        if (!fs_1.default.existsSync(PROCESSED_FILE)) {
            return new Set();
        }
        const content = fs_1.default.readFileSync(PROCESSED_FILE, 'utf8');
        const data = JSON.parse(content);
        return new Set(data.urls || []);
    }
    catch (error) {
        console.error('[Storage] 加载已处理URL失败:', error);
        return new Set();
    }
}
function saveProcessedUrls(urls) {
    ensureDirectoryExists(DATA_DIR);
    const data = {
        lastUpdated: new Date().toISOString(),
        urls: Array.from(urls)
    };
    fs_1.default.writeFileSync(PROCESSED_FILE, JSON.stringify(data, null, 2), 'utf8');
    console.log(`[Storage] 已处理URL已保存: ${urls.size} 条`);
}
function loadDayData(dateStr) {
    try {
        const filePath = path_1.default.join(DATA_DIR, `${dateStr}.json`);
        if (!fs_1.default.existsSync(filePath)) {
            return null;
        }
        const content = fs_1.default.readFileSync(filePath, 'utf8');
        return JSON.parse(content);
    }
    catch (error) {
        console.error('[Storage] 加载每日数据失败:', error);
        return null;
    }
}
function loadCategoryData(category, dateStr) {
    try {
        const filePath = path_1.default.join(DATA_DIR, `${category}-${dateStr}.json`);
        if (!fs_1.default.existsSync(filePath)) {
            return null;
        }
        const content = fs_1.default.readFileSync(filePath, 'utf8');
        return JSON.parse(content);
    }
    catch (error) {
        console.error('[Storage] 加载分类数据失败:', error);
        return null;
    }
}
function loadDatesIndex() {
    try {
        const filePath = path_1.default.join(DATA_DIR, 'dates.json');
        if (!fs_1.default.existsSync(filePath)) {
            return null;
        }
        const content = fs_1.default.readFileSync(filePath, 'utf8');
        return JSON.parse(content);
    }
    catch (error) {
        console.error('[Storage] 加载日期索引失败:', error);
        return null;
    }
}
function updateDatesIndex() {
    ensureDirectoryExists(DATA_DIR);
    if (!fs_1.default.existsSync(DATA_DIR)) {
        return;
    }
    const files = fs_1.default.readdirSync(DATA_DIR);
    const dateFiles = files.filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f));
    const dates = dateFiles.map(f => f.replace('.json', '')).sort().reverse();
    const index = {
        dates,
        lastUpdated: new Date().toISOString()
    };
    const filePath = path_1.default.join(DATA_DIR, 'dates.json');
    fs_1.default.writeFileSync(filePath, JSON.stringify(index, null, 2), 'utf8');
    console.log(`[Storage] 日期索引已更新: ${dates.length} 个日期`);
}
function saveDayData(data) {
    ensureDirectoryExists(DATA_DIR);
    const filePath = path_1.default.join(DATA_DIR, `${data.date}.json`);
    fs_1.default.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`[Storage] 数据已保存: ${filePath}`);
    updateDatesIndex();
}
function saveCategoryData(data) {
    ensureDirectoryExists(DATA_DIR);
    const filePath = path_1.default.join(DATA_DIR, `${data.category}-${data.date}.json`);
    fs_1.default.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`[Storage] 分类数据已保存: ${filePath}`);
}
function saveAllCategoryData(articles, sources, dateStr, summaries = {}) {
    ensureDirectoryExists(DATA_DIR);
    const categoryArticles = {};
    const categorySources = {};
    articles.forEach(article => {
        const source = sources.find(s => s.id === article.sourceId);
        const category = source?.category || '未分类';
        if (!categoryArticles[category]) {
            categoryArticles[category] = [];
            categorySources[category] = [];
        }
        categoryArticles[category].push(article);
        if (!categorySources[category].find(s => s.id === source?.id)) {
            if (source) {
                categorySources[category].push(source);
            }
        }
    });
    Object.keys(categoryArticles).forEach(category => {
        const data = {
            category,
            date: dateStr,
            generatedAt: new Date().toISOString(),
            summary: summaries[category] || '',
            articles: categoryArticles[category],
            sources: categorySources[category]
        };
        saveCategoryData(data);
    });
}
function getTodayString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
function generateArticleId() {
    return `art_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
