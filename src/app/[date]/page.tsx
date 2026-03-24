import NewsDashboard from '@/components/NewsDashboard'

export default function DatePage({ params }: { params: { date: string } }) {
  return <NewsDashboard initialDate={params.date} />
}
