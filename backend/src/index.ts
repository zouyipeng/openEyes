import express from 'express'
import cors from 'cors'
import prisma from './lib/db'
import { generateDailySummary } from './lib/ai'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

// 获取今日文章
app.get('/api/articles/today', async (req, res) => {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const articles = await prisma.article.findMany({
      where: {
        fetchedAt: {
          gte: today
        }
      },
      orderBy: {
        fetchedAt: 'desc'
      }
    })
    
    res.json(articles)
  } catch (error) {
    console.error('获取今日文章失败:', error)
    res.status(500).json({ error: '获取文章失败' })
  }
})

// 获取所有文章
app.get('/api/articles', async (req, res) => {
  try {
    const { page = 1, limit = 20, sourceId } = req.query
    
    const where = sourceId ? { sourceId: sourceId as string } : {}
    
    const articles = await prisma.article.findMany({
      where,
      orderBy: {
        fetchedAt: 'desc'
      },
      take: parseInt(limit as string),
      skip: (parseInt(page as string) - 1) * parseInt(limit as string)
    })
    
    const total = await prisma.article.count({ where })
    
    res.json({
      articles,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total
      }
    })
  } catch (error) {
    console.error('获取文章失败:', error)
    res.status(500).json({ error: '获取文章失败' })
  }
})

// 获取文章详情
app.get('/api/articles/:id', async (req, res) => {
  try {
    const { id } = req.params
    const article = await prisma.article.findUnique({
      where: { id }
    })
    
    if (!article) {
      return res.status(404).json({ error: '文章不存在' })
    }
    
    res.json(article)
  } catch (error) {
    console.error('获取文章详情失败:', error)
    res.status(500).json({ error: '获取文章详情失败' })
  }
})

// 更新文章状态
app.patch('/api/articles/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { isRead, isFavorite } = req.body
    
    const article = await prisma.article.update({
      where: { id },
      data: {
        isRead: isRead !== undefined ? isRead : undefined,
        isFavorite: isFavorite !== undefined ? isFavorite : undefined
      }
    })
    
    res.json(article)
  } catch (error) {
    console.error('更新文章状态失败:', error)
    res.status(500).json({ error: '更新文章状态失败' })
  }
})

// 获取所有信息源
app.get('/api/sources', async (req, res) => {
  try {
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
    res.json(sourcesWithCategory)
  } catch (error) {
    console.error('获取信息源失败:', error)
    res.status(500).json({ error: '获取信息源失败' })
  }
})

// 按类别获取信息源
app.get('/api/sources/categories', async (req, res) => {
  try {
    const sources = await prisma.source.findMany()
    // 按类别分组
    const categories: Record<string, any[]> = {}
    
    sources.forEach(source => {
      let category = '未分类'
      try {
        if (source.config) {
          const config = JSON.parse(source.config)
          category = config.category || '未分类'
        }
      } catch (error) {
        console.error('解析信息源配置失败:', error)
      }
      
      if (!categories[category]) {
        categories[category] = []
      }
      categories[category].push(source)
    })
    
    res.json(categories)
  } catch (error) {
    console.error('获取信息源分类失败:', error)
    res.status(500).json({ error: '获取信息源分类失败' })
  }
})

// 添加信息源
app.post('/api/sources', async (req, res) => {
  try {
    const { name, type, url, config, active = true } = req.body
    
    const source = await prisma.source.create({
      data: {
        name,
        type,
        url,
        config: config ? JSON.stringify(config) : undefined,
        active
      }
    })
    
    res.json(source)
  } catch (error) {
    console.error('添加信息源失败:', error)
    res.status(500).json({ error: '添加信息源失败' })
  }
})

// 更新信息源
app.patch('/api/sources/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { name, type, url, config, active } = req.body
    
    const source = await prisma.source.update({
      where: { id },
      data: {
        name: name !== undefined ? name : undefined,
        type: type !== undefined ? type : undefined,
        url: url !== undefined ? url : undefined,
        config: config !== undefined ? JSON.stringify(config) : undefined,
        active: active !== undefined ? active : undefined
      }
    })
    
    res.json(source)
  } catch (error) {
    console.error('更新信息源失败:', error)
    res.status(500).json({ error: '更新信息源失败' })
  }
})

// 删除信息源
app.delete('/api/sources/:id', async (req, res) => {
  try {
    const { id } = req.params
    await prisma.source.delete({
      where: { id }
    })
    
    res.json({ message: '信息源删除成功' })
  } catch (error) {
    console.error('删除信息源失败:', error)
    res.status(500).json({ error: '删除信息源失败' })
  }
})

// 获取每日摘要
app.get('/api/summary', async (req, res) => {
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
    res.json({ summary })
  } catch (error) {
    console.error('获取每日摘要失败:', error)
    res.status(500).json({ error: '获取每日摘要失败' })
  }
})

app.listen(PORT, () => {
  console.log(`后端服务运行在 http://localhost:${PORT}`)
})