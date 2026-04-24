from copy import deepcopy
from datetime import datetime, timezone
from typing import Any, Optional

from app.db.supabase_client import get_supabase_client


class AnalysisRepository:
    def __init__(self) -> None:
        self._supabase = get_supabase_client()
        self._jobs: dict[str, dict[str, Any]] = {}
        self._users: dict[str, dict[str, Any]] = {}

    def _serialize(self, record: dict[str, Any]) -> dict[str, Any]:
        out = deepcopy(record)
        for key in ("created_at", "updated_at", "completed_at"):
            value = out.get(key)
            if isinstance(value, datetime):
                out[key] = value.isoformat()
        return out

    def _deserialize(self, record: dict[str, Any]) -> dict[str, Any]:
        out = deepcopy(record)
        for key in ("created_at", "updated_at", "completed_at"):
            value = out.get(key)
            if isinstance(value, str):
                try:
                    out[key] = datetime.fromisoformat(value)
                except ValueError:
                    out[key] = None
        return out

    def create_job(self, record: dict[str, Any]) -> dict[str, Any]:
        self._jobs[record["id"]] = deepcopy(record)

        if self._supabase:
            payload = self._serialize(record)
            try:
                self._supabase.table("analyses").insert(payload).execute()
            except Exception:
                # Keep in-memory store as resilient fallback.
                pass

        return deepcopy(record)

    def get_job(self, job_id: str) -> Optional[dict[str, Any]]:
        memory_job = self._jobs.get(job_id)
        if memory_job is not None:
            return deepcopy(memory_job)

        if self._supabase:
            try:
                response = (
                    self._supabase.table("analyses")
                    .select("*")
                    .eq("id", job_id)
                    .limit(1)
                    .execute()
                )
                rows = response.data or []
                if rows:
                    return self._deserialize(rows[0])
            except Exception:
                return None

        return None

    def update_job(self, job_id: str, patch: dict[str, Any]) -> Optional[dict[str, Any]]:
        existing = self.get_job(job_id)
        if existing is None:
            return None

        merged = {**existing, **patch}
        merged["updated_at"] = merged.get("updated_at") or datetime.now(timezone.utc)
        self._jobs[job_id] = deepcopy(merged)

        if self._supabase:
            try:
                self._supabase.table("analyses").update(self._serialize(patch)).eq("id", job_id).execute()
            except Exception:
                pass

        return deepcopy(merged)

    def cancel_job(self, job_id: str) -> bool:
        updated = self.update_job(
            job_id,
            {
                "status": "CANCELLED",
                "current_step": "Cancelled by user",
                "updated_at": datetime.now(timezone.utc),
                "completed_at": datetime.now(timezone.utc),
            },
        )
        return updated is not None

    def delete_job(self, job_id: str) -> bool:
        existed = job_id in self._jobs
        self._jobs.pop(job_id, None)

        if self._supabase:
            try:
                self._supabase.table("analyses").delete().eq("id", job_id).execute()
                return True
            except Exception:
                return existed

        return existed

    def list_jobs(self, user_id: str, page: int = 1, per_page: int = 10) -> tuple[list[dict[str, Any]], int]:
        if self._supabase:
            try:
                start = (page - 1) * per_page
                end = start + per_page - 1
                response = (
                    self._supabase.table("analyses")
                    .select("*", count="exact")
                    .eq("user_id", user_id)
                    .order("created_at", desc=True)
                    .range(start, end)
                    .execute()
                )
                rows = [self._deserialize(row) for row in (response.data or [])]
                total = response.count or 0
                return rows, total
            except Exception:
                pass

        rows = [job for job in self._jobs.values() if job.get("user_id") == user_id]
        rows.sort(key=lambda item: item.get("created_at"), reverse=True)
        total = len(rows)
        start = (page - 1) * per_page
        end = start + per_page
        return deepcopy(rows[start:end]), total

    def get_or_create_user(self, user_id: str, fallback_email: str, fallback_name: str, fallback_role: str) -> dict[str, Any]:
        if user_id in self._users:
            return deepcopy(self._users[user_id])

        if self._supabase:
            try:
                response = self._supabase.table("users").select("*").eq("id", user_id).limit(1).execute()
                rows = response.data or []
                if rows:
                    record = rows[0]
                    self._users[user_id] = deepcopy(record)
                    return deepcopy(record)
            except Exception:
                pass

        now = datetime.now(timezone.utc)
        record = {
            "id": user_id,
            "email": fallback_email,
            "name": fallback_name,
            "role": fallback_role,
            "organization": None,
            "created_at": now,
        }
        self._users[user_id] = deepcopy(record)

        if self._supabase:
            try:
                self._supabase.table("users").upsert(self._serialize(record)).execute()
            except Exception:
                pass

        return deepcopy(record)

    def update_user(self, user_id: str, patch: dict[str, Any]) -> Optional[dict[str, Any]]:
        user = self._users.get(user_id)
        if user is None:
            return None

        updated = {**user, **patch}
        self._users[user_id] = deepcopy(updated)

        if self._supabase:
            try:
                self._supabase.table("users").update(self._serialize(patch)).eq("id", user_id).execute()
            except Exception:
                pass

        return deepcopy(updated)
