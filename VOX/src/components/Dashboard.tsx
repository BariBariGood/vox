import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { CallInputs } from './CallInputs'
import { StatusBadge } from './StatusBadge'
import { LiveStream } from './LiveStream'
import type { StreamEvent } from './LiveStream'
import { vapiService, type VAPICallEvent } from '../services/vapiService'

type CallStatus = 'idle' | 'dialing' | 'mapping' | 'bridged' | 'ended' | 'failed'

export function Dashboard() {
  const { user, signOut } = useAuth()
  const [callStatus, setCallStatus] = useState<CallStatus>('idle')
  const [currentCall, setCurrentCall] = useState<{
    phoneNumber: string
    goal: string
    vapiCallId?: string
  } | null>(null)
  const [streamEvents, setStreamEvents] = useState<StreamEvent[]>([])
  const [callResult, setCallResult] = useState<{
    type: 'auto_complete' | 'bridged'
    data?: any
  } | null>(null)

  // Convert VAPI events to StreamEvents
  const convertVAPIEventToStreamEvent = (vapiEvent: VAPICallEvent): StreamEvent => {
    const baseEvent = {
      id: `vapi-${Date.now()}-${Math.random()}`,
      timestamp: vapiEvent.timestamp
    }

    switch (vapiEvent.type) {
      case 'call-started':
        return {
          ...baseEvent,
          type: 'system',
          message: 'Call initiated - Connecting to phone system...'
        }
      case 'speech-started':
        return {
          ...baseEvent,
          type: 'system',
          message: 'VOX is speaking...'
        }
      case 'speech-ended':
        return {
          ...baseEvent,
          type: 'system',
          message: 'Listening for response...'
        }
      case 'transcript':
        const isAssistant = vapiEvent.data?.role === 'assistant'
        return {
          ...baseEvent,
          type: isAssistant ? 'action' : 'menu',
          message: `${isAssistant ? 'VOX: ' : 'System: '}${vapiEvent.data?.content || vapiEvent.data?.text || 'Audio detected'}`
        }
      case 'tool-call':
        if (vapiEvent.data?.function?.name === 'gatherInformation') {
          return {
            ...baseEvent,
            type: 'info',
            message: 'Information successfully gathered',
            data: {
              infoGathered: vapiEvent.data.function.arguments
            }
          }
        } else if (vapiEvent.data?.function?.name === 'transferCall') {
          return {
            ...baseEvent,
            type: 'bridge',
            message: 'Transferring call to user - Human interaction required',
            data: {
              bridgeReason: 'operator_required'
            }
          }
        }
        return {
          ...baseEvent,
          type: 'action',
          message: `Tool called: ${vapiEvent.data?.function?.name || 'Unknown'}`
        }
      case 'call-ended':
        return {
          ...baseEvent,
          type: 'complete',
          message: 'Call completed successfully'
        }
      case 'error':
        return {
          ...baseEvent,
          type: 'error',
          message: `Error: ${vapiEvent.data?.error || 'Unknown error occurred'}`
        }
      default:
        return {
          ...baseEvent,
          type: 'system',
          message: `Event: ${vapiEvent.type}`
        }
    }
  }

  const handleStartCall = async (phoneNumber: string, callGoal: string) => {
    console.log('Starting VAPI call:', { phoneNumber, callGoal })
    
    try {
      // Store call data and reset state
      setCurrentCall({ phoneNumber, goal: callGoal })
      setStreamEvents([])
      setCallResult(null)
      setCallStatus('dialing')

      // Add initial event
      const initialEvent: StreamEvent = {
        id: 'start-1',
        timestamp: new Date(),
        type: 'system',
        message: `Initiating call to ${phoneNumber}...`
      }
      setStreamEvents([initialEvent])

      // Test VAPI connection first
      console.log('Testing VAPI connection...')
      const connectionTest = await vapiService.testConnection()
      if (!connectionTest) {
        throw new Error('Unable to connect to VAPI service. Please check your internet connection.')
      }

      const connectionEvent: StreamEvent = {
        id: 'connection-1',
        timestamp: new Date(),
        type: 'system',
        message: 'Connected to VAPI service - Creating AI assistant...'
      }
      setStreamEvents(prev => [...prev, connectionEvent])

      // Set up event handler
      const eventHandler = vapiService.setupWebhookHandler((vapiEvent: VAPICallEvent) => {
        console.log('VAPI Event:', vapiEvent)
        
        const streamEvent = convertVAPIEventToStreamEvent(vapiEvent)
        setStreamEvents(prev => [...prev, streamEvent])

        // Update status based on event
        if (vapiEvent.type === 'call-started') {
          setCallStatus('mapping')
        } else if (vapiEvent.type === 'tool-call') {
          if (vapiEvent.data?.function?.name === 'gatherInformation') {
            setCallStatus('ended')
            setCallResult({
              type: 'auto_complete',
              data: vapiEvent.data.function.arguments
            })
            // Auto-reset after showing result
            setTimeout(() => {
              setCallStatus('idle')
              setCurrentCall(null)
              setTimeout(() => setStreamEvents([]), 3000)
            }, 8000)
          } else if (vapiEvent.data?.function?.name === 'transferCall') {
            setCallStatus('bridged')
            setCallResult({ type: 'bridged' })
          }
        } else if (vapiEvent.type === 'call-ended') {
          setCallStatus('ended')
          setTimeout(() => {
            setCallStatus('idle')
            setCurrentCall(null)
            setTimeout(() => setStreamEvents([]), 3000)
          }, 5000)
        } else if (vapiEvent.type === 'error') {
          setCallStatus('failed')
          setTimeout(() => {
            setCallStatus('idle')
            setCurrentCall(null)
          }, 5000)
        }
      })

      // Start the actual VAPI call
      const vapiCallId = await vapiService.startCall({
        phoneNumber,
        callGoal,
        customerNumber: user?.phone || undefined
      })

      console.log('VAPI call started with ID:', vapiCallId)
      
      // Update current call with VAPI ID
      setCurrentCall(prev => prev ? { ...prev, vapiCallId } : null)

      // Start event polling
      const stopPolling = eventHandler(vapiCallId)

      // Store cleanup function (you might want to store this in state for manual cleanup)
      return stopPolling

    } catch (error) {
      console.error('Error starting VAPI call:', error)
      
      // Add error event
      const errorEvent: StreamEvent = {
        id: 'error-1',
        timestamp: new Date(),
        type: 'error',
        message: `Failed to start call: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
      setStreamEvents(prev => [...prev, errorEvent])
      setCallStatus('failed')
      
      // Reset after error
      setTimeout(() => {
        setCallStatus('idle')
        setCurrentCall(null)
      }, 5000)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <h1 className="ml-3 text-xl font-semibold text-gray-900">VOX</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <StatusBadge status={callStatus} />
              <span className="text-sm text-gray-600">
                Welcome, {user?.email}
              </span>
              <button
                onClick={signOut}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0 space-y-6">
          
          {/* Welcome Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Welcome to VOX! 🎯
              </h3>
              <p className="text-gray-700 mb-4">
                Your AI-powered call assistant is ready to help you navigate phone systems and connect with humans faster.
              </p>
              <div className="flex items-center text-sm text-gray-600">
                <svg className="w-4 h-4 mr-2 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                System ready - Enter call details below
              </div>
            </div>
          </div>

          {/* Call Inputs */}
          <CallInputs 
            onStartCall={handleStartCall}
            isCallActive={callStatus !== 'idle'}
          />

          {/* Live Stream - Always visible but shows different states */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <LiveStream 
                events={streamEvents}
                isActive={callStatus !== 'idle' && callStatus !== 'ended'}
                callGoal={currentCall?.goal}
              />
            </div>
            
            <div className="space-y-6">
              {/* Current Call Info */}
              {currentCall && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Call</h3>
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm font-medium text-gray-500">Phone Number:</span>
                      <p className="text-gray-900 font-mono">{currentCall.phoneNumber}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-500">Goal:</span>
                      <p className="text-gray-900 text-sm">{currentCall.goal}</p>
                    </div>
                    {currentCall.vapiCallId && (
                      <div>
                        <span className="text-sm font-medium text-gray-500">VAPI Call ID:</span>
                        <p className="text-gray-900 font-mono text-xs">{currentCall.vapiCallId}</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Call Controls */}
                  {callStatus !== 'idle' && callStatus !== 'ended' && currentCall.vapiCallId && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <button
                        onClick={async () => {
                          try {
                            await vapiService.endCall(currentCall.vapiCallId!)
                            setCallStatus('ended')
                            setTimeout(() => {
                              setCallStatus('idle')
                              setCurrentCall(null)
                            }, 2000)
                          } catch (error) {
                            console.error('Error ending call:', error)
                          }
                        }}
                        className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                      >
                        End Call
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Call Result */}
              {callResult && callResult.type === 'auto_complete' && callResult.data && (
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center mb-4">
                    <div className="h-8 w-8 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                      <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">Call Completed!</h3>
                  </div>
                  
                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <h4 className="font-medium text-green-900 mb-2">{callResult.data.title}</h4>
                    {callResult.data.link && (
                      <a 
                        href={callResult.data.link} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-green-700 hover:text-green-800 font-medium text-sm mb-2"
                      >
                        <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        Open Link
                      </a>
                    )}
                    {callResult.data.details && (
                      <p className="text-green-800 text-sm">{callResult.data.details}</p>
                    )}
                  </div>
                </div>
              )}

              {callResult && callResult.type === 'bridged' && (
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center mb-4">
                    <div className="h-8 w-8 bg-red-100 rounded-lg flex items-center justify-center mr-3">
                      <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">You're Connected!</h3>
                  </div>
                  
                  <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                    <p className="text-red-800 text-sm">
                      VOX has connected you to a human representative. The call is now in your hands!
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Features Preview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center mb-3">
                <div className="h-8 w-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                  <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <h4 className="font-medium text-gray-900">Live Stream</h4>
              </div>
              <p className="text-sm text-gray-600">
                Real-time transcript of call navigation and key moments will appear here.
              </p>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center mb-3">
                <div className="h-8 w-8 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                  <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h4 className="font-medium text-gray-900">Call History</h4>
              </div>
              <p className="text-sm text-gray-600">
                Your completed calls with outcomes and transcripts will be stored here.
              </p>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center mb-3">
                <div className="h-8 w-8 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                  <svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h4 className="font-medium text-gray-900">AI Memory</h4>
              </div>
              <p className="text-sm text-gray-600">
                Learned IVR paths and successful navigation strategies for faster future calls.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
