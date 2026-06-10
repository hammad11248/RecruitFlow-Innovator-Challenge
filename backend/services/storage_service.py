"""
Firebase Storage service — handles CV file uploads, downloads, and URL generation.
Uses firebase-admin Storage bucket for server-side operations.
"""

from __future__ import annotations

import asyncio
from functools import partial
from typing import Optional

from backend.firebase_admin_init import bucket


async def _run_sync(func, *args, **kwargs):
    """Run a synchronous Firebase Storage call in a thread executor."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, partial(func, *args, **kwargs))


def _upload_cv_sync(
    file_bytes: bytes,
    candidate_id: str,
    filename: str,
    content_type: str = "application/pdf",
) -> tuple[str, str]:
    """
    Upload CV file bytes to Firebase Storage.
    Returns (storage_path, download_url).
    """
    storage_path = f"cvs/{candidate_id}/{filename}"
    blob = bucket.blob(storage_path)
    blob.upload_from_string(file_bytes, content_type=content_type)
    try:
        blob.make_public()
        download_url = blob.public_url
    except Exception as e:
        # If bucket has Uniform Bucket-Level Access, make_public() fails.
        # Generate a signed URL with a long expiration (e.g. 7 days or 365 days) instead.
        import datetime as dt
        try:
            download_url = blob.generate_signed_url(
                expiration=dt.timedelta(days=365),
                method="GET",
            )
        except Exception:
            # Fallback to public URL without make_public
            download_url = blob.public_url
    return storage_path, download_url


async def upload_cv(
    file_bytes: bytes,
    candidate_id: str,
    filename: str,
    content_type: str = "application/pdf",
) -> tuple[str, str]:
    """
    Async wrapper: Upload CV to Firebase Storage at cvs/{candidateId}/{filename}.
    Returns (storage_path, download_url).
    """
    return await _run_sync(
        _upload_cv_sync, file_bytes, candidate_id, filename, content_type
    )


def _get_download_url_sync(storage_path: str) -> str:
    """Generate a signed download URL for a file in Firebase Storage."""
    import datetime as dt
    blob = bucket.blob(storage_path)
    url = blob.generate_signed_url(
        expiration=dt.timedelta(hours=24),
        method="GET",
    )
    return url


async def get_download_url(storage_path: str) -> str:
    """Async wrapper: Generate signed download URL."""
    return await _run_sync(_get_download_url_sync, storage_path)


def _download_cv_sync(storage_path: str) -> bytes:
    """Download a file from Firebase Storage as bytes."""
    blob = bucket.blob(storage_path)
    return blob.download_as_bytes()


async def download_cv(storage_path: str) -> bytes:
    """Async wrapper: Download CV file bytes from Firebase Storage."""
    return await _run_sync(_download_cv_sync, storage_path)


def sync_download_cv(storage_path: str) -> bytes:
    """Synchronous download for Celery tasks."""
    blob = bucket.blob(storage_path)
    return blob.download_as_bytes()


def sync_upload_cv(
    file_bytes: bytes,
    candidate_id: str,
    filename: str,
    content_type: str = "application/pdf",
) -> tuple[str, str]:
    """Synchronous upload for Celery tasks."""
    return _upload_cv_sync(file_bytes, candidate_id, filename, content_type)


def sync_get_download_url(storage_path: str) -> str:
    """Synchronous URL generation for Celery tasks."""
    return _get_download_url_sync(storage_path)


def get_file_extension(filename: str) -> str:
    """Extract file extension from filename."""
    if "." in filename:
        return filename.rsplit(".", 1)[1].lower()
    return ""


def validate_cv_file(filename: str, file_size: int) -> Optional[str]:
    """
    Validate CV file type and size.
    Returns error message string if invalid, None if valid.
    """
    allowed_extensions = {"pdf", "docx"}
    max_size_mb = 50

    ext = get_file_extension(filename)
    if ext not in allowed_extensions:
        return f"Invalid file type '.{ext}'. Only PDF and DOCX files are accepted."

    if file_size > max_size_mb * 1024 * 1024:
        return f"File size exceeds {max_size_mb}MB limit."

    return None
