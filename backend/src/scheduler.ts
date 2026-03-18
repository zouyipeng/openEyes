#!/usr/bin/env node
import { startScheduler } from './lib/scheduler'
import fs from 'fs'
import path from 'path'

const CONFIG_PATH = path.join(__dirname, '../config.json')

interface SchedulerConfig {
  schedule?: string
  openai?: {
    apiKey?: string
    baseURL?: string
  }
}

let config: SchedulerConfig = {
  schedule: '0 6 * * *'
}

if (fs.existsSync(CONFIG_PATH)) {
  try {
    const configData = fs.readFileSync(CONFIG_PATH, 'utf8')
    config = { ...config, ...JSON.parse(configData) }
  } catch (error) {
    console.error('读取配置文件失败:', error)
  }
}

console.log('========================================')
console.log('  openEyes 定时任务服务')
console.log('========================================')
console.log(`计划执行时间: ${config.schedule} (每天早上6点)`)
console.log(`时区: Asia/Shanghai`)
console.log('========================================')

const scheduler = startScheduler(config.schedule)

process.on('SIGINT', () => {
  console.log('\n收到终止信号，正在停止服务...')
  scheduler.stop()
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\n收到终止信号，正在停止服务...')
  scheduler.stop()
  process.exit(0)
})
