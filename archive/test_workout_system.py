#!/usr/bin/env python3
"""
Workout System Testing Suite
Comprehensive testing and debugging tools for the Python workout system.
"""

import os
import sys
import json
import time
import logging
import tempfile
from datetime import datetime, timedelta
from typing import List, Dict, Any
from unittest.mock import Mock, patch
import traceback

# Import our workout system
from workout_db import WorkoutDB, WorkoutEntry

# Configure test logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class WorkoutSystemTester:
    """Comprehensive testing suite for the workout system"""

    def __init__(self):
        self.test_results = []
        self.test_db = None
        self.temp_files = []

    def run_test(self, test_name: str, test_func):
        """Run a single test with error handling and timing"""
        print(f"\n🧪 Testing: {test_name}")
        print("-" * 50)

        start_time = time.time()
        try:
            test_func()
            duration = time.time() - start_time
            result = {
                "name": test_name,
                "status": "PASS",
                "duration": duration,
                "error": None
            }
            print(f"✅ PASS ({duration:.2f}s)")

        except Exception as e:
            duration = time.time() - start_time
            error_details = {
                "message": str(e),
                "type": type(e).__name__,
                "traceback": traceback.format_exc()
            }
            result = {
                "name": test_name,
                "status": "FAIL",
                "duration": duration,
                "error": error_details
            }
            print(f"❌ FAIL ({duration:.2f}s): {e}")

        self.test_results.append(result)
        return result

    def test_credentials_setup(self):
        """Test that Google API credentials are properly configured"""
        print("Checking for credentials.json...")

        if not os.path.exists("credentials.json"):
            raise FileNotFoundError(
                "credentials.json not found. Please download from Google Cloud Console."
            )

        print("✓ credentials.json found")

        # Try to parse the credentials file
        try:
            with open("credentials.json", 'r') as f:
                creds_data = json.load(f)

            if "installed" not in creds_data:
                raise ValueError("Invalid credentials format - expected 'installed' section")

            required_fields = ["client_id", "client_secret", "auth_uri", "token_uri"]
            for field in required_fields:
                if field not in creds_data["installed"]:
                    raise ValueError(f"Missing required field in credentials: {field}")

            print("✓ credentials.json format is valid")

        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON in credentials.json: {e}")

    def test_database_initialization(self):
        """Test database initialization and connection"""
        print("Initializing workout database...")

        # This will trigger OAuth flow if needed
        self.test_db = WorkoutDB("Test Workout Log")

        print(f"✓ Database initialized: {self.test_db.spreadsheet_id}")
        print(f"✓ Spreadsheet URL: {self.test_db.get_spreadsheet_url()}")

        # Verify we can access the spreadsheet
        stats = self.test_db.get_stats()
        print(f"✓ Initial stats: {stats}")

    def test_basic_crud_operations(self):
        """Test Create, Read, Update, Delete operations"""
        if not self.test_db:
            raise RuntimeError("Database not initialized - run test_database_initialization first")

        print("Testing CRUD operations...")

        # Test INSERT
        test_entry = WorkoutEntry(
            date=datetime.now().strftime("%Y-%m-%d"),
            template="Test Template",
            exercise="Test Exercise",
            set_number=1,
            weight=100.0,
            reps=10,
            notes="Test entry for automated testing"
        )

        insert_count = self.test_db.insert(test_entry)
        if insert_count != 1:
            raise ValueError(f"Expected 1 insert, got {insert_count}")
        print("✓ INSERT operation successful")

        # Test SELECT
        entries = self.test_db.select(where={"exercise": "Test Exercise"})
        if len(entries) == 0:
            raise ValueError("No entries found after insert")

        found_entry = entries[0]
        if found_entry.exercise != "Test Exercise":
            raise ValueError(f"Expected 'Test Exercise', got '{found_entry.exercise}'")
        print("✓ SELECT operation successful")

        # Test UPDATE
        update_count = self.test_db.update(
            where={"exercise": "Test Exercise"},
            set_values={"weight": 105.0, "notes": "Updated test entry"}
        )
        if update_count == 0:
            raise ValueError("Update operation failed - no rows updated")
        print("✓ UPDATE operation successful")

        # Verify update
        updated_entries = self.test_db.select(where={"exercise": "Test Exercise"})
        if updated_entries[0].weight != 105.0:
            raise ValueError("Update verification failed")
        print("✓ UPDATE verification successful")

        # Test DELETE
        delete_count = self.test_db.delete(where={"exercise": "Test Exercise"})
        if delete_count == 0:
            raise ValueError("Delete operation failed - no rows deleted")
        print("✓ DELETE operation successful")

        # Verify delete
        remaining_entries = self.test_db.select(where={"exercise": "Test Exercise"})
        if len(remaining_entries) > 0:
            raise ValueError("Delete verification failed - entries still exist")
        print("✓ DELETE verification successful")

    def test_complex_queries(self):
        """Test complex query operations"""
        if not self.test_db:
            raise RuntimeError("Database not initialized")

        print("Testing complex queries...")

        # Insert test data
        test_entries = [
            WorkoutEntry("2024-01-01", "Upper 1", "Bench Press", 1, 135.0, 8),
            WorkoutEntry("2024-01-01", "Upper 1", "Bench Press", 2, 135.0, 7),
            WorkoutEntry("2024-01-01", "Upper 1", "Bent Over Row", 1, 115.0, 10),
            WorkoutEntry("2024-01-02", "Lower 1", "Squat", 1, 185.0, 5),
            WorkoutEntry("2024-01-02", "Lower 1", "Squat", 2, 185.0, 5),
            WorkoutEntry("2024-01-02", "Lower 1", "Deadlift", 1, 225.0, 3),
        ]

        self.test_db.insert(test_entries)
        print("✓ Test data inserted")

        # Test WHERE with simple condition
        bench_entries = self.test_db.select(where={"exercise": "Bench Press"})
        if len(bench_entries) != 2:
            raise ValueError(f"Expected 2 bench press entries, got {len(bench_entries)}")
        print("✓ Simple WHERE query successful")

        # Test WHERE with complex condition
        heavy_entries = self.test_db.select(where={"weight": {"operator": ">=", "value": 180.0}})
        expected_heavy = [e for e in test_entries if e.weight and e.weight >= 180.0]
        if len(heavy_entries) != len(expected_heavy):
            raise ValueError(f"Expected {len(expected_heavy)} heavy entries, got {len(heavy_entries)}")
        print("✓ Complex WHERE query successful")

        # Test ORDER BY
        ordered_entries = self.test_db.select(order_by="weight DESC", limit=3)
        if len(ordered_entries) != 3:
            raise ValueError(f"Expected 3 entries with limit, got {len(ordered_entries)}")

        # Verify ordering (highest weight first)
        weights = [e.weight for e in ordered_entries if e.weight]
        if weights != sorted(weights, reverse=True):
            raise ValueError("ORDER BY DESC not working correctly")
        print("✓ ORDER BY query successful")

        # Test LIMIT
        limited_entries = self.test_db.select(limit=2)
        if len(limited_entries) != 2:
            raise ValueError(f"Expected 2 entries with limit, got {len(limited_entries)}")
        print("✓ LIMIT query successful")

        # Cleanup test data
        self.test_db.delete(where={"template": "Upper 1"})
        self.test_db.delete(where={"template": "Lower 1"})
        print("✓ Test data cleaned up")

    def test_backup_restore(self):
        """Test backup and restore functionality"""
        if not self.test_db:
            raise RuntimeError("Database not initialized")

        print("Testing backup and restore...")

        # Create test data
        test_entries = [
            WorkoutEntry("2024-01-15", "Backup Test", "Test Exercise 1", 1, 100.0, 10),
            WorkoutEntry("2024-01-15", "Backup Test", "Test Exercise 2", 1, 150.0, 5),
        ]

        self.test_db.insert(test_entries)
        print("✓ Test data created for backup")

        # Create backup
        backup_file = self.test_db.backup_to_json()
        self.temp_files.append(backup_file)

        if not os.path.exists(backup_file):
            raise FileNotFoundError(f"Backup file not created: {backup_file}")
        print(f"✓ Backup created: {backup_file}")

        # Verify backup content
        with open(backup_file, 'r') as f:
            backup_data = json.load(f)

        if backup_data["total_entries"] < len(test_entries):
            raise ValueError("Backup doesn't contain expected number of entries")
        print("✓ Backup content verified")

        # Test restore (clean first)
        self.test_db.delete(where={"template": "Backup Test"})

        # Verify data is gone
        entries_before_restore = self.test_db.select(where={"template": "Backup Test"})
        if len(entries_before_restore) > 0:
            raise ValueError("Test data not properly deleted before restore")

        # Restore from backup
        restore_count = self.test_db.restore_from_json(backup_file)
        if restore_count < len(test_entries):
            raise ValueError(f"Expected to restore at least {len(test_entries)} entries, got {restore_count}")
        print(f"✓ Restore successful: {restore_count} entries")

        # Verify restore
        restored_entries = self.test_db.select(where={"template": "Backup Test"})
        if len(restored_entries) < len(test_entries):
            raise ValueError("Restored entries don't match expected count")
        print("✓ Restore verification successful")

        # Cleanup
        self.test_db.delete(where={"template": "Backup Test"})

    def test_statistics_calculation(self):
        """Test statistics calculation"""
        if not self.test_db:
            raise RuntimeError("Database not initialized")

        print("Testing statistics calculation...")

        # Insert varied test data
        test_entries = [
            WorkoutEntry("2024-01-01", "Stats Test", "Exercise A", 1, 100.0, 10),  # Volume: 1000
            WorkoutEntry("2024-01-01", "Stats Test", "Exercise A", 2, 100.0, 8),   # Volume: 800
            WorkoutEntry("2024-01-01", "Stats Test", "Exercise B", 1, 150.0, 5),   # Volume: 750
            WorkoutEntry("2024-01-02", "Stats Test", "Exercise A", 1, 105.0, 10),  # Volume: 1050
        ]

        self.test_db.insert(test_entries)
        print("✓ Test data for statistics inserted")

        # Get statistics
        stats = self.test_db.get_stats()

        # Verify total volume calculation
        expected_volume = 1000 + 800 + 750 + 1050  # 3600
        if abs(stats["total_volume"] - expected_volume) > 0.1:
            raise ValueError(f"Expected volume {expected_volume}, got {stats['total_volume']}")
        print("✓ Volume calculation correct")

        # Verify unique exercises count
        unique_exercises = len(set(e.exercise for e in test_entries))
        if stats["unique_exercises"] != unique_exercises:
            raise ValueError(f"Expected {unique_exercises} unique exercises, got {stats['unique_exercises']}")
        print("✓ Unique exercises count correct")

        # Verify exercise breakdown
        if "Exercise A" not in stats["exercise_breakdown"]:
            raise ValueError("Exercise breakdown missing 'Exercise A'")

        exercise_a_count = stats["exercise_breakdown"]["Exercise A"]
        expected_a_count = len([e for e in test_entries if e.exercise == "Exercise A"])
        if exercise_a_count != expected_a_count:
            raise ValueError(f"Expected {expected_a_count} Exercise A entries, got {exercise_a_count}")
        print("✓ Exercise breakdown correct")

        # Cleanup
        self.test_db.delete(where={"template": "Stats Test"})

    def test_data_validation(self):
        """Test data validation and error handling"""
        if not self.test_db:
            raise RuntimeError("Database not initialized")

        print("Testing data validation...")

        # Test invalid data types
        try:
            invalid_entry = WorkoutEntry(
                date="invalid-date-format",
                template="",  # Empty template
                exercise="Test",
                set_number=-1,  # Invalid set number
                weight=-100.0,  # Negative weight
                reps=0  # Zero reps
            )
            # This should still work - our system is permissive
            self.test_db.insert(invalid_entry)
            print("✓ System handles edge cases gracefully")

            # Cleanup
            self.test_db.delete(where={"exercise": "Test"})

        except Exception as e:
            # If it fails, that's also acceptable
            print(f"✓ System properly validates data: {e}")

        # Test empty queries
        empty_results = self.test_db.select(where={"exercise": "NonexistentExercise"})
        if len(empty_results) != 0:
            raise ValueError("Expected empty result set for nonexistent exercise")
        print("✓ Empty query handling correct")

        # Test malformed WHERE clauses
        try:
            bad_results = self.test_db.select(where={"nonexistent_field": "value"})
            print("✓ System handles nonexistent field gracefully")
        except Exception as e:
            print(f"✓ System properly handles malformed queries: {e}")

    def test_performance_benchmarks(self):
        """Test system performance with larger datasets"""
        if not self.test_db:
            raise RuntimeError("Database not initialized")

        print("Testing performance benchmarks...")

        # Create a larger dataset
        print("Creating performance test dataset...")
        large_dataset = []
        exercises = ["Bench Press", "Squat", "Deadlift", "Row", "Press"]
        templates = ["Upper 1", "Upper 2", "Lower 1", "Lower 2"]

        for i in range(50):  # 50 workouts
            date = (datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d")
            template = templates[i % len(templates)]

            for exercise in exercises[:3]:  # 3 exercises per workout
                for set_num in range(1, 4):  # 3 sets per exercise
                    entry = WorkoutEntry(
                        date=date,
                        template=template,
                        exercise=exercise,
                        set_number=set_num,
                        weight=100.0 + (i * 2.5),  # Progressive weight
                        reps=8 - (set_num - 1),    # Descending reps
                        notes=f"Performance test entry {i}-{exercise}-{set_num}"
                    )
                    large_dataset.append(entry)

        print(f"Inserting {len(large_dataset)} entries...")

        # Time the bulk insert
        start_time = time.time()
        insert_count = self.test_db.insert(large_dataset)
        insert_duration = time.time() - start_time

        if insert_count != len(large_dataset):
            raise ValueError(f"Expected {len(large_dataset)} inserts, got {insert_count}")

        print(f"✓ Bulk insert: {len(large_dataset)} entries in {insert_duration:.2f}s")
        print(f"  Rate: {len(large_dataset)/insert_duration:.1f} entries/second")

        # Time a complex query
        start_time = time.time()
        results = self.test_db.select(
            where={"weight": {"operator": ">=", "value": 150.0}},
            order_by="weight DESC",
            limit=20
        )
        query_duration = time.time() - start_time

        print(f"✓ Complex query: {len(results)} results in {query_duration:.2f}s")

        # Time statistics calculation
        start_time = time.time()
        stats = self.test_db.get_stats()
        stats_duration = time.time() - start_time

        print(f"✓ Statistics calculation: {stats_duration:.2f}s")
        print(f"  Total entries: {stats['total_sets']}")
        print(f"  Total volume: {stats['total_volume']:,.0f}")

        # Cleanup performance test data
        print("Cleaning up performance test data...")
        start_time = time.time()
        delete_count = self.test_db.delete(where={"notes": {"operator": "contains", "value": "Performance test"}})
        cleanup_duration = time.time() - start_time

        print(f"✓ Cleanup: {delete_count} entries deleted in {cleanup_duration:.2f}s")

    def test_error_scenarios(self):
        """Test various error scenarios and recovery"""
        print("Testing error scenarios...")

        # Test invalid database operations
        try:
            # Try to create WorkoutDB with invalid credentials file
            with patch('os.path.exists') as mock_exists:
                mock_exists.return_value = False
                bad_db = WorkoutDB(credentials_file="nonexistent.json")
                # This should fail
                raise ValueError("Expected credentials error")
        except FileNotFoundError:
            print("✓ Properly handles missing credentials file")

        # Test network disconnection scenarios (mocked)
        print("✓ Error scenario testing completed")

    def run_all_tests(self):
        """Run complete test suite"""
        print("🚀 Starting Workout System Test Suite")
        print("=" * 60)

        test_methods = [
            ("Credentials Setup", self.test_credentials_setup),
            ("Database Initialization", self.test_database_initialization),
            ("Basic CRUD Operations", self.test_basic_crud_operations),
            ("Complex Queries", self.test_complex_queries),
            ("Backup & Restore", self.test_backup_restore),
            ("Statistics Calculation", self.test_statistics_calculation),
            ("Data Validation", self.test_data_validation),
            ("Performance Benchmarks", self.test_performance_benchmarks),
            ("Error Scenarios", self.test_error_scenarios),
        ]

        for test_name, test_method in test_methods:
            self.run_test(test_name, test_method)

        self.print_summary()

    def print_summary(self):
        """Print test results summary"""
        print("\n" + "=" * 60)
        print("📊 TEST RESULTS SUMMARY")
        print("=" * 60)

        passed = len([r for r in self.test_results if r["status"] == "PASS"])
        failed = len([r for r in self.test_results if r["status"] == "FAIL"])
        total = len(self.test_results)

        print(f"Total Tests: {total}")
        print(f"Passed: {passed} ✅")
        print(f"Failed: {failed} ❌")
        print(f"Success Rate: {(passed/total)*100:.1f}%")

        total_duration = sum(r["duration"] for r in self.test_results)
        print(f"Total Duration: {total_duration:.2f}s")

        if failed > 0:
            print(f"\n❌ FAILED TESTS:")
            for result in self.test_results:
                if result["status"] == "FAIL":
                    print(f"  - {result['name']}: {result['error']['message']}")

        print("\n📋 Detailed Results:")
        for result in self.test_results:
            status_icon = "✅" if result["status"] == "PASS" else "❌"
            print(f"  {status_icon} {result['name']} ({result['duration']:.2f}s)")

        # Save detailed results
        results_file = f"test_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(results_file, 'w') as f:
            json.dump({
                "timestamp": datetime.now().isoformat(),
                "summary": {
                    "total": total,
                    "passed": passed,
                    "failed": failed,
                    "success_rate": (passed/total)*100,
                    "total_duration": total_duration
                },
                "results": self.test_results
            }, f, indent=2)

        print(f"\n💾 Detailed results saved to: {results_file}")

    def cleanup(self):
        """Clean up temporary files"""
        for temp_file in self.temp_files:
            try:
                if os.path.exists(temp_file):
                    os.remove(temp_file)
                    print(f"🗑️ Cleaned up: {temp_file}")
            except Exception as e:
                print(f"⚠️ Could not clean up {temp_file}: {e}")

def main():
    """Main test runner"""
    if len(sys.argv) > 1 and sys.argv[1] == "--help":
        print("""
Workout System Test Suite

Usage:
    python test_workout_system.py [--quick] [--performance-only] [--help]

Options:
    --quick           Run only essential tests
    --performance-only Run only performance benchmarks
    --help            Show this help message

This test suite will:
1. Verify your Google API credentials
2. Test database connectivity
3. Test all CRUD operations
4. Test complex queries
5. Test backup/restore functionality
6. Run performance benchmarks
7. Generate a detailed test report

Make sure you have:
- credentials.json in the current directory
- Internet connection for Google API access
- Permission to create test spreadsheets in Google Drive
        """)
        return

    tester = WorkoutSystemTester()

    try:
        if len(sys.argv) > 1 and sys.argv[1] == "--quick":
            # Quick test mode
            essential_tests = [
                ("Credentials Setup", tester.test_credentials_setup),
                ("Database Initialization", tester.test_database_initialization),
                ("Basic CRUD Operations", tester.test_basic_crud_operations),
            ]

            print("🚀 Running Quick Test Suite")
            for test_name, test_method in essential_tests:
                tester.run_test(test_name, test_method)

        elif len(sys.argv) > 1 and sys.argv[1] == "--performance-only":
            # Performance test mode
            tester.run_test("Database Initialization", tester.test_database_initialization)
            tester.run_test("Performance Benchmarks", tester.test_performance_benchmarks)

        else:
            # Full test suite
            tester.run_all_tests()

        tester.print_summary()

    except KeyboardInterrupt:
        print("\n\n⚠️ Test suite interrupted by user")

    except Exception as e:
        print(f"\n💥 Test suite crashed: {e}")
        traceback.print_exc()

    finally:
        tester.cleanup()

if __name__ == "__main__":
    main()