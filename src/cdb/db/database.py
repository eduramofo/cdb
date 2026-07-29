import json
import sqlite3
from pathlib import Path

DB_DIR = Path(__file__).resolve().parent.parent.parent.parent / "artifacts"
DB_PATH = DB_DIR / "challenge.db"
HN_DB_PATH = DB_DIR / "hn_data.db"


def get_connection() -> sqlite3.Connection:
    DB_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def get_hn_connection() -> sqlite3.Connection:
    DB_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(HN_DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    conn = get_connection()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS challenge_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            first_name TEXT,
            last_name TEXT,
            company_name TEXT,
            role_in_company TEXT,
            address TEXT,
            email TEXT,
            phone_number TEXT,
            raw_json TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

    conn = get_hn_connection()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS hn_items (
            id          INTEGER PRIMARY KEY,
            type        TEXT,
            by          TEXT,
            time        INTEGER,
            title       TEXT,
            url         TEXT,
            text        TEXT,
            score       INTEGER,
            descendants INTEGER,
            parent      INTEGER,
            kids        TEXT,
            raw_json    TEXT NOT NULL,
            fetched_at  TEXT DEFAULT (datetime('now')),
            updated_at  TEXT DEFAULT (datetime('now'))
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS watermark (
            key   TEXT PRIMARY KEY,
            value TEXT
        )
    """)
    conn.commit()
    conn.close()


def insert_records(records: list[dict[str, str]]) -> int:
    import json

    conn = get_connection()
    inserted = 0
    for record in records:
        values = {
            "first_name": record.get("First Name", ""),
            "last_name": record.get("Last Name", ""),
            "company_name": record.get("Company Name", ""),
            "role_in_company": record.get("Role in Company", ""),
            "address": record.get("Address", ""),
            "email": record.get("Email", ""),
            "phone_number": record.get("Phone Number", ""),
        }
        conn.execute(
            """
            INSERT INTO challenge_records
                (first_name, last_name, company_name, role_in_company, address, email, phone_number, raw_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                values["first_name"],
                values["last_name"],
                values["company_name"],
                values["role_in_company"],
                values["address"],
                values["email"],
                values["phone_number"],
                json.dumps(record, ensure_ascii=False),
            ),
        )
        inserted += 1

    conn.commit()
    conn.close()
    return inserted


def get_all_records() -> list[dict]:
    conn = get_connection()
    rows = conn.execute("SELECT * FROM challenge_records ORDER BY id").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_record_count() -> int:
    conn = get_connection()
    row = conn.execute("SELECT COUNT(*) as cnt FROM challenge_records").fetchone()
    conn.close()
    return row["cnt"]


def clear_records() -> None:
    conn = get_connection()
    conn.execute("DELETE FROM challenge_records")
    conn.commit()
    conn.close()


# ── Hacker News ─────────────────────────────────────────────────────────


def upsert_hn_items(items: list[dict]) -> tuple[int, int]:
    inserted = 0
    updated = 0
    conn = get_hn_connection()

    for item in items:
        kids_json = json.dumps(item.get("kids")) if item.get("kids") else None
        raw_json = json.dumps(item, ensure_ascii=False)
        now = __import__("datetime").datetime.now().isoformat()

        existing = conn.execute(
            "SELECT id FROM hn_items WHERE id = ?", (item["id"],)
        ).fetchone()

        if existing:
            conn.execute(
                """
                UPDATE hn_items SET
                    type = ?, by = ?, time = ?, title = ?, url = ?,
                    text = ?, score = ?, descendants = ?, parent = ?,
                    kids = ?, raw_json = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    item.get("type"),
                    item.get("by"),
                    item.get("time"),
                    item.get("title"),
                    item.get("url"),
                    item.get("text"),
                    item.get("score"),
                    item.get("descendants"),
                    item.get("parent"),
                    kids_json,
                    raw_json,
                    now,
                    item["id"],
                ),
            )
            updated += 1
        else:
            conn.execute(
                """
                INSERT INTO hn_items
                    (id, type, by, time, title, url, text, score,
                     descendants, parent, kids, raw_json, fetched_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    item["id"],
                    item.get("type"),
                    item.get("by"),
                    item.get("time"),
                    item.get("title"),
                    item.get("url"),
                    item.get("text"),
                    item.get("score"),
                    item.get("descendants"),
                    item.get("parent"),
                    kids_json,
                    raw_json,
                    now,
                    now,
                ),
            )
            inserted += 1

    conn.commit()
    conn.close()
    return inserted, updated


def get_hn_items(limit: int = 100, offset: int = 0) -> list[dict]:
    conn = get_hn_connection()
    rows = conn.execute(
        "SELECT * FROM hn_items ORDER BY id DESC LIMIT ? OFFSET ?",
        (limit, offset),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_hn_item_count() -> int:
    conn = get_hn_connection()
    row = conn.execute("SELECT COUNT(*) as cnt FROM hn_items").fetchone()
    conn.close()
    return row["cnt"]


def get_hn_items_by_type() -> dict[str, int]:
    conn = get_hn_connection()
    rows = conn.execute(
        "SELECT type, COUNT(*) as cnt FROM hn_items GROUP BY type"
    ).fetchall()
    conn.close()
    return {r["type"]: r["cnt"] for r in rows}


def get_watermark(key: str) -> str | None:
    conn = get_hn_connection()
    row = conn.execute(
        "SELECT value FROM watermark WHERE key = ?", (key,)
    ).fetchone()
    conn.close()
    return row["value"] if row else None


def set_watermark(key: str, value: str) -> None:
    conn = get_hn_connection()
    conn.execute(
        "INSERT OR REPLACE INTO watermark (key, value) VALUES (?, ?)",
        (key, value),
    )
    conn.commit()
    conn.close()
