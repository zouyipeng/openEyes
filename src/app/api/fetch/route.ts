import { NextResponse } from 'next/server'
import { fetchAllSources } from '@/lib/fetcher'

export async function POST() {
  try {
    const results = await fetchAllSources()
    
    return NextResponse.json({
      success: true,
      message: `抓取完成：成功 ${results.success} 个，失败 ${results.failed} 个，共获取 ${results.articles.length} 篇文章`,
      ...results
    })
  } catch (error) {
    console.error('抓取失败:', error)
    return NextResponse.json({ 
      success: false, 
      error: '抓取失败' 
    }, { status: 500 })
  }
}
