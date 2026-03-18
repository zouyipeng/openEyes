import cron from 'node-cron'
import { fetchAllSources } from './fetcher'
import { generateDailySummary } from './ai'
import prisma from './db'
import fs from 'fs'
import path from 'path'

const LOG_DIR = path.join(__dirname, '../../logs')
const DATA_DIR = path.join(__dirname, '../../../public/data')

function ensureDirectoryExists(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function getLogFileName(): string {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `fetch-${year}-${month}-${day}.log`
}

function log(message: string) {
  const timestamp = new Date().toISOString()
  const logMessage = `[${timestamp}] ${message}\n`
  
  console.log(logMessage.trim())
  
  ensureDirectoryExists(LOG_DIR)
  const logFile = path.join(LOG_DIR, getLogFileName())
  fs.appendFileSync(logFile, logMessage, 'utf8')
}

async function runFetchJob() {
  log('========== 开始执行定时抓取任务 ==========')
  
  try {
    const startTime = Date.now()
    
    log('开始抓取所有信息源...')
    const articles = await fetchAllSources()
    log(`抓取完成，共获取 ${articles.length} 篇文章`)
    
    log('开始生成每日摘要...')
    const summary = await generateDailySummary(articles)
    log(`摘要生成完成`)
    
    const duration = Date.now() - startTime
    log(`任务执行完成，耗时 ${(duration / 1000).toFixed(2)} 秒`)
    
    ensureDirectoryExists(DATA_DIR)
    
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    const fileName = `${year}-${month}-${day}.json`
    const summaryFileName = `summary-${year}-${month}-${day}.json`
    
    fs.writeFileSync(
      path.join(DATA_DIR, fileName),
      JSON.stringify(articles, null, 2),
      'utf8'
    )
    log(`文章数据已保存到 ${fileName}`)
    
    fs.writeFileSync(
      path.join(DATA_DIR, summaryFileName),
      JSON.stringify({ summary, generatedAt: new Date().toISOString() }, null, 2),
      'utf8'
    )
    log(`摘要数据已保存到 ${summaryFileName}`)
    
    return { success: true, articleCount: articles.length, duration }
  } catch (error: any) {
    log(`任务执行失败: ${error.message}`)
    log(`错误堆栈: ${error.stack}`)
    return { success: false, error: error.message }
  }
}

export function startScheduler(schedule: string = '0 6 * * *') {
  log(`定时任务服务启动，计划: ${schedule}`)
  
  if (!cron.validate(schedule)) {
    throw new Error(`无效的 cron 表达式: ${schedule}`)
  }
  
  const task = cron.schedule(schedule, async () => {
    await runFetchJob()
  }, {
    timezone: 'Asia/Shanghai'
  })
  
  log('定时任务已注册，等待执行...')
  
  return {
    task,
    stop: () => {
      task.stop()
      log('定时任务已停止')
    },
    runNow: runFetchJob
  }
}

export { runFetchJob }
