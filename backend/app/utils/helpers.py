import math
import uuid
from datetime import date, datetime, timezone


def generate_uuid() -> uuid.UUID:
    return uuid.uuid4()


def get_current_time() -> datetime:
    return datetime.now(timezone.utc)


def get_current_date() -> date:
    return datetime.now(timezone.utc).date()


def format_datetime(dt: datetime, fmt: str = "%Y-%m-%d %H:%M:%S") -> str:
    return dt.strftime(fmt)


def calculate_distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    lat1_r = math.radians(lat1)
    lat2_r = math.radians(lat2)
    lng1_r = math.radians(lng1)
    lng2_r = math.radians(lng2)

    dlat = lat2_r - lat1_r
    dlng = lng2_r - lng1_r

    a = math.sin(dlat / 2) ** 2 + math.cos(lat1_r) * math.cos(lat2_r) * math.sin(dlng / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c
