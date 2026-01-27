import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

interface UserProfile {
  id: string
  phone_number?: string
  display_name?: string
  company?: string
  timezone: string
  profile_picture_url?: string
  created_at: string
  updated_at: string
}

export function AccountPage() {
  const { user, signOut } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // Form state
  const [phoneNumber, setPhoneNumber] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [company, setCompany] = useState('')
  const [timezone, setTimezone] = useState('UTC')
  const [profilePictureUrl, setProfilePictureUrl] = useState<string>('')

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load user profile on mount
  useEffect(() => {
    if (user) {
      loadProfile()
    }
  }, [user])

  const loadProfile = async () => {
    if (!user) return

    try {
      setLoading(true)

      // Try to load existing profile
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error loading profile:', error)
      } else if (data) {
        setProfile(data)
        setPhoneNumber(data.phone_number || '')
        setDisplayName(data.display_name || '')
        setCompany(data.company || '')
        setTimezone(data.timezone || 'UTC')
        setProfilePictureUrl(data.profile_picture_url || '')
      } else {
        // No profile exists yet, use defaults
        setDisplayName(user.email?.split('@')[0] || '')
      }
    } catch (error) {
      console.error('Error loading profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    try {
      setSaving(true)
      setMessage(null)

      // Format phone number to E.164 if provided
      let formattedPhone = phoneNumber.trim()
      if (formattedPhone && !formattedPhone.startsWith('+')) {
        // Assume US number if no country code
        formattedPhone = '+1' + formattedPhone.replace(/\D/g, '')
      }

      const profileData = {
        id: user.id,
        phone_number: formattedPhone || null,
        display_name: displayName.trim() || null,
        company: company.trim() || null,
        timezone: timezone,
        profile_picture_url: profilePictureUrl || null
      }

      let result
      if (profile) {
        // Update existing profile
        result = await supabase
          .from('user_profiles')
          .update(profileData)
          .eq('id', user.id)
          .select()
      } else {
        // Insert new profile
        result = await supabase
          .from('user_profiles')
          .insert([profileData])
          .select()
      }

      const { data, error } = result

      if (error) {
        console.error('Error saving profile:', error)
        setMessage({ type: 'error', text: 'Failed to save profile. Please try again.' })
      } else {
        setProfile(data[0])
        setMessage({ type: 'success', text: 'Profile saved successfully!' })

        // Clear message after 3 seconds
        setTimeout(() => setMessage(null), 3000)
      }
    } catch (error) {
      console.error('Error saving profile:', error)
      setMessage({ type: 'error', text: 'An unexpected error occurred.' })
    } finally {
      setSaving(false)
    }
  }

  const formatPhoneNumber = (value: string) => {
    // Remove all non-digit characters
    const digits = value.replace(/\D/g, '')

    // Format as (XXX) XXX-XXXX for US numbers
    if (digits.length <= 10) {
      if (digits.length <= 3) return digits
      if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`
    }

    return value // Return as-is if longer than 10 digits (international)
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (value.startsWith('+')) {
      // International format - allow as-is
      setPhoneNumber(value)
    } else {
      // US format - auto-format
      setPhoneNumber(formatPhoneNumber(value))
    }
  }

  const handleProfilePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Please select a valid image file.' })
      return
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Image must be smaller than 5MB.' })
      return
    }

    try {
      setUploading(true)
      setMessage(null)

      // Generate unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}-${Date.now()}.${fileExt}`
      const filePath = `profile-pictures/${fileName}`

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('user-uploads')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        console.error('Upload error:', uploadError)
        setMessage({ type: 'error', text: 'Failed to upload image. Please try again.' })
        return
      }

      // Get public URL
      const { data } = supabase.storage
        .from('user-uploads')
        .getPublicUrl(filePath)

      if (data?.publicUrl) {
        setProfilePictureUrl(data.publicUrl)
        setMessage({ type: 'success', text: 'Profile picture uploaded! Remember to save your profile.' })
      }
    } catch (error) {
      console.error('Error uploading profile picture:', error)
      setMessage({ type: 'error', text: 'An unexpected error occurred during upload.' })
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveProfilePicture = () => {
    setProfilePictureUrl('')
    setMessage({ type: 'success', text: 'Profile picture removed! Remember to save your profile.' })
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const getProfilePictureUrl = () => {
    return profilePictureUrl || '/src/assets/blank-profile.webp'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative bg-gray-950 overflow-hidden">
      {/* Dynamic Background Blur Effect - Same as Dashboard */}
      <div className="w-[1000px] h-[1000px] absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 bg-gradient-to-t from-blue-900/80 via-blue-700/60 to-cyan-600/40 rounded-full blur-[200px]" />

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-2xl border border-slate-700/50 mb-6">
          <div className="px-6 py-4 border-b border-slate-700/50 flex justify-between items-center">
            <div className="flex items-center">
              <Link
                to="/dashboard"
                className="mr-4 p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                title="Back to Dashboard"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  Account Settings
                </h1>
                <p className="text-white/60">Manage your VOX account and preferences</p>
              </div>
            </div>
            <button
              onClick={signOut}
              className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all"
              title="Sign Out"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>

        {/* Profile Form */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-2xl border border-slate-700/50">
          <div className="px-6 py-4 border-b border-slate-700/50">
            <h2 className="text-lg font-medium text-white">Profile Information</h2>
            <p className="text-sm text-white/60">Update your account details and contact information</p>
          </div>

          <form onSubmit={saveProfile} className="px-6 py-6 space-y-6">
            {/* Profile Picture */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Profile Picture
              </label>
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0">
                  <img
                    src={getProfilePictureUrl()}
                    alt="Profile"
                    className="h-20 w-20 rounded-full object-cover border-2 border-slate-600 shadow-xl"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/src/assets/blank-profile.webp';
                    }}
                  />
                </div>
                <div className="flex-1">
                  <div className="flex space-x-2">
                    <label
                      htmlFor="profile-picture"
                      className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all ${
                        uploading
                          ? 'bg-white/10 text-white/40 cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {uploading ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Uploading...
                        </>
                      ) : (
                        <>
                          <svg className="-ml-1 mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          Upload Photo
                        </>
                      )}
                    </label>
                    <input
                      id="profile-picture"
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleProfilePictureUpload}
                      disabled={uploading}
                      className="hidden"
                    />
                    {profilePictureUrl && (
                      <button
                        type="button"
                        onClick={handleRemoveProfilePicture}
                        disabled={uploading}
                        className="inline-flex items-center px-4 py-2 border border-red-500/50 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        <svg className="-ml-1 mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-white/40 mt-2">
                    JPG, PNG, WebP or GIF. Max size 5MB.
                  </p>
                </div>
              </div>
            </div>

            {/* Email (read-only) */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full px-4 py-3 bg-white/5 border border-slate-600 rounded-lg text-white/50 cursor-not-allowed"
              />
              <p className="text-xs text-white/40 mt-1">Email cannot be changed</p>
            </div>

            {/* Display Name */}
            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-white mb-2">
                Display Name
              </label>
              <input
                type="text"
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-slate-600 rounded-lg text-white placeholder-white/40 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                placeholder="Your preferred name"
              />
            </div>

            {/* Phone Number */}
            <div>
              <label htmlFor="phoneNumber" className="block text-sm font-medium text-white mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                id="phoneNumber"
                value={phoneNumber}
                onChange={handlePhoneChange}
                className="w-full px-4 py-3 bg-white/10 border border-slate-600 rounded-lg text-white placeholder-white/40 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                placeholder="(555) 123-4567 or +1234567890"
              />
              <p className="text-xs text-white/40 mt-1">
                Used for callback numbers and call identification. International format (+country code) supported.
              </p>
            </div>

            {/* Company */}
            <div>
              <label htmlFor="company" className="block text-sm font-medium text-white mb-2">
                Company (Optional)
              </label>
              <input
                type="text"
                id="company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-slate-600 rounded-lg text-white placeholder-white/40 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                placeholder="Your company name"
              />
            </div>

            {/* Timezone */}
            <div>
              <label htmlFor="timezone" className="block text-sm font-medium text-white mb-2">
                Timezone
              </label>
              <select
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none appearance-none cursor-pointer"
              >
                <option value="UTC" className="bg-gray-900">UTC</option>
                <option value="America/New_York" className="bg-gray-900">Eastern Time</option>
                <option value="America/Chicago" className="bg-gray-900">Central Time</option>
                <option value="America/Denver" className="bg-gray-900">Mountain Time</option>
                <option value="America/Los_Angeles" className="bg-gray-900">Pacific Time</option>
                <option value="Europe/London" className="bg-gray-900">London</option>
                <option value="Europe/Paris" className="bg-gray-900">Paris</option>
                <option value="Asia/Tokyo" className="bg-gray-900">Tokyo</option>
              </select>
            </div>

            {/* Message */}
            {message && (
              <div className={`p-3 rounded-lg ${
                message.type === 'success'
                  ? 'bg-green-500/10 text-green-400 border border-green-500/50'
                  : 'bg-red-500/10 text-red-400 border border-red-500/50'
              }`}>
                {message.text}
              </div>
            )}

            {/* Save Button */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className={`px-6 py-3 rounded-lg font-medium transition-all ${
                  saving
                    ? 'bg-white/10 text-white/40 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {saving ? (
                  <div className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </div>
                ) : 'Save Profile'}
              </button>
            </div>
          </form>
        </div>

        {/* Account Stats */}
        <div className="mt-6 bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-2xl border border-slate-700/50">
          <div className="px-6 py-4 border-b border-slate-700/50">
            <h2 className="text-lg font-medium text-white">Account Information</h2>
          </div>
          <div className="px-6 py-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-white/60">Account Created:</span>
              <span className="text-white">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/60">User ID:</span>
              <span className="text-white font-mono text-xs bg-white/10 px-2 py-1 rounded">
                {user?.id}
              </span>
            </div>
            {profile && (
              <div className="flex justify-between text-sm">
                <span className="text-white/60">Profile Updated:</span>
                <span className="text-white">
                  {new Date(profile.updated_at).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-white/40 text-sm">
            Need help? Contact support at support@vox.ai
          </p>
        </div>
      </div>
    </div>
  )
}