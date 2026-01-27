// VOX Tools - Single decision tool exposed to the model

export interface VAPITool {
  type: 'function'
  async: boolean
  function: {
    name: string
    description: string
    strict: boolean
    parameters: {
      type: 'object'
      additionalProperties: boolean
      required: string[]
      properties: Record<string, unknown>
    }
  }
}

/**
 * Creates the single take_action tool.
 * The model only decides - execution happens in the runtime.
 */
export function createTakeActionTool(): VAPITool {
  return {
    type: 'function',
    async: false,
    function: {
      name: 'take_action',
      description: 'Return the next action to take. Always call this exactly once per turn.',
      strict: true,
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['heard', 'action', 'confidence'],
        properties: {
          heard: {
            type: 'string',
            description: 'Brief summary of what you heard (max 50 chars).'
          },
          action: {
            type: 'string',
            enum: ['dtmf', 'speak', 'wait', 'end', 'transfer'],
            description: 'The action to take.'
          },
          digit: {
            type: 'string',
            enum: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '#'],
            description: 'Required if action=dtmf. The digit to press.'
          },
          say: {
            type: 'string',
            description: 'Required if action=speak. What to say (keep it brief).'
          },
          confidence: {
            type: 'string',
            enum: ['high', 'medium', 'low'],
            description: 'How confident you are in this action.'
          }
        }
      }
    }
  }
}

/**
 * Creates the record_info tool for info gathering calls.
 */
export function createRecordInfoTool(): VAPITool {
  return {
    type: 'function',
    async: false,
    function: {
      name: 'record_info',
      description: 'Record important information you heard. Call after take_action when you learn something useful.',
      strict: true,
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['infoType', 'value', 'confidence'],
        properties: {
          infoType: {
            type: 'string',
            enum: ['phone', 'website', 'email', 'address', 'hours', 'name', 'other'],
            description: 'Type of information.'
          },
          value: {
            type: 'string',
            description: 'The actual information value.'
          },
          confidence: {
            type: 'string',
            enum: ['high', 'medium', 'low'],
            description: 'How confident you are this is correct.'
          }
        }
      }
    }
  }
}

/**
 * Get all tools for a call based on whether it's info gathering.
 */
export function getToolsForCall(isInfoGathering: boolean): VAPITool[] {
  const tools: VAPITool[] = [createTakeActionTool()]
  
  if (isInfoGathering) {
    tools.push(createRecordInfoTool())
  }
  
  return tools
}

