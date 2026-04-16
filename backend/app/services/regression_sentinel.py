"""
Regression Sentinel — Phase 2 Prophet-style anomaly detection.

Scope: detect when a compliance metric suddenly regresses relative to its
recent trajectory, and emit an alert so it appears on the Dashboard and the
Trends page BEFORE an auditor notices.

Design:
- Primary: Facebook Prophet 95% prediction interval. We use Prophet because
  it is explainable (decomposable trend + seasonality + holidays) — a
  regulated product needs methodology an auditor can accept. Reference:
  Taylor & Letham, "Forecasting at scale"
  https://facebook.github.io/prophet/
- Fallback: when Prophet is not installed or we have too few points
  (< 14 snapshots), fall back to a simple rolling mean +/- 2·stdev
  heuristic. Cheap, interpretable, never worse than nothing.
- Alerts are created in `qms_alerts` via FirestoreService.create_alert.

This module is intentionally side-effect-free except for create_alert().
A Cloud Scheduler job hits /system/sentinel/scan hourly to run it.
"""

import logging
import statistics
from typing import List, Dict, Optional

from app.services.firestore_service import FirestoreService

logger = logging.getLogger(__name__)

# Each compliance sub-metric we monitor. Keys match ComplianceService.compute_full_score()
# output (both in `scores` and `breakdown`).
TRACKED_METRICS = [
    # Aggregate scores (scores dict)
    ("scores", "ce_mark_overall"),
    ("scores", "iec62304"),
    ("scores", "iso13485"),
    ("scores", "cybersecurity"),
    # Breakdown (breakdown dict)
    ("breakdown", "test_coverage"),
    ("breakdown", "auth_coverage"),
    ("breakdown", "risk_verification"),
    ("breakdown", "doc_completeness"),
]

MIN_POINTS_FOR_PROPHET = 14  # need at least two weeks of hourly data
MIN_POINTS_FOR_HEURISTIC = 6  # need at least 6 snapshots for mean/stdev
SIGMA_THRESHOLD = 2.0          # classic 2σ ≈ 95% confidence


def _extract_series(snapshots: List[Dict], source: str, key: str) -> List[float]:
    out = []
    for s in snapshots:
        v = (s.get(source) or {}).get(key)
        if isinstance(v, (int, float)):
            out.append(float(v))
    return out


def _heuristic_anomaly(series: List[float]) -> Optional[Dict]:
    """Rolling mean ± 2σ check on the last point.

    Returns None when the series is healthy. Returns an anomaly dict when
    the latest point is more than SIGMA_THRESHOLD stdevs below the mean
    of the preceding window. We only alert on downward deviation — a
    sudden jump up in compliance score is not an incident.
    """
    if len(series) < MIN_POINTS_FOR_HEURISTIC:
        return None
    latest = series[-1]
    window = series[:-1]
    mean = statistics.fmean(window)
    stdev = statistics.pstdev(window) if len(window) > 1 else 0.0
    if stdev == 0:
        # All historical values identical; a drop of >=2 points is still worth flagging.
        if mean - latest >= 2.0:
            return {
                "expected": mean,
                "actual": latest,
                "deviation_sigma": float("inf"),
                "method": "flat_series_drop",
            }
        return None
    z = (mean - latest) / stdev  # positive z = latest is below mean
    if z >= SIGMA_THRESHOLD:
        return {
            "expected": round(mean, 2),
            "actual": round(latest, 2),
            "deviation_sigma": round(z, 2),
            "method": "rolling_mean_2sigma",
        }
    return None


def _prophet_anomaly(series: List[float]) -> Optional[Dict]:
    """Prophet-based detection. Returns None if Prophet unavailable."""
    try:
        from prophet import Prophet  # type: ignore
        import pandas as pd  # type: ignore
    except Exception:
        return None

    if len(series) < MIN_POINTS_FOR_PROPHET:
        return None

    # Build a minimal timeseries — Prophet only needs ds + y.
    df = pd.DataFrame({
        "ds": pd.date_range(end="today", periods=len(series), freq="h"),
        "y": series,
    })
    train = df.iloc[:-1]
    model = Prophet(interval_width=0.95, daily_seasonality=False, weekly_seasonality=False)
    try:
        model.fit(train)
    except Exception as e:
        logger.warning(f"Prophet fit failed: {e}")
        return None

    future = df[["ds"]].tail(1)
    forecast = model.predict(future)
    yhat_lower = forecast["yhat_lower"].iloc[0]
    yhat = forecast["yhat"].iloc[0]
    actual = series[-1]
    if actual < yhat_lower:
        return {
            "expected": round(float(yhat), 2),
            "lower_95": round(float(yhat_lower), 2),
            "actual": round(actual, 2),
            "deviation_sigma": None,
            "method": "prophet_95pi",
        }
    return None


def scan_snapshots(snapshots: List[Dict]) -> Dict:
    """Run both detectors on each tracked metric; emit alerts for anomalies.

    Returns a summary dict for logging / the /sentinel/scan endpoint.
    """
    created: List[Dict] = []
    ok: List[str] = []
    skipped: List[str] = []

    for source, key in TRACKED_METRICS:
        metric_id = f"{source}.{key}"
        series = _extract_series(snapshots, source, key)
        if not series:
            skipped.append(metric_id)
            continue

        anomaly = _prophet_anomaly(series) or _heuristic_anomaly(series)
        if anomaly is None:
            ok.append(metric_id)
            continue

        title = f"{metric_id} regression detected"
        message = (
            f"Expected ~{anomaly['expected']}%, actual {anomaly['actual']}%"
            + (f" (σ={anomaly['deviation_sigma']})" if anomaly.get('deviation_sigma') is not None else "")
            + f" — method: {anomaly['method']}"
        )
        alert = FirestoreService.create_alert(
            kind="regression",
            title=title,
            message=message,
            severity="warning",
            metric=metric_id,
            details=anomaly,
        )
        created.append({"metric": metric_id, "alert_id": alert.get("id"), **anomaly})

    return {
        "scanned": len(TRACKED_METRICS),
        "alerts_created": len(created),
        "created": created,
        "ok": ok,
        "skipped": skipped,
    }
