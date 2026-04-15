import io
import json
import os
import re
import statistics
import zipfile
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import redis
import requests
from fastapi import Cookie, FastAPI, HTTPException
from fastapi.responses import FileResponse
from openpyxl import Workbook

app = FastAPI(title="analytics-service")

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
TICKETS_SERVICE_URL = os.getenv("TICKETS_SERVICE_URL", "http://127.0.0.1:3003")
EXPORT_DIR = Path(os.getenv("EXPORT_DIR", "/opt/thinkq/exports"))
EXPORT_DIR.mkdir(parents=True, exist_ok=True)


def read_secret(path_env: str, fallback_env: str, default: str) -> str:
    path = os.getenv(path_env)
    if path and os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as fh:
            return fh.read().strip()
    return os.getenv(fallback_env, default)


INTERNAL_API_KEY = read_secret("INTERNAL_API_KEY_FILE", "INTERNAL_API_KEY", "")
redis_client = redis.from_url(REDIS_URL, decode_responses=True)


HEADERS = [
    "Student-name",
    "Topic",
    "Status",
    "Rating",
    "Claim name",
    "Comments",
    "Date",
    "Signin",
    "Claimed at",
    "Completed at",
    "Wait time (seconds)",
    "Completion time (seconds)",
]


WAIT_BANDS = [
    ("Under 5 min", 0, 300),
    ("5-15 min", 300, 900),
    ("15-30 min", 900, 1800),
    ("30-60 min", 1800, 3600),
    ("Over 60 min", 3600, None),
]

RESOLUTION_BANDS = [
    ("Under 10 min", 0, 600),
    ("10-20 min", 600, 1200),
    ("20-40 min", 1200, 2400),
    ("40-60 min", 2400, 3600),
    ("Over 60 min", 3600, None),
]


def require_admin_session(sid: str | None) -> dict[str, Any]:
    if not sid:
        raise HTTPException(status_code=401, detail="Missing session cookie")

    raw = redis_client.get(f"session:{sid}")
    if not raw:
        raise HTTPException(status_code=401, detail="Session expired or missing")

    session = json.loads(raw)
    user = session.get("user") or {}
    if user.get("role") != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    return session


def fetch_report() -> list[dict[str, Any]]:
    response = requests.get(
        f"{TICKETS_SERVICE_URL}/tickets/internal/report",
        headers={"x-internal-api-key": INTERNAL_API_KEY},
        timeout=30,
    )
    if not response.ok:
        raise HTTPException(status_code=502, detail=f"Report fetch failed: {response.status_code}")
    return response.json()


def purge_tickets(ticket_ids: list[int]) -> dict[str, Any]:
    response = requests.post(
        f"{TICKETS_SERVICE_URL}/tickets/internal/purge",
        headers={"x-internal-api-key": INTERNAL_API_KEY, "Content-Type": "application/json"},
        json={"ticketIds": ticket_ids},
        timeout=30,
    )
    if not response.ok:
        raise HTTPException(status_code=502, detail=f"Ticket purge failed: {response.status_code}")
    return response.json()


def safe_name(value: str | None) -> str:
    base = value or "unknown-location"
    base = re.sub(r"[^A-Za-z0-9._-]+", "-", base.strip())
    base = re.sub(r"-+", "-", base).strip("-._")
    return base or "unknown-location"


def row_to_excel_values(row: dict[str, Any]) -> list[Any]:
    return [
        row.get("studentName"),
        row.get("topic"),
        row.get("status"),
        row.get("rating"),
        row.get("claimName"),
        row.get("comments"),
        row.get("date"),
        row.get("signIn"),
        row.get("claimedAt"),
        row.get("completedAt"),
        row.get("waitTimeSeconds"),
        row.get("completionTimeSeconds"),
    ]


def create_workbook_bytes(rows: list[dict[str, Any]], location_name: str) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "tickets"
    ws.append(["Location", location_name])
    ws.append(HEADERS)
    for row in rows:
        ws.append(row_to_excel_values(row))
    for column in ws.columns:
        max_len = 0
        column_letter = column[0].column_letter
        for cell in column:
            value = "" if cell.value is None else str(cell.value)
            max_len = max(max_len, len(value))
        ws.column_dimensions[column_letter].width = min(max(max_len + 2, 12), 40)
    stream = io.BytesIO()
    wb.save(stream)
    return stream.getvalue()


def build_location_archive(rows: list[dict[str, Any]]) -> tuple[Path, list[str]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        grouped[row.get("location") or "Unknown Location"].append(row)

    now = datetime.now(timezone.utc)
    stamp = now.strftime("%Y%m%dT%H%M%SZ")
    zip_name = f"ticket-export-{stamp}.zip"
    export_zip_path = EXPORT_DIR / zip_name
    created_files: list[str] = []

    with zipfile.ZipFile(export_zip_path, "w", compression=zipfile.ZIP_DEFLATED) as export_zip:
        for location_name, location_rows in grouped.items():
            file_name = f"tickets-{safe_name(location_name)}-{stamp}.xlsx"
            workbook_bytes = create_workbook_bytes(location_rows, location_name)
            export_zip.writestr(file_name, workbook_bytes)
            created_files.append(file_name)

    return export_zip_path, created_files


def parse_datetime(value: Any) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc)
    text = str(value)
    try:
        if text.endswith("Z"):
            text = text.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(text)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except ValueError:
        return None


def seconds_to_minutes(value: float | int | None) -> float | None:
    if value is None:
        return None
    return round(float(value) / 60.0, 1)


def average(values: list[float | int]) -> float | None:
    if not values:
        return None
    return round(float(sum(values)) / float(len(values)), 1)


def median(values: list[float | int]) -> float | None:
    if not values:
        return None
    return round(float(statistics.median(values)), 1)


def limit_sorted_counter(items: Counter, key_name: str, value_name: str, limit: int = 8) -> list[dict[str, Any]]:
    result = []
    for name, count in items.most_common(limit):
        result.append({key_name: name, value_name: count})
    return result


def build_daily_volume(rows: list[dict[str, Any]], days: int = 14) -> list[dict[str, Any]]:
    today = datetime.now(timezone.utc).date()
    start_day = today - timedelta(days=days - 1)
    counts = {}
    for index in range(days):
        current_day = start_day + timedelta(days=index)
        counts[current_day.isoformat()] = {
            "date": current_day.isoformat(),
            "created": 0,
            "completed": 0,
            "rated": 0,
        }

    for row in rows:
        created_at = parse_datetime(row.get("date") or row.get("signIn"))
        completed_at = parse_datetime(row.get("completedAt"))
        if created_at and created_at.date() >= start_day:
            counts[created_at.date().isoformat()]["created"] += 1
            if row.get("rating") is not None:
                counts[created_at.date().isoformat()]["rated"] += 1
        if completed_at and completed_at.date() >= start_day:
            counts[completed_at.date().isoformat()]["completed"] += 1

    return list(counts.values())


def build_hourly_distribution(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    distribution = [{"hour": hour, "count": 0} for hour in range(24)]
    for row in rows:
        created_at = parse_datetime(row.get("date") or row.get("signIn"))
        if created_at:
            distribution[created_at.hour]["count"] += 1
    return distribution


def build_rating_distribution(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    counts = {rating: 0 for rating in range(1, 6)}
    for row in rows:
        rating = row.get("rating")
        if isinstance(rating, int) and rating in counts:
            counts[rating] += 1
    return [{"rating": rating, "count": counts[rating]} for rating in range(1, 6)]


def build_bands(values: list[int | float], bands: list[tuple[str, int, int | None]], key_name: str = "label") -> list[dict[str, Any]]:
    result = []
    for label, lower, upper in bands:
        count = 0
        for value in values:
            if value is None:
                continue
            if value < lower:
                continue
            if upper is not None and value >= upper:
                continue
            count += 1
        result.append({key_name: label, "count": count})
    return result


def build_location_breakdown(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[str, dict[str, Any]] = {}
    for row in rows:
        location = row.get("location") or "Unknown Location"
        entry = grouped.setdefault(location, {
            "location": location,
            "ticketCount": 0,
            "completedCount": 0,
            "ratedCount": 0,
            "averageRating": None,
            "averageWaitMinutes": None,
            "averageCompletionMinutes": None,
            "_ratings": [],
            "_waits": [],
            "_durations": [],
        })
        entry["ticketCount"] += 1
        if row.get("status") == "COMPLETED":
            entry["completedCount"] += 1
        if isinstance(row.get("rating"), int):
            entry["ratedCount"] += 1
            entry["_ratings"].append(row["rating"])
        if row.get("waitTimeSeconds") is not None:
            entry["_waits"].append(row["waitTimeSeconds"])
        if row.get("completionTimeSeconds") is not None:
            entry["_durations"].append(row["completionTimeSeconds"])

    results = []
    for entry in grouped.values():
        entry["averageRating"] = average(entry.pop("_ratings"))
        entry["averageWaitMinutes"] = seconds_to_minutes(average(entry.pop("_waits")))
        entry["averageCompletionMinutes"] = seconds_to_minutes(average(entry.pop("_durations")))
        results.append(entry)

    results.sort(key=lambda item: (-item["ticketCount"], item["location"]))
    return results[:10]


def build_teacher_breakdown(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[str, dict[str, Any]] = {}
    for row in rows:
        teacher = row.get("claimName") or "Unclaimed"
        entry = grouped.setdefault(teacher, {
            "teacher": teacher,
            "handledCount": 0,
            "completedCount": 0,
            "ratedCount": 0,
            "averageRating": None,
            "averageWaitMinutes": None,
            "averageCompletionMinutes": None,
            "_ratings": [],
            "_waits": [],
            "_durations": [],
        })
        entry["handledCount"] += 1
        if row.get("status") == "COMPLETED":
            entry["completedCount"] += 1
        if isinstance(row.get("rating"), int):
            entry["ratedCount"] += 1
            entry["_ratings"].append(row["rating"])
        if row.get("waitTimeSeconds") is not None:
            entry["_waits"].append(row["waitTimeSeconds"])
        if row.get("completionTimeSeconds") is not None:
            entry["_durations"].append(row["completionTimeSeconds"])

    results = []
    for entry in grouped.values():
        if entry["teacher"] == "Unclaimed":
            continue
        entry["averageRating"] = average(entry.pop("_ratings"))
        entry["averageWaitMinutes"] = seconds_to_minutes(average(entry.pop("_waits")))
        entry["averageCompletionMinutes"] = seconds_to_minutes(average(entry.pop("_durations")))
        results.append(entry)

    results.sort(key=lambda item: (-item["handledCount"], item["teacher"]))
    return results[:10]


def build_recent_feedback(rows: list[dict[str, Any]], limit: int = 12) -> list[dict[str, Any]]:
    feedback_rows = []
    for row in rows:
        if row.get("rating") is None and not row.get("comments"):
            continue
        feedback_rows.append({
            "ticketId": row.get("ticketId"),
            "studentName": row.get("studentName"),
            "topic": row.get("topic"),
            "location": row.get("location"),
            "claimName": row.get("claimName"),
            "rating": row.get("rating"),
            "comments": row.get("comments"),
            "completedAt": row.get("completedAt"),
        })

    feedback_rows.sort(key=lambda item: parse_datetime(item.get("completedAt")) or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    return feedback_rows[:limit]


def build_attention_rows(rows: list[dict[str, Any]], limit: int = 8) -> list[dict[str, Any]]:
    flagged = []
    for row in rows:
        wait_seconds = row.get("waitTimeSeconds") or 0
        completion_seconds = row.get("completionTimeSeconds") or 0
        rating = row.get("rating")
        status = row.get("status") or "UNKNOWN"
        claim_name = row.get("claimName") or "Unassigned"
        reasons = []
        priority = 0

        if status != "COMPLETED" and wait_seconds >= 900:
            reasons.append("long queue")
            priority += 5
        if claim_name == "Unassigned":
            reasons.append("unassigned")
            priority += 4
        if status == "COMPLETED" and completion_seconds >= 2400:
            reasons.append("slow resolution")
            priority += 3
        if isinstance(rating, int) and rating <= 2:
            reasons.append("low rating")
            priority += 6
        if not reasons:
            continue

        flagged.append({
            "ticketId": row.get("ticketId"),
            "studentName": row.get("studentName"),
            "topic": row.get("topic"),
            "location": row.get("location"),
            "status": status,
            "claimName": claim_name,
            "waitMinutes": seconds_to_minutes(wait_seconds),
            "completionMinutes": seconds_to_minutes(completion_seconds),
            "rating": rating,
            "reasons": reasons,
            "_priority": priority,
            "_timestamp": parse_datetime(row.get("completedAt") or row.get("claimedAt") or row.get("date") or row.get("signIn")) or datetime.min.replace(tzinfo=timezone.utc),
        })

    flagged.sort(key=lambda item: (-item["_priority"], -(item["waitMinutes"] or 0), item["_timestamp"]), reverse=False)
    for item in flagged:
        item.pop("_priority", None)
        item.pop("_timestamp", None)
    return flagged[:limit]


def build_dashboard(rows: list[dict[str, Any]], requested_by: str | None) -> dict[str, Any]:
    total_count = len(rows)
    completed_rows = [row for row in rows if row.get("status") == "COMPLETED"]
    active_rows = [row for row in rows if row.get("status") != "COMPLETED"]
    rated_rows = [row for row in rows if isinstance(row.get("rating"), int)]
    commented_rows = [row for row in rows if row.get("comments")]
    unclaimed_rows = [row for row in rows if not row.get("claimName")]
    low_rated_rows = [row for row in rated_rows if row.get("rating") <= 2]
    wait_values = [row.get("waitTimeSeconds") for row in rows if row.get("waitTimeSeconds") is not None]
    completion_values = [row.get("completionTimeSeconds") for row in rows if row.get("completionTimeSeconds") is not None]
    status_counts = Counter((row.get("status") or "UNKNOWN") for row in rows)
    topic_counts = Counter((row.get("topic") or "Unknown") for row in rows)
    long_wait_count = sum(1 for value in wait_values if value >= 900)

    daily_volume = build_daily_volume(rows, days=14)
    current_period_count = sum(item["created"] for item in daily_volume[-7:])
    previous_period_count = sum(item["created"] for item in daily_volume[:-7])
    delta_percentage = None
    if previous_period_count > 0:
        delta_percentage = round(((current_period_count - previous_period_count) / previous_period_count) * 100.0, 1)
    elif current_period_count > 0:
        delta_percentage = 100.0

    return {
        "requestedBy": requested_by,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "totalTickets": total_count,
            "completedTickets": len(completed_rows),
            "activeTickets": len(active_rows),
            "unclaimedTickets": len(unclaimed_rows),
            "ratedTickets": len(rated_rows),
            "commentedTickets": len(commented_rows),
            "lowRatedTickets": len(low_rated_rows),
            "longWaitTickets": long_wait_count,
            "completionRate": round((len(completed_rows) / total_count) * 100.0, 1) if total_count else 0.0,
            "ratingCoverage": round((len(rated_rows) / total_count) * 100.0, 1) if total_count else 0.0,
            "commentCoverage": round((len(commented_rows) / total_count) * 100.0, 1) if total_count else 0.0,
            "averageRating": average([row["rating"] for row in rated_rows]),
            "averageWaitMinutes": seconds_to_minutes(average(wait_values)),
            "medianWaitMinutes": seconds_to_minutes(median(wait_values)),
            "averageCompletionMinutes": seconds_to_minutes(average(completion_values)),
            "medianCompletionMinutes": seconds_to_minutes(median(completion_values)),
            "current7DayCreatedCount": current_period_count,
            "previous7DayCreatedCount": previous_period_count,
            "ticketTrendDeltaPercent": delta_percentage,
        },
        "statusBreakdown": [{"status": key, "count": value} for key, value in sorted(status_counts.items())],
        "ratingDistribution": build_rating_distribution(rows),
        "dailyVolume": daily_volume,
        "hourlyDistribution": build_hourly_distribution(rows),
        "waitTimeBands": build_bands(wait_values, WAIT_BANDS),
        "resolutionTimeBands": build_bands(completion_values, RESOLUTION_BANDS),
        "topTopics": limit_sorted_counter(topic_counts, "topic", "count", limit=8),
        "locationBreakdown": build_location_breakdown(rows),
        "teacherBreakdown": build_teacher_breakdown(rows),
        "recentFeedback": build_recent_feedback(rows),
        "attentionTickets": build_attention_rows(rows),
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "analytics-service"}


@app.get("/analytics/tickets")
def ticket_analytics(sid: str | None = Cookie(default=None)) -> dict[str, Any]:
    session = require_admin_session(sid)
    rows = fetch_report()
    return {
        "requestedBy": session.get("user", {}).get("email"),
        "count": len(rows),
        "rows": rows,
        "columns": [
            "ticketId",
            "location",
            "studentName",
            "topic",
            "status",
            "rating",
            "claimName",
            "comments",
            "date",
            "signIn",
            "claimedAt",
            "completedAt",
            "waitTimeSeconds",
            "completionTimeSeconds",
        ],
    }


@app.get("/analytics/tickets/dashboard")
def ticket_dashboard(sid: str | None = Cookie(default=None)) -> dict[str, Any]:
    session = require_admin_session(sid)
    rows = fetch_report()
    return build_dashboard(rows, session.get("user", {}).get("email"))


@app.post("/analytics/tickets/export")
def export_tickets_by_location(sid: str | None = Cookie(default=None)) -> FileResponse:
    session = require_admin_session(sid)
    rows = fetch_report()
    if not rows:
        raise HTTPException(status_code=404, detail="No tickets available for export")

    export_zip_path, created_files = build_location_archive(rows)
    purge_result = purge_tickets([int(row["ticketId"]) for row in rows if row.get("ticketId") is not None])

    return FileResponse(
        path=str(export_zip_path),
        media_type="application/zip",
        filename=export_zip_path.name,
        headers={
            "x-exported-by": session.get("user", {}).get("email", "unknown"),
            "x-exported-file-count": str(len(created_files)),
            "x-deleted-ticket-count": str(purge_result.get("deletedCount", 0)),
        },
    )
