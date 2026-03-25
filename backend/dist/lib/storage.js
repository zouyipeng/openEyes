"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadSourcesConfig = loadSourcesConfig;
exports.loadSourceData = loadSourceData;
exports.saveSourceData = saveSourceData;
exports.updateSourceDatesIndex = updateSourceDatesIndex;
exports.loadSourceDatesIndex = loadSourceDatesIndex;
exports.getTodayString = getTodayString;
exports.generateArticleId = generateArticleId;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const DATA_DIR = path_1.default.join(__dirname, '..', '..', '..', 'public');
const SOURCES_CONFIG_PATH = path_1.default.join(__dirname, '..', '..', 'sources-config.json');
function ensureDirectoryExists(dirPath) {
    if (!fs_1.default.existsSync(dirPath)) {
        fs_1.default.mkdirSync(dirPath, { recursive: true });
    }
}
function loadSourcesConfig() {
    try {
        if (!fs_1.default.existsSync(SOURCES_CONFIG_PATH)) {
            console.error('[Storage] 信息源配置文件不存在:', SOURCES_CONFIG_PATH);
            return { sources: [] };
        }
        const content = fs_1.default.readFileSync(SOURCES_CONFIG_PATH, 'utf8');
        return JSON.parse(content);
    }
    catch (error) {
        console.error('[Storage] 加载信息源配置失败:', error);
        return { sources: [] };
    }
}
function sourceNameToFileName(name) {
    return name.toLowerCase().replace(/\s+/g, '-');
}
function loadSourceData(sourceName, dateStr) {
    try {
        const fileName = `${sourceNameToFileName(sourceName)}-${dateStr}.json`;
        const filePath = path_1.default.join(DATA_DIR, fileName);
        if (!fs_1.default.existsSync(filePath)) {
            return null;
        }
        const content = fs_1.default.readFileSync(filePath, 'utf8');
        return JSON.parse(content);
    }
    catch (error) {
        console.error('[Storage] 加载数据源数据失败:', error);
        return null;
    }
}
function saveSourceData(data) {
    ensureDirectoryExists(DATA_DIR);
    const fileName = `${sourceNameToFileName(data.sourceName)}-${data.date}.json`;
    const filePath = path_1.default.join(DATA_DIR, fileName);
    fs_1.default.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`[Storage] 数据已保存: ${filePath}`);
    updateSourceDatesIndex(data.sourceName, data.date);
}
function updateSourceDatesIndex(sourceName, dateStr) {
    ensureDirectoryExists(DATA_DIR);
    const indexPath = path_1.default.join(DATA_DIR, 'source-dates.json');
    let index = {};
    if (fs_1.default.existsSync(indexPath)) {
        try {
            const content = fs_1.default.readFileSync(indexPath, 'utf8');
            index = JSON.parse(content);
        }
        catch {
            index = {};
        }
    }
    const key = sourceNameToFileName(sourceName);
    if (!index[key]) {
        index[key] = { dates: [], lastUpdated: '' };
    }
    if (!index[key].dates.includes(dateStr)) {
        index[key].dates.push(dateStr);
        index[key].dates.sort().reverse();
    }
    index[key].lastUpdated = new Date().toISOString();
    fs_1.default.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8');
    console.log(`[Storage] 数据源日期索引已更新: ${sourceName} - ${index[key].dates.length} 个日期`);
}
function loadSourceDatesIndex() {
    try {
        const filePath = path_1.default.join(DATA_DIR, 'source-dates.json');
        if (!fs_1.default.existsSync(filePath)) {
            return {};
        }
        const content = fs_1.default.readFileSync(filePath, 'utf8');
        return JSON.parse(content);
    }
    catch (error) {
        console.error('[Storage] 加载数据源日期索引失败:', error);
        return {};
    }
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
