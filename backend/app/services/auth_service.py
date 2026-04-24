from typing import Any

from fastapi import HTTPException, status

from app.db.supabase_client import get_supabase_auth_client
from app.schemas.auth import AuthResponse


class AuthService:
    def __init__(self) -> None:
        self._client = get_supabase_auth_client()

    def _ensure_client(self) -> Any:
        if self._client is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Supabase auth is not configured",
            )
        return self._client

    def sign_in(self, email: str, password: str) -> AuthResponse:
        client = self._ensure_client()
        try:
            auth_response = client.auth.sign_in_with_password(
                {"email": email, "password": password}
            )
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid credentials: {exc}",
            ) from exc

        if not auth_response.user or not auth_response.session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
            )

        metadata = auth_response.user.user_metadata or {}
        app_metadata = auth_response.user.app_metadata or {}
        name = metadata.get("name") or auth_response.user.email.split("@")[0]
        role = app_metadata.get("role") or "researcher"

        return AuthResponse(
            user={
                "id": auth_response.user.id,
                "email": auth_response.user.email,
                "name": name,
                "role": role,
            },
            tokens={
                "access_token": auth_response.session.access_token,
                "refresh_token": auth_response.session.refresh_token,
                "token_type": auth_response.session.token_type or "bearer",
                "expires_in": auth_response.session.expires_in,
            },
        )

    def sign_up(self, name: str, email: str, password: str) -> AuthResponse:
        client = self._ensure_client()

        try:
            auth_response = client.auth.sign_up(
                {
                    "email": email,
                    "password": password,
                    "options": {
                        "data": {"name": name},
                    },
                }
            )
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Registration failed: {exc}",
            ) from exc

        if not auth_response.user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Registration failed",
            )

        session = auth_response.session
        tokens = {
            "access_token": session.access_token if session else "",
            "refresh_token": session.refresh_token if session else "",
            "token_type": (session.token_type if session else "bearer") or "bearer",
            "expires_in": session.expires_in if session else None,
        }

        return AuthResponse(
            user={
                "id": auth_response.user.id,
                "email": auth_response.user.email,
                "name": name,
                "role": "researcher",
            },
            tokens=tokens,
        )

    def get_user_from_token(self, token: str) -> dict[str, Any]:
        client = self._ensure_client()
        try:
            user_response = client.auth.get_user(token)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid auth token: {exc}",
            ) from exc

        user = user_response.user if user_response else None
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid auth token",
            )

        metadata = user.user_metadata or {}
        app_metadata = user.app_metadata or {}

        return {
            "id": user.id,
            "email": user.email,
            "name": metadata.get("name") or user.email.split("@")[0],
            "role": app_metadata.get("role") or "researcher",
        }
