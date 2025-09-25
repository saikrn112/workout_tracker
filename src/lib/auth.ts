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
        localStorage.removeItem('workout-data-migrated')
      }
    })
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
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    })
    return { data, error }
  }

  public async signInWithEmail(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    return { data, error }
  }

  public async signUpWithEmail(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    })
    return { data, error }
  }

  public async signOut() {
    const { error } = await supabase.auth.signOut()
    return { error }
  }

  public async resetPassword(email: string) {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`
    })
    return { data, error }
  }
}

// Export singleton instance
export const authService = AuthService.getInstance()