'use client'

import { useState, useEffect } from 'react'
import { WORKOUT_TEMPLATES } from '@/lib/templates'
import { supabase } from '@/lib/supabase'

interface WorkoutSessionProps {
  template: string
  onBack: () => void
}

interface SetData {
  weight: string
  reps: string
}

interface ExerciseData {
  [key: string]: SetData[]
}

interface PreviousWorkout {
  date: string
  exercises: {
    [exercise: string]: SetData[]
  }
}

export default function WorkoutSession({ template, onBack }: WorkoutSessionProps) {
  const [exerciseData, setExerciseData] = useState<ExerciseData>({})
  const [previousWorkout, setPreviousWorkout] = useState<PreviousWorkout | null>(null)
  const [saving, setSaving] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [todayWorkout, setTodayWorkout] = useState<any>(null)

  const templateData = WORKOUT_TEMPLATES[template as keyof typeof WORKOUT_TEMPLATES]
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    loadSession()
  }, [template])

  const loadSession = async () => {
    // Check if there's already a workout session for today
    const todaySession = localStorage.getItem(`session-${today}-${template}`)

    if (todaySession) {
      // Resume existing session
      const sessionData = JSON.parse(todaySession)
      setSessionId(sessionData.id)
      setExerciseData(sessionData.exercises)
      setTodayWorkout(sessionData)
    } else {
      // Create new session
      const newSessionId = `${Date.now()}-${template}`
      setSessionId(newSessionId)

      // Initialize with empty sets
      const initialData: ExerciseData = {}
      templateData.exercises.forEach(exercise => {
        initialData[exercise] = [{ weight: '', reps: '' }]
      })
      setExerciseData(initialData)
    }

    // Load most recent previous workout for reference
    await loadPreviousWorkout()
  }

  const loadPreviousWorkout = async () => {
    try {
      // Get all workouts for this template, excluding today
      const allWorkouts = getAllStoredWorkouts()
      const templateWorkouts = allWorkouts
        .filter(w => w.template === template && w.date !== today)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

      if (templateWorkouts.length > 0) {
        setPreviousWorkout(templateWorkouts[0])
      }
    } catch (error) {
      console.error('Error loading previous workout:', error)
    }
  }

  const getAllStoredWorkouts = () => {
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
    return workouts
  }

  const saveSession = () => {
    if (sessionId) {
      const sessionData = {
        id: sessionId,
        date: today,
        template,
        exercises: exerciseData,
        lastSaved: new Date().toISOString()
      }
      localStorage.setItem(`session-${today}-${template}`, JSON.stringify(sessionData))
    }
  }

  const addSet = (exercise: string) => {
    setExerciseData(prev => {
      const updated = {
        ...prev,
        [exercise]: [...prev[exercise], { weight: '', reps: '' }]
      }
      return updated
    })
  }

  const removeSet = (exercise: string, setIndex: number) => {
    setExerciseData(prev => {
      const updated = {
        ...prev,
        [exercise]: prev[exercise].filter((_, idx) => idx !== setIndex)
      }
      return updated
    })
  }

  const updateSet = (exercise: string, setIndex: number, field: 'weight' | 'reps', value: string) => {
    setExerciseData(prev => {
      const updated = {
        ...prev,
        [exercise]: prev[exercise].map((set, idx) =>
          idx === setIndex ? { ...set, [field]: value } : set
        )
      }
      // Auto-save session when data changes
      setTimeout(() => saveSession(), 100)
      return updated
    })
  }

  const hasValidSets = () => {
    return Object.values(exerciseData).some(sets =>
      sets.some(set => set.weight.trim() !== '' && set.reps.trim() !== '')
    )
  }

  const saveWorkout = async () => {
    if (!hasValidSets()) {
      alert('Please add at least one set with weight and reps before saving.')
      return
    }

    setSaving(true)

    try {
      const workoutData = {
        id: sessionId,
        date: today,
        template,
        templateName: templateData.name,
        exercises: exerciseData,
        completedAt: new Date().toISOString()
      }

      // Save completed workout
      localStorage.setItem(`workout-complete-${today}-${template}`, JSON.stringify(workoutData))

      // Clear the session
      localStorage.removeItem(`session-${today}-${template}`)

      alert('Workout saved successfully!')
      onBack()
    } catch (error) {
      alert('Error saving workout')
      console.error(error)
    } finally {
      setSaving(false)
    }
  }

  const getPreviousSetData = (exercise: string, setIndex: number) => {
    if (!previousWorkout?.exercises[exercise]?.[setIndex]) return null
    const prevSet = previousWorkout.exercises[exercise][setIndex]
    return `${prevSet.weight}lbs × ${prevSet.reps}`
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="text-blue-600 hover:text-blue-800"
        >
          ← Back
        </button>
        <h1 className="text-2xl font-bold">{templateData.name}</h1>
        <div className="w-12" />
      </div>

      {/* Session Info */}
      <div className="text-center mb-6">
        <div className="text-lg font-medium text-gray-900">{new Date().toLocaleDateString()}</div>
        {sessionId && (
          <div className="text-sm text-gray-500">
            {todayWorkout ? 'Resuming session' : 'New session'} • Auto-saving
          </div>
        )}
        {previousWorkout && (
          <div className="text-sm text-blue-600 mt-1">
            Last {template}: {new Date(previousWorkout.date).toLocaleDateString()}
          </div>
        )}
      </div>

      {/* Exercises */}
      <div className="space-y-6">
        {templateData.exercises.map((exercise) => (
          <div key={exercise} className="bg-white rounded-lg border p-4">
            <h3 className="font-semibold mb-3">{exercise}</h3>

            {/* Previous workout data */}
            {previousWorkout?.exercises[exercise] && (
              <div className="mb-3 p-2 bg-blue-50 rounded text-sm">
                <div className="font-medium text-blue-800 mb-1">
                  Previous ({new Date(previousWorkout.date).toLocaleDateString()}):
                </div>
                <div className="text-blue-700">
                  {previousWorkout.exercises[exercise].map((set, idx) => (
                    <span key={idx} className="inline-block mr-3">
                      Set {idx + 1}: {set.weight}lbs × {set.reps}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Current sets */}
            <div className="space-y-2">
              {exerciseData[exercise]?.map((set, setIndex) => (
                <div key={setIndex} className="flex gap-2 items-center">
                  <span className="w-8 text-sm font-medium">#{setIndex + 1}</span>

                  <input
                    type="number"
                    placeholder="Weight"
                    value={set.weight}
                    onChange={(e) => updateSet(exercise, setIndex, 'weight', e.target.value)}
                    className="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-500">lbs</span>

                  <input
                    type="number"
                    placeholder="Reps"
                    value={set.reps}
                    onChange={(e) => updateSet(exercise, setIndex, 'reps', e.target.value)}
                    className="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-500">reps</span>

                  {/* Previous set reference */}
                  {getPreviousSetData(exercise, setIndex) && (
                    <span className="text-xs text-gray-400 min-w-0 flex-shrink">
                      (was: {getPreviousSetData(exercise, setIndex)})
                    </span>
                  )}

                  {/* Remove set button */}
                  {exerciseData[exercise].length > 1 && (
                    <button
                      onClick={() => removeSet(exercise, setIndex)}
                      className="text-red-500 hover:text-red-700 px-1"
                      title="Remove set"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Add Set Button */}
            <button
              onClick={() => addSet(exercise)}
              className="mt-3 px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
            >
              + Add Set
            </button>
          </div>
        ))}
      </div>

      {/* Save Button */}
      <button
        onClick={saveWorkout}
        disabled={saving || !hasValidSets()}
        className="w-full mt-8 py-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors"
      >
        {saving ? 'Saving...' : hasValidSets() ? 'Complete Workout' : 'Add sets to save workout'}
      </button>

      {/* Session status */}
      {sessionId && (
        <div className="text-center mt-4 text-sm text-gray-500">
          Session: {sessionId} • Changes auto-saved
        </div>
      )}
    </div>
  )
}