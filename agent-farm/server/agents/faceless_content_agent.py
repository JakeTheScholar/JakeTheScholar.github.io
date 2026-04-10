"""Faceless Content Agent — generates short-form video scripts for TikTok/Reels."""

import sys
import json
import asyncio
import random
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from agent_base import BaseAgent, AgentEvent
from tools.file_tools import ensure_output_dir


# Hook formulas scraped from top-performing AI-agent Reels/TikToks.
# Source pattern: @raycfu 492K-view viral Reel ("His Openclaw agent is making him $80,000 all autonomously"),
# @itstylergermain ("I built a full content OS in a week using nothing but Claude Code"),
# @cyphyr.ai ("Stop sending cold emails with generic portfolios"),
# @maverickgpt ("Claude just killed video editors").
# These are the 5 structural templates that consistently break 100K views in this niche.
HOOK_FORMULAS = [
    # 1. Attribution + revenue + autonomy — highest performer (492K views)
    '"His [agent/system] is making him $[X] all autonomously" — name the creator, drop the number, credit them.',
    # 2. Pattern interrupt — "Stop X" → here's the new way
    '"Stop [common bad practice]" → immediate twist showing the new automated approach with receipts.',
    # 3. Speed + tool flex — "I built X in Y days using nothing but Z"
    '"I built [thing] in [short time] using nothing but [tool]" — list everything it does, then a DM CTA.',
    # 4. Killed-the-profession — bold declaration + 3-step recipe
    '"[Tool] just killed [profession]. You can now [do thing] in [N] steps." — numbered setup, immediate demo.',
    # 5. "$X system" — frame as a repeatable template
    '"How to create a $[X] [niche] system" — positions the build as a monetizable template, not a demo.',
]

# DM-gated engagement funnels — both top creators used this
DM_FUNNEL_TEMPLATES = [
    'Comment "[KEYWORD]" and I\'ll send you every prompt I used',
    'Comment "[KEYWORD]" and I\'ll DM you the full guide',
    'Want the source files? Comment "[KEYWORD]" below',
]


# Content niches and hooks that perform well in finance/hustle space
CONTENT_NICHES = [
    {
        "id": "trading-tips",
        "name": "Trading Tips",
        "topics": [
            "how I turned $50 into $500 day trading futures",
            "the one indicator that changed my trading forever",
            "why 90% of traders lose money and how to be the 10%",
            "my morning trading routine that makes me money",
            "stop loss strategies that actually protect your capital",
            "the psychology behind profitable trading",
        ],
    },
    {
        "id": "ai-side-hustles",
        "name": "AI Side Hustles",
        "topics": [
            "I built an AI agent that makes money while I sleep",
            "how to sell AI-generated digital products on Etsy",
            "the AI automation skill businesses will pay $5k/month for",
            "I replaced my 9-5 income with AI automation clients",
            "5 AI tools that are printing money right now",
            "how to build a faceless TikTok channel with AI",
        ],
    },
    {
        "id": "personal-finance",
        "name": "Personal Finance",
        "topics": [
            "the budget hack that saved me $10,000 this year",
            "why your savings account is losing you money",
            "how I built a 6-month emergency fund in 90 days",
            "the debt payoff strategy no one talks about",
            "investing 101: what I wish I knew at 20",
            "how compound interest made me financially free",
        ],
    },
    {
        "id": "tech-builds",
        "name": "Tech Builds & Demos",
        "topics": [
            "I built a trading bot that passes funded evaluations",
            "watch me build an AI chatbot for a business in 30 minutes",
            "my cyberpunk AI agent dashboard that runs 24/7",
            "automating my entire workflow with Python and AI",
            "building a SaaS product from scratch in one weekend",
            "my home lab setup for running AI models locally",
        ],
    },
    {
        # Modeled directly on the top-performing Reels scraped via Apify:
        # @raycfu (492K views), @itstylergermain, @cyphyr.ai, @maverickgpt.
        "id": "ai-agent-revenue",
        "name": "AI Agent Revenue",
        "topics": [
            "his Claude agent is making him $80,000 a month all autonomously",
            "I built a full content OS in a week using nothing but Claude Code",
            "stop sending cold emails with generic portfolios do this instead",
            "Claude just killed video editors here's the 3-step setup",
            "how to create a $3 million Claude content script system",
            "my AI agent farm runs 21 bots 24/7 and I touch nothing",
            "I replaced an entire marketing team with Claude Code and Remotion",
            "the one prompt that turned my agency into an overnight success",
        ],
    },
]

PLATFORMS = ["tiktok", "reels", "shorts"]

SCRIPT_PROMPT = """Write a viral short-form video script for {platform} about: "{topic}"

Niche: {niche}

Use one of these proven hook formulas (scraped from top-performing AI-content creators — @raycfu's 492K-view Reel was formula #1):
{hook_formulas}

DM-gated CTA templates (both top creators in the niche used these):
{dm_funnels}

Requirements:
- Hook (first 1-3 seconds) — must stop the scroll. MUST follow one of the formulas above. If the topic names a specific creator ("his [X] agent"), use formula #1 (attribution + revenue + autonomy).
- Body (15-45 seconds) — deliver value fast, use numbered lists or "here's the thing" transitions. If the hook promises N steps, deliver exactly N.
- CTA (last 3-5 seconds) — USE a DM-gated funnel. Replace [KEYWORD] with something memorable (e.g. "CLAUDE", "AGENT", "BUILD").
- Total duration: 30-60 seconds
- Tone: confident but relatable, like talking to a friend who's also into {niche_lower}
- Include [B-ROLL] and [TEXT ON SCREEN] cues for editing

Output ONLY a JSON object:
{{
  "hook": "the opening line/visual",
  "hook_text_overlay": "text shown on screen during hook",
  "body_script": "the full narration script",
  "text_overlays": ["text 1", "text 2", "text 3"],
  "b_roll_cues": ["visual cue 1", "visual cue 2"],
  "cta": "the closing call to action",
  "hashtags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "estimated_duration_seconds": 45,
  "caption": "the post caption (2-3 lines with emojis)"
}}"""


class FacelessContentAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            agent_id="faceless-content-001",
            name="Faceless Content",
            description="Generates viral short-form video scripts for TikTok, Reels & Shorts",
            color="#f43f5e",
        )
        self.tick_interval = 75
        self.pipeline_db = None
        self.niche_index = 0
        self.topic_index = 0

    async def tick(self) -> AgentEvent:
        niche = CONTENT_NICHES[self.niche_index % len(CONTENT_NICHES)]
        topic = niche["topics"][self.topic_index % len(niche["topics"])]
        platform = PLATFORMS[self.tasks_completed % len(PLATFORMS)]

        self.current_task = {
            "type": "content-script",
            "description": f"Writing {platform} script: {topic[:50]}...",
        }

        self.emit("writing", f"Creating {platform} script — {niche['name']}")

        try:
            hook_formulas_text = "\n".join(f"  {i+1}. {f}" for i, f in enumerate(HOOK_FORMULAS))
            dm_funnels_text = "\n".join(f"  - {t}" for t in DM_FUNNEL_TEMPLATES)
            prompt = SCRIPT_PROMPT.format(
                platform=platform,
                topic=topic,
                niche=niche["name"],
                niche_lower=niche["name"].lower(),
                hook_formulas=hook_formulas_text,
                dm_funnels=dm_funnels_text,
            )

            system = (
                "You are a viral content strategist who specializes in finance and tech "
                "short-form content. You understand hooks, retention, and the algorithm. "
                "Output only valid JSON."
            )

            result = await self.llm.generate(prompt, system=system, complexity="low")

            # Clean markdown wrapping
            if "```json" in result:
                result = result.split("```json")[1].split("```")[0].strip()
            elif "```" in result:
                result = result.split("```")[1].split("```")[0].strip()

            try:
                script_data = json.loads(result)
            except json.JSONDecodeError:
                self.current_task = None
                return self.emit("skipped", f"Invalid JSON from LLM for {topic[:40]}")

            # Save script
            out_dir = ensure_output_dir("content-scripts")
            filename = f"{niche['id']}-{platform}-{self.tasks_completed:04d}.json"
            filepath = out_dir / filename

            script_data["niche"] = niche["id"]
            script_data["niche_name"] = niche["name"]
            script_data["platform"] = platform
            script_data["topic"] = topic
            filepath.write_text(json.dumps(script_data, indent=2), encoding="utf-8")

            # Track in content pipeline
            if self.pipeline_db:
                try:
                    await asyncio.to_thread(
                        self.pipeline_db.add_item,
                        "content", f"{topic[:60]}",
                        subtitle=f"{platform} / {niche['name']}",
                        stage="created", score=random.randint(50, 85),
                        metadata={"script_file": filename, "platform": platform,
                                  "niche": niche["id"], "topic": topic},
                        source_agent=self.agent_id,
                    )
                except Exception:
                    pass

            self.tasks_completed += 1
            self.current_task = None

            # Advance rotation
            self.topic_index += 1
            if self.topic_index % len(niche["topics"]) == 0:
                self.niche_index += 1

            return self.emit(
                "completed",
                f"Script saved: {topic[:50]}... ({platform}) → {filename}"
            )

        except Exception as e:
            self.current_task = None
            return self.emit("error", f"Script gen failed: {e}")

    def get_tools(self) -> list[dict]:
        return []
