"""Tests for time-to-stage and lead lifecycle metrics."""

import pytest


class TestTimeToStage:
    def test_empty_db(self, db):
        result = db.get_time_to_stage_stats("leadgen")
        assert isinstance(result, dict)

    def test_has_expected_transitions(self, seeded_db):
        result = seeded_db.get_time_to_stage_stats("leadgen")
        assert "scraped_to_researched" in result
        assert "researched_to_pitch_ready" in result

    def test_avg_hours_positive(self, seeded_db):
        result = seeded_db.get_time_to_stage_stats("leadgen")
        for key, val in result.items():
            if key == "total_cycle":
                continue
            assert val["avg_hours"] > 0
            assert val["count"] > 0

    def test_known_timing(self, seeded_db):
        """Seed data uses 24h between stages, so scraped->researched avg should be ~24h."""
        result = seeded_db.get_time_to_stage_stats("leadgen")
        s2r = result.get("scraped_to_researched", {})
        if s2r.get("count", 0) > 0:
            assert 20 <= s2r["avg_hours"] <= 28  # ~24h with minor float precision

    def test_total_cycle_present_for_closed(self, seeded_db):
        result = seeded_db.get_time_to_stage_stats("leadgen")
        if "total_cycle" in result:
            assert result["total_cycle"]["count"] > 0
            assert result["total_cycle"]["avg_hours"] > 0

    def test_result_value_shape(self, seeded_db):
        result = seeded_db.get_time_to_stage_stats("leadgen")
        for key, val in result.items():
            assert "avg_hours" in val
            assert "median_hours" in val
            assert "count" in val


class TestLeadLifecycle:
    def test_nonexistent_lead(self, db):
        result = db.get_lead_lifecycle("lead-nonexistent")
        assert isinstance(result, list)
        assert len(result) == 0

    def test_closed_lead_has_all_transitions(self, seeded_db):
        # lead-015 is the first closed lead
        result = seeded_db.get_lead_lifecycle("lead-015")
        assert len(result) >= 6  # None->scraped + 5 transitions
        stages = [t["to_stage"] for t in result]
        assert "scraped" in stages
        assert "closed" in stages

    def test_transitions_ordered_chronologically(self, seeded_db):
        result = seeded_db.get_lead_lifecycle("lead-015")
        timestamps = [t["changed_at"] for t in result]
        assert timestamps == sorted(timestamps)

    def test_includes_hours_in_stage(self, seeded_db):
        result = seeded_db.get_lead_lifecycle("lead-015")
        # All transitions except the last should have hours_in_stage
        for t in result[:-1]:
            assert "hours_in_stage" in t
            if t["hours_in_stage"] is not None:
                assert t["hours_in_stage"] >= 0
