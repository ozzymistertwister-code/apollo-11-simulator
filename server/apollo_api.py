"""Public Apollo flight summaries backed by a separate SQLite database."""
from datetime import datetime, timezone
import math
import os
import re
import sqlite3
import uuid
import json
from typing import Literal

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field, field_validator

DB_PATH = os.getenv("APOLLO_FLIGHTS_DB", "/var/lib/apollo-11-simulator/flights.sqlite3")
CALLSIGN = re.compile(r"^[\w](?:[\w -]{0,22}[\w])?$", re.UNICODE)
GRADE = Literal["A+", "A", "B", "C", "F", "D", "N/A"]
router = APIRouter(prefix="/apollo/api", tags=["apollo"])


class FlightSubmission(BaseModel):
    model_config = ConfigDict(extra="forbid")
    pilotName: str = Field(min_length=2, max_length=24)
    publicConsent: bool
    recordId: str = Field(min_length=8, max_length=128)
    simulatorVersion: str = Field(min_length=1, max_length=16)
    mode: Literal["classic", "engineering"]
    scenarioId: str | None = Field(default=None, max_length=64)
    terrainSeed: int | None = None
    difficulty: Literal["easy", "normal", "hard"] | None = None
    outcome: Literal["success", "hard", "crash"]
    safetyGrade: GRADE
    efficiencyGrade: GRADE
    precisionGrade: GRADE
    touchdownVerticalSpeed: float | None = Field(default=None, ge=-100, le=100)
    touchdownHorizontalSpeed: float | None = Field(default=None, ge=-100, le=100)
    touchdownAngle: float | None = Field(default=None, ge=-180, le=180)
    fuelUsed: float | None = Field(default=None, ge=0, le=1_000_000)
    flightTime: float = Field(ge=0, le=3_600)
    telemetryRef: str = Field(min_length=8, max_length=160)
    telemetryHash: str = Field(min_length=8, max_length=128)
    flightRecord: dict | None = None

    @field_validator("pilotName")
    @classmethod
    def validate_pilot_name(cls, value: str) -> str:
        value = " ".join(value.strip().split())
        if not 2 <= len(value) <= 24 or not CALLSIGN.fullmatch(value):
            raise ValueError("invalid callsign")
        return value

    @field_validator("telemetryHash")
    @classmethod
    def validate_hash(cls, value: str) -> str:
        if value != "unavailable" and not re.fullmatch(r"[0-9a-fA-F]{64}", value):
            raise ValueError("invalid telemetry hash")
        return value.lower()

    @field_validator("telemetryRef")
    @classmethod
    def validate_ref(cls, value: str) -> str:
        if not value.startswith("flight-record:"):
            raise ValueError("invalid telemetry reference")
        return value

    @field_validator("touchdownVerticalSpeed", "touchdownHorizontalSpeed", "touchdownAngle", "fuelUsed", "flightTime")
    @classmethod
    def validate_finite(cls, value: float | None) -> float | None:
        if value is not None and not math.isfinite(value):
            raise ValueError("value must be finite")
        return value


def _connect() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    connection = sqlite3.connect(DB_PATH, timeout=5)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA journal_mode=WAL")
    connection.execute("PRAGMA busy_timeout=5000")
    connection.execute("""CREATE TABLE IF NOT EXISTS flights (
        id TEXT PRIMARY KEY, record_id TEXT NOT NULL UNIQUE, pilot_name TEXT NOT NULL,
        created_at TEXT NOT NULL, simulator_version TEXT NOT NULL, mode TEXT NOT NULL,
        scenario_id TEXT, terrain_seed INTEGER, outcome TEXT NOT NULL,
        safety_grade TEXT NOT NULL, efficiency_grade TEXT NOT NULL, precision_grade TEXT NOT NULL,
        touchdown_vertical_speed REAL, touchdown_horizontal_speed REAL, touchdown_angle REAL,
        fuel_used REAL, flight_time REAL NOT NULL, telemetry_ref TEXT NOT NULL,
        telemetry_hash TEXT NOT NULL, verified INTEGER NOT NULL DEFAULT 0,
        difficulty TEXT, target_distance REAL, terrain_slope REAL,
        module_condition TEXT, initial_fuel REAL, remaining_fuel REAL,
        record_json TEXT)""")
    columns = {row[1] for row in connection.execute("PRAGMA table_info(flights)").fetchall()}
    for name, definition in {
        "difficulty": "TEXT", "target_distance": "REAL", "terrain_slope": "REAL",
        "module_condition": "TEXT", "initial_fuel": "REAL", "remaining_fuel": "REAL",
        "record_json": "TEXT",
    }.items():
        if name not in columns:
            connection.execute(f"ALTER TABLE flights ADD COLUMN {name} {definition}")
    connection.commit()
    return connection


def _public(row: sqlite3.Row) -> dict:
    return {"id": row["id"], "pilotName": row["pilot_name"], "createdAt": row["created_at"],
            "simulatorVersion": row["simulator_version"], "mode": row["mode"],
            "scenarioId": row["scenario_id"], "terrainSeed": row["terrain_seed"],
            "outcome": row["outcome"], "safetyGrade": row["safety_grade"],
            "efficiencyGrade": row["efficiency_grade"], "precisionGrade": row["precision_grade"],
            "touchdownVerticalSpeed": row["touchdown_vertical_speed"],
            "touchdownHorizontalSpeed": row["touchdown_horizontal_speed"],
            "touchdownAngle": row["touchdown_angle"], "fuelUsed": row["fuel_used"],
            "flightTime": row["flight_time"], "telemetryRef": row["telemetry_ref"],
            "difficulty": row["difficulty"], "targetDistance": row["target_distance"],
            "terrainSlope": row["terrain_slope"], "moduleCondition": row["module_condition"],
            "initialFuel": row["initial_fuel"], "remainingFuel": row["remaining_fuel"],
            "verified": bool(row["verified"])}


@router.post("/flights", status_code=status.HTTP_201_CREATED)
def submit_flight(payload: FlightSubmission):
    if not payload.publicConsent:
        raise HTTPException(status_code=400, detail="Public consent is required")
    record_json = None
    if payload.flightRecord is not None:
        if payload.flightRecord.get("recordVersion") != 1 or payload.flightRecord.get("id") != payload.recordId or not isinstance(payload.flightRecord.get("telemetry"), list):
            raise HTTPException(status_code=400, detail="Incompatible FlightRecord")
        record_json = json.dumps(payload.flightRecord, separators=(",", ":"), ensure_ascii=False)
        if len(record_json.encode("utf-8")) > 512 * 1024:
            raise HTTPException(status_code=413, detail="FlightRecord is too large")
    connection = _connect()
    try:
        existing = connection.execute("SELECT * FROM flights WHERE record_id = ?", (payload.recordId,)).fetchone()
        if existing:
            return {"id": existing["id"], "verified": bool(existing["verified"]), "duplicate": True}
        server_id = str(uuid.uuid4())
        connection.execute("""INSERT INTO flights
            (id, record_id, pilot_name, created_at, simulator_version, mode, scenario_id, terrain_seed,
            outcome, safety_grade, efficiency_grade, precision_grade, touchdown_vertical_speed,
             touchdown_horizontal_speed, touchdown_angle, fuel_used, flight_time, telemetry_ref,
             telemetry_hash, verified, difficulty, target_distance, terrain_slope, module_condition,
             initial_fuel, remaining_fuel, record_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)""",
            (server_id, payload.recordId, payload.pilotName, datetime.now(timezone.utc).isoformat(),
             payload.simulatorVersion, payload.mode, payload.scenarioId, payload.terrainSeed,
             payload.outcome, payload.safetyGrade, payload.efficiencyGrade, payload.precisionGrade,
             payload.touchdownVerticalSpeed, payload.touchdownHorizontalSpeed, payload.touchdownAngle,
             payload.fuelUsed, payload.flightTime, payload.telemetryRef, payload.telemetryHash,
             payload.difficulty,
             ((payload.flightRecord.get("report") or {}).get("precision") or {}).get("distance") if payload.flightRecord else None,
             math.degrees(((payload.flightRecord.get("report") or {}).get("assessment") or {}).get("slope")) if payload.flightRecord and ((payload.flightRecord.get("report") or {}).get("assessment") or {}).get("slope") is not None else None,
             ((payload.flightRecord.get("report") or {}).get("assessment") or {}).get("condition") if payload.flightRecord else None,
             (payload.flightRecord.get("initialParameters") or {}).get("initialFuel") if payload.flightRecord else None,
             ((payload.flightRecord.get("report") or {}).get("touchdown") or {}).get("fuel") if payload.flightRecord else None,
             record_json))
        connection.commit()
        return {"id": server_id, "verified": False, "duplicate": False}
    finally:
        connection.close()


@router.get("/leaderboard")
def leaderboard(include_pending: bool = Query(default=False), mode: Literal["classic", "engineering"] | None = None, scenarioId: str | None = Query(default=None, max_length=64), difficulty: Literal["easy", "normal", "hard"] | None = None):
    connection = _connect()
    try:
        clauses = ["verified = 1", "outcome = 'success'"]
        params: list[object] = []
        if mode: clauses.append("mode = ?"); params.append(mode)
        if scenarioId: clauses.append("scenario_id = ?"); params.append(scenarioId)
        if difficulty: clauses.append("difficulty = ?"); params.append(difficulty)
        where = " AND ".join(clauses)
        order = "CASE safety_grade WHEN 'A+' THEN 0 WHEN 'A' THEN 1 WHEN 'B' THEN 2 WHEN 'C' THEN 3 ELSE 4 END, CASE precision_grade WHEN 'A+' THEN 0 WHEN 'A' THEN 1 WHEN 'B' THEN 2 WHEN 'C' THEN 3 ELSE 4 END, CASE efficiency_grade WHEN 'A+' THEN 0 WHEN 'A' THEN 1 WHEN 'B' THEN 2 WHEN 'C' THEN 3 ELSE 4 END, COALESCE(ABS(touchdown_vertical_speed) + ABS(touchdown_horizontal_speed), 1e9), created_at ASC"
        verified = connection.execute(f"SELECT * FROM flights WHERE {where} ORDER BY {order} LIMIT 10", params).fetchall()
        pending = connection.execute("SELECT * FROM flights WHERE verified = 0 ORDER BY created_at DESC LIMIT 20").fetchall() if include_pending else []
        pending_count = connection.execute("SELECT COUNT(*) FROM flights WHERE verified = 0").fetchone()[0]
        return {"entries": [_public(row) for row in verified], "pending": [_public(row) for row in pending], "pendingCount": pending_count}
    finally:
        connection.close()


@router.get("/flights/{flight_id}")
def get_flight(flight_id: str):
    if not re.fullmatch(r"[0-9a-fA-F-]{36}", flight_id):
        raise HTTPException(status_code=404, detail="Flight not found")
    connection = _connect()
    try:
        row = connection.execute("SELECT * FROM flights WHERE id = ?", (flight_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Flight not found")
        result = _public(row)
        result["flightRecord"] = json.loads(row["record_json"]) if row["record_json"] else None
        return result
    finally:
        connection.close()
