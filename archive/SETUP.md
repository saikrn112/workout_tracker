# Workout App - New Architecture Setup Guide

Welcome to your revamped workout app! This guide will get you up and running with the new bulletproof Google Sheets integration.

## 🚀 Quick Start

1. **Open the Dashboard**
   ```bash
   # Start a local server (any of these options)
   python -m http.server 8000
   # OR
   npx serve -p 8000
   # OR
   php -S localhost:8000
   ```

2. **Access the Dashboard**
   - Open http://localhost:8000/workout-dashboard.html
   - The dashboard will guide you through setup and diagnostics

## 🔧 Configuration

### Option 1: Environment Variables (Recommended)
Create a `.env.js` file:
```javascript
window.ENV_CONFIG = {
    GOOGLE_SHEETS: {
        CLIENT_ID: 'YOUR_GOOGLE_CLIENT_ID',
        API_KEY: 'YOUR_GOOGLE_API_KEY'
    }
};
```

### Option 2: URL Parameters (For Testing)
```
http://localhost:8000/workout-dashboard.html?client_id=YOUR_CLIENT_ID&api_key=YOUR_API_KEY
http://localhost:8000/workout-dashboard.html?client_id=YOUR_GOOGLE_CLIENT_ID&api_key=YOUR_GOOGLE_API_KEY
```

### Option 3: Update Legacy Config
Edit `js/config.js` with your credentials (works with existing setup)

## 🗄️ New SQL-Like Database Interface

Your Google Sheets now works like a database! Here are examples:

### Basic Operations
```javascript
// Connect first
await sheetsDB.authenticate();

// SELECT all workouts
const allWorkouts = await sheetsDB.select('*');

// SELECT with WHERE clause
const benchPress = await sheetsDB.select('*', {
    Exercise: 'Bench Press'
});

// SELECT with complex conditions
const recentHeavy = await sheetsDB.select('*', {
    Date: { operator: '>', value: '2024-01-01' },
    Weight: { operator: '>=', value: '135' }
});

// INSERT new workout data
await sheetsDB.insert({
    Date: '2024-01-15',
    Template: 'Upper 1',
    Exercise: 'Bench Press',
    Set: '1',
    Weight: '185',
    Reps: '8',
    Notes: 'Felt strong'
});

// SELECT with ORDER BY and LIMIT
const topSets = await sheetsDB.select('*',
    { Exercise: 'Squat' },
    'Weight DESC',
    5
);
```

### Query Examples
```javascript
// Find all workouts from last month
const lastMonth = await sheetsDB.select('*', {
    Date: { operator: '>', value: '2023-12-01' }
});

// Get all upper body exercises
const upperBody = await sheetsDB.select(['Exercise', 'Weight', 'Reps'], {
    Template: { operator: 'contains', value: 'Upper' }
});

// Find personal records
const prs = await sheetsDB.select('*', null, 'Weight DESC', 10);
```

## 🧪 Testing & Debugging

### Dashboard Features
- **Quick Diagnostic**: Tests essential functionality
- **Full Test Suite**: Comprehensive system validation
- **Debug Log**: Real-time error tracking with context
- **Data Preview**: View and query your spreadsheet data
- **Export Tools**: Download configs, logs, and reports

### Debug Console Commands
```javascript
// Enable verbose logging
dbg.verbose()

// Check system status
dbg.info('System check', sheetsDB.exportDiagnostics())

// Run quick tests
await quickTest()

// Generate debug report
dbg.report()

// Check configuration
configManager.exportConfig()
```

### URL Debug Parameters
- `?debug=true` - Enable verbose logging
- `?client_id=XXX&api_key=YYY` - Override credentials

## 🛠️ Troubleshooting

### Common Issues

**1. "Configuration validation failed"**
- Check that your Google Client ID and API Key are set
- Verify Client ID ends with `.apps.googleusercontent.com`
- Verify API Key starts with `AIza`

**2. "Auth instance not available"**
- Ensure you've added your domain to Google OAuth authorized origins
- Check browser console for CORS errors
- Try refreshing the page

**3. "Failed to initialize Google Sheets integration"**
- Check internet connection
- Verify Google APIs are enabled in your project
- Run the diagnostic tests in the dashboard

### Debug Steps
1. Open the dashboard: `workout-dashboard.html`
2. Check all status indicators
3. Run "Quick Test" to identify issues
4. Check the debug log for specific errors
5. Download debug report if needed

### Google Cloud Console Setup
1. Go to https://console.cloud.google.com
2. Enable Google Sheets API and Google Drive API
3. Create credentials (API Key + OAuth Client ID)
4. Add your domain to authorized origins
5. Update your configuration

## 📊 Migration from Old System

Your existing data and templates are preserved! The new system:

- ✅ **Backward Compatible**: Works with existing `js/config.js`
- ✅ **Same Spreadsheet**: Uses your existing "Workout Log" spreadsheet
- ✅ **Enhanced Features**: SQL-like queries, better error handling
- ✅ **Better Debugging**: Comprehensive diagnostics and logging

## 🎯 Key Improvements

### Before (Old System)
- Hard-coded credentials in JavaScript
- Generic error messages
- Manual API initialization
- Complex debugging
- Raw Google Sheets API calls

### After (New System)
- Secure credential management
- Detailed error context with stack traces
- Automatic retry logic with exponential backoff
- Built-in test suite and diagnostics
- SQL-like database interface
- Real-time debug logging
- Performance monitoring

## 🔒 Security Notes

- Never commit API keys to version control
- Use environment variables for production
- The dashboard masks sensitive information in exports
- Debug logs exclude sensitive data

## 📁 File Structure

```
workout_app/
├── workout-dashboard.html          # 🆕 Main debug/management interface
├── js/
│   ├── debug-logger.js            # 🆕 Enhanced logging system
│   ├── config-manager.js          # 🆕 Secure configuration management
│   ├── sheets-db.js               # 🆕 SQL-like Google Sheets interface
│   ├── test-suite.js              # 🆕 Comprehensive testing framework
│   ├── config.js                  # ✅ Legacy config (still works)
│   ├── google-sheets.js           # ✅ Legacy integration (still works)
│   └── [other existing files]     # ✅ All existing functionality preserved
├── index_new.html                 # ✅ Your main workout app
└── [other existing files]         # ✅ All preserved
```

## 🎉 You're Ready!

1. Start your local server
2. Open `workout-dashboard.html`
3. Configure your API credentials
4. Run diagnostics to verify everything works
5. Start logging workouts with the new SQL-like interface!

The dashboard will guide you through each step and help you debug any issues. Your workout data has never been more accessible and reliable!

---
**Happy lifting! 💪**