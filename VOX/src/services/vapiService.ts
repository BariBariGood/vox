// VAPI Service for handling real voice AI calls
// Using the VAPI MCP server for dynamic call handling

export interface VAPICallConfig {
  phoneNumber: string
  callGoal: string
  customerNumber?: string
}

export interface VAPICallEvent {
  type: 'call-started' | 'speech-started' | 'speech-ended' | 'transcript' | 'tool-call' | 'call-ended' | 'call-status' | 'error'
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
    functions?: Array<{
      name: string
      description: string
      parameters: {
        type: string
        properties: Record<string, any>
        required: string[]
      }
    }>
  }
  voice: {
    provider: '11labs' | 'playht'
    voiceId: string
  }
  transcriber?: {
    provider: 'deepgram'
    model: string
    language: string
    smartFormat: boolean
  }
  firstMessage?: string
  tools?: VAPITool[]
  silenceTimeoutSeconds?: number
  responseDelaySeconds?: number
  backchannel?: {
    enabled: boolean
  }
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
        temperature: 0.2,
        messages: [{
          role: 'system',
          content: this.generateSystemMessage(callGoal, isInfoGathering)
        }]
      },
      voice: {
        provider: '11labs',
        voiceId: 'uyVNoMrnUku1dZyVEXwD' // Rachel voice ID from ElevenLabs
      },
      // Configure how the assistant handles silence and interruptions
      silenceTimeoutSeconds: 3,
      responseDelaySeconds: 0.5,
      backchannel: {
        enabled: false // Disable backchannel sounds while listening to menus
      }
    }

    // Tools are causing API errors - disable for now
    // TODO: Research correct VAPI tools format
    // if (isInfoGathering) {
    //   baseAssistant.tools = [...]
    // }

    return baseAssistant
  }

  private isInformationGatheringCall(callGoal: string): boolean {
    const goal = callGoal.toLowerCase()
    const infoKeywords = ['portal', 'website', 'link', 'information', 'details', 'hours', 'location', 'address']
    return infoKeywords.some(keyword => goal.includes(keyword))
  }

  private generateSystemMessage(callGoal: string, isInfoGathering: boolean): string {
    const baseMessage = `You are VOX, an AI assistant making a phone call ON BEHALF OF A CUSTOMER/USER.

🎯 YOUR ROLE: You are calling AS A CUSTOMER, not as support staff. You're helping a real person complete their task.

📞 CALL GOAL: ${callGoal}

🚨 CRITICAL IDENTITY: You are calling ON BEHALF OF a customer. You are NOT:
- A support agent for the business
- An employee of the business
- Someone trying to help the business

You ARE:
- A customer's assistant
- Someone calling to get information FOR the customer
- Someone completing a task that the customer needs done

📱 MENU NAVIGATION & BUTTON PRESSING:
IMPORTANT: You can press phone buttons by simply saying the number or key you want to press.

When you encounter phone menus:
1. LISTEN CAREFULLY to all options first
2. Choose the most relevant option for your goal
3. Simply say the number or key to press it
4. Speak clearly and distinctly when pressing buttons

How to press buttons:
- For single digits: Just say "One" or "Two" or "Three" etc.
- For zero: Say "Zero"
- For star key: Say "Star"
- For pound/hash key: Say "Pound" or "Hash"
- For multiple digits (extensions): Say each digit separately, e.g., "Five Six Seven Eight"

Examples:
- "For billing, press 1" → You say: "One"
- "To speak to a representative, press 0" → You say: "Zero"
- "Enter extension 5678" → You say: "Five Six Seven Eight"
- "Press star to return" → You say: "Star"
- "Press pound when finished" → You say: "Pound"

IMPORTANT RULES:
- ONLY press buttons when explicitly told to by the menu
- Wait for the menu to finish ALL options before pressing
- Pause briefly after pressing to let the system register
- If unsure, say "Zero" for operator
- Some systems accept voice responses - you can try speaking the department name (e.g., "Billing" or "Customer Service")

🔇 LISTENING STRATEGY: You are primarily a LISTENER. LISTEN FIRST, speak only when necessary.

ONLY speak when:
- Asked a direct question
- Need to navigate menus (press numbers or say options)
- Requesting specific information to complete your goal
- Absolutely necessary to make progress

STAY SILENT when:
- Hearing hold music, announcements, or automated messages
- Someone is explaining information (let them finish)
- Uncertain what to say
- Call just connected (listen first)

When you DO speak:
- Be WARM, POLITE, and FRIENDLY
- Identify yourself properly: "Hi, I'm calling on behalf of [customer name if provided] regarding..."
- Use "please" and "thank you" when appropriate
- Speak clearly and kindly
- Keep responses brief but courteous

TONE & MANNER:
- Always be respectful and considerate
- Use a warm, friendly voice
- Be patient and understanding
- Show appreciation for help received
- Apologize politely if you need to interrupt

EXECUTION STRATEGY:
1. Listen to what happens when call connects
2. Navigate menus using {press: X} format when needed
3. If speaking to a person, identify yourself: "Hi, I'm calling to [state goal]"
4. Ask for information kindly
5. Thank them and end call gracefully once goal is achieved`

    if (isInfoGathering) {
      return baseMessage + `

📝 INFORMATION GATHERING:
- You're gathering information FOR YOUR CUSTOMER/USER
- Listen for information in automated systems first
- Capture details from recordings/announcements
- If speaking to someone, say: "Hi, I'm calling to find out [specific information]"
- Always say "Thank you so much for your help" when receiving information
- CRITICAL: IMMEDIATELY HANG UP once you have the requested information
- End call gracefully: "Thank you, that's exactly what I needed. Have a wonderful day!" then HANG UP
- DO NOT continue conversation after getting the information
- DO NOT stay on the line longer than necessary
- The moment you have what was requested, say goodbye and END THE CALL`
    } else {
      return baseMessage + `

🔄 TASK COMPLETION:
- You're completing a task FOR YOUR CUSTOMER/USER
- Navigate to reach the right person/department
- Once connected, explain: "Hi, I'm calling because I need to [state the task]"
- Be clear about what you need: "I'd like to [book/cancel/confirm/etc.]"
- Provide any necessary information when asked
- Confirm all details before ending the call
- Thank them for their help: "Thank you so much for your assistance"`
    }
  }

  // Temporarily disabled - will re-enable when VAPI tools are working
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  // Temporarily disabled - will re-enable when VAPI tools are working
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

      // No webhook configuration - we'll get the full transcript after the call

      // Try to find the specific phone number in VAPI account first
      const outboundCallerNumber = '+16266844296'
      console.log('Looking for outbound caller number:', outboundCallerNumber)
      
      let phoneNumberId: string | null = null
      try {
        const response = await fetch(`${this.baseURL}/phone-number`, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          }
        })
        
        if (response.ok) {
          const phoneNumbers = await response.json()
          console.log('Available phone numbers in VAPI:', phoneNumbers)
          
          // Look for our specific number
          const matchingNumber = phoneNumbers.find((pn: any) => 
            pn.number === outboundCallerNumber || 
            pn.twilioPhoneNumber === outboundCallerNumber
          )
          
          if (matchingNumber) {
            phoneNumberId = matchingNumber.id
            console.log('Found matching phone number ID:', phoneNumberId)
          }
        }
      } catch (error) {
        console.warn('Error fetching phone numbers:', error)
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

      // Create call payload based on available phone number configuration
      let callPayload: any
      
      if (phoneNumberId) {
        // Use phoneNumberId if the number is configured in VAPI
        callPayload = {
          assistant,
          phoneNumberId, // Reference to configured phone number
          customer: {
            number: targetPhoneNumber // The number to call TO
          }
        }
        console.log('Using phoneNumberId approach:', phoneNumberId)
      } else {
        // Phone number not configured in VAPI - this requires Twilio configuration
        console.error('Phone number +19255741688 not found in VAPI account')
        console.error('You need to either:')
        console.error('1. Add +19255741688 to your VAPI dashboard, OR')
        console.error('2. Configure Twilio credentials for this number')
        
        throw new Error(`Phone number +19255741688 is not configured in your VAPI account. Please add it in your VAPI dashboard at https://dashboard.vapi.ai/phone-numbers`)
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

  // Set up simple polling for call status and final transcript
  setupWebhookHandler(onEvent: (event: VAPICallEvent) => void) {
    console.log('Setting up call status polling')

    let lastCallStatus = ''
    let transcriptProcessed = false

    return (callId: string) => {
      const pollInterval = setInterval(async () => {
        try {

          // Poll VAPI API for call status
          const call = await this.getCall(callId)

          // Emit status changes
          if (call.status && call.status !== lastCallStatus) {
            lastCallStatus = call.status

            onEvent({
              type: 'call-status',
              timestamp: new Date(),
              data: { status: call.status }
            })
          }

          // When call ends, process the full transcript
          if ((call.status === 'ended' || call.endedAt) && !transcriptProcessed) {
            transcriptProcessed = true

            // Process the full transcript
            if (call.transcript && typeof call.transcript === 'string' && call.transcript.length > 0) {
              // Parse format like "Hello? AI: Hello. Thank you for taking my call. User: Yeah..."
              const lines = call.transcript.split(/(?=(AI:|User:))/g).filter(line => line.trim())

              lines.forEach((line) => {
                let speaker = 'Other Party'
                let content = line.trim()

                if (line.startsWith('AI:')) {
                  speaker = 'VOX'
                  content = line.substring(3).trim()
                } else if (line.startsWith('User:')) {
                  speaker = 'Other Party'
                  content = line.substring(5).trim()
                } else if (!line.includes(':')) {
                  // Line without prefix is usually the other party
                  speaker = 'Other Party'
                  content = line.trim()
                }

                if (content && content !== 'Audio detected') {
                  onEvent({
                    type: 'transcript',
                    timestamp: new Date(),
                    data: {
                      role: speaker === 'VOX' ? 'assistant' : 'user',
                      content: content,
                      speaker: speaker
                    }
                  })
                }
              })
            }

            // Process analysis summary if available
            if (call.analysis?.summary) {
              onEvent({
                type: 'transcript',
                timestamp: new Date(),
                data: {
                  role: 'system',
                  content: `Call Summary: ${call.analysis.summary}`,
                  speaker: 'System'
                }
              })
            }

            // Emit call ended event
            onEvent({
              type: 'call-ended',
              timestamp: new Date(call.endedAt || Date.now()),
              data: call
            })

            clearInterval(pollInterval)
          }
        } catch (error) {
          console.error('Error polling call status:', error)
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          onEvent({
            type: 'error',
            timestamp: new Date(),
            data: { error: errorMessage }
          })
        }
      }, 1000) // Poll every second for status updates

      return () => clearInterval(pollInterval)
    }
  }
}

export const vapiService = new VAPIService()