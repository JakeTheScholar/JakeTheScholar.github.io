"""Tests for agent velocity, stage contributions, and source performance."""

import pytest


class TestAgentVelocity:
    def test_empty_db(self, db):
        result = db.get_agent_velocity(days=7)
        assert isinstance(result, list)

    def test_returns_agents(self, seeded_db):
        result = seeded_db.get_agent_velocity(days=90)  # wide window to include seed data
        assert len(result) > 0

    def test_items_per_day_positive(self, seeded_db):
        result = seeded_db.get_agent_velocity(days=90)
        for r in result:
            assert r["items_per_day"] >= 0
            assert r["items_created"] > 0

    def test_result_shape(self, seeded_db):
        result = seeded_db.get_agent_velocity(days=90)
        for r in result:
            for key in ("agent_id", "items_created", "period_days", "items_per_day"):
                assert key in r


class TestAgentStageContributions:
    def test_unknown_agent(self, db):
        result = db.get_agent_stage_contributions("nonexistent-001")
        assert result["total_transitions"] == 0

    def test_known_agent(self, seeded_db):
        result = seeded_db.get_agent_stage_contributions("lead-scraper-001")
        assert result["agent_id"] == "lead-scraper-001"
        assert result["total_transitions"] > 0
        assert "scraped" in result["transitions"]

    def test_result_shape(self, seeded_db):
        result = seeded_db.get_agent_stage_contributions("outreach-001")
        assert "agent_id" in result
        assert "transitions" in result
        assert "total_transitions" in result


class TestSourceAgentPerformance:
    def test_empty_db(self, db):
        result = db.get_source_agent_performance()
        assert isinstance(result, list)

    def test_returns_agents(self, seeded_db):
        result = seeded_db.get_source_agent_performance()
        assert len(result) > 0

    def test_leadgen_source(self, seeded_db):
        result = seeded_db.get_source_agent_performance("leadgen")
        agents = {r["source_agent"] for r in result}
        assert "lead-scraper-001" in agents

    def test_items_source(self, seeded_db):
        result = seeded_db.get_source_agent_performance("etsy")
        agents = {r["source_agent"] for r in result}
        # etsy items have etsy-lister-001 and printables-001
        assert len(agents) > 0

    def test_result_shape(self, seeded_db):
        result = seeded_db.get_source_agent_performance()
        for r in result:
            for key in ("source_agent", "items_created", "avg_score"):
                assert key in r
