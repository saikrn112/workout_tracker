import { supabase } from './supabase'
import type { User, Session } from '@supabase/supabase-js'

export interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
}

export class AuthService {
  private static instance: AuthService
  private authState: AuthState = {
    user: null,
    session: null,
    loading: true
  }
  private listeners: Array<(state: AuthState) => void> = []

  private constructor() {
    this.initialize()
  }

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService()
    }
    return AuthService.instance
  }

  private async initialize() {
    if (!supabase) {
      // Supabase not available - set loading to false with no user
      this.authState = {
        user: null,
        session: null,
        loading: false
      }
      this.notifyListeners()
      return
    }

    try {
      // Get initial session
      const { data: { session } } = await supabase.auth.getSession()
      this.authState = {
        user: session?.user || null,
        session,
        loading: false
      }
      this.notifyListeners()

      // Listen for auth changes
      supabase.auth.onAuthStateChange(async (event, session) => {
        this.authState = {
          user: session?.user || null,
          session,
          loading: false
        }
        this.notifyListeners()

        // Handle sign out
        if (event === 'SIGNED_OUT') {
          // Clear any cached data
          if (typeof window !== 'undefined') {
            localStorage.removeItem('workout-data-migrated')
          }
        }
      })
    } catch (error) {
      console.error('Error initializing auth service:', error)
      this.authState = {
        user: null,
        session: null,
        loading: false
      }
      this.notifyListeners()
    }
  }

  private notifyListeners() {
    this.listeners.forEach(callback => callback(this.authState))
  }

  public subscribe(callback: (state: AuthState) => void) {
    this.listeners.push(callback)
    // Immediately call with current state
    callback(this.authState)

    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback)
    }
  }

  public getState(): AuthState {
    return this.authState
  }

  public async signInWithGoogle() {
    if (!supabase) {
      return { data: null, error: { message: 'Supabase not configured' } }
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    })
    return { data, error }
  }

  public async signInWithEmail(email: string, password: string) {
    if (!supabase) {
      return { data: null, error: { message: 'Supabase not configured' } }
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    return { data, error }
  }

  public async signUpWithEmail(email: string, password: string) {
    if (!supabase) {
      return { data: null, error: { message: 'Supabase not configured' } }
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password
    })
    return { data, error }
  }

  public async signOut() {
    if (!supabase) {
      return { error: null }
    }

    const { error } = await supabase.auth.signOut()
    return { error }
  }

  public async resetPassword(email: string) {
    if (!supabase) {
      return { data: null, error: { message: 'Supabase not configured' } }
    }

    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`
    })
    return { data, error }
  }
}

// Export singleton instance
export const authService = AuthService.getInstance()