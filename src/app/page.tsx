'use client'

import { useState, useEffect } from 'react'
import WorkoutTemplates from '@/components/WorkoutTemplates'
import WorkoutSession from '@/components/WorkoutSession'
import Settings from '@/components/Settings'
import ProgressView from '@/components/ProgressView'

type View = 'templates' | 'session' | 'history' | 'settings' | 'progress'

export default function HomePage() {
  const [currentView, setCurrentView] = useState<View>('templates')
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [workoutHistory, setWorkoutHistory] = useState<any[]>([])
  const [activeSession, setActiveSession] = useState<any>(null)
  const [showSessionWarning, setShowSessionWarning] = useState(false)
  const [pendingTemplate, setPendingTemplate] = useState<string | null>(null)

  useEffect(() => {
    checkForActiveSession()
    loadWorkoutHistory()
  }, [])

  const checkForActiveSession = () => {
    // Check for any active session
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith('session-')) {
        try {
          const sessionData = JSON.parse(localStorage.getItem(key) || '{}')
          setActiveSession(sessionData)
          return
        } catch (e) {
          console.error('Error parsing session:', e)
        }
      }
    }
  }

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

    workouts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    setWorkoutHistory(workouts)
  }

  const handleTemplateSelect = (template: string) => {
    if (activeSession && activeSession.template !== template) {
      setPendingTemplate(template)
      setShowSessionWarning(true)
      return
    }

    setSelectedTemplate(template)
    setCurrentView('session')
  }

  const handleResumeSession = () => {
    setSelectedTemplate(activeSession.template)
    setCurrentView('session')
    setShowSessionWarning(false)
    setPendingTemplate(null)
  }

  const handleDiscardSession = () => {
    const sessionKey = `session-${activeSession.date}-${activeSession.template}`
    localStorage.removeItem(sessionKey)
    setActiveSession(null)

    setSelectedTemplate(pendingTemplate)
    setCurrentView('session')
    setShowSessionWarning(false)
    setPendingTemplate(null)
  }

  const handleCancelSessionWarning = () => {
    setShowSessionWarning(false)
    setPendingTemplate(null)
  }

  const handleBack = () => {
    setSelectedTemplate(null)
    setCurrentView('templates')
    checkForActiveSession()
    loadWorkoutHistory()
  }

  // Session Warning Modal
  if (showSessionWarning) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded border border-gray-200 p-6 max-w-md w-full">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Active Session Detected</h2>
          <p className="text-gray-600 mb-6">
            You have an active <strong>{activeSession?.template}</strong> session from{' '}
            {activeSession?.date ? new Date(activeSession.date).toLocaleDateString() : 'today'}.
          </p>
          <div className="space-y-3">
            <button
              onClick={handleResumeSession}
              className="w-full py-2 bg-gray-900 text-white rounded hover:bg-black"
            >
              Resume Session
            </button>
            <button
              onClick={handleDiscardSession}
              className="w-full py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Discard & Start New
            </button>
            <button
              onClick={handleCancelSessionWarning}
              className="w-full py-2 border border-gray-300 rounded hover:bg-gray-50 text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
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

  if (currentView === 'progress') {
    return <ProgressView onBack={() => setCurrentView('templates')} />
  }

  if (currentView === 'history') {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => setCurrentView('templates')}
              className="text-blue-600 hover:text-blue-800"
            >
              ← Back
            </button>
            <h1 className="text-xl font-semibold">History</h1>
            <div className="w-12" />
          </div>

          {workoutHistory.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No workouts yet
            </div>
          ) : (
            <div className="space-y-3">
              {workoutHistory.map((workout, index) => (
                <div key={index} className="bg-white rounded-lg border p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-medium">{workout.templateName || workout.template}</h3>
                      <p className="text-sm text-gray-500">
                        {new Date(workout.date).toLocaleDateString()}
                      </p>
                    </div>
                    {workout.source && (
                      <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                        {workout.source}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 text-sm">
                    {Object.entries(workout.exercises).map(([exercise, sets]: [string, any]) => (
                      <div key={exercise}>
                        <span className="font-medium text-gray-700">{exercise}:</span>
                        <div className="ml-2 text-gray-600">
                          {sets.filter((set: any) => set.weight && set.reps).map((set: any, idx: number) => (
                            <span key={idx} className="inline-block mr-3">
                              {set.weight}×{set.reps}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Ultra-minimalistic main page
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Active session banner */}
      {activeSession && (
        <div className="bg-gray-100 border-b border-gray-200 p-3">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <div className="text-gray-700 text-sm">
              <span className="font-medium">Active:</span> {activeSession.template} • {new Date(activeSession.date).toLocaleDateString()}
            </div>
            <button
              onClick={() => handleTemplateSelect(activeSession.template)}
              className="text-gray-900 hover:text-black text-sm font-medium"
            >
              Resume →
            </button>
          </div>
        </div>
      )}

      <div className="p-4">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold mb-2 text-gray-900">Workout Tracker</h1>
            <p className="text-gray-600">Choose a template</p>
          </div>

          {/* Template Selection */}
          <WorkoutTemplates onSelectTemplate={handleTemplateSelect} />

          {/* Simple navigation */}
          <div className="grid grid-cols-3 gap-3 mt-8">
            <button
              onClick={() => setCurrentView('history')}
              className="py-3 bg-white border border-gray-200 rounded hover:bg-gray-50 text-center text-sm text-gray-900"
            >
              History
              <div className="text-xs text-gray-500 mt-1">{workoutHistory.length} workouts</div>
            </button>
            <button
              onClick={() => setCurrentView('progress')}
              className="py-3 bg-white border border-gray-200 rounded hover:bg-gray-50 text-center text-sm text-gray-900"
            >
              Progress
              <div className="text-xs text-gray-500 mt-1">analytics</div>
            </button>
            <button
              onClick={() => setCurrentView('settings')}
              className="py-3 bg-white border border-gray-200 rounded hover:bg-gray-50 text-center text-sm text-gray-900"
            >
              Settings
              <div className="text-xs text-gray-500 mt-1">sync & config</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}