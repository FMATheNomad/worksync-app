"""
Cloudinary service — image upload and management.

WHY THIS EXISTS: Provides an async wrapper around Cloudinary's synchronous SDK.
All image uploads (selfies, expense receipts) go through this module, which
handles the translation between sync SDK calls and async FastAPI handlers.

UPLOAD STRATEGY:
  - Uses asyncio.to_thread to run Cloudinary's synchronous upload functions
    in a thread pool, avoiding event loop blocking.
  - Images are uploaded to Cloudinary's "worksync" folder (configurable per call).
  - Returns only the secure_url (HTTPS URL) for storing in the database.
    The public_id is NOT stored — we rely on Cloudinary's folder for organization.
    This is a trade-off: we can't easily delete images by user action, but it
    simplifies the data model and still allows purging by folder.

ERROR HANDLING:
  Returns None on ANY failure (network error, invalid file, auth failure, etc.).
  The caller (route handler) decides how to handle upload failures. This is
  consistent with the graceful degradation pattern used throughout the app.
  
  WHY not raise exceptions: Image uploads are typically non-critical path —
  a failed selfie upload shouldn't prevent check-in. Returning None allows
  the attendance to be recorded without a photo, which is better than
  rejecting the entire request.

SECURITY CONSIDERATIONS:
  - Cloudinary is configured with secure=True (HTTPS only).
  - File types are validated on the FRONTEND (allowed types: jpeg, png, webp).
    Server-side validation would be a security enhancement (check MIME type
    on upload), but for an MVP, frontend validation + Cloudinary's built-in
    malware scanning is adequate.
  - File size is validated on the frontend (5MB max). Cloudinary also has
    upload limits, but they're much higher (10MB+). 
  - No authentication on the upload URL — Cloudinary URLs are public by default.
    For sensitive images (selfies), enable Cloudinary's signed URL delivery.

PERFORMANCE:
  - Cloudinary's upload includes image optimization (auto-format, quality
    compression) by default when using their URL transformation parameters.
  - The returned secure_url can be transformed on-the-fly by appending
    image transformation parameters (e.g., w_200,h_200,c_fill for thumbnails).
"""

import cloudinary
import cloudinary.uploader

from app.core.config import settings

cloudinary.config(
    cloud_name=settings.cloudinary_cloud_name,
    api_key=settings.cloudinary_api_key,
    api_secret=settings.cloudinary_api_secret,
    secure=True,
)


async def upload_image(file_path: str, folder: str = "worksync") -> str | None:
    """
    Uploads an image file from a local path to Cloudinary.

    Used for server-side uploads (e.g., from admin panel or batch processing).
    The file must already exist on the filesystem.
    
    Returns the secure HTTPS URL to the uploaded image, or None on failure.
    """
    try:
        import asyncio
        result = await asyncio.to_thread(
            cloudinary.uploader.upload,
            file_path,
            folder=folder,
            resource_type="image",
        )
        return result.get("secure_url")
    except Exception:
        return None


async def upload_image_from_bytes(
    file_data: bytes, public_id: str, folder: str = "worksync"
) -> str | None:
    """
    Uploads an image from raw bytes (e.g., from a file upload in an HTTP request).
    
    public_id is provided by the caller (could be a UUID or user_id + timestamp).
    This gives the caller control over the Cloudinary public ID for deduplication.
    
    WHY two upload functions: The SDK accepts both file paths and raw bytes,
    but they map to different HTTP scenarios (multipart form upload vs. file path).
    Separating them avoids confusion about which parameter to use.
    """
    try:
        import asyncio
        result = await asyncio.to_thread(
            cloudinary.uploader.upload,
            file_data,
            public_id=public_id,
            folder=folder,
            resource_type="image",
        )
        return result.get("secure_url")
    except Exception:
        return None


async def delete_image(public_id: str) -> bool:
    """
    Deletes an image from Cloudinary by its public_id.
    
    NOTE: Since we don't store public_id in the database (only the URL),
    this function requires the caller to know the public_id. In practice,
    this might be derived from the URL or passed in the request.
    
    Returns True if deletion was successful, False otherwise.
    Currently not used in any endpoint — included for future use
    (e.g., "delete selfie" feature for re-taking photos).
    """
    try:
        import asyncio
        result = await asyncio.to_thread(
            cloudinary.uploader.destroy,
            public_id,
        )
        return result.get("result") == "ok"
    except Exception:
        return False
