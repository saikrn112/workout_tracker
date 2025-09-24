'use client'

import { useState, useEffect } from 'react'
import WorkoutTemplates from '@/components/WorkoutTemplates'
import WorkoutSession from '@/components/WorkoutSession'
import { supabase } from '@/lib/supabase'

export default function HomePage() {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [session, setSession] = useState<any>(null)

  useEffect(() => {
    // TODO: Set up auth listener when Supabase is configured
    // supabase.auth.getSession().then(({ data: { session } }) => {
    //   setSession(session)
    // })

    // const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    //   setSession(session)
    // })

    // return () => subscription.unsubscribe()
  }, [])

  if (selectedTemplate) {
    return (
      <WorkoutSession
        template={selectedTemplate}
        onBack={() => setSelectedTemplate(null)}
      />
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">🏋️ Workout Tracker</h1>
        <p className="text-muted-foreground">
          Choose a workout template to get started
        </p>
      </div>
      <WorkoutTemplates onSelectTemplate={setSelectedTemplate} />
    </div>
  )
}