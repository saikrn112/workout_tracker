# Minimal helper: ensure a Google Sheet exists by name (OAuth2 on first run).
import os, json
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.metadata.readonly",
]
SHEETS_MIME = "application/vnd.google-apps.spreadsheet"  # Drive MIME for Sheets

def _get_creds():
    creds = None
    if os.path.exists("token.json"):
        creds = Credentials.from_authorized_user_file("token.json", SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file("credentials.json", SCOPES)
            creds = flow.run_local_server(port=0)
        with open("token.json", "w") as f:
            f.write(creds.to_json())
    return creds

def ensure_spreadsheet(title: str):
    """OAuth2; find spreadsheet by exact name via Drive; create via Sheets if missing."""
    creds = _get_creds()
    drive = build("drive", "v3", credentials=creds)
    sheets = build("sheets", "v4", credentials=creds)

    safe_title = title.replace("'", r"\'")
    q = f"name = '{safe_title}' and mimeType = '{SHEETS_MIME}' and trashed = false"
    res = drive.files().list(
        q=q,
        fields="files(id,name,modifiedTime,webViewLink)",
        orderBy="modifiedTime desc",
        pageSize=1,
        includeItemsFromAllDrives=True,
        supportsAllDrives=True,
    ).execute()
    files = res.get("files", [])
    if files:
        f = files[0]
        return {"id": f["id"], "url": f.get("webViewLink"), "created": False}

    created = sheets.spreadsheets().create(
        body={"properties": {"title": title}}
    ).execute()
    sid = created["spreadsheetId"]
    return {"id": sid, "url": f"https://docs.google.com/spreadsheets/d/{sid}", "created": True}

if __name__ == "__main__":
    out = ensure_spreadsheet("My Automation Sheet")
    print(out)

