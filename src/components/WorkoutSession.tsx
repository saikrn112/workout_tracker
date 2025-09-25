'use client'

import { useState, useEffect } from 'react'
import { WORKOUT_TEMPLATES } from '@/lib/templates'

interface WorkoutSessionProps {
  template: string
  onBack: () => void
}

interface SetData {
  weight: string
  reps: string
  saved?: boolean
  savedAt?: string
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
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [savingWorkout, setSavingWorkout] = useState(false)

  const templateData = WORKOUT_TEMPLATES[template as keyof typeof WORKOUT_TEMPLATES]
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    if (templateData) {
      loadSession()
    }
  }, [template, templateData])

  const loadSession = async () => {
    const sessionKey = `session-${today}-${template}`
    const existingSession = localStorage.getItem(sessionKey)

    if (existingSession) {
      const sessionData = JSON.parse(existingSession)
      setSessionId(sessionData.id)
      setExerciseData(sessionData.exercises)
    } else {
      const newSessionId = `${Date.now()}-${template}`
      setSessionId(newSessionId)

      const initialData: ExerciseData = {}
      templateData.exercises.forEach(exercise => {
        initialData[exercise] = [{ weight: '', reps: '', saved: false }]
      })
      setExerciseData(initialData)
    }

    await loadPreviousWorkout()
  }

  const loadPreviousWorkout = async () => {
    try {
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

  const updateSet = (exercise: string, setIndex: number, field: 'weight' | 'reps', value: string) => {
    setExerciseData(prev => {
      const updated = {
        ...prev,
        [exercise]: prev[exercise].map((set, idx) =>
          idx === setIndex
            ? { ...set, [field]: value, saved: true, savedAt: new Date().toISOString() }
            : set
        )
      }

      // Auto-save session and progress tracking
      setTimeout(() => {
        saveSession()

        // Auto-save individual set progress if both weight and reps are filled
        const set = updated[exercise][setIndex]
        if (set.weight.trim() && set.reps.trim()) {
          const progressKey = `progress-${exercise}-${today}`
          const existingProgress = JSON.parse(localStorage.getItem(progressKey) || '[]')

          // Remove any existing entry for this set to avoid duplicates
          const filteredProgress = existingProgress.filter((p: any) => p.setNumber !== setIndex + 1)

          filteredProgress.push({
            weight: parseFloat(set.weight),
            reps: parseInt(set.reps),
            setNumber: setIndex + 1,
            timestamp: new Date().toISOString(),
            template
          })
          localStorage.setItem(progressKey, JSON.stringify(filteredProgress))
        }
      }, 200)

      return updated
    })
  }

  const addSet = (exercise: string) => {
    setExerciseData(prev => ({
      ...prev,
      [exercise]: [...prev[exercise], { weight: '', reps: '', saved: false }]
    }))
  }

  const removeSet = (exercise: string, setIndex: number) => {
    setExerciseData(prev => ({
      ...prev,
      [exercise]: prev[exercise].filter((_, idx) => idx !== setIndex)
    }))
  }


  const saveCompleteWorkout = async () => {
    const hasValidData = Object.values(exerciseData).some(sets =>
      sets.some(set => set.weight.trim() && set.reps.trim())
    )

    if (!hasValidData) {
      alert('Please add at least one set before saving the workout')
      return
    }

    setSavingWorkout(true)

    try {
      const workoutData = {
        id: sessionId,
        date: today,
        template,
        templateName: templateData.name,
        exercises: exerciseData,
        completedAt: new Date().toISOString(),
        source: 'manual'
      }

      // Save completed workout
      localStorage.setItem(`workout-complete-${today}-${template}`, JSON.stringify(workoutData))

      // Clear the session
      localStorage.removeItem(`session-${today}-${template}`)

      onBack()
    } catch (error) {
      alert('Error saving workout')
      console.error(error)
    } finally {
      setSavingWorkout(false)
    }
  }

  const getPreviousSetData = (exercise: string, setIndex: number) => {
    if (!previousWorkout?.exercises[exercise]?.[setIndex]) return null
    const prevSet = previousWorkout.exercises[exercise][setIndex]
    return `${prevSet.weight}×${prevSet.reps}`
  }

  const getExerciseProgress = (exercise: string) => {
    const sets = exerciseData[exercise] || []
    const completedSets = sets.filter(set => set.weight.trim() && set.reps.trim())
    return completedSets.length > 0 ? `${completedSets.length} sets` : 'no sets'
  }

  if (!templateData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-500">Loading template...</div>
          <button onClick={onBack} className="mt-4 text-blue-600 hover:text-blue-800">
            ← Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            onClick={onBack}
            className="text-gray-600 hover:text-gray-800"
          >
            ← Back
          </button>
          <div className="text-center">
            <h1 className="text-lg font-semibold text-gray-900">{templateData.name}</h1>
            <div className="text-sm text-gray-500">{new Date().toLocaleDateString()}</div>
          </div>
          <div className="w-12" />
        </div>
      </div>

      {/* Previous workout reference */}
      {previousWorkout && (
        <div className="bg-gray-100 border-b border-gray-200 p-3">
          <div className="max-w-2xl mx-auto text-center text-sm text-gray-600">
            Last {template}: {new Date(previousWorkout.date).toLocaleDateString()}
          </div>
        </div>
      )}

      <div className="p-4">
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Exercises */}
          {templateData.exercises.map((exercise) => (
            <div key={exercise} className="bg-white rounded border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-900">{exercise}</h3>
                <span className="text-xs text-gray-500">
                  {getExerciseProgress(exercise)}
                </span>
              </div>

              {/* Sets */}
              <div className="space-y-3">
                {exerciseData[exercise]?.map((set, setIndex) => (
                  <div key={setIndex} className="flex gap-3 items-center">
                    <span className="w-6 text-sm font-medium text-gray-700">#{setIndex + 1}</span>

                    <input
                      type="number"
                      placeholder="lbs"
                      value={set.weight}
                      onChange={(e) => updateSet(exercise, setIndex, 'weight', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 text-gray-900 bg-white"
                    />

                    <span className="text-sm text-gray-400">×</span>

                    <input
                      type="number"
                      placeholder="reps"
                      value={set.reps}
                      onChange={(e) => updateSet(exercise, setIndex, 'reps', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 text-gray-900 bg-white"
                    />

                    {/* Previous reference */}
                    {getPreviousSetData(exercise, setIndex) && (
                      <span className="text-xs text-gray-400 w-20 text-center">
                        ({getPreviousSetData(exercise, setIndex)})
                      </span>
                    )}

                    {/* Auto-saved indicator */}
                    {set.saved && set.weight && set.reps && (
                      <span className="text-xs text-gray-400">✓</span>
                    )}

                    {/* Remove set */}
                    {exerciseData[exercise].length > 1 && (
                      <button
                        onClick={() => removeSet(exercise, setIndex)}
                        className="text-gray-400 hover:text-gray-600 px-1 ml-1"
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
                className="mt-3 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded"
              >
                + Add Set
              </button>
            </div>
          ))}

          {/* Complete Workout Button */}
          <button
            onClick={saveCompleteWorkout}
            disabled={savingWorkout}
            className="w-full py-4 bg-gray-900 hover:bg-black disabled:bg-gray-300 text-white font-medium rounded"
          >
            {savingWorkout ? 'Finishing...' : 'Complete Workout & Finish Session'}
          </button>

          {/* Session info */}
          {sessionId && (
            <div className="text-center text-xs text-gray-400 mt-6">
              All changes auto-saved
            </div>
          )}
        </div>
      </div>
    </div>
  )
}