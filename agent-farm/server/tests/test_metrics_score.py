"""Tests for score distribution, score-by-stage, and score-by-industry metrics."""

import pytest


class TestScoreDistribution:
    def test_empty_db(self, db):
        result = db.get_score_distribution()
        assert result["avg"] == 0 or result["count"] == 0

    def test_leadgen_distribution(self, seeded_db):
        result = seeded_db.get_score_distribution()
        assert result["count"] == 18  # 18 seeded leads
        assert result["min"] == 25
        assert result["max"] == 95
        assert 25 <= result["avg"] <= 95

    def test_buckets_sum_to_total(self, seeded_db):
        result = seeded_db.get_score_distribution()
        bucket_total = sum(result["buckets"].values())
        assert bucket_total == result["count"]

    def test_percentiles(self, seeded_db):
        result = seeded_db.get_score_distribution()
        assert result["p25"] <= result["median"] <= result["p75"]
        assert result["min"] <= result["p25"]
        assert result["p75"] <= result["max"]

    def test_specific_pipeline_type(self, seeded_db):
        result = seeded_db.get_score_distribution("etsy")
        assert result["count"] == 4  # 4 etsy items
        assert result["min"] == 40
        assert result["max"] == 88

    def test_result_shape(self, seeded_db):
        result = seeded_db.get_score_distribution()
        for key in ("avg", "median", "min", "max", "p25", "p75", "count", "buckets"):
            assert key in result


class TestScoreByStage:
    def test_empty_db(self, db):
        result = db.get_score_by_stage("leadgen")
        assert isinstance(result, dict)

    def test_all_stages_present(self, seeded_db):
        result = seeded_db.get_score_by_stage("leadgen")
        for stage in ("scraped", "researched", "pitch_ready", "contacted", "responded", "closed"):
            assert stage in result

    def test_scores_increase_with_stage(self, seeded_db):
        """Higher stages should have higher avg scores (seed data is designed this way)."""
        result = seeded_db.get_score_by_stage("leadgen")
        ordered = ["scraped", "researched", "pitch_ready", "contacted", "responded", "closed"]
        avgs = [result[s]["avg_score"] for s in ordered if result[s]["count"] > 0]
        # Scores should generally increase (allow minor non-monotonicity)
        assert avgs[-1] > avgs[0]

    def test_result_value_shape(self, seeded_db):
        result = seeded_db.get_score_by_stage("leadgen")
        for stage, val in result.items():
            assert "avg_score" in val
            assert "count" in val


class TestScoreByIndustry:
    def test_empty_db(self, db):
        result = db.get_score_by_industry()
        assert isinstance(result, dict)
        assert len(result) == 0

    def test_all_industries(self, seeded_db):
        result = seeded_db.get_score_by_industry()
        assert len(result) >= 4  # hvac, dental, real_estate, auto_repair

    def test_result_value_shape(self, seeded_db):
        result = seeded_db.get_score_by_industry()
        for industry, val in result.items():
            assert "avg_score" in val
            assert "count" in val
            assert val["count"] > 0
