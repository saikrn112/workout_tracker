#!/usr/bin/env python3
"""
System Starter - Launch both frontend and backend
Convenient script to start the complete workout system
"""

import subprocess
import sys
import time
import os
import signal
import requests
from pathlib import Path

def check_backend_running():
    """Check if backend is already running"""
    from config import BACKEND_URL
    try:
        print(f"🔍 Checking if backend is running at {BACKEND_URL}...")
        response = requests.get(f"{BACKEND_URL}/api/health", timeout=3)
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "healthy":
                print(f"✅ Found healthy backend: {data.get('spreadsheet_id', 'Unknown')}...")
                return True
        print(f"❌ Backend responded but not healthy: {response.status_code}")
    except requests.ConnectionError:
        print("❌ Backend not running (connection refused)")
    except requests.Timeout:
        print("❌ Backend not responding (timeout)")
    except Exception as e:
        print(f"❌ Error checking backend: {e}")
    return False

def start_backend():
    """Start the backend API server if not already running"""
    if check_backend_running():
        print("🔧 Backend API server is already running - connecting to existing instance")
        return None
    else:
        print("🔧 Starting new backend API server...")
        return subprocess.Popen([
            sys.executable, "backend_api.py"
        ], cwd=Path(__file__).parent)

def start_frontend():
    """Start the frontend server"""
    print("🎨 Starting frontend server...")
    return subprocess.Popen([
        sys.executable, "frontend/serve.py"
    ], cwd=Path(__file__).parent)

def main():
    from config import print_config, BACKEND_URL, FRONTEND_URL, AUTO_OPEN_BROWSER

    print("🚀 Starting Workout App System")
    print_config()

    # Check if credentials exist
    if not os.path.exists("credentials.json"):
        print("❌ credentials.json not found!")
        print("Please download it from Google Cloud Console and place it in this directory.")
        sys.exit(1)

    processes = []
    backend_process = None

    try:
        # Start or connect to backend
        backend_process = start_backend()
        if backend_process:
            processes.append(backend_process)
            time.sleep(2)  # Give backend time to start
        else:
            time.sleep(0.5)  # Brief pause when connecting to existing backend

        # Verify backend is accessible (with retry for newly started backends)
        backend_ready = False
        for attempt in range(5):  # Try up to 5 times
            if check_backend_running():
                backend_ready = True
                break
            if attempt < 4:  # Don't sleep on the last attempt
                print(f"⏳ Waiting for backend... (attempt {attempt + 1}/5)")
                time.sleep(2)

        if not backend_ready:
            print("❌ Backend API is not accessible after multiple attempts")
            sys.exit(1)

        # Start frontend
        frontend_process = start_frontend()
        processes.append(frontend_process)
        time.sleep(1)

        print("\n✅ System started successfully!")
        print("=" * 40)
        print(f"🔗 Backend API: {BACKEND_URL}")
        print(f"🎨 Frontend:    {FRONTEND_URL}")
        print(f"\n💡 Open {FRONTEND_URL} in your browser to use the app")

        if backend_process:
            print("\nPress Ctrl+C to stop both servers")
        else:
            print("\nPress Ctrl+C to stop frontend (backend will continue running)")
            print("💡 Backend was already running and will remain running after you stop this script")

        # Auto-open browser if configured
        if AUTO_OPEN_BROWSER:
            import webbrowser
            webbrowser.open(FRONTEND_URL)

        # Wait for processes
        try:
            while True:
                time.sleep(1)
                # Check if any process died
                for i, process in enumerate(processes):
                    if process.poll() is not None:
                        print(f"\n❌ Process {i+1} stopped unexpectedly")
                        break
        except KeyboardInterrupt:
            print("\n🛑 Stopping system...")

    except Exception as e:
        print(f"\n❌ Failed to start system: {e}")

    finally:
        # Clean up processes
        if processes:
            for i, process in enumerate(processes):
                if process.poll() is None:  # Still running
                    print(f"Stopping process {i+1}...")
                    try:
                        process.terminate()
                        process.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        process.kill()

        if backend_process:
            print("👋 System stopped")
        else:
            print("👋 Frontend stopped (backend continues running)")

if __name__ == "__main__":
    main()