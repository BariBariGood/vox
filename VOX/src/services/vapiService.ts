// VAPI Service for handling real voice AI calls
// Using the VAPI MCP server for dynamic call handling

export interface VAPICallConfig {
  phoneNumber: string
  callGoal: string
  customerNumber?: string
}

export interface VAPICallEvent {
  type: 'call-started' | 'speech-started' | 'speech-ended' | 'transcript' | 'tool-call' | 'call-ended' | 'error'
  timestamp: Date
  data?: any
}

export interface VAPIAssistant {
  id?: string
  name: string
  model: {
    provider: 'openai'
    model: 'gpt-4'
    temperature: number
    messages?: Array<{
      role: 'system'
      content: string
    }>
  }
  voice: {
    provider: '11labs' | 'playht'
    voiceId: string
  }
  firstMessage: string
  tools?: VAPITool[]
}

export interface VAPITool {
  type: 'function' | 'transferCall'
  function?: {
    name: string
    description: string
    parameters: {
      type: string
      properties: Record<string, any>
      required: string[]
    }
  }
  destinations?: Array<{
    type: 'number'
    number: string
    message?: string
  }>
}

class VAPIService {
  private apiKey: string
  private webCliKey: string
  private publicKey: string
  private baseURL = 'https://api.vapi.ai'

  constructor() {
    // In production, these would come from environment variables
    // For now, using the provided keys directly
    this.apiKey = 'b0af8dfd-b3e3-4f15-999b-51bbe6cefda5'
    this.webCliKey = '3e8a2c18-b9ba-4c7c-8202-2387427077dd'
    this.publicKey = '95fe0abf-0fd6-49e0-9e16-0576d2f415a9'
  }

  // Create a dynamic assistant based on call intent
  private createAssistantForIntent(callGoal: string): VAPIAssistant {
    const isInfoGathering = this.isInformationGatheringCall(callGoal)
    
    const baseAssistant: VAPIAssistant = {
      name: `VOX Assistant - ${Date.now()}`,
      model: {
        provider: 'openai',
        model: 'gpt-4',
        temperature: 0.7,
        messages: [{
          role: 'system',
          content: this.generateSystemMessage(callGoal, isInfoGathering)
        }]
      },
      voice: {
        provider: '11labs',
        voiceId: '21m00Tcm4TlvDq8ikWAM' // Rachel voice ID from ElevenLabs
      },
      firstMessage: "Hello! I'm VOX, your AI assistant. I'm calling to help you with your request."
    }

    // Temporarily disable tools to test basic call functionality
    // TODO: Re-enable tools once basic calling works
    // if (isInfoGathering) {
    //   baseAssistant.tools = this.createInfoGatheringTools()
    // } else {
    //   baseAssistant.tools = this.createTransferTools()
    // }

    return baseAssistant
  }

  private isInformationGatheringCall(callGoal: string): boolean {
    const goal = callGoal.toLowerCase()
    const infoKeywords = ['portal', 'website', 'link', 'information', 'details', 'hours', 'location', 'address']
    return infoKeywords.some(keyword => goal.includes(keyword))
  }

  private generateSystemMessage(callGoal: string, isInfoGathering: boolean): string {
    const baseMessage = `You are VOX, an AI assistant making a phone call on behalf of a user. 

User's Goal: ${callGoal}

Your Mission:
1. Navigate phone menus and IVR systems efficiently
2. Speak clearly and professionally
3. ${isInfoGathering ? 'Gather the requested information and end the call when you have it' : 'Connect the user to a human representative when sensitive information is needed'}

Guidelines:
- Be concise and direct
- Listen for menu options and respond appropriately
- If you hear hold music, wait patiently
- When you detect a human, ${isInfoGathering ? 'ask for the information directly' : 'explain you need to transfer the call to the user'}
- Always be polite and professional`

    if (isInfoGathering) {
      return baseMessage + `

Information Gathering Mode:
- Try to get the information from automated systems first
- Only transfer to human if absolutely necessary
- Use the gatherInformation tool when you find the requested details`
    } else {
      return baseMessage + `

Transfer Mode:
- Your goal is to reach the right department/person
- Use the transferToUser tool when you've reached a human who can help
- Explain that you're an AI assistant and need to connect the user`
    }
  }

  private createInfoGatheringTools(): VAPITool[] {
    return [
      {
        type: 'function',
        function: {
          name: 'gatherInformation',
          description: 'Call this when you have successfully gathered the requested information',
          parameters: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                description: 'Brief title of the information found'
              },
              details: {
                type: 'string',
                description: 'The detailed information gathered'
              },
              link: {
                type: 'string',
                description: 'Any relevant URL or link found (optional)'
              }
            },
            required: ['title', 'details']
          }
        }
      }
    ]
  }

  private createTransferTools(): VAPITool[] {
    return [
      {
        type: 'transferCall',
        destinations: [
          {
            type: 'number',
            number: '+1234567890', // Placeholder - will be replaced with actual user number
            message: 'I\'ve reached the right department. Let me connect you now.'
          }
        ]
      }
    ]
  }

  // Test API connectivity
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/assistant`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      })

      console.log('VAPI connection test:', response.status, response.statusText)
      return response.status === 200 || response.status === 401 // 401 means API is working but auth might be wrong
    } catch (error) {
      console.error('VAPI connection test failed:', error)
      return false
    }
  }

  // Create an assistant via API
  async createAssistant(callGoal: string): Promise<string> {
    const assistant = this.createAssistantForIntent(callGoal)
    
    try {
      console.log('Creating VAPI assistant with config:', JSON.stringify(assistant, null, 2))
      
      const response = await fetch(`${this.baseURL}/assistant`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(assistant)
      })

      const responseText = await response.text()
      console.log('VAPI assistant creation response:', response.status, responseText)

      if (!response.ok) {
        let errorMessage = `Failed to create assistant: ${response.status} ${response.statusText}`
        try {
          const errorData = JSON.parse(responseText)
          errorMessage += ` - ${errorData.message || errorData.error || responseText}`
        } catch {
          errorMessage += ` - ${responseText}`
        }
        throw new Error(errorMessage)
      }

      const data = JSON.parse(responseText)
      console.log('Assistant created successfully:', data)
      return data.id
    } catch (error) {
      console.error('Error creating assistant:', error)
      throw error
    }
  }

  // Get or create a phone number for outbound calls
  async getPhoneNumberId(): Promise<string> {
    try {
      // First, try to get existing phone numbers
      const response = await fetch(`${this.baseURL}/phone-number`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      })

      if (response.ok) {
        const phoneNumbers = await response.json()
        console.log('Available phone numbers:', phoneNumbers)
        
        // Use the first available phone number
        if (phoneNumbers && phoneNumbers.length > 0) {
          return phoneNumbers[0].id
        }
      }

      // If no phone numbers available, we'll need to use a different approach
      // For now, return a placeholder that will trigger an error with more info
      throw new Error('No phone numbers configured in VAPI account. Please add a phone number in your VAPI dashboard.')
    } catch (error) {
      console.error('Error getting phone number:', error)
      throw error
    }
  }

  // Start a phone call using outbound calling
  async startCall(config: VAPICallConfig): Promise<string> {
    try {
      // Create assistant inline instead of separate API call
      const assistant = this.createAssistantForIntent(config.callGoal)
      
      // Try to get a phone number from VAPI account for outbound calls
      let phoneNumberId: string
      try {
        phoneNumberId = await this.getPhoneNumberId()
      } catch (error) {
        console.warn('No VAPI phone numbers found, using direct number approach')
        // If no phone numbers in account, we'll try a different approach
        phoneNumberId = 'direct'
      }
      
      // Format target phone number
      let targetPhoneNumber = config.phoneNumber
      if (!targetPhoneNumber.startsWith('+')) {
        targetPhoneNumber = '+1' + targetPhoneNumber.replace(/\D/g, '')
      }
      
      // Format customer callback number
      let customerNumber = config.customerNumber || '+12345678901'
      if (!customerNumber.startsWith('+')) {
        customerNumber = '+1' + customerNumber.replace(/\D/g, '')
      }
      
      // Try different payload formats based on available phone numbers
      let callPayload: any
      
      if (phoneNumberId !== 'direct') {
        // Use phoneNumberId if we have one
        callPayload = {
          assistant,
          phoneNumberId,
          customer: {
            number: targetPhoneNumber // The number to call
          }
        }
      } else {
        // Try direct calling approach
        callPayload = {
          assistant,
          type: 'outboundPhoneCall',
          phoneNumber: targetPhoneNumber,
          customer: {
            number: customerNumber
          }
        }
      }

      console.log('Starting VAPI call with payload:', JSON.stringify(callPayload, null, 2))

      const response = await fetch(`${this.baseURL}/call`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(callPayload)
      })

      const responseText = await response.text()
      console.log('VAPI call creation response:', response.status, responseText)

      if (!response.ok) {
        let errorMessage = `Failed to start call: ${response.status} ${response.statusText}`
        try {
          const errorData = JSON.parse(responseText)
          errorMessage += ` - ${errorData.message || errorData.error || responseText}`
        } catch {
          errorMessage += ` - ${responseText}`
        }
        throw new Error(errorMessage)
      }

      const data = JSON.parse(responseText)
      console.log('Call started successfully:', data)
      return data.id
    } catch (error) {
      console.error('Error starting call:', error)
      throw error
    }
  }

  // Get call status and events
  async getCall(callId: string) {
    try {
      const response = await fetch(`${this.baseURL}/call/${callId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to get call: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error getting call:', error)
      throw error
    }
  }

  // End a call
  async endCall(callId: string) {
    try {
      const response = await fetch(`${this.baseURL}/call/${callId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to end call: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error ending call:', error)
      throw error
    }
  }

  // Set up webhook handling for real-time events
  setupWebhookHandler(onEvent: (event: VAPICallEvent) => void) {
    // This would typically be handled by a backend webhook endpoint
    // For now, we'll simulate with polling
    return (callId: string) => {
      const pollInterval = setInterval(async () => {
        try {
          const call = await this.getCall(callId)
          
          // Convert VAPI events to our format
          if (call.transcript && call.transcript.length > 0) {
            const lastTranscript = call.transcript[call.transcript.length - 1]
            onEvent({
              type: 'transcript',
              timestamp: new Date(lastTranscript.timestamp),
              data: lastTranscript
            })
          }

          // Check call status
          if (call.status === 'ended') {
            onEvent({
              type: 'call-ended',
              timestamp: new Date(),
              data: call
            })
            clearInterval(pollInterval)
          }
        } catch (error) {
          console.error('Error polling call status:', error)
          onEvent({
            type: 'error',
            timestamp: new Date(),
            data: { error: error.message }
          })
        }
      }, 2000) // Poll every 2 seconds

      return () => clearInterval(pollInterval)
    }
  }
}

export const vapiService = new VAPIService()
