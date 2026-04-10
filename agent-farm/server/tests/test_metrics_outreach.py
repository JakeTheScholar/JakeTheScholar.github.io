"""Tests for outreach engagement stats."""

import pytest


class TestOutreachStats:
    def test_empty_db(self, db):
        result = db.get_outreach_stats()
        assert result["total"] == 0

    def test_total_count(self, seeded_db):
        result = seeded_db.get_outreach_stats()
        assert result["total"] > 0

    def test_drafted_and_sent_sum(self, seeded_db):
        result = seeded_db.get_outreach_stats()
        assert result["drafted"] + result["sent"] == result["total"]

    def test_send_rate(self, seeded_db):
        result = seeded_db.get_outreach_stats()
        assert 0.0 <= result["send_rate"] <= 1.0
        if result["total"] > 0:
            expected = result["sent"] / result["total"]
            assert abs(result["send_rate"] - expected) < 0.01

    def test_by_channel(self, seeded_db):
        result = seeded_db.get_outreach_stats()
        assert "by_channel" in result
        assert "email" in result["by_channel"]
        assert "dm" in result["by_channel"]
        for ch, val in result["by_channel"].items():
            assert "total" in val
            assert "sent" in val

    def test_draft_to_send_hours(self, seeded_db):
        result = seeded_db.get_outreach_stats()
        if result["sent"] > 0:
            assert "avg_draft_to_send_hours" in result
            assert result["avg_draft_to_send_hours"] >= 0

    def test_result_shape(self, seeded_db):
        result = seeded_db.get_outreach_stats()
        for key in ("total", "drafted", "sent", "send_rate", "by_channel"):
            assert key in result
