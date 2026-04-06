"""Outreach Agent — generates personalized cold emails and DMs for leads."""

import sys
import json
import asyncio
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from agent_base import BaseAgent, AgentEvent


OUTREACH_PROMPT = """You are writing a cold outreach email and DM for a B2B sales campaign.

Target business:
- Name: {business_name}
- Industry: {industry}
- Location: {location}
- Contact: {contact_name}
- Pain points: {needs}

Generate personalized outreach as JSON:
- "email_subject": Compelling email subject line (under 60 chars)
- "email_body": Professional cold email (150-250 words). Reference their specific pain points. Offer a free consultation/audit. Include a clear CTA.
- "dm_message": Short DM version for LinkedIn/Instagram (under 100 words). Casual but professional.
- "value_prop": One-sentence value proposition specific to this business.

Tone: Helpful, not pushy. Show you've done your research.
Return ONLY valid JSON."""


class OutreachAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            agent_id="outreach-001",
            name="Outreach Agent",
            description="Personalized outreach messages",
            color="#f59e0b",
        )
        self.tick_interval = 90
        self.pipeline_db = None  # Injected by orchestrator

    async def tick(self) -> AgentEvent:
        if not self.pipeline_db:
            return self.emit("error", "No pipeline database connected")

        # Find leads that need outreach (scraped or researched, no outreach yet)
        leads = await asyncio.to_thread(self.pipeline_db.get_leads_by_stage, "scraped", 5)
        if not leads:
            leads = await asyncio.to_thread(self.pipeline_db.get_leads_by_stage, "researched", 5)

        # Find one without outreach
        target = None
        for lead in leads:
            has = await asyncio.to_thread(self.pipeline_db.has_outreach, lead["id"])
            if not has:
                target = lead
                break

        if not target:
            self.current_task = None
            return self.emit("waiting", "No leads pending outreach")

        biz = target["business_name"]
        self.current_task = {
            "type": "outreach",
            "description": f"Drafting outreach for {biz}",
        }

        self.emit("generating", f"Writing outreach for {biz}")

        try:
            needs = target.get("needs", "[]")
            if isinstance(needs, str):
                try:
                    needs = json.loads(needs)
                except json.JSONDecodeError:
                    needs = [needs]
            needs_str = ", ".join(needs) if isinstance(needs, list) else str(needs)

            prompt = OUTREACH_PROMPT.format(
                business_name=biz,
                industry=target.get("industry", "unknown"),
                location=target.get("location", "unknown"),
                contact_name=target.get("contact_name", "Business Owner"),
                needs=needs_str,
            )
            system = (
                "You are a B2B sales copywriter specializing in personalized cold outreach. "
                "You write emails that feel personal, not templated. Output only valid JSON."
            )

            result = await self.llm.generate(prompt, system=system, complexity="low")

            if "```json" in result:
                result = result.split("```json")[1].split("```")[0].strip()
            elif "```" in result:
                result = result.split("```")[1].split("```")[0].strip()

            try:
                outreach = json.loads(result)
            except json.JSONDecodeError:
                self.current_task = None
                return self.emit("skipped", f"Invalid JSON for {biz}")

            # Save email outreach
            await asyncio.to_thread(
                self.pipeline_db.add_outreach,
                target["id"], "email",
                outreach.get("email_subject", ""),
                outreach.get("email_body", ""),
            )

            # Save DM outreach
            if outreach.get("dm_message"):
                await asyncio.to_thread(
                    self.pipeline_db.add_outreach,
                    target["id"], "dm", None,
                    outreach["dm_message"],
                )

            # Advance lead stage
            current_stage = target["stage"]
            if current_stage == "scraped":
                await asyncio.to_thread(
                    self.pipeline_db.update_lead_stage,
                    target["id"], "researched", self.agent_id, "Outreach drafted"
                )
            elif current_stage == "researched":
                await asyncio.to_thread(
                    self.pipeline_db.update_lead_stage,
                    target["id"], "pitch_ready", self.agent_id, "Pitch ready"
                )

            self.tasks_completed += 1
            self.current_task = None

            return self.emit(
                "completed",
                f"Outreach drafted for '{biz}' (email + DM)"
            )

        except Exception as e:
            self.current_task = None
            return self.emit("error", f"Failed for {biz}: {e}")

    def get_tools(self) -> list[dict]:
        return []
