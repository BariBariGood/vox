import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { CallInputs } from './CallInputs'
import { StatusBadge } from './StatusBadge'
import { vapiService, type VAPICallEvent } from '../services/vapiService'
import { supabase } from '../lib/supabase'

// Define StreamEvent type locally since LiveStream is not imported in the new UI
export interface StreamEvent {
  id: string
  timestamp: Date
  type: 'system' | 'menu' | 'action' | 'transfer' | 'bridge' | 'info' | 'complete' | 'error'
  message: string
  data?: any
}

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
  const [callHistory, setCallHistory] = useState<any[]>([])
  const [selectedCallId, setSelectedCallId] = useState<number | null>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [callToDelete, setCallToDelete] = useState<any | null>(null)

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
        const speaker = vapiEvent.data?.speaker || (vapiEvent.data?.role === 'assistant' ? 'VOX' : 'Other Party')
        const content = vapiEvent.data?.content || vapiEvent.data?.text || 'Audio detected'
        
        return {
          ...baseEvent,
          type: vapiEvent.data?.role === 'assistant' ? 'action' : 'menu',
          message: `${speaker}: ${content}`
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
        } else if (vapiEvent.data?.function?.name === 'sendDTMF') {
          return {
            ...baseEvent,
            type: 'action',
            message: `Pressed: ${vapiEvent.data.function.arguments?.digits || 'button'}`
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
      case 'call-status':
        return {
          ...baseEvent,
          type: 'system',
          message: `Call status: ${vapiEvent.data?.status}`
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

  // Save completed call to database
  const saveCallToDatabase = async () => {
    if (!currentCall || !user) return

    try {
      console.log('🔍 Stream events to save:', streamEvents.length)
      console.log('🔍 Sample events:', streamEvents.slice(0, 5))

      // Extract full transcript from stream events
      // Look for events that contain actual conversation content
      const transcript = streamEvents.filter(event => {
        // Include transcript messages (VOX: or Other Party:)
        const isTranscript = event.message.includes('VOX:') ||
                           event.message.includes('Other Party:') ||
                           event.message.includes('AI:') ||
                           event.message.includes('User:')

        // Include system messages about the call
        const isImportantSystem = event.type === 'system' &&
                                 event.message.includes('Call Summary:')

        // Include action/menu/info events
        const isConversation = event.type === 'action' ||
                              event.type === 'menu' ||
                              event.type === 'info'

        return isTranscript || isImportantSystem || isConversation
      }).map(event => {
        // Parse the speaker from the message format "Speaker: content"
        let speaker = 'System'
        let message = event.message

        if (event.message.includes(':')) {
          const colonIndex = event.message.indexOf(':')
          const potentialSpeaker = event.message.substring(0, colonIndex).trim()

          if (potentialSpeaker === 'VOX' || potentialSpeaker === 'AI') {
            speaker = 'VOX'
            message = event.message.substring(colonIndex + 1).trim()
          } else if (potentialSpeaker === 'Other Party' || potentialSpeaker === 'User') {
            speaker = 'Other Party'
            message = event.message.substring(colonIndex + 1).trim()
          } else if (potentialSpeaker === 'Call Summary') {
            speaker = 'System'
            message = event.message.substring(colonIndex + 1).trim()
          }
        }

        return {
          timestamp: event.timestamp.toISOString(),
          speaker: speaker,
          message: message
        }
      })

      console.log('📝 Processed transcript:', transcript)

      // Extract call summary if available
      const summaryEvent = streamEvents.find(event =>
        event.message.includes('Call Summary:')
      )
      const callSummary = summaryEvent
        ? summaryEvent.message.replace('Call Summary:', '').trim()
        : null

      console.log('📋 Call summary found:', callSummary)

      const callRecord = {
        user_id: user.id,
        phone_number: currentCall.phoneNumber,
        call_goal: currentCall.goal,
        vapi_call_id: currentCall.vapiCallId || null,
        call_status: 'completed',
        transcript: transcript.length > 0 ? transcript : null,
        call_summary: callSummary,
        call_result: callResult?.type || 'auto_complete'
      }

        console.log('💾 Saving call to database:', callRecord)
        console.log('📝 Transcript length:', transcript.length)
        console.log('👤 User ID:', user.id)
        console.log('🔐 User object:', user)
        
        // Check current auth session
        const { data: session } = await supabase.auth.getSession()
        console.log('🔑 Current session:', session)
        console.log('🔑 Session user:', session.session?.user)

        // Save to Supabase
        const { data, error } = await supabase
          .from('call_history')
          .insert([callRecord])
          .select()

        if (error) {
          console.error('❌ Failed to save call:', error)
          console.error('Error details:', error.message, error.details)
          console.error('Error hint:', error.hint)
        } else {
          console.log('✅ Call saved successfully:', data)
          console.log('✅ Saved data details:', JSON.stringify(data, null, 2))
          
          // Verify the record was actually saved by checking the table
          const { data: checkData, error: checkError } = await supabase
            .from('call_history')
            .select('*')
            .eq('id', data[0]?.id)
          
          if (checkError) {
            console.error('❌ Error checking saved record:', checkError)
          } else {
            console.log('✅ Verification - Record exists:', checkData)
          }
          
          // Reload call history
          loadCallHistory()
        }
    } catch (error) {
      console.error('❌ Error saving call:', error)
    }
  }
  
  // Load call history from database
  const loadCallHistory = async () => {
    if (!user) {
      console.log('⚠️ No user found, cannot load call history')
      return
    }
    
    try {
      console.log('📊 Loading call history for user:', user.id)
      
      // First, try to get ALL records (ignoring user_id for debugging)
      const { data: allData, error: allError } = await supabase
        .from('call_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      
      console.log('📊 All records in table:', allData?.length || 0)
      if (allData && allData.length > 0) {
        console.log('📊 Sample record:', allData[0])
      }
      
      // Then try to get records for this specific user
      const { data, error } = await supabase
        .from('call_history')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)
      
      if (error) {
        console.error('❌ Failed to load call history:', error)
        console.error('Error details:', error.message)
      } else {
        console.log('✅ Loaded call history for user:', data?.length || 0, 'calls')
        if (data && data.length > 0) {
          console.log('✅ First record:', data[0])
        }
        setCallHistory(data || [])
      }
    } catch (error) {
      console.error('❌ Error loading call history:', error)
    }
  }
  
  // Load call history on component mount
  useEffect(() => {
    loadCallHistory()
  }, [user])

  // Delete call from database
  const deleteCall = async (callId: number) => {
    try {
      console.log('🗑️ Deleting call:', callId)
      
      const { error } = await supabase
        .from('call_history')
        .delete()
        .eq('id', callId)
      
      if (error) {
        console.error('❌ Failed to delete call:', error)
        return false
      }
      
      console.log('✅ Call deleted successfully')
      
      // Update local state
      setCallHistory(prev => prev.filter(call => call.id !== callId))
      
      // Clear selected call if it was deleted
      if (selectedCallId === callId) {
        setSelectedCallId(null)
      }
      
      return true
    } catch (error) {
      console.error('❌ Error deleting call:', error)
      return false
    }
  }

  const handleDeleteClick = (call: any, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent selecting the call
    setCallToDelete(call)
    setDeleteModalOpen(true)
  }

  const confirmDelete = async () => {
    if (!callToDelete) return
    
    const success = await deleteCall(callToDelete.id)
    if (success) {
      setDeleteModalOpen(false)
      setCallToDelete(null)
    }
  }

  // Store cleanup function for polling
  const [stopPolling, setStopPolling] = useState<(() => void) | null>(null)

  const handleEndCall = async () => {
    if (!currentCall?.vapiCallId) return

    try {
      console.log('📴 Ending call manually...')

      // Stop polling if active
      if (stopPolling) {
        stopPolling()
        setStopPolling(null)
      }

      // End the VAPI call
      await vapiService.endCall(currentCall.vapiCallId)

      // Update UI immediately
      setCallStatus('ended')

      // Add end event to stream
      const endEvent: StreamEvent = {
        id: `manual-end-${Date.now()}`,
        timestamp: new Date(),
        type: 'complete',
        message: 'Call ended by user'
      }
      setStreamEvents(prev => [...prev, endEvent])

      // Save to database after delay
      setTimeout(() => {
        saveCallToDatabase()
      }, 1000)

      // Reset UI after delay
      setTimeout(() => {
        setCallStatus('idle')
      }, 3000)
    } catch (error) {
      console.error('❌ Error ending call:', error)
    }
  }

  const handleStartCall = async (phoneNumber: string, callGoal: string) => {
    console.log('Starting VAPI call:', { phoneNumber, callGoal })
    
    try {
      // Clear previous call data when starting new call
      setStreamEvents([])
      setCallResult(null)
      setCurrentCall({ phoneNumber, goal: callGoal })
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
            // Don't auto-reset - wait for call-ended event
          } else if (vapiEvent.data?.function?.name === 'transferCall') {
            setCallStatus('bridged')
            setCallResult({ type: 'bridged' })
          }
        } else if (vapiEvent.type === 'call-ended') {
          setCallStatus('ended')

          // Save call to database after a delay to ensure ALL transcript events are processed
          // VAPI sends transcript after the call-ended event
          setTimeout(() => {
            console.log('📞 Call ended, waiting for final transcript...')
            console.log('📊 Current stream events count:', streamEvents.length)
            saveCallToDatabase()
          }, 3000) // Increased delay to capture final transcript

          // Keep call data visible for review
          setTimeout(() => {
            setCallStatus('idle')
            // Keep currentCall and streamEvents for history viewing
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
      const stopPollingFunction = eventHandler(vapiCallId)

      // Store cleanup function for manual end call
      setStopPolling(() => stopPollingFunction)

      return stopPollingFunction

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
    <div className="min-h-screen relative bg-gray-950 overflow-hidden">
      {/* Background Blur Effect */}
      <div className="w-[749.23px] h-[749.23px] left-[345.39px] top-[137.39px] absolute bg-gradient-to-b from-blue-800/50 to-indigo-100/50 rounded-full border-[20px] border-indigo-100 blur-[125px]" />
      
      {/* Sidebar Navigation */}
      <nav className="fixed left-0 top-0 h-full w-80 bg-slate-800/50 backdrop-blur-sm border-r border-slate-700/50 flex flex-col z-10">
        <div className="p-4 border-b border-slate-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="h-8 w-8 flex items-center justify-center">
                <img src="/src/assets/vox-logo.svg" alt="VOX Logo" className="h-8 w-8" />
              </div>
              <h1 className="ml-3 text-xl font-semibold text-white">VOX</h1>
            </div>
            <button
              onClick={() => setSelectedCallId(null)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="New Call"
            >
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>

        {/* Call History List */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            {/* Active Call Section */}
            {currentCall && callStatus !== 'idle' && (
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-2">Active Call</h3>
                <div className="bg-green-500/20 border border-green-500/30 rounded-lg px-3 py-2 mb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {currentCall.goal}
                      </p>
                      <p className="text-xs text-green-400 truncate">
                        {currentCall.phoneNumber}
                      </p>
                    </div>
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">Call History</h3>
            <div className="space-y-1">
              {callHistory.length === 0 ? (
                <p className="text-sm text-white/40 italic px-3 py-2">No calls yet</p>
              ) : (
                callHistory.map((call) => (
                  <div
                    key={call.id}
                    className={`group relative w-full text-left px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                      selectedCallId === call.id
                        ? 'bg-white/20 text-white'
                        : 'hover:bg-white/10 text-white/80'
                    }`}
                    onClick={() => setSelectedCallId(call.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {call.call_goal}
                        </p>
                        <p className="text-xs text-white/60 truncate">
                          {call.phone_number}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          call.call_result === 'auto_complete'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {call.call_result === 'auto_complete' ? '✓' : '→'}
                        </span>
                        {/* Delete button - only visible on hover */}
                        <button
                          onClick={(e) => handleDeleteClick(call, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition-all"
                          title="Delete call"
                        >
                          <svg className="h-4 w-4 text-red-400 hover:text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-white/40 mt-1">
                      {new Date(call.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        
        {/* Bottom section with user info and controls */}
        <div className="p-4 border-t border-slate-700/50 space-y-3">
          <StatusBadge status={callStatus} />
          <div className="text-sm text-white/60">
            Welcome, {user?.email}
          </div>
          <div className="flex space-x-2">
            <Link
              to="/account"
              className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors flex-1 flex justify-center"
              title="Account Settings"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </Link>
            <button
              onClick={signOut}
              className="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors flex-1"
            >
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="ml-80 overflow-auto relative z-10 flex flex-col min-h-screen">
        {currentCall && callStatus !== 'idle' ? (
          // Live Call View
          <div className="flex-1 flex flex-col">
            {/* Live Call Header */}
            <div className="bg-green-500/10 backdrop-blur-sm border-b border-green-500/30 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white flex items-center">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse mr-2"></div>
                    Live Call in Progress
                  </h2>
                  <p className="text-sm text-white/60">{currentCall.phoneNumber} • {currentCall.goal}</p>
                </div>
                <StatusBadge status={callStatus} />
              </div>
            </div>

            {/* Live Transcript */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="max-w-4xl mx-auto space-y-4">
                {streamEvents.length > 0 ? (
                  streamEvents.map((event) => {
                    const isVOX = event.message.includes('VOX:')
                    const isOtherParty = event.message.includes('Other Party:')
                    const isSystem = !isVOX && !isOtherParty

                    let speaker = 'System'
                    let message = event.message

                    if (isVOX) {
                      speaker = 'VOX'
                      message = event.message.replace('VOX:', '').trim()
                    } else if (isOtherParty) {
                      speaker = 'Other Party'
                      message = event.message.replace('Other Party:', '').trim()
                    }

                    return (
                      <div key={event.id} className={`flex ${isVOX ? 'justify-start' : isOtherParty ? 'justify-end' : 'justify-center'}`}>
                        <div className={`max-w-[70%] ${isSystem ? 'w-full' : ''}`}>
                          <div className={`rounded-lg px-4 py-2 ${
                            isSystem
                              ? 'bg-slate-700/30 text-white/60 text-center text-sm italic'
                              : isVOX
                              ? 'bg-slate-700/50 text-white'
                              : 'bg-blue-600/20 text-white'
                          }`}>
                            {!isSystem && (
                              <p className="text-xs text-white/60 mb-1 font-semibold">
                                {speaker}
                              </p>
                            )}
                            <p className="text-sm">{message}</p>
                            <p className="text-xs text-white/40 mt-1">
                              {event.timestamp.toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="text-center py-8">
                    <p className="text-white/40">Waiting for call to connect...</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : selectedCallId ? (
          // Chat View for Selected Call
          <div className="flex-1 flex flex-col">
            {(() => {
              const selectedCall = callHistory.find(c => c.id === selectedCallId)
              if (!selectedCall) return null

              return (
                <>
                  {/* Chat Header */}
                  <div className="bg-slate-800/30 backdrop-blur-sm border-b border-slate-700/50 px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-semibold text-white">{selectedCall.call_goal}</h2>
                        <p className="text-sm text-white/60">{selectedCall.phone_number} • {new Date(selectedCall.created_at).toLocaleString()}</p>
                      </div>
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        selectedCall.call_result === 'auto_complete'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        {selectedCall.call_result === 'auto_complete' ? 'Auto-Completed' : 'Bridged'}
                      </span>
                    </div>
                  </div>

                  {/* Chat Messages */}
                  <div className="flex-1 overflow-y-auto px-6 py-4">
                    <div className="max-w-4xl mx-auto space-y-4">
                      {/* Summary Card if available */}
                      {selectedCall.call_summary && (
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6">
                          <h3 className="text-sm font-semibold text-blue-400 mb-2">Call Summary</h3>
                          <p className="text-white/80">{selectedCall.call_summary}</p>
                        </div>
                      )}

                      {/* Transcript Messages */}
                      {selectedCall.transcript && selectedCall.transcript.length > 0 ? (
                        selectedCall.transcript.map((entry, index) => {
                          const isVOX = entry.speaker === 'VOX'
                          const isSystem = entry.speaker === 'System'

                          return (
                            <div key={index} className={`flex ${isVOX ? 'justify-start' : 'justify-end'}`}>
                              <div className={`max-w-[70%] ${isSystem ? 'w-full' : ''}`}>
                                <div className={`rounded-lg px-4 py-2 ${
                                  isSystem
                                    ? 'bg-slate-700/30 text-white/60 text-center text-sm italic'
                                    : isVOX
                                    ? 'bg-slate-700/50 text-white'
                                    : 'bg-blue-600/20 text-white'
                                }`}>
                                  {!isSystem && (
                                    <p className="text-xs text-white/60 mb-1 font-semibold">
                                      {entry.speaker}
                                    </p>
                                  )}
                                  <p className="text-sm">{entry.message}</p>
                                  <p className="text-xs text-white/40 mt-1">
                                    {new Date(entry.timestamp).toLocaleTimeString()}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )
                        })
                      ) : (
                        <div className="text-center py-8">
                          <p className="text-white/40">No transcript available for this call</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )
            })()}
          </div>
        ) : (
          // Default View - Feature Cards
          <div className="flex-1 flex flex-col items-center justify-center py-16">
            <div className="max-w-4xl mx-auto px-8 text-center">
              {/* Header Text */}
              <div className="self-stretch text-center justify-start text-white text-3xl font-medium font-['DM_Sans'] leading-9 mb-9">Hi, {user?.email?.split('@')[0]}. How can I save your time?</div>
            
            <div className="self-stretch inline-flex justify-start items-center gap-12">
            {/* Hotel Check-in Card */}
            <div className="w-60 h-40 relative bg-gradient-to-br from-white/20 to-white/0 rounded-xl outline outline-1 outline-neutral-900 backdrop-blur-xl overflow-hidden">
              <div className="w-52 left-[16px] top-[30px] absolute inline-flex flex-col justify-start items-start gap-3">
                <div className="w-10 h-10 relative overflow-hidden">
                  <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="self-stretch justify-start text-white text-base font-normal font-['DM_Sans'] leading-snug">Confirm hotel check-in for Martin and crew</div>
              </div>
            </div>

            {/* Phone Call Card */}
            <div className="w-60 h-40 relative bg-gradient-to-br from-white/20 to-white/0 rounded-xl outline outline-1 outline-neutral-900 backdrop-blur-xl overflow-hidden">
              <div className="w-52 left-[16px] top-[30px] absolute inline-flex flex-col justify-start items-start gap-3">
                <div className="w-10 h-10 relative overflow-hidden">
                  <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <div className="self-stretch justify-start text-white text-base font-normal font-['DM_Sans'] leading-snug">Call Brooklyn Mirage to confirm load-in time</div>
              </div>
            </div>

            {/* VIP Table Card */}
            <div className="w-60 h-40 relative bg-gradient-to-br from-white/20 to-white/0 rounded-xl outline outline-1 outline-neutral-900 backdrop-blur-xl overflow-hidden">
              <div className="w-52 left-[16px] top-[28px] absolute inline-flex flex-col justify-start items-start gap-3">
                <div className="w-10 h-10 relative overflow-hidden">
                  <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <div className="self-stretch justify-start text-white text-base font-normal font-['DM_Sans'] leading-normal">Follow up with promoter on VIP table holds for guests</div>
              </div>
            </div>
            </div>
          </div>

            {/* Bottom Section - Call Inputs for new calls */}
            {!selectedCallId && (
              <div className="max-w-4xl mx-auto px-8 pb-12 space-y-8 w-full">
                <CallInputs
                  onStartCall={handleStartCall}
                  onEndCall={handleEndCall}
                  isCallActive={callStatus !== 'idle'}
                />
              </div>
            )}
          </div>
        )}
      </main>

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 max-w-md mx-4 border border-slate-700">
            <div className="flex items-center mb-4">
              <div className="h-10 w-10 bg-red-500/20 rounded-lg flex items-center justify-center mr-3">
                <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white">Delete Call</h3>
            </div>
            
            <p className="text-white/80 mb-6">
              Are you sure you want to delete this call? This action cannot be undone.
            </p>
            
            {callToDelete && (
              <div className="bg-slate-700/50 rounded-lg p-3 mb-6">
                <p className="text-sm font-medium text-white">{callToDelete.call_goal}</p>
                <p className="text-xs text-white/60">{callToDelete.phone_number}</p>
                <p className="text-xs text-white/40">{new Date(callToDelete.created_at).toLocaleDateString()}</p>
              </div>
            )}
            
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setDeleteModalOpen(false)
                  setCallToDelete(null)
                }}
                className="flex-1 px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
