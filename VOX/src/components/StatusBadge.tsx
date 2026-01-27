interface StatusBadgeProps {
  status: 'idle' | 'dialing' | 'mapping' | 'bridged' | 'ended' | 'failed'
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'idle':
        return {
          color: 'bg-white/10 text-white/60 border-white/20',
          icon: (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2M4 13h2m13-5v.01M6 8v.01" />
            </svg>
          ),
          text: 'Ready',
          pulse: false
        }
      case 'dialing':
        return {
          color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
          icon: (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          ),
          text: 'Dialing',
          pulse: true
        }
      case 'mapping':
        return {
          color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
          icon: (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          ),
          text: 'Mapping IVR',
          pulse: true
        }
      case 'bridged':
        return {
          color: 'bg-green-500/20 text-green-400 border-green-500/30',
          icon: (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          ),
          text: 'Connected',
          pulse: false
        }
      case 'ended':
        return {
          color: 'bg-white/10 text-white/60 border-white/20',
          icon: (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ),
          text: 'Call Ended',
          pulse: false
        }
      case 'failed':
        return {
          color: 'bg-red-500/20 text-red-400 border-red-500/30',
          icon: (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          text: 'Call Failed',
          pulse: false
        }
      default:
        return {
          color: 'bg-white/10 text-white/60 border-white/20',
          icon: null,
          text: 'Unknown',
          pulse: false
        }
    }
  }

  const config = getStatusConfig()

  return (
    <div className={`w-full inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-sm font-medium border ${config.color} ${config.pulse ? 'animate-pulse' : ''}`}>
      {config.icon && (
        <span className="mr-2">
          {config.icon}
        </span>
      )}
      {config.text}
      {config.pulse && (
        <div className="ml-2">
          <div className="flex space-x-1">
            <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      )}
    </div>
  )
}