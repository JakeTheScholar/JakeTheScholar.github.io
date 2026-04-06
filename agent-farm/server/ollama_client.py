"""HTTP client for Ollama local LLM inference."""

import httpx


class OllamaClient:
    def __init__(self, base_url: str = "http://localhost:11434"):
        self.base_url = base_url.rstrip("/")
        self.client = httpx.AsyncClient(
            timeout=120.0,
            follow_redirects=False,
            limits=httpx.Limits(max_connections=10, max_keepalive_connections=5),
        )

    async def health(self) -> bool:
        try:
            r = await self.client.get(f"{self.base_url}/api/tags")
            return r.status_code == 200
        except Exception:
            return False

    async def list_models(self) -> list[str]:
        try:
            r = await self.client.get(f"{self.base_url}/api/tags")
            r.raise_for_status()
            return [m["name"] for m in r.json().get("models", [])]
        except Exception:
            return []

    async def generate(self, model: str, prompt: str, system: str = None) -> str:
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False,
        }
        if system:
            payload["system"] = system

        r = await self.client.post(
            f"{self.base_url}/api/generate",
            json=payload,
            timeout=180.0,
        )
        r.raise_for_status()
        return r.json().get("response", "")

    async def chat(self, model: str, messages: list[dict], system: str = None) -> str:
        payload = {
            "model": model,
            "messages": messages,
            "stream": False,
        }
        if system:
            payload["messages"] = [{"role": "system", "content": system}] + payload["messages"]

        r = await self.client.post(
            f"{self.base_url}/api/chat",
            json=payload,
            timeout=180.0,
        )
        r.raise_for_status()
        return r.json().get("message", {}).get("content", "")

    async def close(self):
        await self.client.aclose()
