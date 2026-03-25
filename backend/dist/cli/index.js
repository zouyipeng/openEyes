#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const fetcher_1 = require("../lib/fetcher");
const ai_1 = require("../lib/ai");
const storage_1 = require("../lib/storage");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const DATA_DIR = path_1.default.join(__dirname, '..', '..', '..', 'public');
const program = new commander_1.Command();
program
    .name('lkml-fetcher')
    .description('Linux Kernel Mailing List 补丁抓取工具')
    .version('1.0.0');
program
    .command('fetch')
    .description('抓取Linux kernel补丁并保存')
    .option('-f, --force', '强制重新抓取（忽略已处理记录）')
    .option('-d, --debug', '调试模式：限制抓取数量')
    .action(async (options) => {
    console.log('开始抓取Linux kernel补丁...');
    if (options.debug) {
        console.log('🐛 调试模式已启用，将限制抓取数量');
    }
    try {
        await (0, fetcher_1.fetchAndSave)({
            force: options.force || false,
            debug: options.debug || false
        });
    }
    catch (error) {
        console.error('抓取失败:', error);
        process.exit(1);
    }
});
program
    .command('summary')
    .description('生成Linux kernel补丁摘要')
    .action(async () => {
    console.log('生成Linux kernel补丁摘要...');
    try {
        const dateStr = (0, storage_1.getTodayString)();
        const dayData = (0, storage_1.loadDayData)(dateStr);
        if (!dayData || dayData.articles.length === 0) {
            console.log('今日暂无补丁，请先执行 fetch 命令');
            return;
        }
        const summary = await (0, ai_1.generateDailySummary)(dayData.articles.map(a => ({
            title: a.title,
            content: a.content || undefined,
            sourceName: a.sourceName
        })));
        dayData.summary = summary;
        (0, storage_1.saveDayData)(dayData);
        console.log('\nLinux kernel补丁摘要:');
        console.log('='.repeat(50));
        console.log(summary);
        console.log('='.repeat(50));
    }
    catch (error) {
        console.error('生成摘要失败:', error);
        process.exit(1);
    }
});
program
    .command('list:sources')
    .description('列出所有信息源')
    .action(() => {
    const sources = (0, storage_1.loadSources)();
    console.log('信息源列表:');
    console.log('='.repeat(80));
    sources.forEach(source => {
        console.log(`ID: ${source.id}`);
        console.log(`名称: ${source.name}`);
        console.log(`类型: ${source.type}`);
        console.log(`URL: ${source.url}`);
        console.log(`状态: ${source.active ? '启用' : '禁用'}`);
        console.log('-'.repeat(80));
    });
});
program
    .command('list:files')
    .description('列出可用的数据文件')
    .action(() => {
    if (!fs_1.default.existsSync(DATA_DIR)) {
        console.log('数据目录不存在');
        return;
    }
    const files = fs_1.default.readdirSync(DATA_DIR);
    const dateFiles = files.filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f));
    if (dateFiles.length === 0) {
        console.log('暂无数据文件');
        return;
    }
    console.log('可用数据文件:');
    console.log('='.repeat(80));
    dateFiles.sort().reverse().forEach(file => {
        const dateStr = file.replace('.json', '');
        const dayData = (0, storage_1.loadDayData)(dateStr);
        if (dayData) {
            console.log(`📅 ${dateStr} (${dayData.articles.length} 个补丁)`);
        }
    });
});
program
    .command('list:processed')
    .description('列出已处理的补丁URL')
    .action(() => {
    const processedUrls = (0, storage_1.loadProcessedUrls)();
    console.log(`已处理补丁: ${processedUrls.size} 条`);
    console.log('='.repeat(80));
    const urls = Array.from(processedUrls).slice(0, 20);
    urls.forEach(url => {
        console.log(url);
    });
    if (processedUrls.size > 20) {
        console.log(`... 还有 ${processedUrls.size - 20} 条`);
    }
});
program
    .command('clear:processed')
    .description('清空已处理URL记录')
    .action(() => {
    (0, storage_1.saveProcessedUrls)(new Set());
    console.log('已清空已处理URL记录');
});
program.parse(process.argv);
