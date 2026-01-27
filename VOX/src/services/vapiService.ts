// VAPI Service - Simplified approach using VAPI's native tools
// Model uses built-in dtmf, endCall, transferCall tools directly

import type { VAPICallConfig, VAPICallEvent } from '../vox'

// Assistant configuration for VAPI
interface VAPIAssistant {
  name: string
  model: {
    provider: 'openai'
    model: 'gpt-4o'
    temperature: number
    messages: Array<{ role: 'system'; content: string }>
    tools?: unknown[]
  }
  voice: {
    provider: '11labs'
    voiceId: string
  }
  transcriber: {
    provider: 'deepgram'
    model: string
    language: string
    smartFormat: boolean
  }
  silenceTimeoutSeconds: number
  responseDelaySeconds: number
  endCallFunctionEnabled?: boolean
}

class VAPIService {
  private apiKey: string
  private phoneNumberId: string
  private baseURL = 'https://api.vapi.ai'
  public publicKey: string

  // Store control URLs for active calls
  private callControlUrls: Map<string, string> = new Map()

  constructor() {
    this.apiKey = import.meta.env.VITE_VAPI_API_KEY || ''
    this.phoneNumberId = import.meta.env.VITE_VAPI_PHONE_NUMBER_ID || ''
    this.publicKey = import.meta.env.VITE_VAPI_PUBLIC_KEY || ''

    if (!this.apiKey) {
      console.error('⚠️ VITE_VAPI_API_KEY not set')
    }
  }

  // Simple system prompt - no custom tools, just built-in VAPI tools
  private generatePrompt(callGoal: string): string {
    return `You are VOX, a phone agent calling on behalf of a customer.

GOAL: ${callGoal}

INSTRUCTIONS:
1. When you hear "press 1", "press 2", etc. → Use the dtmf tool with that digit
2. When a human asks a question → Respond briefly and politely
3. When your goal is complete → Use the endCall tool to hang up
4. During hold music or silence → Stay quiet and wait

IMPORTANT:
- Keep responses SHORT (1-2 sentences max)
- Don't announce what buttons you're pressing
- When you have the information you need, say goodbye and USE THE endCall TOOL
- The endCall tool actually hangs up the phone - you MUST use it to end calls

Be warm, professional, and efficient.`
  }

  // Create assistant with VAPI's native tools only
  private createAssistant(callGoal: string, customerNumber?: string): VAPIAssistant {
    const tools: unknown[] = [
      { type: 'dtmf' },
      { type: 'endCall' }
    ]

    // Add transfer if customer number provided
    if (customerNumber) {
      tools.push({
        type: 'transferCall',
        destinations: [{
          type: 'number',
          number: customerNumber,
          message: 'Connecting you now.'
        }]
      })
    }

    return {
      name: `VOX-${Date.now()}`,
      model: {
        provider: 'openai',
        model: 'gpt-4o',
        temperature: 0,
        messages: [{ role: 'system', content: this.generatePrompt(callGoal) }],
        tools
      },
      voice: {
        provider: '11labs',
        voiceId: 'uyVNoMrnUku1dZyVEXwD'
      },
      transcriber: {
        provider: 'deepgram',
        model: 'nova-2',
        language: 'en',
        smartFormat: true
      },
      silenceTimeoutSeconds: 30,
      responseDelaySeconds: 0.5,
      endCallFunctionEnabled: true
    }
  }

  private formatPhoneNumber(phone: string): string {
    const digitsOnly = phone.replace(/\D/g, '')
    if (digitsOnly.startsWith('1') && digitsOnly.length === 11) {
      return '+' + digitsOnly
    }
    return '+1' + digitsOnly
  }

  async startCall(config: VAPICallConfig): Promise<string> {
    if (!this.apiKey) {
      throw new Error('VAPI API key not configured')
    }

    const assistant = this.createAssistant(config.callGoal, config.customerNumber)
    const targetNumber = this.formatPhoneNumber(config.phoneNumber)

    console.log('[VOX] Starting call to:', targetNumber)

    const callPayload = {
      assistant,
      phoneNumberId: this.phoneNumberId,
      customer: { number: targetNumber }
    }

    const response = await fetch(`${this.baseURL}/call`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(callPayload)
    })

    const responseText = await response.text()

    if (!response.ok) {
      throw new Error(`Failed to start call: ${response.status} - ${responseText}`)
    }

    const data = JSON.parse(responseText)
    console.log('[VOX] Call started:', data.id, 'Status:', data.status)

    // Store control URL for this call (for manual control if needed)
    if (data.monitor?.controlUrl) {
      this.callControlUrls.set(data.id, data.monitor.controlUrl)
      console.log('[VOX] Control URL stored for call:', data.id)
    }

    return data.id
  }

  async getCall(callId: string) {
    const response = await fetch(`${this.baseURL}/call/${callId}`, {
      headers: { 'Authorization': `Bearer ${this.apiKey}` }
    })

    if (!response.ok) {
      throw new Error(`Failed to get call: ${response.statusText}`)
    }

    return response.json()
  }

  // End call using control URL (more reliable than DELETE)
  async endCall(callId: string) {
    // Try control URL first (per VAPI docs)
    const controlUrl = this.callControlUrls.get(callId)
    if (controlUrl) {
      try {
        console.log('[VOX] Ending call via control URL')
        const response = await fetch(controlUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'end-call' })
        })
        if (response.ok) {
          this.callControlUrls.delete(callId)
          return { success: true }
        }
      } catch (e) {
        console.warn('[VOX] Control URL failed, trying DELETE:', e)
      }
    }

    // Fallback to DELETE endpoint
    const response = await fetch(`${this.baseURL}/call/${callId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${this.apiKey}` }
    })

    if (!response.ok) {
      throw new Error(`Failed to end call: ${response.statusText}`)
    }

    this.callControlUrls.delete(callId)
    return response.json()
  }

  // Transfer call using control URL
  async transferCall(callId: string, destinationNumber: string, message?: string) {
    const controlUrl = this.callControlUrls.get(callId)
    
    if (controlUrl) {
      try {
        console.log('[VOX] Transferring call via control URL')
        const response = await fetch(controlUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'transfer',
            destination: {
              type: 'number',
              number: destinationNumber
            },
            content: message || 'Connecting you now.'
          })
        })
        if (response.ok) {
          return { success: true }
        }
      } catch (e) {
        console.warn('[VOX] Control URL transfer failed:', e)
      }
    }

    // Fallback to API endpoint
    const response = await fetch(`${this.baseURL}/call/${callId}/transfer`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        destination: {
          type: 'number',
          number: destinationNumber,
          message: message || 'Connecting you now.'
        }
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to transfer: ${response.status} - ${errorText}`)
    }

    return response.json()
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/assistant`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      })
      console.log('[VOX] Connection test:', response.status)
      return response.ok
    } catch (error) {
      console.error('[VOX] Connection test failed:', error)
      return false
    }
  }

  setupWebhookHandler(onEvent: (event: VAPICallEvent) => void) {
    let lastCallStatus = ''
    let transcriptProcessed = false
    let consecutiveErrors = 0
    let pollDelay = 5000

    return (callId: string) => {
      let pollTimeout: ReturnType<typeof setTimeout>
      let isPolling = true

      const pollOnce = async () => {
        if (!isPolling) return

        try {
          const call = await this.getCall(callId)
          consecutiveErrors = 0
          pollDelay = 5000

          if (call.status && call.status !== lastCallStatus) {
            lastCallStatus = call.status
            console.log(`[VOX] Status: ${call.status}`)

            onEvent({
              type: 'call-status',
              timestamp: new Date(),
              data: { status: call.status }
            })
          }

          if ((call.status === 'ended' || call.endedAt) && !transcriptProcessed) {
            transcriptProcessed = true
            isPolling = false

            if (call.transcript && typeof call.transcript === 'string') {
              const lines = call.transcript.split(/(?=(AI:|User:))/g).filter((line: string) => line.trim())

              lines.forEach((line: string) => {
                let speaker = 'Other Party'
                let content = line.trim()

                if (line.startsWith('AI:')) {
                  speaker = 'VOX'
                  content = line.substring(3).trim()
                } else if (line.startsWith('User:')) {
                  speaker = 'Other Party'
                  content = line.substring(5).trim()
                }

                if (content && content !== 'Audio detected') {
                  onEvent({
                    type: 'transcript',
                    timestamp: new Date(),
                    data: { role: speaker === 'VOX' ? 'assistant' : 'user', content, speaker }
                  })
                }
              })
            }

            if (call.analysis?.summary) {
              onEvent({
                type: 'transcript',
                timestamp: new Date(),
                data: { role: 'system', content: `Call Summary: ${call.analysis.summary}`, speaker: 'System' }
              })
            }

            onEvent({
              type: 'call-ended',
              timestamp: new Date(call.endedAt || Date.now()),
              data: call
            })

            return
          }

          if (isPolling) {
            pollTimeout = setTimeout(pollOnce, pollDelay)
          }
        } catch (error) {
          consecutiveErrors++
          pollDelay = Math.min(pollDelay * 2, 30000)

          if (consecutiveErrors >= 5) {
            console.log('[VOX] Too many polling errors, stopping')
            isPolling = false
            return
          }

          if (isPolling) {
            pollTimeout = setTimeout(pollOnce, pollDelay)
          }
        }
      }

      pollTimeout = setTimeout(pollOnce, 3000)

      return () => {
        isPolling = false
        if (pollTimeout) clearTimeout(pollTimeout)
      }
    }
  }
}

export type { VAPICallConfig, VAPICallEvent }
export const vapiService = new VAPIService()
