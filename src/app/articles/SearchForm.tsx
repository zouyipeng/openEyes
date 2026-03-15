'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useState } from 'react'

interface Source {
  id: string
  name: string
}

interface SearchFormProps {
  sources: Source[]
}

export default function SearchForm({ sources }: SearchFormProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [sourceId, setSourceId] = useState(searchParams.get('source') || '')
  const [readFilter, setReadFilter] = useState(searchParams.get('read') || '')
  const [favoriteFilter, setFavoriteFilter] = useState(searchParams.get('favorite') || '')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (sourceId) params.set('source', sourceId)
    if (readFilter) params.set('read', readFilter)
    if (favoriteFilter) params.set('favorite', favoriteFilter)
    
    router.push(`${pathname}?${params.toString()}`)
  }

  const handleReset = () => {
    setQuery('')
    setSourceId('')
    setReadFilter('')
    setFavoriteFilter('')
    router.push(pathname)
  }

  return (
    <form onSubmit={handleSearch} className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索标题或内容..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        
        <div className="w-40">
          <select
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">所有来源</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div className="w-32">
          <select
            value={readFilter}
            onChange={(e) => setReadFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">全部状态</option>
            <option value="false">未读</option>
            <option value="true">已读</option>
          </select>
        </div>

        <div className="w-32">
          <select
            value={favoriteFilter}
            onChange={(e) => setFavoriteFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">全部收藏</option>
            <option value="true">已收藏</option>
          </select>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
          >
            搜索
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
          >
            重置
          </button>
        </div>
      </div>
    </form>
  )
}
