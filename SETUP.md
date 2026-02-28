# Hillard Performance — Setup Guide

## Step 1: Run the database schema in Supabase

1. Go to **supabase.com** → your project
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**
4. Open `schema.sql` from this folder
5. Copy the entire contents and paste into the editor
6. Click **Run**
7. You should see "Success. No rows returned"

That creates all your tables with the right security rules.

---

## Step 2: Enable Email Auth in Supabase

1. Supabase → **Authentication** → **Providers**
2. Make sure **Email** is enabled
3. Click **Email** → turn on **"Enable Email OTP (Magic Link)"**
4. Set **Site URL** to your Vercel URL (e.g. `https://hillardperformance.vercel.app`)
5. Add your Vercel URL to **Redirect URLs**

---

## Step 3: Deploy to Vercel

1. Go to **vercel.com** → **Add New Project**
2. Upload your HTML files (or connect a GitHub repo)
3. Add these **Environment Variables** in Vercel settings:

| Key | Value |
|-----|-------|
| `SUPABASE_URL` | `https://jkruphtrqlcrwfuoemzt.supabase.co` |
| `SUPABASE_ANON_KEY` | your anon key |
| `SUPABASE_SERVICE_KEY` | your service role key |
| `GMAIL_USER` | your gmail address |
| `GMAIL_APP_PASSWORD` | your 16-char app password |
| `STRIPE_PUBLISHABLE_KEY` | your stripe key |

4. Deploy — Vercel gives you a live URL immediately

---

## Step 4: Set up the reminder script

### Option A — Run on your own computer (simplest)
```bash
# Install dependencies
npm install

# Copy env file and fill in your values
cp .env.example .env
nano .env

# Test it manually
npm run reminders

# Schedule to run daily at 8am (Mac/Linux)
crontab -e
# Add this line:
0 8 * * * cd /path/to/hillard-app && node reminders.js >> reminders.log 2>&1
```

### Option B — Run on Railway.app (free, always on)
1. Go to **railway.app** → New Project → Deploy from GitHub
2. Add your environment variables in Railway dashboard
3. Set start command to: `node reminders.js`
4. Add a cron schedule: `0 8 * * *`

---

## Step 5: Add your Stripe Payment Links

1. Go to **stripe.com** → **Payment Links** → **Create**
2. Create a link for each invoice (or a flexible amount link)
3. In the admin panel when creating invoices, paste the Stripe link
4. The Pay Now button in the customer app will open it directly

---

## Step 6: Add your custom domain (optional)

1. Vercel → your project → **Settings** → **Domains**
2. Add `app.hillardperformance.co.uk` (or whatever you want)
3. Follow Vercel's DNS instructions — takes about 10 minutes

---

## Quick test checklist

- [ ] Schema ran in Supabase without errors
- [ ] Can see tables in Supabase → Table Editor
- [ ] Vercel deployment is live
- [ ] Auth magic link works (send yourself a test login email)
- [ ] Reminder script sends a test email
- [ ] Stripe payment link opens correctly

