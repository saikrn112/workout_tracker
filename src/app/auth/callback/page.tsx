'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const handleAuthCallback = async () => {
      if (!supabase) {
        router.push('/')
        return
      }

      try {
        const { error } = await supabase.auth.getSession()
        if (error) {
          console.error('Auth callback error:', error)
        }
        // Redirect to home page after successful authentication
        router.push('/')
      } catch (error) {
        console.error('Auth callback error:', error)
        router.push('/')
      }
    }

    handleAuthCallback()
  }, [router])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="text-gray-600">Completing sign in...</div>
      </div>
    </div>
  )
}