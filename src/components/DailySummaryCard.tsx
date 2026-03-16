interface DailySummaryCardProps {
  summary: string
}

export default function DailySummaryCard({ summary }: DailySummaryCardProps) {
  return (
    <div className="bg-gradient-to-r from-primary-50 to-blue-50 rounded-xl p-4 sm:p-6 border border-primary-100">
      <div className="flex items-start space-x-3 sm:space-x-4">
        <div className="flex-shrink-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary-100 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
        </div>
        <div className="flex-1">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">AI 每日摘要</h3>
          <p className="text-gray-700 whitespace-pre-wrap">{summary}</p>
        </div>
      </div>
    </div>
  )
}
