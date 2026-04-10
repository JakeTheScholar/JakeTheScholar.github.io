"""Tests for outreach ROI metrics."""

import pytest


class TestOutreachROI:
    def test_empty_db(self, db):
        result = db.get_outreach_roi()
        assert isinstance(result, dict)
        assert "with_outreach" in result
        assert "without_outreach" in result

    def test_partitions_leads(self, seeded_db):
        result = seeded_db.get_outreach_roi()
        total = result["with_outreach"]["count"] + result["without_outreach"]["count"]
        assert total == 18

    def test_close_rates_valid(self, seeded_db):
        result = seeded_db.get_outreach_roi()
        for partition in ("with_outreach", "without_outreach"):
            assert 0.0 <= result[partition]["close_rate"] <= 1.0

    def test_close_rate_delta(self, seeded_db):
        result = seeded_db.get_outreach_roi()
        expected_delta = (result["with_outreach"]["close_rate"] -
                          result["without_outreach"]["close_rate"])
        assert abs(result["close_rate_delta"] - expected_delta) < 0.01

    def test_avg_scores(self, seeded_db):
        result = seeded_db.get_outreach_roi()
        for partition in ("with_outreach", "without_outreach"):
            if result[partition]["count"] > 0:
                assert result[partition]["avg_score"] > 0

    def test_result_shape(self, seeded_db):
        result = seeded_db.get_outreach_roi()
        for partition in ("with_outreach", "without_outreach"):
            for key in ("count", "closed", "close_rate", "avg_score"):
                assert key in result[partition]
        assert "close_rate_delta" in result
