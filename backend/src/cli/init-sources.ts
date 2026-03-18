#!/usr/bin/env node
import prisma from '../lib/db'

const builtInSources = [
  {
    category: 'AI',
    sources: [
      { name: '36氪 AI', type: 'rss', url: 'https://36kr.com/feed', active: true },
      { name: '量子位', type: 'rss', url: 'https://www.qbitai.com/feed', active: true },
      { name: 'InfoQ AI', type: 'rss', url: 'https://www.infoq.cn/feed', active: true },
      { name: '少数派', type: 'rss', url: 'https://sspai.com/feed', active: true },
      { name: 'IT之家', type: 'rss', url: 'https://www.ithome.com/rss/', active: true },
      { name: '掘金', type: 'rss', url: 'https://juejin.cn/rss', active: true },
      { name: '开源中国', type: 'rss', url: 'https://www.oschina.net/news/rss', active: true },
      { name: '虎嗅', type: 'rss', url: 'https://www.huxiu.com/rss/0.xml', active: true }
    ]
  }
]

async function initBuiltInSources() {
  console.log('开始初始化内置信息源...')
  
  try {
    await prisma.source.deleteMany({})
    console.log('已删除所有现有信息源')
    
    let count = 0
    for (const categoryGroup of builtInSources) {
      for (const source of categoryGroup.sources) {
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
