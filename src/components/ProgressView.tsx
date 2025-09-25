'use client'

import { useState, useEffect } from 'react'

interface ProgressViewProps {
  onBack: () => void
}

interface WorkoutData {
  date: string
  template: string
  templateName: string
  exercises: {
    [exercise: string]: {
      weight: string
      reps: string
    }[]
  }
}

interface ExerciseProgress {
  exercise: string
  dates: string[]
  maxWeight: number
  totalVolume: number
  lastPerformed: string
  progression: {
    date: string
    weight: number
    reps: number
    volume: number
  }[]
}

export default function ProgressView({ onBack }: ProgressViewProps) {
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutData[]>([])
  const [exerciseProgress, setExerciseProgress] = useState<ExerciseProgress[]>([])
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null)
  const [timeframe, setTimeframe] = useState<'week' | 'month' | 'all'>('month')

  useEffect(() => {
    loadWorkoutData()
  }, [])

  useEffect(() => {
    if (workoutHistory.length > 0) {
      calculateExerciseProgress()
    }
  }, [workoutHistory, timeframe])

  const loadWorkoutData = () => {
    const workouts: WorkoutData[] = []
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

    workouts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    setWorkoutHistory(workouts)
  }

  const calculateExerciseProgress = () => {
    const cutoffDate = getCutoffDate()
    const filteredWorkouts = workoutHistory.filter(w =>
      !cutoffDate || new Date(w.date) >= cutoffDate
    )

    const exerciseMap: { [exercise: string]: ExerciseProgress } = {}

    filteredWorkouts.forEach(workout => {
      Object.entries(workout.exercises).forEach(([exercise, sets]) => {
        if (!exerciseMap[exercise]) {
          exerciseMap[exercise] = {
            exercise,
            dates: [],
            maxWeight: 0,
            totalVolume: 0,
            lastPerformed: workout.date,
            progression: []
          }
        }

        const exerciseData = exerciseMap[exercise]
        if (!exerciseData.dates.includes(workout.date)) {
          exerciseData.dates.push(workout.date)
        }

        if (new Date(workout.date) > new Date(exerciseData.lastPerformed)) {
          exerciseData.lastPerformed = workout.date
        }

        sets.forEach((set, idx) => {
          const weight = parseFloat(set.weight) || 0
          const reps = parseInt(set.reps) || 0
          const volume = weight * reps

          if (weight > exerciseData.maxWeight) {
            exerciseData.maxWeight = weight
          }

          exerciseData.totalVolume += volume

          exerciseData.progression.push({
            date: workout.date,
            weight,
            reps,
            volume
          })
        })
      })
    })

    // Sort progression by date and calculate trends
    Object.values(exerciseMap).forEach(exercise => {
      exercise.progression.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      exercise.dates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
    })

    const sortedExercises = Object.values(exerciseMap)
      .sort((a, b) => new Date(b.lastPerformed).getTime() - new Date(a.lastPerformed).getTime())

    setExerciseProgress(sortedExercises)
  }

  const getCutoffDate = (): Date | null => {
    const now = new Date()
    switch (timeframe) {
      case 'week':
        const weekAgo = new Date(now)
        weekAgo.setDate(weekAgo.getDate() - 7)
        return weekAgo
      case 'month':
        const monthAgo = new Date(now)
        monthAgo.setMonth(monthAgo.getMonth() - 1)
        return monthAgo
      case 'all':
      default:
        return null
    }
  }

  const getProgressTrend = (exercise: ExerciseProgress) => {
    if (exercise.progression.length < 2) return 'stable'

    const recent = exercise.progression.slice(-3)
    const avgRecentVolume = recent.reduce((sum, p) => sum + p.volume, 0) / recent.length

    const older = exercise.progression.slice(-6, -3)
    if (older.length === 0) return 'stable'

    const avgOlderVolume = older.reduce((sum, p) => sum + p.volume, 0) / older.length

    const change = (avgRecentVolume - avgOlderVolume) / avgOlderVolume

    if (change > 0.05) return 'improving'
    if (change < -0.05) return 'declining'
    return 'stable'
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return '📈'
      case 'declining': return '📉'
      case 'stable': return '➡️'
      default: return '➡️'
    }
  }

  const getSelectedExerciseData = () => {
    return exerciseProgress.find(e => e.exercise === selectedExercise)
  }

  if (selectedExercise) {
    const exerciseData = getSelectedExerciseData()
    if (!exerciseData) return null

    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => setSelectedExercise(null)}
              className="text-blue-600 hover:text-blue-800"
            >
              ← Back to Progress
            </button>
            <h1 className="text-lg font-semibold">{exerciseData.exercise}</h1>
            <div className="w-12" />
          </div>

          {/* Exercise Stats */}
          <div className="bg-white rounded-lg border p-4 mb-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-lg font-bold text-blue-600">{exerciseData.maxWeight}</div>
                <div className="text-sm text-gray-600">Max Weight (lbs)</div>
              </div>
              <div>
                <div className="text-lg font-bold text-green-600">{exerciseData.dates.length}</div>
                <div className="text-sm text-gray-600">Sessions</div>
              </div>
              <div>
                <div className="text-lg font-bold text-purple-600">
                  {Math.round(exerciseData.totalVolume)}
                </div>
                <div className="text-sm text-gray-600">Total Volume</div>
              </div>
            </div>
          </div>

          {/* Recent Sessions */}
          <div className="bg-white rounded-lg border p-4">
            <h3 className="font-medium mb-3">Recent Sessions</h3>
            <div className="space-y-2">
              {exerciseData.dates.slice(0, 10).map(date => {
                const sessionSets = exerciseData.progression.filter(p => p.date === date)
                return (
                  <div key={date} className="border-b border-gray-100 pb-2">
                    <div className="flex justify-between items-start">
                      <div className="font-medium text-sm">
                        {new Date(date).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        {sessionSets.length} sets
                      </div>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {sessionSets.map((set, idx) => (
                        <span key={idx} className="text-sm bg-gray-100 px-2 py-1 rounded">
                          {set.weight}×{set.reps}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onBack}
            className="text-blue-600 hover:text-blue-800"
          >
            ← Back
          </button>
          <h1 className="text-lg font-semibold">Progress Tracking</h1>
          <div className="w-12" />
        </div>

        {/* Timeframe Filter */}
        <div className="bg-white rounded-lg border p-3 mb-4">
          <div className="flex gap-2">
            {(['week', 'month', 'all'] as const).map(period => (
              <button
                key={period}
                onClick={() => setTimeframe(period)}
                className={`px-3 py-1 text-sm rounded ${
                  timeframe === period
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                {period === 'all' ? 'All Time' : `Last ${period}`}
              </button>
            ))}
          </div>
        </div>

        {exerciseProgress.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No workout data found for the selected timeframe
          </div>
        ) : (
          <div className="space-y-3">
            {exerciseProgress.map(exercise => {
              const trend = getProgressTrend(exercise)
              return (
                <button
                  key={exercise.exercise}
                  onClick={() => setSelectedExercise(exercise.exercise)}
                  className="w-full bg-white rounded-lg border p-4 text-left hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium">{exercise.exercise}</h3>
                    <span className="text-lg">{getTrendIcon(trend)}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm text-gray-600">
                    <div>
                      <span className="font-medium">{exercise.maxWeight}</span> lbs max
                    </div>
                    <div>
                      <span className="font-medium">{exercise.dates.length}</span> sessions
                    </div>
                    <div>
                      <span className="font-medium">
                        {new Date(exercise.lastPerformed).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-gray-500">
                    Volume: {Math.round(exercise.totalVolume)} lbs •
                    Trend: <span className={`
                      ${trend === 'improving' ? 'text-green-600' : ''}
                      ${trend === 'declining' ? 'text-red-600' : ''}
                      ${trend === 'stable' ? 'text-gray-600' : ''}
                    `}>
                      {trend}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}