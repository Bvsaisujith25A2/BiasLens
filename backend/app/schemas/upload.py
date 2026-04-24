from pydantic import BaseModel, Field


class PresignedUrlRequest(BaseModel):
    filename: str = Field(min_length=1)
    file_size: int = Field(gt=0)
    content_type: str = Field(min_length=1)


class PresignedUrlResponse(BaseModel):
    presigned_url: str
    s3_object_uri: str
    expires_in: int
