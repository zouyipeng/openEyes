#!/usr/bin/env node
import prisma from '../lib/db'

// 测试文章数据
const testArticles = [
  // AI 类别
  {
    sourceName: 'OpenAI 博客',
    category: 'AI',
    title: 'GPT-5 发布',
    content: 'OpenAI 今日发布了最新的 GPT-5 模型，相比 GPT-4，性能提升了 300%，支持更复杂的任务和更长的上下文理解。',
    url: 'https://openai.com/blog/gpt-5'
  },
  {
    sourceName: 'AI 前线',
    category: 'AI',
    title: 'AI 大模型在医疗领域的应用',
    content: '研究表明，AI 大模型在医疗诊断方面的准确率已经超过了人类医生，能够更早地发现潜在的健康问题。',
    url: 'https://www.aifront.net/article/ai-in-medicine'
  },
  {
    sourceName: '机器之心',
    category: 'AI',
    title: '开源 AI 模型的崛起',
    content: '开源 AI 模型正在迅速崛起，挑战着闭源模型的地位，为 AI 技术的普及和创新提供了新的可能。',
    url: 'https://www.jiqizhixin.com/article/open-source-ai'
  },
  // 科技类别
  {
    sourceName: '科技日报',
    category: '科技',
    title: '人工智能技术取得重大突破',
    content: '近日，人工智能领域取得了重大突破，研究人员开发出了一种新的深度学习算法，能够更准确地识别图像和处理自然语言。',
    url: 'https://www科技日报.com/article/1'
  },
  {
    sourceName: '36氪',
    category: '科技',
    title: ' startups融资热潮',
    content: '2024年第一季度，全球科技 startups融资额达到了创纪录的1000亿美元，其中人工智能和区块链领域最受投资者青睐。',
    url: 'https://www.36kr.com/article/1'
  },
  {
    sourceName: 'TechCrunch',
    category: '科技',
    title: '苹果发布新款MacBook Pro',
    content: '苹果公司今天发布了新款MacBook Pro，搭载了最新的M3芯片，性能提升了30%以上。',
    url: 'https://techcrunch.com/article/1'
  },
  // 财经类别
  {
    sourceName: '财经网',
    category: '财经',
    title: '股市迎来牛市行情',
    content: '受经济数据向好影响，A股市场连续上涨，沪指突破4000点大关。',
    url: 'https://www财经网.com/article/1'
  },
  {
    sourceName: '华尔街见闻',
    category: '财经',
    title: '美联储暗示将降息',
    content: '美联储主席在最新讲话中暗示，年内可能会开始降息，以应对经济增长放缓的风险。',
    url: 'https://wallstreetcn.com/article/1'
  },
  // 新闻类别
  {
    sourceName: '新华社',
    category: '新闻',
    title: '国家领导人出访欧洲',
    content: '国家领导人开始对欧洲多国进行国事访问，将与各国领导人就双边关系和国际热点问题交换意见。',
    url: 'https://www新华社.com/article/1'
  },
  {
    sourceName: '人民日报',
    category: '新闻',
    title: '全国两会胜利闭幕',
    content: '第十三届全国人民代表大会第五次会议胜利闭幕，会议通过了多项重要决议。',
    url: 'https://www人民日报.com/article/1'
  },
  // 体育类别
  {
    sourceName: '体育新闻',
    category: '体育',
    title: '中国队在亚洲杯取得开门红',
    content: '在刚刚结束的亚洲杯足球赛中，中国队以2-0战胜对手，取得了开门红。',
    url: 'https://www体育新闻.com/article/1'
  },
  {
    sourceName: 'ESPN',
    category: '体育',
    title: 'NBA全明星赛精彩落幕',
    content: '2024年NBA全明星赛在洛杉矶精彩落幕，东部队以150-145战胜西部队。',
    url: 'https://www.espn.com/article/1'
  },
  // 娱乐类别
  {
    sourceName: '娱乐新闻',
    category: '娱乐',
    title: '春节档电影票房创新高',
    content: '2024年春节档电影票房突破100亿元，创下历史新高。',
    url: 'https://www娱乐新闻.com/article/1'
  },
  {
    sourceName: 'TMZ',
    category: '娱乐',
    title: '好莱坞明星婚礼引发关注',
    content: '好莱坞著名影星在本月举行了盛大的婚礼，众多名人到场祝贺。',
    url: 'https://www.tmz.com/article/1'
  }
]

async function generateTestData() {
  console.log('开始生成测试数据...')
  
  try {
    // 首先获取所有信息源
    const sources = await prisma.source.findMany()
    
    if (sources.length === 0) {
      console.log('请先初始化信息源')
      return
    }
    
    // 生成测试文章
    let count = 0
    for (const testArticle of testArticles) {
      // 查找对应的信息源
      const source = sources.find(s => s.name === testArticle.sourceName)
      if (!source) {
        console.log(`未找到信息源: ${testArticle.sourceName}`)
        continue
      }
      
      // 使用简单的摘要
      const summary = `${testArticle.title} - ${testArticle.content.substring(0, 50)}...`
      
      // 创建文章
      await prisma.article.create({
        data: {
          sourceId: source.id,
          sourceName: source.name,
          sourceUrl: source.url,
          title: testArticle.title,
          content: testArticle.content,
          summary,
          url: testArticle.url,
          isRead: false,
          isFavorite: false
        }
      })
      count++
      console.log(`生成文章: ${testArticle.title}`)
    }
    
    console.log(`成功生成 ${count} 篇测试文章`)
  } catch (error) {
    console.error('生成测试数据失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

generateTestData()
