# ruff: noqa: E501
"""Small email dictionaries; provider-written content is interpolated unchanged."""

from datetime import datetime
from zoneinfo import ZoneInfo

TEXT: dict[str, dict[str, str]] = {
    "tr": {
        "details": "Randevu bilgileri",
        "details_intro": "Güncel randevu bilgileriniz.",
        "status": "Durum",
        "pending": "Ödeme veya onay bekleniyor",
        "completed": "Tamamlandı",
        "noshow": "Katılmadı",
        "reference": "Referans",
        "service": "Hizmet",
        "provider": "Danışman",
        "when": "Zaman",
        "where": "Konum",
        "join": "Çevrimiçi katıl",
        "policy": "İptal koşulları",
        "received": "Rezervasyon alındı",
        "confirmed": "Rezervasyon onaylandı",
        "reminder": "Hatırlatma",
        "rescheduled": "Rezervasyon taşındı",
        "cancelled": "Rezervasyon iptal edildi",
        "received_intro": "Rezervasyonunuzu aldık. Henüz onaylanmadı.",
        "confirmed_intro": "Rezervasyonunuz onaylandı.",
        "reminder_intro": "Seansınız yaklaşıyor.",
        "rescheduled_intro": "Rezervasyonunuzun zamanı değişti.",
        "cancelled_intro": "Rezervasyonunuz iptal edildi.",
        "approval": "Danışman, onaylamadan önce talebinizi inceleyecek.",
        "due": "Beklenen manuel ödeme",
        "deadline": "Son ödeme tarihi",
        "instructions": "Ödeme talimatları",
        "later": "Rezervasyon onaylandığında başka bir e-posta alacaksınız.",
        "manage": "Rezervasyonunuzu görüntüleyin, taşıyın veya iptal edin:",
        "keep": "Bu e-postayı ve referansı kayıtlarınız için saklayın.",
        "refund": "İadeler, danışmanın iptal koşullarına göre danışman tarafından yapılır.",
        "calendar": "Değiştirmek veya iptal etmek için onay e-postanızdaki bağlantıyı kullanın.",
        "with": "ile",
        "client": "Bir müşteri",
        "new": "Yeni rezervasyon",
        "operator_new": "{client}, {service} hizmeti için rezervasyon yaptı.",
        "operator_rescheduled": "{client}, {service} rezervasyonunu yeni bir zamana taşıdı.",
        "operator_cancelled": "{client}, {service} rezervasyonunu iptal etti.",
        "waiting": "Onayınızı bekliyor.",
        "unpaid": "Manuel ödeme henüz kaydedilmedi.",
        "open": "Rezervasyonu Slotera'da açın:",
        "activation": "Slotera hesabınızı etkinleştirin veya şifrenizi sıfırlayın",
        "hello": "Merhaba {name}",
        "activate": "Hesabınızı etkinleştirmek veya şifrenizi sıfırlamak için bu tek kullanımlık bağlantıyı açın:",
        "expires": "Bağlantının son geçerlilik zamanı",
        "ignore": "Bu isteği siz yapmadıysanız bu e-postayı dikkate almayın.",
        "footer": "Bu otomatik bir mesajdır; bu adrese gönderilen yanıtlar okunmaz.",
        "contact": "Sorularınız için doğrudan danışmanınızla iletişime geçin.",
        "change": "Rezervasyonunuzu değiştirmek için yukarıdaki bağlantıyı kullanın.",
    },
    "de": {
        "details": "Buchungsdetails",
        "details_intro": "Ihre aktuellen Buchungsdetails.",
        "status": "Status",
        "pending": "Zahlung oder Bestätigung ausstehend",
        "completed": "Abgeschlossen",
        "noshow": "Nicht erschienen",
        "reference": "Referenz",
        "service": "Leistung",
        "provider": "Anbieter",
        "when": "Zeit",
        "where": "Ort",
        "join": "Online teilnehmen",
        "policy": "Stornierungsbedingungen",
        "received": "Buchung eingegangen",
        "confirmed": "Buchung bestätigt",
        "reminder": "Erinnerung",
        "rescheduled": "Buchung verschoben",
        "cancelled": "Buchung storniert",
        "received_intro": "Wir haben Ihre Buchung erhalten. Sie ist noch nicht bestätigt.",
        "confirmed_intro": "Ihre Buchung ist bestätigt.",
        "reminder_intro": "Ihr Termin steht bevor.",
        "rescheduled_intro": "Ihre Buchung hat eine neue Uhrzeit.",
        "cancelled_intro": "Ihre Buchung wurde storniert.",
        "approval": "Der Anbieter prüft Ihre Anfrage vor der Bestätigung.",
        "due": "Ausstehende manuelle Zahlung",
        "deadline": "Zahlungsfrist",
        "instructions": "Zahlungsanweisungen",
        "later": "Sie erhalten eine weitere E-Mail, sobald die Buchung bestätigt ist.",
        "manage": "Buchung ansehen, verschieben oder stornieren:",
        "keep": "Bewahren Sie diese E-Mail und die Referenz für Ihre Unterlagen auf.",
        "refund": "Erstattungen erfolgen durch den Anbieter gemäß seinen Stornierungsbedingungen.",
        "calendar": "Nutzen Sie zum Ändern oder Stornieren den Link in Ihrer Bestätigungs-E-Mail.",
        "with": "mit",
        "client": "Ein Kunde",
        "new": "Neue Buchung",
        "operator_new": "{client} hat {service} gebucht.",
        "operator_rescheduled": "{client} hat die Buchung für {service} auf eine neue Zeit verschoben.",
        "operator_cancelled": "{client} hat die Buchung für {service} storniert.",
        "waiting": "Die Buchung wartet auf Ihre Genehmigung.",
        "unpaid": "Die manuelle Zahlung wurde noch nicht erfasst.",
        "open": "Buchung in Slotera öffnen:",
        "activation": "Slotera-Konto aktivieren oder Passwort zurücksetzen",
        "hello": "Hallo {name}",
        "activate": "Öffnen Sie diesen einmaligen Link, um Ihr Konto zu aktivieren oder Ihr Passwort zurückzusetzen:",
        "expires": "Dieser Link läuft ab am",
        "ignore": "Falls Sie dies nicht angefordert haben, ignorieren Sie diese E-Mail.",
        "footer": "Dies ist eine automatische Nachricht; Antworten an diese Adresse werden nicht gelesen.",
        "contact": "Wenden Sie sich bei Fragen direkt an Ihren Anbieter.",
        "change": "Nutzen Sie den obigen Link, um Ihre Buchung zu ändern.",
    },
}


def language(raw: dict[str, object]) -> str:
    value = raw.get("language", "en")
    return str(value) if value in ("tr", "de") else "en"


def date_text(value: str, timezone: str, lang: str) -> str:
    at = datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(ZoneInfo(timezone))
    weekdays = {
        "tr": ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"],
        "de": ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"],
    }
    months = {
        "tr": [
            "Ocak",
            "Şubat",
            "Mart",
            "Nisan",
            "Mayıs",
            "Haziran",
            "Temmuz",
            "Ağustos",
            "Eylül",
            "Ekim",
            "Kasım",
            "Aralık",
        ],
        "de": [
            "Januar",
            "Februar",
            "März",
            "April",
            "Mai",
            "Juni",
            "Juli",
            "August",
            "September",
            "Oktober",
            "November",
            "Dezember",
        ],
    }
    if lang == "en":
        return at.strftime("%A, %d %B %Y at %H:%M %Z")
    return f"{weekdays[lang][at.weekday()]}, {at.day} {months[lang][at.month - 1]} {at.year} {at:%H:%M %Z}"


def render_localized(kind: str, raw: dict[str, object]) -> tuple[str, str]:
    lang = language(raw)
    text = TEXT[lang]
    if kind == "account_activation":
        return text["activation"], "\n\n".join(
            [
                text["hello"].format(name=raw.get("firstName", "")),
                text["activate"],
                str(raw["resetUrl"]),
                f"{text['expires']}: {date_text(str(raw['expiresAt']), 'UTC', lang)}",
                text["ignore"],
            ]
        )
    event = (
        kind.removeprefix("operator_booking_")
        if kind.startswith("operator_")
        else kind.removeprefix("booking_")
    )
    service = str(raw["serviceName"])
    when = date_text(str(raw["startsAt"]), str(raw["timezone"]), lang)
    if kind.startswith("operator_"):
        client = str(raw.get("clientName") or text["client"])
        subject = f"{text[event]}: {client}, {service}"
        lines = [
            text[f"operator_{event}"].format(client=client, service=service),
            "",
            f"{text['reference']}: {raw['reference']}",
            f"{text['when']}: {when}",
        ]
        if event != "cancelled":
            if raw.get("approvalStatus") == "pending":
                lines.append(text["waiting"])
            if raw.get("paymentStatus") == "pending":
                lines.append(text["unpaid"])
        return subject, "\n".join([*lines, "", text["open"], str(raw["adminUrl"])])
    lines = [
        text[f"{event}_intro"],
        "",
        f"{text['reference']}: {raw['reference']}",
        f"{text['service']}: {service}",
        f"{text['provider']}: {raw['providerName']}",
        f"{text['when']}: {when}",
    ]
    from slotera_api.email.templates import BookingEmailTemplateData, _where

    data = BookingEmailTemplateData.model_validate(raw)
    if _where(data):
        lines.append(f"{text['where']}: {_where(data)}")
    if raw.get("meetingUrl"):
        lines.append(f"{text['join']}: {raw['meetingUrl']}")
    if raw.get("cancellationRule"):
        lines.append(f"{text['policy']}: {raw['cancellationRule']}")
    if event == "details":
        state = str(raw.get("bookingStatus", "pending"))
        lines.append(f"{text['status']}: {text[state]}")
    if event == "received" or (event == "details" and raw.get("bookingStatus") != "cancelled"):
        if raw.get("approvalStatus") == "pending":
            lines.append(text["approval"])
        if raw.get("paymentStatus") == "pending":
            amount = (
                f"{int(str(raw['amountCents'])) / 100:,.2f}".replace(",", "_")
                .replace(".", ",")
                .replace("_", ".")
            )
            lines += [f"{text['due']}: {amount} {raw['currency']}"]
            if raw.get("paymentDueAt"):
                lines.append(
                    f"{text['deadline']}: {date_text(str(raw['paymentDueAt']), str(raw['timezone']), lang)}"
                )
            if raw.get("manualPaymentInstructions"):
                lines += [text["instructions"] + ":", str(raw["manualPaymentInstructions"])]
        if event == "received":
            lines.append(text["later"])
    if raw.get("manageUrl"):
        lines += ["", text["manage"], str(raw["manageUrl"])]
    if event == "confirmed":
        lines.append(text["keep"])
    if event == "cancelled":
        lines.append(text["refund"])
    return f"{text[event]} — {service}", "\n".join(lines)
