from fastapi import APIRouter, Depends

from app.core.auth import require_current_user
from app.db.repository import AnalysisRepository
from app.dependencies import get_repository
from app.schemas.users import UpdateUserProfileRequest, UserProfile

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserProfile)
def get_current_user(
    current_user: dict = Depends(require_current_user),
    repo: AnalysisRepository = Depends(get_repository),
) -> UserProfile:
    user = repo.get_or_create_user(
        user_id=current_user["id"],
        fallback_email=current_user["email"],
        fallback_name=current_user["name"],
        fallback_role=current_user["role"],
    )
    return UserProfile(**user)


@router.patch("/me", response_model=UserProfile)
def update_user(
    payload: UpdateUserProfileRequest,
    current_user: dict = Depends(require_current_user),
    repo: AnalysisRepository = Depends(get_repository),
) -> UserProfile:
    existing = repo.get_or_create_user(
        user_id=current_user["id"],
        fallback_email=current_user["email"],
        fallback_name=current_user["name"],
        fallback_role=current_user["role"],
    )

    patch = payload.model_dump(exclude_none=True)
    updated = repo.update_user(existing["id"], patch)
    return UserProfile(**(updated or existing))
