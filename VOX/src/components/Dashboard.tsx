import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { CallInputs } from './CallInputs'
import { StatusBadge } from './StatusBadge'
import { CallHistory } from './CallHistory'
import type { StreamEvent } from './LiveStream'
import { vapiService, type VAPICallEvent } from '../services/vapiService'
import { supabase } from '../lib/supabase'

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
      // Extract full transcript from stream events
      // Include all transcript-type messages (action, menu, info, etc.)
      const transcript = streamEvents.filter(event =>
        event.type === 'action' ||
        event.type === 'menu' ||
        event.type === 'info' ||
        (event.type === 'system' && event.message.includes('Call Summary:'))
      ).map(event => ({
        timestamp: event.timestamp.toISOString(),
        speaker: event.message.startsWith('VOX:') ? 'VOX' :
                 event.message.startsWith('Other Party:') ? 'Other Party' :
                 'System',
        message: event.message
      }))

      // Extract call summary if available
      const summaryEvent = streamEvents.find(event =>
        event.message.includes('Call Summary:')
      )
      const callSummary = summaryEvent
        ? summaryEvent.message.replace('Call Summary: ', '')
        : null

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

          // Save call to database after a short delay to ensure all transcript events are processed
          setTimeout(() => {
            console.log('📞 Call ended, saving to database...')
            saveCallToDatabase()
          }, 1500) // Give a bit more time for all events to process

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
    <div className="min-h-screen relative bg-gray-950 overflow-hidden">
      {/* Background Blur Effect */}
      <div className="w-[749.23px] h-[749.23px] left-[345.39px] top-[137.39px] absolute bg-gradient-to-b from-blue-800/50 to-indigo-100/50 rounded-full border-[20px] border-indigo-100 blur-[125px]" />
      
      {/* Sidebar Navigation */}
      <nav className="fixed left-0 top-0 h-full w-64 bg-slate-800/50 backdrop-blur-sm border-r border-slate-700/50 flex flex-col z-10 lg:w-64 md:w-56 sm:w-48">
        <div className="p-6">
          <div className="flex items-center">
            <div className="h-8 w-8 flex items-center justify-center">
              <img src="/src/assets/vox-logo.svg" alt="VOX Logo" className="h-8 w-8" />
            </div>
            <h1 className="ml-3 text-xl font-semibold text-white">VOX</h1>
          </div>
        </div>
        
        {/* Navigation Items */}
        <div className="flex-1 px-4 space-y-2">
          <div className="flex items-center px-3 py-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer">
            <svg className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            Console
          </div>
          <div className="flex items-center px-3 py-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer">
            <svg className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Projects
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
      <main className="ml-64 lg:ml-64 md:ml-56 sm:ml-48 overflow-auto relative z-10 flex flex-col min-h-screen">
        {/* Feature Cards - Centered in middle */}
        <div className="flex-1 flex flex-col items-center justify-center py-16">
          <div className="max-w-4xl mx-auto px-8 text-center">
            {/* Header Text */}
            <div className="self-stretch text-center justify-start text-white text-3xl font-medium font-['DM_Sans'] leading-9 mb-9">Hi, Josh. How can I save your time?</div>
            
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
      </div>

        {/* Bottom Section - Inputs and History */}
        <div className="max-w-4xl mx-auto px-8 pb-12 space-y-8 w-full">
          {/* Call Inputs */}
          <CallInputs 
            onStartCall={handleStartCall}
            isCallActive={callStatus !== 'idle'}
          />

          {/* Call History Section */}
          <div className="mt-8">
            <CallHistory history={callHistory} />
          </div>
        </div>
      </main>
    </div>
  )
}
