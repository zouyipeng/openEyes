import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { fetchAllSources } from '@/lib/fetcher'

export async function GET() {
  try {
    const articles = await prisma.article.findMany({
      orderBy: { fetchedAt: 'desc' },
      take: 100,
      include: {
        source: {
          select: { name: true, url: true }
        }
      }
    })

    return NextResponse.json(articles)
  } catch (error) {
    return NextResponse.json({ error: '获取文章失败' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sourceId, sourceName, sourceUrl, title, content, url, author, publishedAt } = body

    if (!sourceId || !sourceName || !title) {
      return NextResponse.json({ error: '缺少必要字段' }, { status: 400 })
    }

    const article = await prisma.article.create({
      data: {
        sourceId,
        sourceName,
        sourceUrl,
        title,
        content,
        url,
        author,
        publishedAt: publishedAt ? new Date(publishedAt) : null,
      }
    })

    return NextResponse.json(article, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: '创建文章失败' }, { status: 500 })
  }
}
