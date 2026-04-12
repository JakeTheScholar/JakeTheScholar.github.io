"""Tests for lead quality cohort metrics."""

import pytest


class TestLeadQualityCohorts:
    def test_empty_db(self, db):
        result = db.get_lead_quality_cohorts()
        assert isinstance(result, dict)

    def test_three_cohorts(self, seeded_db):
        result = seeded_db.get_lead_quality_cohorts()
        assert "high" in result
        assert "medium" in result
        assert "low" in result

    def test_counts_sum_to_total(self, seeded_db):
        result = seeded_db.get_lead_quality_cohorts()
        total = sum(c["count"] for c in result.values())
        assert total == 18

    def test_high_cohort_better_conversion(self, seeded_db):
        """High-score leads should have equal or higher conversion than low."""
        result = seeded_db.get_lead_quality_cohorts()
        high_rate = result["high"]["conversion_rate"]
        low_rate = result["low"]["conversion_rate"]
        assert high_rate >= low_rate

    def test_score_ranges(self, seeded_db):
        result = seeded_db.get_lead_quality_cohorts()
        assert result["high"]["score_range"] == "70-100"
        assert result["medium"]["score_range"] == "40-69"
        assert result["low"]["score_range"] == "0-39"

    def test_stages_present(self, seeded_db):
        result = seeded_db.get_lead_quality_cohorts()
        for cohort in result.values():
            assert "stages" in cohort
            assert isinstance(cohort["stages"], dict)
