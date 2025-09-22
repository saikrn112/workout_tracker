// Configuration settings for the Workout Logger app
const CONFIG = {
    // Google Sheets API configuration
    GOOGLE_SHEETS: {
        CLIENT_ID: 'YOUR_GOOGLE_CLIENT_ID',
        API_KEY: 'YOUR_GOOGLE_API_KEY',
        DISCOVERY_DOC: 'https://sheets.googleapis.com/$discovery/rest?version=v4',
        SCOPES: 'https://www.googleapis.com/auth/spreadsheets',
        // Additional safety settings
        INIT_TIMEOUT: 15000, // 15 seconds
        RETRY_DELAY: 2000, // 2 seconds
        MAX_RETRIES: 3
    },
    
    // Local storage keys
    STORAGE_KEYS: {
        WORKOUT_HISTORY: 'workoutHistory',
        CUSTOM_TEMPLATES: 'customTemplates',
        GOOGLE_AUTH: 'googleAuthToken',
        SYNC_STATUS: 'syncStatus',
        LAST_SYNC: 'lastSync'
    },
    
    // App settings
    APP: {
        MAX_HISTORY_DISPLAY: 10,
        AUTO_SAVE_INTERVAL: 30000, // 30 seconds
        SYNC_RETRY_ATTEMPTS: 3,
        SYNC_RETRY_DELAY: 2000 // 2 seconds
    },
    
    // Default spreadsheet structure
    SPREADSHEET: {
        HEADERS: ['Date', 'Template', 'Exercise', 'Set', 'Weight', 'Reps'],
        SHEET_NAME: 'Workout Log'
    }
};

// Environment check
const ENV = {
    isDevelopment: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1',
    isOnline: navigator.onLine,
    supportsServiceWorker: 'serviceWorker' in navigator,
    supportsNotifications: 'Notification' in window
};

// Export for use in other modules
window.CONFIG = CONFIG;
window.ENV = ENV;
