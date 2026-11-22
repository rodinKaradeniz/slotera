# ruff: noqa: E501
"""Enumerations shared by the persistence models."""

from enum import StrEnum


class PlatformRole(StrEnum):
    SUPERADMIN = "superadmin"


class MembershipRole(StrEnum):
    OPERATOR_ADMIN = "operator_admin"


class WorkspaceOperationalStatus(StrEnum):
    ACTIVE = "active"
    SUSPENDED = "suspended"


class LocationType(StrEnum):
    ONLINE = "online"
    PHYSICAL = "physical"
    HYBRID = "hybrid"


class ServiceBookingMode(StrEnum):
    OPEN = "open"
    SCHEDULED = "scheduled"


class ConfirmationPolicy(StrEnum):
    AUTOMATIC = "automatic"
    OPERATOR_APPROVAL = "operator_approval"


class NotificationKind(StrEnum):
    BOOKING_PENDING = "booking_pending"
    BOOKING_CONFIRMED = "booking_confirmed"
    PAYMENT_PENDING = "payment_pending"
    SESSION_STARTING = "session_starting"
    RESCHEDULE_REQUESTED = "reschedule_requested"
    BOOKING_CANCELLED = "booking_cancelled"
    PACKAGE_REQUESTED = "package_requested"


class SessionStatus(StrEnum):
    SCHEDULED = "scheduled"
    LIVE = "live"
    DONE = "done"
    CANCELLED = "cancelled"


class SessionOrigin(StrEnum):
    OPERATOR = "operator"
    PUBLIC_OPEN = "public_open"


class BookingStatus(StrEnum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NOSHOW = "noshow"


class BookingOrigin(StrEnum):
    OPERATOR = "operator"
    PUBLIC = "public"


class BookingApprovalStatus(StrEnum):
    NOT_REQUIRED = "not_required"
    PENDING = "pending"
    APPROVED = "approved"
    DECLINED = "declined"


class BookingAttendance(StrEnum):
    PRESENT = "present"
    LATE = "late"
    ABSENT = "absent"


class PaymentStatus(StrEnum):
    PAID = "paid"
    PENDING = "pending"
    REFUNDED = "refunded"
    FREE = "free"
    OVERDUE = "overdue"


class PaymentMethod(StrEnum):
    FREE = "free"
    MANUAL = "manual"


class TaxTreatment(StrEnum):
    NONE = "none"
    FIXED = "fixed"


class FormStatus(StrEnum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class SessionActionItemStatus(StrEnum):
    TODO = "todo"
    DONE = "done"


def _enum_values(enum_type: type[StrEnum]) -> list[str]:
    return [member.value for member in enum_type]
