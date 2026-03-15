'use client'

interface Source {
  id: string
  name: string
  type: string
  url: string
  active: boolean
  lastFetched: string | null
  _count: { articles: number }
}

interface SourceListProps {
  sources: Source[]
}

const typeLabels: Record<string, string> = {
  rss: 'RSS订阅',
  crawler: '网页爬虫',
  manual: '手动输入',
  social: '社交媒体',
}

export default function SourceList({ sources }: SourceListProps) {
  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个信息源吗？相关文章也会被删除。')) return

    try {
      const response = await fetch(`/api/sources/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        window.location.reload()
      }
    } catch (error) {
      console.error('删除失败:', error)
    }
  }

  const handleToggle = async (id: string, active: boolean) => {
    try {
      await fetch(`/api/sources/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active }),
      })
      window.location.reload()
    } catch (error) {
      console.error('更新失败:', error)
    }
  }

  if (sources.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
        <div className="text-gray-400 text-4xl mb-3">📡</div>
        <p className="text-gray-500">暂无信息源，请添加第一个信息源</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {sources.map((source) => (
        <div
          key={source.id}
          className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <h3 className="font-medium text-gray-900">{source.name}</h3>
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  source.active 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {source.active ? '启用' : '禁用'}
                </span>
              </div>
              <div className="flex items-center space-x-3 mt-1 text-sm text-gray-500">
                <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                  {typeLabels[source.type] || source.type}
                </span>
                <a 
                  href={source.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:text-primary-600 truncate max-w-xs"
                >
                  {new URL(source.url).hostname}
                </a>
              </div>
              <div className="flex items-center space-x-4 mt-2 text-xs text-gray-400">
                <span>{source._count.articles} 篇文章</span>
                {source.lastFetched && (
                  <span>
                    最后抓取: {new Date(source.lastFetched).toLocaleString('zh-CN')}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleToggle(source.id, !source.active)}
                className={`px-3 py-1 text-xs rounded ${
                  source.active
                    ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                }`}
              >
                {source.active ? '禁用' : '启用'}
              </button>
              <button
                onClick={() => handleDelete(source.id)}
                className="px-3 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
