"""Agent lifecycle manager — starts/stops agents, runs tick loops, broadcasts events."""

import asyncio
import logging
from collections import deque
from datetime import datetime
from fastapi import WebSocket
from agent_base import BaseAgent, AgentEvent
from state import State
from llm_router import LLMRouter

log = logging.getLogger("orchestrator")


class Orchestrator:
    def __init__(self, llm: LLMRouter, state: State, pipeline_db=None):
        self.agents: dict[str, BaseAgent] = {}
        self.tasks: dict[str, asyncio.Task] = {}
        self.ws_clients: list[WebSocket] = []
        self.llm = llm
        self.state = state
        self.pipeline_db = pipeline_db
        self.event_history: deque[dict] = deque(maxlen=500)

    def register_agent(self, agent: BaseAgent) -> None:
        agent.llm = self.llm
        # Inject pipeline_db into agents that need it
        if self.pipeline_db and hasattr(agent, "pipeline_db"):
            agent.pipeline_db = self.pipeline_db
        self.agents[agent.agent_id] = agent
        # Restore persisted state
        saved = self.state.load_agent_state(agent.agent_id)
        if saved:
            agent.tasks_completed = saved.get("tasks_completed", 0)
        log.info(f"Registered agent: {agent.name} ({agent.agent_id})")

    async def start_agent(self, agent_id: str) -> AgentEvent:
        agent = self.agents.get(agent_id)
        if not agent:
            raise ValueError(f"Unknown agent: {agent_id}")
        if agent.status == "running":
            return agent.emit("already_running", "Agent is already running")

        agent.status = "running"
        self.tasks[agent_id] = asyncio.create_task(self._agent_loop(agent_id))
        event = agent.emit("started", f"{agent.name} is now running")
        await self.broadcast(event)
        return event

    async def stop_agent(self, agent_id: str) -> AgentEvent:
        agent = self.agents.get(agent_id)
        if not agent:
            raise ValueError(f"Unknown agent: {agent_id}")

        agent.status = "idle"
        task = self.tasks.pop(agent_id, None)
        if task:
            task.cancel()
        self.state.save_agent_state(agent_id, agent.get_state())
        event = agent.emit("stopped", f"{agent.name} has been stopped")
        await self.broadcast(event)
        return event

    async def pause_agent(self, agent_id: str) -> AgentEvent:
        agent = self.agents.get(agent_id)
        if not agent:
            raise ValueError(f"Unknown agent: {agent_id}")

        if agent.status == "running":
            agent.status = "paused"
            task = self.tasks.pop(agent_id, None)
            if task:
                task.cancel()
            event = agent.emit("paused", f"{agent.name} has been paused")
        elif agent.status == "paused":
            # Resume
            agent.status = "running"
            self.tasks[agent_id] = asyncio.create_task(self._agent_loop(agent_id))
            event = agent.emit("resumed", f"{agent.name} has been resumed")
        else:
            event = agent.emit("no_change", f"Agent is {agent.status}, cannot pause")

        await self.broadcast(event)
        return event

    async def _agent_loop(self, agent_id: str) -> None:
        agent = self.agents[agent_id]
        log.info(f"Starting tick loop for {agent.name}")

        while agent.status == "running":
            try:
                event = await agent.tick()
                await self.broadcast(event)
                self.state.save_agent_state(agent_id, agent.get_state())
                await asyncio.sleep(agent.tick_interval)
            except asyncio.CancelledError:
                log.info(f"Tick loop cancelled for {agent.name}")
                break
            except Exception as e:
                log.error(f"Agent {agent.name} error: {e}", exc_info=True)
                agent.status = "error"
                error_event = agent.emit("error", str(e))
                await self.broadcast(error_event)
                self.state.save_agent_state(agent_id, agent.get_state())
                break

    async def broadcast(self, event: AgentEvent) -> None:
        msg = event.to_dict()
        self.event_history.append(msg)

        dead = []
        for ws in self.ws_clients:
            try:
                await ws.send_json(msg)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.ws_clients.remove(ws)

    def get_status(self) -> dict:
        return {
            "agents": {aid: a.get_info() for aid, a in self.agents.items()},
            "active_count": sum(1 for a in self.agents.values() if a.status == "running"),
            "total_tasks_completed": sum(a.tasks_completed for a in self.agents.values()),
            "ws_clients": len(self.ws_clients),
            "timestamp": datetime.now().isoformat(),
        }

    def get_recent_events(self, limit: int = 50) -> list[dict]:
        items = list(self.event_history)
        return items[-limit:]
