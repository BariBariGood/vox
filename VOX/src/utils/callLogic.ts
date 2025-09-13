import type { StreamEvent } from '../components/LiveStream'

export interface CallIntent {
  type: 'information_gathering' | 'appointment_scheduling' | 'billing_inquiry' | 'technical_support' | 'general_inquiry'
  sensitivity: 'low' | 'medium' | 'high'
  requiresUserInput: boolean
  keywords: string[]
}

export interface CallDecision {
  shouldBridge: boolean
  reason: 'sensitive_data' | 'operator_required' | 'user_requested' | 'complex_query' | 'auto_complete'
  confidence: number
  autoCompleteData?: {
    title: string
    link?: string
    details?: string
  }
}

// Analyze call goal to determine intent
export function analyzeCallIntent(callGoal: string): CallIntent {
  const goal = callGoal.toLowerCase()
  
  // Information gathering keywords
  const infoKeywords = ['portal', 'website', 'link', 'information', 'details', 'hours', 'location', 'address', 'directions']
  const appointmentKeywords = ['appointment', 'schedule', 'booking', 'visit', 'meeting', 'consultation']
  const billingKeywords = ['billing', 'payment', 'invoice', 'charge', 'refund', 'account', 'balance']
  const techSupportKeywords = ['problem', 'issue', 'broken', 'error', 'help', 'support', 'troubleshoot']
  const sensitiveKeywords = ['personal', 'private', 'confidential', 'ssn', 'social security', 'password', 'account number']
  
  // Determine intent type
  let type: CallIntent['type'] = 'general_inquiry'
  let sensitivity: CallIntent['sensitivity'] = 'low'
  let requiresUserInput = false
  
  if (infoKeywords.some(keyword => goal.includes(keyword))) {
    type = 'information_gathering'
    sensitivity = 'low'
    requiresUserInput = false
  } else if (appointmentKeywords.some(keyword => goal.includes(keyword))) {
    type = 'appointment_scheduling'
    sensitivity = 'medium'
    requiresUserInput = true
  } else if (billingKeywords.some(keyword => goal.includes(keyword))) {
    type = 'billing_inquiry'
    sensitivity = 'high'
    requiresUserInput = true
  } else if (techSupportKeywords.some(keyword => goal.includes(keyword))) {
    type = 'technical_support'
    sensitivity = 'medium'
    requiresUserInput = true
  }
  
  // Check for sensitive data indicators
  if (sensitiveKeywords.some(keyword => goal.includes(keyword))) {
    sensitivity = 'high'
    requiresUserInput = true
  }
  
  return {
    type,
    sensitivity,
    requiresUserInput,
    keywords: goal.split(' ')
  }
}

// Decide whether to bridge user or auto-complete
export function makeCallDecision(
  intent: CallIntent,
  currentContext: string,
  availableInfo?: any
): CallDecision {
  
  // Auto-complete scenarios
  if (intent.type === 'information_gathering' && intent.sensitivity === 'low') {
    // Check if we can provide the information directly
    if (intent.keywords.some(keyword => ['portal', 'website', 'link'].includes(keyword))) {
      return {
        shouldBridge: false,
        reason: 'auto_complete',
        confidence: 0.9,
        autoCompleteData: {
          title: 'Admission Portal Access',
          link: 'https://admissions.university.edu/portal',
          details: 'Use this link to access the student admission portal. You can check application status, submit documents, and view requirements.'
        }
      }
    }
    
    if (intent.keywords.some(keyword => ['hours', 'location', 'address'].includes(keyword))) {
      return {
        shouldBridge: false,
        reason: 'auto_complete',
        confidence: 0.85,
        autoCompleteData: {
          title: 'Business Hours & Location',
          details: 'Monday-Friday: 9:00 AM - 5:00 PM, Saturday: 10:00 AM - 2:00 PM. Located at 123 Main St, Suite 100.'
        }
      }
    }
  }
  
  // Bridge scenarios
  if (intent.sensitivity === 'high') {
    return {
      shouldBridge: true,
      reason: 'sensitive_data',
      confidence: 0.95
    }
  }
  
  if (intent.type === 'billing_inquiry' || intent.type === 'appointment_scheduling') {
    return {
      shouldBridge: true,
      reason: 'operator_required',
      confidence: 0.8
    }
  }
  
  if (intent.requiresUserInput) {
    return {
      shouldBridge: true,
      reason: 'user_requested',
      confidence: 0.7
    }
  }
  
  // Complex queries that AI couldn't handle
  if (currentContext.includes('multiple options') || currentContext.includes('unclear')) {
    return {
      shouldBridge: true,
      reason: 'complex_query',
      confidence: 0.6
    }
  }
  
  // Default to bridging if uncertain
  return {
    shouldBridge: true,
    reason: 'operator_required',
    confidence: 0.5
  }
}

// Simulate call events based on intent
export function generateCallEvents(
  phoneNumber: string,
  callGoal: string,
  intent: CallIntent
): StreamEvent[] {
  const events: StreamEvent[] = []
  let eventId = 1
  
  const addEvent = (
    type: StreamEvent['type'],
    message: string,
    data?: StreamEvent['data']
  ) => {
    events.push({
      id: `event-${eventId++}`,
      timestamp: new Date(Date.now() + events.length * 1000),
      type,
      message,
      data
    })
  }
  
  // Initial events
  addEvent('system', `Calling ${phoneNumber}...`)
  addEvent('system', 'Call connected, analyzing audio...')
  addEvent('menu', 'Detected IVR menu: "Press 1 for Sales, Press 2 for Support, Press 3 for Billing"')
  
  // Navigate based on intent
  if (intent.type === 'information_gathering') {
    addEvent('action', 'Pressed 2 for Support', { actionTaken: 'press_2' })
    addEvent('menu', 'Sub-menu detected: "Press 1 for General Info, Press 2 for Hours, Press 3 for Website"')
    addEvent('action', 'Pressed 1 for General Information', { actionTaken: 'press_1' })
    addEvent('system', 'Automated information system detected')
    
    // Auto-complete with information
    addEvent('info', 'Information successfully gathered from automated system', {
      infoGathered: {
        title: 'University Admission Portal',
        link: 'https://admissions.university.edu/portal',
        details: 'Access your application status, submit required documents, and view admission requirements. Portal is available 24/7.'
      }
    })
    addEvent('complete', 'Call completed successfully - Information sent to user')
    
  } else if (intent.type === 'appointment_scheduling') {
    addEvent('action', 'Pressed 1 for Sales/Appointments', { actionTaken: 'press_1' })
    addEvent('system', 'Hold music detected, waiting for representative...')
    addEvent('transfer', 'Human representative detected', { transferTarget: 'scheduling_department' })
    addEvent('bridge', 'Sensitive scheduling information required - connecting you now', {
      bridgeReason: 'operator_required'
    })
    
  } else if (intent.type === 'billing_inquiry') {
    addEvent('action', 'Pressed 3 for Billing', { actionTaken: 'press_3' })
    addEvent('system', 'Security verification required for billing information')
    addEvent('bridge', 'Personal billing information required - connecting you for verification', {
      bridgeReason: 'sensitive_data'
    })
    
  } else {
    // General inquiry - try to get info first
    addEvent('action', 'Pressed 2 for Support', { actionTaken: 'press_2' })
    addEvent('system', 'Analyzing query complexity...')
    addEvent('bridge', 'Complex query detected - human assistance recommended', {
      bridgeReason: 'complex_query'
    })
  }
  
  return events
}
