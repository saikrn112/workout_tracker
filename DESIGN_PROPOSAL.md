# Workout App: Improved Architecture Design

## Current Problems
- SSL errors from Google Sheets API calls
- Fragile session state management
- High latency from multiple API calls per operation
- No offline capability or error recovery

## Proposed Solution: SQLite + Background Sync

### Architecture Overview
```
Frontend ────► Backend API ────► SQLite Database
    │              │                     │
    │              │                     │
    │              ▼                     │
    │       Background Sync              │
    │       Worker Process               │
    │              │                     │
    │              ▼                     │
    └─────► Google Sheets (Final Storage)◄┘
```

### Core Components

#### 1. SQLite Database Schema
```sql
-- Sessions table
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,  -- "2025-09-21_lower1"
    template TEXT NOT NULL,
    date TEXT NOT NULL,
    status TEXT DEFAULT 'active',  -- active, completed, cancelled
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    synced_to_sheets BOOLEAN DEFAULT FALSE
);

-- Sets table
CREATE TABLE sets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT REFERENCES sessions(id),
    exercise TEXT NOT NULL,
    set_number INTEGER NOT NULL,
    weight_lbs TEXT,
    reps TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    synced_to_sheets BOOLEAN DEFAULT FALSE
);
```

#### 2. Backend API Changes
```python
class WorkoutDatabase:
    def __init__(self):
        self.db = sqlite3.connect('workout.db', check_same_thread=False)
        self._init_tables()

    def start_session(self, template: str, date: str = None) -> str:
        # Fast local insert, no Google API call
        session_id = f"{date}_{template}"
        cursor.execute(
            "INSERT INTO sessions (id, template, date) VALUES (?, ?, ?)",
            (session_id, template, date)
        )
        return session_id

    def log_set(self, session_id: str, exercise: str, set_num: int,
                weight: str, reps: str, notes: str) -> bool:
        # Fast local insert, no Google API call
        cursor.execute(
            "INSERT INTO sets (session_id, exercise, set_number, weight_lbs, reps, notes) VALUES (?, ?, ?, ?, ?, ?)",
            (session_id, exercise, set_num, weight, reps, notes)
        )
        return True

    def get_active_session(self) -> dict:
        # Fast local query, no Google API call
        session = cursor.execute(
            "SELECT * FROM sessions WHERE status = 'active' ORDER BY created_at DESC LIMIT 1"
        ).fetchone()

        if session:
            sets = cursor.execute(
                "SELECT * FROM sets WHERE session_id = ? ORDER BY set_number",
                (session['id'],)
            ).fetchall()
            return {"session": session, "sets": sets}
        return None
```

#### 3. Background Sync Worker
```python
class SheetsSync:
    def __init__(self):
        self.db = WorkoutDatabase()
        self.sheets_api = GoogleSheetsAPI()

    def sync_completed_sessions(self):
        """Run every 5 minutes or on session completion"""
        unsynced_sessions = self.db.get_unsynced_sessions()

        for session in unsynced_sessions:
            try:
                sets = self.db.get_session_sets(session['id'])
                self.sheets_api.batch_append_workout_data(sets)
                self.db.mark_session_synced(session['id'])
                logger.info(f"Synced session {session['id']} to sheets")
            except Exception as e:
                logger.error(f"Failed to sync {session['id']}: {e}")
                # Will retry on next sync cycle

    def start_background_worker(self):
        """Start background thread for periodic sync"""
        scheduler = BackgroundScheduler()
        scheduler.add_job(self.sync_completed_sessions, 'interval', minutes=5)
        scheduler.start()
```

#### 4. API Endpoints (Updated)
```python
@app.route('/api/session/start', methods=['POST'])
def start_session():
    template = request.json.get('template')
    session_id = db.start_session(template)  # Fast local operation
    return {"success": True, "session_id": session_id}

@app.route('/api/session/log-set', methods=['PUT'])
def log_set():
    data = request.json
    success = db.log_set(
        data['session_id'], data['exercise'],
        data['set_number'], data['weight'], data['reps'], data['notes']
    )  # Fast local operation
    return {"success": success}

@app.route('/api/session/complete', methods=['POST'])
def complete_session():
    session_id = db.complete_session()  # Fast local operation

    # Trigger immediate sync (optional)
    sync_worker.sync_completed_sessions()

    return {"success": True}
```

### Benefits

#### ✅ Performance
- **Instant responses** (no Google API delays)
- **Batch operations** to sheets (fewer API calls)
- **Offline capability** (works without internet)

#### ✅ Reliability
- **No SSL/connection failures** during workout logging
- **Automatic retry** for failed syncs
- **Data persistence** across server restarts

#### ✅ User Experience
- **Immediate feedback** on set logging
- **Works offline** then syncs later
- **No workout interruptions** from API issues

#### ✅ Maintainability
- **Simple session logic** (just database operations)
- **Clear separation** of concerns (local ops vs sync)
- **Easy testing** and debugging

### Migration Plan

1. **Phase 1**: Add SQLite database alongside current system
2. **Phase 2**: Switch session operations to use SQLite
3. **Phase 3**: Add background sync worker
4. **Phase 4**: Remove direct Google Sheets calls from API endpoints
5. **Phase 5**: Add offline sync and retry logic

### Required Dependencies
```python
# Add to requirements.txt
sqlite3  # Built into Python
APScheduler==3.9.1  # Background scheduling
```

This design treats Google Sheets as the "source of truth" for historical data while using SQLite as a fast, reliable operational database for active sessions.