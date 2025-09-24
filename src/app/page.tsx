'use client'

import { useState, useEffect } from 'react'
import WorkoutTemplates from '@/components/WorkoutTemplates'
import WorkoutSession from '@/components/WorkoutSession'
import Settings from '@/components/Settings'
import { supabase } from '@/lib/supabase'

type View = 'templates' | 'session' | 'history' | 'settings'

export default function HomePage() {
  const [currentView, setCurrentView] = useState<View>('templates')
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [workoutHistory, setWorkoutHistory] = useState<any[]>([])
  const [session, setSession] = useState<any>(null)

  useEffect(() => {
    loadWorkoutHistory()
    // TODO: Set up auth listener when Supabase is configured
    // supabase.auth.getSession().then(({ data: { session } }) => {
    //   setSession(session)
    // })

    // const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    //   setSession(session)
    // })

    // return () => subscription.unsubscribe()
  }, [])

  const loadWorkoutHistory = () => {
    const workouts = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith('workout-complete-')) {
        try {
          const workout = JSON.parse(localStorage.getItem(key) || '{}')
          workouts.push(workout)
        } catch (e) {
          console.error('Error parsing workout:', e)
        }
      }
    }

    // Sort by date descending (most recent first)
    workouts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    setWorkoutHistory(workouts)
  }

  const handleTemplateSelect = (template: string) => {
    setSelectedTemplate(template)
    setCurrentView('session')
  }

  const handleBack = () => {
    setSelectedTemplate(null)
    setCurrentView('templates')
    // Reload history in case new workouts were added
    loadWorkoutHistory()
  }

  const getTotalWorkouts = () => workoutHistory.length
  const getThisWeekWorkouts = () => {
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    return workoutHistory.filter(w => new Date(w.date) >= weekAgo).length
  }

  const getActiveSessions = () => {
    let count = 0
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith('session-')) count++
    }
    return count
  }

  if (currentView === 'session' && selectedTemplate) {
    return (
      <WorkoutSession
        template={selectedTemplate}
        onBack={handleBack}
      />
    )
  }

  if (currentView === 'settings') {
    return <Settings onBack={() => setCurrentView('templates')} />
  }

  if (currentView === 'history') {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => setCurrentView('templates')}
            className="text-blue-600 hover:text-blue-800"
          >
            ← Back
          </button>
          <h1 className="text-2xl font-bold">Workout History</h1>
          <div className="w-12" />
        </div>

        {workoutHistory.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No workout history found. Complete some workouts to see them here!
          </div>
        ) : (
          <div className="space-y-4">
            {workoutHistory.map((workout, index) => (
              <div key={index} className="bg-white rounded-lg border p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold">{workout.templateName || workout.template}</h3>
                    <p className="text-sm text-gray-600">
                      {new Date(workout.date).toLocaleDateString()}
                    </p>
                  </div>
                  {workout.source && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {workout.source}
                    </span>
                  )}
                </div>

                <div className="text-sm text-gray-700">
                  {Object.entries(workout.exercises).map(([exercise, sets]: [string, any]) => (
                    <div key={exercise} className="mb-1">
                      <span className="font-medium">{exercise}:</span>{' '}
                      {sets.filter((set: any) => set.weight && set.reps).map((set: any, idx: number) => (
                        <span key={idx} className="inline-block mr-2">
                          {set.weight}lbs×{set.reps}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">🏋️ Workout Tracker</h1>
        <p className="text-gray-600">
          Choose a workout template to get started
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{getTotalWorkouts()}</div>
          <div className="text-sm text-gray-600">Total Workouts</div>
        </div>
        <div className="bg-white border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{getThisWeekWorkouts()}</div>
          <div className="text-sm text-gray-600">This Week</div>
        </div>
        <div className="bg-white border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-orange-600">{getActiveSessions()}</div>
          <div className="text-sm text-gray-600">Active Sessions</div>
        </div>
      </div>

      {/* Template Selection */}
      <WorkoutTemplates onSelectTemplate={handleTemplateSelect} />

      {/* Navigation */}
      <div className="flex gap-4 mt-8">
        <button
          onClick={() => setCurrentView('history')}
          className="flex-1 py-3 bg-white border rounded-lg hover:bg-gray-50 transition-colors"
        >
          📊 View History
        </button>
        <button
          onClick={() => setCurrentView('settings')}
          className="flex-1 py-3 bg-white border rounded-lg hover:bg-gray-50 transition-colors"
        >
          ⚙️ Settings
        </button>
      </div>
    </div>
  )
}