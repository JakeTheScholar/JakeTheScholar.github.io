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
from gmail_sender import send_email, is_gmail_ready

log = logging.getLogger("manager-agent")

# Max emails to auto-send per tick (rate limiting)
SEND_PER_TICK = 3
# Daily send cap (start low to warm Gmail account, ramp up over weeks)
DAILY_SEND_LIMIT = 20

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

    async def tick(self) -> AgentEvent:
        if not self.orchestrator:
            return self.emit("error", "No orchestrator reference — cannot monitor agents")

        # ── Design QA (check generated prompts/images for AI slop) ──
        design_result = await self._qa_design_quality()
        if design_result:
            return design_result

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

    # ── Email QA + Auto-Send ─────────────────────────────────────

    @staticmethod
    def _qa_check(row: dict) -> tuple[bool, str]:
        """Validate an outreach email draft. Returns (passed, reason)."""
        subject = row.get("subject") or ""
        body = row.get("body") or ""
        to_email = row.get("contact_email") or ""

        # Must have a recipient
        if not to_email or "@" not in to_email:
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
        """Review drafted emails, QA-check them, and auto-send if they pass."""
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

        # Check daily send count
        sent_today = await asyncio.to_thread(pipeline_db.count_sent_today)
        if sent_today >= DAILY_SEND_LIMIT:
            return None

        # Get unsent email drafts
        unsent = await asyncio.to_thread(pipeline_db.get_unsent_outreach, "email", SEND_PER_TICK)
        if not unsent:
            unsent = await asyncio.to_thread(pipeline_db.get_unsent_outreach, "mockup_email", SEND_PER_TICK)
        if not unsent:
            return None

        sent = 0
        rejected = 0
        for row in unsent:
            biz = row.get("business_name", "unknown")
            to_email = row.get("contact_email")

            if not to_email:
                await asyncio.to_thread(pipeline_db.update_outreach_status, row["id"], "no_email")
                continue

            passed, reason = self._qa_check(row)

            if not passed:
                log.info(f"QA REJECTED draft {row['id']} for {biz}: {reason}")
                await asyncio.to_thread(pipeline_db.update_outreach_status, row["id"], "rejected")
                rejected += 1
                continue

            # QA passed — send directly
            self.current_task = {
                "type": "qa_send",
                "description": f"QA passed, sending to {biz}",
            }

            result = await asyncio.to_thread(
                send_email, to_email, row.get("subject", ""), row.get("body", "")
            )

            if result["ok"]:
                await asyncio.to_thread(pipeline_db.update_outreach_status, row["id"], "sent")
                sent += 1
                log.info(f"QA SENT email to {biz} ({to_email})")
            else:
                await asyncio.to_thread(pipeline_db.update_outreach_status, row["id"], "failed")
                log.warning(f"Send failed for {biz}: {result['error']}")

        if sent or rejected:
            self.tasks_completed += sent
            self.current_task = None
            parts = []
            if sent:
                parts.append(f"{sent} sent")
            if rejected:
                parts.append(f"{rejected} rejected")
            return self.emit("qa_review", f"Email QA: {', '.join(parts)} | {sent_today + sent}/{DAILY_SEND_LIMIT} today")

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
