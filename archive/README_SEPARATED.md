# 🏋️ Workout App - Separated Frontend & Backend

A clean separation of concerns with a Python REST API backend and JavaScript frontend, designed for real-time workout logging with Google Sheets integration.

## 🏗️ Architecture

### **Backend (Python)**
- **REST API** using Flask
- **Google Sheets integration** for your "Gym workout" spreadsheet
- **Real-time data sync** to the "raw" sheet
- **Robust error handling** and authentication

### **Frontend (JavaScript)**
- **Modern UI/UX** based on your existing design
- **Template-based workouts** (Upper 1/2, Lower 1/2)
- **Real-time set logging** during workouts
- **Immediate feedback** and validation

## 🚀 Quick Start

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Set Up Google API Credentials
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Enable **Google Sheets API** and **Google Drive API**
3. Create **OAuth client ID** for desktop application
4. Download `credentials.json` to this directory

### 3. Ensure Your Google Sheet Exists
- Make sure you have a spreadsheet named **"Gym workout"**
- The backend will automatically create a **"raw"** sheet if it doesn't exist
- Headers will be set up automatically: Date, Template, Exercise, Set, Weight, Reps, Notes, Timestamp, Volume, RPE

### 4. Start the System

**Option A: Start Everything at Once**
```bash
python start_system.py
```

**Option B: Start Manually**
```bash
# Terminal 1 - Backend API
python backend_api.py

# Terminal 2 - Frontend Server
python frontend/serve.py
```

### 5. Open Your Browser
- Go to **http://localhost:8080**
- The frontend will automatically connect to the backend
- Start logging workouts immediately!

## 📱 **How to Use During Workouts**

### **Quick Workout Flow:**
1. **Select Template** - Choose Upper 1, Upper 2, Lower 1, or Lower 2
2. **Enter Sets** - Weight and reps for each exercise
3. **Quick Navigation** - Press Enter to move between inputs
4. **Add Sets** - Click "Add Set" or press Enter on last input
5. **Log Workout** - Single click saves everything to Google Sheets

### **Real-Time Features:**
- ✅ **Connection Status** - Shows if backend is connected
- ✅ **Instant Validation** - Button enables when you have data
- ✅ **Quick Entry** - Optimized for rapid set logging
- ✅ **Auto-Focus** - Cursor moves to next input automatically
- ✅ **Recent History** - See your last workouts immediately

## 🔧 **API Endpoints**

The backend provides a clean REST API:

```
GET  /api/health          - System status
GET  /api/templates       - Workout templates
POST /api/workout         - Log a workout
GET  /api/workouts        - Get recent workouts
GET  /api/stats           - Workout statistics
GET  /api/spreadsheet     - Sheet information
```

### **Example: Log a Workout**
```javascript
const workoutData = {
  date: "2024-01-15",
  template: "Upper 1",
  exercises: {
    "Bench Press": [
      { weight: "185", reps: "8" },
      { weight: "185", reps: "7" }
    ],
    "Lat Pulldown": [
      { weight: "140", reps: "10" }
    ]
  }
};

fetch('http://localhost:5001/api/workout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(workoutData)
});
```

## 📊 **Google Sheets Integration**

### **Target Spreadsheet:**
- **Name**: "Gym workout" (configurable in backend_api.py)
- **Sheet**: "raw" (auto-created if missing)

### **Data Structure:**
Each set becomes one row with:
- **Date** - Workout date
- **Template** - Upper 1, Lower 2, etc.
- **Exercise** - Exercise name
- **Set** - Set number (1, 2, 3...)
- **Weight** - Weight in lbs
- **Reps** - Number of repetitions
- **Notes** - Optional notes
- **Timestamp** - When logged
- **Volume** - Weight × Reps (auto-calculated)
- **RPE** - Rate of perceived exertion (future)

### **Example Row:**
```
2024-01-15 | Upper 1 | Bench Press | 1 | 185 | 8 | | 2024-01-15T14:30:00 | 1480 |
```

## 🎨 **Frontend Features**

### **Template System**
Templates are loaded from the backend and render as buttons:
- **Upper 1**: Pec dec fly, DB Incline bench press, DB lateral raises...
- **Upper 2**: Hamstring curls, Hip thrust, DB Deadlifts...
- **Lower 1**: Flat bench press, DB Shoulder press, Rows...
- **Lower 2**: Adductors, Abductors, Leg extensions...

### **Set Management**
- **Add Sets**: Click button or press Enter on last input
- **Remove Sets**: Click × button, automatically renumbers
- **Quick Entry**: Optimized keyboard navigation
- **Real-time Validation**: Button enables when you have data

### **Workout History**
- **Recent Workouts**: Shows last 10 workouts
- **Grouped by Date**: Each workout session grouped together
- **Exercise Summary**: Quick overview of sets per exercise
- **Smart Dates**: "Today", "Yesterday", or formatted date

## 🔍 **Development & Debugging**

### **Backend Debugging**
```bash
# Enable debug logging
python backend_api.py

# Check logs for errors
tail -f workout_app.log

# Test specific endpoints
curl http://localhost:5001/api/health
curl http://localhost:5001/api/templates
```

### **Frontend Debugging**
- **Console Logs**: Open browser developer tools
- **Connection Status**: Check the status indicator
- **Network Tab**: Monitor API calls
- **API Responses**: All responses logged to console

### **Common Issues**
1. **Backend Won't Start**: Check `credentials.json` exists
2. **Frontend Can't Connect**: Ensure backend is running on port 5001
3. **Google Sheets Error**: Verify spreadsheet "Gym workout" exists
4. **CORS Issues**: Backend includes CORS headers automatically

## 📂 **File Structure**

```
workout_app/
├── backend_api.py              # 🔧 REST API backend
├── frontend/
│   ├── index.html             # 🎨 Main workout interface
│   ├── js/
│   │   ├── workout-api.js     # 📡 API communication
│   │   └── workout-ui.js      # 🎮 UI interactions
│   └── serve.py               # 🌐 Static file server
├── start_system.py            # 🚀 Launch everything
├── requirements.txt           # 📦 Python dependencies
├── credentials.json           # 🔑 Google API credentials
└── README_SEPARATED.md        # 📖 This documentation
```

## 🔄 **Workflow During Workouts**

### **Gym Scenario:**
1. **Open App** on your phone/tablet: `http://localhost:8080`
2. **Select Template** - One tap: "Upper 1"
3. **Start First Exercise** - Weight field auto-focused
4. **Quick Entry**:
   - Type weight → Tab → Type reps → Enter
   - New set automatically added
5. **Move to Next Exercise** - Scroll down, repeat
6. **Finish Workout** - One tap "Log Workout"
7. **Instant Sync** - Data immediately in Google Sheets

### **Post-Workout:**
- **View History** - See what you just logged
- **Check Stats** - Progress over time
- **View Sheet** - Full data in Google Sheets
- **Analysis** - Use sheet for charts/trends

## 🎯 **Key Benefits**

### **✅ For Workouts:**
- **Fast Entry** - Optimized for rapid logging between sets
- **No Delays** - Local UI with background sync
- **Always Available** - Works offline, syncs when connected
- **Immediate Feedback** - Instant validation and confirmation

### **✅ For Development:**
- **Clean Separation** - Frontend and backend completely independent
- **Easy Debugging** - Clear error messages and logging
- **Extensible** - Add features to either side independently
- **Testable** - Each component can be tested separately

### **✅ For Data:**
- **Real-time Sync** - Every workout immediately in Google Sheets
- **Structured Data** - Clean, queryable format
- **Backup Included** - Google Sheets provides automatic backup
- **Flexible Analysis** - Use sheets for charts, pivots, etc.

## 🔧 **Customization**

### **Add New Templates:**
Edit the templates in `backend_api.py`:
```python
def get_workout_templates(self):
    return {
        "upper1": [...],
        "custom": ["New Exercise 1", "New Exercise 2"]
    }
```

### **Change Spreadsheet/Sheet:**
In `backend_api.py`:
```python
SPREADSHEET_NAME = "Your Spreadsheet Name"
SHEET_NAME = "your_sheet_name"
```

### **Modify UI:**
- **Styling**: Edit CSS in `frontend/index.html`
- **Behavior**: Edit `frontend/js/workout-ui.js`
- **API**: Edit `frontend/js/workout-api.js`

### **Add API Endpoints:**
In `backend_api.py`:
```python
@app.route('/api/your-endpoint', methods=['GET'])
def your_function():
    return jsonify({"your": "data"})
```

## 🚀 **Production Deployment**

### **Frontend:**
- Deploy static files to any web server
- Update API URL in `workout-api.js`
- Consider CDN for better performance

### **Backend:**
- Use production WSGI server (gunicorn, uWSGI)
- Set up proper environment variables
- Configure HTTPS and authentication
- Monitor logs and performance

### **Google Sheets:**
- Share spreadsheet with appropriate permissions
- Consider using service account for production
- Set up backup/monitoring for critical data

---

**Perfect for gym workouts - fast, reliable, and immediately synced to Google Sheets! 💪**