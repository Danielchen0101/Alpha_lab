"""Deep-learning direction advisor for the Helios crypto ensemble.

A compact multi-layer perceptron (2 hidden ReLU layers, sigmoid head) trained
with Adam, inverted dropout, L2 regularization, class re-weighting and early
stopping — implemented directly on NumPy so the backend gains no heavy
framework dependency.  The model classifies whether the *next* completed bar
closes up by more than a small cost dead-band, following the walk-forward,
transaction-cost-aware evaluation discipline of Bysik & Ślepaczuk
(arXiv 2606.00060): out-of-sample probabilities are produced fold by fold and
may never be computed with information from their own future.

The advisor never trades on its own.  ``crypto_engine.generate_signal``
accepts its probability as a bounded score adjustment plus an entry veto —
the deterministic ensemble stays in charge.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any, Dict, List, Mapping, Optional, Sequence, Tuple

import numpy as np

try:
    from .crypto_engine import CryptoEngineError, compute_indicators, validate_config
except ImportError:  # direct module import by the monolithic backend
    from crypto_engine import CryptoEngineError, compute_indicators, validate_config  # type: ignore


MODEL_FAMILY = "helios-mlp"
MODEL_VERSION = "1.0.0"
FEATURE_VERSION = 3
DEFAULT_DEADBAND_BPS = 5.0
DEFAULT_HIDDEN = (32, 16)
DEFAULT_SEED = 20240

FEATURE_NAMES: Tuple[str, ...] = (
    "ret_1", "ret_3", "ret_6", "ret_12", "ret_24",
    "rsi", "rsi_fast", "macd_hist_pct", "zscore", "adx",
    "vol_ratio", "atr_pct", "volume_z",
    "mom_3d", "mom_20d", "mom_65d",
    "gap_ema_fast", "gap_ema_slow", "gap_anchor", "anchor_slope",
    "donchian_pos",
    "hour_sin", "hour_cos", "dow_sin", "dow_cos",
)


class CryptoMlError(ValueError):
    """Raised for invalid deep-learning advisor input."""


def _timestamp(row: Mapping[str, Any]) -> datetime:
    value = row["timestamp"]
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc)
    raise CryptoMlError("indicator rows must carry datetime timestamps")


def _row_features(row: Mapping[str, Any], closes: Sequence[float], index: int) -> Optional[List[float]]:
    """Build one causal feature vector, or None while indicators warm up."""

    needed = (
        "rsi", "rsi_fast", "zscore", "adx", "vol_ratio", "atr_pct", "volume_z",
        "momentum_3d", "momentum_20d", "momentum_65d", "ema_10", "ema_40",
        "ema_anchor", "anchor_slope_pct", "macd_hist_pct",
    )
    if any(row.get(field) is None for field in needed):
        return None
    if index < 24:
        return None
    close = float(row["close"])
    if close <= 0:
        return None

    def lag_return(lag: int) -> float:
        past = closes[index - lag]
        return math.log(close / past) if past > 0 else 0.0

    stamp = _timestamp(row)
    hour_angle = 2.0 * math.pi * stamp.hour / 24.0
    dow_angle = 2.0 * math.pi * stamp.weekday() / 7.0
    donchian = row.get("donchian_pos")
    features = [
        lag_return(1) * 100.0,
        lag_return(3) * 100.0,
        lag_return(6) * 100.0,
        lag_return(12) * 100.0,
        lag_return(24) * 100.0,
        float(row["rsi"]) / 100.0 - 0.5,
        float(row["rsi_fast"]) / 100.0 - 0.5,
        max(-2.0, min(2.0, float(row["macd_hist_pct"]))),
        max(-4.0, min(4.0, float(row["zscore"]))),
        float(row["adx"]) / 50.0 - 0.5,
        max(-2.0, min(2.0, float(row["vol_ratio"]) - 1.0)),
        float(row["atr_pct"]) * 100.0,
        max(-4.0, min(4.0, float(row["volume_z"]))),
        max(-1.0, min(1.0, float(row["momentum_3d"]) / 0.05)),
        max(-1.0, min(1.0, float(row["momentum_20d"]) / 0.10)),
        max(-1.0, min(1.0, float(row["momentum_65d"]) / 0.25)),
        (close / float(row["ema_10"]) - 1.0) * 100.0,
        (close / float(row["ema_40"]) - 1.0) * 100.0,
        (close / float(row["ema_anchor"]) - 1.0) * 100.0,
        max(-2.0, min(2.0, float(row["anchor_slope_pct"]))),
        (float(donchian) - 0.5) if donchian is not None else 0.0,
        math.sin(hour_angle),
        math.cos(hour_angle),
        math.sin(dow_angle),
        math.cos(dow_angle),
    ]
    if any(not math.isfinite(value) for value in features):
        return None
    return features


def build_dataset(
    bars: Sequence[Mapping[str, Any]],
    config: Optional[Mapping[str, Any]] = None,
    *,
    deadband_bps: float = DEFAULT_DEADBAND_BPS,
) -> Dict[str, Any]:
    """Compute aligned features and next-bar labels for every usable row.

    Returns arrays aligned to the *indicator row index* so out-of-sample
    predictions can be mapped back onto bars without ambiguity.  The final
    row has features but no label (its next bar does not exist yet).
    """

    cfg = validate_config(config)
    rows = compute_indicators(bars, cfg)
    closes = [float(row["close"]) for row in rows]
    deadband = abs(float(deadband_bps)) / 10_000.0

    feature_rows: List[List[float]] = []
    row_indices: List[int] = []
    labels: List[float] = []          # 1.0 up, 0.0 down, nan inside dead-band
    for index, row in enumerate(rows):
        features = _row_features(row, closes, index)
        if features is None:
            continue
        feature_rows.append(features)
        row_indices.append(index)
        if index + 1 < len(rows) and closes[index] > 0:
            forward = math.log(closes[index + 1] / closes[index])
            if forward > deadband:
                labels.append(1.0)
            elif forward < -deadband:
                labels.append(0.0)
            else:
                labels.append(float("nan"))
        else:
            labels.append(float("nan"))

    if not feature_rows:
        raise CryptoMlError("not enough warmed-up bars to build a training dataset")
    return {
        "X": np.asarray(feature_rows, dtype=np.float64),
        "y": np.asarray(labels, dtype=np.float64),
        "row_indices": row_indices,
        "n_rows": len(rows),
        "feature_names": list(FEATURE_NAMES),
        "deadband_bps": float(deadband_bps),
    }


class MlpModel:
    """Small dense network: input → ReLU stack → sigmoid probability."""

    def __init__(
        self,
        n_features: int,
        hidden: Sequence[int] = DEFAULT_HIDDEN,
        *,
        seed: int = DEFAULT_SEED,
        l2: float = 1e-4,
        dropout: float = 0.15,
    ):
        if n_features <= 0:
            raise CryptoMlError("n_features must be positive")
        self.n_features = int(n_features)
        self.hidden = [int(h) for h in hidden]
        if any(h <= 0 for h in self.hidden):
            raise CryptoMlError("hidden layer sizes must be positive")
        self.l2 = float(l2)
        self.dropout = float(dropout)
        self.seed = int(seed)
        self.rng = np.random.default_rng(self.seed)
        self.mean = np.zeros(self.n_features)
        self.std = np.ones(self.n_features)
        sizes = [self.n_features] + self.hidden + [1]
        self.weights: List[np.ndarray] = []
        self.biases: List[np.ndarray] = []
        for fan_in, fan_out in zip(sizes[:-1], sizes[1:]):
            limit = math.sqrt(6.0 / (fan_in + fan_out))
            self.weights.append(self.rng.uniform(-limit, limit, size=(fan_in, fan_out)))
            self.biases.append(np.zeros(fan_out))
        self.trained_at: Optional[str] = None
        self.train_samples = 0
        self.metrics: Dict[str, Any] = {}

    # ---- forward / backward ------------------------------------------------
    def _forward(self, X: np.ndarray, *, training: bool) -> Tuple[np.ndarray, List[Dict[str, np.ndarray]]]:
        cache: List[Dict[str, np.ndarray]] = []
        activation = X
        for layer, (W, b) in enumerate(zip(self.weights, self.biases)):
            z = activation @ W + b
            last = layer == len(self.weights) - 1
            if last:
                out = 1.0 / (1.0 + np.exp(-np.clip(z, -30, 30)))
            else:
                out = np.maximum(z, 0.0)
                if training and self.dropout > 0:
                    mask = (self.rng.random(out.shape) >= self.dropout).astype(np.float64)
                    out = out * mask / (1.0 - self.dropout)
                    cache.append({"input": activation, "z": z, "mask": mask})
                    activation = out
                    continue
            cache.append({"input": activation, "z": z})
            activation = out
        return activation, cache

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        X = np.asarray(X, dtype=np.float64)
        if X.ndim == 1:
            X = X.reshape(1, -1)
        Xn = (X - self.mean) / self.std
        prob, _ = self._forward(Xn, training=False)
        return prob.reshape(-1)

    def fit(
        self,
        X: np.ndarray,
        y: np.ndarray,
        *,
        X_val: Optional[np.ndarray] = None,
        y_val: Optional[np.ndarray] = None,
        max_epochs: int = 160,
        batch_size: int = 256,
        learning_rate: float = 1e-3,
        patience: int = 10,
    ) -> Dict[str, Any]:
        X = np.asarray(X, dtype=np.float64)
        y = np.asarray(y, dtype=np.float64).reshape(-1)
        if X.shape[0] != y.shape[0]:
            raise CryptoMlError("X and y row counts differ")
        if X.shape[1] != self.n_features:
            raise CryptoMlError("feature width mismatch")
        if X.shape[0] < 50:
            raise CryptoMlError("need at least 50 labeled samples to train")

        self.mean = X.mean(axis=0)
        std = X.std(axis=0)
        std[std < 1e-9] = 1.0
        self.std = std
        Xn = (X - self.mean) / self.std
        Xv = None
        yv = None
        if X_val is not None and y_val is not None and len(y_val) > 0:
            Xv = (np.asarray(X_val, dtype=np.float64) - self.mean) / self.std
            yv = np.asarray(y_val, dtype=np.float64).reshape(-1)

        n_pos = max(1.0, float((y > 0.5).sum()))
        n_neg = max(1.0, float((y <= 0.5).sum()))
        w_pos = y.shape[0] / (2.0 * n_pos)
        w_neg = y.shape[0] / (2.0 * n_neg)
        sample_weight = np.where(y > 0.5, w_pos, w_neg)

        # Adam state
        m_w = [np.zeros_like(W) for W in self.weights]
        v_w = [np.zeros_like(W) for W in self.weights]
        m_b = [np.zeros_like(b) for b in self.biases]
        v_b = [np.zeros_like(b) for b in self.biases]
        beta1, beta2, eps = 0.9, 0.999, 1e-8
        step = 0

        best_val = float("inf")
        best_state: Optional[Tuple[List[np.ndarray], List[np.ndarray]]] = None
        bad_epochs = 0
        history: List[Dict[str, float]] = []
        indices = np.arange(Xn.shape[0])

        for epoch in range(max_epochs):
            self.rng.shuffle(indices)
            for start in range(0, len(indices), batch_size):
                batch = indices[start : start + batch_size]
                xb, yb, wb = Xn[batch], y[batch], sample_weight[batch]
                prob, cache = self._forward(xb, training=True)
                prob = prob.reshape(-1)
                # weighted BCE gradient at the sigmoid output
                delta = ((prob - yb) * wb / len(batch)).reshape(-1, 1)
                grads_w: List[np.ndarray] = [None] * len(self.weights)  # type: ignore
                grads_b: List[np.ndarray] = [None] * len(self.biases)  # type: ignore
                for layer in range(len(self.weights) - 1, -1, -1):
                    layer_cache = cache[layer]
                    grads_w[layer] = layer_cache["input"].T @ delta + self.l2 * self.weights[layer]
                    grads_b[layer] = delta.sum(axis=0)
                    if layer > 0:
                        delta = delta @ self.weights[layer].T
                        delta = delta * (cache[layer - 1]["z"] > 0)
                        mask = cache[layer - 1].get("mask")
                        if mask is not None:
                            delta = delta * mask / (1.0 - self.dropout)
                step += 1
                lr_t = learning_rate * math.sqrt(1 - beta2 ** step) / (1 - beta1 ** step)
                for layer in range(len(self.weights)):
                    m_w[layer] = beta1 * m_w[layer] + (1 - beta1) * grads_w[layer]
                    v_w[layer] = beta2 * v_w[layer] + (1 - beta2) * grads_w[layer] ** 2
                    self.weights[layer] -= lr_t * m_w[layer] / (np.sqrt(v_w[layer]) + eps)
                    m_b[layer] = beta1 * m_b[layer] + (1 - beta1) * grads_b[layer]
                    v_b[layer] = beta2 * v_b[layer] + (1 - beta2) * grads_b[layer] ** 2
                    self.biases[layer] -= lr_t * m_b[layer] / (np.sqrt(v_b[layer]) + eps)

            train_loss = self._logloss(Xn, y, sample_weight)
            record = {"epoch": epoch + 1, "train_logloss": round(train_loss, 6)}
            if Xv is not None and yv is not None:
                val_loss = self._logloss(Xv, yv)
                record["val_logloss"] = round(val_loss, 6)
                if val_loss < best_val - 1e-5:
                    best_val = val_loss
                    best_state = (
                        [W.copy() for W in self.weights],
                        [b.copy() for b in self.biases],
                    )
                    bad_epochs = 0
                else:
                    bad_epochs += 1
            history.append(record)
            if Xv is not None and bad_epochs >= patience:
                break

        if best_state is not None:
            self.weights, self.biases = best_state
        self.trained_at = datetime.now(timezone.utc).isoformat()
        self.train_samples = int(X.shape[0])
        summary: Dict[str, Any] = {
            "epochs_run": len(history),
            "final_train_logloss": history[-1]["train_logloss"] if history else None,
            "best_val_logloss": round(best_val, 6) if best_val < float("inf") else None,
            "positives": int(n_pos),
            "negatives": int(n_neg),
        }
        if Xv is not None and yv is not None:
            val_prob = self._forward(Xv, training=False)[0].reshape(-1)
            summary["val_accuracy"] = round(float(((val_prob > 0.5) == (yv > 0.5)).mean()), 6)
            summary["val_auc"] = round(_auc(yv, val_prob), 6)
        self.metrics = summary
        return summary

    def _logloss(self, Xn: np.ndarray, y: np.ndarray, weights: Optional[np.ndarray] = None) -> float:
        prob = self._forward(Xn, training=False)[0].reshape(-1)
        prob = np.clip(prob, 1e-7, 1 - 1e-7)
        losses = -(y * np.log(prob) + (1 - y) * np.log(1 - prob))
        if weights is not None:
            return float((losses * weights).sum() / weights.sum())
        return float(losses.mean())

    # ---- persistence -------------------------------------------------------
    def to_dict(self) -> Dict[str, Any]:
        return {
            "family": MODEL_FAMILY,
            "version": MODEL_VERSION,
            "feature_version": FEATURE_VERSION,
            "n_features": self.n_features,
            "hidden": list(self.hidden),
            "l2": self.l2,
            "dropout": self.dropout,
            "seed": self.seed,
            "mean": self.mean.tolist(),
            "std": self.std.tolist(),
            "weights": [W.tolist() for W in self.weights],
            "biases": [b.tolist() for b in self.biases],
            "trained_at": self.trained_at,
            "train_samples": self.train_samples,
            "metrics": self.metrics,
            "feature_names": list(FEATURE_NAMES),
        }

    @classmethod
    def from_dict(cls, payload: Mapping[str, Any]) -> "MlpModel":
        if not isinstance(payload, Mapping):
            raise CryptoMlError("model payload must be an object")
        if payload.get("family") != MODEL_FAMILY:
            raise CryptoMlError("unsupported model family")
        if int(payload.get("feature_version") or 0) != FEATURE_VERSION:
            raise CryptoMlError("model feature version mismatch; retrain required")
        model = cls(
            int(payload["n_features"]),
            payload.get("hidden") or DEFAULT_HIDDEN,
            seed=int(payload.get("seed") or DEFAULT_SEED),
            l2=float(payload.get("l2") or 1e-4),
            dropout=float(payload.get("dropout") or 0.15),
        )
        model.mean = np.asarray(payload["mean"], dtype=np.float64)
        model.std = np.asarray(payload["std"], dtype=np.float64)
        model.weights = [np.asarray(W, dtype=np.float64) for W in payload["weights"]]
        model.biases = [np.asarray(b, dtype=np.float64) for b in payload["biases"]]
        model.trained_at = payload.get("trained_at")
        model.train_samples = int(payload.get("train_samples") or 0)
        model.metrics = dict(payload.get("metrics") or {})
        return model


def _auc(y: np.ndarray, prob: np.ndarray) -> float:
    """Rank-based AUC (Mann-Whitney)."""

    y = np.asarray(y).reshape(-1)
    prob = np.asarray(prob).reshape(-1)
    pos = prob[y > 0.5]
    neg = prob[y <= 0.5]
    if len(pos) == 0 or len(neg) == 0:
        return 0.5
    order = np.argsort(np.concatenate([pos, neg]), kind="mergesort")
    ranks = np.empty(len(order), dtype=np.float64)
    ranks[order] = np.arange(1, len(order) + 1)
    # average ranks for ties
    combined = np.concatenate([pos, neg])
    sorted_vals = combined[order]
    i = 0
    while i < len(sorted_vals):
        j = i
        while j + 1 < len(sorted_vals) and sorted_vals[j + 1] == sorted_vals[i]:
            j += 1
        if j > i:
            ranks[order[i : j + 1]] = (i + 1 + j + 1) / 2.0
        i = j + 1
    rank_sum_pos = ranks[: len(pos)].sum()
    u = rank_sum_pos - len(pos) * (len(pos) + 1) / 2.0
    return float(u / (len(pos) * len(neg)))


def train_direction_model(
    bars: Sequence[Mapping[str, Any]],
    config: Optional[Mapping[str, Any]] = None,
    *,
    deadband_bps: float = DEFAULT_DEADBAND_BPS,
    validation_fraction: float = 0.2,
    seed: int = DEFAULT_SEED,
    max_epochs: int = 160,
) -> Dict[str, Any]:
    """Train one model on all labeled history with a chronological tail split.

    The validation slice is always the most recent segment — shuffling a time
    series into random folds would leak the future into training.
    """

    dataset = build_dataset(bars, config, deadband_bps=deadband_bps)
    X, y = dataset["X"], dataset["y"]
    labeled = ~np.isnan(y)
    X_labeled, y_labeled = X[labeled], y[labeled]
    if X_labeled.shape[0] < 120:
        raise CryptoMlError(
            f"need at least 120 labeled samples to train, have {X_labeled.shape[0]}"
        )
    split = int(X_labeled.shape[0] * (1.0 - max(0.05, min(0.4, validation_fraction))))
    model = MlpModel(X.shape[1], seed=seed)
    summary = model.fit(
        X_labeled[:split],
        y_labeled[:split],
        X_val=X_labeled[split:],
        y_val=y_labeled[split:],
        max_epochs=max_epochs,
    )
    return {
        "model": model,
        "summary": summary,
        "dataset": {
            "samples": int(X_labeled.shape[0]),
            "train_samples": int(split),
            "validation_samples": int(X_labeled.shape[0] - split),
            "deadband_bps": dataset["deadband_bps"],
            "feature_names": dataset["feature_names"],
        },
    }


def walk_forward_probabilities(
    bars: Sequence[Mapping[str, Any]],
    config: Optional[Mapping[str, Any]] = None,
    *,
    n_folds: int = 4,
    min_train_samples: int = 400,
    deadband_bps: float = DEFAULT_DEADBAND_BPS,
    seed: int = DEFAULT_SEED,
    max_epochs: int = 120,
) -> Dict[str, Any]:
    """Produce strictly out-of-sample P(up) per bar via expanding-window folds.

    Bars inside the first training window receive ``None`` — there is no
    honest prediction for them.  The returned list aligns 1:1 with ``bars``
    and can be passed straight into ``crypto_engine.backtest(ml_series=...)``.
    """

    if n_folds < 2:
        raise CryptoMlError("walk-forward needs at least 2 folds")
    dataset = build_dataset(bars, config, deadband_bps=deadband_bps)
    X, y, row_indices = dataset["X"], dataset["y"], dataset["row_indices"]
    n_samples = X.shape[0]
    if n_samples < min_train_samples + 100:
        raise CryptoMlError(
            f"need at least {min_train_samples + 100} feature rows for walk-forward, have {n_samples}"
        )

    probs: List[Optional[float]] = [None] * dataset["n_rows"]
    fold_metrics: List[Dict[str, Any]] = []
    fold_edges = np.linspace(min_train_samples, n_samples, n_folds + 1, dtype=int)
    for fold in range(n_folds):
        train_end = int(fold_edges[fold])
        test_end = int(fold_edges[fold + 1])
        if test_end <= train_end:
            continue
        train_labeled = ~np.isnan(y[:train_end])
        X_train = X[:train_end][train_labeled]
        y_train = y[:train_end][train_labeled]
        if X_train.shape[0] < 120:
            continue
        val_split = int(X_train.shape[0] * 0.85)
        model = MlpModel(X.shape[1], seed=seed + fold)
        model.fit(
            X_train[:val_split],
            y_train[:val_split],
            X_val=X_train[val_split:],
            y_val=y_train[val_split:],
            max_epochs=max_epochs,
        )
        X_test = X[train_end:test_end]
        test_probs = model.predict_proba(X_test)
        for offset, prob in enumerate(test_probs):
            probs[row_indices[train_end + offset]] = float(prob)
        test_labeled = ~np.isnan(y[train_end:test_end])
        if test_labeled.sum() >= 10:
            y_test = y[train_end:test_end][test_labeled]
            p_test = test_probs[test_labeled]
            fold_metrics.append(
                {
                    "fold": fold + 1,
                    "train_samples": int(X_train.shape[0]),
                    "test_samples": int(test_labeled.sum()),
                    "accuracy": round(float(((p_test > 0.5) == (y_test > 0.5)).mean()), 6),
                    "auc": round(_auc(y_test, p_test), 6),
                }
            )

    covered = sum(1 for value in probs if value is not None)
    return {
        "probabilities": probs,
        "fold_metrics": fold_metrics,
        "coverage": round(covered / max(1, dataset["n_rows"]), 4),
        "oos_auc": (
            round(float(np.mean([fold["auc"] for fold in fold_metrics])), 6)
            if fold_metrics
            else None
        ),
        "deadband_bps": dataset["deadband_bps"],
    }


def latest_probability(
    bars: Sequence[Mapping[str, Any]],
    model: MlpModel,
    config: Optional[Mapping[str, Any]] = None,
) -> Optional[Dict[str, Any]]:
    """Probability that the *next* bar closes up, from the latest completed bar."""

    dataset = build_dataset(bars, config)
    X, row_indices = dataset["X"], dataset["row_indices"]
    if not row_indices or row_indices[-1] != dataset["n_rows"] - 1:
        return None
    probability = float(model.predict_proba(X[-1:].reshape(1, -1))[0])
    return {
        "probability_up": probability,
        "model_version": f"{MODEL_FAMILY}/{MODEL_VERSION}",
        "trained_at": model.trained_at,
        "validation_auc": model.metrics.get("val_auc"),
    }


__all__ = [
    "MODEL_FAMILY",
    "MODEL_VERSION",
    "FEATURE_VERSION",
    "FEATURE_NAMES",
    "CryptoMlError",
    "MlpModel",
    "build_dataset",
    "train_direction_model",
    "walk_forward_probabilities",
    "latest_probability",
]
