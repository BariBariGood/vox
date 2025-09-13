import { useState } from 'react'

interface CallInputsProps {
  onStartCall: (phoneNumber: string, callGoal: string) => void
  isCallActive?: boolean
}

export function CallInputs({ onStartCall, isCallActive = false }: CallInputsProps) {
  const [phoneNumber, setPhoneNumber] = useState('')
  const [callGoal, setCallGoal] = useState('')
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [goalError, setGoalError] = useState<string | null>(null)

  // Format phone number as user types
  const formatPhoneNumber = (value: string) => {
    // Remove all non-digits
    const cleaned = value.replace(/\D/g, '')
    
    // Apply formatting: (XXX) XXX-XXXX
    if (cleaned.length <= 3) {
      return cleaned
    } else if (cleaned.length <= 6) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`
    } else {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`
    }
  }

  const validatePhoneNumber = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length === 0) {
      return 'Phone number is required'
    }
    if (cleaned.length !== 10) {
      return 'Please enter a valid 10-digit phone number'
    }
    return null
  }

  const validateCallGoal = (goal: string) => {
    if (!goal.trim()) {
      return 'Call goal is required'
    }
    if (goal.trim().length < 10) {
      return 'Please provide a more detailed call goal (at least 10 characters)'
    }
    return null
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value)
    setPhoneNumber(formatted)
    
    // Clear error when user starts typing
    if (phoneError) {
      setPhoneError(null)
    }
  }

  const handleGoalChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCallGoal(e.target.value)
    
    // Clear error when user starts typing
    if (goalError) {
      setGoalError(null)
    }
  }

  const handleStartCall = () => {
    // Validate inputs
    const phoneValidationError = validatePhoneNumber(phoneNumber)
    const goalValidationError = validateCallGoal(callGoal)

    setPhoneError(phoneValidationError)
    setGoalError(goalValidationError)

    // If validation passes, start the call
    if (!phoneValidationError && !goalValidationError) {
      const cleanedPhone = phoneNumber.replace(/\D/g, '')
      onStartCall(`+1${cleanedPhone}`, callGoal.trim())
    }
  }

  const isFormValid = () => {
    const phoneValid = validatePhoneNumber(phoneNumber) === null
    const goalValid = validateCallGoal(callGoal) === null
    return phoneValid && goalValid && !isCallActive
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center mb-6">
        <div className="h-10 w-10 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center mr-3">
          <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Start New Call</h3>
          <p className="text-sm text-gray-600">Let VOX handle the phone navigation for you</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Phone Number Input */}
        <div className="space-y-2">
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
            Phone Number to Call
          </label>
          <div className="relative">
            <input
              id="phone"
              type="tel"
              value={phoneNumber}
              onChange={handlePhoneChange}
              disabled={isCallActive}
              placeholder="(555) 123-4567"
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                phoneError 
                  ? 'border-red-300 bg-red-50' 
                  : 'border-gray-300 hover:border-gray-400'
              } ${isCallActive ? 'bg-gray-100 cursor-not-allowed' : ''}`}
              maxLength={14}
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
          </div>
          {phoneError && (
            <p className="text-sm text-red-600 flex items-center">
              <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {phoneError}
            </p>
          )}
        </div>

        {/* Call Goal Input */}
        <div className="space-y-2">
          <label htmlFor="goal" className="block text-sm font-medium text-gray-700">
            Goal of Call
          </label>
          <textarea
            id="goal"
            value={callGoal}
            onChange={handleGoalChange}
            disabled={isCallActive}
            placeholder="e.g., Schedule a doctor's appointment for next week, get customer support for my billing issue, speak to sales about pricing..."
            rows={3}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors resize-none ${
              goalError 
                ? 'border-red-300 bg-red-50' 
                : 'border-gray-300 hover:border-gray-400'
            } ${isCallActive ? 'bg-gray-100 cursor-not-allowed' : ''}`}
          />
          {goalError && (
            <p className="text-sm text-red-600 flex items-center">
              <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {goalError}
            </p>
          )}
          <p className="text-xs text-gray-500">
            Be specific about what you want to accomplish. This helps VOX navigate menus more effectively.
          </p>
        </div>
      </div>

      {/* Start Call Button */}
      <div className="mt-6 flex justify-center">
        <button
          onClick={handleStartCall}
          disabled={!isFormValid() || isCallActive}
          className={`px-8 py-3 rounded-lg font-medium transition-all duration-200 ${
            isFormValid() && !isCallActive
              ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700 shadow-lg hover:shadow-xl transform hover:scale-105'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isCallActive ? (
            <div className="flex items-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Call in Progress...
            </div>
          ) : (
            <div className="flex items-center">
              <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              Start Call
            </div>
          )}
        </button>
      </div>

      {/* Helper Text */}
      <div className="mt-4 text-center">
        <p className="text-xs text-gray-500">
          VOX will dial the number, navigate phone menus, and connect you to a human representative
        </p>
      </div>
    </div>
  )
}
