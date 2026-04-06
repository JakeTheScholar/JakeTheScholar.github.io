"""Lead Scraper Agent — generates synthetic leads by industry via LLM."""

import sys
import json
import asyncio
import random
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from agent_base import BaseAgent, AgentEvent


INDUSTRIES = [
    {"id": "hvac_plumbing", "name": "HVAC & Plumbing", "keywords": "furnace repair, pipe installation, HVAC maintenance, water heater"},
    {"id": "dental_ortho", "name": "Dental & Ortho", "keywords": "teeth whitening, braces, dental implants, cosmetic dentistry"},
    {"id": "real_estate", "name": "Real Estate", "keywords": "property management, home staging, realtor marketing, listings"},
    {"id": "auto_repair", "name": "Auto Repair", "keywords": "brake service, oil change, collision repair, tire shop"},
    {"id": "landscaping", "name": "Landscaping", "keywords": "lawn care, tree trimming, hardscaping, irrigation"},
    {"id": "legal_services", "name": "Legal Services", "keywords": "personal injury, estate planning, family law, bankruptcy"},
    {"id": "home_services", "name": "Home Services", "keywords": "roofing, painting, electrical, plumbing, cleaning"},
    {"id": "medical_spa", "name": "Medical Spa", "keywords": "botox, laser treatment, facials, body contouring"},
]

SCRAPE_PROMPT = """Generate exactly 3 realistic business leads in the "{industry}" industry ({keywords}).

For each lead, provide:
- business_name: realistic local business name
- contact_name: owner/manager first and last name
- contact_email: professional email (first@businessdomain.com format)
- contact_phone: US phone format (555-XXX-XXXX)
- website: realistic domain (www.businessname.com)
- location: real US city and state
- needs: JSON array of 2-3 specific pain points they might have (e.g. "no online booking system", "outdated website", "zero Google reviews", "no social media presence")

Return a JSON array of 3 objects. Return ONLY valid JSON, no explanation."""


class LeadScraperAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            agent_id="lead-scraper-001",
            name="Lead Scraper",
            description="Discovers & qualifies leads",
            color="#06b6d4",
        )
        self.tick_interval = 45
        self.pipeline_db = None  # Injected by orchestrator
        self.index = 0

    async def tick(self) -> AgentEvent:
        if not self.pipeline_db:
            return self.emit("error", "No pipeline database connected")

        industry = INDUSTRIES[self.index % len(INDUSTRIES)]

        self.current_task = {
            "type": "lead-scrape",
            "description": f"Scraping leads in {industry['name']}",
        }

        self.emit("scraping", f"Finding leads in {industry['name']}")

        try:
            prompt = SCRAPE_PROMPT.format(industry=industry["name"], keywords=industry["keywords"])
            system = (
                "You are a B2B lead researcher. Generate realistic synthetic business leads "
                "for sales prospecting. Output only valid JSON arrays."
            )

            result = await self.llm.generate(prompt, system=system, complexity="low")

            # Clean markdown wrapping
            if "```json" in result:
                result = result.split("```json")[1].split("```")[0].strip()
            elif "```" in result:
                result = result.split("```")[1].split("```")[0].strip()

            try:
                leads = json.loads(result)
            except json.JSONDecodeError:
                self.current_task = None
                return self.emit("skipped", f"Invalid JSON from LLM for {industry['name']}")

            if not isinstance(leads, list):
                leads = [leads]

            added = 0
            for lead in leads[:3]:
                lead["industry"] = industry["id"]
                lead["score"] = random.randint(40, 85)
                # Ensure needs is a JSON string
                if isinstance(lead.get("needs"), list):
                    lead["needs"] = json.dumps(lead["needs"])
                await asyncio.to_thread(self.pipeline_db.add_lead, lead, "synthetic")
                added += 1

            self.tasks_completed += added
            self.index += 1
            self.current_task = None

            return self.emit(
                "completed",
                f"Scraped {added} leads in {industry['name']}"
            )

        except Exception as e:
            self.current_task = None
            return self.emit("error", f"Scrape failed for {industry['name']}: {e}")

    def get_tools(self) -> list[dict]:
        return []
