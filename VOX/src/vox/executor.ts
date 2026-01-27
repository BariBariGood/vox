// VOX Executor - Deterministic action execution
// The model decides, this code executes. No "forgot to press" failures.

import type { TakeActionArgs, RecordInfoArgs } from './types'

export interface ExecutorCallbacks {
  sendDtmf: (digit: string) => Promise<void>
  endCall: () => Promise<void>
  transfer: (number: string) => Promise<void>
  // speak is handled by VAPI automatically via the say field
}

export interface ExecutionResult {
  executed: boolean
  action: string
  details?: string
}

/**
 * Execute a take_action decision.
 * This is the key: model decides, code executes.
 */
export async function executeAction(
  args: TakeActionArgs,
  callbacks: ExecutorCallbacks,
  customerNumber?: string
): Promise<ExecutionResult> {
  switch (args.action) {
    case 'dtmf':
      if (!args.digit) {
        console.warn('[VOX Executor] dtmf action missing digit, treating as wait')
        return { executed: false, action: 'dtmf', details: 'missing digit' }
      }
      await callbacks.sendDtmf(args.digit)
      return { executed: true, action: 'dtmf', details: `pressed ${args.digit}` }

    case 'end':
      await callbacks.endCall()
      return { executed: true, action: 'end', details: 'call ended' }

    case 'transfer':
      if (!customerNumber) {
        console.warn('[VOX Executor] transfer action but no customer number')
        return { executed: false, action: 'transfer', details: 'no customer number' }
      }
      await callbacks.transfer(customerNumber)
      return { executed: true, action: 'transfer', details: `transferring to ${customerNumber}` }

    case 'speak':
      // Speech is handled by VAPI via the say field - we don't need to do anything
      return { executed: true, action: 'speak', details: args.say || '' }

    case 'wait':
    default:
      // Do nothing - just wait
      return { executed: true, action: 'wait', details: 'waiting' }
  }
}

/**
 * Process a record_info call.
 * Returns the recorded info for storage.
 */
export function processRecordInfo(args: RecordInfoArgs): { type: string; value: string } {
  console.log(`[VOX Executor] Recording info: ${args.infoType} = ${args.value} (${args.confidence})`)
  return {
    type: args.infoType,
    value: args.value
  }
}

/**
 * Detect DTMF from transcript text BEFORE asking the model.
 * This makes IVR navigation nearly deterministic.
 */
export function detectDtmfFromText(transcript: string): TakeActionArgs | null {
  const text = transcript.toLowerCase()

  // Match "press 1", "press 2", etc.
  const digitMatch = text.match(/\bpress\s+([0-9])\b/)
  if (digitMatch) {
    return {
      heard: 'menu prompt',
      action: 'dtmf',
      digit: digitMatch[1] as TakeActionArgs['digit'],
      confidence: 'high'
    }
  }

  // Match "press star" or "press pound"
  const specialMatch = text.match(/\bpress\s+(star|pound|asterisk|hash)\b/)
  if (specialMatch) {
    const digit = specialMatch[1] === 'star' || specialMatch[1] === 'asterisk' ? '*' : '#'
    return {
      heard: 'menu prompt',
      action: 'dtmf',
      digit,
      confidence: 'high'
    }
  }

  // Match "for X, press Y" pattern
  const forPressMatch = text.match(/for\s+\w+[,\s]+press\s+([0-9*#])/i)
  if (forPressMatch) {
    const d = forPressMatch[1]
    const digit = d === '*' ? '*' : d === '#' ? '#' : d as TakeActionArgs['digit']
    return {
      heard: 'menu option',
      action: 'dtmf',
      digit,
      confidence: 'high'
    }
  }

  return null
}

