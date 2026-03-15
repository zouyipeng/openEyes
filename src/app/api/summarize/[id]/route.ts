import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { summarizeContent } from '@/lib/ai'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const article = await prisma.article.findUnique({
      where: { id: params.id }
    })

    if (!article) {
      return NextResponse.json({ error: '文章不存在' }, { status: 404 })
    }

    const summary = await summarizeContent(
      article.title, 
      article.content || ''
    )

    const updatedArticle = await prisma.article.update({
      where: { id: params.id },
      data: { summary }
    })

    return NextResponse.json(updatedArticle)
  } catch (error) {
    return NextResponse.json({ error: '总结失败' }, { status: 500 })
  }
}
