"""Gmail drafts for Agent Farm — creates drafts in Jake's jakemcgaha968 inbox.

Uses its own OAuth token separate from jarvis, so both can run different accounts.
Uses urllib directly (google-api-python-client hangs on this machine).

Setup: python agent-farm/server/gmail_auth.py
"""

import json
import base64
import urllib.request
import urllib.parse
from pathlib import Path
from email.mime.text import MIMEText

AGENT_FARM_DIR = Path(__file__).resolve().parent
TOKEN_FILE = AGENT_FARM_DIR / "data" / "gmail_token.json"

GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me"


def _get_access_token() -> str | None:
    """Refresh and return a valid access token using urllib."""
    if not TOKEN_FILE.exists():
        return None

    try:
        token = json.loads(TOKEN_FILE.read_text())
        refresh_token = token.get("refresh_token")
        client_id = token.get("client_id")
        client_secret = token.get("client_secret")

        if not all([refresh_token, client_id, client_secret]):
            return None

        data = urllib.parse.urlencode({
            "client_id": client_id,
            "client_secret": client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        }).encode()

        req = urllib.request.Request("https://oauth2.googleapis.com/token", data=data)
        resp = urllib.request.urlopen(req, timeout=10)
        result = json.loads(resp.read())

        return result.get("access_token")
    except Exception:
        return None


def is_gmail_ready() -> bool:
    """Check if agent-farm's Gmail OAuth token exists and looks usable."""
    if not TOKEN_FILE.exists():
        return False
    try:
        token = json.loads(TOKEN_FILE.read_text())
        return bool(token.get("refresh_token") and token.get("client_id"))
    except Exception:
        return False


def send_email(to: str, subject: str, body: str) -> dict:
    """Send an email directly (not as a draft).

    Returns {"ok": True, "message_id": "..."} on success,
            {"ok": False, "error": "..."} on failure.
    """
    access_token = _get_access_token()
    if not access_token:
        return {"ok": False, "error": "Gmail not connected -- run: python agent-farm/server/gmail_auth.py"}

    try:
        message = MIMEText(body)
        message["to"] = to
        message["from"] = "jakemcgaha968@gmail.com"
        message["subject"] = subject
        raw = base64.urlsafe_b64encode(message.as_bytes()).decode()

        send_body = json.dumps({"raw": raw}).encode()

        req = urllib.request.Request(
            f"{GMAIL_API}/messages/send",
            data=send_body,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        resp = urllib.request.urlopen(req, timeout=15)
        result = json.loads(resp.read())

        return {"ok": True, "message_id": result.get("id", "")}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def create_draft(to: str, subject: str, body: str) -> dict:
    """Create a draft email in Gmail for manual review and sending.

    Returns {"ok": True, "draft_id": "..."} on success,
            {"ok": False, "error": "..."} on failure.
    """
    access_token = _get_access_token()
    if not access_token:
        return {"ok": False, "error": "Gmail not connected -- run: python agent-farm/server/gmail_auth.py"}

    try:
        message = MIMEText(body)
        message["to"] = to
        message["from"] = "jakemcgaha968@gmail.com"
        message["subject"] = subject
        raw = base64.urlsafe_b64encode(message.as_bytes()).decode()

        draft_body = json.dumps({"message": {"raw": raw}}).encode()

        req = urllib.request.Request(
            f"{GMAIL_API}/drafts",
            data=draft_body,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        resp = urllib.request.urlopen(req, timeout=15)
        result = json.loads(resp.read())

        return {"ok": True, "draft_id": result.get("id", "")}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def list_drafts(max_results: int = 500) -> list[str]:
    """Return a list of all draft IDs in the inbox."""
    access_token = _get_access_token()
    if not access_token:
        return []

    draft_ids = []
    page_token = None

    while True:
        url = f"{GMAIL_API}/drafts?maxResults={min(max_results, 100)}"
        if page_token:
            url += f"&pageToken={page_token}"

        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {access_token}"})
        try:
            resp = urllib.request.urlopen(req, timeout=15)
            result = json.loads(resp.read())
            for d in result.get("drafts", []):
                draft_ids.append(d["id"])
            page_token = result.get("nextPageToken")
            if not page_token or len(draft_ids) >= max_results:
                break
        except Exception:
            break

    return draft_ids


def delete_draft(draft_id: str) -> bool:
    """Delete a single draft by ID."""
    access_token = _get_access_token()
    if not access_token:
        return False

    try:
        req = urllib.request.Request(
            f"{GMAIL_API}/drafts/{draft_id}",
            headers={"Authorization": f"Bearer {access_token}"},
            method="DELETE",
        )
        urllib.request.urlopen(req, timeout=15)
        return True
    except Exception:
        return False
