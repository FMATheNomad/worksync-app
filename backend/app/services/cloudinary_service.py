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
    try:
        import asyncio
        result = await asyncio.to_thread(
            cloudinary.uploader.destroy,
            public_id,
        )
        return result.get("result") == "ok"
    except Exception:
        return False
