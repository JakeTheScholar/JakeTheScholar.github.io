"""Google OAuth setup for Agent Farm Gmail (jakemcgaha968@gmail.com).

This is separate from jarvis's auth — each project has its own token.

Usage:
    python gmail_auth.py

Prerequisites:
    1. Copy google_credentials.json into agent-farm/server/
       (same OAuth client from Google Cloud Console, or create a new one)
    2. Add jakemcgaha968@gmail.com as a test user in the OAuth consent screen
    3. Run this script — browser opens, sign in, authorize
"""

from pathlib import Path

AGENT_FARM_DIR = Path(__file__).resolve().parent
CREDENTIALS_FILE = AGENT_FARM_DIR / "google_credentials.json"
TOKEN_FILE = AGENT_FARM_DIR / "data" / "gmail_token.json"

SCOPES = [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.compose",
]


def main():
    print("Agent Farm — Gmail OAuth Setup")
    print("=" * 40)
    print(f"Account: jakemcgaha968@gmail.com")
    print()

    if not CREDENTIALS_FILE.exists():
        # Try copying from jarvis
        jarvis_creds = AGENT_FARM_DIR.parent.parent / "jarvis" / "google_credentials.json"
        if jarvis_creds.exists():
            import shutil
            shutil.copy(jarvis_creds, CREDENTIALS_FILE)
            print(f"Copied credentials from jarvis project")
        else:
            print(f"Error: {CREDENTIALS_FILE} not found.")
            print("Download OAuth credentials from Google Cloud Console")
            print("or copy google_credentials.json from the jarvis folder.")
            exit(1)

    from google_auth_oauthlib.flow import InstalledAppFlow

    print("Opening browser for Google sign-in...")
    print("Sign in with: jakemcgaha968@gmail.com")
    print()

    flow = InstalledAppFlow.from_client_secrets_file(str(CREDENTIALS_FILE), SCOPES)
    creds = flow.run_local_server(port=0)

    # Ensure data dir exists
    TOKEN_FILE.parent.mkdir(parents=True, exist_ok=True)
    TOKEN_FILE.write_text(creds.to_json())

    print()
    print("Authentication successful!")
    print(f"Token saved: {TOKEN_FILE}")
    print()
    print("Agent Farm can now create Gmail drafts in jakemcgaha968@gmail.com")


if __name__ == "__main__":
    main()
