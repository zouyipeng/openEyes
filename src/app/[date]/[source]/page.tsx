import fs from 'fs'
import path from 'path'
import SourceDashboard from '@/components/SourceDashboard'

export function generateStaticParams() {
  try {
    const indexPath = path.join(process.cwd(), 'public', 'source-dates.json')
    if (!fs.existsSync(indexPath)) {
      return [{ date: '2026-03-25', source: 'mailing-list' }]
    }

    const raw = fs.readFileSync(indexPath, 'utf8')
    const index = JSON.parse(raw)
    
    const params: { date: string; source: string }[] = []
    for (const [sourceName, data] of Object.entries(index)) {
      const dates = (data as any).dates || []
      for (const date of dates) {
        params.push({ date, source: sourceName })
      }
    }
    
    if (params.length === 0) {
      return [{ date: '2026-03-25', source: 'mailing-list' }]
    }
    
    return params
  } catch {
    return [{ date: '2026-03-25', source: 'mailing-list' }]
  }
}

const sourceNameMap: Record<string, string> = {
  'mailing-list': 'Mailing List',
  'mainline': 'Mainline',
}

export default function SourcePage({
  params,
}: {
  params: { date: string; source: string }
}) {
  const sourceName = sourceNameMap[params.source] || params.source
  return <SourceDashboard sourceName={sourceName} initialDate={params.date} />
}
