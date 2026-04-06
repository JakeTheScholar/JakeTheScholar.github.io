"""JSON file persistence for agent states and task queues."""

import json
import uuid
from pathlib import Path
from datetime import datetime


class State:
    def __init__(self, data_dir: Path = None):
        self.data_dir = data_dir or Path(__file__).parent / "data"
        self.data_dir.mkdir(exist_ok=True)

    def _load(self, filename: str) -> dict:
        path = self.data_dir / filename
        if path.exists():
            return json.loads(path.read_text())
        return {}

    def _save(self, filename: str, data: dict) -> None:
        path = self.data_dir / filename
        path.write_text(json.dumps(data, indent=2, default=str))

    # --- Agent States ---

    def load_agent_states(self) -> dict:
        return self._load("agent_states.json")

    def load_agent_state(self, agent_id: str) -> dict:
        states = self.load_agent_states()
        return states.get(agent_id, {})

    def save_agent_state(self, agent_id: str, state: dict) -> None:
        states = self.load_agent_states()
        states[agent_id] = state
        self._save("agent_states.json", states)

    # --- Task Queue ---

    def get_task_queue(self, agent_id: str = None) -> list[dict]:
        data = self._load("task_queue.json")
        tasks = data.get("tasks", [])
        if agent_id:
            tasks = [t for t in tasks if t.get("agent_id") == agent_id]
        return [t for t in tasks if t.get("status") != "completed"]

    def add_task(self, agent_id: str, description: str, task_type: str = "auto") -> dict:
        data = self._load("task_queue.json")
        tasks = data.get("tasks", [])
        task = {
            "id": f"t-{uuid.uuid4().hex[:8]}",
            "agent_id": agent_id,
            "type": task_type,
            "description": description,
            "status": "pending",
            "created_at": datetime.now().isoformat(),
        }
        tasks.append(task)
        data["tasks"] = tasks
        self._save("task_queue.json", data)
        return task

    def complete_task(self, task_id: str) -> None:
        data = self._load("task_queue.json")
        tasks = data.get("tasks", [])
        for t in tasks:
            if t["id"] == task_id:
                t["status"] = "completed"
                t["completed_at"] = datetime.now().isoformat()
                break
        data["tasks"] = tasks
        self._save("task_queue.json", data)

    # --- Farm Config ---

    def load_config(self) -> dict:
        config = self._load("farm_config.json")
        if not config:
            config = {
                "ollama_host": "http://localhost:11434",
                "ollama_model": "llama3.2",
                "anthropic_fallback": True,
                "agents": {},
            }
            self._save("farm_config.json", config)
        return config

    def save_config(self, config: dict) -> None:
        self._save("farm_config.json", config)
