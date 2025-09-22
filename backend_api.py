#!/usr/bin/env python3
"""
Workout App REST API Backend
Handles Google Sheets integration for the "Gym workout" spreadsheet.
"""

import os
import json
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
from flask import Flask, request, jsonify
from flask_cors import CORS
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend communication

# Google Sheets configuration
SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.metadata.readonly",
]
SPREADSHEET_NAME = "Gym workout"
SHEET_NAME = "raw"

class WorkoutAPIError(Exception):
    """Custom exception for API errors"""
    pass

class WorkoutSheetsAPI:
    """Google Sheets API wrapper for workout data"""

    def __init__(self):
        self.service = None
        self.spreadsheet_id = None
        self.current_session_info = None  # Track current session: {template, date}
        self._authenticate()
        self._find_spreadsheet()

    def _authenticate(self):
        """Handle OAuth2 authentication"""
        try:
            creds = None
            if os.path.exists("token.json"):
                creds = Credentials.from_authorized_user_file("token.json", SCOPES)
                logger.info("Loaded existing credentials")

            if not creds or not creds.valid:
                if creds and creds.expired and creds.refresh_token:
                    logger.info("Refreshing expired credentials")
                    creds.refresh(Request())
                else:
                    logger.info("Starting OAuth2 flow")
                    if not os.path.exists("credentials.json"):
                        raise WorkoutAPIError(
                            "credentials.json not found. Please download from Google Cloud Console."
                        )

                    flow = InstalledAppFlow.from_client_secrets_file("credentials.json", SCOPES)
                    creds = flow.run_local_server(port=0)

                # Save credentials
                with open("token.json", "w") as f:
                    f.write(creds.to_json())
                logger.info("Saved credentials")

            self.service = build("sheets", "v4", credentials=creds)
            logger.info("Google Sheets service initialized")

        except Exception as e:
            logger.error(f"Authentication failed: {e}")
            raise WorkoutAPIError(f"Authentication failed: {e}")

    def _find_spreadsheet(self):
        """Find the 'Gym workout' spreadsheet"""
        try:
            # Build drive service to search for spreadsheet
            drive_service = build("drive", "v3", credentials=self.service._http.credentials)

            # Search for the spreadsheet
            query = f"name = '{SPREADSHEET_NAME}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false"
            result = drive_service.files().list(
                q=query,
                fields="files(id,name)",
                pageSize=1
            ).execute()

            files = result.get("files", [])
            if not files:
                raise WorkoutAPIError(f"Spreadsheet '{SPREADSHEET_NAME}' not found")

            self.spreadsheet_id = files[0]["id"]
            logger.info(f"Found spreadsheet: {self.spreadsheet_id}")

            # Verify the 'raw' sheet exists
            self._ensure_raw_sheet()

        except Exception as e:
            logger.error(f"Failed to find spreadsheet: {e}")
            raise WorkoutAPIError(f"Failed to find spreadsheet: {e}")

    def _ensure_raw_sheet(self):
        """Ensure the 'raw' sheet exists and has proper headers"""
        try:
            # Get spreadsheet metadata
            spreadsheet = self.service.spreadsheets().get(
                spreadsheetId=self.spreadsheet_id
            ).execute()

            # Check if 'raw' sheet exists
            sheets = spreadsheet.get("sheets", [])
            raw_sheet_exists = any(
                sheet.get("properties", {}).get("title") == SHEET_NAME
                for sheet in sheets
            )

            if not raw_sheet_exists:
                # Create the 'raw' sheet
                logger.info(f"Creating '{SHEET_NAME}' sheet")
                request_body = {
                    "requests": [{
                        "addSheet": {
                            "properties": {
                                "title": SHEET_NAME,
                                "gridProperties": {
                                    "rowCount": 1000,
                                    "columnCount": 10
                                }
                            }
                        }
                    }]
                }

                self.service.spreadsheets().batchUpdate(
                    spreadsheetId=self.spreadsheet_id,
                    body=request_body
                ).execute()

            # Ensure headers exist
            self._setup_headers()

        except Exception as e:
            logger.error(f"Failed to ensure raw sheet: {e}")
            raise WorkoutAPIError(f"Failed to ensure raw sheet: {e}")

    def _setup_headers(self):
        """Set up headers in the raw sheet, preserving existing structure and adding new columns if needed"""
        try:
            # First, get the current headers to understand existing structure
            result = self.service.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id,
                range=f"{SHEET_NAME}!1:1"  # Get entire first row
            ).execute()

            existing_headers = result.get("values", [[]])[0] if result.get("values") else []

            # Expected base structure from user's golden data (from screenshot)
            expected_base_headers = [
                "date", "exercise", "set_number", "weight_lbs", "reps", "side",
                "setting", "segment_note", "feeling", "reps_raw_part", "raw_cell",
                "weight_unit_raw", "_set_row", "_part_idx", "source_file"
            ]

            # Additional columns we want to ensure exist
            additional_headers = ["template", "session_status"]

            # If no headers exist, create the complete structure
            if not existing_headers:
                logger.info("No headers found, creating complete header structure")
                complete_headers = expected_base_headers + additional_headers
                self._write_headers(complete_headers)
                self.current_headers = complete_headers
                return

            # Store current headers for use in data operations
            self.current_headers = existing_headers[:]

            # Check if we need to add any missing columns
            headers_to_add = []
            for header in additional_headers:
                if header not in existing_headers:
                    headers_to_add.append(header)

            if headers_to_add:
                logger.info(f"Adding missing headers: {headers_to_add}")
                # Add new headers to the end
                new_headers = existing_headers + headers_to_add
                self._write_headers(new_headers)
                self.current_headers = new_headers
            else:
                logger.info(f"Headers already complete: {len(existing_headers)} columns")

        except Exception as e:
            logger.warning(f"Failed to setup headers: {e}")
            # Fallback to basic structure
            self.current_headers = expected_base_headers + additional_headers

    def _write_headers(self, headers):
        """Write headers to the sheet and format them"""
        try:
            # Determine the range based on number of headers
            end_column = chr(ord('A') + len(headers) - 1)
            range_name = f"{SHEET_NAME}!A1:{end_column}1"

            # Write headers
            self.service.spreadsheets().values().update(
                spreadsheetId=self.spreadsheet_id,
                range=range_name,
                valueInputOption="USER_ENTERED",
                body={"values": [headers]}
            ).execute()

            # Format headers (bold)
            self.service.spreadsheets().batchUpdate(
                spreadsheetId=self.spreadsheet_id,
                body={
                    "requests": [{
                        "repeatCell": {
                            "range": {
                                "sheetId": self._get_sheet_id(SHEET_NAME),
                                "startRowIndex": 0,
                                "endRowIndex": 1,
                                "startColumnIndex": 0,
                                "endColumnIndex": len(headers)
                            },
                            "cell": {
                                "userEnteredFormat": {
                                    "textFormat": {"bold": True},
                                    "backgroundColor": {"red": 0.9, "green": 0.9, "blue": 0.9}
                                }
                            },
                            "fields": "userEnteredFormat(textFormat,backgroundColor)"
                        }
                    }]
                }
            ).execute()

            logger.info(f"Headers written successfully: {headers}")

        except Exception as e:
            logger.error(f"Failed to write headers: {e}")
            raise

    def _get_sheet_id(self, sheet_name: str) -> int:
        """Get the sheet ID for a given sheet name"""
        try:
            spreadsheet = self.service.spreadsheets().get(
                spreadsheetId=self.spreadsheet_id
            ).execute()

            for sheet in spreadsheet.get("sheets", []):
                if sheet.get("properties", {}).get("title") == sheet_name:
                    return sheet.get("properties", {}).get("sheetId", 0)

            return 0  # Default to first sheet
        except:
            return 0

    def append_workout_data(self, workout_data: List[Dict[str, Any]]) -> bool:
        """Append workout data to the raw sheet using existing header structure"""
        try:
            if not workout_data:
                return True

            # Ensure we have current headers
            if not hasattr(self, 'current_headers') or not self.current_headers:
                logger.warning("No current headers found, re-initializing")
                self._setup_headers()

            # Convert workout data to rows matching the header structure
            rows = []
            for entry in workout_data:
                row = []

                for header in self.current_headers:
                    if header == "date":
                        row.append(entry.get("date", ""))
                    elif header == "exercise":
                        row.append(entry.get("exercise", ""))
                    elif header == "set_number":
                        row.append(entry.get("set_number", ""))
                    elif header == "weight_lbs":
                        row.append(entry.get("weight_lbs", ""))
                    elif header == "reps":
                        row.append(entry.get("reps", ""))
                    elif header == "side":
                        row.append("")  # Not used in current app
                    elif header == "setting":
                        row.append("")  # Not used in current app
                    elif header == "segment_note":
                        row.append(entry.get("notes", ""))
                    elif header == "feeling":
                        row.append(entry.get("rpe", ""))  # Map RPE to feeling
                    elif header == "reps_raw_part":
                        row.append("")  # Historical data field
                    elif header == "raw_cell":
                        row.append("")  # Historical data field
                    elif header == "weight_unit_raw":
                        row.append("lbs" if entry.get("weight") else "")  # Default to lbs
                    elif header == "_set_row":
                        row.append("")  # Historical data field
                    elif header == "_part_idx":
                        row.append("")  # Historical data field
                    elif header == "source_file":
                        row.append("workout_app")  # Mark as coming from this app
                    elif header == "template":
                        row.append(entry.get("template", ""))
                    elif header == "session_status":
                        row.append(entry.get("session_status", ""))
                    else:
                        # Handle any additional columns with empty values
                        row.append("")

                rows.append(row)

            # Determine the range based on number of columns
            end_column = chr(ord('A') + len(self.current_headers) - 1)
            range_name = f"{SHEET_NAME}!A:{end_column}"

            # Append to sheet
            result = self.service.spreadsheets().values().append(
                spreadsheetId=self.spreadsheet_id,
                range=range_name,
                valueInputOption="USER_ENTERED",  # This will interpret numbers as numbers, not text
                body={"values": rows}
            ).execute()

            updated_rows = result.get("updates", {}).get("updatedRows", 0)
            logger.info(f"Appended {updated_rows} rows to sheet with {len(self.current_headers)} columns")
            return True

        except Exception as e:
            logger.error(f"Failed to append workout data: {e}")
            raise WorkoutAPIError(f"Failed to append workout data: {e}")

    def get_recent_workouts(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get recent workout data from the sheet using existing header structure"""
        try:
            # Ensure we have current headers
            if not hasattr(self, 'current_headers') or not self.current_headers:
                logger.warning("No current headers found, re-initializing")
                self._setup_headers()

            # First, get all data to find the actual range with data
            end_column = chr(ord('A') + len(self.current_headers) - 1)

            # Get all data from row 2 onwards to find the last row with data
            all_data_range = f"{SHEET_NAME}!A2:{end_column}"
            all_result = self.service.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id,
                range=all_data_range
            ).execute()

            all_values = all_result.get("values", [])

            if not all_values:
                logger.info("No data found in sheet")
                return []

            # Get the last N rows (where N is limit * 2 to ensure we get enough data)
            # Since there might be multiple sets per workout
            start_index = max(0, len(all_values) - (limit * 10))  # Get more rows to ensure we have enough workouts
            recent_rows = all_values[start_index:]

            workouts = []

            # Process rows in reverse order (most recent first)
            for row in reversed(recent_rows):
                if len(row) >= 3:  # Ensure minimum required columns (date, exercise, set_number)
                    # Pad row to match headers length
                    padded_row = row + [""] * (len(self.current_headers) - len(row))

                    # Create workout dict using actual headers
                    workout = {}
                    for i, header in enumerate(self.current_headers):
                        if i < len(padded_row):
                            # Map headers to API expected format for frontend compatibility
                            if header == "date":
                                workout["date"] = padded_row[i]
                            elif header == "exercise":
                                workout["exercise"] = padded_row[i]
                            elif header == "set_number":
                                workout["set"] = padded_row[i]
                            elif header == "weight_lbs":
                                workout["weight"] = padded_row[i]
                            elif header == "reps":
                                workout["reps"] = padded_row[i]
                            elif header == "segment_note":
                                workout["notes"] = padded_row[i]
                            elif header == "feeling":
                                workout["rpe"] = padded_row[i]
                            elif header == "template":
                                workout["template"] = padded_row[i]

                            # Also include raw data for completeness
                            workout[header] = padded_row[i]

                    # Calculate volume if weight and reps exist
                    try:
                        weight = float(workout.get("weight", 0) or 0)
                        reps = int(workout.get("reps", 0) or 0)
                        if weight and reps:
                            workout["volume"] = weight * reps
                        else:
                            workout["volume"] = ""
                    except (ValueError, TypeError):
                        workout["volume"] = ""

                    workouts.append(workout)

                    # Stop when we have enough workouts
                    if len(workouts) >= limit:
                        break

            logger.info(f"Retrieved {len(workouts)} recent workouts from {len(all_values)} total rows")
            return workouts

        except Exception as e:
            logger.error(f"Failed to get recent workouts: {e}")
            raise WorkoutAPIError(f"Failed to get recent workouts: {e}")

    def get_workout_templates(self) -> Dict[str, List[str]]:
        """Get workout templates (could be stored in sheet or hardcoded)"""
        # For now, return the templates from your existing system
        # Later this could be read from another sheet
        return {
            "upper1": [
                "Pec dec fly",
                "DB Incline bench press",
                "DB lateral raises",
                "Lat pulldown (Moderate load)",
                "Flat bar cable curls",
                "Tricep pushdowns"
            ],
            "upper2": [
                "Hamstring curls lying",
                "Hip Thrust machine",
                "DB Deadlifts",
                "Walking lunges bodyweight",
                "Calf raises seated",
                "Reverse Crunches"
            ],
            "lower1": [
                "Flat bench press DB",
                "DB Seated shoulder press",
                "Pronated rows seated",
                "Rope pullovers",
                "Bicep hammer curls DB",
                "Tricep pushdowns"
            ],
            "lower2": [
                "Adductors Machine",
                "Abductors Machine",
                "Leg extensions",
                "Lying leg curls",
                "Walking lunges",
                "Reverse crunches"
            ]
        }

    def get_spreadsheet_url(self) -> str:
        """Get the URL to view the spreadsheet"""
        return f"https://docs.google.com/spreadsheets/d/{self.spreadsheet_id}"

    def get_current_headers(self) -> List[str]:
        """Get the current header structure from the sheet"""
        if not hasattr(self, 'current_headers') or not self.current_headers:
            self._setup_headers()
        return self.current_headers[:]

    # Session Management Methods
    def start_workout_session(self, template: str, date: str = None) -> str:
        """Start a new workout session"""
        if date is None:
            date = datetime.now().strftime('%Y-%m-%d')

        # Check if there's already an active session
        active_session = self.get_active_session()
        if active_session:
            raise WorkoutAPIError(f"Active session already exists for template '{active_session['template']}' on {active_session['date']}")

        # Get template exercises
        template_exercises = self.get_workout_templates().get(template, [])
        if not template_exercises:
            raise WorkoutAPIError(f"Template '{template}' not found")

        # Don't create empty rows - just validate template exists
        # Exercises will be added when user logs actual sets
        session_id = f"{date}_{template}"

        # Track the current session
        self.current_session_info = {
            "template": template,
            "date": date,
            "exercises": {exercise: [] for exercise in template_exercises}
        }

        logger.info(f"Started workout session: {session_id} with {len(template_exercises)} exercises")
        return session_id

    def get_active_session(self) -> Dict[str, Any]:
        """Get the current active workout session"""
        try:
            # First check if we have a tracked session (newly started session)
            if self.current_session_info:
                # Check if this session has any data in the sheet
                all_data_range = f"{SHEET_NAME}!A2:{chr(ord('A') + len(self.current_headers) - 1)}"
                result = self.service.spreadsheets().values().get(
                    spreadsheetId=self.spreadsheet_id,
                    range=all_data_range
                ).execute()

                values = result.get("values", [])
                status_index = self.current_headers.index("session_status")

                # Find any active rows that match our tracked session
                active_exercises = {}
                for i, row in enumerate(values):
                    if (len(row) > status_index and row[status_index] == "active" and
                        len(row) > 0 and row[0] == self.current_session_info["date"]):

                        # Parse this active row
                        workout = {}
                        for j, header in enumerate(self.current_headers):
                            if j < len(row):
                                workout[header] = row[j]

                        exercise = workout.get("exercise", "")
                        if exercise:
                            if exercise not in active_exercises:
                                active_exercises[exercise] = []
                            active_exercises[exercise].append(workout)

                # Merge sheet data with template structure
                merged_exercises = self.current_session_info["exercises"].copy()
                for exercise, sets in active_exercises.items():
                    merged_exercises[exercise] = sets

                return {
                    "date": self.current_session_info["date"],
                    "template": self.current_session_info["template"],
                    "exercises": merged_exercises
                }

            # Fallback: check sheet for any active sessions
            all_data_range = f"{SHEET_NAME}!A2:{chr(ord('A') + len(self.current_headers) - 1)}"
            result = self.service.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id,
                range=all_data_range
            ).execute()

            values = result.get("values", [])
            status_index = self.current_headers.index("session_status")

            active_exercises = {}
            active_date = None
            active_template = None

            for i, row in enumerate(values):
                if len(row) > status_index and row[status_index] == "active":
                    workout = {}
                    for j, header in enumerate(self.current_headers):
                        if j < len(row):
                            workout[header] = row[j]

                    exercise = workout.get("exercise", "")
                    if exercise:
                        if exercise not in active_exercises:
                            active_exercises[exercise] = []
                        active_exercises[exercise].append(workout)

                        active_date = workout.get("date")
                        active_template = workout.get("template")

            if active_exercises:
                return {
                    "date": active_date,
                    "template": active_template,
                    "exercises": active_exercises
                }

            return None

        except Exception as e:
            logger.error(f"Failed to get active session: {e}")
            return None

    def update_set_in_session(self, exercise: str, set_number: int, weight: str = None, reps: str = None, notes: str = None) -> bool:
        """Update or add a specific set in the active session"""
        active_session = self.get_active_session()
        if not active_session:
            raise WorkoutAPIError("No active workout session found")

        # Find the specific row to update or determine if we need to add a new set
        exercise_sets = active_session["exercises"].get(exercise, [])

        # Check if this set already exists
        existing_set = None
        for set_data in exercise_sets:
            try:
                existing_set_number = set_data.get("set_number", "0")
                if existing_set_number == "" or existing_set_number is None:
                    existing_set_number = "0"
                if int(existing_set_number) == set_number:
                    existing_set = set_data
                    break
            except ValueError:
                continue

        if existing_set:
            # Update existing set
            return self._update_existing_set(existing_set, weight, reps, notes)
        else:
            # Add new set
            return self._add_new_set_to_session(active_session, exercise, set_number, weight, reps, notes)

    def _update_existing_set(self, set_data: Dict, weight: str, reps: str, notes: str) -> bool:
        """Update an existing set in the sheet"""
        try:
            # Find the row index in the sheet
            all_data_range = f"{SHEET_NAME}!A2:{chr(ord('A') + len(self.current_headers) - 1)}"
            result = self.service.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id,
                range=all_data_range
            ).execute()

            values = result.get("values", [])

            # Find matching row
            for i, row in enumerate(values):
                if (len(row) > 0 and row[0] == set_data.get('date') and
                    len(row) > 1 and row[1] == set_data.get('exercise') and
                    len(row) > 2 and row[2] == set_data.get('set_number')):

                    # Build update
                    updates = []
                    if weight is not None:
                        weight_col = self.current_headers.index("weight_lbs")
                        updates.append({
                            'range': f"{SHEET_NAME}!{chr(ord('A') + weight_col)}{i + 2}",
                            'values': [[weight]]
                        })

                    if reps is not None:
                        reps_col = self.current_headers.index("reps")
                        updates.append({
                            'range': f"{SHEET_NAME}!{chr(ord('A') + reps_col)}{i + 2}",
                            'values': [[reps]]
                        })

                    if notes is not None:
                        notes_col = self.current_headers.index("segment_note")
                        updates.append({
                            'range': f"{SHEET_NAME}!{chr(ord('A') + notes_col)}{i + 2}",
                            'values': [[notes]]
                        })

                    if updates:
                        batch_update_body = {
                            'valueInputOption': 'USER_ENTERED',
                            'data': updates
                        }

                        self.service.spreadsheets().values().batchUpdate(
                            spreadsheetId=self.spreadsheet_id,
                            body=batch_update_body
                        ).execute()

                        logger.info(f"Updated set for {set_data.get('exercise')} set {set_data.get('set_number')}")

                    return True

            logger.warning(f"Could not find row to update for {set_data.get('exercise')} set {set_data.get('set_number')}")
            return False

        except Exception as e:
            logger.error(f"Failed to update existing set: {e}")
            return False

    def _add_new_set_to_session(self, session: Dict, exercise: str, set_number: int, weight: str, reps: str, notes: str) -> bool:
        """Add a new set to the active session"""
        new_set = {
            "date": session["date"],
            "exercise": exercise,
            "set_number": str(set_number),
            "weight_lbs": weight or "",
            "reps": reps or "",
            "template": session["template"],
            "session_status": "active"
        }

        self.append_workout_data([new_set])
        logger.info(f"Added new set {set_number} for {exercise}")
        return True

    def complete_workout_session(self) -> bool:
        """Mark the active session as completed"""
        try:
            active_session = self.get_active_session()
            if not active_session:
                raise WorkoutAPIError("No active session to complete")

            logger.info(f"Completing workout session for {active_session['template']} on {active_session['date']}")

            # Get all data and update active rows to completed
            all_data_range = f"{SHEET_NAME}!A2:{chr(ord('A') + len(self.current_headers) - 1)}"
            result = self.service.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id,
                range=all_data_range
            ).execute()

            values = result.get("values", [])
            status_index = self.current_headers.index("session_status")

            # Find and update all active rows
            updates = []
            for i, row in enumerate(values):
                if len(row) > status_index and row[status_index] == "active":
                    # Update this row to completed
                    cell_range = f"{SHEET_NAME}!{chr(ord('A') + status_index)}{i + 2}"
                    updates.append({
                        'range': cell_range,
                        'values': [["completed"]]
                    })

            if updates:
                # Batch update all the status cells
                batch_update_body = {
                    'valueInputOption': 'USER_ENTERED',
                    'data': updates
                }

                self.service.spreadsheets().values().batchUpdate(
                    spreadsheetId=self.spreadsheet_id,
                    body=batch_update_body
                ).execute()

                logger.info(f"Updated {len(updates)} rows to completed status")

            # Clear tracked session
            self.current_session_info = None

            return True

        except Exception as e:
            logger.error(f"Failed to complete session: {e}")
            raise WorkoutAPIError(f"Failed to complete session: {e}")

    def cancel_workout_session(self) -> bool:
        """Cancel the active session (delete active rows)"""
        try:
            active_session = self.get_active_session()
            if not active_session:
                return True  # No active session to cancel

            logger.info(f"Canceling workout session for {active_session['template']} on {active_session['date']}")

            # Clear tracked session
            self.current_session_info = None

            # TODO: Implement deletion of active rows from sheet
            # For now, just clear the tracked session

            return True

        except Exception as e:
            logger.error(f"Failed to cancel session: {e}")
            raise WorkoutAPIError(f"Failed to cancel session: {e}")

# Initialize the API
api = WorkoutSheetsAPI()

# API Routes
@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "spreadsheet_id": api.spreadsheet_id,
        "spreadsheet_url": api.get_spreadsheet_url(),
        "timestamp": datetime.now().isoformat()
    })

@app.route('/api/templates', methods=['GET'])
def get_templates():
    """Get workout templates"""
    try:
        templates = api.get_workout_templates()
        return jsonify({
            "success": True,
            "templates": templates
        })
    except Exception as e:
        logger.error(f"Failed to get templates: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/workout', methods=['POST'])
def log_workout():
    """Log a new workout"""
    try:
        data = request.get_json()

        if not data:
            return jsonify({
                "success": False,
                "error": "No data provided"
            }), 400

        # Validate required fields
        required_fields = ["date", "template", "exercises"]
        for field in required_fields:
            if field not in data:
                return jsonify({
                    "success": False,
                    "error": f"Missing required field: {field}"
                }), 400

        # Convert exercises data to rows for the sheet
        workout_rows = []
        exercises = data["exercises"]

        for exercise_name, sets in exercises.items():
            for set_num, set_data in enumerate(sets, 1):
                workout_row = {
                    "date": data["date"],
                    "template": data["template"],
                    "exercise": exercise_name,
                    "set": str(set_num),
                    "weight": set_data.get("weight", ""),
                    "reps": set_data.get("reps", ""),
                    "notes": set_data.get("notes", ""),
                    "rpe": set_data.get("rpe", "")
                }
                workout_rows.append(workout_row)

        # Append to sheet
        success = api.append_workout_data(workout_rows)

        if success:
            return jsonify({
                "success": True,
                "message": f"Logged {len(workout_rows)} sets",
                "rows_added": len(workout_rows)
            })
        else:
            return jsonify({
                "success": False,
                "error": "Failed to log workout"
            }), 500

    except Exception as e:
        logger.error(f"Failed to log workout: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/workouts', methods=['GET'])
def get_recent_workouts():
    """Get recent workouts"""
    try:
        limit = request.args.get('limit', 50, type=int)
        workouts = api.get_recent_workouts(limit)

        return jsonify({
            "success": True,
            "workouts": workouts,
            "count": len(workouts)
        })
    except Exception as e:
        logger.error(f"Failed to get workouts: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/stats', methods=['GET'])
def get_workout_stats():
    """Get workout statistics"""
    try:
        workouts = api.get_recent_workouts(1000)  # Get more data for stats

        # Calculate basic statistics
        total_sets = len(workouts)
        unique_exercises = len(set(w["exercise"] for w in workouts if w["exercise"]))
        unique_dates = len(set(w["date"] for w in workouts if w["date"]))

        # Calculate total volume
        total_volume = 0
        for workout in workouts:
            if workout.get("volume"):
                try:
                    total_volume += float(workout["volume"])
                except (ValueError, TypeError):
                    pass

        # Exercise breakdown
        exercise_counts = {}
        for workout in workouts:
            exercise = workout.get("exercise", "")
            if exercise:
                exercise_counts[exercise] = exercise_counts.get(exercise, 0) + 1

        return jsonify({
            "success": True,
            "stats": {
                "total_workouts": unique_dates,
                "total_sets": total_sets,
                "unique_exercises": unique_exercises,
                "total_volume": total_volume,
                "exercise_breakdown": exercise_counts
            }
        })
    except Exception as e:
        logger.error(f"Failed to get stats: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/spreadsheet', methods=['GET'])
def get_spreadsheet_info():
    """Get spreadsheet information"""
    return jsonify({
        "success": True,
        "spreadsheet_id": api.spreadsheet_id,
        "spreadsheet_name": SPREADSHEET_NAME,
        "sheet_name": SHEET_NAME,
        "url": api.get_spreadsheet_url()
    })

@app.route('/api/headers', methods=['GET'])
def get_headers():
    """Get current sheet headers"""
    try:
        headers = api.get_current_headers()
        return jsonify({
            "success": True,
            "headers": headers,
            "count": len(headers)
        })
    except Exception as e:
        logger.error(f"Failed to get headers: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

# Session Management Endpoints
@app.route('/api/session/start', methods=['POST'])
def start_workout_session():
    """Start a new workout session"""
    try:
        data = request.get_json()
        template = data.get("template")
        date = data.get("date")  # Optional

        if not template:
            return jsonify({
                "success": False,
                "error": "Template is required"
            }), 400

        session_id = api.start_workout_session(template, date)
        return jsonify({
            "success": True,
            "session_id": session_id,
            "message": f"Started workout session for {template}"
        })

    except WorkoutAPIError as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 400
    except Exception as e:
        logger.error(f"Failed to start session: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/session/active', methods=['GET'])
def get_active_workout_session():
    """Get the current active workout session"""
    try:
        active_session = api.get_active_session()
        if active_session:
            return jsonify({
                "success": True,
                "session": active_session
            })
        else:
            return jsonify({
                "success": True,
                "session": None,
                "message": "No active session"
            })

    except Exception as e:
        logger.error(f"Failed to get active session: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/session/log-set', methods=['PUT'])
def log_set_in_session():
    """Log or update a set in the active session"""
    try:
        data = request.get_json()
        exercise = data.get("exercise")
        set_number = data.get("set_number")
        weight = data.get("weight")
        reps = data.get("reps")
        notes = data.get("notes")

        if not exercise or not set_number:
            return jsonify({
                "success": False,
                "error": "Exercise and set_number are required"
            }), 400

        success = api.update_set_in_session(exercise, int(set_number), weight, reps, notes)

        return jsonify({
            "success": True,
            "message": f"Updated {exercise} set {set_number}"
        })

    except WorkoutAPIError as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 400
    except Exception as e:
        logger.error(f"Failed to log set: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/session/complete', methods=['POST'])
def complete_workout_session():
    """Complete the active workout session"""
    try:
        success = api.complete_workout_session()
        return jsonify({
            "success": True,
            "message": "Workout session completed"
        })

    except WorkoutAPIError as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 400
    except Exception as e:
        logger.error(f"Failed to complete session: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/session/cancel', methods=['DELETE'])
def cancel_workout_session():
    """Cancel the active workout session"""
    try:
        success = api.cancel_workout_session()
        return jsonify({
            "success": True,
            "message": "Workout session canceled"
        })

    except Exception as e:
        logger.error(f"Failed to cancel session: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({
        "success": False,
        "error": "Endpoint not found"
    }), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({
        "success": False,
        "error": "Internal server error"
    }), 500

if __name__ == '__main__':
    from config import BACKEND_PORT, BACKEND_HOST, BACKEND_DEBUG, BACKEND_URL, print_config

    print("🚀 Starting Workout API Backend...")
    print_config()
    print(f"📊 Connected to spreadsheet: {SPREADSHEET_NAME}")
    print(f"📋 Using sheet: {SHEET_NAME}")
    print(f"🔗 API available at: {BACKEND_URL}")
    print("\nAPI Endpoints:")
    print("  GET  /api/health          - Health check")
    print("  GET  /api/templates       - Get workout templates")
    print("  POST /api/workout         - Log a workout")
    print("  GET  /api/workouts        - Get recent workouts")
    print("  GET  /api/stats           - Get workout statistics")
    print("  GET  /api/spreadsheet     - Get spreadsheet info")

    app.run(debug=BACKEND_DEBUG, host='0.0.0.0', port=BACKEND_PORT)