import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export function LoginPage() {
  const [name, setName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { signIn, signUp } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Validation for sign up
    if (isSignUp) {
      if (!email || !name || !phoneNumber) {
        setError('Please fill in all fields')
        setLoading(false)
        return
      }
    } else {
      // Validation for sign in
      if (!email || !password) {
        setError('Please fill in all fields')
        setLoading(false)
        return
      }

      if (password.length < 6) {
        setError('Password must be at least 6 characters long')
        setLoading(false)
        return
      }
    }

    try {
      if (isSignUp) {
        // For signup, we'll use a temporary password and let them set it later
        const tempPassword = Math.random().toString(36).substring(2, 15)
        const { data, error } = await signUp(email, tempPassword)

        if (error) {
          if (error.message.includes('User already registered')) {
            setError('An account with this email already exists. Please sign in instead.')
          } else {
            setError(error.message)
          }
        } else if (data.user) {
          // Save user profile data
          const { error: profileError } = await supabase
            .from('user_profiles')
            .insert({
              id: data.user.id,
              display_name: name,
              phone_number: phoneNumber,
              timezone: 'UTC',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })

          if (profileError) {
            console.error('Error saving profile:', profileError)
          }

          setError(null)
          // Show success message for sign up
          alert('Account created successfully! Please check your email to confirm your account.')
        }
      } else {
        // Sign in
        const { error } = await signIn(email, password)

        if (error) {
          // Provide more user-friendly error messages
          if (error.message.includes('Invalid login credentials')) {
            setError('Invalid email or password. Please check your credentials.')
          } else if (error.message.includes('Email not confirmed')) {
            setError('Please check your email and confirm your account before signing in.')
          } else {
            setError(error.message)
          }
        }
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen relative bg-gray-950 overflow-hidden flex items-center justify-center">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-gray-950 to-slate-900" />
      
      {/* Content */}
      <div className="relative z-10 w-full max-w-md mx-auto px-6">
        {/* VOX Logo and Branding */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-6">
            <img src="/src/assets/vox-logo.svg" alt="VOX Logo" className="h-12 w-12 mr-4" />
            <h1 className="text-4xl font-light text-white tracking-wide">Vox</h1>
          </div>
          <h2 className="text-xl font-light text-white/80">Let's get you set up.</h2>
        </div>

        {/* Setup Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name Field */}
          {isSignUp && (
            <div>
              <label className="block text-sm font-medium text-white/60 mb-2">
                Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                  <svg className="h-5 w-5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tommy Trojan"
                  className="w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent backdrop-blur-sm"
                  required={isSignUp}
                />
              </div>
            </div>
          )}

          {/* Phone Number Field */}
          {isSignUp && (
            <div>
              <label className="block text-sm font-medium text-white/60 mb-2">
                Phone Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                  <svg className="h-5 w-5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="(123) 456-7890"
                  className="w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent backdrop-blur-sm"
                  required={isSignUp}
                />
              </div>
            </div>
          )}

          {/* Email Field */}
          <div>
            <label className="block text-sm font-medium text-white/60 mb-2">
              Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                <svg className="h-5 w-5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                </svg>
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tommytrojan@gmail.com"
                className="w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent backdrop-blur-sm"
                required
              />
            </div>
          </div>

          {/* Password Field */}
          {!isSignUp && (
            <div>
              <label className="block text-sm font-medium text-white/60 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                  <svg className="h-5 w-5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent backdrop-blur-sm"
                  required={!isSignUp}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !email || (!isSignUp && !password) || (isSignUp && (!name || !phoneNumber))}
            className="w-full mt-8 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                {isSignUp ? 'Setting up...' : 'Signing in...'}
              </div>
            ) : (
              isSignUp ? 'Get Started' : 'Sign In'
            )}
          </button>
        </form>

        {/* Toggle between sign up and sign in */}
        <div className="text-center mt-6">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp)
              setError(null)
              setName('')
              setPhoneNumber('')
              setPassword('')
            }}
            className="text-white/60 hover:text-white/80 text-sm transition-colors"
          >
            {isSignUp 
              ? 'Already have an account? Sign in'
              : "Don't have an account? Sign up"
            }
          </button>
        </div>
      </div>
    </div>
  )
}