#!/usr/bin/env python3
"""
Workout CLI - Command-line interface for workout logging
A powerful CLI for managing workout data with Google Sheets backend.
"""

import argparse
import sys
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import logging
from tabulate import tabulate
from workout_db import WorkoutDB, WorkoutEntry

# Configure logging for CLI
logging.basicConfig(level=logging.WARNING)  # Only show warnings/errors by default

class WorkoutCLI:
    """Command-line interface for workout management"""

    def __init__(self):
        self.db = None
        self.verbose = False

    def _ensure_db(self):
        """Ensure database connection is established"""
        if not self.db:
            try:
                print("🔄 Connecting to Google Sheets...")
                self.db = WorkoutDB()
                print(f"✅ Connected to spreadsheet: {self.db.get_spreadsheet_url()}")
            except Exception as e:
                print(f"❌ Failed to connect to Google Sheets: {e}")
                sys.exit(1)

    def _parse_date(self, date_str: str) -> str:
        """Parse date string with flexible formats"""
        if not date_str or date_str.lower() == "today":
            return datetime.now().strftime("%Y-%m-%d")

        if date_str.lower() == "yesterday":
            return (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")

        # Try to parse various date formats
        formats = [
            "%Y-%m-%d",      # 2024-01-15
            "%m/%d/%Y",      # 01/15/2024
            "%m-%d-%Y",      # 01-15-2024
            "%m/%d",         # 01/15 (current year)
            "%m-%d",         # 01-15 (current year)
        ]

        for fmt in formats:
            try:
                if "%Y" not in fmt:
                    # Add current year
                    date_str_with_year = f"{date_str}/{datetime.now().year}"
                    return datetime.strptime(date_str_with_year, f"{fmt}/%Y").strftime("%Y-%m-%d")
                else:
                    return datetime.strptime(date_str, fmt).strftime("%Y-%m-%d")
            except ValueError:
                continue

        raise ValueError(f"Could not parse date: {date_str}")

    def add(self, args):
        """Add a new workout entry"""
        self._ensure_db()

        try:
            date = self._parse_date(args.date)

            entry = WorkoutEntry(
                date=date,
                template=args.template,
                exercise=args.exercise,
                set_number=args.set,
                weight=args.weight,
                reps=args.reps,
                notes=args.notes
            )

            self.db.insert(entry)
            print(f"✅ Added: {date} | {args.template} | {args.exercise} | Set {args.set} | {args.weight}lb x {args.reps}")

        except Exception as e:
            print(f"❌ Failed to add entry: {e}")
            sys.exit(1)

    def log_workout(self, args):
        """Log a complete workout interactively"""
        self._ensure_db()

        try:
            print("🏋️ Workout Logger - Interactive Mode")
            print("=" * 40)

            # Get workout details
            date = input(f"Date (YYYY-MM-DD, or 'today') [{datetime.now().strftime('%Y-%m-%d')}]: ").strip()
            if not date:
                date = datetime.now().strftime("%Y-%m-%d")
            else:
                date = self._parse_date(date)

            template = input("Template name (e.g., 'Upper 1', 'Lower 2'): ").strip()
            if not template:
                print("❌ Template name is required")
                return

            print(f"\n📝 Logging workout for {date} - {template}")
            print("Enter exercises (press Enter with empty exercise name to finish):\n")

            entries = []
            while True:
                exercise = input("Exercise name: ").strip()
                if not exercise:
                    break

                print(f"  Sets for {exercise} (press Enter with empty weight to finish exercise):")
                set_number = 1

                while True:
                    weight_input = input(f"    Set {set_number} - Weight (lbs): ").strip()
                    if not weight_input:
                        break

                    try:
                        weight = float(weight_input)
                    except ValueError:
                        print("    ❌ Invalid weight, please enter a number")
                        continue

                    reps_input = input(f"    Set {set_number} - Reps: ").strip()
                    try:
                        reps = int(reps_input) if reps_input else None
                    except ValueError:
                        print("    ❌ Invalid reps, please enter a number")
                        continue

                    notes = input(f"    Set {set_number} - Notes (optional): ").strip()

                    entry = WorkoutEntry(
                        date=date,
                        template=template,
                        exercise=exercise,
                        set_number=set_number,
                        weight=weight,
                        reps=reps,
                        notes=notes if notes else None
                    )

                    entries.append(entry)
                    print(f"    ✅ Set {set_number}: {weight}lb x {reps}")
                    set_number += 1

            if entries:
                print(f"\n📤 Saving {len(entries)} sets to Google Sheets...")
                self.db.insert(entries)
                print(f"✅ Workout logged successfully!")
                print(f"📊 View online: {self.db.get_spreadsheet_url()}")
            else:
                print("ℹ️ No entries to save.")

        except KeyboardInterrupt:
            print("\n\n❌ Workout logging cancelled.")
        except Exception as e:
            print(f"❌ Failed to log workout: {e}")

    def query(self, args):
        """Query workout data with filters"""
        self._ensure_db()

        try:
            # Build WHERE clause from arguments
            where = {}

            if args.exercise:
                where['exercise'] = args.exercise

            if args.template:
                where['template'] = args.template

            if args.date:
                where['date'] = self._parse_date(args.date)

            if args.min_weight:
                where['weight'] = {"operator": ">=", "value": args.min_weight}

            if args.min_reps:
                where['reps'] = {"operator": ">=", "value": args.min_reps}

            # Execute query
            entries = self.db.select(
                where=where if where else None,
                order_by=args.order_by,
                limit=args.limit
            )

            if not entries:
                print("No entries found matching your criteria.")
                return

            # Format output
            if args.format == 'json':
                output = [entry.__dict__ for entry in entries]
                print(json.dumps(output, indent=2))

            elif args.format == 'csv':
                print("Date,Template,Exercise,Set,Weight,Reps,Notes")
                for entry in entries:
                    print(",".join(entry.to_row()))

            else:  # table format
                headers = ["Date", "Template", "Exercise", "Set", "Weight", "Reps", "Notes"]
                rows = [entry.to_row() for entry in entries]
                print(tabulate(rows, headers=headers, tablefmt="grid"))

            print(f"\n📊 Found {len(entries)} entries")

        except Exception as e:
            print(f"❌ Query failed: {e}")
            sys.exit(1)

    def stats(self, args):
        """Show workout statistics"""
        self._ensure_db()

        try:
            stats = self.db.get_stats()

            print("📊 Workout Statistics")
            print("=" * 30)
            print(f"Total Workouts: {stats['total_workouts']}")
            print(f"Total Sets: {stats['total_sets']}")
            print(f"Total Volume: {stats['total_volume']:,.0f} lbs")
            print(f"Unique Exercises: {stats['unique_exercises']}")

            if stats['date_range']['earliest']:
                print(f"Date Range: {stats['date_range']['earliest']} to {stats['date_range']['latest']}")

            if args.detailed:
                print("\n🏋️ Exercise Breakdown:")
                exercise_items = sorted(stats['exercise_breakdown'].items(), key=lambda x: x[1], reverse=True)
                for exercise, count in exercise_items[:10]:  # Top 10
                    print(f"  {exercise}: {count} sets")

                print("\n📋 Template Breakdown:")
                template_items = sorted(stats['template_breakdown'].items(), key=lambda x: x[1], reverse=True)
                for template, count in template_items:
                    print(f"  {template}: {count} sets")

        except Exception as e:
            print(f"❌ Failed to get stats: {e}")
            sys.exit(1)

    def recent(self, args):
        """Show recent workouts"""
        self._ensure_db()

        try:
            # Get recent entries
            entries = self.db.select(
                order_by="date DESC",
                limit=args.days * 10  # Rough estimate, we'll filter by date
            )

            if not entries:
                print("No workout data found.")
                return

            # Filter by date range
            cutoff_date = (datetime.now() - timedelta(days=args.days)).strftime("%Y-%m-%d")
            recent_entries = [e for e in entries if e.date >= cutoff_date]

            if not recent_entries:
                print(f"No workouts found in the last {args.days} days.")
                return

            # Group by date and template for summary
            workouts_by_date = {}
            for entry in recent_entries:
                key = f"{entry.date} - {entry.template}"
                if key not in workouts_by_date:
                    workouts_by_date[key] = []
                workouts_by_date[key].append(entry)

            print(f"🗓️ Recent Workouts (Last {args.days} days)")
            print("=" * 40)

            for workout_key in sorted(workouts_by_date.keys(), reverse=True):
                entries_for_workout = workouts_by_date[workout_key]
                exercises = {}

                # Group by exercise
                for entry in entries_for_workout:
                    if entry.exercise not in exercises:
                        exercises[entry.exercise] = []
                    exercises[entry.exercise].append(entry)

                print(f"\n📅 {workout_key}")
                for exercise, sets in exercises.items():
                    set_summary = []
                    for s in sets:
                        if s.weight and s.reps:
                            set_summary.append(f"{s.weight}x{s.reps}")
                        elif s.weight:
                            set_summary.append(f"{s.weight}lb")
                        elif s.reps:
                            set_summary.append(f"{s.reps} reps")

                    if set_summary:
                        print(f"  {exercise}: {' | '.join(set_summary)}")

        except Exception as e:
            print(f"❌ Failed to get recent workouts: {e}")
            sys.exit(1)

    def backup(self, args):
        """Backup workout data to JSON"""
        self._ensure_db()

        try:
            filename = self.db.backup_to_json(args.filename)
            print(f"✅ Backup created: {filename}")

        except Exception as e:
            print(f"❌ Backup failed: {e}")
            sys.exit(1)

    def restore(self, args):
        """Restore workout data from JSON backup"""
        self._ensure_db()

        try:
            if args.clear:
                confirm = input("⚠️ This will CLEAR ALL existing data. Type 'CONFIRM' to proceed: ")
                if confirm != "CONFIRM":
                    print("❌ Restore cancelled.")
                    return

            count = self.db.restore_from_json(args.filename, clear_existing=args.clear)
            print(f"✅ Restored {count} entries from {args.filename}")

        except Exception as e:
            print(f"❌ Restore failed: {e}")
            sys.exit(1)

    def pr(self, args):
        """Find personal records"""
        self._ensure_db()

        try:
            # Get all entries for the exercise
            where = {"exercise": args.exercise} if args.exercise else None
            entries = self.db.select(where=where)

            if not entries:
                exercise_msg = f" for {args.exercise}" if args.exercise else ""
                print(f"No entries found{exercise_msg}.")
                return

            # Find PRs by weight
            exercise_prs = {}
            for entry in entries:
                if not entry.weight:
                    continue

                exercise = entry.exercise
                if exercise not in exercise_prs or entry.weight > exercise_prs[exercise]['weight']:
                    exercise_prs[exercise] = {
                        'weight': entry.weight,
                        'reps': entry.reps,
                        'date': entry.date,
                        'entry': entry
                    }

            if not exercise_prs:
                print("No PRs found (no weight data available).")
                return

            print("🏆 Personal Records (by Weight)")
            print("=" * 40)

            # Sort by weight descending
            sorted_prs = sorted(exercise_prs.items(), key=lambda x: x[1]['weight'], reverse=True)

            for exercise, pr_data in sorted_prs:
                weight = pr_data['weight']
                reps = pr_data['reps']
                date = pr_data['date']
                reps_str = f" x {reps}" if reps else ""
                print(f"{exercise}: {weight}lb{reps_str} on {date}")

        except Exception as e:
            print(f"❌ Failed to find PRs: {e}")
            sys.exit(1)

def main():
    """Main CLI entry point"""
    parser = argparse.ArgumentParser(
        description="Workout Logger CLI - Manage your workout data with Google Sheets",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s log                           # Interactive workout logging
  %(prog)s add "Bench Press" 185 8      # Quick add single set
  %(prog)s query --exercise "Squat"     # Find all squat sets
  %(prog)s stats --detailed             # Show detailed statistics
  %(prog)s recent --days 7              # Show last 7 days of workouts
  %(prog)s pr --exercise "Deadlift"     # Find deadlift PR
  %(prog)s backup                       # Backup all data to JSON
        """
    )

    parser.add_argument('-v', '--verbose', action='store_true', help='Enable verbose output')

    subparsers = parser.add_subparsers(dest='command', help='Available commands')

    # Add command
    add_parser = subparsers.add_parser('add', help='Add a single workout entry')
    add_parser.add_argument('exercise', help='Exercise name')
    add_parser.add_argument('weight', type=float, help='Weight in pounds')
    add_parser.add_argument('reps', type=int, help='Number of repetitions')
    add_parser.add_argument('--template', '-t', default='Manual Entry', help='Workout template name')
    add_parser.add_argument('--set', '-s', type=int, default=1, help='Set number')
    add_parser.add_argument('--date', '-d', help='Date (YYYY-MM-DD, or "today")')
    add_parser.add_argument('--notes', '-n', help='Additional notes')

    # Log command (interactive)
    log_parser = subparsers.add_parser('log', help='Log a complete workout interactively')

    # Query command
    query_parser = subparsers.add_parser('query', help='Query workout data')
    query_parser.add_argument('--exercise', '-e', help='Filter by exercise name')
    query_parser.add_argument('--template', '-t', help='Filter by template name')
    query_parser.add_argument('--date', '-d', help='Filter by date')
    query_parser.add_argument('--min-weight', type=float, help='Minimum weight filter')
    query_parser.add_argument('--min-reps', type=int, help='Minimum reps filter')
    query_parser.add_argument('--order-by', default='date DESC', help='Sort order (e.g., "weight DESC", "date ASC")')
    query_parser.add_argument('--limit', '-l', type=int, help='Limit number of results')
    query_parser.add_argument('--format', choices=['table', 'json', 'csv'], default='table', help='Output format')

    # Stats command
    stats_parser = subparsers.add_parser('stats', help='Show workout statistics')
    stats_parser.add_argument('--detailed', action='store_true', help='Show detailed breakdown')

    # Recent command
    recent_parser = subparsers.add_parser('recent', help='Show recent workouts')
    recent_parser.add_argument('--days', type=int, default=7, help='Number of days to look back')

    # PR command
    pr_parser = subparsers.add_parser('pr', help='Find personal records')
    pr_parser.add_argument('--exercise', '-e', help='Specific exercise (if not provided, shows all PRs)')

    # Backup command
    backup_parser = subparsers.add_parser('backup', help='Backup data to JSON file')
    backup_parser.add_argument('--filename', '-f', help='Backup filename (auto-generated if not provided)')

    # Restore command
    restore_parser = subparsers.add_parser('restore', help='Restore data from JSON backup')
    restore_parser.add_argument('filename', help='Backup filename to restore from')
    restore_parser.add_argument('--clear', action='store_true', help='Clear existing data before restore')

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    # Set up CLI instance
    cli = WorkoutCLI()
    cli.verbose = args.verbose

    if args.verbose:
        logging.getLogger().setLevel(logging.INFO)

    # Route to appropriate command
    command_map = {
        'add': cli.add,
        'log': cli.log_workout,
        'query': cli.query,
        'stats': cli.stats,
        'recent': cli.recent,
        'pr': cli.pr,
        'backup': cli.backup,
        'restore': cli.restore,
    }

    if args.command in command_map:
        command_map[args.command](args)
    else:
        print(f"Unknown command: {args.command}")
        parser.print_help()

if __name__ == "__main__":
    main()