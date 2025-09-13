import { useState, useEffect, useRef } from 'react'

export interface StreamEvent {
  id: string
  timestamp: Date
  type: 'system' | 'menu' | 'action' | 'transfer' | 'bridge' | 'info' | 'complete' | 'error'
  message: string
  data?: {
    menuOption?: string
    actionTaken?: string
    transferTarget?: string
    infoGathered?: {
      title: string
      link?: string
      details?: string
    }
    bridgeReason?: 'sensitive_data' | 'operator_required' | 'user_requested' | 'complex_query'
  }
}

interface LiveStreamProps {
  events: StreamEvent[]
  isActive: boolean
  callGoal?: string
}

export function LiveStream({ events, isActive, callGoal }: LiveStreamProps) {
  const [autoScroll, setAutoScroll] = useState(true)
  const streamEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (autoScroll && streamEndRef.current) {
      streamEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [events, autoScroll])

  // Check if user has scrolled up to disable auto-scroll
  const handleScroll = () => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10
      setAutoScroll(isAtBottom)
    }
  }

  const getEventIcon = (type: StreamEvent['type']) => {
    switch (type) {
      case 'system':
        return (
          <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      case 'menu':
        return (
          <svg className="h-4 w-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )
      case 'action':
        return (
          <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
          </svg>
        )
      case 'transfer':
        return (
          <svg className="h-4 w-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        )
      case 'bridge':
        return (
          <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        )
      case 'info':
        return (
          <svg className="h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )
      case 'complete':
        return (
          <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      case 'error':
        return (
          <svg className="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      default:
        return null
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    })
  }

  const getBridgeReasonText = (reason: string) => {
    switch (reason) {
      case 'sensitive_data':
        return 'Sensitive information required - connecting you now'
      case 'operator_required':
        return 'Human operator needed - transferring call'
      case 'user_requested':
        return 'User interaction requested - bridging call'
      case 'complex_query':
        return 'Complex query detected - human assistance required'
      default:
        return 'Connecting you to representative'
    }
  }

  if (!isActive && events.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center mb-4">
          <div className="h-8 w-8 bg-gray-100 rounded-lg flex items-center justify-center mr-3">
            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Live Call Stream</h3>
        </div>
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm">
            Start a call to see real-time navigation and events here
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center">
          <div className="h-8 w-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
            <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Live Call Stream</h3>
            {callGoal && (
              <p className="text-sm text-gray-600 truncate max-w-md">Goal: {callGoal}</p>
            )}
          </div>
        </div>
        
        {isActive && (
          <div className="flex items-center text-sm text-green-600">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse mr-2"></div>
            Live
          </div>
        )}
      </div>

      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="h-80 overflow-y-auto p-4 space-y-3 bg-gray-50"
      >
        {events.map((event) => (
          <div key={event.id} className="flex items-start space-x-3">
            <div className="flex-shrink-0 mt-0.5">
              {getEventIcon(event.type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-500 font-mono">
                  {formatTime(event.timestamp)}
                </span>
                {event.type === 'bridge' && event.data?.bridgeReason && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                    User Bridge Required
                  </span>
                )}
                {event.type === 'complete' && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                    Auto-Completed
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-900 mt-1">{event.message}</p>
              
              {/* Special handling for different event types */}
              {event.type === 'info' && event.data?.infoGathered && (
                <div className="mt-2 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                  <h4 className="text-sm font-medium text-indigo-900 mb-1">
                    Information Gathered:
                  </h4>
                  <p className="text-sm text-indigo-800 mb-2">{event.data.infoGathered.title}</p>
                  {event.data.infoGathered.link && (
                    <a 
                      href={event.data.infoGathered.link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Open Link
                    </a>
                  )}
                  {event.data.infoGathered.details && (
                    <p className="text-xs text-indigo-700 mt-1">{event.data.infoGathered.details}</p>
                  )}
                </div>
              )}
              
              {event.type === 'bridge' && event.data?.bridgeReason && (
                <div className="mt-2 p-3 bg-red-50 rounded-lg border border-red-200">
                  <p className="text-sm text-red-800">
                    {getBridgeReasonText(event.data.bridgeReason)}
                  </p>
                </div>
              )}
            </div>
          </div>
        ))}
        
        {isActive && (
          <div className="flex items-center space-x-3 opacity-60">
            <div className="flex-shrink-0">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="text-sm text-gray-600 italic">Processing...</p>
          </div>
        )}
        
        <div ref={streamEndRef} />
      </div>

      {!autoScroll && (
        <div className="p-2 bg-blue-50 border-t border-blue-200">
          <button
            onClick={() => {
              setAutoScroll(true)
              streamEndRef.current?.scrollIntoView({ behavior: 'smooth' })
            }}
            className="w-full text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            ↓ Scroll to latest events
          </button>
        </div>
      )}
    </div>
  )
}
