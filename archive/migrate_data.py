#!/usr/bin/env python3
"""
Data Migration Tool for Workout App
Migrate data from existing JavaScript/CSV/JSON formats to the new Python system.
"""

import os
import sys
import json
import csv
import re
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional, Union
from pathlib import Path
import argparse

from workout_db import WorkoutDB, WorkoutEntry

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class DataMigrator:
    """Handles migration of workout data from various sources"""

    def __init__(self, target_spreadsheet: str = "Migrated Workout Log"):
        self.target_db = None
        self.target_spreadsheet = target_spreadsheet
        self.migration_stats = {
            "total_processed": 0,
            "successful_imports": 0,
            "failed_imports": 0,
            "skipped_entries": 0,
            "errors": []
        }

    def _ensure_target_db(self):
        """Ensure target database is initialized"""
        if not self.target_db:
            print(f"🔄 Initializing target database: {self.target_spreadsheet}")
            self.target_db = WorkoutDB(self.target_spreadsheet)
            print(f"✅ Target database ready: {self.target_db.get_spreadsheet_url()}")

    def _parse_date(self, date_str: str) -> Optional[str]:
        """Parse date from various formats"""
        if not date_str:
            return None

        # Remove any extra whitespace
        date_str = str(date_str).strip()

        # Common date formats to try
        formats = [
            "%Y-%m-%d",           # 2024-01-15
            "%m/%d/%Y",           # 01/15/2024
            "%m-%d-%Y",           # 01-15-2024
            "%d/%m/%Y",           # 15/01/2024 (European)
            "%Y/%m/%d",           # 2024/01/15
            "%B %d, %Y",          # January 15, 2024
            "%b %d, %Y",          # Jan 15, 2024
            "%d %B %Y",           # 15 January 2024
            "%Y-%m-%d %H:%M:%S",  # 2024-01-15 14:30:00
            "%Y-%m-%dT%H:%M:%S",  # 2024-01-15T14:30:00
        ]

        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt).strftime("%Y-%m-%d")
            except ValueError:
                continue

        # Try parsing Unix timestamp
        try:
            timestamp = float(date_str)
            return datetime.fromtimestamp(timestamp).strftime("%Y-%m-%d")
        except (ValueError, OSError):
            pass

        logger.warning(f"Could not parse date: {date_str}")
        return None

    def _parse_numeric(self, value: Any) -> Optional[float]:
        """Parse numeric value from various formats"""
        if value is None or value == "":
            return None

        # Convert to string and clean
        value_str = str(value).strip()

        if not value_str:
            return None

        # Remove common non-numeric characters
        value_str = re.sub(r'[^\d\.-]', '', value_str)

        try:
            return float(value_str)
        except ValueError:
            return None

    def migrate_from_csv(self, csv_file: str, mapping: Optional[Dict[str, str]] = None) -> int:
        """
        Migrate data from CSV file

        Args:
            csv_file: Path to CSV file
            mapping: Column mapping dict, e.g., {"Date": "workout_date", "Exercise": "exercise_name"}
        """
        self._ensure_target_db()

        print(f"📄 Migrating from CSV: {csv_file}")

        if not os.path.exists(csv_file):
            raise FileNotFoundError(f"CSV file not found: {csv_file}")

        # Default column mapping (can be overridden)
        default_mapping = {
            "date": ["date", "workout_date", "Date", "DATE"],
            "template": ["template", "workout", "Template", "TEMPLATE", "Workout"],
            "exercise": ["exercise", "Exercise", "EXERCISE", "exercise_name"],
            "set": ["set", "Set", "SET", "set_number", "set_num"],
            "weight": ["weight", "Weight", "WEIGHT", "lbs", "kg"],
            "reps": ["reps", "Reps", "REPS", "repetitions", "rep"],
            "notes": ["notes", "Notes", "NOTES", "comment", "comments"]
        }

        entries = []
        errors = []

        try:
            with open(csv_file, 'r', encoding='utf-8') as f:
                # Try to detect delimiter
                sample = f.read(1024)
                f.seek(0)

                delimiter = ','
                if sample.count(';') > sample.count(','):
                    delimiter = ';'
                elif sample.count('\t') > sample.count(','):
                    delimiter = '\t'

                reader = csv.DictReader(f, delimiter=delimiter)
                headers = reader.fieldnames

                print(f"📊 Found columns: {headers}")

                # Auto-detect column mapping if not provided
                if not mapping:
                    mapping = {}
                    for target_field, possible_names in default_mapping.items():
                        for header in headers:
                            if header.lower().strip() in [name.lower() for name in possible_names]:
                                mapping[target_field] = header
                                break

                print(f"🔗 Using mapping: {mapping}")

                row_count = 0
                for row in reader:
                    row_count += 1
                    self.migration_stats["total_processed"] += 1

                    try:
                        # Extract and clean data
                        date_str = row.get(mapping.get("date", ""), "").strip()
                        template = row.get(mapping.get("template", ""), "Default").strip()
                        exercise = row.get(mapping.get("exercise", ""), "").strip()
                        set_num_str = row.get(mapping.get("set", ""), "1").strip()
                        weight_str = row.get(mapping.get("weight", ""), "").strip()
                        reps_str = row.get(mapping.get("reps", ""), "").strip()
                        notes = row.get(mapping.get("notes", ""), "").strip()

                        # Validate required fields
                        if not exercise:
                            logger.warning(f"Row {row_count}: Missing exercise, skipping")
                            self.migration_stats["skipped_entries"] += 1
                            continue

                        # Parse and validate data
                        date = self._parse_date(date_str) or datetime.now().strftime("%Y-%m-%d")
                        set_number = int(set_num_str) if set_num_str else 1
                        weight = self._parse_numeric(weight_str)
                        reps = int(self._parse_numeric(reps_str)) if self._parse_numeric(reps_str) else None

                        # Create entry
                        entry = WorkoutEntry(
                            date=date,
                            template=template or "Imported",
                            exercise=exercise,
                            set_number=set_number,
                            weight=weight,
                            reps=reps,
                            notes=notes if notes else None
                        )

                        entries.append(entry)

                    except Exception as e:
                        error_msg = f"Row {row_count}: {e}"
                        errors.append(error_msg)
                        logger.error(error_msg)
                        self.migration_stats["failed_imports"] += 1

        except Exception as e:
            raise Exception(f"Error reading CSV file: {e}")

        # Bulk insert entries
        if entries:
            try:
                print(f"💾 Inserting {len(entries)} entries...")
                inserted_count = self.target_db.insert(entries)
                self.migration_stats["successful_imports"] += inserted_count
                print(f"✅ Successfully imported {inserted_count} entries from CSV")
            except Exception as e:
                logger.error(f"Failed to insert entries: {e}")
                self.migration_stats["failed_imports"] += len(entries)

        # Report errors
        if errors:
            print(f"⚠️ Encountered {len(errors)} errors:")
            for error in errors[:10]:  # Show first 10 errors
                print(f"  - {error}")
            if len(errors) > 10:
                print(f"  ... and {len(errors) - 10} more errors")

        return len(entries)

    def migrate_from_json(self, json_file: str, format_type: str = "auto") -> int:
        """
        Migrate data from JSON file

        Args:
            json_file: Path to JSON file
            format_type: Format type - 'auto', 'backup', 'localstorage', 'custom'
        """
        self._ensure_target_db()

        print(f"📄 Migrating from JSON: {json_file}")

        if not os.path.exists(json_file):
            raise FileNotFoundError(f"JSON file not found: {json_file}")

        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except json.JSONDecodeError as e:
            raise Exception(f"Invalid JSON file: {e}")

        entries = []

        if format_type == "auto":
            # Try to detect format
            if "entries" in data and isinstance(data["entries"], list):
                format_type = "backup"
            elif isinstance(data, list):
                format_type = "array"
            elif "workoutHistory" in data:
                format_type = "localstorage"
            else:
                format_type = "custom"

        print(f"📋 Detected format: {format_type}")

        if format_type == "backup":
            # Our own backup format
            entries_data = data.get("entries", [])
            for entry_data in entries_data:
                try:
                    entry = WorkoutEntry(**entry_data)
                    entries.append(entry)
                    self.migration_stats["successful_imports"] += 1
                except Exception as e:
                    logger.error(f"Failed to parse backup entry: {e}")
                    self.migration_stats["failed_imports"] += 1

        elif format_type == "array":
            # Array of workout objects
            for i, item in enumerate(data):
                self.migration_stats["total_processed"] += 1
                try:
                    entry = self._parse_generic_workout_object(item, i)
                    if entry:
                        entries.append(entry)
                        self.migration_stats["successful_imports"] += 1
                    else:
                        self.migration_stats["skipped_entries"] += 1
                except Exception as e:
                    logger.error(f"Failed to parse array item {i}: {e}")
                    self.migration_stats["failed_imports"] += 1

        elif format_type == "localstorage":
            # LocalStorage format from JavaScript app
            workout_history = data.get("workoutHistory", [])
            for i, workout in enumerate(workout_history):
                self.migration_stats["total_processed"] += 1
                try:
                    entries.extend(self._parse_js_workout(workout, i))
                    self.migration_stats["successful_imports"] += 1
                except Exception as e:
                    logger.error(f"Failed to parse JS workout {i}: {e}")
                    self.migration_stats["failed_imports"] += 1

        else:
            # Custom format - try to parse generically
            entries.extend(self._parse_custom_json(data))

        # Insert entries
        if entries:
            try:
                print(f"💾 Inserting {len(entries)} entries...")
                inserted_count = self.target_db.insert(entries)
                print(f"✅ Successfully imported {inserted_count} entries from JSON")
            except Exception as e:
                logger.error(f"Failed to insert entries: {e}")

        return len(entries)

    def _parse_js_workout(self, workout: Dict[str, Any], index: int) -> List[WorkoutEntry]:
        """Parse JavaScript workout object from localStorage"""
        entries = []

        date = self._parse_date(workout.get("date")) or datetime.now().strftime("%Y-%m-%d")
        template = workout.get("template", "Imported")
        exercises = workout.get("exercises", {})

        for exercise_name, sets in exercises.items():
            if isinstance(sets, list):
                for set_index, set_data in enumerate(sets, 1):
                    try:
                        entry = WorkoutEntry(
                            date=date,
                            template=template,
                            exercise=exercise_name,
                            set_number=set_index,
                            weight=self._parse_numeric(set_data.get("weight")),
                            reps=int(self._parse_numeric(set_data.get("reps"))) if self._parse_numeric(set_data.get("reps")) else None,
                            notes=set_data.get("notes")
                        )
                        entries.append(entry)
                    except Exception as e:
                        logger.error(f"Failed to parse set in workout {index}: {e}")

        return entries

    def _parse_generic_workout_object(self, obj: Dict[str, Any], index: int) -> Optional[WorkoutEntry]:
        """Parse a generic workout object"""
        try:
            # Try to map common field names
            field_mappings = {
                "date": ["date", "workout_date", "timestamp", "when"],
                "template": ["template", "workout", "routine", "split"],
                "exercise": ["exercise", "movement", "lift", "exercise_name"],
                "set_number": ["set", "set_number", "set_num", "setNum"],
                "weight": ["weight", "load", "lbs", "kg"],
                "reps": ["reps", "repetitions", "rep_count"],
                "notes": ["notes", "comment", "description"]
            }

            mapped_data = {}
            for target_field, possible_keys in field_mappings.items():
                for key in possible_keys:
                    if key in obj:
                        mapped_data[target_field] = obj[key]
                        break

            # Ensure required fields
            if "exercise" not in mapped_data:
                return None

            return WorkoutEntry(
                date=self._parse_date(mapped_data.get("date")) or datetime.now().strftime("%Y-%m-%d"),
                template=mapped_data.get("template", "Imported"),
                exercise=mapped_data["exercise"],
                set_number=int(mapped_data.get("set_number", 1)),
                weight=self._parse_numeric(mapped_data.get("weight")),
                reps=int(self._parse_numeric(mapped_data.get("reps"))) if self._parse_numeric(mapped_data.get("reps")) else None,
                notes=mapped_data.get("notes")
            )

        except Exception as e:
            logger.error(f"Failed to parse generic object {index}: {e}")
            return None

    def _parse_custom_json(self, data: Dict[str, Any]) -> List[WorkoutEntry]:
        """Parse custom JSON format"""
        entries = []
        # This would need to be customized based on the specific format
        logger.warning("Custom JSON parsing not implemented - please use CSV or implement custom parser")
        return entries

    def migrate_from_google_sheets(self, source_spreadsheet_id: str, sheet_name: str = "Sheet1") -> int:
        """Migrate data from another Google Sheets spreadsheet"""
        self._ensure_target_db()

        print(f"📊 Migrating from Google Sheets: {source_spreadsheet_id}")

        # Create a temporary WorkoutDB instance for the source
        try:
            # We'll use the Sheets API directly for more flexibility
            from googleapiclient.discovery import build
            from google.oauth2.credentials import Credentials

            # Use the same credentials as our target DB
            creds_file = "token.json"
            if not os.path.exists(creds_file):
                raise FileNotFoundError("No authentication token found. Run the target DB initialization first.")

            creds = Credentials.from_authorized_user_file(creds_file, ["https://www.googleapis.com/auth/spreadsheets"])
            service = build("sheets", "v4", credentials=creds)

            # Get data from source spreadsheet
            range_name = f"{sheet_name}!A:Z"
            result = service.spreadsheets().values().get(
                spreadsheetId=source_spreadsheet_id,
                range=range_name
            ).execute()

            values = result.get("values", [])

            if not values:
                print("No data found in source spreadsheet")
                return 0

            # Assume first row is headers
            headers = values[0]
            data_rows = values[1:]

            print(f"📊 Found {len(data_rows)} rows with headers: {headers}")

            # Convert to entries
            entries = []
            for i, row in enumerate(data_rows, 1):
                self.migration_stats["total_processed"] += 1
                try:
                    # Pad row to match header length
                    padded_row = row + [""] * (len(headers) - len(row))
                    row_dict = dict(zip(headers, padded_row))

                    entry = self._parse_generic_workout_object(row_dict, i)
                    if entry:
                        entries.append(entry)
                        self.migration_stats["successful_imports"] += 1
                    else:
                        self.migration_stats["skipped_entries"] += 1

                except Exception as e:
                    logger.error(f"Failed to parse row {i}: {e}")
                    self.migration_stats["failed_imports"] += 1

            # Insert entries
            if entries:
                print(f"💾 Inserting {len(entries)} entries...")
                inserted_count = self.target_db.insert(entries)
                print(f"✅ Successfully migrated {inserted_count} entries from Google Sheets")

            return len(entries)

        except Exception as e:
            raise Exception(f"Failed to migrate from Google Sheets: {e}")

    def print_migration_summary(self):
        """Print migration statistics"""
        print("\n" + "=" * 50)
        print("📊 MIGRATION SUMMARY")
        print("=" * 50)
        print(f"Total Processed: {self.migration_stats['total_processed']}")
        print(f"Successful Imports: {self.migration_stats['successful_imports']}")
        print(f"Failed Imports: {self.migration_stats['failed_imports']}")
        print(f"Skipped Entries: {self.migration_stats['skipped_entries']}")

        if self.migration_stats['total_processed'] > 0:
            success_rate = (self.migration_stats['successful_imports'] / self.migration_stats['total_processed']) * 100
            print(f"Success Rate: {success_rate:.1f}%")

        if self.migration_stats['errors']:
            print(f"\nErrors encountered: {len(self.migration_stats['errors'])}")

        if self.target_db:
            print(f"\n🔗 View migrated data: {self.target_db.get_spreadsheet_url()}")

def main():
    """Main migration tool"""
    parser = argparse.ArgumentParser(
        description="Migrate workout data to the new Python system",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --csv workouts.csv                    # Migrate from CSV
  %(prog)s --json backup.json                    # Migrate from JSON backup
  %(prog)s --json localStorage.json --format localstorage  # From JS localStorage
  %(prog)s --sheets 1ABC123... --sheet "Workout Log"      # From Google Sheets
  %(prog)s --csv workouts.csv --target "My Workouts"      # Custom target name

Supported formats:
  - CSV files with workout data
  - JSON backups from this system
  - JavaScript localStorage dumps
  - Other Google Sheets spreadsheets
        """
    )

    parser.add_argument('--csv', help='CSV file to migrate from')
    parser.add_argument('--json', help='JSON file to migrate from')
    parser.add_argument('--sheets', help='Google Sheets ID to migrate from')
    parser.add_argument('--sheet', default='Sheet1', help='Sheet name in Google Sheets (default: Sheet1)')
    parser.add_argument('--format', choices=['auto', 'backup', 'localstorage', 'array', 'custom'],
                       default='auto', help='JSON format type (default: auto-detect)')
    parser.add_argument('--target', default='Migrated Workout Log',
                       help='Target spreadsheet name (default: "Migrated Workout Log")')
    parser.add_argument('--mapping', help='JSON file with column mapping for CSV')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be migrated without actually doing it')

    args = parser.parse_args()

    if not any([args.csv, args.json, args.sheets]):
        parser.print_help()
        return

    # Load column mapping if provided
    mapping = None
    if args.mapping and os.path.exists(args.mapping):
        with open(args.mapping, 'r') as f:
            mapping = json.load(f)

    # Initialize migrator
    migrator = DataMigrator(args.target)

    try:
        print("🚀 Starting data migration...")
        print(f"📊 Target spreadsheet: {args.target}")

        if args.dry_run:
            print("🔍 DRY RUN MODE - No data will be actually migrated")

        total_migrated = 0

        # Migrate from CSV
        if args.csv:
            if not args.dry_run:
                count = migrator.migrate_from_csv(args.csv, mapping)
                total_migrated += count
            else:
                print(f"Would migrate from CSV: {args.csv}")

        # Migrate from JSON
        if args.json:
            if not args.dry_run:
                count = migrator.migrate_from_json(args.json, args.format)
                total_migrated += count
            else:
                print(f"Would migrate from JSON: {args.json} (format: {args.format})")

        # Migrate from Google Sheets
        if args.sheets:
            if not args.dry_run:
                count = migrator.migrate_from_google_sheets(args.sheets, args.sheet)
                total_migrated += count
            else:
                print(f"Would migrate from Google Sheets: {args.sheets} (sheet: {args.sheet})")

        if not args.dry_run:
            migrator.print_migration_summary()
            print(f"\n🎉 Migration completed! Total entries migrated: {total_migrated}")

    except KeyboardInterrupt:
        print("\n⚠️ Migration interrupted by user")
        migrator.print_migration_summary()

    except Exception as e:
        print(f"\n💥 Migration failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()