import prisma from '@/lib/db'
import ArticleCard from '@/components/ArticleCard'
import SearchForm from './SearchForm'

interface ArticlesPageProps {
  searchParams: {
    q?: string
    source?: string
    read?: string
    favorite?: string
  }
}

async function getArticles(params: ArticlesPageProps['searchParams']) {
  const where: any = {}

  if (params.q) {
    where.OR = [
      { title: { contains: params.q } },
      { content: { contains: params.q } },
    ]
  }

  if (params.source) {
    where.sourceId = params.source
  }

  if (params.read === 'true') {
    where.isRead = true
  } else if (params.read === 'false') {
    where.isRead = false
  }

  if (params.favorite === 'true') {
    where.isFavorite = true
  }

  return prisma.article.findMany({
    where,
    orderBy: { fetchedAt: 'desc' },
    take: 100,
  })
}

async function getSources() {
  return prisma.source.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true }
  })
}

export default async function ArticlesPage({ searchParams }: ArticlesPageProps) {
  const [articles, sources] = await Promise.all([
    getArticles(searchParams),
    getSources()
  ])

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">全部文章</h1>
          <p className="text-gray-500 mt-1">共 {articles.length} 篇文章</p>
        </div>
      </div>

      <SearchForm sources={sources} />

      {articles.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <div className="text-gray-400 text-4xl mb-3">📭</div>
          <p className="text-gray-500">没有找到匹配的文章</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      )}
    </div>
  )
}
