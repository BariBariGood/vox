// VOX Core Types - Single source of truth for the voice agent

export interface TakeActionArgs {
  heard: string
  action: 'dtmf' | 'speak' | 'wait' | 'end' | 'transfer'
  digit?: '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '*' | '#'
  say?: string
  confidence: 'high' | 'medium' | 'low'
}

export interface RecordInfoArgs {
  infoType: 'phone' | 'website' | 'email' | 'address' | 'hours' | 'name' | 'other'
  value: string
  confidence: 'high' | 'medium' | 'low'
}

export interface VAPICallConfig {
  phoneNumber: string
  callGoal: string
  customerNumber?: string
}

export interface VAPICallEvent {
  type: 'call-started' | 'speech-started' | 'speech-ended' | 'transcript' | 'tool-call' | 'call-ended' | 'call-status' | 'error'
  timestamp: Date
  data?: unknown
}

export interface CallContext {
  callGoal: string
  infoGathered: Record<string, string>
  menuHistory: string[]
  humanReached: boolean
}

