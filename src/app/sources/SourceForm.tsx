'use client'

import { useState } from 'react'

const sourceTypes = [
  { value: 'rss', label: 'RSS订阅', description: '自动解析RSS/Atom订阅源' },
  { value: 'crawler', label: '网页爬虫', description: '自定义选择器抓取网页内容' },
  { value: 'manual', label: '手动输入', description: '手动添加文章链接或内容' },
]

export default function SourceForm() {
  const [name, setName] = useState('')
  const [type, setType] = useState('rss')
  const [url, setUrl] = useState('')
  const [config, setConfig] = useState({
    selector: '',
    titleSelector: '',
    contentSelector: '',
    linkSelector: '',
  })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const response = await fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          type,
          url,
          config: type === 'crawler' ? config : undefined,
        }),
      })

      if (response.ok) {
        setMessage('添加成功！')
        setName('')
        setUrl('')
        setConfig({ selector: '', titleSelector: '', contentSelector: '', linkSelector: '' })
        setTimeout(() => window.location.reload(), 1000)
      } else {
        const data = await response.json()
        setMessage(data.error || '添加失败')
      }
    } catch (error) {
      setMessage('添加失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          信息源名称
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          placeholder="例如：科技媒体"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          类型
        </label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        >
          {sourceTypes.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-1">
          {sourceTypes.find((t) => t.value === type)?.description}
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          URL
        </label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          placeholder={type === 'rss' ? 'https://example.com/feed.xml' : 'https://example.com'}
          required
        />
      </div>

      {type === 'crawler' && (
        <div className="space-y-3 p-3 bg-gray-50 rounded-md">
          <p className="text-xs text-gray-600 font-medium">爬虫配置（CSS选择器）</p>
          <div>
            <label className="block text-xs text-gray-500 mb-1">列表项选择器</label>
            <input
              type="text"
              value={config.selector}
              onChange={(e) => setConfig({ ...config, selector: e.target.value })}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="article, .post, .item"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">标题选择器</label>
              <input
                type="text"
                value={config.titleSelector}
                onChange={(e) => setConfig({ ...config, titleSelector: e.target.value })}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="h2, .title"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">链接选择器</label>
              <input
                type="text"
                value={config.linkSelector}
                onChange={(e) => setConfig({ ...config, linkSelector: e.target.value })}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="a"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">内容选择器</label>
            <input
              type="text"
              value={config.contentSelector}
              onChange={(e) => setConfig({ ...config, contentSelector: e.target.value })}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="p, .summary"
            />
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-primary-600 text-white py-2 px-4 rounded-md hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? '添加中...' : '添加信息源'}
      </button>

      {message && (
        <p className={`text-sm ${message.includes('成功') ? 'text-green-600' : 'text-red-600'}`}>
          {message}
        </p>
      )}
    </form>
  )
}
