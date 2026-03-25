"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const storage_1 = require("../lib/storage");
const ai_1 = require("../lib/ai");
const DATA_DIR = path_1.default.join(__dirname, '..', '..', '..', 'public');
async function generateCategorySummaries() {
    console.log('[Summary] 开始生成分类摘要...\n');
    if (!fs_1.default.existsSync(DATA_DIR)) {
        console.log('[Summary] 数据目录不存在');
        return;
    }
    const files = fs_1.default.readdirSync(DATA_DIR);
    const categoryFiles = files.filter(f => /^[^-]+-\d{4}-\d{2}-\d{2}\.json$/.test(f));
    if (categoryFiles.length === 0) {
        console.log('[Summary] 没有找到分类文件');
        return;
    }
    for (const file of categoryFiles) {
        const match = file.match(/^([^-]+)-(\d{4}-\d{2}-\d{2})\.json$/);
        if (!match)
            continue;
        const [, dateStr] = match;
        const categoryData = (0, storage_1.loadCategoryData)(match[1], match[2]);
        if (!categoryData || !categoryData.articles || categoryData.articles.length === 0) {
            console.log(`[Summary] ${file} 没有文章，跳过`);
            continue;
        }
        if (categoryData.summary && categoryData.summary.length > 0) {
            console.log(`[Summary] ${file} 已有摘要，跳过`);
            continue;
        }
        console.log(`[Summary] 正在生成 ${file} 的摘要...`);
        try {
            const summary = await (0, ai_1.generateDailySummary)(categoryData.articles.map(a => ({
                title: a.title,
                content: a.content || undefined,
                sourceName: a.sourceName
            })));
            categoryData.summary = summary;
            (0, storage_1.saveCategoryData)(categoryData);
            console.log(`[Summary] ${file} 摘要生成成功`);
            console.log(`[Summary] 摘要内容: ${summary.substring(0, 100)}...\n`);
        }
        catch (error) {
            console.error(`[Summary] ${file} 摘要生成失败:`, error);
        }
    }
    console.log('[Summary] 分类摘要生成完成！');
}
generateCategorySummaries();
