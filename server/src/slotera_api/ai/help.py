"""Curated customer-safe help, separate from internal project instructions."""

HELP = {
    "assistant": (
        "Ask Slotera and briefings",
        (
            "Settings → AI requires explicit workspace opt-in. Ask Slotera answers cite records; "
            "proposed changes need Review change and Confirm change. Clients → choose a "
            "client → Brief me creates a client briefing. Refresh briefing has a 15-minute "
            "cooldown. "
            "Clear history removes chats and briefings; Disable also removes the search index. "
            "Client erasure clears all workspace AI history."
        ),
        "/admin/assistant",
    ),
    "bookings": (
        "Bookings",
        (
            "Bookings → New booking adds an existing or new client to an upcoming "
            "session with room. Free operator bookings confirm; paid bookings await"
            " manually recorded payment; a client's paid package can cover the "
            "session. Open a booking for forms, email history, reviewed actions and "
            "Record refund, which lowers revenue by money given back outside Slotera."
        ),
        "/admin/bookings",
    ),
    "calendar": (
        "Calendar",
        (
            "Calendar creates session times. Open a session to edit time, location "
            "or capacity, manage attendees, or cancel. Reviewed changes show "
            "affected bookings; paid cancellations may need a manually arranged "
            "refund. Following-scope changes retain recurrence dates."
        ),
        "/admin/calendar",
    ),
    "clients": (
        "Clients and messages",
        (
            "Clients stores private profiles and notes. Messages opens one "
            "conversation per client. Clients sign in through workspace-specific "
            "email links and can view their own messages, bookings and preferences."
            " Notes and tasks are never visible to clients. A client page's Packages"
            " card records package sales, payments, refunds and voids."
        ),
        "/admin/clients",
    ),
    "forms": (
        "Forms",
        (
            "Forms creates reusable intake/preparation questions. Bookings snapshot"
            " active attached forms; template edits do not change existing "
            "questions. Answers are one-time submissions. Follow-up forms have a "
            "separate 30-day response window after queueing."
        ),
        "/admin/forms",
    ),
    "packages": (
        "Package offers",
        (
            "Packages are ordered service offers. Clients can request one on the "
            "booking page and pay by bank transfer, or the consultant records a sale"
            " on the client page and marks it paid. Signed-in clients book the paid "
            "sessions themselves; cancelling gives a session back. There is no "
            "expiry or card payment."
        ),
        "/admin/packages",
    ),
    "settings": (
        "Settings",
        (
            "Business Profile includes branding, client-page colours and fonts. "
            "Notifications holds email preferences; mobile push settings are not implemented. "
            "Settings → Account changes language and message-digest preferences. "
            "Client Payments owns manual instructions and tax treatment. "
            "Subscription changes are staff processed requests. AI settings enable "
            "or disable private assistance and show usage."
        ),
        "/admin/settings",
    ),
    "tasks": (
        "To-do",
        (
            "Dashboard To-do is a simple general checklist: New to-do adds a title and an "
            "optional description, and each checkbox completes or reopens it. Ask Slotera "
            "can add or remove a general to-do after review and confirmation. Session "
            "tasks stay in Calendar. Your next call shows the next session's details."
        ),
        "/admin/dashboard",
    ),
    "followups": (
        "Follow-up",
        (
            "Services → Edit → Follow-up configures automatic completion-owned "
            "follow-up rules and an optional form. Booking details offer reviewed "
            "Send now or Skip after completion. Client automatic-email preferences "
            "do not block reviewed manual sends."
        ),
        "/admin/services",
    ),
}
