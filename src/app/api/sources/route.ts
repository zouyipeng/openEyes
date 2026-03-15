import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export async function GET() {
  try {
    const sources = await prisma.source.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { articles: true }
        }
      }
    })
    
    return NextResponse.json(sources)
  } catch (error) {
    return NextResponse.json({ error: '获取信息源失败' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, type, url, config } = body

    if (!name || !type || !url) {
      return NextResponse.json({ error: '缺少必要字段' }, { status: 400 })
    }

    const source = await prisma.source.create({
      data: {
        name,
        type,
        url,
        config: config ? JSON.stringify(config) : null,
      }
    })

    return NextResponse.json(source, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: '创建信息源失败' }, { status: 500 })
  }
}
