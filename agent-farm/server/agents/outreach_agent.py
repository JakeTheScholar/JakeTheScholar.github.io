"""Outreach Agent — generates personalized cold emails and DMs for leads.

When a pitch-ready lead has a mockup from the Web Dev Agent, this agent
switches to a dedicated "mockup pitch" flow that references the redesigned
site in the email body. Mirrors the @cyphyr.ai playbook (492K+ views): show,
don't tell — send a finished redesign instead of a generic offer.
"""

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


MOCKUP_PITCH_PROMPT = """You are writing a high-conversion cold outreach email for a B2B sales pitch.
This campaign uses the "show, don't tell" playbook — we've already built the prospect a
full redesign of their website and are sending it with the first message.

Target business:
- Name: {business_name}
- Industry: {industry}
- Location: {location}
- Contact: {contact_name}
- Pain points: {needs}

We have built them a fresh mockup called: {mockup_filename}
(Their current site is stuck in the early 2000s — ours is modern, mobile-first, and fast.)

Generate the mockup-pitch outreach as JSON:
- "email_subject": Bold subject (under 60 chars). Hint that you redesigned their site. Curiosity-driven.
- "email_body": 180-260 word email. Opening line must reference their CURRENT site's actual problems (outdated look, slow, not mobile). Then drop the twist: "So I built you a new one — here it is: {{mockup_link_placeholder}}". Close with a single CTA asking if they want the source files for free. NO hard sell. Confident but generous tone.
- "dm_message": 80-word Instagram DM version. Hook → twist → link → CTA.
- "value_prop": One-sentence pitch framed around the finished deliverable.

Return ONLY valid JSON. Use the literal string {{mockup_link_placeholder}} where the URL should appear — we will substitute it."""


class OutreachAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            agent_id="outreach-001",
            name="Outreach Agent",
            description="Personalized outreach messages (+ mockup pitch flow)",
            color="#f59e0b",
        )
        self.tick_interval = 90
        self.pipeline_db = None  # Injected by orchestrator

    async def tick(self) -> AgentEvent:
        if not self.pipeline_db:
            return self.emit("error", "No pipeline database connected")

        # ── PRIORITY 1: pitch_ready leads with a mockup but no mockup_pitch outreach yet ──
        target, mockup_item = await self._find_mockup_pitch_target()
        if target and mockup_item:
            return await self._draft_mockup_pitch(target, mockup_item)

        # ── PRIORITY 2: standard cold outreach for new leads ──
        leads = await asyncio.to_thread(self.pipeline_db.get_leads_by_stage, "scraped", 5)
        if not leads:
            leads = await asyncio.to_thread(self.pipeline_db.get_leads_by_stage, "researched", 5)

        target = None
        for lead in leads:
            has = await asyncio.to_thread(self.pipeline_db.has_outreach, lead["id"])
            if not has:
                target = lead
                break

        if not target:
            self.current_task = None
            return self.emit("waiting", "No leads pending outreach")

        return await self._draft_standard_outreach(target)

    async def _find_mockup_pitch_target(self) -> tuple[dict | None, dict | None]:
        """Find a pitch_ready lead with a mockup that hasn't been pitched yet."""
        leads = await asyncio.to_thread(
            self.pipeline_db.get_leads_by_stage, "pitch_ready", 10
        )
        for lead in leads:
            mockup = await asyncio.to_thread(
                self.pipeline_db.get_item_for_lead, "websites", lead["id"]
            )
            if not mockup:
                continue
            # Check whether a mockup-pitch email already exists
            existing = await asyncio.to_thread(
                self.pipeline_db.get_outreach_for_lead, lead["id"]
            )
            already_pitched = any(
                o.get("channel") == "mockup_email" for o in existing
            )
            if already_pitched:
                continue
            return lead, mockup
        return None, None

    async def _draft_mockup_pitch(self, target: dict, mockup_item: dict) -> AgentEvent:
        biz = target["business_name"]
        self.current_task = {
            "type": "mockup-pitch",
            "description": f"Drafting mockup pitch for {biz}",
        }
        self.emit("generating", f"Writing mockup pitch for {biz} (cyphyr playbook)")

        try:
            needs = self._parse_needs(target.get("needs", "[]"))
            metadata = mockup_item.get("metadata") or {}
            mockup_filename = metadata.get("filename", "mockup.html")

            prompt = MOCKUP_PITCH_PROMPT.format(
                business_name=biz,
                industry=target.get("industry", "unknown"),
                location=target.get("location", "unknown"),
                contact_name=target.get("contact_name", "Business Owner"),
                needs=needs,
                mockup_filename=mockup_filename,
            )
            system = (
                "You are a B2B sales copywriter specializing in the 'show don't tell' "
                "agency playbook. Your emails convert because they include a finished "
                "deliverable, not an offer. Output only valid JSON."
            )

            result = await self.llm.generate(prompt, system=system, complexity="low")
            outreach = self._parse_json(result)
            if not outreach:
                self.current_task = None
                return self.emit("skipped", f"Invalid mockup-pitch JSON for {biz}")

            # Substitute the mockup link into the body
            mockup_link = f"[mockup: output/printables/{mockup_filename}]"
            email_body = (outreach.get("email_body") or "").replace(
                "{mockup_link_placeholder}", mockup_link
            )
            dm_body = (outreach.get("dm_message") or "").replace(
                "{mockup_link_placeholder}", mockup_link
            )

            # Save mockup-pitch email (dedicated channel to avoid re-pitching)
            await asyncio.to_thread(
                self.pipeline_db.add_outreach,
                target["id"], "mockup_email",
                outreach.get("email_subject", ""),
                email_body,
            )
            if dm_body:
                await asyncio.to_thread(
                    self.pipeline_db.add_outreach,
                    target["id"], "mockup_dm", None, dm_body,
                )

            # Advance the mockup's pipeline item to "delivered"
            mockup_id = mockup_item.get("id")
            if mockup_id:
                await asyncio.to_thread(
                    self.pipeline_db.update_item_stage,
                    mockup_id, "polished", self.agent_id, "Pitch drafted"
                )

            # Advance lead to contacted
            await asyncio.to_thread(
                self.pipeline_db.update_lead_stage,
                target["id"], "contacted", self.agent_id, "Mockup pitch drafted"
            )

            self.tasks_completed += 1
            self.current_task = None
            return self.emit(
                "completed",
                f"Mockup pitch drafted for '{biz}' using {mockup_filename}"
            )

        except Exception as e:
            self.current_task = None
            return self.emit("error", f"Mockup pitch failed for {biz}: {e}")

    async def _draft_standard_outreach(self, target: dict) -> AgentEvent:
        biz = target["business_name"]
        self.current_task = {
            "type": "outreach",
            "description": f"Drafting outreach for {biz}",
        }
        self.emit("generating", f"Writing outreach for {biz}")

        try:
            needs = self._parse_needs(target.get("needs", "[]"))

            prompt = OUTREACH_PROMPT.format(
                business_name=biz,
                industry=target.get("industry", "unknown"),
                location=target.get("location", "unknown"),
                contact_name=target.get("contact_name", "Business Owner"),
                needs=needs,
            )
            system = (
                "You are a B2B sales copywriter specializing in personalized cold outreach. "
                "You write emails that feel personal, not templated. Output only valid JSON."
            )

            result = await self.llm.generate(prompt, system=system, complexity="low")
            outreach = self._parse_json(result)
            if not outreach:
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

    @staticmethod
    def _parse_needs(needs) -> str:
        if isinstance(needs, str):
            try:
                needs = json.loads(needs)
            except json.JSONDecodeError:
                needs = [needs]
        return ", ".join(needs) if isinstance(needs, list) else str(needs)

    @staticmethod
    def _parse_json(result: str) -> dict | None:
        if "```json" in result:
            result = result.split("```json")[1].split("```")[0].strip()
        elif "```" in result:
            result = result.split("```")[1].split("```")[0].strip()
        try:
            return json.loads(result)
        except json.JSONDecodeError:
            return None

    def get_tools(self) -> list[dict]:
        return []
