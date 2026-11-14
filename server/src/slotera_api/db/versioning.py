"""Optimistic row revisions; SQLAlchemy checks the loaded revision at flush/delete."""

from typing import Any

from sqlalchemy import BigInteger, text
from sqlalchemy.orm import Mapped, declared_attr, mapped_column


class Versioned:
    version: Mapped[int] = mapped_column(BigInteger, default=1, server_default=text("1"))

    @declared_attr.directive
    def __mapper_args__(cls) -> dict[str, Any]:
        return {"version_id_col": cls.version}
