import math
import random
from datetime import datetime, timedelta, timezone

import numpy as np
import pytest

import crypto_ml
from crypto_ml import (
    FEATURE_NAMES,
    CryptoMlError,
    MlpModel,
    build_dataset,
    latest_probability,
    train_direction_model,
    walk_forward_probabilities,
)


def _ar_bars(count=4400, seed=11, phi=0.25):
    """Hourly bars with a weak AR(1) return signal the model can learn."""

    rng = random.Random(seed)
    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    bars, price, previous = [], 3000.0, 0.0
    for index in range(count):
        ret = phi * previous + rng.gauss(0.0001, 0.004)
        previous = ret
        close = price * math.exp(ret)
        bars.append(
            {
                "t": (start + timedelta(hours=index)).isoformat(),
                "o": price,
                "h": max(price, close) * (1 + abs(rng.gauss(0, 0.001))),
                "l": min(price, close) * (1 - abs(rng.gauss(0, 0.001))),
                "c": close,
                "v": 100 + rng.random() * 50,
            }
        )
        price = close
    return bars


@pytest.fixture(scope="module")
def bars():
    return _ar_bars()


def test_dataset_aligns_features_labels_and_deadband(bars):
    dataset = build_dataset(bars)
    X, y = dataset["X"], dataset["y"]

    assert X.shape[1] == len(FEATURE_NAMES)
    assert X.shape[0] == len(dataset["row_indices"]) == y.shape[0]
    # The newest completed bar always has features (so live inference works)
    # but its label is undefined until the next bar exists.
    assert dataset["row_indices"][-1] == dataset["n_rows"] - 1
    assert math.isnan(y[-1])
    # Labels are binary outside the dead-band and NaN inside it.
    labeled = y[~np.isnan(y)]
    assert set(np.unique(labeled)).issubset({0.0, 1.0})
    assert np.isfinite(X).all()


def test_training_is_deterministic_and_beats_chance_on_planted_signal(bars):
    first = train_direction_model(bars, seed=7)
    second = train_direction_model(bars, seed=7)

    for w1, w2 in zip(first["model"].weights, second["model"].weights):
        assert np.allclose(w1, w2)
    summary = first["summary"]
    # AR(1) drift is learnable: validation AUC must beat a coin flip.
    assert summary["val_auc"] > 0.52
    assert 0 < summary["epochs_run"] <= 160

    probabilities = first["model"].predict_proba(build_dataset(bars)["X"][:64])
    assert np.all((probabilities >= 0) & (probabilities <= 1))


def test_model_serialization_roundtrip_preserves_predictions(bars):
    trained = train_direction_model(bars, seed=3)["model"]
    restored = MlpModel.from_dict(trained.to_dict())

    X = build_dataset(bars)["X"][-128:]
    assert np.allclose(trained.predict_proba(X), restored.predict_proba(X))

    corrupted = trained.to_dict()
    corrupted["feature_version"] = 0
    with pytest.raises(CryptoMlError, match="feature version"):
        MlpModel.from_dict(corrupted)


def test_walk_forward_probabilities_are_strictly_out_of_sample(bars):
    result = walk_forward_probabilities(bars, n_folds=3)
    probs = result["probabilities"]
    dataset = build_dataset(bars)

    assert len(probs) == dataset["n_rows"]
    # The initial training window must have no prediction at all.
    first_scored = next(i for i, p in enumerate(probs) if p is not None)
    assert all(p is None for p in probs[:first_scored])
    assert 0 < result["coverage"] < 1
    assert result["fold_metrics"]
    assert result["oos_auc"] is not None
    scored = [p for p in probs if p is not None]
    assert all(0.0 <= p <= 1.0 for p in scored)


def test_latest_probability_serves_the_newest_completed_bar(bars):
    model = train_direction_model(bars, seed=5)["model"]
    latest = latest_probability(bars, model)

    assert latest is not None
    assert 0.0 <= latest["probability_up"] <= 1.0
    assert latest["model_version"].startswith(crypto_ml.MODEL_FAMILY)


def test_training_requires_a_meaningful_sample_size():
    with pytest.raises((CryptoMlError, Exception)):
        train_direction_model(_ar_bars(count=1600))
