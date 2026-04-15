"""Web Dev Agent — generates client site mockups for pitch-ready leads."""

import sys
import json
import asyncio
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from agent_base import BaseAgent, AgentEvent
from tools.file_tools import save_output


MOCKUP_PROMPT = """Build a modern, mobile-responsive single-page website mockup for this business:

Business: {business_name}
Industry: {industry}
Location: {location}
Contact: {contact_name}
Pain Points: {needs}

Generate a complete, self-contained HTML file with inline CSS. The site should include:
1. Hero section with business name, tagline, and a strong CTA button
2. Services/features section (3-4 cards based on their industry)
3. "Why Choose Us" section addressing their specific pain points
4. Testimonials section (2-3 realistic fake testimonials)
5. Contact section with location, phone placeholder, and a simple contact form (non-functional)
6. Professional footer

Design requirements:
- Modern, clean design with a professional color scheme appropriate for {industry}
- Mobile-responsive using CSS flexbox/grid and media queries
- Smooth scroll behavior
- Subtle animations (fade-in on scroll using CSS only)
- Google Fonts (use a link tag)
- No JavaScript required — pure HTML + CSS

Output ONLY the complete HTML file, no explanation."""


class WebDevAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            agent_id="web-dev-001",
            name="Web Dev Agent",
            description="Client site mockups for leads",
            color="#f472b6",
        )
        self.tick_interval = 150
        self.pipeline_db = None

    async def tick(self) -> AgentEvent:
        if not self.pipeline_db:
            return self.emit("error", "No pipeline database connected")

        # Find pitch-ready leads that don't have a mockup yet
        leads = await asyncio.to_thread(
            self.pipeline_db.get_leads_by_stage, "pitch_ready", 10
        )

        target = None
        for lead in leads:
            has_mockup = await asyncio.to_thread(
                self.pipeline_db.has_item_for_lead, "websites", lead["id"]
            )
            if not has_mockup:
                target = lead
                break

        if not target:
            self.current_task = None
            return self.emit("waiting", "No pitch-ready leads need mockups")

        biz = target["business_name"]
        self.current_task = {
            "type": "site-mockup",
            "description": f"Building mockup for {biz}",
        }

        self.emit("generating", f"Building site mockup for {biz}")

        try:
            needs = target.get("needs", "[]")
            if isinstance(needs, str):
                try:
                    needs = json.loads(needs)
                except json.JSONDecodeError:
                    needs = [needs]
            needs_str = ", ".join(needs) if isinstance(needs, list) else str(needs)

            prompt = MOCKUP_PROMPT.format(
                business_name=biz,
                industry=target.get("industry", "unknown"),
                location=target.get("location", "unknown"),
                contact_name=target.get("contact_name", "Business Owner"),
                needs=needs_str,
            )
            system = (
                "You are a professional web developer who builds stunning, modern websites. "
                "You specialize in creating impressive mockups that win clients. "
                "Output only valid, complete HTML."
            )

            result = await self.llm.generate(prompt, system=system, complexity="high")

            # Clean markdown wrapping
            if "```html" in result:
                result = result.split("```html")[1].split("```")[0].strip()
            elif "```" in result:
                result = result.split("```")[1].split("```")[0].strip()

            # Validate we got HTML
            if "<html" not in result.lower() and "<body" not in result.lower():
                self.current_task = None
                return self.emit("skipped", f"Invalid HTML for {biz}")

            # Save the mockup
            slug = biz.lower().replace(" ", "-").replace("'", "")[:30]
            save_result = save_output(result, "website-mockups", f"mockup-{slug}", fmt="html")

            # Track in websites pipeline
            await asyncio.to_thread(
                self.pipeline_db.add_item,
                "websites", f"Site Mockup: {biz}",
                subtitle=target.get("industry", "unknown"),
                stage="generated", score=70,
                metadata={
                    "lead_id": target["id"],
                    "business_name": biz,
                    "industry": target.get("industry"),
                    "filename": save_result["filename"],
                },
                source_agent=self.agent_id,
            )

            self.tasks_completed += 1
            self.current_task = None

            return self.emit(
                "completed",
                f"Site mockup for '{biz}' → {save_result['filename']} ({save_result['size_bytes']} bytes)"
            )

        except Exception as e:
            self.current_task = None
            return self.emit("error", f"Failed for {biz}: {e}")

    def get_tools(self) -> list[dict]:
        return []
