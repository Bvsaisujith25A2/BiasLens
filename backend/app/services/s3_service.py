from uuid import uuid4

import boto3
from botocore.client import BaseClient
from fastapi import HTTPException, status

from app.core.config import Settings
from app.schemas.upload import PresignedUrlResponse


class S3Service:
    def __init__(self, settings: Settings):
        self.settings = settings
        if not settings.s3_bucket_name:
            raise RuntimeError("Missing s3_bucket_name configuration")

        self.client: BaseClient = boto3.client(
            "s3",
            region_name=settings.aws_region,
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
            aws_session_token=settings.aws_session_token,
        )

    def create_presigned_upload(self, filename: str, content_type: str) -> PresignedUrlResponse:
        object_key = f"{self.settings.s3_key_prefix}/{uuid4()}-{filename}"
        s3_uri = f"s3://{self.settings.s3_bucket_name}/{object_key}"

        try:
            url = self.client.generate_presigned_url(
                ClientMethod="put_object",
                Params={
                    "Bucket": self.settings.s3_bucket_name,
                    "Key": object_key,
                    "ContentType": content_type,
                },
                ExpiresIn=self.settings.presigned_expiry_seconds,
            )
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Unable to generate presigned URL: {exc}",
            ) from exc

        return PresignedUrlResponse(
            presigned_url=url,
            s3_object_uri=s3_uri,
            expires_in=self.settings.presigned_expiry_seconds,
        )
