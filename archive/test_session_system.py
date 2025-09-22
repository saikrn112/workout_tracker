#!/usr/bin/env python3
"""
Comprehensive Session System Test Suite
Creates a test sheet and performs exhaustive CRUD testing on session functionality
"""

import os
import json
import sys
import time
import requests
from datetime import datetime
from typing import Dict, List, Any
import logging

# Configure detailed logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('session_tests.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class SessionTestSuite:
    def __init__(self):
        self.base_url = "http://localhost:5001/api"
        self.test_results = []
        self.test_session_id = None
        self.test_start_time = datetime.now().isoformat()

        # Test data
        self.test_template = "upper1"
        self.test_exercises = [
            "Pec dec fly",
            "DB Incline bench press",
            "DB lateral raises",
            "Lat pulldown (Moderate load)",
            "Flat bar cable curls",
            "Tricep pushdowns"
        ]

    def log_test_result(self, test_name: str, status: str, details: str = "", data: Dict = None):
        """Log test result with timestamp and details"""
        result = {
            "timestamp": datetime.now().isoformat(),
            "test_name": test_name,
            "status": status,  # PASS, FAIL, ERROR
            "details": details,
            "data": data or {}
        }
        self.test_results.append(result)

        status_icon = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
        logger.info(f"{status_icon} {test_name}: {status} - {details}")

    def make_request(self, method: str, endpoint: str, data: Dict = None) -> Dict:
        """Make HTTP request with error handling"""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"

        try:
            if method.upper() == "GET":
                response = requests.get(url, timeout=10)
            elif method.upper() == "POST":
                response = requests.post(url, json=data, timeout=10)
            elif method.upper() == "PUT":
                response = requests.put(url, json=data, timeout=10)
            elif method.upper() == "DELETE":
                response = requests.delete(url, timeout=10)
            else:
                raise ValueError(f"Unsupported method: {method}")

            response_data = response.json()
            return {
                "status_code": response.status_code,
                "data": response_data,
                "success": response_data.get("success", False)
            }
        except Exception as e:
            return {
                "status_code": 0,
                "data": {"error": str(e)},
                "success": False
            }

    def test_01_backend_health(self):
        """Test 1: Backend Health Check"""
        response = self.make_request("GET", "/health")

        if response["success"] and response["status_code"] == 200:
            self.log_test_result(
                "01_Backend_Health",
                "PASS",
                f"Backend healthy, spreadsheet: {response['data'].get('spreadsheet_id', 'N/A')[:20]}..."
            )
        else:
            self.log_test_result(
                "01_Backend_Health",
                "FAIL",
                f"Backend unhealthy: {response['data'].get('error', 'Unknown error')}"
            )

    def test_02_check_headers(self):
        """Test 2: Verify Headers Include Session Status"""
        response = self.make_request("GET", "/headers")

        if response["success"]:
            headers = response["data"].get("headers", [])
            if "session_status" in headers:
                self.log_test_result(
                    "02_Headers_Check",
                    "PASS",
                    f"Found session_status column in {len(headers)} headers"
                )
            else:
                self.log_test_result(
                    "02_Headers_Check",
                    "FAIL",
                    f"session_status column missing from headers: {headers}"
                )
        else:
            self.log_test_result(
                "02_Headers_Check",
                "ERROR",
                f"Failed to get headers: {response['data']}"
            )

    def test_03_check_no_active_session(self):
        """Test 3: Verify No Active Session Initially"""
        response = self.make_request("GET", "/session/active")

        if response["success"]:
            session = response["data"].get("session")
            if session is None:
                self.log_test_result(
                    "03_No_Active_Session",
                    "PASS",
                    "No active session found (expected)"
                )
            else:
                self.log_test_result(
                    "03_No_Active_Session",
                    "FAIL",
                    f"Unexpected active session found: {session['template']} on {session['date']}"
                )
        else:
            self.log_test_result(
                "03_No_Active_Session",
                "ERROR",
                f"Failed to check active session: {response['data']}"
            )

    def test_04_start_session(self):
        """Test 4: Start New Session"""
        response = self.make_request("POST", "/session/start", {"template": self.test_template})

        if response["success"]:
            self.test_session_id = response["data"].get("session_id")
            self.log_test_result(
                "04_Start_Session",
                "PASS",
                f"Started session: {self.test_session_id}",
                {"session_id": self.test_session_id}
            )
        else:
            self.log_test_result(
                "04_Start_Session",
                "FAIL",
                f"Failed to start session: {response['data'].get('error', 'Unknown error')}"
            )

    def test_05_verify_active_session(self):
        """Test 5: Verify Active Session Exists"""
        response = self.make_request("GET", "/session/active")

        if response["success"]:
            session = response["data"].get("session")
            if session and session.get("template") == self.test_template:
                exercises = session.get("exercises", {})
                self.log_test_result(
                    "05_Verify_Active_Session",
                    "PASS",
                    f"Active session found: {session['template']} with {len(exercises)} exercises",
                    {"session": session}
                )
            else:
                self.log_test_result(
                    "05_Verify_Active_Session",
                    "FAIL",
                    f"Active session not found or incorrect template. Session: {session}"
                )
        else:
            self.log_test_result(
                "05_Verify_Active_Session",
                "ERROR",
                f"Failed to get active session: {response['data']}"
            )

    def test_06_log_first_set(self):
        """Test 6: Log First Set for First Exercise"""
        exercise = self.test_exercises[0]  # "Pec dec fly"
        test_data = {
            "exercise": exercise,
            "set_number": 1,
            "weight": "50",
            "reps": "12",
            "notes": "Test set 1"
        }

        response = self.make_request("PUT", "/session/log-set", test_data)

        if response["success"]:
            self.log_test_result(
                "06_Log_First_Set",
                "PASS",
                f"Logged {exercise} set 1: 50lb x 12 reps",
                test_data
            )
        else:
            self.log_test_result(
                "06_Log_First_Set",
                "FAIL",
                f"Failed to log set: {response['data'].get('error', 'Unknown error')}"
            )

    def test_07_verify_set_persisted(self):
        """Test 7: Verify Set Data Persisted in Active Session"""
        response = self.make_request("GET", "/session/active")

        if response["success"]:
            session = response["data"].get("session")
            if session:
                exercises = session.get("exercises", {})
                pec_dec_sets = exercises.get("Pec dec fly", [])

                # Check if our logged set exists
                found_set = None
                for set_data in pec_dec_sets:
                    if set_data.get("set_number") == "1" and set_data.get("weight_lbs") == "50":
                        found_set = set_data
                        break

                if found_set:
                    self.log_test_result(
                        "07_Verify_Set_Persisted",
                        "PASS",
                        f"Set persisted: {found_set.get('weight_lbs')}lb x {found_set.get('reps')} reps",
                        {"found_set": found_set}
                    )
                else:
                    self.log_test_result(
                        "07_Verify_Set_Persisted",
                        "FAIL",
                        f"Set not found in session. Available sets: {pec_dec_sets}"
                    )
            else:
                self.log_test_result(
                    "07_Verify_Set_Persisted",
                    "FAIL",
                    "No active session found"
                )
        else:
            self.log_test_result(
                "07_Verify_Set_Persisted",
                "ERROR",
                f"Failed to get active session: {response['data']}"
            )

    def test_08_log_multiple_sets(self):
        """Test 8: Log Multiple Sets for Same Exercise"""
        exercise = self.test_exercises[0]  # "Pec dec fly"

        test_sets = [
            {"set_number": 2, "weight": "55", "reps": "10", "notes": "Increased weight"},
            {"set_number": 3, "weight": "60", "reps": "8", "notes": "Final set"}
        ]

        success_count = 0
        for set_data in test_sets:
            full_data = {"exercise": exercise, **set_data}
            response = self.make_request("PUT", "/session/log-set", full_data)

            if response["success"]:
                success_count += 1

        if success_count == len(test_sets):
            self.log_test_result(
                "08_Log_Multiple_Sets",
                "PASS",
                f"Logged {success_count}/{len(test_sets)} additional sets for {exercise}",
                {"test_sets": test_sets}
            )
        else:
            self.log_test_result(
                "08_Log_Multiple_Sets",
                "FAIL",
                f"Only logged {success_count}/{len(test_sets)} sets"
            )

    def test_09_log_different_exercise(self):
        """Test 9: Log Sets for Different Exercise"""
        exercise = self.test_exercises[1]  # "DB Incline bench press"

        test_data = {
            "exercise": exercise,
            "set_number": 1,
            "weight": "45",
            "reps": "15",
            "notes": "Different exercise test"
        }

        response = self.make_request("PUT", "/session/log-set", test_data)

        if response["success"]:
            self.log_test_result(
                "09_Log_Different_Exercise",
                "PASS",
                f"Logged {exercise} set 1: 45lb x 15 reps",
                test_data
            )
        else:
            self.log_test_result(
                "09_Log_Different_Exercise",
                "FAIL",
                f"Failed to log different exercise: {response['data'].get('error', 'Unknown error')}"
            )

    def test_10_amend_existing_set(self):
        """Test 10: Amend Existing Set (Update Weight/Reps)"""
        exercise = self.test_exercises[0]  # "Pec dec fly"

        # Update the first set with new values
        amended_data = {
            "exercise": exercise,
            "set_number": 1,
            "weight": "52",  # Changed from 50
            "reps": "14",    # Changed from 12
            "notes": "Amended test set"
        }

        response = self.make_request("PUT", "/session/log-set", amended_data)

        if response["success"]:
            self.log_test_result(
                "10_Amend_Existing_Set",
                "PASS",
                f"Amended {exercise} set 1: 52lb x 14 reps (was 50lb x 12)",
                amended_data
            )
        else:
            self.log_test_result(
                "10_Amend_Existing_Set",
                "FAIL",
                f"Failed to amend set: {response['data'].get('error', 'Unknown error')}"
            )

    def test_11_verify_amendment_persisted(self):
        """Test 11: Verify Amendment Persisted"""
        response = self.make_request("GET", "/session/active")

        if response["success"]:
            session = response["data"].get("session")
            if session:
                exercises = session.get("exercises", {})
                pec_dec_sets = exercises.get("Pec dec fly", [])

                # Find set 1 and verify it was amended
                found_amended_set = None
                for set_data in pec_dec_sets:
                    if set_data.get("set_number") == "1":
                        found_amended_set = set_data
                        break

                if found_amended_set and found_amended_set.get("weight_lbs") == "52":
                    self.log_test_result(
                        "11_Verify_Amendment_Persisted",
                        "PASS",
                        f"Amendment persisted: {found_amended_set.get('weight_lbs')}lb x {found_amended_set.get('reps')} reps",
                        {"amended_set": found_amended_set}
                    )
                else:
                    self.log_test_result(
                        "11_Verify_Amendment_Persisted",
                        "FAIL",
                        f"Amendment not found. Set 1 data: {found_amended_set}"
                    )
            else:
                self.log_test_result(
                    "11_Verify_Amendment_Persisted",
                    "FAIL",
                    "No active session found"
                )
        else:
            self.log_test_result(
                "11_Verify_Amendment_Persisted",
                "ERROR",
                f"Failed to get active session: {response['data']}"
            )

    def test_12_session_persistence_simulation(self):
        """Test 12: Simulate Leaving and Returning (Session Persistence)"""
        # First, get current session state
        response = self.make_request("GET", "/session/active")

        if response["success"]:
            session_before = response["data"].get("session")

            # Simulate time passing (in real scenario, user would close browser/app)
            time.sleep(1)

            # Check if session still exists
            response_after = self.make_request("GET", "/session/active")

            if response_after["success"]:
                session_after = response_after["data"].get("session")

                if session_after and session_after.get("template") == session_before.get("template"):
                    self.log_test_result(
                        "12_Session_Persistence",
                        "PASS",
                        f"Session persisted across 'leave/return': {session_after['template']}",
                        {"exercises_count": len(session_after.get("exercises", {}))}
                    )
                else:
                    self.log_test_result(
                        "12_Session_Persistence",
                        "FAIL",
                        f"Session lost. Before: {session_before}, After: {session_after}"
                    )
            else:
                self.log_test_result(
                    "12_Session_Persistence",
                    "ERROR",
                    f"Failed to check session after simulation: {response_after['data']}"
                )
        else:
            self.log_test_result(
                "12_Session_Persistence",
                "ERROR",
                f"Failed to get initial session: {response['data']}"
            )

    def test_13_complete_session(self):
        """Test 13: Complete Active Session"""
        response = self.make_request("POST", "/session/complete")

        if response["success"]:
            self.log_test_result(
                "13_Complete_Session",
                "PASS",
                "Session completed successfully"
            )
        else:
            self.log_test_result(
                "13_Complete_Session",
                "FAIL",
                f"Failed to complete session: {response['data'].get('error', 'Unknown error')}"
            )

    def test_14_verify_no_active_session_after_completion(self):
        """Test 14: Verify No Active Session After Completion"""
        response = self.make_request("GET", "/session/active")

        if response["success"]:
            session = response["data"].get("session")
            if session is None:
                self.log_test_result(
                    "14_No_Active_After_Complete",
                    "PASS",
                    "No active session after completion (expected)"
                )
            else:
                self.log_test_result(
                    "14_No_Active_After_Complete",
                    "FAIL",
                    f"Active session still exists after completion: {session}"
                )
        else:
            self.log_test_result(
                "14_No_Active_After_Complete",
                "ERROR",
                f"Failed to check session after completion: {response['data']}"
            )

    def test_15_start_and_cancel_session(self):
        """Test 15: Start New Session and Cancel It"""
        # Start new session
        start_response = self.make_request("POST", "/session/start", {"template": "lower1"})

        if start_response["success"]:
            # Cancel the session
            cancel_response = self.make_request("DELETE", "/session/cancel")

            if cancel_response["success"]:
                # Verify no active session
                check_response = self.make_request("GET", "/session/active")

                if check_response["success"] and check_response["data"].get("session") is None:
                    self.log_test_result(
                        "15_Start_And_Cancel",
                        "PASS",
                        "Successfully started and canceled session"
                    )
                else:
                    self.log_test_result(
                        "15_Start_And_Cancel",
                        "FAIL",
                        "Session still active after cancel"
                    )
            else:
                self.log_test_result(
                    "15_Start_And_Cancel",
                    "FAIL",
                    f"Failed to cancel session: {cancel_response['data']}"
                )
        else:
            self.log_test_result(
                "15_Start_And_Cancel",
                "FAIL",
                f"Failed to start session for cancel test: {start_response['data']}"
            )

    def generate_test_report(self):
        """Generate comprehensive test report"""
        total_tests = len(self.test_results)
        passed_tests = len([r for r in self.test_results if r["status"] == "PASS"])
        failed_tests = len([r for r in self.test_results if r["status"] == "FAIL"])
        error_tests = len([r for r in self.test_results if r["status"] == "ERROR"])

        report = {
            "test_run_info": {
                "start_time": self.test_start_time,
                "end_time": datetime.now().isoformat(),
                "total_tests": total_tests,
                "passed": passed_tests,
                "failed": failed_tests,
                "errors": error_tests,
                "success_rate": f"{(passed_tests/total_tests)*100:.1f}%" if total_tests > 0 else "0%"
            },
            "test_results": self.test_results
        }

        # Save to file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"test_results_{timestamp}.json"

        with open(filename, 'w') as f:
            json.dump(report, f, indent=2)

        print(f"\n" + "="*60)
        print(f"SESSION SYSTEM TEST REPORT")
        print(f"="*60)
        print(f"📊 Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"⚠️  Errors: {error_tests}")
        print(f"📈 Success Rate: {report['test_run_info']['success_rate']}")
        print(f"📁 Report saved: {filename}")
        print(f"="*60)

        return report

    def run_all_tests(self):
        """Execute all tests in sequence"""
        logger.info("🚀 Starting Session System Test Suite")

        test_methods = [
            self.test_01_backend_health,
            self.test_02_check_headers,
            self.test_03_check_no_active_session,
            self.test_04_start_session,
            self.test_05_verify_active_session,
            self.test_06_log_first_set,
            self.test_07_verify_set_persisted,
            self.test_08_log_multiple_sets,
            self.test_09_log_different_exercise,
            self.test_10_amend_existing_set,
            self.test_11_verify_amendment_persisted,
            self.test_12_session_persistence_simulation,
            self.test_13_complete_session,
            self.test_14_verify_no_active_session_after_completion,
            self.test_15_start_and_cancel_session
        ]

        for test_method in test_methods:
            try:
                test_method()
                time.sleep(0.5)  # Brief pause between tests
            except Exception as e:
                self.log_test_result(
                    test_method.__name__,
                    "ERROR",
                    f"Test execution failed: {str(e)}"
                )

        return self.generate_test_report()

if __name__ == "__main__":
    print("Session System Test Suite")
    print("========================")
    print("This will test all session CRUD operations comprehensively.")
    print("Make sure the backend is running on localhost:5001")
    print()

    # Check if backend is running
    try:
        response = requests.get("http://localhost:5001/api/health", timeout=5)
        if response.status_code == 200:
            print("✅ Backend is running")
        else:
            print("❌ Backend is not healthy")
            sys.exit(1)
    except:
        print("❌ Backend is not running. Please start it first:")
        print("   python backend_api.py")
        sys.exit(1)

    print()
    print("🚀 Starting tests automatically...")

    # Run tests
    test_suite = SessionTestSuite()
    report = test_suite.run_all_tests()

    print(f"\nTest completed! Check session_tests.log for detailed logs.")