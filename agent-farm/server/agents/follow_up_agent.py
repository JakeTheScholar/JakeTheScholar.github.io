"""Follow-Up Agent — drafts progressive follow-up sequences for stale leads."""

import sys
import json
import asyncio
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from agent_base import BaseAgent, AgentEvent
from tools.file_tools import save_output


FOLLOW_UP_STAGES = [
    {"touch": 1, "style": "value-add", "desc": "Share a relevant tip or resource. No hard sell."},
    {"touch": 2, "style": "case-study", "desc": "Brief success story from a similar business. Social proof."},
    {"touch": 3, "style": "direct-ask", "desc": "Direct but friendly check-in. Ask if timing is better."},
    {"touch": 4, "style": "breakup", "desc": "Final 'closing the loop' email. Creates urgency without pressure."},
]

FOLLOW_UP_PROMPT = """Write a follow-up email for a B2B sales sequence.

This is touch #{touch} of 4. Style: {style}
Instructions: {desc}

Lead info:
- Business: {business_name}
- Industry: {industry}
- Location: {location}
- Contact: {contact_name}
- Their pain points: {needs}
- Previous outreach: They were contacted but haven't responded yet.

Return a JSON object:
- "subject": Email subject line (under 60 chars, no spam triggers)
- "body": Email body (100-200 words). Must feel personal, not templated. Reference their business specifically.
- "ps_line": Optional P.S. line (powerful in follow-ups)
- "send_delay_days": Recommended days to wait before sending this touch
- "tone": Brief description of the tone used

Tone rules:
- Touch 1: Helpful, zero pressure
- Touch 2: Confident, proof-driven
- Touch 3: Direct, respectful of their time
- Touch 4: Gracious exit, door stays open

Return ONLY valid JSON."""


class FollowUpAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            agent_id="follow-up-001",
            name="Follow-Up Agent",
            description="Follow-up sequences for leads",
            color="#ef4444",
        )
        self.tick_interval = 100
        self.pipeline_db = None

    async def tick(self) -> AgentEvent:
        if not self.pipeline_db:
            return self.emit("error", "No pipeline database connected")

        # Find contacted leads (these are the ones waiting for follow-up)
        leads = await asyncio.to_thread(
            self.pipeline_db.get_leads_by_stage, "contacted", 10
        )

        if not leads:
            self.current_task = None
            return self.emit("waiting", "No contacted leads need follow-up")

        # Pick a lead and determine which follow-up touch to draft
        target = None
        touch_num = 1
        for lead in leads:
            outreach = await asyncio.to_thread(
                self.pipeline_db.get_outreach_for_lead, lead["id"]
            )
            # Count existing follow-ups (emails beyond the first)
            email_count = sum(1 for o in outreach if o["channel"] == "email")
            if email_count <= len(FOLLOW_UP_STAGES):
                target = lead
                touch_num = min(email_count, len(FOLLOW_UP_STAGES) - 1)
                break

        if not target:
            self.current_task = None
            return self.emit("waiting", "All contacted leads have full follow-up sequences")

        biz = target["business_name"]
        stage = FOLLOW_UP_STAGES[touch_num]

        self.current_task = {
            "type": "follow-up",
            "description": f"Touch #{stage['touch']} ({stage['style']}) for {biz}",
        }

        self.emit("generating", f"Drafting {stage['style']} follow-up for {biz}")

        try:
            needs = target.get("needs", "[]")
            if isinstance(needs, str):
                try:
                    needs = json.loads(needs)
                except json.JSONDecodeError:
                    needs = [needs]
            needs_str = ", ".join(needs) if isinstance(needs, list) else str(needs)

            prompt = FOLLOW_UP_PROMPT.format(
                touch=stage["touch"],
                style=stage["style"],
                desc=stage["desc"],
                business_name=biz,
                industry=target.get("industry", "unknown"),
                location=target.get("location", "unknown"),
                contact_name=target.get("contact_name") or "there",
                needs=needs_str,
            )
            system = (
                "You are a B2B sales follow-up specialist. You write emails that get replies "
                "by being genuinely helpful, not pushy. Output only valid JSON."
            )

            result = await self.llm.generate(prompt, system=system, complexity="low")

            if "```json" in result:
                result = result.split("```json")[1].split("```")[0].strip()
            elif "```" in result:
                result = result.split("```")[1].split("```")[0].strip()

            try:
                followup = json.loads(result)
            except json.JSONDecodeError:
                self.current_task = None
                return self.emit("skipped", f"Invalid JSON for {biz} follow-up")

            # Save as outreach
            fu_subject = followup.get("subject", f"Follow-up #{stage['touch']}").capitalize()
            fu_body = followup.get("body", "")
            await asyncio.to_thread(
                self.pipeline_db.add_outreach,
                target["id"], "email", fu_subject, fu_body,
            )

            slug = biz.lower().replace(" ", "-")[:25]
            save_output(json.dumps(followup, indent=2), "follow-ups", f"followup-{stage['touch']}-{slug}")

            self.tasks_completed += 1
            self.current_task = None

            return self.emit(
                "completed",
                f"Follow-up #{stage['touch']} ({stage['style']}) drafted for '{biz}'"
            )

        except Exception as e:
            self.current_task = None
            return self.emit("error", f"Follow-up failed for {biz}: {e}")

    def get_tools(self) -> list[dict]:
        return []
