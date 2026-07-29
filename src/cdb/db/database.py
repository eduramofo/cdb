import sqlite3
from pathlib import Path

DB_DIR = Path(__file__).resolve().parent.parent.parent.parent / "artifacts"
DB_PATH = DB_DIR / "challenge.db"


def get_connection() -> sqlite3.Connection:
    DB_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
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
