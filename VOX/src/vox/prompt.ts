// VOX Prompts - Minimal, focused system prompts

/**
 * Generate the system prompt for a call.
 * Keep it SHORT - fewer tokens = more reliable behavior.
 */
export function generateSystemPrompt(callGoal: string, isInfoGathering: boolean): string {
  const base = `You are VOX, a phone agent calling on behalf of a customer.

Goal: ${callGoal}

Rules:
- Every turn: call take_action exactly once.
- If you hear "press" + a digit/star/pound → action=dtmf with that digit.
- If a human asks a question → action=speak, answer briefly.
- If hold music, silence, or automated message → action=wait.
- If goal is achieved or call should end → action=end.
- If ready to transfer to customer → action=transfer.

Be concise and polite. Don't announce button presses.`

  if (isInfoGathering) {
    return base + `

Info Gathering:
- Listen for: phone numbers, websites, emails, addresses, hours.
- When you hear useful info, also call record_info after take_action.
- End call once you have the information needed.`
  }

  return base + `

Task Mode:
- Navigate phone menus to reach the right department.
- State your goal briefly when you reach a human.
- End call when task is complete or cannot be completed.`
}

/**
 * Generate a short context update (not in main prompt, passed separately).
 */
export function generateContextUpdate(context: {
  infoGathered?: Record<string, string>
  menuHistory?: string[]
  humanReached?: boolean
}): string {
  const parts: string[] = []

  if (context.humanReached) {
    parts.push('Human reached.')
  }

  if (context.infoGathered && Object.keys(context.infoGathered).length > 0) {
    const info = Object.entries(context.infoGathered)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ')
    parts.push(`Info gathered: ${info}`)
  }

  if (context.menuHistory && context.menuHistory.length > 0) {
    parts.push(`Menu path: ${context.menuHistory.join(' → ')}`)
  }

  return parts.length > 0 ? `Context: ${parts.join('. ')}` : ''
}

