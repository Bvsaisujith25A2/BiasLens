from fastapi import Header, HTTPException, status

from app.core.config import get_settings


def require_colab_secret(x_worker_secret: str | None = Header(default=None)) -> None:
    settings = get_settings()

    # If no secret configured, keep development mode simple.
    if not settings.colab_shared_secret:
        return

    if x_worker_secret != settings.colab_shared_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid worker secret",
        )
