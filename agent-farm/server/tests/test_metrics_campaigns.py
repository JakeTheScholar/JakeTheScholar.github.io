"""Tests for campaign effectiveness metrics."""

import pytest


class TestCampaignStats:
    def test_empty_db(self, db):
        result = db.get_campaign_stats()
        assert isinstance(result, list)
        assert len(result) == 0

    def test_returns_campaigns(self, seeded_db):
        result = seeded_db.get_campaign_stats()
        assert len(result) == 2  # 2 seeded campaigns

    def test_completion_rate(self, seeded_db):
        result = seeded_db.get_campaign_stats()
        for c in result:
            assert 0.0 <= c["completion_rate"] <= 1.0
            if c["target_count"] > 0:
                expected = c["leads_generated"] / c["target_count"]
                assert abs(c["completion_rate"] - expected) < 0.01

    def test_completed_campaign_rate(self, seeded_db):
        result = seeded_db.get_campaign_stats()
        completed = [c for c in result if c["name"] == "Dental Fall Campaign"]
        assert len(completed) == 1
        assert completed[0]["completion_rate"] == 1.0  # 30/30

    def test_days_active(self, seeded_db):
        result = seeded_db.get_campaign_stats()
        for c in result:
            assert "days_active" in c
            assert c["days_active"] >= 0

    def test_result_shape(self, seeded_db):
        result = seeded_db.get_campaign_stats()
        for c in result:
            for key in ("id", "name", "industry", "status", "target_count",
                        "leads_generated", "completion_rate", "days_active"):
                assert key in c
