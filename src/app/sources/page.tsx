import prisma from '@/lib/db'
import SourceForm from './SourceForm'
import SourceList from './SourceList'

async function getSources() {
  return prisma.source.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { articles: true }
      }
    }
  })
}

export default async function SourcesPage() {
  const sources = await getSources()

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">信息源管理</h1>
          <p className="text-gray-500 mt-1">添加和管理你的信息来源</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">添加信息源</h2>
            <SourceForm />
          </div>
        </div>

        <div className="lg:col-span-2">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            已添加的信息源 ({sources.length})
          </h2>
          <SourceList sources={sources} />
        </div>
      </div>
    </div>
  )
}
