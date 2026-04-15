"""Outreach Agent - generates personalized cold emails and DMs for leads,
then creates Gmail drafts for review.

Uses PAS framework (Problem-Agitate-Solve) with a tiny LLM call (~30 tokens)
for the personalized observation line. Research-backed: 50-80 word emails,
interest-based CTAs, 2-6 word subjects, minimal signature.
"""

import sys
import json
import asyncio
import random
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from agent_base import BaseAgent, AgentEvent
from gmail_sender import create_draft as gmail_draft, is_gmail_ready
from tools.file_tools import save_output

def _capitalize_subject(s):
    """Capitalize first letter only — avoids .title() mangling apostrophes."""
    return s[0].upper() + s[1:] if s else s

# Safety: max drafts created per day
DAILY_DRAFT_LIMIT = 20

# ── LLM prompt: one specific opportunity for their online presence ──
PERSONALIZE_PROMPT = """Write ONE specific thing that would help this business get more customers online. Under 15 words. Frame it as an opportunity, not a criticism. Be concrete. Sound like a friend giving advice.

Example: "a faster mobile site could really help you capture more leads"
Example: "a few tweaks to your Google listing would get you way more calls"
Example: "some simple SEO changes could put you above the competition locally"
Example: "an online booking system would make it so much easier for customers to find you"

Business: {business_name}
Industry: {industry}
Location: {location}
Pain points: {needs}

Reply with ONLY the suggestion, no quotes."""

# ── Subject lines: short, varied, 2-6 words ──
# Templates using {contact_name} — only used when we have a real name
SUBJECT_LINES_NAMED = [
    "{contact_name} - quick question",
    "{contact_name} - thought of you",
    "{contact_name} - 30 sec read",
    "for {contact_name} at {business_name}",
]
# Templates using only {business_name} — safe for all leads
SUBJECT_LINES_GENERIC = [
    "idea for {business_name}",
    "re: {business_name}",
    "{business_name}'s online presence",
    "something for {business_name}",
    "quick idea for {business_name}",
]

# ── Email template (~60 words, opportunity-framed) ──
EMAIL_TEMPLATE = """Hi {contact_name},

I was looking at {business_name} online and think {observation}.

You've clearly built something great - I think a stronger online presence could help even more people find you.

Want me to put together a quick mockup of what that could look like? Totally free, no strings.

Jake McGaha
Web Design & Local SEO
jakemcgaha.com"""

# ── DM template ──
DM_TEMPLATE = """Hey {contact_name} - I was checking out {business_name} and think {observation}. I do web design and local SEO - want me to show you what I'd do?"""

# ── Mockup pitch templates ──
MOCKUP_SUBJECT_LINES = [
    "I redesigned {business_name}'s website",
    "{contact_name} - built you something",
    "{business_name}'s new website",
]

MOCKUP_EMAIL_TEMPLATE = """Hi {contact_name},

I think {observation} - so instead of just talking about it, I went ahead and built you something: {mockup_link}

Modern, mobile-first, and fast. No catch - I just wanted to show you what's possible.

If you like it, the source files are yours for free.

Jake McGaha
Web Design & Local SEO
jakemcgaha.com"""

MOCKUP_DM_TEMPLATE = """Hey {contact_name} - I noticed {business_name}'s site could use a refresh so I actually built you a new one: {mockup_link}

It's free - want the source files?"""

# ── Industry labels ──
INDUSTRY_LABELS = {
    "hvac_plumbing": "HVAC & plumbing",
    "dental_ortho": "dental",
    "home_services": "home service",
    "landscaping": "landscaping",
    "legal_services": "legal",
    "medical_spa": "med spa",
    "real_estate": "real estate",
    "auto_repair": "auto repair",
}

# ── Fallback observations by industry (opportunity-framed) ──
FALLBACK_OBSERVATIONS = {
    "hvac_plumbing": [
        "a few SEO tweaks could get you ranking above other HVAC shops nearby",
        "an online booking system would make it way easier for customers to schedule service",
        "some fresh photos on your Google listing could really help you stand out",
    ],
    "dental_ortho": [
        "online scheduling could help you fill more appointment slots",
        "a faster mobile site could help you capture patients searching on their phones",
        "a few updates to your Google listing could bring in more new patients",
    ],
    "home_services": [
        "a mobile-friendly site refresh could help you win more local jobs",
        "some updated photos on your Google listing would really help you stand out",
        "an easy quote request form could turn more visitors into customers",
    ],
    "landscaping": [
        "a portfolio page showing off your work could really set you apart locally",
        "a few local SEO tweaks could help you show up for more searches nearby",
        "adding seasonal services to your Google listing could bring in more calls",
    ],
    "legal_services": [
        "a cleaner intake process on your site could help convert more visitors to clients",
        "a faster mobile site could help you capture more people searching for attorneys",
        "a few more client reviews on Google could really boost your credibility",
    ],
    "medical_spa": [
        "online booking would make it so much easier for new clients to schedule",
        "a mobile refresh could help showcase your services to people searching on their phones",
        "some treatment photos on your Google listing would really catch people's eye",
    ],
    "real_estate": [
        "a better mobile experience could help you capture more leads on the go",
        "some local SEO work could get your listings in front of more buyers",
        "a cleaner property search on your site could keep visitors browsing longer",
    ],
    "auto_repair": [
        "online scheduling could make it way easier for customers to book appointments",
        "a faster mobile site could help you win over people searching for shops nearby",
        "some updated service photos on Google could really help you stand out",
    ],
}

DEFAULT_FALLBACKS = [
    "a stronger online presence could help a lot more people find you",
    "a mobile-friendly site refresh could bring in way more customers",
    "a few small changes online could really set you apart from the competition",
]


class OutreachAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            agent_id="outreach-001",
            name="Outreach Agent",
            description="Personalized outreach messages (+ mockup pitch flow)",
            color="#f59e0b",
        )
        self.tick_interval = 60
        self.pipeline_db = None

    async def tick(self) -> AgentEvent:
        if not self.pipeline_db:
            return self.emit("error", "No pipeline database connected")

        # Sending is now handled by ManagerAgent (QA + auto-send)

        target, mockup_item = await self._find_mockup_pitch_target()
        if target and mockup_item:
            return await self._draft_mockup_pitch(target, mockup_item)

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

    async def _send_pending_emails(self) -> AgentEvent | None:
        if not is_gmail_ready():
            return None

        sent_today = await asyncio.to_thread(self.pipeline_db.count_sent_today)
        if sent_today >= DAILY_DRAFT_LIMIT:
            return None

        unsent = await asyncio.to_thread(
            self.pipeline_db.get_unsent_outreach, "email", 1
        )
        if not unsent:
            unsent = await asyncio.to_thread(
                self.pipeline_db.get_unsent_outreach, "mockup_email", 1
            )
        if not unsent:
            return None

        row = unsent[0]
        to_email = row.get("contact_email")
        biz_name = row.get("business_name", "unknown")

        if not to_email:
            await asyncio.to_thread(
                self.pipeline_db.update_outreach_status, row["id"], "no_email"
            )
            return None

        self.current_task = {
            "type": "drafting_gmail",
            "description": f"Creating Gmail draft for {biz_name}",
        }
        self.emit("sending", f"Creating Gmail draft for {biz_name} ({to_email})")

        result = await asyncio.to_thread(
            gmail_draft, to_email, row.get("subject", ""), row.get("body", "")
        )

        if result["ok"]:
            await asyncio.to_thread(
                self.pipeline_db.update_outreach_status, row["id"], "sent"
            )
            self.tasks_completed += 1
            self.current_task = None
            return self.emit(
                "completed",
                f"Gmail DRAFT created for {biz_name} ({to_email}) | {sent_today + 1}/{DAILY_DRAFT_LIMIT} today"
            )
        else:
            await asyncio.to_thread(
                self.pipeline_db.update_outreach_status, row["id"], "failed"
            )
            self.current_task = None
            return self.emit("error", f"Gmail draft failed for {biz_name}: {result['error']}")

    async def _get_observation(self, target: dict) -> str:
        """Ask LLM for a specific observation about their site. Falls back to industry-specific."""
        needs = self._parse_needs(target.get("needs", "[]"))
        biz = target["business_name"]
        industry = target.get("industry", "unknown")
        location = target.get("location", "unknown")

        fallbacks = FALLBACK_OBSERVATIONS.get(industry, DEFAULT_FALLBACKS)
        fallback = random.choice(fallbacks)

        try:
            prompt = PERSONALIZE_PROMPT.format(
                business_name=biz,
                industry=industry,
                location=location,
                needs=needs,
            )
            result = await self.llm.generate(prompt, system="Reply with only one short observation.", complexity="low")
            result = result.strip().strip('"').strip("'").lower().rstrip(".")
            # Remove leading "i noticed" type prefixes if LLM adds them
            for prefix in ["i noticed ", "i noticed that ", "i saw that ", "i saw "]:
                if result.startswith(prefix):
                    result = result[len(prefix):]
            # Sanity check
            if result and 5 < len(result) < 150 and "[LLM Error]" not in result.lower():
                return result
        except Exception:
            pass

        return fallback

    async def _find_mockup_pitch_target(self) -> tuple[dict | None, dict | None]:
        leads = await asyncio.to_thread(
            self.pipeline_db.get_leads_by_stage, "pitch_ready", 10
        )
        for lead in leads:
            mockup = await asyncio.to_thread(
                self.pipeline_db.get_item_for_lead, "websites", lead["id"]
            )
            if not mockup:
                continue
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
        self.emit("generating", f"Writing mockup pitch for {biz}")

        try:
            metadata = mockup_item.get("metadata") or {}
            mockup_filename = metadata.get("filename", "mockup.html")
            mockup_link = f"[mockup: output/printables/{mockup_filename}]"
            contact = target.get("contact_name") or "there"

            observation = await self._get_observation(target)

            subject = _capitalize_subject(random.choice(MOCKUP_SUBJECT_LINES).format(
                business_name=biz, contact_name=contact
            ))
            email_body = MOCKUP_EMAIL_TEMPLATE.format(
                contact_name=contact,
                business_name=biz,
                observation=observation,
                mockup_link=mockup_link,
            )
            dm_body = MOCKUP_DM_TEMPLATE.format(
                contact_name=contact,
                business_name=biz,
                mockup_link=mockup_link,
            )

            await asyncio.to_thread(
                self.pipeline_db.add_outreach,
                target["id"], "mockup_email", subject, email_body,
            )
            await asyncio.to_thread(
                self.pipeline_db.add_outreach,
                target["id"], "mockup_dm", None, dm_body,
            )

            slug = biz.lower().replace(" ", "-")[:25]
            save_output(json.dumps({"subject": subject, "email": email_body, "dm": dm_body, "business": biz, "type": "mockup_pitch"}, indent=2), "outreach", f"mockup-pitch-{slug}")

            mockup_id = mockup_item.get("id")
            if mockup_id:
                await asyncio.to_thread(
                    self.pipeline_db.update_item_stage,
                    mockup_id, "polished", self.agent_id, "Pitch drafted"
                )

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
        industry = target.get("industry", "unknown")
        contact = target.get("contact_name") or "there"

        self.current_task = {
            "type": "outreach",
            "description": f"Drafting outreach for {biz}",
        }
        self.emit("generating", f"Writing outreach for {biz}")

        try:
            observation = await self._get_observation(target)

            pool = SUBJECT_LINES_NAMED + SUBJECT_LINES_GENERIC if contact != "there" else SUBJECT_LINES_GENERIC
            subject = _capitalize_subject(random.choice(pool).format(
                business_name=biz, contact_name=contact
            ))

            email_body = EMAIL_TEMPLATE.format(
                contact_name=contact,
                business_name=biz,
                observation=observation,
            )
            dm_body = DM_TEMPLATE.format(
                contact_name=contact,
                business_name=biz,
                observation=observation,
            )

            await asyncio.to_thread(
                self.pipeline_db.add_outreach,
                target["id"], "email", subject, email_body,
            )
            await asyncio.to_thread(
                self.pipeline_db.add_outreach,
                target["id"], "dm", None, dm_body,
            )

            slug = biz.lower().replace(" ", "-")[:25]
            save_output(json.dumps({"subject": subject, "email": email_body, "dm": dm_body, "business": biz, "industry": industry}, indent=2), "outreach", f"outreach-{slug}")

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

    def get_tools(self) -> list[dict]:
        return []
