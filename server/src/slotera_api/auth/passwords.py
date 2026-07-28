from functools import lru_cache
from typing import Protocol

from pwdlib import PasswordHash


class PasswordHasher(Protocol):
    def hash(self, password: str) -> str: ...

    def verify(self, password: str, password_hash: str) -> bool: ...


class PwdlibPasswordHasher:
    def __init__(self) -> None:
        self._password_hash = PasswordHash.recommended()

    def hash(self, password: str) -> str:
        return self._password_hash.hash(password)

    def verify(self, password: str, password_hash: str) -> bool:
        return self._password_hash.verify(password, password_hash)


@lru_cache
def create_password_hasher() -> PasswordHasher:
    return PwdlibPasswordHasher()
