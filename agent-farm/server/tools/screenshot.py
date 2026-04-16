"""Screenshot HTML files to PNG using Playwright's headless Chromium.

Used by the mockup-pitch draft flow to embed a visual preview of the generated
website alongside the HTML file attachment.
"""

from pathlib import Path


def screenshot_html(html_path: str | Path, out_path: str | Path | None = None,
                    width: int = 1280, height: int = 800) -> Path | None:
    """Render an HTML file as a PNG screenshot.

    Returns the Path to the generated PNG on success, None on failure.
    If `out_path` is None, writes alongside the HTML file with a .png extension.
    """
    html_path = Path(html_path)
    if not html_path.exists():
        return None

    if out_path is None:
        out_path = html_path.with_suffix(".png")
    else:
        out_path = Path(out_path)

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return None

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            context = browser.new_context(viewport={"width": width, "height": height})
            page = context.new_page()
            # file:// URL so relative assets resolve. Use "load" not "networkidle"
            # because Google Fonts often never settles and forces a 15s timeout.
            try:
                page.goto(f"file:///{html_path.as_posix()}", wait_until="load", timeout=10000)
            except Exception:
                # Soft-fail on timeout — the page is usually rendered enough
                pass
            # Give CSS/fonts a moment to apply before screenshotting
            page.wait_for_timeout(1500)
            page.screenshot(path=str(out_path), full_page=True)
            browser.close()
        return out_path
    except Exception:
        return None
