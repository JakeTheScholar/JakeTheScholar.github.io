"""Tests for creation trend and transition trend metrics."""

import pytest


class TestCreationTrend:
    def test_empty_db(self, db):
        result = db.get_creation_trend("leadgen", "day", 30)
        assert isinstance(result, list)

    def test_daily_trend(self, seeded_db):
        result = seeded_db.get_creation_trend("leadgen", "day", 90)
        assert len(result) > 0
        total_created = sum(r["count"] for r in result)
        assert total_created == 18  # 18 seeded leads

    def test_weekly_trend(self, seeded_db):
        result = seeded_db.get_creation_trend("leadgen", "week", 90)
        assert len(result) > 0
        total_created = sum(r["count"] for r in result)
        assert total_created == 18

    def test_specific_pipeline(self, seeded_db):
        result = seeded_db.get_creation_trend("etsy", "day", 90)
        total = sum(r["count"] for r in result)
        assert total == 4  # 4 etsy items

    def test_date_format(self, seeded_db):
        result = seeded_db.get_creation_trend("leadgen", "day", 90)
        for r in result:
            assert "date" in r
            assert "count" in r
            assert len(r["date"]) == 10  # YYYY-MM-DD

    def test_days_filter(self, seeded_db):
        short = seeded_db.get_creation_trend("leadgen", "day", 5)
        long = seeded_db.get_creation_trend("leadgen", "day", 90)
        assert len(short) <= len(long)


class TestTransitionTrend:
    def test_empty_db(self, db):
        result = db.get_transition_trend("leadgen", 30)
        assert isinstance(result, list)

    def test_daily_transitions(self, seeded_db):
        result = seeded_db.get_transition_trend("leadgen", 90)
        assert len(result) > 0
        total = sum(r["transitions"] for r in result)
        assert total > 18  # More transitions than leads (each lead has multiple)

    def test_result_shape(self, seeded_db):
        result = seeded_db.get_transition_trend("leadgen", 90)
        for r in result:
            assert "date" in r
            assert "transitions" in r
