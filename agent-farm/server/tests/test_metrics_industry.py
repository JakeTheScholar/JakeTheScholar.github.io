"""Tests for industry performance metrics."""

import pytest


class TestIndustryPerformance:
    def test_empty_db(self, db):
        result = db.get_industry_performance()
        assert isinstance(result, list)
        assert len(result) == 0

    def test_all_industries_present(self, seeded_db):
        result = seeded_db.get_industry_performance()
        industries = {r["industry"] for r in result}
        assert "hvac_plumbing" in industries
        assert "dental_ortho" in industries
        assert "real_estate" in industries
        assert "auto_repair" in industries

    def test_close_rate_valid(self, seeded_db):
        result = seeded_db.get_industry_performance()
        for r in result:
            assert 0.0 <= r["close_rate"] <= 1.0

    def test_total_matches_leads(self, seeded_db):
        result = seeded_db.get_industry_performance()
        total = sum(r["total"] for r in result)
        assert total == 18  # 18 seeded leads

    def test_stage_distribution_present(self, seeded_db):
        result = seeded_db.get_industry_performance()
        for r in result:
            assert "stage_distribution" in r
            assert isinstance(r["stage_distribution"], dict)

    def test_result_shape(self, seeded_db):
        result = seeded_db.get_industry_performance()
        for r in result:
            for key in ("industry", "total", "closed", "close_rate", "avg_score"):
                assert key in r
