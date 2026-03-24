import fs from 'fs'
import path from 'path'
import NewsDashboard from '@/components/NewsDashboard'

export function generateStaticParams() {
  try {
    const datesPath = path.join(process.cwd(), 'public', 'dates.json')
    if (!fs.existsSync(datesPath)) {
      return []
    }

    const raw = fs.readFileSync(datesPath, 'utf8')
    const parsed = JSON.parse(raw)
    const dates: string[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.dates)
        ? parsed.dates
        : []

    return dates.map(date => ({ date }))
  } catch {
    return []
  }
}

export default function DatePage({ params }: { params: { date: string } }) {
  return <NewsDashboard initialDate={params.date} />
}
