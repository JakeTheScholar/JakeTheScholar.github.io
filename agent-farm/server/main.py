"""Agent Farm — FastAPI server with REST + WebSocket endpoints."""

import os
import re
import secrets
import logging
import time
import asyncio
from pathlib import Path
from collections import defaultdict
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, Query, Request
from fastapi.exceptions import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, field_validator

load_dotenv()

from ollama_client import OllamaClient
from llm_router import LLMRouter
from state import State
from orchestrator import Orchestrator
from agents.printables_agent import PrintablesAgent
from agents.etsy_lister import EtsyListerAgent
from agents.social_agent import SocialAgent
from agents.fiverr_agent import FiverrAgent
from agents.thumbnail_agent import ThumbnailAgent
from agents.research_agent import ResearchAgent
from agents.analytics_agent import AnalyticsAgent
from agents.seo_agent import SEOAgent
from agents.scheduler_agent import SchedulerAgent
from agents.lead_scraper import LeadScraperAgent
from agents.outreach_agent import OutreachAgent
from agents.pipeline_manager import PipelineManagerAgent
from agents.web_dev_agent import WebDevAgent
from agents.music_agent import MusicAgent
from agents.follow_up_agent import FollowUpAgent
from agents.ad_copy_agent import AdCopyAgent
from agents.review_agent import ReviewAgent
from agents.image_gen_agent import ImageGenAgent
from agents.faceless_content_agent import FacelessContentAgent
from agents.freelance_scraper_agent import FreelanceScraperAgent
from agents.gumroad_agent import GumroadAgent
from agents.video_producer_agent import VideoProducerAgent
from agents.manager_agent import ManagerAgent
from agents.ceo_agent import CEOAgent
from agents.cfo_agent import CFOAgent
from agents.coo_agent import COOAgent
from agents.cmo_agent import CMOAgent
from agents.cto_agent import CTOAgent
from agents.cco_agent import CCOAgent
from pipeline_db import PipelineDB, PIPELINE_CONFIGS

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(message)s")
log = logging.getLogger("agent-farm")

# ─── API Key Auth ───
# Generate a key on first run, or use from env
API_KEY = os.getenv("AGENT_FARM_API_KEY") or secrets.token_urlsafe(32)
if not os.getenv("AGENT_FARM_API_KEY"):
    log.info(f"Generated API key (add to .env to persist): {API_KEY[:8]}...")

ALLOWED_OLLAMA_HOSTS = ["http://localhost:11434", "http://127.0.0.1:11434"]
ALLOWED_MODELS = re.compile(r"^[a-zA-Z0-9._:-]{1,64}$")
MAX_WS_CLIENTS = 20
WS_RATE_LIMIT = 10  # max commands per second per connection

# ─── Globals ───
state = State()
config = state.load_config()
ollama = OllamaClient(config.get("ollama_host", "http://localhost:11434"))
llm = LLMRouter(ollama, model=config.get("ollama_model", "llama3.2"))
pipeline_db = PipelineDB()
orchestrator = Orchestrator(llm, state, pipeline_db=pipeline_db)

# Register Content agents (9)
orchestrator.register_agent(PrintablesAgent())
orchestrator.register_agent(EtsyListerAgent())
orchestrator.register_agent(SocialAgent())
orchestrator.register_agent(FiverrAgent())
orchestrator.register_agent(ThumbnailAgent())
orchestrator.register_agent(ResearchAgent())
orchestrator.register_agent(AnalyticsAgent())
orchestrator.register_agent(SEOAgent())
orchestrator.register_agent(SchedulerAgent())

# Register Lead Gen agents (4)
orchestrator.register_agent(LeadScraperAgent())
orchestrator.register_agent(OutreachAgent())
orchestrator.register_agent(FollowUpAgent())
orchestrator.register_agent(PipelineManagerAgent())

# Register Growth agents (4)
orchestrator.register_agent(WebDevAgent())
orchestrator.register_agent(MusicAgent())
orchestrator.register_agent(AdCopyAgent())
orchestrator.register_agent(ReviewAgent())

# Register Revenue agents (5)
orchestrator.register_agent(ImageGenAgent())
orchestrator.register_agent(FacelessContentAgent())
orchestrator.register_agent(FreelanceScraperAgent())
orchestrator.register_agent(GumroadAgent())
orchestrator.register_agent(VideoProducerAgent())

# Register Operations agents (1)
_manager = ManagerAgent()
orchestrator.register_agent(_manager)
_manager.orchestrator = orchestrator  # Give manager access to orchestrator

# Register Executive agents (6)
_ceo = CEOAgent()
orchestrator.register_agent(_ceo)
_ceo.orchestrator = orchestrator

_cfo = CFOAgent()
orchestrator.register_agent(_cfo)

_coo = COOAgent()
orchestrator.register_agent(_coo)
_coo.orchestrator = orchestrator

_cmo = CMOAgent()
orchestrator.register_agent(_cmo)
_cmo.orchestrator = orchestrator

_cto = CTOAgent()
orchestrator.register_agent(_cto)
_cto.orchestrator = orchestrator

_cco = CCOAgent()
orchestrator.register_agent(_cco)
_cco.orchestrator = orchestrator

VALID_AGENT_IDS = set(orchestrator.agents.keys())


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("Agent Farm starting up...")
    ollama_ok = await ollama.health()
    log.info(f"Ollama: {'connected' if ollama_ok else 'not available'}")
    if ollama_ok:
        models = await ollama.list_models()
        log.info(f"Ollama models available: {len(models)}")
    yield
    for agent_id in list(orchestrator.tasks.keys()):
        await orchestrator.stop_agent(agent_id)
    pipeline_db.close()
    await ollama.close()
    log.info("Agent Farm shut down.")


app = FastAPI(title="Agent Farm", lifespan=lifespan, docs_url=None, redoc_url=None)

# ─── CORS — restrict to same origin + ngrok tunnels ───
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:8000,http://127.0.0.1:8000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://[a-z0-9-]+\.(ngrok-free\.(app|dev)|trycloudflare\.com)",
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)


# ─── Security Headers Middleware ───
@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["X-Permitted-Cross-Domain-Policies"] = "none"
    return response


# ─── Rate Limiting (simple in-memory with cleanup) ───
_rate_limits: dict[str, list[float]] = defaultdict(list)
_rate_limit_calls = 0
_RATE_LIMIT_MAX_IPS = 10000


def _check_rate_limit(client_ip: str, max_per_minute: int = 60) -> bool:
    global _rate_limit_calls
    now = time.time()
    window = [t for t in _rate_limits[client_ip] if now - t < 60]
    _rate_limits[client_ip] = window
    if len(window) >= max_per_minute:
        return False
    _rate_limits[client_ip].append(now)

    # Periodic cleanup: every 200 requests, purge stale IPs
    _rate_limit_calls += 1
    if _rate_limit_calls >= 200:
        _rate_limit_calls = 0
        stale = [ip for ip, ts in _rate_limits.items() if not ts or now - ts[-1] > 120]
        for ip in stale:
            del _rate_limits[ip]
        # Hard cap: if still too many IPs, drop the oldest half
        if len(_rate_limits) > _RATE_LIMIT_MAX_IPS:
            sorted_ips = sorted(_rate_limits, key=lambda ip: _rate_limits[ip][-1] if _rate_limits[ip] else 0)
            for ip in sorted_ips[:len(sorted_ips) // 2]:
                del _rate_limits[ip]

    return True


# ─── Auth Dependency ───
async def verify_api_key(request: Request):
    # Allow unauthenticated access to dashboard static files
    auth = request.headers.get("Authorization", "")
    token = request.query_params.get("token", "")
    key = auth.replace("Bearer ", "") if auth.startswith("Bearer ") else token
    if key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")
    if not _check_rate_limit(request.client.host if request.client else "unknown"):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")


# ─── Config Schema ───
class ConfigUpdate(BaseModel):
    ollama_host: Optional[str] = None
    ollama_model: Optional[str] = None
    anthropic_fallback: Optional[bool] = None

    @field_validator("ollama_host")
    @classmethod
    def validate_host(cls, v):
        if v and v not in ALLOWED_OLLAMA_HOSTS:
            raise ValueError(f"ollama_host must be one of: {ALLOWED_OLLAMA_HOSTS}")
        return v

    @field_validator("ollama_model")
    @classmethod
    def validate_model(cls, v):
        if v and not ALLOWED_MODELS.match(v):
            raise ValueError("Invalid model name")
        return v


# ─── Serve Dashboard (no auth needed) ───
dashboard_dir = Path(__file__).parent.parent
if (dashboard_dir / "index.html").exists():
    app.mount("/js", StaticFiles(directory=str(dashboard_dir / "js")), name="js")


@app.get("/")
async def serve_dashboard():
    index = dashboard_dir / "index.html"
    if index.exists():
        return FileResponse(str(index))
    return {"message": "Agent Farm API", "status": "running"}


# ─── REST Endpoints (authenticated) ───

@app.get("/api/status", dependencies=[Depends(verify_api_key)])
async def get_status():
    llm_status = await llm.get_status()
    return {**orchestrator.get_status(), "llm": llm_status}


@app.get("/api/agents", dependencies=[Depends(verify_api_key)])
async def list_agents():
    return {aid: a.get_info() for aid, a in orchestrator.agents.items()}


@app.get("/api/agents/{agent_id}", dependencies=[Depends(verify_api_key)])
async def get_agent(agent_id: str):
    if agent_id not in VALID_AGENT_IDS:
        raise HTTPException(status_code=404, detail="Agent not found")
    return orchestrator.agents[agent_id].get_state()


@app.post("/api/agents/{agent_id}/start", dependencies=[Depends(verify_api_key)])
async def start_agent(agent_id: str):
    if agent_id not in VALID_AGENT_IDS:
        raise HTTPException(status_code=404, detail="Agent not found")
    try:
        event = await orchestrator.start_agent(agent_id)
        return event.to_dict()
    except ValueError:
        raise HTTPException(status_code=400, detail="Cannot start agent")


@app.post("/api/agents/{agent_id}/stop", dependencies=[Depends(verify_api_key)])
async def stop_agent(agent_id: str):
    if agent_id not in VALID_AGENT_IDS:
        raise HTTPException(status_code=404, detail="Agent not found")
    try:
        event = await orchestrator.stop_agent(agent_id)
        return event.to_dict()
    except ValueError:
        raise HTTPException(status_code=400, detail="Cannot stop agent")


@app.post("/api/agents/{agent_id}/pause", dependencies=[Depends(verify_api_key)])
async def pause_agent(agent_id: str):
    if agent_id not in VALID_AGENT_IDS:
        raise HTTPException(status_code=404, detail="Agent not found")
    try:
        event = await orchestrator.pause_agent(agent_id)
        return event.to_dict()
    except ValueError:
        raise HTTPException(status_code=400, detail="Cannot pause agent")


@app.get("/api/events", dependencies=[Depends(verify_api_key)])
async def get_events(limit: int = Query(default=50, ge=1, le=500)):
    return orchestrator.get_recent_events(limit)


@app.get("/api/config", dependencies=[Depends(verify_api_key)])
async def get_config():
    cfg = state.load_config()
    # Strip sensitive fields
    safe = {k: v for k, v in cfg.items() if k not in ("anthropic_api_key",)}
    return safe


@app.post("/api/config", dependencies=[Depends(verify_api_key)])
async def update_config(update: ConfigUpdate):
    current = state.load_config()
    changes = update.model_dump(exclude_none=True)
    current.update(changes)
    state.save_config(current)
    # Update runtime
    if "ollama_host" in changes:
        ollama.base_url = changes["ollama_host"].rstrip("/")
    if "ollama_model" in changes:
        llm.model = changes["ollama_model"]
    return {"status": "updated", "fields": list(changes.keys())}


@app.get("/api/ollama/status", dependencies=[Depends(verify_api_key)])
async def ollama_status():
    return await llm.get_status()


# ─── Pipeline Endpoints (authenticated) ───

class ManualLead(BaseModel):
    business_name: str
    industry: str
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    website: Optional[str] = None
    location: Optional[str] = None
    needs: Optional[str] = None
    score: int = 50

    @field_validator("business_name", "industry")
    @classmethod
    def not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError("Field cannot be empty")
        return v.strip()

    @field_validator("score")
    @classmethod
    def valid_score(cls, v):
        if not 0 <= v <= 100:
            raise ValueError("Score must be 0-100")
        return v


@app.get("/api/pipeline/stats", dependencies=[Depends(verify_api_key)])
async def pipeline_stats():
    stats = await asyncio.to_thread(pipeline_db.get_pipeline_stats)
    return stats


@app.get("/api/pipeline/leads", dependencies=[Depends(verify_api_key)])
async def pipeline_leads(
    stage: Optional[str] = None,
    industry: Optional[str] = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    leads = await asyncio.to_thread(pipeline_db.get_leads, stage, industry, limit, offset)
    return leads


@app.post("/api/pipeline/leads", dependencies=[Depends(verify_api_key)])
async def add_pipeline_lead(lead: ManualLead):
    result = await asyncio.to_thread(pipeline_db.add_lead, lead.model_dump(), "manual")
    return result


@app.get("/api/pipeline/stages", dependencies=[Depends(verify_api_key)])
async def pipeline_stages():
    stages = await asyncio.to_thread(pipeline_db.get_stage_counts)
    return stages


# ─── Multi-Pipeline Endpoints ───

@app.get("/api/pipeline/types", dependencies=[Depends(verify_api_key)])
async def pipeline_types():
    return {k: {"label": v["label"], "color": v["color"], "stages": v["stages"],
                "stage_labels": v["stage_labels"]}
            for k, v in PIPELINE_CONFIGS.items()}


@app.get("/api/pipeline/all-stats", dependencies=[Depends(verify_api_key)])
async def all_pipeline_stats():
    return await asyncio.to_thread(pipeline_db.get_all_pipeline_stats)


@app.get("/api/pipeline/items", dependencies=[Depends(verify_api_key)])
async def pipeline_items(
    pipeline_type: Optional[str] = None,
    stage: Optional[str] = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    items = await asyncio.to_thread(pipeline_db.get_items, pipeline_type, stage, limit, offset)
    return items


@app.get("/api/pipeline/items/stages", dependencies=[Depends(verify_api_key)])
async def pipeline_item_stages(pipeline_type: str):
    if pipeline_type not in PIPELINE_CONFIGS:
        raise HTTPException(status_code=400, detail="Invalid pipeline type")
    stages = await asyncio.to_thread(pipeline_db.get_item_stage_counts, pipeline_type)
    return stages


# ─── Performance Metrics Endpoints ───

@app.get("/api/pipeline/metrics", dependencies=[Depends(verify_api_key)])
async def pipeline_metrics():
    return await asyncio.to_thread(pipeline_db.get_comprehensive_metrics)


@app.get("/api/pipeline/metrics/time-to-stage", dependencies=[Depends(verify_api_key)])
async def metrics_time_to_stage(pipeline_type: str = "leadgen"):
    return await asyncio.to_thread(pipeline_db.get_time_to_stage_stats, pipeline_type)


@app.get("/api/pipeline/metrics/agent-velocity", dependencies=[Depends(verify_api_key)])
async def metrics_agent_velocity(days: int = Query(default=7, ge=1, le=90)):
    return await asyncio.to_thread(pipeline_db.get_agent_velocity, days)


@app.get("/api/pipeline/metrics/agent-contributions/{agent_id}", dependencies=[Depends(verify_api_key)])
async def metrics_agent_contributions(agent_id: str):
    if agent_id not in VALID_AGENT_IDS:
        raise HTTPException(status_code=404, detail="Agent not found")
    return await asyncio.to_thread(pipeline_db.get_agent_stage_contributions, agent_id)


@app.get("/api/pipeline/metrics/score-distribution", dependencies=[Depends(verify_api_key)])
async def metrics_score_distribution(pipeline_type: Optional[str] = None):
    return await asyncio.to_thread(pipeline_db.get_score_distribution, pipeline_type)


@app.get("/api/pipeline/metrics/score-by-stage", dependencies=[Depends(verify_api_key)])
async def metrics_score_by_stage(pipeline_type: str = "leadgen"):
    return await asyncio.to_thread(pipeline_db.get_score_by_stage, pipeline_type)


@app.get("/api/pipeline/metrics/score-by-industry", dependencies=[Depends(verify_api_key)])
async def metrics_score_by_industry():
    return await asyncio.to_thread(pipeline_db.get_score_by_industry)


@app.get("/api/pipeline/metrics/outreach", dependencies=[Depends(verify_api_key)])
async def metrics_outreach():
    return await asyncio.to_thread(pipeline_db.get_outreach_stats)


@app.get("/api/pipeline/metrics/lead-quality", dependencies=[Depends(verify_api_key)])
async def metrics_lead_quality():
    return await asyncio.to_thread(pipeline_db.get_lead_quality_cohorts)


@app.get("/api/pipeline/metrics/industry", dependencies=[Depends(verify_api_key)])
async def metrics_industry():
    return await asyncio.to_thread(pipeline_db.get_industry_performance)


@app.get("/api/pipeline/metrics/funnel", dependencies=[Depends(verify_api_key)])
async def metrics_funnel(pipeline_type: str = "leadgen"):
    return await asyncio.to_thread(pipeline_db.get_funnel_conversion, pipeline_type)


@app.get("/api/pipeline/metrics/source-agents", dependencies=[Depends(verify_api_key)])
async def metrics_source_agents(pipeline_type: Optional[str] = None):
    return await asyncio.to_thread(pipeline_db.get_source_agent_performance, pipeline_type)


@app.get("/api/pipeline/metrics/creation-trend", dependencies=[Depends(verify_api_key)])
async def metrics_creation_trend(
    pipeline_type: str = "leadgen",
    period: str = Query(default="day", pattern="^(day|week)$"),
    days: int = Query(default=30, ge=1, le=365),
):
    return await asyncio.to_thread(pipeline_db.get_creation_trend, pipeline_type, period, days)


@app.get("/api/pipeline/metrics/transition-trend", dependencies=[Depends(verify_api_key)])
async def metrics_transition_trend(
    pipeline_type: str = "leadgen",
    days: int = Query(default=30, ge=1, le=365),
):
    return await asyncio.to_thread(pipeline_db.get_transition_trend, pipeline_type, days)


@app.get("/api/pipeline/metrics/outreach-roi", dependencies=[Depends(verify_api_key)])
async def metrics_outreach_roi():
    return await asyncio.to_thread(pipeline_db.get_outreach_roi)


@app.get("/api/pipeline/metrics/campaigns", dependencies=[Depends(verify_api_key)])
async def metrics_campaigns():
    return await asyncio.to_thread(pipeline_db.get_campaign_stats)


@app.get("/api/pipeline/leads/{lead_id}/lifecycle", dependencies=[Depends(verify_api_key)])
async def lead_lifecycle(lead_id: str):
    result = await asyncio.to_thread(pipeline_db.get_lead_lifecycle, lead_id)
    if not result:
        raise HTTPException(status_code=404, detail="Lead not found or has no transitions")
    return result


# ─── Orders API ───

VALID_ORDER_TYPES = {
    "thumbnail", "ad_copy", "template", "social_content",
    "seo_report", "fiverr_gig", "music", "website_mockup",
}

# Maps order types to the agent that should handle them
ORDER_AGENT_MAP = {
    "thumbnail": "image-gen-001",
    "ad_copy": "ad-copy-001",
    "template": "printables-001",
    "social_content": "social-001",
    "seo_report": "seo-001",
    "fiverr_gig": "fiverr-001",
    "music": "music-001",
    "website_mockup": "web-dev-001",
}


class NewOrder(BaseModel):
    order_type: str
    client_brief: str
    client_name: Optional[str] = None
    platform: str = "fiverr"
    package: str = "basic"
    price: float = 0
    notes: Optional[str] = None

    @field_validator("order_type")
    @classmethod
    def valid_type(cls, v):
        if v not in VALID_ORDER_TYPES:
            raise ValueError(f"order_type must be one of: {', '.join(sorted(VALID_ORDER_TYPES))}")
        return v

    @field_validator("client_brief")
    @classmethod
    def brief_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError("client_brief cannot be empty")
        return v.strip()


@app.get("/api/orders", dependencies=[Depends(verify_api_key)])
async def list_orders(status: Optional[str] = None, limit: int = 50):
    orders = await asyncio.to_thread(pipeline_db.get_orders, status, min(limit, 100))
    return orders


@app.get("/api/orders/stats", dependencies=[Depends(verify_api_key)])
async def order_stats():
    return await asyncio.to_thread(pipeline_db.get_order_stats)


@app.get("/api/orders/{order_id}", dependencies=[Depends(verify_api_key)])
async def get_order(order_id: str):
    order = await asyncio.to_thread(pipeline_db.get_order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@app.post("/api/orders", dependencies=[Depends(verify_api_key)])
async def create_order(order: NewOrder):
    result = await asyncio.to_thread(
        pipeline_db.add_order,
        order_type=order.order_type,
        client_brief=order.client_brief,
        client_name=order.client_name,
        platform=order.platform,
        package=order.package,
        price=order.price,
        notes=order.notes,
    )
    # Auto-assign to the right agent
    agent_id = ORDER_AGENT_MAP.get(order.order_type)
    if agent_id:
        await asyncio.to_thread(
            pipeline_db.update_order, result["id"],
            assigned_agent=agent_id, status="assigned",
        )
        result["assigned_agent"] = agent_id
        result["status"] = "assigned"
    return result


@app.post("/api/orders/{order_id}/status", dependencies=[Depends(verify_api_key)])
async def update_order_status(order_id: str, status: str = Query(...)):
    valid = {"pending", "assigned", "in_progress", "review", "completed", "delivered", "cancelled"}
    if status not in valid:
        raise HTTPException(400, f"status must be one of: {', '.join(sorted(valid))}")
    kwargs = {"status": status}
    if status == "delivered":
        kwargs["delivered_at"] = datetime.now().isoformat()
    ok = await asyncio.to_thread(pipeline_db.update_order, order_id, **kwargs)
    if not ok:
        raise HTTPException(404, "Order not found")
    return {"ok": True, "status": status}


@app.get("/api/orders/types", dependencies=[Depends(verify_api_key)])
async def order_types():
    return {
        "types": {
            "thumbnail": {"label": "YouTube Thumbnail", "agent": "image-gen-001", "price_range": "$10-30"},
            "ad_copy": {"label": "Ad Copy Package", "agent": "ad-copy-001", "price_range": "$25-50"},
            "template": {"label": "Financial Template", "agent": "printables-001", "price_range": "$15-40"},
            "social_content": {"label": "Social Media Pack", "agent": "social-001", "price_range": "$30-75"},
            "seo_report": {"label": "SEO Keyword Report", "agent": "seo-001", "price_range": "$20-50"},
            "fiverr_gig": {"label": "Fiverr Gig Listing", "agent": "fiverr-001", "price_range": "$10-25"},
            "music": {"label": "Audio/Music Pack", "agent": "music-001", "price_range": "$15-50"},
            "website_mockup": {"label": "Website Mockup", "agent": "web-dev-001", "price_range": "$25-75"},
        }
    }


# ─── Exports API ───

@app.get("/api/exports/outputs", dependencies=[Depends(verify_api_key)])
async def list_all_outputs():
    """List all generated output files across all subdirectories."""
    from tools.file_tools import OUTPUT_DIR
    result = {}
    if OUTPUT_DIR.exists():
        for subdir in sorted(OUTPUT_DIR.iterdir()):
            if subdir.is_dir():
                files = []
                for f in sorted(subdir.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True):
                    if f.is_file() and not f.name.startswith("."):
                        files.append({
                            "filename": f.name,
                            "size_bytes": f.stat().st_size,
                            "modified": datetime.fromtimestamp(f.stat().st_mtime).isoformat(),
                        })
                if files:
                    result[subdir.name] = {"count": len(files), "files": files[:20]}
    return result


@app.get("/api/exports/outputs/{subdir}", dependencies=[Depends(verify_api_key)])
async def list_subdir_outputs(subdir: str, limit: int = 50):
    from tools.file_tools import list_outputs
    return await asyncio.to_thread(list_outputs, subdir)


# ─── Global Exception Handler ───
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    log.error(f"Unhandled exception on {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(status_code=500, content={"error": "Internal server error"})


# ─── WebSocket (token auth via query param) ───

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    # Auth check
    token = ws.query_params.get("token", "")
    if token != API_KEY:
        await ws.close(code=4001, reason="Unauthorized")
        return

    # Connection limit
    if len(orchestrator.ws_clients) >= MAX_WS_CLIENTS:
        await ws.close(code=4002, reason="Too many connections")
        return

    await ws.accept()
    orchestrator.ws_clients.append(ws)
    log.info(f"WebSocket client connected ({len(orchestrator.ws_clients)} total)")

    # Send current state snapshot
    await ws.send_json({
        "type": "system_status",
        **orchestrator.get_status(),
        "recent_events": orchestrator.get_recent_events(20),
    })

    # Rate limiting state for this connection
    cmd_timestamps: list[float] = []

    try:
        while True:
            raw = await ws.receive_text()
            if len(raw) > 4096:
                await ws.send_json({"type": "error", "detail": "Message too large"})
                continue

            try:
                import json
                data = json.loads(raw)
            except (json.JSONDecodeError, ValueError):
                await ws.send_json({"type": "error", "detail": "Invalid JSON"})
                continue

            msg_type = data.get("type")

            if msg_type == "command":
                # Rate limit commands
                now = time.time()
                cmd_timestamps[:] = [t for t in cmd_timestamps if now - t < 1.0]
                if len(cmd_timestamps) >= WS_RATE_LIMIT:
                    await ws.send_json({"type": "error", "detail": "Rate limit exceeded"})
                    continue
                cmd_timestamps.append(now)

                agent_id = data.get("agent_id")
                action = data.get("action")

                # Validate inputs
                if agent_id not in VALID_AGENT_IDS:
                    await ws.send_json({"type": "error", "detail": "Unknown agent"})
                    continue
                if action not in ("start", "stop", "pause"):
                    await ws.send_json({"type": "error", "detail": "Unknown action"})
                    continue

                try:
                    if action == "start":
                        await orchestrator.start_agent(agent_id)
                    elif action == "stop":
                        await orchestrator.stop_agent(agent_id)
                    elif action == "pause":
                        await orchestrator.pause_agent(agent_id)
                except ValueError:
                    await ws.send_json({"type": "error", "detail": "Agent operation failed"})

            elif msg_type == "ping":
                await ws.send_json({"type": "pong"})

    except WebSocketDisconnect:
        pass
    except Exception:
        log.error("WebSocket error", exc_info=True)
    finally:
        if ws in orchestrator.ws_clients:
            orchestrator.ws_clients.remove(ws)
        log.info(f"WebSocket client disconnected ({len(orchestrator.ws_clients)} total)")


# ─── Run ───

if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host=host, port=port, ws_max_size=65536)
