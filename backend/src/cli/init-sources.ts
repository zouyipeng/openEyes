#!/usr/bin/env node
import prisma from '../lib/db'

// 内置信息源，按类别分类
const builtInSources = [
  // AI 类别
  {
    category: 'AI',
    sources: [
      {
        name: '机器之心',
        type: 'rss',
        url: 'https://www.jiqizhixin.com/rss',
        active: true
      },
      {
        name: 'AI 科技评论',
        type: 'rss',
        url: 'https://www.aitechtogether.com/feed',
        active: true
      },
      {
        name: '36氪 AI',
        type: 'rss',
        url: 'https://36kr.com/feed',
        active: true
      }
    ]
  },
  // 新闻类别
  {
    category: '新闻',
    sources: [
      {
        name: '新浪新闻',
        type: 'rss',
        url: 'https://rss.sina.com.cn/news/china.xml',
        active: true
      },
      {
        name: '腾讯新闻',
        type: 'rss',
        url: 'https://news.qq.com/rss/nws/rss20.xml',
        active: true
      },
      {
        name: '网易新闻',
        type: 'rss',
        url: 'https://news.163.com/special/00011K6L/rss_newstop.xml',
        active: true
      }
    ]
  }
]

async function initBuiltInSources() {
  console.log('开始初始化内置信息源...')
  
  try {
    // 先删除所有现有信息源
    await prisma.source.deleteMany({})
    console.log('已删除所有现有信息源')
    
    // 初始化信息源
    let count = 0
    for (const categoryGroup of builtInSources) {
      for (const source of categoryGroup.sources) {
        // 添加类别信息到配置中
        const config = JSON.stringify({ category: categoryGroup.category })
        
        await prisma.source.create({
          data: {
            ...source,
            config
          }
        })
        count++
      }
    }
    
    console.log(`成功初始化 ${count} 个内置信息源`)
  } catch (error) {
    console.error('初始化信息源失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

initBuiltInSources()
