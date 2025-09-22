"""
Configuration settings for the Workout App
Centralized configuration for ports, URLs, and other settings
"""

import os

# Server Configuration
BACKEND_PORT = int(os.getenv('BACKEND_PORT', 5001))
FRONTEND_PORT = int(os.getenv('FRONTEND_PORT', 8010))
MOBILE_PORT = int(os.getenv('MOBILE_PORT', 8080))

# Backend Configuration
BACKEND_HOST = os.getenv('BACKEND_HOST', 'localhost')
BACKEND_DEBUG = os.getenv('BACKEND_DEBUG', 'True').lower() == 'true'

# Frontend Configuration
FRONTEND_HOST = os.getenv('FRONTEND_HOST', 'localhost')

# URLs (constructed from above)
BACKEND_URL = f"http://{BACKEND_HOST}:{BACKEND_PORT}"
FRONTEND_URL = f"http://{FRONTEND_HOST}:{FRONTEND_PORT}"
API_BASE_URL = f"{BACKEND_URL}/api"

# Google Sheets Configuration
SPREADSHEET_NAME = os.getenv('SPREADSHEET_NAME', 'Gym workout')
SHEET_NAME = os.getenv('SHEET_NAME', 'raw')

# Development Configuration
AUTO_OPEN_BROWSER = os.getenv('AUTO_OPEN_BROWSER', 'False').lower() == 'true'

# Print configuration (for debugging)
def print_config():
    print("🔧 Workout App Configuration")
    print("=" * 40)
    print(f"Backend:     {BACKEND_URL}")
    print(f"Frontend:    {FRONTEND_URL}")
    print(f"API Base:    {API_BASE_URL}")
    print(f"Spreadsheet: {SPREADSHEET_NAME}")
    print(f"Sheet:       {SHEET_NAME}")
    print("=" * 40)

if __name__ == "__main__":
    print_config()