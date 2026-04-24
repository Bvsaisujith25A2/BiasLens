from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth import require_current_user
from app.db.repository import AnalysisRepository
from app.dependencies import get_repository
from app.schemas.analyses import AnalysisHistoryItem, AnalysisHistoryResponse

router = APIRouter(prefix="/analyses", tags=["analyses"])


@router.get("", response_model=AnalysisHistoryResponse)
def list_analyses(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=10, ge=1, le=100),
    current_user: dict = Depends(require_current_user),
    repo: AnalysisRepository = Depends(get_repository),
) -> AnalysisHistoryResponse:
    jobs, total = repo.list_jobs(user_id=current_user["id"], page=page, per_page=per_page)

    analyses = [
        AnalysisHistoryItem(
            id=job["id"],
            name=job.get("name", f"Analysis {job['id'][:8]}"),
            dataset_name=job.get("dataset_name", "Uploaded Dataset"),
            status=job.get("status", "PENDING"),
            fairness_score=(job.get("results") or {}).get("fairness_score"),
            diversity_score=(job.get("results") or {}).get("diversity_score"),
            total_samples=(job.get("results") or {}).get("total_samples", 0),
            bias_warnings=len((job.get("results") or {}).get("warnings", [])),
            created_at=job["created_at"],
            completed_at=job.get("completed_at"),
        )
        for job in jobs
    ]

    return AnalysisHistoryResponse(analyses=analyses, total=total, page=page, per_page=per_page)


@router.get("/{analysis_id}")
def get_analysis(
    analysis_id: str,
    current_user: dict = Depends(require_current_user),
    repo: AnalysisRepository = Depends(get_repository),
) -> dict:
    record = repo.get_job(analysis_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analysis not found")
    if record.get("user_id") != current_user["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return record


@router.delete("/{analysis_id}")
def delete_analysis(
    analysis_id: str,
    current_user: dict = Depends(require_current_user),
    repo: AnalysisRepository = Depends(get_repository),
) -> dict[str, bool]:
    record = repo.get_job(analysis_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analysis not found")
    if record.get("user_id") != current_user["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    deleted = repo.delete_job(analysis_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unable to delete analysis")
    return {"success": True}
