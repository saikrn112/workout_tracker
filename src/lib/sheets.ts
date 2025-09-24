// Google Sheets integration service
// This handles reading ground truth data from Google Sheets and syncing to database

interface GoogleConfig {
  clientId: string
  apiKey: string
  spreadsheetId: string
}

interface SheetWorkout {
  date: string
  template: string
  exercise: string
  setNumber: number
  weight: number
  reps: number
  notes?: string
}

export class SheetsService {
  private config: GoogleConfig | null = null
  private gapi: any = null
  private initialized = false

  constructor() {
    // Load config from environment or localStorage
    this.loadConfig()
  }

  private loadConfig() {
    // Try to load from environment first
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY
    const spreadsheetId = process.env.NEXT_PUBLIC_SPREADSHEET_ID

    if (clientId && apiKey && spreadsheetId) {
      this.config = { clientId, apiKey, spreadsheetId }
      return
    }

    // Fall back to localStorage for development
    const storedConfig = localStorage.getItem('googleSheetsConfig')
    if (storedConfig) {
      try {
        this.config = JSON.parse(storedConfig)
      } catch (e) {
        console.error('Error parsing stored Google config:', e)
      }
    }
  }

  async initialize(): Promise<boolean> {
    if (this.initialized) return true
    if (!this.config) {
      console.log('Google Sheets config not found - running in offline mode')
      return false
    }

    try {
      // Load Google API
      if (typeof window === 'undefined') return false

      await this.loadGoogleAPI()

      await (window as any).gapi.load('client:auth2', async () => {
        await (window as any).gapi.client.init({
          apiKey: this.config!.apiKey,
          clientId: this.config!.clientId,
          discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4'],
          scope: 'https://www.googleapis.com/auth/spreadsheets.readonly'
        })
      })

      this.initialized = true
      console.log('Google Sheets service initialized')
      return true
    } catch (error) {
      console.error('Failed to initialize Google Sheets service:', error)
      return false
    }
  }

  private loadGoogleAPI(): Promise<void> {
    return new Promise((resolve, reject) => {
      if ((window as any).gapi) {
        resolve()
        return
      }

      const script = document.createElement('script')
      script.src = 'https://apis.google.com/js/api.js'
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Failed to load Google API'))
      document.head.appendChild(script)
    })
  }

  async authenticate(): Promise<boolean> {
    if (!this.initialized) {
      const initResult = await this.initialize()
      if (!initResult) return false
    }

    try {
      const authInstance = (window as any).gapi.auth2.getAuthInstance()
      const user = authInstance.currentUser.get()

      if (!user.isSignedIn()) {
        await authInstance.signIn()
      }

      return true
    } catch (error) {
      console.error('Authentication failed:', error)
      return false
    }
  }

  async fetchWorkoutData(): Promise<SheetWorkout[]> {
    if (!await this.authenticate()) {
      throw new Error('Failed to authenticate with Google Sheets')
    }

    try {
      const response = await (window as any).gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: this.config!.spreadsheetId,
        range: 'raw!A:H', // Adjust range based on your sheet structure
      })

      const rows = response.result.values || []
      if (rows.length === 0) return []

      // Skip header row
      const dataRows = rows.slice(1)

      return dataRows.map((row: any[], index: number) => {
        // Adjust column mapping based on your sheet structure
        // Assuming: Date, Template, Exercise, Set, Weight, Reps, Notes
        return {
          date: this.parseDate(row[0] || ''),
          template: this.normalizeTemplate(row[1] || ''),
          exercise: row[2] || '',
          setNumber: parseInt(row[3] || '1'),
          weight: parseFloat(row[4] || '0'),
          reps: parseInt(row[5] || '0'),
          notes: row[6] || ''
        }
      }).filter(workout =>
        workout.date &&
        workout.template &&
        workout.exercise &&
        workout.weight > 0 &&
        workout.reps > 0
      )
    } catch (error) {
      console.error('Failed to fetch workout data:', error)
      throw error
    }
  }

  private parseDate(dateStr: string): string {
    // Handle various date formats from Google Sheets
    if (!dateStr) return ''

    try {
      const date = new Date(dateStr)
      if (isNaN(date.getTime())) return ''
      return date.toISOString().split('T')[0]
    } catch {
      return ''
    }
  }

  private normalizeTemplate(template: string): string {
    // Normalize template names to match our app's format
    const normalized = template.toLowerCase().trim()

    if (normalized.includes('upper') && (normalized.includes('1') || normalized.includes('one'))) {
      return 'upper1'
    }
    if (normalized.includes('upper') && (normalized.includes('2') || normalized.includes('two'))) {
      return 'upper2'
    }
    if (normalized.includes('lower') && (normalized.includes('1') || normalized.includes('one'))) {
      return 'lower1'
    }
    if (normalized.includes('lower') && (normalized.includes('2') || normalized.includes('two'))) {
      return 'lower2'
    }

    return template
  }

  async importToLocalStorage(): Promise<number> {
    try {
      const sheetData = await this.fetchWorkoutData()

      // Group by date and template
      const workoutsByDate: { [key: string]: any } = {}

      sheetData.forEach(row => {
        const key = `${row.date}-${row.template}`
        if (!workoutsByDate[key]) {
          workoutsByDate[key] = {
            id: `import-${Date.now()}-${row.template}`,
            date: row.date,
            template: row.template,
            templateName: this.getTemplateName(row.template),
            exercises: {},
            completedAt: new Date(row.date).toISOString(),
            source: 'google-sheets'
          }
        }

        if (!workoutsByDate[key].exercises[row.exercise]) {
          workoutsByDate[key].exercises[row.exercise] = []
        }

        // Ensure we have the right set index
        while (workoutsByDate[key].exercises[row.exercise].length < row.setNumber) {
          workoutsByDate[key].exercises[row.exercise].push({ weight: '', reps: '' })
        }

        workoutsByDate[key].exercises[row.exercise][row.setNumber - 1] = {
          weight: row.weight.toString(),
          reps: row.reps.toString()
        }
      })

      // Save to localStorage
      let importCount = 0
      Object.values(workoutsByDate).forEach((workout: any) => {
        const storageKey = `workout-complete-${workout.date}-${workout.template}`
        localStorage.setItem(storageKey, JSON.stringify(workout))
        importCount++
      })

      console.log(`Imported ${importCount} workouts from Google Sheets`)
      return importCount
    } catch (error) {
      console.error('Import failed:', error)
      throw error
    }
  }

  private getTemplateName(template: string): string {
    const templateNames: { [key: string]: string } = {
      'upper1': 'Upper Body 1',
      'upper2': 'Upper Body 2',
      'lower1': 'Lower Body 1',
      'lower2': 'Lower Body 2'
    }
    return templateNames[template] || template
  }

  // Configuration helpers
  setConfig(config: GoogleConfig) {
    this.config = config
    localStorage.setItem('googleSheetsConfig', JSON.stringify(config))
    this.initialized = false // Force re-initialization
  }

  getConfig(): GoogleConfig | null {
    return this.config
  }

  hasConfig(): boolean {
    return this.config !== null
  }

  clearConfig() {
    this.config = null
    localStorage.removeItem('googleSheetsConfig')
    this.initialized = false
  }
}

// Export singleton instance
export const sheetsService = new SheetsService()