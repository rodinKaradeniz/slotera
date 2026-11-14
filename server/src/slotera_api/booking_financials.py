from dataclasses import dataclass
from typing import Any

from slotera_api.db.models import Service, Workspace, WorkspacePaymentSettings


@dataclass(frozen=True)
class TaxQuote:
    treatment: str
    rate_bps: int
    label: str | None
    jurisdiction: str | None
    gross_amount_cents: int
    net_amount_cents: int
    tax_amount_cents: int
    currency: str


def quote_for(
    service: Service,
    workspace: Workspace,
    payments: WorkspacePaymentSettings,
) -> TaxQuote:
    gross = service.price_cents
    if payments.tax_treatment == "fixed" and payments.tax_rate_bps > 0:
        net = round(gross * 10000 / (10000 + payments.tax_rate_bps))
        tax = gross - net
        label: str | None = payments.tax_label
    else:
        net = gross
        tax = 0
        label = None
    return TaxQuote(
        treatment=payments.tax_treatment,
        rate_bps=payments.tax_rate_bps,
        label=label,
        jurisdiction=payments.tax_jurisdiction,
        gross_amount_cents=gross,
        net_amount_cents=net,
        tax_amount_cents=tax,
        currency=workspace.currency,
    )


def financial_snapshot(quote: TaxQuote, payments: WorkspacePaymentSettings) -> dict[str, Any]:
    """Values written once on creation by both public and operator booking commands."""
    return {
        "amount_cents": quote.gross_amount_cents,
        "net_amount_cents": quote.net_amount_cents,
        "tax_amount_cents": quote.tax_amount_cents,
        "tax_treatment": quote.treatment,
        "tax_rate_bps": quote.rate_bps,
        "tax_label": quote.label,
        "tax_jurisdiction": quote.jurisdiction,
        "seller_tax_number": payments.seller_tax_number,
        "currency": quote.currency,
    }
