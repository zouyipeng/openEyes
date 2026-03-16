#!/usr/bin/env node
import prisma from '../lib/db'

async function clearData() {
  console.log('开始清除数据...')
  
  try {
    // 删除所有文章
    await prisma.article.deleteMany({})
    console.log('删除所有文章')
    
    // 删除所有信息源
    await prisma.source.deleteMany({})
    console.log('删除所有信息源')
    
    console.log('数据清除完成')
  } catch (error) {
    console.error('清除数据失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

clearData()
