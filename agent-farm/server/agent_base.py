"""Base agent class with tick loop, status reporting, and event emission."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Optional


@dataclass
class AgentEvent:
    agent_id: str
    timestamp: str
    action: str
    detail: str
    status: str
    tasks_completed: int = 0
    current_task: Optional[dict] = None

    def to_dict(self) -> dict:
        return {
            "type": "agent_event",
            "agent_id": self.agent_id,
            "timestamp": self.timestamp,
            "data": {
                "action": self.action,
                "detail": self.detail,
                "status": self.status,
                "tasks_completed": self.tasks_completed,
                "current_task": self.current_task,
            },
        }


class BaseAgent(ABC):
    def __init__(self, agent_id: str, name: str, description: str, color: str):
        self.agent_id = agent_id
        self.name = name
        self.description = description
        self.color = color
        self.status = "idle"  # idle | running | paused | error
        self.tasks_completed = 0
        self.current_task = None
        self.activity_log: list[AgentEvent] = []
        self.tick_interval = 30  # seconds between ticks
        self.llm = None  # LLMRouter, set by orchestrator

    @abstractmethod
    async def tick(self) -> AgentEvent:
        """Execute one unit of work. Returns an event."""
        pass

    @abstractmethod
    def get_tools(self) -> list[dict]:
        """Return tool schemas this agent can use."""
        pass

    def get_state(self) -> dict:
        return {
            "agent_id": self.agent_id,
            "name": self.name,
            "description": self.description,
            "color": self.color,
            "status": self.status,
            "tasks_completed": self.tasks_completed,
            "current_task": self.current_task,
            "tick_interval": self.tick_interval,
            "last_tick": datetime.now().isoformat(),
            "recent_log": [e.to_dict() for e in self.activity_log[-10:]],
        }

    def get_info(self) -> dict:
        return {
            "agent_id": self.agent_id,
            "name": self.name,
            "description": self.description,
            "color": self.color,
            "status": self.status,
            "tasks_completed": self.tasks_completed,
            "current_task": self.current_task,
            "tick_interval": self.tick_interval,
        }

    def emit(self, action: str, detail: str) -> AgentEvent:
        event = AgentEvent(
            agent_id=self.agent_id,
            timestamp=datetime.now().isoformat(),
            action=action,
            detail=detail,
            status=self.status,
            tasks_completed=self.tasks_completed,
            current_task=self.current_task,
        )
        self.activity_log.append(event)
        if len(self.activity_log) > 50:
            self.activity_log = self.activity_log[-50:]
        return event
