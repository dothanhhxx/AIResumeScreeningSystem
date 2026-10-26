"""
Storage service — MinIO/S3 wrapper.
Owner: Person B

Wraps boto3's S3-compatible client to upload, download, delete, and
generate presigned URLs for objects stored in MinIO.

Usage:
    from app.services.storage_service import storage_service

    url = await storage_service.upload_file(
        file_bytes=b"...",
        object_key="resumes/cv_42.pdf",
        content_type="application/pdf",
    )
"""

import logging
from io import BytesIO

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

from app.config import settings
from app.core.exceptions import StorageServiceError

logger = logging.getLogger(__name__)

# Supported CV MIME types
ALLOWED_CONTENT_TYPES: dict[str, str] = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/msword": "doc",
}


class StorageService:
    """
    Async-friendly wrapper around boto3's S3 client configured for MinIO.

    All methods are synchronous (boto3 does not have an asyncio client),
    but they are designed to be called from FastAPI endpoints either
    directly (for small uploads) or via run_in_executor in an async context.
    """

    def __init__(self) -> None:
        self._client = None  # Lazy-initialised

    # ── Private ─────────────────────────────────────────────────────────────

    def _get_client(self):
        """Return a lazily-created boto3 S3 client for MinIO."""
        if self._client is None:
            self._client = boto3.client(
                "s3",
                endpoint_url=f"http://{settings.MINIO_ENDPOINT}",
                aws_access_key_id=settings.MINIO_ROOT_USER,
                aws_secret_access_key=settings.MINIO_ROOT_PASSWORD,
                config=Config(signature_version="s3v4"),
                region_name="us-east-1",  # Required by boto3; MinIO ignores it
            )
        return self._client

    def _ensure_bucket(self) -> None:
        """Create the bucket if it does not already exist."""
        client = self._get_client()
        try:
            client.head_bucket(Bucket=settings.MINIO_BUCKET_NAME)
        except ClientError as exc:
            error_code = exc.response["Error"]["Code"]
            if error_code in ("404", "NoSuchBucket"):
                logger.info("Bucket '%s' not found — creating.", settings.MINIO_BUCKET_NAME)
                client.create_bucket(Bucket=settings.MINIO_BUCKET_NAME)
            else:
                raise StorageServiceError(f"MinIO bucket check failed: {exc}") from exc

    # ── Public API ──────────────────────────────────────────────────────────

    def upload_file(
        self,
        file_bytes: bytes,
        object_key: str,
        content_type: str = "application/octet-stream",
    ) -> str:
        """
        Upload raw bytes to MinIO and return the object key (storage path).

        Args:
            file_bytes:   Raw file content.
            object_key:   Destination path inside the bucket, e.g. ``resumes/cv_42.pdf``.
            content_type: MIME type of the file.

        Returns:
            The *object_key* on success (used as ``file_url`` in the CV model).

        Raises:
            StorageServiceError: if the upload fails.
        """
        client = self._get_client()
        self._ensure_bucket()
        try:
            client.put_object(
                Bucket=settings.MINIO_BUCKET_NAME,
                Key=object_key,
                Body=BytesIO(file_bytes),
                ContentType=content_type,
                ContentLength=len(file_bytes),
            )
            logger.info("Uploaded '%s' (%d bytes).", object_key, len(file_bytes))
            return object_key
        except (BotoCoreError, ClientError) as exc:
            logger.exception("Failed to upload '%s' to MinIO.", object_key)
            raise StorageServiceError(f"Upload failed: {exc}") from exc

    def download_file(self, object_key: str) -> bytes:
        """
        Download an object from MinIO and return its raw bytes.

        Raises:
            StorageServiceError: if the download fails or the object does not exist.
        """
        client = self._get_client()
        try:
            response = client.get_object(
                Bucket=settings.MINIO_BUCKET_NAME,
                Key=object_key,
            )
            return response["Body"].read()
        except (BotoCoreError, ClientError) as exc:
            logger.exception("Failed to download '%s' from MinIO.", object_key)
            raise StorageServiceError(f"Download failed: {exc}") from exc

    def delete_file(self, object_key: str) -> None:
        """
        Delete an object from MinIO.

        Raises:
            StorageServiceError: if deletion fails.
        """
        client = self._get_client()
        try:
            client.delete_object(
                Bucket=settings.MINIO_BUCKET_NAME,
                Key=object_key,
            )
            logger.info("Deleted '%s' from MinIO.", object_key)
        except (BotoCoreError, ClientError) as exc:
            logger.exception("Failed to delete '%s' from MinIO.", object_key)
            raise StorageServiceError(f"Delete failed: {exc}") from exc

    def get_presigned_url(self, object_key: str, expires_in: int = 3600) -> str:
        """
        Generate a presigned GET URL valid for *expires_in* seconds (default 1 hour).

        Args:
            object_key: The MinIO object path.
            expires_in: URL expiry time in seconds.

        Returns:
            A time-limited presigned URL string.

        Raises:
            StorageServiceError: if URL generation fails.
        """
        client = self._get_client()
        try:
            url: str = client.generate_presigned_url(
                "get_object",
                Params={"Bucket": settings.MINIO_BUCKET_NAME, "Key": object_key},
                ExpiresIn=expires_in,
            )
            return url
        except (BotoCoreError, ClientError) as exc:
            logger.exception("Failed to generate presigned URL for '%s'.", object_key)
            raise StorageServiceError(f"Presigned URL failed: {exc}") from exc


# ── Singleton ───────────────────────────────────────────────────────────────
storage_service = StorageService()
