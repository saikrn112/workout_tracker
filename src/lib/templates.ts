export interface WorkoutTemplate {
  name: string
  exercises: string[]
}

export const WORKOUT_TEMPLATES = {
  upper1: {
    name: 'Upper Body 1',
    exercises: [
      'Pec dec fly',
      'DB Incline bench press', 
      'DB lateral raises',
      'Lat pulldown (Moderate load)',
      'Flat bar cable curls',
      'Tricep pushdowns'
    ]
  },
  upper2: {
    name: 'Upper Body 2', 
    exercises: [
      'Flat bench press DB',
      'DB Seated shoulder press',
      'Pronated rows seated',
      'Rope pullovers',
      'Bicep hammer curls DB',
      'Tricep pushdowns'
    ]
  },
  lower1: {
    name: 'Lower Body 1',
    exercises: [
      'Hamstring curls lying',
      'Hip Thrust machine', 
      'DB Deadlifts',
      'Walking lunges bodyweight',
      'Calf raises seated',
      'Reverse Crunches'
    ]
  },
  lower2: {
    name: 'Lower Body 2',
    exercises: [
      'Adductors Machine',
      'Abductors Machine',
      'Leg extensions', 
      'Lying leg curls',
      'Walking lunges',
      'Reverse crunches'
    ]
  }
} as const

export type TemplateKey = keyof typeof WORKOUT_TEMPLATES