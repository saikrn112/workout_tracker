'use client'

import { useState, useEffect } from 'react'
import { sheetsService } from '@/lib/sheets'

interface SettingsProps {
  onBack: () => void
}

export default function Settings({ onBack }: SettingsProps) {
  const [sheetsConfig, setSheetsConfig] = useState({
    clientId: '',
    apiKey: '',
    spreadsheetId: ''
  })
  const [importing, setImporting] = useState(false)
  const [importStatus, setImportStatus] = useState<string>('')

  useEffect(() => {
    // Load existing config
    const existingConfig = sheetsService.getConfig()
    if (existingConfig) {
      setSheetsConfig(existingConfig)
    }
  }, [])

  const handleConfigSave = () => {
    if (!sheetsConfig.clientId || !sheetsConfig.apiKey || !sheetsConfig.spreadsheetId) {
      alert('Please fill in all Google Sheets configuration fields')
      return
    }

    sheetsService.setConfig(sheetsConfig)
    alert('Google Sheets configuration saved!')
  }

  const handleImport = async () => {
    if (!sheetsService.hasConfig()) {
      alert('Please configure Google Sheets first')
      return
    }

    setImporting(true)
    setImportStatus('Connecting to Google Sheets...')

    try {
      const importCount = await sheetsService.importToLocalStorage()
      setImportStatus(`Successfully imported ${importCount} workouts!`)
    } catch (error) {
      console.error('Import failed:', error)
      setImportStatus(`Import failed: ${error}`)
    } finally {
      setImporting(false)
    }
  }

  const handleClearData = () => {
    if (confirm('Are you sure you want to clear all workout data? This cannot be undone.')) {
      // Clear all workout data from localStorage
      const keysToRemove = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith('workout-') || key?.startsWith('session-')) {
          keysToRemove.push(key)
        }
      }

      keysToRemove.forEach(key => localStorage.removeItem(key))
      alert(`Cleared ${keysToRemove.length} workout records`)
    }
  }

  const getStoredWorkoutsCount = () => {
    let count = 0
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith('workout-complete-')) {
        count++
      }
    }
    return count
  }

  const getActiveSessions = () => {
    let count = 0
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith('session-')) {
        count++
      }
    }
    return count
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
        <h1 className="text-2xl font-bold">Settings</h1>
        <div className="w-12" />
      </div>

      {/* Data Status */}
      <div className="bg-white rounded-lg border p-4 mb-6">
        <h3 className="font-semibold mb-3">Workout Data Status</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Completed Workouts:</span>
            <span className="font-medium">{getStoredWorkoutsCount()}</span>
          </div>
          <div className="flex justify-between">
            <span>Active Sessions:</span>
            <span className="font-medium">{getActiveSessions()}</span>
          </div>
        </div>
      </div>

      {/* Google Sheets Configuration */}
      <div className="bg-white rounded-lg border p-4 mb-6">
        <h3 className="font-semibold mb-3">Google Sheets Integration</h3>
        <p className="text-sm text-gray-600 mb-4">
          Connect to Google Sheets to import historical workout data.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Client ID
            </label>
            <input
              type="text"
              value={sheetsConfig.clientId}
              onChange={(e) => setSheetsConfig({ ...sheetsConfig, clientId: e.target.value })}
              placeholder="123456789-abc123.apps.googleusercontent.com"
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              API Key
            </label>
            <input
              type="password"
              value={sheetsConfig.apiKey}
              onChange={(e) => setSheetsConfig({ ...sheetsConfig, apiKey: e.target.value })}
              placeholder="AIzaSyA..."
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Spreadsheet ID
            </label>
            <input
              type="text"
              value={sheetsConfig.spreadsheetId}
              onChange={(e) => setSheetsConfig({ ...sheetsConfig, spreadsheetId: e.target.value })}
              placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Found in the URL: docs.google.com/spreadsheets/d/<strong>SPREADSHEET_ID</strong>/edit
            </p>
          </div>

          <button
            onClick={handleConfigSave}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
          >
            Save Configuration
          </button>
        </div>
      </div>

      {/* Import Data */}
      <div className="bg-white rounded-lg border p-4 mb-6">
        <h3 className="font-semibold mb-3">Import Historical Data</h3>
        <p className="text-sm text-gray-600 mb-4">
          Import your existing workout data from Google Sheets. This will fetch all historical workouts and add them to your local database.
        </p>

        <button
          onClick={handleImport}
          disabled={importing || !sheetsService.hasConfig()}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded transition-colors mb-3"
        >
          {importing ? 'Importing...' : 'Import from Google Sheets'}
        </button>

        {importStatus && (
          <div className="text-sm p-2 rounded bg-gray-100">
            {importStatus}
          </div>
        )}
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-lg border border-red-200 p-4">
        <h3 className="font-semibold text-red-800 mb-3">Danger Zone</h3>
        <p className="text-sm text-gray-600 mb-4">
          Clear all workout data from local storage. This cannot be undone.
        </p>

        <button
          onClick={handleClearData}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
        >
          Clear All Data
        </button>
      </div>

      {/* Instructions */}
      <div className="mt-8 text-sm text-gray-500">
        <h4 className="font-medium mb-2">Setup Instructions:</h4>
        <ol className="list-decimal list-inside space-y-1">
          <li>Go to Google Cloud Console and create a project</li>
          <li>Enable Google Sheets API</li>
          <li>Create credentials (API Key and OAuth 2.0 Client ID)</li>
          <li>Add your domain to authorized origins</li>
          <li>Share your spreadsheet with the service account email</li>
        </ol>
      </div>
    </div>
  )
}