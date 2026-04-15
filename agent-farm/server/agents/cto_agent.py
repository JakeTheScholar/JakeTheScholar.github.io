"""CTO Agent — chief technology officer, monitors LLM infrastructure health,
API availability, agent tech stack, and automation efficiency.

Runs every 170 seconds.
"""

import sys
import asyncio
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from agent_base import BaseAgent, AgentEvent


class CTOAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            agent_id="cto-001",
            name="CTO",
            description="Technology oversight — LLM health, API status, automation efficiency",
            color="#448aff",
        )
        self.tick_interval = 170
        self.orchestrator = None
        self.pipeline_db = None

    async def tick(self) -> AgentEvent:
        self.current_task = {
            "type": "tech_report",
            "description": "Checking infrastructure health",
        }

        self.emit("scanning", "Auditing LLM, APIs, and agent infrastructure")

        parts = []

        # Check Ollama / LLM health
        if self.llm:
            ollama = getattr(self.llm, "ollama", None)
            if ollama:
                try:
                    healthy = await ollama.health()
                    if healthy:
                        models = await ollama.list_models()
                        model_name = getattr(self.llm, "model", "unknown")
                        parts.append(f"Ollama: online, model={model_name}, {len(models)} models available")
                    else:
                        parts.append("Ollama: OFFLINE")
                except Exception:
                    parts.append("Ollama: health check failed")

            # Claude fallback status
            claude_available = getattr(self.llm, "anthropic", None) is not None
            parts.append(f"Claude fallback: {'ready' if claude_available else 'not configured'}")

        # Agent infrastructure stats
        if self.orchestrator:
            agents = self.orchestrator.agents
            total = len(agents)
            ws_clients = len(self.orchestrator.ws_clients)
            event_count = len(self.orchestrator.events)
            parts.append(f"Agents: {total} registered, {ws_clients} WS clients, {event_count} events buffered")

            # Check for agents with high error rates
            error_agents = [
                a.name for a in agents.values()
                if a.status == "error" and a.agent_id != self.agent_id
            ]
            if error_agents:
                parts.append(f"Errors: {', '.join(error_agents)}")

        # Disk usage for output
        try:
            output_dir = Path(__file__).parent.parent / "output"
            if output_dir.exists():
                file_count = sum(1 for _ in output_dir.rglob("*") if _.is_file())
                parts.append(f"Output: {file_count} files generated")
        except Exception:
            pass

        if not parts:
            parts.append("Tech systems initializing")

        self.tasks_completed += 1
        self.current_task = None
        return self.emit("tech_report", " | ".join(parts))

    def get_tools(self) -> list[dict]:
        return []
