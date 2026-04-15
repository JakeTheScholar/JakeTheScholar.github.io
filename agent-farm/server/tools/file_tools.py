"""File I/O tools for saving generated assets."""

import os
import re
from pathlib import Path
from datetime import datetime


OUTPUT_DIR = Path(__file__).parent.parent / "output"


def ensure_output_dir(subdir: str) -> Path:
    path = (OUTPUT_DIR / subdir).resolve()
    if not str(path).startswith(str(OUTPUT_DIR.resolve())):
        raise ValueError("Invalid output subdirectory")
    path.mkdir(parents=True, exist_ok=True)
    return path


def save_template(content: str, template_type: str, fmt: str = "html") -> dict:
    """Save a generated template to the output directory."""
    out_dir = ensure_output_dir("printables")
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    slug = re.sub(r'[^a-z0-9\-]', '', template_type.replace(" ", "-").lower())[:60]
    filename = f"{slug}-{timestamp}.{fmt}"
    filepath = out_dir / filename

    filepath.write_text(content, encoding="utf-8")

    return {
        "file": str(filepath.relative_to(OUTPUT_DIR.resolve())),
        "filename": filename,
        "size_bytes": filepath.stat().st_size,
        "created": datetime.now().isoformat(),
    }


def list_outputs(subdir: str = "printables") -> list[dict]:
    """List all generated output files in a subdirectory."""
    out_dir = (OUTPUT_DIR / subdir).resolve()
    if not str(out_dir).startswith(str(OUTPUT_DIR.resolve())):
        return []
    if not out_dir.exists():
        return []
    files = []
    for f in sorted(out_dir.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True):
        if f.is_file():
            files.append({
                "filename": f.name,
                "path": str(f.relative_to(OUTPUT_DIR.resolve())),
                "size_bytes": f.stat().st_size,
                "modified": datetime.fromtimestamp(f.stat().st_mtime).isoformat(),
            })
    return files


SAVE_TEMPLATE_SCHEMA = {
    "name": "save_template",
    "description": "Save a generated template file to the output directory",
    "input_schema": {
        "type": "object",
        "properties": {
            "content": {"type": "string", "description": "The template content (HTML/SVG)"},
            "template_type": {"type": "string", "description": "Type of template (e.g. trading-journal)"},
            "format": {"type": "string", "enum": ["html", "svg"], "default": "html"},
        },
        "required": ["content", "template_type"],
    },
}

def save_output(content: str, subdir: str, name: str, fmt: str = "json") -> dict:
    """Save generated content to a specific output subdirectory.

    Unlike save_template (which dumps everything into printables/), this
    routes output to the correct category folder.
    """
    out_dir = ensure_output_dir(subdir)
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    slug = re.sub(r'[^a-z0-9\-]', '', name.replace(" ", "-").lower())[:60]
    filename = f"{slug}-{timestamp}.{fmt}"
    filepath = out_dir / filename

    filepath.write_text(content, encoding="utf-8")

    return {
        "file": str(filepath.relative_to(OUTPUT_DIR.resolve())),
        "filename": filename,
        "subdir": subdir,
        "size_bytes": filepath.stat().st_size,
        "created": datetime.now().isoformat(),
    }


LIST_OUTPUTS_SCHEMA = {
    "name": "list_outputs",
    "description": "List all generated output files",
    "input_schema": {
        "type": "object",
        "properties": {
            "subdir": {"type": "string", "default": "printables"},
        },
    },
}
