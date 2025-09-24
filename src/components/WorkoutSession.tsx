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

export default function WorkoutSession({ template, onBack }: WorkoutSessionProps) {
  const [exerciseData, setExerciseData] = useState<ExerciseData>({})
  const [previousData, setPreviousData] = useState<any>({})
  const [saving, setSaving] = useState(false)

  const templateData = WORKOUT_TEMPLATES[template as keyof typeof WORKOUT_TEMPLATES]

  useEffect(() => {
    // Initialize exercise data with one empty set per exercise
    const initialData: ExerciseData = {}
    templateData.exercises.forEach(exercise => {
      initialData[exercise] = [{ weight: '', reps: '' }]
    })
    setExerciseData(initialData)

    // Load previous workout data (mock for now - will be real Supabase data later)
    loadPreviousData()
  }, [template])

  const loadPreviousData = async () => {
    // TODO: Load from Supabase
    // For now, use localStorage as temporary storage
    const stored = localStorage.getItem(`workout-${template}`)
    if (stored) {
      setPreviousData(JSON.parse(stored))
    }
  }

  const addSet = (exercise: string) => {
    setExerciseData(prev => ({
      ...prev,
      [exercise]: [...prev[exercise], { weight: '', reps: '' }]
    }))
  }

  const updateSet = (exercise: string, setIndex: number, field: 'weight' | 'reps', value: string) => {
    setExerciseData(prev => ({
      ...prev,
      [exercise]: prev[exercise].map((set, idx) =>
        idx === setIndex ? { ...set, [field]: value } : set
      )
    }))
  }

  const saveWorkout = async () => {
    setSaving(true)

    try {
      // For now, save to localStorage (will be Supabase later)
      const workoutData = {
        date: new Date().toISOString().split('T')[0],
        template,
        exercises: exerciseData
      }

      localStorage.setItem(`workout-${template}`, JSON.stringify(workoutData))
      localStorage.setItem('last-workout', JSON.stringify(workoutData))

      alert('Workout saved successfully!')
      onBack()
    } catch (error) {
      alert('Error saving workout')
      console.error(error)
    } finally {
      setSaving(false)
    }
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

      {/* Date */}
      <div className="text-center mb-6 text-gray-600">
        {new Date().toLocaleDateString()}
      </div>

      {/* Exercises */}
      <div className="space-y-6">
        {templateData.exercises.map((exercise) => (
          <div key={exercise} className="bg-white rounded-lg border p-4">
            <h3 className="font-semibold mb-3">{exercise}</h3>

            {/* Previous data */}
            {previousData[exercise] && (
              <div className="mb-3 p-2 bg-gray-100 rounded text-sm text-gray-600">
                <strong>Previous:</strong> {previousData[exercise].weight}lbs × {previousData[exercise].reps} reps
              </div>
            )}

            {/* Current sets */}
            <div className="space-y-2">
              {exerciseData[exercise]?.map((set, setIndex) => (
                <div key={setIndex} className="flex gap-3 items-center">
                  <span className="w-8 text-sm font-medium">#{setIndex + 1}</span>
                  <input
                    type="number"
                    placeholder="Weight"
                    value={set.weight}
                    onChange={(e) => updateSet(exercise, setIndex, 'weight', e.target.value)}
                    className="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-500">lbs</span>
                  <input
                    type="number"
                    placeholder="Reps"
                    value={set.reps}
                    onChange={(e) => updateSet(exercise, setIndex, 'reps', e.target.value)}
                    className="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-500">reps</span>
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
        disabled={saving}
        className="w-full mt-8 py-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors"
      >
        {saving ? 'Saving...' : 'Save Workout'}
      </button>
    </div>
  )
}