"""
Workout Database Manager - Python Google Sheets Integration
A robust, SQL-like interface for workout data stored in Google Sheets.
"""

import os
import json
import logging
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass, asdict
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('workout_app.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Constants
SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.metadata.readonly",
]
SHEETS_MIME = "application/vnd.google-apps.spreadsheet"
DEFAULT_SHEET_NAME = "Workout Log"
HEADERS = ["Date", "Template", "Exercise", "Set", "Weight", "Reps", "Notes"]

@dataclass
class WorkoutSet:
    """Represents a single set of an exercise"""
    weight: Optional[float] = None
    reps: Optional[int] = None
    notes: Optional[str] = None

@dataclass
class WorkoutEntry:
    """Represents a complete workout entry"""
    date: str
    template: str
    exercise: str
    set_number: int
    weight: Optional[float] = None
    reps: Optional[int] = None
    notes: Optional[str] = None

    def to_row(self) -> List[str]:
        """Convert to spreadsheet row format"""
        return [
            self.date,
            self.template,
            self.exercise,
            str(self.set_number),
            str(self.weight) if self.weight is not None else "",
            str(self.reps) if self.reps is not None else "",
            self.notes or ""
        ]

    @classmethod
    def from_row(cls, row: List[str]) -> 'WorkoutEntry':
        """Create WorkoutEntry from spreadsheet row"""
        # Pad row with empty strings if needed
        row = row + [""] * (7 - len(row))

        return cls(
            date=row[0],
            template=row[1],
            exercise=row[2],
            set_number=int(row[3]) if row[3] else 1,
            weight=float(row[4]) if row[4] else None,
            reps=int(row[5]) if row[5] else None,
            notes=row[6] if row[6] else None
        )

class WorkoutDB:
    """SQL-like interface for Google Sheets workout database"""

    def __init__(self, spreadsheet_name: str = "Workout Log", credentials_file: str = "credentials.json"):
        self.spreadsheet_name = spreadsheet_name
        self.credentials_file = credentials_file
        self.spreadsheet_id = None
        self.service_sheets = None
        self.service_drive = None
        self._cache = {}
        self._cache_timestamp = None
        self._cache_ttl = 300  # 5 minutes

        logger.info(f"Initializing WorkoutDB with spreadsheet: {spreadsheet_name}")
        self._authenticate()
        self._ensure_spreadsheet()

    def _authenticate(self):
        """Handle OAuth2 authentication"""
        try:
            creds = None
            if os.path.exists("token.json"):
                creds = Credentials.from_authorized_user_file("token.json", SCOPES)
                logger.info("Loaded existing credentials from token.json")

            if not creds or not creds.valid:
                if creds and creds.expired and creds.refresh_token:
                    logger.info("Refreshing expired credentials")
                    creds.refresh(Request())
                else:
                    logger.info("Starting OAuth2 flow for new credentials")
                    if not os.path.exists(self.credentials_file):
                        raise FileNotFoundError(
                            f"Credentials file not found: {self.credentials_file}\n"
                            "Please download credentials.json from Google Cloud Console"
                        )

                    flow = InstalledAppFlow.from_client_secrets_file(self.credentials_file, SCOPES)
                    creds = flow.run_local_server(port=0)

                # Save credentials for future use
                with open("token.json", "w") as f:
                    f.write(creds.to_json())
                logger.info("Saved new credentials to token.json")

            # Build services
            self.service_sheets = build("sheets", "v4", credentials=creds)
            self.service_drive = build("drive", "v3", credentials=creds)
            logger.info("Successfully authenticated and built Google API services")

        except Exception as e:
            logger.error(f"Authentication failed: {e}")
            raise

    def _ensure_spreadsheet(self):
        """Find or create the workout spreadsheet"""
        try:
            # Search for existing spreadsheet
            safe_title = self.spreadsheet_name.replace("'", r"\'")
            query = f"name = '{safe_title}' and mimeType = '{SHEETS_MIME}' and trashed = false"

            result = self.service_drive.files().list(
                q=query,
                fields="files(id,name,modifiedTime,webViewLink)",
                orderBy="modifiedTime desc",
                pageSize=1,
                includeItemsFromAllDrives=True,
                supportsAllDrives=True,
            ).execute()

            files = result.get("files", [])

            if files:
                self.spreadsheet_id = files[0]["id"]
                logger.info(f"Found existing spreadsheet: {self.spreadsheet_id}")
                self._ensure_headers()
            else:
                # Create new spreadsheet
                logger.info(f"Creating new spreadsheet: {self.spreadsheet_name}")
                spreadsheet_body = {
                    "properties": {"title": self.spreadsheet_name},
                    "sheets": [{
                        "properties": {
                            "title": DEFAULT_SHEET_NAME,
                            "gridProperties": {
                                "rowCount": 1000,
                                "columnCount": len(HEADERS)
                            }
                        }
                    }]
                }

                result = self.service_sheets.spreadsheets().create(body=spreadsheet_body).execute()
                self.spreadsheet_id = result["spreadsheetId"]
                logger.info(f"Created new spreadsheet: {self.spreadsheet_id}")

                # Add headers and formatting
                self._setup_new_spreadsheet()

        except Exception as e:
            logger.error(f"Failed to ensure spreadsheet: {e}")
            raise

    def _ensure_headers(self):
        """Ensure the spreadsheet has proper headers"""
        try:
            # Get first row
            result = self.service_sheets.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id,
                range=f"{DEFAULT_SHEET_NAME}!A1:G1"
            ).execute()

            values = result.get("values", [])

            if not values or values[0] != HEADERS:
                logger.info("Headers missing or incorrect, adding proper headers")
                self._add_headers()

        except Exception as e:
            logger.warning(f"Could not check headers: {e}")
            # Try to add headers anyway
            self._add_headers()

    def _add_headers(self):
        """Add headers to the spreadsheet"""
        try:
            self.service_sheets.spreadsheets().values().update(
                spreadsheetId=self.spreadsheet_id,
                range=f"{DEFAULT_SHEET_NAME}!A1:G1",
                valueInputOption="RAW",
                body={"values": [HEADERS]}
            ).execute()
            logger.info("Added headers to spreadsheet")

        except Exception as e:
            logger.error(f"Failed to add headers: {e}")

    def _setup_new_spreadsheet(self):
        """Set up a new spreadsheet with headers and formatting"""
        try:
            # Add headers
            self._add_headers()

            # Format headers (bold, background color)
            requests = [{
                "repeatCell": {
                    "range": {
                        "sheetId": 0,
                        "startRowIndex": 0,
                        "endRowIndex": 1
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

            self.service_sheets.spreadsheets().batchUpdate(
                spreadsheetId=self.spreadsheet_id,
                body={"requests": requests}
            ).execute()

            logger.info("Formatted headers in new spreadsheet")

        except Exception as e:
            logger.error(f"Failed to format new spreadsheet: {e}")

    def _get_all_data(self, use_cache: bool = True) -> List[List[str]]:
        """Get all data from spreadsheet with optional caching"""
        cache_key = "all_data"
        current_time = time.time()

        # Check cache
        if (use_cache and
            cache_key in self._cache and
            self._cache_timestamp and
            current_time - self._cache_timestamp < self._cache_ttl):
            logger.debug("Using cached data")
            return self._cache[cache_key]

        try:
            result = self.service_sheets.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id,
                range=f"{DEFAULT_SHEET_NAME}!A2:G"  # Skip header row
            ).execute()

            values = result.get("values", [])

            # Update cache
            self._cache[cache_key] = values
            self._cache_timestamp = current_time

            logger.debug(f"Retrieved {len(values)} rows from spreadsheet")
            return values

        except Exception as e:
            logger.error(f"Failed to get data: {e}")
            raise

    def _clear_cache(self):
        """Clear the data cache"""
        self._cache.clear()
        self._cache_timestamp = None
        logger.debug("Cleared data cache")

    def insert(self, entries: Union[WorkoutEntry, List[WorkoutEntry]]) -> int:
        """Insert one or more workout entries"""
        if isinstance(entries, WorkoutEntry):
            entries = [entries]

        if not entries:
            return 0

        try:
            # Convert entries to rows
            rows = [entry.to_row() for entry in entries]

            # Append to spreadsheet
            result = self.service_sheets.spreadsheets().values().append(
                spreadsheetId=self.spreadsheet_id,
                range=f"{DEFAULT_SHEET_NAME}!A:G",
                valueInputOption="RAW",
                body={"values": rows}
            ).execute()

            self._clear_cache()

            updated_rows = result.get("updates", {}).get("updatedRows", len(rows))
            logger.info(f"Inserted {updated_rows} workout entries")

            return updated_rows

        except Exception as e:
            logger.error(f"Failed to insert entries: {e}")
            raise

    def select(self,
               where: Optional[Dict[str, Any]] = None,
               order_by: Optional[str] = None,
               limit: Optional[int] = None,
               columns: Optional[List[str]] = None) -> List[WorkoutEntry]:
        """Select workout entries with SQL-like filtering"""

        try:
            # Get all data
            data = self._get_all_data()

            # Convert to WorkoutEntry objects
            entries = []
            for row in data:
                if row:  # Skip empty rows
                    try:
                        entries.append(WorkoutEntry.from_row(row))
                    except Exception as e:
                        logger.warning(f"Skipping invalid row: {row}, error: {e}")

            # Apply WHERE clause
            if where:
                entries = self._apply_where_clause(entries, where)

            # Apply ORDER BY
            if order_by:
                entries = self._apply_order_by(entries, order_by)

            # Apply LIMIT
            if limit:
                entries = entries[:limit]

            logger.info(f"Selected {len(entries)} entries")
            return entries

        except Exception as e:
            logger.error(f"Failed to select entries: {e}")
            raise

    def _apply_where_clause(self, entries: List[WorkoutEntry], where: Dict[str, Any]) -> List[WorkoutEntry]:
        """Apply WHERE clause filtering"""
        filtered = []

        for entry in entries:
            match = True

            for field, condition in where.items():
                value = getattr(entry, field, None)

                if isinstance(condition, dict):
                    # Complex condition like {"operator": ">", "value": 100}
                    operator = condition.get("operator", "=")
                    target = condition.get("value")

                    if operator == "=":
                        if value != target:
                            match = False
                    elif operator == ">":
                        if not (value and value > target):
                            match = False
                    elif operator == ">=":
                        if not (value and value >= target):
                            match = False
                    elif operator == "<":
                        if not (value and value < target):
                            match = False
                    elif operator == "<=":
                        if not (value and value <= target):
                            match = False
                    elif operator == "!=":
                        if value == target:
                            match = False
                    elif operator == "contains":
                        if not (value and str(target).lower() in str(value).lower()):
                            match = False
                    elif operator == "startswith":
                        if not (value and str(value).lower().startswith(str(target).lower())):
                            match = False
                else:
                    # Simple equality check
                    if value != condition:
                        match = False

                if not match:
                    break

            if match:
                filtered.append(entry)

        return filtered

    def _apply_order_by(self, entries: List[WorkoutEntry], order_by: str) -> List[WorkoutEntry]:
        """Apply ORDER BY sorting"""
        parts = order_by.split()
        field = parts[0]
        direction = parts[1].upper() if len(parts) > 1 else "ASC"

        reverse = direction == "DESC"

        try:
            # Handle different field types
            if field == "date":
                entries.sort(key=lambda x: datetime.strptime(x.date, "%Y-%m-%d") if x.date else datetime.min, reverse=reverse)
            elif field in ["weight", "reps", "set_number"]:
                entries.sort(key=lambda x: getattr(x, field) or 0, reverse=reverse)
            else:
                entries.sort(key=lambda x: str(getattr(x, field) or ""), reverse=reverse)

        except Exception as e:
            logger.warning(f"Failed to sort by {order_by}: {e}")

        return entries

    def update(self, where: Dict[str, Any], set_values: Dict[str, Any]) -> int:
        """Update entries matching WHERE clause"""
        try:
            # Get all data
            data = self._get_all_data(use_cache=False)

            # Track changes
            updated_count = 0
            updated_rows = []

            for i, row in enumerate(data):
                if not row:
                    updated_rows.append(row)
                    continue

                try:
                    entry = WorkoutEntry.from_row(row)

                    # Check if this entry matches WHERE clause
                    matches = True
                    for field, condition in where.items():
                        value = getattr(entry, field, None)
                        if value != condition:
                            matches = False
                            break

                    if matches:
                        # Update the entry
                        for field, new_value in set_values.items():
                            if hasattr(entry, field):
                                setattr(entry, field, new_value)

                        updated_rows.append(entry.to_row())
                        updated_count += 1
                    else:
                        updated_rows.append(row)

                except Exception as e:
                    logger.warning(f"Skipping invalid row during update: {row}, error: {e}")
                    updated_rows.append(row)

            if updated_count > 0:
                # Write back all data
                self.service_sheets.spreadsheets().values().update(
                    spreadsheetId=self.spreadsheet_id,
                    range=f"{DEFAULT_SHEET_NAME}!A2:G{len(updated_rows) + 1}",
                    valueInputOption="RAW",
                    body={"values": updated_rows}
                ).execute()

                self._clear_cache()
                logger.info(f"Updated {updated_count} entries")

            return updated_count

        except Exception as e:
            logger.error(f"Failed to update entries: {e}")
            raise

    def delete(self, where: Dict[str, Any]) -> int:
        """Delete entries matching WHERE clause"""
        try:
            # Get all data
            data = self._get_all_data(use_cache=False)

            # Filter out entries that match WHERE clause
            remaining_rows = []
            deleted_count = 0

            for row in data:
                if not row:
                    continue

                try:
                    entry = WorkoutEntry.from_row(row)

                    # Check if this entry matches WHERE clause
                    matches = True
                    for field, condition in where.items():
                        value = getattr(entry, field, None)
                        if value != condition:
                            matches = False
                            break

                    if matches:
                        deleted_count += 1
                    else:
                        remaining_rows.append(row)

                except Exception as e:
                    logger.warning(f"Skipping invalid row during delete: {row}, error: {e}")
                    remaining_rows.append(row)

            if deleted_count > 0:
                # Clear the sheet and write back remaining data
                self._clear_sheet_data()

                if remaining_rows:
                    self.service_sheets.spreadsheets().values().update(
                        spreadsheetId=self.spreadsheet_id,
                        range=f"{DEFAULT_SHEET_NAME}!A2:G{len(remaining_rows) + 1}",
                        valueInputOption="RAW",
                        body={"values": remaining_rows}
                    ).execute()

                self._clear_cache()
                logger.info(f"Deleted {deleted_count} entries")

            return deleted_count

        except Exception as e:
            logger.error(f"Failed to delete entries: {e}")
            raise

    def _clear_sheet_data(self):
        """Clear all data from sheet (keeping headers)"""
        try:
            self.service_sheets.spreadsheets().values().clear(
                spreadsheetId=self.spreadsheet_id,
                range=f"{DEFAULT_SHEET_NAME}!A2:G"
            ).execute()

        except Exception as e:
            logger.error(f"Failed to clear sheet data: {e}")
            raise

    def get_stats(self) -> Dict[str, Any]:
        """Get workout statistics"""
        try:
            entries = self.select()

            if not entries:
                return {"total_workouts": 0, "total_sets": 0, "total_volume": 0}

            # Calculate stats
            total_sets = len(entries)
            total_volume = sum(
                (entry.weight or 0) * (entry.reps or 0)
                for entry in entries
            )

            # Unique workout days
            unique_dates = len(set(entry.date for entry in entries if entry.date))

            # Exercise breakdown
            exercise_counts = {}
            for entry in entries:
                exercise_counts[entry.exercise] = exercise_counts.get(entry.exercise, 0) + 1

            # Template breakdown
            template_counts = {}
            for entry in entries:
                template_counts[entry.template] = template_counts.get(entry.template, 0) + 1

            return {
                "total_workouts": unique_dates,
                "total_sets": total_sets,
                "total_volume": total_volume,
                "unique_exercises": len(exercise_counts),
                "exercise_breakdown": exercise_counts,
                "template_breakdown": template_counts,
                "date_range": {
                    "earliest": min((entry.date for entry in entries if entry.date), default=None),
                    "latest": max((entry.date for entry in entries if entry.date), default=None)
                }
            }

        except Exception as e:
            logger.error(f"Failed to get stats: {e}")
            raise

    def get_spreadsheet_url(self) -> str:
        """Get the URL to view the spreadsheet"""
        return f"https://docs.google.com/spreadsheets/d/{self.spreadsheet_id}"

    def backup_to_json(self, filename: Optional[str] = None) -> str:
        """Backup all data to JSON file"""
        if not filename:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"workout_backup_{timestamp}.json"

        try:
            entries = self.select()
            data = {
                "backup_timestamp": datetime.now().isoformat(),
                "spreadsheet_id": self.spreadsheet_id,
                "spreadsheet_name": self.spreadsheet_name,
                "total_entries": len(entries),
                "entries": [asdict(entry) for entry in entries]
            }

            with open(filename, 'w') as f:
                json.dump(data, f, indent=2)

            logger.info(f"Backed up {len(entries)} entries to {filename}")
            return filename

        except Exception as e:
            logger.error(f"Failed to backup data: {e}")
            raise

    def restore_from_json(self, filename: str, clear_existing: bool = False) -> int:
        """Restore data from JSON backup"""
        try:
            with open(filename, 'r') as f:
                data = json.load(f)

            entries = [WorkoutEntry(**entry_data) for entry_data in data.get("entries", [])]

            if clear_existing:
                logger.info("Clearing existing data before restore")
                self._clear_sheet_data()
                self._clear_cache()

            if entries:
                count = self.insert(entries)
                logger.info(f"Restored {count} entries from {filename}")
                return count
            else:
                logger.warning("No entries found in backup file")
                return 0

        except Exception as e:
            logger.error(f"Failed to restore from backup: {e}")
            raise