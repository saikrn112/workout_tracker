'use client'

import { WORKOUT_TEMPLATES, TemplateKey } from '@/lib/templates'

interface WorkoutTemplatesProps {
  onSelectTemplate: (template: string) => void
}

export default function WorkoutTemplates({ onSelectTemplate }: WorkoutTemplatesProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {Object.entries(WORKOUT_TEMPLATES).map(([key, template]) => (
        <button
          key={key}
          onClick={() => onSelectTemplate(key)}
          className="bg-white border border-gray-200 rounded p-4 text-left hover:border-gray-400 hover:bg-gray-50 transition-colors"
        >
          <h3 className="font-semibold text-gray-900 mb-2">{template.name}</h3>
          <p className="text-sm text-gray-600">
            {template.exercises.length} exercises
          </p>
          <div className="mt-2 text-xs text-gray-500">
            {template.exercises.slice(0, 2).join(', ')}
            {template.exercises.length > 2 && '...'}
          </div>
        </button>
      ))}
    </div>
  )
}