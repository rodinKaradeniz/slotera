# ruff: noqa: E501
"""Services, form templates and packages: what a workspace offers."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    String,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from slotera_api.db.base import Base
from slotera_api.db.enums import (
    ConfirmationPolicy,
    FormStatus,
    LocationType,
    ServiceBookingMode,
    _enum_values,
)
from slotera_api.db.versioning import Versioned


class Service(Versioned, Base):
    __tablename__ = "services"
    __table_args__ = (UniqueConstraint("workspace_id", "id", name="uq_services_workspace_id_id"),)

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(String(4000), server_default=text("''"))
    duration_min: Mapped[int] = mapped_column(Integer)
    price_cents: Mapped[int] = mapped_column(Integer)
    capacity: Mapped[int] = mapped_column(Integer)
    location_type: Mapped[LocationType] = mapped_column(
        Enum(LocationType, name="location_type", values_callable=_enum_values)
    )
    location: Mapped[str] = mapped_column(String(240))
    address: Mapped[dict[str, object] | None] = mapped_column(JSONB)
    # Online/hybrid only: one https meeting link, shown to confirmed clients.
    meeting_url: Mapped[str | None] = mapped_column(String(500))
    booking_mode: Mapped[ServiceBookingMode] = mapped_column(
        Enum(ServiceBookingMode, name="service_booking_mode", values_callable=_enum_values)
    )
    confirmation_policy: Mapped[ConfirmationPolicy] = mapped_column(
        Enum(ConfirmationPolicy, name="confirmation_policy", values_callable=_enum_values),
        server_default=text("'automatic'"),
    )
    cancellation_rule: Mapped[str] = mapped_column(String(1000), server_default=text("''"))
    active: Mapped[bool] = mapped_column(server_default=text("true"))
    notes: Mapped[str | None] = mapped_column(String(2000))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class FormTemplate(Versioned, Base):
    __tablename__ = "form_templates"
    __table_args__ = (
        UniqueConstraint("workspace_id", "id", name="uq_form_templates_workspace_id_id"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(String(1000), server_default=text("''"))
    status: Mapped[FormStatus] = mapped_column(
        Enum(FormStatus, name="form_status", values_callable=_enum_values)
    )
    fields: Mapped[list[dict[str, object]]] = mapped_column(JSONB)
    required_before_payment: Mapped[bool] = mapped_column(server_default=text("true"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class FormTemplateService(Base):
    __tablename__ = "form_template_services"
    __table_args__ = (
        ForeignKeyConstraint(
            ["workspace_id", "form_template_id"],
            ["form_templates.workspace_id", "form_templates.id"],
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["workspace_id", "service_id"],
            ["services.workspace_id", "services.id"],
            ondelete="RESTRICT",
        ),
    )

    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), primary_key=True
    )
    form_template_id: Mapped[UUID] = mapped_column(primary_key=True)
    service_id: Mapped[UUID] = mapped_column(primary_key=True)


class ServicePackage(Versioned, Base):
    __tablename__ = "service_packages"
    __table_args__ = (
        UniqueConstraint("workspace_id", "id", name="service_packages_workspace_id_id_key"),
        CheckConstraint("price_cents >= 0", name="package_price"),
        CheckConstraint("status IN ('active', 'inactive')", name="package_status"),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(String(4000))
    status: Mapped[str] = mapped_column(String(8))
    price_cents: Mapped[int] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(String(4000))
    featured: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class ServicePackageItem(Base):
    __tablename__ = "service_package_items"
    __table_args__ = (
        ForeignKeyConstraint(
            ["workspace_id", "package_id"],
            ["service_packages.workspace_id", "service_packages.id"],
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["workspace_id", "service_id"],
            ["services.workspace_id", "services.id"],
            ondelete="RESTRICT",
        ),
        UniqueConstraint(
            "workspace_id",
            "package_id",
            "position",
            name="service_package_items_workspace_id_package_id_position_key",
        ),
        CheckConstraint("position >= 0", name="package_position"),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    package_id: Mapped[UUID]
    service_id: Mapped[UUID]
    title: Mapped[str | None] = mapped_column(String(160))
    description: Mapped[str | None] = mapped_column(String(1000))
    position: Mapped[int] = mapped_column(Integer)
