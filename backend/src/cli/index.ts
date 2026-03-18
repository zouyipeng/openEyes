#!/usr/bin/env node
import { Command } from 'commander'
import { fetchAllSources } from '../lib/fetcher'
import { generateDailySummary } from '../lib/ai'
import { 
  loadSources,
  saveDayData,
  loadDayData,
  getTodayString,
  type DayData
} from '../lib/storage'

const program = new Command()

program
  .name('openeyes')
  .description('openEyes 后端 CLI 工具')
  .version('1.0.0')

program
  .command('fetch')
  .description('抓取所有信息源的内容')
  .action(async () => {
    console.log('开始抓取信息...')
    try {
      const articles = await fetchAllSources()
      console.log(`抓取完成！新增文章: ${articles.length} 篇`)
      
      if (articles.length === 0) {
        console.log('没有新文章，跳过保存')
        return
      }

      const dateStr = getTodayString()
      const sources = loadSources()
      
      const summary = await generateDailySummary(articles.map(a => ({
        title: a.title,
        content: a.content || undefined,
        sourceName: a.sourceName
      })))

      const dayData: DayData = {
        date: dateStr,
        generatedAt: new Date().toISOString(),
        summary,
        articles,
        sources: sources.filter(s => s.active).map(s => ({
          id: s.id,
          name: s.name,
          type: s.type,
          url: s.url,
          category: s.category,
          active: s.active
        }))
      }

      saveDayData(dayData)

      console.log('\n数据保存完成！')
      console.log(`- 日期: ${dateStr}`)
      console.log(`- 文章数: ${articles.length}`)
      
    } catch (error) {
      console.error('抓取失败:', error)
      process.exit(1)
    }
  })

program
  .command('summary')
  .description('生成每日摘要')
  .action(async () => {
    console.log('生成每日摘要...')
    try {
      const dateStr = getTodayString()
      
      const dayData = loadDayData(dateStr)
      
      if (!dayData || dayData.articles.length === 0) {
        console.log('今日暂无文章，请先执行 fetch 命令')
        return
      }

      const summary = await generateDailySummary(dayData.articles.map(a => ({
        title: a.title,
        content: a.content || undefined,
        sourceName: a.sourceName
      })))

      dayData.summary = summary
      saveDayData(dayData)

      console.log('\n每日摘要:')
      console.log('='.repeat(50))
      console.log(summary)
      console.log('='.repeat(50))
    } catch (error) {
      console.error('生成摘要失败:', error)
      process.exit(1)
    }
  })

program
  .command('list:sources')
  .description('列出所有信息源')
  .action(() => {
    const sources = loadSources()
    console.log('信息源列表:')
    console.log('='.repeat(80))
    sources.forEach(source => {
      console.log(`ID: ${source.id}`)
      console.log(`名称: ${source.name}`)
      console.log(`类型: ${source.type}`)
      console.log(`分类: ${source.category}`)
      console.log(`URL: ${source.url}`)
      console.log(`状态: ${source.active ? '启用' : '禁用'}`)
      console.log('-'.repeat(80))
    })
  })

program.parse(process.argv)
