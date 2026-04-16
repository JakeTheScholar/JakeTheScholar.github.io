"""Farm Manager Agent — monitors health of all agents, restarts stalled/crashed ones,
QA-reviews outreach emails before auto-sending via Gmail, and reviews generated
designs for AI-slop quality issues.

Runs on a 120-second tick interval. Each tick:
1. Design QA: review generated image prompts for AI-slop indicators.
2. Email QA: review drafted outreach, validate quality, send if good.
3. Health check: inspect agents, detect stalls/crashes, auto-restart.
"""

import re
import sys
import json
import asyncio
import logging
from datetime import datetime, timedelta
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from agent_base import BaseAgent, AgentEvent
from gmail_sender import send_email, create_draft, is_gmail_ready
from tools.screenshot import screenshot_html

OUTPUT_DIR = Path(__file__).parent.parent / "output"

log = logging.getLogger("manager-agent")

# Max emails to auto-send per tick (rate limiting)
SEND_PER_TICK = 3
# Daily send cap (start low to warm Gmail account, ramp up over weeks)
DAILY_SEND_LIMIT = 20
# Daily cap on manual-review mockup drafts (Jake reviews/sends these by hand,
# so drafting more than ~10/day creates a triage backlog).
DAILY_MOCKUP_DRAFT_LIMIT = 10

# Max automatic restarts per agent before giving up
MAX_RESTARTS = 3

# An agent is "stalled" if running but no tick in 3x its tick_interval
STALL_MULTIPLIER = 3


class ManagerAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            agent_id="manager-001",
            name="Farm Manager",
            description="Monitors agent health, detects stalls/crashes, auto-restarts",
            color="#10b981",
        )
        self.tick_interval = 120  # 2 minutes
        self.orchestrator = None  # Injected after registration
        self.restart_count: dict[str, int] = {}  # agent_id -> restart attempts
        self._last_seen_running: dict[str, datetime] = {}  # tracks when we last saw an agent running
        self._previously_running: set[str] = set()  # agents that were running on previous tick
        self._retry_count: dict[int, int] = {}  # outreach row id -> retry attempts

    async def tick(self) -> AgentEvent:
        if not self.orchestrator:
            return self.emit("error", "No orchestrator reference — cannot monitor agents")

        # ── Design QA (check generated prompts/images for AI slop) ──
        design_result = await self._qa_design_quality()
        if design_result:
            return design_result

        # ── Auto-recover stuck drafts before QA so they get picked up this tick ──
        await self._auto_recover_stuck_drafts()

        # ── Email QA + auto-send (runs before health check) ──
        qa_result = await self._qa_and_send_emails()
        if qa_result:
            return qa_result

        now = datetime.now()
        agents = self.orchestrator.agents
        total = 0
        running = 0
        stalled_agents: list[str] = []
        crashed_agents: list[str] = []
        restarts_performed: list[str] = []

        for aid, agent in agents.items():
            # Skip self
            if aid == self.agent_id:
                continue

            total += 1

            if agent.status == "running":
                running += 1
                # Update last-seen timestamp for running agents
                self._last_seen_running[aid] = now

                # Check for stall: running but no event activity in 3x tick_interval
                stall_threshold = timedelta(seconds=agent.tick_interval * STALL_MULTIPLIER)
                last_seen = self._last_seen_running.get(aid)

                # Check the agent's activity log for the most recent event
                if agent.activity_log:
                    last_event_time = self._parse_timestamp(agent.activity_log[-1].timestamp)
                    if last_event_time and (now - last_event_time) > stall_threshold:
                        stalled_agents.append(aid)
                        log.warning(f"Agent {agent.name} ({aid}) appears stalled — "
                                    f"last event {now - last_event_time} ago")

                # Also check if the asyncio task is still alive
                task = self.orchestrator.tasks.get(aid)
                if task and task.done():
                    stalled_agents.append(aid)
                    log.warning(f"Agent {agent.name} ({aid}) task is done but status is still 'running'")

            elif agent.status == "idle" and aid in self._previously_running:
                # Was running last tick but now idle — possible crash or unexpected stop
                # Only flag if we didn't intentionally stop it (check for error status too)
                crashed_agents.append(aid)
                log.warning(f"Agent {agent.name} ({aid}) went from running to idle unexpectedly")

            elif agent.status == "error" and aid in self._previously_running:
                crashed_agents.append(aid)
                log.warning(f"Agent {agent.name} ({aid}) is in error state")

        # Deduplicate
        stalled_agents = list(set(stalled_agents))

        # Attempt restarts for stalled agents
        for aid in stalled_agents:
            restarts = self.restart_count.get(aid, 0)
            if restarts >= MAX_RESTARTS:
                log.warning(f"Agent {aid} hit restart cap ({MAX_RESTARTS}), skipping")
                continue
            try:
                agent = agents[aid]
                log.info(f"Restarting stalled agent: {agent.name} ({aid}) — attempt {restarts + 1}")
                await self.orchestrator.stop_agent(aid)
                await self.orchestrator.start_agent(aid)
                self.restart_count[aid] = restarts + 1
                restarts_performed.append(aid)
            except Exception as e:
                log.error(f"Failed to restart stalled agent {aid}: {e}")

        # Attempt restarts for crashed agents
        for aid in crashed_agents:
            restarts = self.restart_count.get(aid, 0)
            if restarts >= MAX_RESTARTS:
                log.warning(f"Agent {aid} hit restart cap ({MAX_RESTARTS}), skipping")
                continue
            try:
                agent = agents[aid]
                log.info(f"Restarting crashed agent: {agent.name} ({aid}) — attempt {restarts + 1}")
                await self.orchestrator.start_agent(aid)
                self.restart_count[aid] = restarts + 1
                restarts_performed.append(aid)
            except Exception as e:
                log.error(f"Failed to restart crashed agent {aid}: {e}")

        # Update previously-running set for next tick
        self._previously_running = {
            aid for aid, agent in agents.items()
            if agent.status == "running" and aid != self.agent_id
        }

        # Build health summary
        stalled_count = len(stalled_agents)
        crashed_count = len(crashed_agents)
        restart_total = sum(self.restart_count.values())

        self.current_task = {
            "type": "health_check",
            "description": f"{total} agents | {running} running | {stalled_count} stalled | {crashed_count} crashed",
        }

        summary_parts = [
            f"Health check: {total} agents, {running} running",
        ]
        if stalled_count:
            summary_parts.append(f"{stalled_count} stalled ({', '.join(stalled_agents)})")
        if crashed_count:
            summary_parts.append(f"{crashed_count} crashed ({', '.join(crashed_agents)})")
        if restarts_performed:
            summary_parts.append(f"Restarted: {', '.join(restarts_performed)}")
        summary_parts.append(f"Total restarts: {restart_total}")

        if not stalled_count and not crashed_count:
            summary_parts.append("All systems nominal")

        detail = " | ".join(summary_parts)

        if restarts_performed:
            self.tasks_completed += len(restarts_performed)

        return self.emit("health_check", detail)

    # ── Design QA ───────────────────────────────────────────────

    # Words/phrases that signal AI-slop prompts — these produce the glossy,
    # oversaturated, generic look that buyers immediately recognize as AI.
    AI_SLOP_FLAGS = [
        "trending on artstation", "8k", "hyper realistic", "ultra realistic",
        "unreal engine", "octane render", "dramatic lighting", "cinematic",
        "masterpiece", "best quality", "highly detailed", "photorealistic",
        "ray tracing", "volumetric lighting", "studio lighting",
    ]

    # Required anti-slop keywords — at least one should appear in good prompts
    ANTI_SLOP_KEYWORDS = [
        "flat", "vector", "clean lines", "simple", "minimal", "2d",
        "hand-drawn", "screen print", "retro", "vintage", "die-cut",
        "line art", "illustration style", "watercolor",
    ]

    async def _qa_design_quality(self) -> AgentEvent | None:
        """Scan recent image prompt files for AI-slop indicators and flag them."""
        prompt_dir = Path(__file__).parent.parent / "output" / "image-prompts"
        if not prompt_dir.exists():
            return None

        review_file = prompt_dir / ".last_reviewed"
        last_reviewed = ""
        if review_file.exists():
            last_reviewed = review_file.read_text().strip()

        prompt_files = sorted(prompt_dir.glob("*.json"))
        if not prompt_files:
            return None

        # Only review files we haven't seen yet
        new_files = [f for f in prompt_files if f.name > last_reviewed]
        if not new_files:
            return None

        flagged = []
        improved = 0
        reviewed = 0

        for pf in new_files[:5]:  # Review up to 5 per tick
            reviewed += 1
            try:
                data = json.loads(pf.read_text())
            except (json.JSONDecodeError, OSError):
                continue

            prompt_text = (data.get("prompt", "") or "").lower()
            issues = []

            # Check for slop indicators
            for flag in self.AI_SLOP_FLAGS:
                if flag in prompt_text:
                    issues.append(flag)

            # Check for missing anti-slop keywords
            has_anti_slop = any(kw in prompt_text for kw in self.ANTI_SLOP_KEYWORDS)
            if not has_anti_slop:
                issues.append("missing anti-slop style keywords (flat/vector/minimal/etc)")

            # Check for white/solid background (important for POD)
            product_id = data.get("product_id", "")
            is_pod = any(t in product_id for t in ("tshirt", "hoodie", "mug", "tote"))
            if is_pod and "background" not in prompt_text:
                issues.append("POD design missing solid background directive")

            if issues:
                flagged.append({
                    "file": pf.name,
                    "product": data.get("product_title", pf.stem),
                    "issues": issues,
                })

                # Auto-improve: rewrite prompt with anti-slop fixes
                new_prompt = data.get("prompt", "")
                for slop_term in self.AI_SLOP_FLAGS:
                    new_prompt = re.sub(
                        re.escape(slop_term), "", new_prompt, flags=re.IGNORECASE
                    )
                # Clean up double spaces/commas
                new_prompt = re.sub(r",\s*,", ",", new_prompt)
                new_prompt = re.sub(r"\s{2,}", " ", new_prompt).strip()

                # Add anti-slop directives if missing
                if not has_anti_slop:
                    new_prompt += ", flat 2d vector style, clean lines, simple"
                if is_pod and "background" not in prompt_text:
                    new_prompt += ", isolated on solid white background"

                data["prompt"] = new_prompt
                data["_design_qa"] = {
                    "reviewed": True,
                    "issues_found": issues,
                    "auto_improved": True,
                }
                pf.write_text(json.dumps(data, indent=2))
                improved += 1

        # Update last-reviewed marker
        if new_files:
            review_file.write_text(new_files[-1].name)

        if flagged:
            self.tasks_completed += 1
            names = ", ".join(f["product"] for f in flagged[:3])
            return self.emit(
                "design_qa",
                f"Design QA: reviewed {reviewed}, flagged {len(flagged)} for AI-slop "
                f"({names}), auto-improved {improved}"
            )

        return None

    # ── Auto-recovery: revive stuck drafts ────────────────────────

    MAX_RETRIES_PER_ROW = 2

    async def _auto_recover_stuck_drafts(self) -> None:
        """Flip stuck mockup_email rows back to 'drafted' so they get re-QA'd.

        Recovers from two failure modes:
          1. `failed` rows: Gmail API hiccup — retry up to MAX_RETRIES_PER_ROW times.
          2. `rejected` rows older than 2h: QA may have rejected under a transient
             LLM outage; give them one more pass with the current template logic.
        """
        pipeline_db = getattr(self, "pipeline_db", None)
        if not pipeline_db:
            outreach = self.orchestrator.agents.get("outreach-001") if self.orchestrator else None
            if outreach:
                pipeline_db = getattr(outreach, "pipeline_db", None)
        if not pipeline_db:
            return

        recovered = 0
        # Retry API-failed rows (fresh, likely transient)
        for row in await asyncio.to_thread(pipeline_db.get_stuck_outreach, "mockup_email", "failed", 0):
            rid = row["id"]
            if self._retry_count.get(rid, 0) >= self.MAX_RETRIES_PER_ROW:
                continue
            await asyncio.to_thread(pipeline_db.update_outreach_status, rid, "drafted")
            self._retry_count[rid] = self._retry_count.get(rid, 0) + 1
            recovered += 1

        # Retry QA-rejected rows older than 2h (transient LLM issues, etc.)
        for row in await asyncio.to_thread(pipeline_db.get_stuck_outreach, "mockup_email", "rejected", 2):
            rid = row["id"]
            if self._retry_count.get(rid, 0) >= self.MAX_RETRIES_PER_ROW:
                continue
            await asyncio.to_thread(pipeline_db.update_outreach_status, rid, "drafted")
            self._retry_count[rid] = self._retry_count.get(rid, 0) + 1
            recovered += 1

        if recovered:
            log.info(f"Auto-recovered {recovered} stuck mockup_email drafts for re-QA")

    # ── Email QA + Auto-Send ─────────────────────────────────────

    @staticmethod
    def _qa_check(row: dict, allow_missing_email: bool = False) -> tuple[bool, str]:
        """Validate an outreach email draft. Returns (passed, reason).

        `allow_missing_email=True` for mockup_email track — we intentionally
        draft with a placeholder recipient so Jake can manually route from Drafts.
        """
        subject = row.get("subject") or ""
        body = row.get("body") or ""
        to_email = row.get("contact_email") or ""

        # Standard outreach requires a real recipient; mockup drafts may not have one
        if not allow_missing_email and (not to_email or "@" not in to_email):
            return False, "missing or invalid contact_email"

        # Subject must exist and not be empty
        if not subject.strip():
            return False, "empty subject"

        # No "None" or generic placeholder names in subject or body
        if "None" in subject or "Hi None" in body or "Hey None" in body:
            return False, "contains 'None' — missing contact name"
        if "Business Owner" in subject or "Hi Business Owner" in body or "Hey Business Owner" in body:
            return False, "contains generic 'Business Owner' — needs a real contact name"
        # "there" in subject looks weird (e.g. "there - quick question")
        if subject.lower().startswith("there"):
            return False, "subject starts with 'there' — needs a name-free template"

        # Subject should start with uppercase
        if subject[0] != subject[0].upper():
            return False, "subject not capitalized"

        # Body shouldn't be too short (broken template)
        if len(body.strip()) < 50:
            return False, "body too short"

        # No placeholder artifacts
        if "{" in subject or "{" in body:
            return False, "unresolved template placeholder"

        return True, "ok"

    async def _qa_and_send_emails(self) -> AgentEvent | None:
        """Two tracks:
          - `email` channel (standard outreach, with-website leads) → QA → auto-send
          - `mockup_email` channel (no-website mockup pitch) → QA → create Gmail DRAFT for manual review
        """
        if not is_gmail_ready():
            return None

        pipeline_db = getattr(self, "pipeline_db", None)
        if not pipeline_db:
            # Try to get it from the orchestrator's outreach agent
            outreach = self.orchestrator.agents.get("outreach-001") if self.orchestrator else None
            if outreach:
                pipeline_db = getattr(outreach, "pipeline_db", None)
            if not pipeline_db:
                return None

        sent = 0
        rejected = 0
        drafted = 0

        # ── Track 1: auto-send standard outreach (channel = "email") ──
        sent_today = await asyncio.to_thread(pipeline_db.count_sent_today)
        if sent_today < DAILY_SEND_LIMIT:
            batch = min(SEND_PER_TICK, DAILY_SEND_LIMIT - sent_today)
            unsent = await asyncio.to_thread(pipeline_db.get_unsent_outreach, "email", batch)
            for row in unsent:
                biz = row.get("business_name", "unknown")
                to_email = row.get("contact_email")

                if not to_email:
                    await asyncio.to_thread(pipeline_db.update_outreach_status, row["id"], "no_email")
                    continue

                passed, reason = self._qa_check(row)
                if not passed:
                    log.info(f"QA REJECTED email draft {row['id']} for {biz}: {reason}")
                    await asyncio.to_thread(pipeline_db.update_outreach_status, row["id"], "rejected")
                    rejected += 1
                    continue

                self.current_task = {"type": "qa_send", "description": f"QA passed, sending to {biz}"}
                result = await asyncio.to_thread(send_email, to_email, row.get("subject", ""), row.get("body", ""))

                if result["ok"]:
                    await asyncio.to_thread(pipeline_db.update_outreach_status, row["id"], "sent")
                    sent += 1
                    log.info(f"QA SENT email to {biz} ({to_email})")
                else:
                    await asyncio.to_thread(pipeline_db.update_outreach_status, row["id"], "failed")
                    log.warning(f"Send failed for {biz}: {result['error']}")

        # ── Track 2: Gmail DRAFT only for mockup pitches — user reviews before sending ──
        # Sender's own Gmail, used as a placeholder "to" for drafts with no scraped email.
        # Draft still lands in Jake's Drafts folder; the subject/body contain the contact info.
        PLACEHOLDER_TO = "jakemcgaha968@gmail.com"

        # Daily cap: only draft up to DAILY_MOCKUP_DRAFT_LIMIT mockup emails per day.
        drafted_today = await asyncio.to_thread(
            pipeline_db.count_drafted_today, "mockup_email",
            ["gmail_draft", "gmail_draft_manual"]
        )
        remaining = DAILY_MOCKUP_DRAFT_LIMIT - drafted_today
        if remaining <= 0:
            log.info(
                f"Daily mockup-draft cap reached ({drafted_today}/{DAILY_MOCKUP_DRAFT_LIMIT}) — "
                f"skipping mockup drafting this tick"
            )
            unsent_mock = []
        else:
            mock_batch = min(SEND_PER_TICK, remaining)
            unsent_mock = await asyncio.to_thread(pipeline_db.get_unsent_outreach, "mockup_email", mock_batch)

        for row in unsent_mock:
            biz = row.get("business_name", "unknown")
            to_email = row.get("contact_email") or PLACEHOLDER_TO  # never skip — always draft

            passed, reason = self._qa_check(row, allow_missing_email=True)
            if not passed:
                log.info(f"QA REJECTED mockup draft {row['id']} for {biz}: {reason}")
                await asyncio.to_thread(pipeline_db.update_outreach_status, row["id"], "rejected")
                rejected += 1
                continue

            self.current_task = {"type": "qa_draft", "description": f"Creating Gmail draft for {biz}"}

            # Look up the mockup HTML file via the websites pipeline item linked to this lead
            attachments: list[str] = []
            inline_image: str | None = None
            mockup_broken = False
            try:
                lead_id = row.get("lead_id")
                mockup_item = await asyncio.to_thread(
                    pipeline_db.get_item_for_lead, "websites", lead_id
                ) if lead_id else None
                meta = (mockup_item or {}).get("metadata") or {}
                filename = meta.get("filename")
                if filename:
                    html_path = OUTPUT_DIR / "website-mockups" / filename
                    if html_path.exists():
                        # Auto-fix: detect truncated HTML (LLM was cut off mid-tag).
                        # A valid mockup ends with </html> and has real section content.
                        try:
                            html_text = html_path.read_text(encoding="utf-8", errors="replace")
                        except Exception:
                            html_text = ""
                        valid = (
                            "</body>" in html_text.lower()
                            and "</html>" in html_text.lower()
                            and len(html_text) >= 3000
                        )
                        if not valid:
                            mockup_broken = True
                        else:
                            attachments.append(str(html_path))
                            # Generate screenshot alongside the HTML. Regenerate if
                            # the cached PNG is suspiciously small (< 20KB usually
                            # means the render failed before CSS/fonts loaded).
                            png_path = html_path.with_suffix(".png")
                            needs_render = (
                                not png_path.exists()
                                or png_path.stat().st_size < 20_000
                            )
                            if needs_render:
                                result_png = await asyncio.to_thread(screenshot_html, html_path, png_path)
                                if result_png and result_png.exists() and result_png.stat().st_size >= 20_000:
                                    inline_image = str(result_png)
                            else:
                                inline_image = str(png_path)
            except Exception as e:
                log.warning(f"Mockup attachment lookup failed for {biz}: {e}")

            # Auto-fix: broken HTML means web-dev-agent's LLM output got truncated.
            # Purge the pipeline item + file + outreach row, reset lead to scraped,
            # web-dev-agent will regenerate on its next tick.
            if mockup_broken:
                try:
                    if mockup_item:
                        await asyncio.to_thread(pipeline_db.delete_item, mockup_item["id"])
                    if filename:
                        bad_html = OUTPUT_DIR / "website-mockups" / filename
                        bad_png = bad_html.with_suffix(".png")
                        for p in (bad_html, bad_png):
                            try:
                                if p.exists():
                                    p.unlink()
                            except Exception:
                                pass
                    if lead_id:
                        await asyncio.to_thread(
                            pipeline_db.reset_lead_to_scraped, lead_id,
                            self.agent_id, "Auto-fix: mockup HTML was truncated"
                        )
                    await asyncio.to_thread(pipeline_db.delete_outreach_row, row["id"])
                except Exception as e:
                    log.warning(f"Auto-fix cleanup failed for {biz}: {e}")
                log.info(f"AUTO-FIX: purged broken mockup for {biz} — web-dev will rebuild")
                continue

            result = await asyncio.to_thread(
                create_draft,
                to_email, row.get("subject", ""), row.get("body", ""),
                attachments, inline_image,
            )

            if result["ok"]:
                # Distinguish "ready to send" vs "needs manual routing" drafts via status
                status = "gmail_draft" if row.get("contact_email") else "gmail_draft_manual"
                await asyncio.to_thread(pipeline_db.update_outreach_status, row["id"], status)
                drafted += 1
                tag = "MANUAL" if status == "gmail_draft_manual" else "ready"
                extras = []
                if attachments:
                    extras.append(f"{len(attachments)} attached")
                if inline_image:
                    extras.append("screenshot inline")
                extras_str = f" [{', '.join(extras)}]" if extras else ""
                log.info(f"Gmail DRAFT ({tag}) created for {biz} ({to_email}){extras_str} — awaiting manual review")
            else:
                await asyncio.to_thread(pipeline_db.update_outreach_status, row["id"], "failed")
                log.warning(f"Draft creation failed for {biz}: {result['error']}")

        if sent or rejected or drafted:
            self.tasks_completed += sent + drafted
            self.current_task = None
            parts = []
            if sent:
                parts.append(f"{sent} sent")
            if drafted:
                parts.append(f"{drafted} drafted for review")
            if rejected:
                parts.append(f"{rejected} rejected")
            return self.emit(
                "qa_review",
                f"Email QA: {', '.join(parts)} | "
                f"{sent_today + sent}/{DAILY_SEND_LIMIT} sent, "
                f"{drafted_today + drafted}/{DAILY_MOCKUP_DRAFT_LIMIT} mockup drafts today"
            )

        return None

    # ── Utilities ──────────────────────────────────────────────────

    @staticmethod
    def _parse_timestamp(ts: str) -> datetime | None:
        """Parse an ISO timestamp string to datetime."""
        try:
            return datetime.fromisoformat(ts)
        except (ValueError, TypeError):
            return None

    def get_tools(self) -> list[dict]:
        return []
