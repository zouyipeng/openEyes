#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fetcher_1 = require("../lib/fetcher");
const ai_1 = require("../lib/ai");
const storage_1 = require("../lib/storage");
const printUsage = () => {
    console.log(`
用法: npm run fetch <command>

命令:
  all       全量抓取所有信息源数据
  summary   为指定信息源重新生成摘要

示例:
  npm run fetch all
  npm run fetch summary --source "Mailing List"
  npm run fetch summary --source "Mainline" --date 2026-03-25
`);
};
const parseArgs = () => {
    const args = process.argv.slice(2);
    const command = args[0];
    const options = {};
    for (let i = 1; i < args.length; i++) {
        if (args[i].startsWith('--')) {
            const key = args[i].substring(2);
            const value = args[i + 1];
            if (value && !value.startsWith('--')) {
                options[key] = value;
                i++;
            }
        }
    }
    return { command, options };
};
const runSummary = async (options) => {
    const sourceName = options.source;
    const dateStr = options.date || (0, storage_1.getTodayString)();
    if (!sourceName) {
        console.error('错误: 需要指定 --source 参数');
        console.log('示例: npm run fetch summary --source "Mailing List"');
        process.exit(1);
    }
    console.log(`[Summary] 为 ${sourceName} (${dateStr}) 重新生成摘要...`);
    const data = (0, storage_1.loadSourceData)(sourceName, dateStr);
    if (!data) {
        console.error(`错误: 未找到数据文件 ${sourceName}-${dateStr}.json`);
        process.exit(1);
    }
    if (data.articles.length === 0) {
        console.error('错误: 数据文件中没有文章');
        process.exit(1);
    }
    const config = (0, storage_1.loadSourcesConfig)();
    const source = config.sources.find(s => s.name === sourceName);
    const summary = await (0, ai_1.generateSummary)(data.articles, source?.summaryPrompt);
    data.summary = summary;
    data.generatedAt = new Date().toISOString();
    (0, storage_1.saveSourceData)(data);
    console.log(`[Summary] 摘要生成完成！`);
};
const main = async () => {
    const { command, options } = parseArgs();
    switch (command) {
        case 'all':
            await (0, fetcher_1.fetchAll)();
            break;
        case 'summary':
            await runSummary(options);
            break;
        case 'help':
        case '--help':
        case '-h':
            printUsage();
            break;
        default:
            if (command) {
                console.error(`未知命令: ${command}`);
            }
            printUsage();
            process.exit(command ? 1 : 0);
    }
};
main().catch(console.error);
