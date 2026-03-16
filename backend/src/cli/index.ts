#!/usr/bin/env node
import { Command } from 'commander'
import { fetchAllSources } from '../lib/fetcher'
import { generateDailySummary } from '../lib/ai'
import prisma from '../lib/db'
import fs from 'fs'
import path from 'path'

const program = new Command()

// 生成今日日期的文件名（格式：YYYY-MM-DD.json）
const getTodayFileName = () => {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}.json`
}

// 确保目录存在
const ensureDirectoryExists = (dirPath: string) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

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
      const results = await fetchAllSources()
      console.log(`抓取完成！`)
      console.log(`成功: ${results.success} 个信息源`)
      console.log(`失败: ${results.failed} 个信息源`)
      console.log(`新增文章: ${results.articles.length} 篇`)
      
      // 保存文章数据到JSON文件
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const articles = await prisma.article.findMany({
        where: {
          fetchedAt: {
            gte: today
          }
        }
      })
      
      // 生成摘要
      const summary = await generateDailySummary(articles)
      
      // 保存到前端的data目录
      const dataDir = path.join(__dirname, '../../..', 'public', 'data')
      ensureDirectoryExists(dataDir)
      
      const fileName = getTodayFileName()
      
      // 保存文章数据
      fs.writeFileSync(
        path.join(dataDir, fileName),
        JSON.stringify(articles, null, 2),
        'utf8'
      )
      console.log(`文章数据已保存到: ${path.join(dataDir, fileName)}`)
      
      // 保存摘要数据
      fs.writeFileSync(
        path.join(dataDir, `summary-${fileName}`),
        JSON.stringify({ summary }, null, 2),
        'utf8'
      )
      console.log(`摘要数据已保存到: ${path.join(dataDir, `summary-${fileName}`)}`)
      
      // 保存信息源数据
      const sources = await prisma.source.findMany()
      // 解析配置，添加类别信息
      const sourcesWithCategory = sources.map(source => {
        let category = '未分类'
        try {
          if (source.config) {
            const config = JSON.parse(source.config)
            category = config.category || '未分类'
          }
        } catch (error) {
          console.error('解析信息源配置失败:', error)
        }
        return {
          ...source,
          category
        }
      })
      
      fs.writeFileSync(
        path.join(dataDir, `sources-${fileName}`),
        JSON.stringify(sourcesWithCategory, null, 2),
        'utf8'
      )
      console.log(`信息源数据已保存到: ${path.join(dataDir, `sources-${fileName}`)}`)
    } catch (error) {
      console.error('抓取失败:', error)
    }
  })

program
  .command('summary')
  .description('生成每日摘要')
  .action(async () => {
    console.log('生成每日摘要...')
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const articles = await prisma.article.findMany({
        where: {
          fetchedAt: {
            gte: today
          }
        },
        select: {
          title: true,
          content: true,
          sourceName: true
        }
      })
      
      const summary = await generateDailySummary(articles)
      console.log('\n每日摘要:')
      console.log('=' .repeat(50))
      console.log(summary)
      console.log('=' .repeat(50))
    } catch (error) {
      console.error('生成摘要失败:', error)
    }
  })

program
  .command('list:sources')
  .description('列出所有信息源')
  .action(async () => {
    try {
      const sources = await prisma.source.findMany()
      console.log('信息源列表:')
      console.log('=' .repeat(80))
      sources.forEach(source => {
        console.log(`ID: ${source.id}`)
        console.log(`名称: ${source.name}`)
        console.log(`类型: ${source.type}`)
        console.log(`URL: ${source.url}`)
        console.log(`状态: ${source.active ? '启用' : '禁用'}`)
        console.log(`最后抓取: ${source.lastFetched || '从未'}`)
        console.log('-' .repeat(80))
      })
    } catch (error) {
      console.error('获取信息源失败:', error)
    }
  })

program
  .command('list:articles')
  .description('列出最近的文章')
  .option('-n, --number <number>', '显示的文章数量', '10')
  .action(async (options) => {
    try {
      const limit = parseInt(options.number)
      const articles = await prisma.article.findMany({
        orderBy: { fetchedAt: 'desc' },
        take: limit
      })
      console.log(`最近 ${limit} 篇文章:`)
      console.log('=' .repeat(80))
      articles.forEach(article => {
        console.log(`标题: ${article.title}`)
        console.log(`来源: ${article.sourceName}`)
        console.log(`抓取时间: ${article.fetchedAt}`)
        console.log(`URL: ${article.url}`)
        console.log(`摘要: ${article.summary?.substring(0, 100)}...`)
        console.log('-' .repeat(80))
      })
    } catch (error) {
      console.error('获取文章失败:', error)
    }
  })

program.parse(process.argv)