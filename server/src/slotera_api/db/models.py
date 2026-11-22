# ruff: noqa: E501
"""All persistence models, re-exported from the modules that define them."""

from slotera_api.db import ai_models as ai_models
from slotera_api.db.base import Base as Base
from slotera_api.db.booking_models import (
    Booking as Booking,
)
from slotera_api.db.booking_models import (
    BookingAccessToken as BookingAccessToken,
)
from slotera_api.db.booking_models import (
    BookingCommandIdempotency as BookingCommandIdempotency,
)
from slotera_api.db.booking_models import (
    BookingFormResponse as BookingFormResponse,
)
from slotera_api.db.booking_models import (
    BookingFormSnapshot as BookingFormSnapshot,
)
from slotera_api.db.booking_models import (
    CalendarFeedToken as CalendarFeedToken,
)
from slotera_api.db.booking_models import (
    Client as Client,
)
from slotera_api.db.booking_models import (
    ClientNote as ClientNote,
)
from slotera_api.db.booking_models import (
    PackagePurchase as PackagePurchase,
)
from slotera_api.db.booking_models import (
    PackagePurchaseItem as PackagePurchaseItem,
)
from slotera_api.db.booking_models import (
    PublicBookingIdempotency as PublicBookingIdempotency,
)
from slotera_api.db.catalog_models import (
    FormTemplate as FormTemplate,
)
from slotera_api.db.catalog_models import (
    FormTemplateService as FormTemplateService,
)
from slotera_api.db.catalog_models import (
    Service as Service,
)
from slotera_api.db.catalog_models import (
    ServicePackage as ServicePackage,
)
from slotera_api.db.catalog_models import (
    ServicePackageItem as ServicePackageItem,
)
from slotera_api.db.client_models import (
    BookingFollowup as BookingFollowup,
)
from slotera_api.db.client_models import (
    ClientAuthSession as ClientAuthSession,
)
from slotera_api.db.client_models import (
    ClientConversation as ClientConversation,
)
from slotera_api.db.client_models import (
    ClientEmailCommand as ClientEmailCommand,
)
from slotera_api.db.client_models import (
    ClientLoginToken as ClientLoginToken,
)
from slotera_api.db.client_models import (
    ConversationMessage as ConversationMessage,
)
from slotera_api.db.client_models import (
    ConversationRead as ConversationRead,
)
from slotera_api.db.client_models import (
    MessageDigestRun as MessageDigestRun,
)
from slotera_api.db.client_models import (
    ServiceFollowupRule as ServiceFollowupRule,
)
from slotera_api.db.enums import (
    BookingApprovalStatus as BookingApprovalStatus,
)
from slotera_api.db.enums import (
    BookingAttendance as BookingAttendance,
)
from slotera_api.db.enums import (
    BookingOrigin as BookingOrigin,
)
from slotera_api.db.enums import (
    BookingStatus as BookingStatus,
)
from slotera_api.db.enums import (
    ConfirmationPolicy as ConfirmationPolicy,
)
from slotera_api.db.enums import (
    FormStatus as FormStatus,
)
from slotera_api.db.enums import (
    LocationType as LocationType,
)
from slotera_api.db.enums import (
    MembershipRole as MembershipRole,
)
from slotera_api.db.enums import (
    NotificationKind as NotificationKind,
)
from slotera_api.db.enums import (
    PaymentMethod as PaymentMethod,
)
from slotera_api.db.enums import (
    PaymentStatus as PaymentStatus,
)
from slotera_api.db.enums import (
    PlatformRole as PlatformRole,
)
from slotera_api.db.enums import (
    ServiceBookingMode as ServiceBookingMode,
)
from slotera_api.db.enums import (
    SessionActionItemStatus as SessionActionItemStatus,
)
from slotera_api.db.enums import (
    SessionOrigin as SessionOrigin,
)
from slotera_api.db.enums import (
    SessionStatus as SessionStatus,
)
from slotera_api.db.enums import (
    TaxTreatment as TaxTreatment,
)
from slotera_api.db.enums import (
    WorkspaceOperationalStatus as WorkspaceOperationalStatus,
)
from slotera_api.db.enums import (
    _enum_values as _enum_values,
)
from slotera_api.db.identity_models import (
    AuditEvent as AuditEvent,
)
from slotera_api.db.identity_models import (
    AuthSession as AuthSession,
)
from slotera_api.db.identity_models import (
    EmailOutbox as EmailOutbox,
)
from slotera_api.db.identity_models import (
    Notification as Notification,
)
from slotera_api.db.identity_models import (
    PasswordResetToken as PasswordResetToken,
)
from slotera_api.db.identity_models import (
    PlatformInquiry as PlatformInquiry,
)
from slotera_api.db.identity_models import (
    RequestRateLimit as RequestRateLimit,
)
from slotera_api.db.identity_models import (
    ReservedWorkspaceSlug as ReservedWorkspaceSlug,
)
from slotera_api.db.identity_models import (
    User as User,
)
from slotera_api.db.identity_models import (
    Workspace as Workspace,
)
from slotera_api.db.identity_models import (
    WorkspaceBusinessProfile as WorkspaceBusinessProfile,
)
from slotera_api.db.identity_models import (
    WorkspaceLocation as WorkspaceLocation,
)
from slotera_api.db.identity_models import (
    WorkspaceMembership as WorkspaceMembership,
)
from slotera_api.db.identity_models import (
    WorkspacePaymentSettings as WorkspacePaymentSettings,
)
from slotera_api.db.identity_models import (
    WorkspaceSlugHistory as WorkspaceSlugHistory,
)
from slotera_api.db.scheduling_models import (
    AvailabilityBlackout as AvailabilityBlackout,
)
from slotera_api.db.scheduling_models import (
    AvailabilityPolicy as AvailabilityPolicy,
)
from slotera_api.db.scheduling_models import (
    AvailabilityWindow as AvailabilityWindow,
)
from slotera_api.db.scheduling_models import (
    Session as Session,
)
from slotera_api.db.scheduling_models import (
    SessionActionItem as SessionActionItem,
)
from slotera_api.db.scheduling_models import (
    SessionCommandIdempotency as SessionCommandIdempotency,
)
from slotera_api.db.scheduling_models import (
    SessionSeries as SessionSeries,
)
from slotera_api.db.versioning import Versioned as Versioned

TENANT_TABLES = frozenset(
    {
        "ai_states",
        "ai_source_revisions",
        "ai_documents",
        "ai_jobs",
        "ai_threads",
        "ai_turns",
        "ai_briefings",
        "ai_usage",
        "audit_events",
        "workspace_memberships",
        "workspace_slug_history",
        "workspaces",
        "workspace_business_profiles",
        "workspace_locations",
        "services",
        "notifications",
        "availability_policies",
        "availability_windows",
        "availability_blackouts",
        "session_series",
        "sessions",
        "clients",
        "bookings",
        "booking_command_idempotency",
        "session_command_idempotency",
        "booking_form_responses",
        "booking_form_snapshots",
        "service_packages",
        "service_package_items",
        "package_purchases",
        "package_purchase_items",
        "booking_access_tokens",
        "calendar_feed_tokens",
        "public_booking_idempotency",
        "form_templates",
        "form_template_services",
        "client_notes",
        "client_login_tokens",
        "client_auth_sessions",
        "client_conversations",
        "conversation_messages",
        "conversation_reads",
        "service_followup_rules",
        "booking_followups",
        "client_email_commands",
        "message_digest_runs",
        "session_action_items",
        "workspace_payment_settings",
    }
)


__all__ = [
    "TENANT_TABLES",
    "AuditEvent",
    "AvailabilityBlackout",
    "AvailabilityPolicy",
    "AvailabilityWindow",
    "Booking",
    "BookingApprovalStatus",
    "BookingCommandIdempotency",
    "BookingOrigin",
    "BookingStatus",
    "BookingAttendance",
    "Client",
    "ClientNote",
    "ConfirmationPolicy",
    "FormStatus",
    "FormTemplate",
    "FormTemplateService",
    "AuthSession",
    "Base",
    "MembershipRole",
    "LocationType",
    "Notification",
    "BookingAccessToken",
    "CalendarFeedToken",
    "NotificationKind",
    "PasswordResetToken",
    "PlatformRole",
    "PaymentStatus",
    "ReservedWorkspaceSlug",
    "Service",
    "ServiceBookingMode",
    "Session",
    "SessionActionItem",
    "SessionActionItemStatus",
    "SessionOrigin",
    "SessionSeries",
    "SessionStatus",
    "User",
    "Workspace",
    "WorkspaceMembership",
    "WorkspaceBusinessProfile",
    "WorkspaceLocation",
    "WorkspaceSlugHistory",
]
