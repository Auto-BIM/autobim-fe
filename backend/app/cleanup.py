"""보관 기간이 지난 도면·작업·결과를 지운다 (16장). 하루 한 번 예약 작업으로 돌린다.
    python -m app.cleanup
"""
from __future__ import annotations

import shutil
import time

from .config import RETENTION_DAYS, STORAGE_DIR


def main() -> int:
    cutoff = time.time() - RETENTION_DAYS * 86400
    removed = 0
    for sub in ("uploads", "results"):
        root = STORAGE_DIR / sub
        for d in root.glob("*") if root.exists() else []:
            if d.is_dir() and d.stat().st_mtime < cutoff:
                shutil.rmtree(d, ignore_errors=True)
                removed += 1
    jobs = STORAGE_DIR / "jobs"
    for f in jobs.glob("*.json") if jobs.exists() else []:
        if f.stat().st_mtime < cutoff:
            f.unlink(missing_ok=True)
            removed += 1
    print(f"cleanup: removed {removed} item(s) older than {RETENTION_DAYS} days")
    return removed


if __name__ == "__main__":
    main()
