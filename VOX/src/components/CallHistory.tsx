import { useState } from 'react'

interface CallRecord {
  id: number
  phone_number: string
  call_goal: string
  call_status: string
  transcript: Array<{
    timestamp: Date
    speaker?: string
    message: string
  }>
  call_summary?: string
  call_result: string
  created_at: string
}

interface CallHistoryProps {
  history: CallRecord[]
}

export function CallHistory({ history }: CallHistoryProps) {
  const [expandedCall, setExpandedCall] = useState<number | null>(null)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  if (history.length === 0) {
    return (
      <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-lg shadow-xl">
        <button 
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
        >
          <div>
            <h3 className="text-lg font-medium text-white">Call History</h3>
            <p className="text-sm text-white/60">No calls made yet</p>
          </div>
          <svg 
            className={`h-5 w-5 text-white/60 transform transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {isDropdownOpen && (
          <div className="px-6 pb-6">
            <div className="text-center py-8">
              <div className="text-white/60 mb-2">
                <svg className="mx-auto h-12 w-12 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <p className="text-white/60 text-sm">No calls made yet</p>
            </div>
          </div>
        )}
      </div>
    )
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const getStatusColor = (result: string) => {
    return result === 'auto_complete' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
  }

  return (
    <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-lg shadow-xl">
      <button 
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
      >
        <div>
          <h3 className="text-lg font-medium text-white">Call History</h3>
          <p className="text-sm text-white/60">Recent calls made with VOX ({history.length} total)</p>
        </div>
        <svg 
          className={`h-5 w-5 text-white/60 transform transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isDropdownOpen && (
        <div className="divide-y divide-white/10 max-h-96 overflow-y-auto">
          {history.map((call) => (
            <div key={call.id} className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {call.phone_number}
                    </p>
                    <p className="text-xs text-white/60">{formatDate(call.created_at)}</p>
                    <p className="text-sm text-white/70 truncate">
                      {call.call_goal}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(call.call_result)}`}>
                      {call.call_result === 'auto_complete' ? 'Auto-Completed' : 'Bridged'}
                    </span>
                  </div>
                </div>
                <div className="mt-2 flex items-center text-xs text-white/50">
                  <time>{formatDate(call.created_at)}</time>
                  {call.transcript && (
                    <span className="ml-2">• {call.transcript.length} messages</span>
                  )}
                </div>
              </div>
              <div className="ml-4">
                <button
                  onClick={() => setExpandedCall(expandedCall === call.id ? null : call.id)}
                  className="text-white/40 hover:text-white/60 transition-colors"
                >
                  <svg 
                    className={`h-5 w-5 transform transition-transform ${expandedCall === call.id ? 'rotate-180' : ''}`} 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Expanded transcript */}
            {expandedCall === call.id && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                {call.call_summary && (
                  <div className="mb-4 p-3 bg-white/10 rounded-lg">
                    <h4 className="text-sm font-medium text-white mb-1">Call Summary</h4>
                    <p className="text-sm text-white/70 mt-1">{call.call_summary}</p>
                  </div>
                )}
                
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-white mb-2">Transcript</h4>
                  <div className="max-h-60 overflow-y-auto space-y-2 bg-black/20 rounded-lg p-3">
                    {call.transcript && call.transcript.length > 0 ? (
                      call.transcript.map((entry, index) => (
                        <div key={index} className="text-sm">
                          <div className="flex items-start space-x-2">
                            <span className="text-xs text-white/40 font-mono mt-0.5 min-w-[80px]">
                              {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                            <span className={`font-medium min-w-[80px] ${
                              entry.speaker === 'VOX' ? 'text-blue-400' :
                              entry.speaker === 'Other Party' ? 'text-green-400' :
                              'text-white/60'
                            }`}>
                              {entry.speaker}:
                            </span>
                            <span className="text-white/80 flex-1">{entry.message}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-white/40 text-sm italic">No transcript available</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          ))}
        </div>
      )}
    </div>
  )
}

