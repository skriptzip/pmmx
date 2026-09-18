from __future__ import annotations

from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

_ALGORITHM = "HS256"
_EXPIRE_DAYS = 30


def create_access_token(user_id: int, secret_key: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=_EXPIRE_DAYS)
    return jwt.encode({"sub": str(user_id), "exp": expire}, secret_key, algorithm=_ALGORITHM)


def decode_access_token(token: str, secret_key: str) -> int | None:
    try:
        payload = jwt.decode(token, secret_key, algorithms=[_ALGORITHM])
        return int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        return None
