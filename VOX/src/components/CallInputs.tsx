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
    <div className="flex gap-4 items-center">
      {/* Phone Number Input */}
      <div className="relative flex-shrink-0">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
          <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
        </div>
        <input
          id="phone"
          type="tel"
          value={phoneNumber}
          onChange={handlePhoneChange}
          disabled={isCallActive}
          placeholder="Enter a phone number"
          className={`w-80 pl-12 pr-4 py-4 bg-gradient-to-br from-white/20 to-white/0 rounded-xl outline outline-1 outline-neutral-900 backdrop-blur-xl text-white placeholder-white/50 transition-colors ${
            phoneError 
              ? 'border-red-400 bg-red-500/10' 
              : 'hover:outline-white/30 focus:outline-blue-400'
          } ${isCallActive ? 'opacity-50 cursor-not-allowed' : ''}`}
          maxLength={14}
        />
        {phoneError && (
          <p className="absolute top-full mt-1 text-sm text-red-400 flex items-center">
            <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {phoneError}
          </p>
        )}
      </div>

      {/* Call Goal Input */}
      <div className="relative flex-1">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
          <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </div>
        <input
          id="goal"
          type="text"
          value={callGoal}
          onChange={(e) => setCallGoal(e.target.value)}
          disabled={isCallActive}
          placeholder="Add what you want to complete here"
          className={`w-full pl-12 pr-4 py-4 bg-gradient-to-br from-white/20 to-white/0 rounded-xl outline outline-1 outline-neutral-900 backdrop-blur-xl text-white placeholder-white/50 transition-colors ${
            goalError 
              ? 'border-red-400 bg-red-500/10' 
              : 'hover:outline-white/30 focus:outline-blue-400'
          } ${isCallActive ? 'opacity-50 cursor-not-allowed' : ''}`}
        />
        {goalError && (
          <p className="absolute top-full mt-1 text-sm text-red-400 flex items-center">
            <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {goalError}
          </p>
        )}
      </div>

      {/* Submit Button */}
      <button
        onClick={handleStartCall}
        disabled={!isFormValid() && !isCallActive}
        className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 ${
          isCallActive
            ? 'bg-red-500/20 backdrop-blur-md border border-red-500/40 hover:bg-red-500/30 text-red-400'
            : isFormValid()
            ? 'bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 text-white'
            : 'bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'
        }`}
      >
        {isCallActive ? (
          <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
          </svg>
        ) : (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
          </svg>
        )}
      </button>
    </div>
  )
}
