import { supabase } from './supabase'
import { authService } from './auth'

export interface WorkoutData {
  id?: string
  user_id?: string
  date: string
  template: string
  template_name: string
  completed_at?: string
  source?: string
}

export interface WorkoutSetData {
  id?: string
  workout_id?: string
  exercise: string
  set_number: number
  weight: number
  reps: number
  notes?: string
}

export interface WorkoutSessionData {
  id?: string
  user_id?: string
  session_data: any
  date: string
  template: string
  last_saved?: string
}

export class DatabaseService {
  private static instance: DatabaseService

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService()
    }
    return DatabaseService.instance
  }

  // Workout operations
  async createWorkout(workoutData: WorkoutData, sets: WorkoutSetData[]): Promise<{ workout: any, error: any }> {
    try {
      const { user } = authService.getState()
      if (!user) {
        return { workout: null, error: 'User not authenticated' }
      }

      // Insert workout
      const { data: workout, error: workoutError } = await supabase
        .from('workouts')
        .insert({
          ...workoutData,
          user_id: user.id
        })
        .select()
        .single()

      if (workoutError) {
        return { workout: null, error: workoutError }
      }

      // Insert sets
      const setsWithWorkoutId = sets.map(set => ({
        ...set,
        workout_id: workout.id
      }))

      const { error: setsError } = await supabase
        .from('workout_sets')
        .insert(setsWithWorkoutId)

      if (setsError) {
        // Rollback workout if sets insertion fails
        await supabase.from('workouts').delete().eq('id', workout.id)
        return { workout: null, error: setsError }
      }

      return { workout, error: null }
    } catch (error) {
      return { workout: null, error }
    }
  }

  async getWorkouts(): Promise<{ workouts: any[], error: any }> {
    try {
      const { user } = authService.getState()
      if (!user) {
        return { workouts: [], error: 'User not authenticated' }
      }

      const { data: workouts, error } = await supabase
        .from('workouts')
        .select(`
          *,
          workout_sets (
            exercise,
            set_number,
            weight,
            reps,
            notes
          )
        `)
        .eq('user_id', user.id)
        .order('date', { ascending: false })

      if (error) {
        return { workouts: [], error }
      }

      // Transform to match current app format
      const transformedWorkouts = workouts.map(workout => ({
        id: workout.id,
        date: workout.date,
        template: workout.template,
        templateName: workout.template_name,
        completedAt: workout.completed_at,
        source: workout.source,
        exercises: this.transformSetsToExercises(workout.workout_sets)
      }))

      return { workouts: transformedWorkouts, error: null }
    } catch (error) {
      return { workouts: [], error }
    }
  }

  async getWorkoutsByTemplate(template: string, limit = 10): Promise<{ workouts: any[], error: any }> {
    try {
      const { user } = authService.getState()
      if (!user) {
        return { workouts: [], error: 'User not authenticated' }
      }

      const { data: workouts, error } = await supabase
        .from('workouts')
        .select(`
          *,
          workout_sets (
            exercise,
            set_number,
            weight,
            reps,
            notes
          )
        `)
        .eq('user_id', user.id)
        .eq('template', template)
        .order('date', { ascending: false })
        .limit(limit)

      if (error) {
        return { workouts: [], error }
      }

      const transformedWorkouts = workouts.map(workout => ({
        id: workout.id,
        date: workout.date,
        template: workout.template,
        templateName: workout.template_name,
        completedAt: workout.completed_at,
        source: workout.source,
        exercises: this.transformSetsToExercises(workout.workout_sets)
      }))

      return { workouts: transformedWorkouts, error: null }
    } catch (error) {
      return { workouts: [], error }
    }
  }

  // Session operations
  async saveSession(sessionData: WorkoutSessionData): Promise<{ session: any, error: any }> {
    try {
      const { user } = authService.getState()
      if (!user) {
        return { session: null, error: 'User not authenticated' }
      }

      const { data: session, error } = await supabase
        .from('workout_sessions')
        .upsert({
          ...sessionData,
          user_id: user.id,
          last_saved: new Date().toISOString()
        }, {
          onConflict: 'user_id,date,template'
        })
        .select()
        .single()

      return { session, error }
    } catch (error) {
      return { session: null, error }
    }
  }

  async getSession(date: string, template: string): Promise<{ session: any, error: any }> {
    try {
      const { user } = authService.getState()
      if (!user) {
        return { session: null, error: 'User not authenticated' }
      }

      const { data: session, error } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', date)
        .eq('template', template)
        .single()

      return { session, error }
    } catch (error) {
      return { session: null, error }
    }
  }

  async deleteSession(date: string, template: string): Promise<{ error: any }> {
    try {
      const { user } = authService.getState()
      if (!user) {
        return { error: 'User not authenticated' }
      }

      const { error } = await supabase
        .from('workout_sessions')
        .delete()
        .eq('user_id', user.id)
        .eq('date', date)
        .eq('template', template)

      return { error }
    } catch (error) {
      return { error }
    }
  }

  // Migration helper
  async migrateLocalStorageData(): Promise<{ success: boolean, error: any }> {
    try {
      const { user } = authService.getState()
      if (!user) {
        return { success: false, error: 'User not authenticated' }
      }

      // Check if already migrated
      const migrated = localStorage.getItem('workout-data-migrated')
      if (migrated) {
        return { success: true, error: null }
      }

      const migratedWorkouts = []

      // Migrate completed workouts
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith('workout-complete-')) {
          try {
            const workoutData = JSON.parse(localStorage.getItem(key) || '{}')

            // Transform localStorage format to database format
            const workout: WorkoutData = {
              date: workoutData.date,
              template: workoutData.template,
              template_name: workoutData.templateName || workoutData.template,
              completed_at: workoutData.completedAt,
              source: workoutData.source || 'manual'
            }

            const sets: WorkoutSetData[] = []
            Object.entries(workoutData.exercises || {}).forEach(([exercise, exerciseSets]: [string, any]) => {
              exerciseSets.forEach((set: any, setIndex: number) => {
                if (set.weight && set.reps) {
                  sets.push({
                    exercise,
                    set_number: setIndex + 1,
                    weight: parseFloat(set.weight),
                    reps: parseInt(set.reps),
                    notes: set.notes || ''
                  })
                }
              })
            })

            if (sets.length > 0) {
              const { workout: savedWorkout, error } = await this.createWorkout(workout, sets)
              if (!error) {
                migratedWorkouts.push(savedWorkout)
              }
            }
          } catch (error) {
            console.error('Error migrating workout:', key, error)
          }
        }
      }

      // Mark as migrated
      localStorage.setItem('workout-data-migrated', 'true')

      return { success: true, error: null }
    } catch (error) {
      return { success: false, error }
    }
  }

  // Helper function to transform sets array to exercises object
  private transformSetsToExercises(sets: any[]): { [exercise: string]: any[] } {
    const exercises: { [exercise: string]: any[] } = {}

    sets.forEach(set => {
      if (!exercises[set.exercise]) {
        exercises[set.exercise] = []
      }

      // Ensure array has enough slots
      while (exercises[set.exercise].length < set.set_number) {
        exercises[set.exercise].push({ weight: '', reps: '' })
      }

      exercises[set.exercise][set.set_number - 1] = {
        weight: set.weight.toString(),
        reps: set.reps.toString(),
        notes: set.notes || '',
        saved: true
      }
    })

    return exercises
  }
}

// Export singleton instance
export const databaseService = DatabaseService.getInstance()