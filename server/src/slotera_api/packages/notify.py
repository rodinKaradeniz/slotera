"""Emails about a package sale: how to pay for a requested one, and when it is ready to book.

The copy is rendered here in every language; the database function picks the client's and
the workspace owner's preferred language, queues the emails and adds the owner's bell item.
"""

import json
from typing import Literal

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from slotera_api.config import get_settings
from slotera_api.db.models import (
    Client,
    PackagePurchase,
    PackagePurchaseItem,
    Workspace,
    WorkspaceBusinessProfile,
    WorkspacePaymentSettings,
)

PackageEvent = Literal["requested", "ready"]
LANGUAGES = ("en", "de", "tr")

COPY: dict[str, dict[str, tuple[str, str]]] = {
    "package_requested": {
        "en": (
            "How to pay for {package}",
            "Thank you for choosing {package} from {provider}: {sessions} sessions for {price}.\n\n"
            "{payment}\n\n"
            "Once {provider} has received your payment, you'll get an email and can book your "
            "sessions.",
        ),
        "de": (
            "So bezahlen Sie {package}",
            "Vielen Dank, dass Sie {package} bei {provider} gewählt haben: {sessions} Termine "
            "für {price}.\n\n{payment}\n\n"
            "Sobald {provider} Ihre Zahlung erhalten hat, bekommen Sie eine E-Mail und können "
            "Ihre Termine buchen.",
        ),
        "tr": (
            "{package} için ödeme",
            "{provider} sağlayıcısından {package} paketini seçtiğiniz için teşekkürler: "
            "{price} karşılığında {sessions} seans.\n\n{payment}\n\n"
            "{provider} ödemenizi aldığında bir e-posta alacak ve seanslarınızı rezerve "
            "edebileceksiniz.",
        ),
    },
    "package_ready": {
        "en": (
            "Your {package} is ready to book",
            "{provider} has received your payment for {package}. You have {left} sessions to "
            "book.\n\nBook them here: {book_url}\n\n"
            "Sign in with this email address first, so the sessions come from your package: "
            "{sign_in_url}",
        ),
        "de": (
            "Ihr Paket {package} ist buchbar",
            "{provider} hat Ihre Zahlung für {package} erhalten. Sie können {left} Termine "
            "buchen.\n\nHier buchen: {book_url}\n\n"
            "Melden Sie sich zuerst mit dieser E-Mail-Adresse an, damit die Termine aus Ihrem "
            "Paket genommen werden: {sign_in_url}",
        ),
        "tr": (
            "{package} paketiniz rezervasyona hazır",
            "{provider}, {package} için ödemenizi aldı. Rezerve edebileceğiniz {left} seansınız "
            "var.\n\nBuradan rezerve edin: {book_url}\n\n"
            "Seansların paketinizden düşmesi için önce bu e-posta adresiyle giriş yapın: "
            "{sign_in_url}",
        ),
    },
    "operator_package_requested": {
        "en": (
            "Package request: {client}, {package}",
            "{client} asked to buy {package} for {price}. It shows as awaiting payment on their "
            "client page; mark it paid once the money arrives.\n\n{admin_url}",
        ),
        "de": (
            "Paketanfrage: {client}, {package}",
            "{client} möchte {package} für {price} kaufen. Es steht auf der Kundenseite als "
            "„Zahlung ausstehend“; markieren Sie es als bezahlt, sobald das Geld eingegangen "
            "ist.\n\n{admin_url}",
        ),
        "tr": (
            "Paket talebi: {client}, {package}",
            "{client}, {price} karşılığında {package} satın almak istiyor. Müşteri sayfasında "
            "ödeme bekliyor olarak görünür; para geldiğinde ödendi olarak işaretleyin.\n\n"
            "{admin_url}",
        ),
    },
}

PAYMENT_LINES = {
    "en": (
        "Please pay using these details:\n{instructions}",
        "{provider} will tell you how to pay.",
    ),
    "de": (
        "Bitte bezahlen Sie mit diesen Angaben:\n{instructions}",
        "{provider} teilt Ihnen mit, wie Sie bezahlen können.",
    ),
    "tr": (
        "Lütfen şu bilgilerle ödeme yapın:\n{instructions}",
        "{provider} size nasıl ödeme yapacağınızı bildirecek.",
    ),
}


def _render(kind: str, values: dict[str, object]) -> dict[str, list[str]]:
    rendered = {}
    for language in LANGUAGES:
        subject, body = COPY[kind][language]
        local = dict(values)
        if kind == "package_requested":
            with_details, without = PAYMENT_LINES[language]
            line = with_details if str(values["instructions"]).strip() else without
            local["payment"] = line.format(**values)
        rendered[language] = [subject.format(**local), body.format(**local)]
    return rendered


async def notify_package(
    session: AsyncSession,
    purchase: PackagePurchase,
    event: PackageEvent,
    left: int,
    *,
    tell_owner: bool = False,
) -> bool:
    """Queue the client's email for `event`; `tell_owner` also alerts the workspace owner.

    Runs in the caller's tenant transaction. Returns False when the client can't be emailed
    (erased), so the caller can carry on.
    """
    row = (
        await session.execute(
            select(
                Workspace.slug,
                WorkspaceBusinessProfile.display_name,
                WorkspacePaymentSettings.manual_payment_instructions,
                Client.name,
            )
            .join(
                WorkspaceBusinessProfile,
                WorkspaceBusinessProfile.workspace_id == Workspace.id,
            )
            .join(WorkspacePaymentSettings, WorkspacePaymentSettings.workspace_id == Workspace.id)
            .join(
                Client,
                (Client.workspace_id == Workspace.id) & (Client.id == purchase.client_id),
            )
            .where(Workspace.id == purchase.workspace_id)
        )
    ).one()
    slug, provider, instructions, client_name = row._tuple()
    count = await session.scalar(
        select(func.count(PackagePurchaseItem.position)).where(
            PackagePurchaseItem.workspace_id == purchase.workspace_id,
            PackagePurchaseItem.purchase_id == purchase.id,
        )
    )
    base = get_settings().public_web_base_url
    values: dict[str, object] = {
        "package": purchase.package_name_snapshot,
        "provider": provider,
        "price": f"{purchase.price_cents / 100:.2f} {purchase.currency}",
        "sessions": int(count or 0),
        "left": left,
        "instructions": instructions,
        "client": client_name,
        "book_url": f"{base}/book/{slug}",
        "sign_in_url": f"{base}/client/{slug}/sign-in",
        "admin_url": f"{base}/admin/clients/{purchase.client_id}",
    }
    kind = "package_requested" if event == "requested" else "package_ready"
    operator = _render("operator_package_requested", values) if tell_owner else None
    queued = await session.scalar(
        text("SELECT public.slotera_package_purchase_notify(:purchase, :kind, :copy, :operator)"),
        {
            "purchase": purchase.id,
            "kind": kind,
            "copy": json.dumps(_render(kind, values)),
            "operator": json.dumps(operator) if operator else None,
        },
    )
    return queued is True
