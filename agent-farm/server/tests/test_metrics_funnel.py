"""Tests for pipeline funnel conversion rate metrics."""

import pytest


class TestFunnelConversion:
    def test_empty_db_returns_empty(self, db):
        result = db.get_funnel_conversion("leadgen")
        assert isinstance(result, list)
        assert len(result) == 0 or all(r["from_count"] == 0 for r in result)

    def test_leadgen_all_stage_pairs(self, seeded_db):
        result = seeded_db.get_funnel_conversion("leadgen")
        stages_seen = [(r["from_stage"], r["to_stage"]) for r in result]
        assert ("scraped", "researched") in stages_seen
        assert ("researched", "pitch_ready") in stages_seen
        assert ("pitch_ready", "contacted") in stages_seen
        assert ("contacted", "responded") in stages_seen
        assert ("responded", "closed") in stages_seen

    def test_leadgen_conversion_rates_are_valid(self, seeded_db):
        result = seeded_db.get_funnel_conversion("leadgen")
        for r in result:
            assert 0.0 <= r["conversion_rate"] <= 1.0
            assert r["from_count"] >= r["to_count"]

    def test_leadgen_from_counts_decrease(self, seeded_db):
        """Each stage should have <= leads than the previous one (cumulative funnel)."""
        result = seeded_db.get_funnel_conversion("leadgen")
        if len(result) >= 2:
            for i in range(1, len(result)):
                assert result[i]["from_count"] <= result[i - 1]["from_count"]

    def test_generic_pipeline_etsy(self, seeded_db):
        result = seeded_db.get_funnel_conversion("etsy")
        assert isinstance(result, list)
        # Etsy has: drafted, designed, listed, optimized, selling
        stages_seen = [r["from_stage"] for r in result]
        assert "drafted" in stages_seen

    def test_result_shape(self, seeded_db):
        result = seeded_db.get_funnel_conversion("leadgen")
        for r in result:
            assert "from_stage" in r
            assert "to_stage" in r
            assert "from_count" in r
            assert "to_count" in r
            assert "conversion_rate" in r
