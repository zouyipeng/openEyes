import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { summarizeContent } from '@/lib/ai'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const article = await prisma.article.findUnique({
      where: { id: params.id },
      include: {
        source: true
      }
    })

    if (!article) {
      return NextResponse.json({ error: '文章不存在' }, { status: 404 })
    }

    return NextResponse.json(article)
  } catch (error) {
    return NextResponse.json({ error: '获取文章失败' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { isRead, isFavorite, summary } = body

    const article = await prisma.article.update({
      where: { id: params.id },
      data: {
        isRead,
        isFavorite,
        summary,
      }
    })

    return NextResponse.json(article)
  } catch (error) {
    return NextResponse.json({ error: '更新文章失败' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.article.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: '删除文章失败' }, { status: 500 })
  }
}
