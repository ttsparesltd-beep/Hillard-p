# State machines — Hillard Performance portal

Every record that moves through stages is listed here. A "state machine" is a
status column plus the rules for which status can follow which.

**Where they live, and how they stay in step**

| Layer | File / place | Job |
|---|---|---|
| Database | `supabase/migrations/20261110_explicit_state_machines.sql` (applied live 10 Nov 2026) | CHECK constraints reject unknown statuses; triggers keep the date columns in step; every status column has a COMMENT |
| Front end | `hillard-states.js` → `window.HP_STATES` | labels, colours, allowed next statuses; pages keep a fallback if the file is missing |
| People + agents | this file | the why |

**To add or change a status:** edit `hillard-states.js`, write a new migration
that changes the CHECK constraint, and update the table below. If you only change
one of them, either the page will offer a status the database rejects, or the
database will accept one the page can't display.

---

## 1. Booking — `bookings.status`

```
            ┌──────────── cancelled ◄───────────┐
            │  (reopen)       ▲                 │
            ▼                 │                 │
        pending ──► confirmed ──► in_progress ──► completed
                        │                          ▲
                        └──────────────────────────┘
```

| Status | Meaning | Who moves it |
|---|---|---|
| `pending` | Customer sent a request from hillard-book | customer (insert) |
| `confirmed` | Andy accepted the day; customer has been emailed | **only** the `booking-confirm` edge function (email link → `hillard-confirm.html`, or admin dropdown) |
| `in_progress` | Car is being worked on | admin |
| `completed` | Done | admin |
| `cancelled` | Won't happen; frees the day; can be reopened to pending | admin |

Rules:
- `pending`, `confirmed` and `in_progress` hold the day: one per day, and none on blocked dates (`enforce_one_booking_per_day` trigger).
- When a booking is confirmed, in progress or completed, `confirmed_date` is never empty. A trigger fills it from `preferred_date`.
- `pending → confirmed` sends the customer exactly one email. The function only acts on a pending row, using a conditional update.
- **Opening a link never changes state.** Email security scanners and link previews open links automatically. A GET to `booking-confirm` only redirects to `hillard-confirm.html`, where staff press the button.
- Customer calendar: cancelled bookings are hidden; confirmed, in progress and completed bookings show as confirmed.

## 2. Job sheet — `job_sheets.status` (+ `archived_at`)

```
open ──► progress ──► done ──► invoiced
  (Booked)                       ▲
                                 └── forced by the DB when zoho_invoice_id is set
archived_at: separate hide flag, any status
```

- "Create Zoho invoice" sets `zoho_invoice_id`. The database then forces `status = 'invoiced'` and stamps `invoiced_at`.
- When the Zoho sync later sees that invoice, it writes the car's `service_history` from the sheet's job rows.
- `archived_at` is not a status. It hides a sheet from the work lists (car not coming in, or old). The yard page and the job-sheets page both treat archived sheets as gone.

## 3. Yard car — `yard_cars.status` (depends on `list`)

| list | statuses | end state |
|---|---|---|
| `workshop` | `waiting → on_ramp → done` ("Done — awaiting collection") | `left_at` set by **Collected** |
| `breakers` | `arrived → stripping → shell_gone` | `left_at` set |

The database rejects a workshop status on a breaker, and the other way round.

## 4. Invoice — `invoices.status` (owned by Zoho Books)

The `zoho-invoice-sync` function runs every 30 minutes and copies Zoho's status: `sent`, `viewed`, `overdue`, `partially_paid`, `paid`, `void`.

- **`paid` is sticky locally:** the sync never moves a row off `paid`. "Mark as Paid" in admin therefore wins over Zoho. "Mark Unpaid" writes `unpaid`, which the next sync replaces with Zoho's real status.
- `paid_at` is stamped by a trigger when a row becomes `paid`, and cleared if it stops being paid. The 542 invoices that were paid before 10 Nov 2026 have no `paid_at`, because the date isn't known.
- The portal only ever asks whether an invoice is paid (`HP_STATES.machine('invoice').isPaid`).
- No CHECK constraint here on purpose: Zoho could add a status, and the sync must not fail when it does.

## 5. Quieter machines (flags rather than status columns)

| What | Column | States |
|---|---|---|
| Car in a customer's garage | `vehicles.removed_at` | active ↔ removed (soft delete; re-adding the reg restores it) |
| Customer account | `customers.user_id` | unclaimed (admin-made) → claimed (signup trigger matches the email) |
| Invoice → car/customer | `invoices.vehicle_id`, `customer_id`, `service_history_id` | unallocated → allocated → logged to history |
| Break appraisal | `break_appraisals.status` | only `open` so far. `verdict` (BUY / NEGOTIATE / WALK) is computed on the page and isn't a state |
| Staff access | `public.staff` + `is_admin()` | not staff → staff. Staff pages show empty lists, not errors, for non-staff |

## 6. Known gaps (deliberately not built)

- **Quotes** (`draft → sent → accepted/declined` in hillard-admin.html): the `quotes` table was never created, so nothing could save. The admin page now hides the Quotes entry points while the table is missing. Building quotes is a separate decision.
- **Bookings vs job sheets vs yard** describe the same car visit three times, joined only by the reg. A later step could link `bookings.id → job_sheets → yard_cars`. That isn't done yet, so don't assume it.

## Changelog
- **10 Nov 2026:** made the machines above explicit:
  - CHECK constraints and coherence triggers in the database.
  - Added the missing `bookings.customer_id → customers` foreign key, which is why the admin Bookings and Customers panels had been loading empty.
  - `booking-confirm` v2: no state change on GET; customer details read from the database; only confirms pending bookings; emails once.
  - New `hillard-confirm.html` page.
  - Confirming from the admin dropdown now emails the customer too.
  - Customer calendar hides cancelled bookings.
  - The booking form lets customers pick photos from their gallery, not just take new ones.
