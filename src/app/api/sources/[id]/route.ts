import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const source = await prisma.source.findUnique({
      where: { id: params.id },
      include: {
        articles: {
          orderBy: { fetchedAt: 'desc' },
          take: 20
        }
      }
    })

    if (!source) {
      return NextResponse.json({ error: '信息源不存在' }, { status: 404 })
    }

    return NextResponse.json(source)
  } catch (error) {
    return NextResponse.json({ error: '获取信息源失败' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { name, type, url, config, active } = body

    const source = await prisma.source.update({
      where: { id: params.id },
      data: {
        name,
        type,
        url,
        config: config ? JSON.stringify(config) : null,
        active,
      }
    })

    return NextResponse.json(source)
  } catch (error) {
    return NextResponse.json({ error: '更新信息源失败' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.source.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: '删除信息源失败' }, { status: 500 })
  }
}
