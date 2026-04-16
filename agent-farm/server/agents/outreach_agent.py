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

# When no email was scraped, the subject doubles as a contact-reminder so Jake
# sees the phone/social inline in Drafts. Business name is always first so he
# can scan drafts quickly.
MOCKUP_MANUAL_SUBJECT_TEMPLATE = "[MANUAL] {business_name} — {contact_hint}"

# Opener when the lead has no website on file — the original "built you one from scratch" pitch.
MOCKUP_OPENER_NO_SITE = (
    "Hope you're having a good week at {business_name}. I'm a web designer here in "
    "{location_short} and I came across your business — noticed you don't have a "
    "website yet, which honestly surprised me given how solid your reputation is locally."
)

# Opener when the lead already has a website — frame as an alternate/refresh concept
# rather than falsely claiming they have nothing online.
MOCKUP_OPENER_HAS_SITE = (
    "Hope you're having a good week at {business_name}. I'm a web designer here in "
    "{location_short} and I came across your current site — really liked what you've "
    "got going, and it got me thinking about a fresh take I'd love to show you."
)

MOCKUP_EMAIL_TEMPLATE = """Hi {contact_name},

{opener}

So instead of just pitching, I went ahead and built you a full mockup this morning. Preview is in this email and the complete HTML file is attached — open it in any browser to click through it.

A few things I focused on:
  • Clean, modern design that works great on phones
  • {observation}
  • Fast-loading, no bloat, built to rank on Google

If you like it, the source files are yours, free. If you want me to polish it up, register your domain, and get it live, I can have it done within a week.

Either way, no pressure. Would love to hear what you think.

Jake McGaha
Web Design & Local SEO
jakemcgaha.com
"""

# Prepended to mockup_email body when there's no scraped email — gives Jake
# everything he needs to manually route the draft.
MANUAL_CONTACT_HEADER = """━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠ MANUAL SEND — no email on file for this lead
Business: {business_name}
Phone:    {phone}
Maps:     {maps_url}
Social:   {social_url}
Location: {location}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"""

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

        # Standard outreach is for businesses that ALREADY have a website.
        # No-website leads are handled exclusively by the web-dev mockup flow,
        # which fast-tracks them to pitch_ready and triggers a single mockup-pitch email.
        leads = await asyncio.to_thread(self.pipeline_db.get_leads_by_stage, "scraped", 20)
        if not leads:
            leads = await asyncio.to_thread(self.pipeline_db.get_leads_by_stage, "researched", 20)

        target = None
        for lead in leads:
            if not lead.get("website"):
                continue  # No-website leads go through the web-dev/mockup flow instead
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
            # Sanity check — reject empty, too short/long, or LLM error passthroughs
            lower_result = result.lower()
            if (result and 5 < len(result) < 150
                    and "[llm error]" not in lower_result
                    and "unavailable" not in lower_result
                    and "error" not in lower_result.split()[:3]):
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

            # Parse contact hints saved by lead_scraper into lead.notes
            lead_notes = target.get("notes") or ""
            maps_url = ""
            social_url = ""
            if lead_notes:
                try:
                    parsed = json.loads(lead_notes)
                    maps_url = parsed.get("maps_url") or ""
                    social_url = parsed.get("social_url") or ""
                except (json.JSONDecodeError, TypeError):
                    pass

            phone = target.get("contact_phone") or ""
            has_email = bool(target.get("contact_email"))

            # Subject: standard template if we have an email, otherwise a
            # manual-review subject that surfaces the phone/social inline
            if has_email:
                subject = _capitalize_subject(random.choice(MOCKUP_SUBJECT_LINES).format(
                    business_name=biz, contact_name=contact
                ))
            else:
                # contact_hint = phone > social > maps > placeholder
                contact_hint = phone or social_url or maps_url or "no contact found"
                subject = MOCKUP_MANUAL_SUBJECT_TEMPLATE.format(
                    business_name=biz, contact_hint=contact_hint
                )

            # Extract "City, ST" from full location string for the opener.
            # Input examples:
            #   "123 Main St, Big Rapids, MI 49307"         → "Big Rapids, MI"
            #   "200 W Main St, Mecosta, MI 49332, USA"     → "Mecosta, MI"
            #   "Big Rapids, MI"                             → "Big Rapids, MI"
            location_full = target.get("location") or ""
            parts = [p.strip() for p in location_full.split(",") if p.strip()]
            # Drop trailing country if present
            if parts and parts[-1].upper() in ("USA", "US", "UNITED STATES"):
                parts = parts[:-1]
            location_short = "your area"
            if len(parts) >= 2:
                # Last part should hold state (+ optional zip); take just the state token
                state_tokens = parts[-1].split()
                state = state_tokens[0] if state_tokens else ""
                city = parts[-2]
                # Guard against address-line fallback (e.g. "123 Main St")
                if any(ch.isdigit() for ch in city[:3]):
                    location_short = state or "your area"
                else:
                    location_short = f"{city}, {state}".rstrip(", ")
            elif parts:
                location_short = parts[0]

            # Pick opener based on whether the lead has a real site already —
            # "no website yet" lies if Google actually has one on file.
            has_site = bool(target.get("website"))
            opener_template = MOCKUP_OPENER_HAS_SITE if has_site else MOCKUP_OPENER_NO_SITE
            opener = opener_template.format(
                business_name=biz,
                location_short=location_short,
            )

            body_base = MOCKUP_EMAIL_TEMPLATE.format(
                contact_name=contact,
                business_name=biz,
                observation=observation,
                opener=opener,
            )
            if has_email:
                email_body = body_base
            else:
                header = MANUAL_CONTACT_HEADER.format(
                    business_name=biz,
                    phone=phone or "(none)",
                    maps_url=maps_url or "(none)",
                    social_url=social_url or "(none)",
                    location=target.get("location") or "(unknown)",
                )
                email_body = header + body_base

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
