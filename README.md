# Workout App

A session-based workout logging system with Google Sheets integration and mobile interface.

## Features

- Session-based workout tracking
- Template-driven exercise selection
- Real-time set logging
- Google Sheets data persistence
- Web-based frontend interface

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Configure Google Sheets API:
   - Place `credentials.json` in project root
   - Run initial setup to generate `token.json`

3. Start the system:
```bash
python start_system.py
```

## Architecture

- **Backend**: Flask API with Google Sheets integration
- **Frontend**: Vanilla JavaScript web interface
- **Data**: Google Sheets as primary storage

## Project Structure

```
workout_app/
├── backend_api.py          # Main API server
├── frontend/              # Web interface
├── config.py             # Configuration
├── start_system.py       # System launcher
└── archive/             # Legacy implementations
```

## Development

The current implementation uses Google Sheets as a live database. See `DESIGN_PROPOSAL.md` for planned SQLite + background sync architecture improvements.# Trigger redeployment for environment variables
