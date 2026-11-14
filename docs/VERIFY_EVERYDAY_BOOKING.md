# Verify everyday booking and email recovery

The local database has already been reset to the two-migration showcase baseline.

## Start

```bash
SLOTERA_EMAIL_PROVIDER=console ./scripts/dev --api
```

Open `http://localhost:3344/login`; sign in with `hello@slotera.io` / `slotera-local-only`.
Console delivery sends no real email; management links appear in `.logs/worker.log`.
To repeat a clean reset later: stop the stack, run `./scripts/reset-db`, then start again.

## Release 1: booking creation

1. **Bookings → New booking → Client: New client**; enter name/email, choose an available
   **Discovery Call**, then **Create booking** → the booking is **Confirmed** and one client exists.
2. **Bookings → New booking → New client**; enter that same email, choose a **Group Workshop**,
   then **Create booking** → a duplicate warning offers **Find existing client**; explicitly
   select them and create → paid booking is **Pending**.
3. Choose **Deutsch** or **Türkçe**, uncheck **Send details now**, and create a booking →
   **Booking details → Emails** is empty; **Mark payment received → Record payment** later confirms
   the booking and sends its confirmation in the chosen language.
4. **Clients → a client → Book a session**, or **Calendar → an upcoming session → Add attendee**
   → the relevant client/session is preselected; full, past and cancelled sessions are unavailable.
5. For required forms, first use **Calendar → New session → Strategy Session** at an empty
   future time, then book into it; open the console email's management link, complete its
   **Form answers**, and **Submit answers** → answers become read-only and payment stays unchanged.

## Release 2: email recovery

1. **Bookings → a booking → Emails → Send booking details**; review the destination and
   confirm → one new email appears, then **Sent** with **Local / simulated delivery**.
2. Open **Send booking details**, edit the destination, and choose **Correct address and send**
   → future booking emails use that address; the client profile and original contact stay unchanged.
3. Reopen the previous management link → it is invalid after correction; the new email's link works.
4. **Cancel booking → Cancel booking (confirmation) → Emails → Send booking details** → the summary says cancelled
   and contains no active management link; cancelled payments are never automatically refunded.

Switch **EN / TR / DE** and repeat at phone width; controls, validation, dates and email labels
should remain readable. A provider-accepted email is not proof of inbox delivery.
