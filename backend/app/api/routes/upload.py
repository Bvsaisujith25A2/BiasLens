from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies import get_s3_service
from app.schemas.upload import PresignedUrlRequest, PresignedUrlResponse
from app.services.s3_service import S3Service

router = APIRouter(prefix="/upload", tags=["upload"])


@router.post("/presigned-url", response_model=PresignedUrlResponse)
def get_presigned_url(
    payload: PresignedUrlRequest,
    s3_service: S3Service = Depends(get_s3_service),
) -> PresignedUrlResponse:
    if payload.file_size <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="file_size must be greater than 0",
        )
    return s3_service.create_presigned_upload(payload.filename, payload.content_type)
