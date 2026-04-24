from typing import Any

from app.core.config import get_settings

try:
    from supabase import Client, create_client
except Exception:  # pragma: no cover
    Client = Any  # type: ignore[misc,assignment]
    create_client = None


def get_supabase_client() -> Client | None:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        return None
    if create_client is None:
        return None
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def get_supabase_auth_client() -> Client | None:
    settings = get_settings()
    if not settings.supabase_url:
        return None
    if create_client is None:
        return None

    # Prefer anon key for regular auth flows; fall back to service role for development.
    auth_key = settings.supabase_anon_key or settings.supabase_service_role_key
    if not auth_key:
        return None

    return create_client(settings.supabase_url, auth_key)
