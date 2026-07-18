import pytest

import start_quant_backend as backend


@pytest.mark.parametrize(
    "profile,deployment,gross,single,risk_per_trade,daily_stop,max_positions",
    [
        ("low", 30.0, 35.0, 8.0, 0.5, 1.5, 8),
        ("medium", 50.0, 60.0, 15.0, 1.0, 2.5, 10),
        ("high", 100.0, 100.0, 25.0, 1.5, 4.0, 12),
    ],
)
def test_risk_profile_owns_portfolio_budget(
    profile, deployment, gross, single, risk_per_trade, daily_stop, max_positions
):
    policy = backend._strategy_policy(profile, "mid", "hybrid")

    assert policy["targetDeploymentPct"] == deployment
    assert policy["maxGrossExposurePct"] == gross
    assert policy["maxSinglePositionPct"] == single
    assert policy["riskPerTradePct"] == risk_per_trade
    assert policy["dailyLossStopPct"] == daily_stop
    assert policy["maxPositions"] == max_positions
    assert policy["optionsAllowed"] is False
    assert policy["allowedAssetClasses"] == ["us_equity"]


@pytest.mark.parametrize(
    "horizon,holding,time_stop,review,max_stop,target_r1,dominant_factor",
    [
        ("short", "1-5 trading days", 5, 3, 5.0, 1.5, "momentum"),
        ("mid", "2-8 weeks", 40, 20, 9.0, 1.8, "momentum"),
        ("long", "3-12 months", 180, 60, 15.0, 2.2, "trend"),
    ],
)
def test_time_horizon_owns_selection_and_exit_geometry(
    horizon, holding, time_stop, review, max_stop, target_r1, dominant_factor
):
    policy = backend._strategy_policy("medium", horizon, "hybrid")

    assert policy["holdingPeriod"] == holding
    assert policy["timeStopDays"] == time_stop
    assert policy["reviewAfterDays"] == review
    assert policy["maxStopPct"] == max_stop
    assert policy["targetR1"] == target_r1
    assert policy["factorWeights"][dominant_factor] == max(policy["factorWeights"].values())
    assert sum(policy["factorWeights"].values()) == pytest.approx(1.0, abs=0.001)


def test_leverage_requires_explicit_high_risk_short_horizon_opt_in():
    active = backend._strategy_policy("high", "short", "ai", True)
    wrong_horizon = backend._strategy_policy("high", "mid", "ai", True)
    wrong_profile = backend._strategy_policy("medium", "short", "ai", True)
    not_requested = backend._strategy_policy("high", "short", "ai", False)

    assert active["leverageEnabled"] is True
    assert active["maxGrossExposurePct"] == 115.0
    assert active["leveragedSleeveMaxPct"] == 15.0
    assert "no inverse" in active["leveragedProductPolicy"]
    for policy in (wrong_horizon, wrong_profile, not_requested):
        assert policy["leverageEnabled"] is False
        assert policy["leveragedSleeveMaxPct"] == 0.0
        assert policy["optionsAllowed"] is False


@pytest.mark.parametrize(
    "mode,research,selects,buy,sell,approval",
    [
        ("manual", False, False, False, False, True),
        ("hybrid", True, False, False, False, True),
        ("ai", True, True, True, True, False),
    ],
)
def test_ai_mode_has_explicit_authority_boundary(
    mode, research, selects, buy, sell, approval
):
    permissions = backend._strategy_policy("medium", "mid", mode)["permissions"]

    assert permissions["aiResearch"] is research
    assert permissions["aiSelects"] is selects
    assert permissions["autoBuy"] is buy
    assert permissions["autoSell"] is sell
    assert permissions["userApprovalRequired"] is approval


def test_full_ai_can_scale_reduce_and_close_while_other_modes_cannot():
    manual = backend._strategy_policy("medium", "mid", "manual")["permissions"]
    hybrid = backend._strategy_policy("medium", "mid", "hybrid")["permissions"]
    full_ai = backend._strategy_policy("high", "mid", "ai")["permissions"]

    for permissions in (manual, hybrid):
        assert permissions["autoScaleIn"] is False
        assert permissions["autoReduce"] is False
        assert permissions["autoClose"] is False
    assert full_ai["autoScaleIn"] is True
    assert full_ai["autoReduce"] is True
    assert full_ai["autoClose"] is True


def test_high_risk_exposes_full_allocation_with_small_execution_buffer():
    policy = backend._strategy_policy("high", "mid", "ai")

    assert policy["fullAllocationAllowed"] is True
    assert policy["targetDeploymentPct"] == 100.0
    assert policy["maxSinglePositionPct"] == 25.0
    assert policy["sectorCapPct"] == 40.0
    assert policy["maxDailyFilledOrders"] == 20
    assert policy["platformHardLimits"] == backend.PLATFORM_HARD_LIMITS
    assert policy["buyingPowerBufferPct"] == 0.5


def test_scale_in_requires_an_existing_winner_and_respects_count_limit():
    mandate = backend._strategy_policy("medium", "mid", "ai")
    winner = {"qty": "10", "market_value": "1200", "unrealized_plpc": "0.03"}
    loser = {"qty": "10", "market_value": "900", "unrealized_plpc": "-0.02"}

    eligible = backend._scale_in_assessment(winner, {"scaleInCount": 1}, mandate)
    losing = backend._scale_in_assessment(loser, {"scaleInCount": 0}, mandate)
    exhausted = backend._scale_in_assessment(winner, {"scaleInCount": 2}, mandate)

    assert eligible["eligible"] is True
    assert eligible["unrealizedPct"] == 3.0
    assert losing["eligible"] is False
    assert "existing winner" in " ".join(losing["blockers"])
    assert exhausted["eligible"] is False
    assert "Maximum scale-in count" in " ".join(exhausted["blockers"])


def test_exit_policy_is_derived_from_same_strategy_mandate():
    for profile in ("low", "medium", "high"):
        for horizon in ("short", "mid", "long"):
            mandate = backend._strategy_policy(profile, horizon)
            exit_policy = backend._pa_exit_policy(profile, horizon)

            assert exit_policy["fallbackRiskPct"] == pytest.approx(
                mandate["maxStopPct"] / 100.0
            )
            assert exit_policy["fallbackTargetR"] == mandate["targetR1"]
            assert exit_policy["timeStopDays"] == mandate["timeStopDays"]
            assert exit_policy["reviewAfterDays"] == mandate["reviewAfterDays"]
            assert exit_policy["maxPositionReviewPct"] == mandate["maxSinglePositionPct"]
            assert exit_policy["optionsAllowed"] is False


def test_severe_exit_boundary_uses_horizon_mandate():
    short = backend._pa_exit_risk_decision(94.9, 100.0, None, None, "high", "short")
    long = backend._pa_exit_risk_decision(94.9, 100.0, None, None, "high", "long")

    assert short[0] == "emergency_exit"
    assert long[0] == "hold"


def test_account_risk_preferences_can_only_tighten_strategy_policy(monkeypatch):
    monkeypatch.setattr(
        backend,
        "_pa_get_config",
        lambda uid: {
            "user_preferences": {
                "risk": {
                    "maxPositionPct": 6,
                    "dailyLossLimitPct": 1.25,
                    "sectorConcentrationPct": 18,
                    "maxOpenPositions": 5,
                }
            }
        },
    )

    policy = backend._apply_account_hard_risk_limits(
        backend._strategy_policy("high", "short", "ai"),
        "user-1",
    )

    assert policy["maxSinglePositionPct"] == 6
    assert policy["dailyLossStopPct"] == 1.25
    assert policy["sectorCapPct"] == 18
    assert policy["maxPositions"] == 5
    assert policy["effectiveLimits"]["maxSinglePositionPct"] == 6
    assert policy["accountRiskLimitsApplied"] is True
