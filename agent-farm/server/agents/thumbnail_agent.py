"""Thumbnail Creator Agent — generates product mockup descriptions and SVG thumbnails."""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from agent_base import BaseAgent, AgentEvent
from tools.file_tools import save_output


THUMBNAIL_TYPES = [
    {"product": "Trading Journal", "style": "dark-finance", "accent": "#00d4ff"},
    {"product": "Budget Planner", "style": "clean-minimal", "accent": "#34d399"},
    {"product": "Expense Tracker", "style": "bold-modern", "accent": "#f472b6"},
    {"product": "Portfolio Tracker", "style": "professional", "accent": "#8b5cf6"},
    {"product": "Net Worth Statement", "style": "luxury", "accent": "#c9a96e"},
    {"product": "Goal Planner", "style": "motivational", "accent": "#fb923c"},
    {"product": "Debt Payoff Tracker", "style": "progress-focused", "accent": "#39ff14"},
    {"product": "Income Tracker", "style": "growth-themed", "accent": "#fbbf24"},
]

THUMBNAIL_PROMPT = """Create an SVG product thumbnail/mockup for an Etsy listing of a "{product}" printable template.

Style: {style}
Accent color: {accent}
Dimensions: 800x600px

The SVG should show:
- A clean product mockup (the template displayed on a tablet or as a flat-lay paper)
- The product title "{product}" prominently displayed
- A subtle background pattern or gradient
- "Digital Download" or "Printable PDF" badge
- Professional, Etsy-ready aesthetic
- Price tag area (leave as "$X.XX")

Use modern design principles: whitespace, clean typography, subtle shadows.
Return ONLY the complete SVG code (<svg> to </svg>), no explanation."""


class ThumbnailAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            agent_id="thumbnail-001",
            name="Thumbnail Creator",
            description="Product images & mockups",
            color="#f472b6",
        )
        self.tick_interval = 90
        self.index = 0

    async def tick(self) -> AgentEvent:
        thumb = THUMBNAIL_TYPES[self.index % len(THUMBNAIL_TYPES)]
        product = thumb["product"]

        self.current_task = {
            "type": "thumbnail",
            "description": f"Creating thumbnail for {product}",
        }

        self.emit("generating", f"Designing thumbnail for {product} ({thumb['style']})")

        try:
            prompt = THUMBNAIL_PROMPT.format(
                product=product, style=thumb["style"], accent=thumb["accent"]
            )
            system = (
                "You are a graphic designer creating Etsy product mockups. "
                "You output clean, professional SVG graphics. Output only valid SVG code."
            )

            result = await self.llm.generate(prompt, system=system, complexity="low")

            # Extract SVG
            if "<svg" in result:
                start = result.index("<svg")
                end = result.rindex("</svg>") + 6
                result = result[start:end]
            else:
                self.current_task = None
                return self.emit("skipped", f"No valid SVG in output for {product}")

            slug = product.lower().replace(" ", "-")
            save_result = save_output(result, "thumbnails", f"thumb-{slug}-{thumb['style']}", fmt="svg")
            self.tasks_completed += 1
            self.index += 1
            self.current_task = None

            return self.emit(
                "completed",
                f"Thumbnail for {product} → {save_result['filename']} ({save_result['size_bytes']}b)"
            )

        except Exception as e:
            self.current_task = None
            return self.emit("error", f"Failed: {e}")

    def get_tools(self) -> list[dict]:
        return []
