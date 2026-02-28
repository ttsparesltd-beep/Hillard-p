# Hillard Performance — Reminder System Setup Guide

## What you're setting up
A system that automatically emails your customers 30 days before their MOT and service is due. It runs once a day, checks every vehicle in your database, and sends branded reminder emails from your Gmail account. It's smart enough to never send the same reminder twice.

---

## Step 1 — Set up Supabase (your database)

Supabase is free and is where all your customer, vehicle, and invoice data lives.

1. Go to **supabase.com** and create a free account
2. Click **New Project**, name it `hillard-performance`
3. Choose a strong database password and save it somewhere safe
4. Once created, go to **SQL Editor** in the left sidebar
5. Paste the entire contents of `schema.sql` and click **Run**
6. You'll see all your tables created: customers, vehicles, service_history, invoices, reminder_log

**Get your credentials:**
- Go to **Settings → API**
- Copy your **Project URL** → this is your `SUPABASE_URL`
- Copy the **service_role** key (not the anon key) → this is your `SUPABASE_SERVICE_KEY`

---

## Step 2 — Set up Gmail App Password

You need an App Password so the script can send emails from your Gmail without using your main password.

1. Go to **myaccount.google.com**
2. Click **Security** in the left menu
3. Under "How you sign in to Google", click **2-Step Verification** (enable it if not already on)
4. Scroll to the bottom and click **App passwords**
5. Select app: **Mail** | Select device: **Other** → type `Hillard Reminders`
6. Click **Generate** — you'll get a 16-character password like `abcd efgh ijkl mnop`
7. Copy it — you won't see it again

---

## Step 3 — Install and configure the script

On your computer (Mac/Windows/Linux), open Terminal and run:

```bash
# Create a folder for the script
mkdir hillard-reminders
cd hillard-reminders

# Copy reminders.js, email-template.html into this folder

# Install dependencies
npm init -y
npm install nodemailer @supabase/supabase-js dotenv
```

Create a file called `.env` in the same folder (this keeps your secrets safe):

```
GMAIL_USER=bookings@hillardperformance.co.uk
GMAIL_APP_PASSWORD=abcd efgh ijkl mnop
SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGci...
GARAGE_PHONE=01234 567890
GARAGE_ADDRESS=Unit 1, Example Road, Your Town, AB1 2CD
BOOKING_LINK=https://hillardperformance.co.uk/book
APP_LINK=https://mygarage.hillardperformance.co.uk
```

Add this line to the top of `reminders.js`:
```js
require('dotenv').config();
```

---

## Step 4 — Test it

Set a vehicle's MOT expiry to exactly 30 days from today in Supabase, then run:

```bash
node reminders.js
```

You should see:
```
[2026-02-28T08:00:00.000Z] Starting reminder check...
Found 1 active vehicles to check
✓ MOT reminder sent → james@example.com (LD21 XPF) — 30 days
Done. MOT reminders: 1 | Service reminders: 0 | Errors: 0
```

Check your inbox — the branded Hillard Performance email should arrive within seconds.

---

## Step 5 — Schedule it to run every day automatically

### On a Mac/Linux server:
```bash
# Open crontab
crontab -e

# Add this line to run at 8am every morning
0 8 * * * cd /path/to/hillard-reminders && node reminders.js >> /var/log/hillard-reminders.log 2>&1
```

### On Windows:
Use **Task Scheduler** → Create Basic Task → Daily at 8:00am → Action: `node C:\hillard-reminders\reminders.js`

### Hosted option (recommended — runs in the cloud, no computer needed):
- **Railway.app** — free tier, deploy the script, set a cron schedule. No computer needs to be on.
- **Render.com** — same, free cron job service

---

## How it works day-to-day

Once running, the system is fully automatic:

1. Every morning at 8am the script runs
2. It checks every vehicle in your database
3. If a MOT or service due date is exactly 30 days away, it sends the reminder email
4. It logs that the email was sent so it never sends twice
5. Customer gets a beautifully branded email from Hillard Performance

**Adding a new customer/vehicle:** Done via the Admin Panel (coming next). You enter the details once including MOT expiry — reminders handle themselves from there.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `Error: Invalid login` | Check Gmail App Password is correct with no spaces |
| `Error: Failed to fetch vehicles` | Check SUPABASE_URL and SERVICE_KEY in .env |
| Email not arriving | Check spam folder; add bookings@hillardperformance.co.uk to contacts |
| Reminder sent twice | The reminder_log table prevents this — check it's created properly |
