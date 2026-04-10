"""Integration tests for /api/pipeline/metrics/* endpoints."""

import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient


@pytest.fixture
def client(seeded_db):
    """TestClient with seeded in-memory PipelineDB monkeypatched in."""
    # Patch pipeline_db before importing main (which creates the real one at module level)
    with patch.dict("os.environ", {"AGENT_FARM_API_KEY": "test-key"}):
        import main as main_module
        main_module.pipeline_db = seeded_db
        main_module.API_KEY = "test-key"
        yield TestClient(main_module.app)


HEADERS = {"Authorization": "Bearer test-key"}


class TestMetricsEndpoints:
    def test_comprehensive_metrics(self, client):
        r = client.get("/api/pipeline/metrics", headers=HEADERS)
        assert r.status_code == 200
        data = r.json()
        assert "generated_at" in data
        assert "funnel" in data
        assert "time_to_stage" in data
        assert "score_distribution" in data

    def test_time_to_stage(self, client):
        r = client.get("/api/pipeline/metrics/time-to-stage", headers=HEADERS)
        assert r.status_code == 200
        assert isinstance(r.json(), dict)

    def test_agent_velocity(self, client):
        r = client.get("/api/pipeline/metrics/agent-velocity?days=90", headers=HEADERS)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_score_distribution(self, client):
        r = client.get("/api/pipeline/metrics/score-distribution", headers=HEADERS)
        assert r.status_code == 200
        data = r.json()
        assert "avg" in data
        assert "buckets" in data

    def test_score_by_stage(self, client):
        r = client.get("/api/pipeline/metrics/score-by-stage", headers=HEADERS)
        assert r.status_code == 200
        assert "scraped" in r.json()

    def test_score_by_industry(self, client):
        r = client.get("/api/pipeline/metrics/score-by-industry", headers=HEADERS)
        assert r.status_code == 200
        assert isinstance(r.json(), dict)

    def test_outreach(self, client):
        r = client.get("/api/pipeline/metrics/outreach", headers=HEADERS)
        assert r.status_code == 200
        assert "total" in r.json()

    def test_lead_quality(self, client):
        r = client.get("/api/pipeline/metrics/lead-quality", headers=HEADERS)
        assert r.status_code == 200
        data = r.json()
        assert "high" in data
        assert "medium" in data
        assert "low" in data

    def test_industry(self, client):
        r = client.get("/api/pipeline/metrics/industry", headers=HEADERS)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_funnel(self, client):
        r = client.get("/api/pipeline/metrics/funnel", headers=HEADERS)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_source_agents(self, client):
        r = client.get("/api/pipeline/metrics/source-agents", headers=HEADERS)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_creation_trend(self, client):
        r = client.get("/api/pipeline/metrics/creation-trend?days=90", headers=HEADERS)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_transition_trend(self, client):
        r = client.get("/api/pipeline/metrics/transition-trend?days=90", headers=HEADERS)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_outreach_roi(self, client):
        r = client.get("/api/pipeline/metrics/outreach-roi", headers=HEADERS)
        assert r.status_code == 200
        data = r.json()
        assert "with_outreach" in data
        assert "close_rate_delta" in data

    def test_campaigns(self, client):
        r = client.get("/api/pipeline/metrics/campaigns", headers=HEADERS)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_lead_lifecycle(self, client):
        r = client.get("/api/pipeline/leads/lead-015/lifecycle", headers=HEADERS)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 6


class TestMetricsAuth:
    def test_no_auth_returns_401(self, client):
        r = client.get("/api/pipeline/metrics")
        assert r.status_code == 401

    def test_bad_token_returns_401(self, client):
        r = client.get("/api/pipeline/metrics", headers={"Authorization": "Bearer wrong"})
        assert r.status_code == 401
