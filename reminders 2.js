// ═══════════════════════════════════════════════════════
// HILLARD PERFORMANCE — Automated Email Reminders
// Run daily via cron: 0 8 * * * node /path/to/reminders.js
// ═══════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── Config (set these as environment variables) ───────
const SUPABASE_URL     = process.env.SUPABASE_URL     || 'https://jkruphtrqlcrwfuoemzt.supabase.co'
const SUPABASE_KEY     = process.env.SUPABASE_SERVICE_KEY  // service role key - set in env
const GMAIL_USER       = process.env.GMAIL_USER            // e.g. hillardperformance@gmail.com
const GMAIL_PASSWORD   = process.env.GMAIL_APP_PASSWORD    // 16-char app password
const GARAGE_NAME      = 'Hillard Performance'
const GARAGE_PHONE     = process.env.GARAGE_PHONE     || '0161 XXX XXXX'
const GARAGE_ADDRESS   = process.env.GARAGE_ADDRESS   || 'Unit 4, Manchester, M16 9PX'
const BOOKING_LINK     = process.env.BOOKING_LINK     || 'https://hillardperformance.co.uk/book'
const REMINDER_DAYS    = [30, 14, 7]  // Send reminders at these thresholds

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: GMAIL_USER, pass: GMAIL_PASSWORD }
})

// ── Email template ────────────────────────────────────
function buildEmail({ customerName, vehicleReg, vehicleName, type, expiryDate, daysLeft }) {
  const isUrgent = daysLeft <= 7
  const isMOT = type === 'mot'
  const accentColor = isUrgent ? '#e8291c' : '#f59e0b'
  const typeLabel = isMOT ? 'MOT' : 'Service'
  const subject = daysLeft <= 0
    ? `⚠️ ${typeLabel} Overdue — ${vehicleReg}`
    : `Your ${vehicleReg} ${typeLabel} is due in ${daysLeft} days`

  const html = `
<!DOCTYPE html><html><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@700&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet">
</head>
<body style="background:#0a0a0b;margin:0;padding:40px 20px;font-family:'DM Sans',sans-serif;">
<div style="max-width:520px;margin:0 auto;">

  <!-- Logo -->
  <div style="margin-bottom:32px;">
    <div style="font-family:'Rajdhani',sans-serif;font-size:28px;font-weight:700;letter-spacing:0.1em;color:#ffffff;text-transform:uppercase;">
      HILLARD<br><span style="color:#e8291c;">PERFORMANCE</span>
    </div>
  </div>

  <!-- Card -->
  <div style="background:#111114;border:1px solid #2a2a32;border-radius:16px;overflow:hidden;">
    <div style="height:4px;background:${accentColor};"></div>
    <div style="padding:32px;">
      <p style="color:#6b6b7a;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:8px;">${typeLabel} Reminder</p>
      <h1 style="font-family:'Rajdhani',sans-serif;font-size:28px;font-weight:700;color:#f0f0f4;margin-bottom:24px;line-height:1.2;">
        ${daysLeft <= 0 ? `Your ${typeLabel} is overdue` : `Your ${typeLabel} is due in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}`}
      </h1>

      <p style="color:#b0b0be;font-size:15px;line-height:1.6;margin-bottom:28px;">
        Hi ${customerName}, your <strong style="color:#f0f0f4;">${vehicleName}</strong> is ${daysLeft <= 0 ? 'overdue for its' : `due for its ${typeLabel.toLowerCase()} on`} <strong style="color:#f0f0f4;">${expiryDate}</strong>.
        ${isMOT ? 'Driving with an expired MOT is illegal and could invalidate your insurance.' : 'Keeping on top of your service schedule protects your engine and your warranty.'}
      </p>

      <!-- Reg plate -->
      <div style="background:#f0c000;border-radius:6px;padding:10px 20px;display:inline-block;margin-bottom:28px;">
        <span style="font-family:'Rajdhani',sans-serif;font-size:24px;font-weight:700;letter-spacing:0.2em;color:#111;">${vehicleReg}</span>
      </div>

      <!-- Days pill -->
      <div style="background:${accentColor}22;border:1px solid ${accentColor}44;border-radius:10px;padding:14px 18px;margin-bottom:28px;display:flex;align-items:center;gap:12px;">
        <span style="font-family:'Rajdhani',sans-serif;font-size:36px;font-weight:700;color:${accentColor};">${Math.abs(daysLeft)}</span>
        <span style="color:#b0b0be;font-size:14px;">${daysLeft <= 0 ? 'days overdue' : 'days remaining'}</span>
      </div>

      <!-- CTA -->
      <a href="${BOOKING_LINK}" style="display:block;background:#e8291c;color:white;text-decoration:none;text-align:center;padding:16px;border-radius:10px;font-family:'Rajdhani',sans-serif;font-size:16px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;">
        Book Now at ${GARAGE_NAME}
      </a>
    </div>
  </div>

  <!-- Footer -->
  <div style="margin-top:24px;text-align:center;color:#3a3a45;font-size:12px;line-height:1.7;">
    ${GARAGE_NAME} · ${GARAGE_ADDRESS}<br>
    ${GARAGE_PHONE} · <a href="mailto:${GMAIL_USER}" style="color:#3a3a45;">${GMAIL_USER}</a>
  </div>
</div>
</body></html>`

  return { subject, html }
}

// ── Check if reminder already sent ───────────────────
async function alreadySent(vehicleId, type, daysBeforeThreshold) {
  const since = new Date()
  since.setDate(since.getDate() - 3) // Don't resend within 3 days

  const { data } = await supabase
    .from('reminder_log')
    .select('id')
    .eq('vehicle_id', vehicleId)
    .eq('reminder_type', type)
    .eq('days_before', daysBeforeThreshold)
    .gte('sent_at', since.toISOString())
    .single()

  return !!data
}

// ── Send one reminder ─────────────────────────────────
async function sendReminder(customer, vehicle, type, daysLeft, threshold) {
  const expiryDate = type === 'mot' ? vehicle.mot_expiry : vehicle.service_due
  const { subject, html } = buildEmail({
    customerName: customer.first_name,
    vehicleReg: vehicle.registration,
    vehicleName: `${vehicle.make} ${vehicle.model}`,
    type,
    expiryDate: new Date(expiryDate).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' }),
    daysLeft
  })

  await transporter.sendMail({
    from: `"${GARAGE_NAME}" <${GMAIL_USER}>`,
    to: customer.email,
    subject,
    html
  })

  // Log it
  await supabase.from('reminder_log').insert({
    vehicle_id: vehicle.id,
    reminder_type: type,
    days_before: threshold
  })

  console.log(`✓ Sent ${type} reminder to ${customer.email} (${vehicle.registration}) — ${daysLeft} days`)
}

// ── Main ──────────────────────────────────────────────
async function run() {
  console.log(`\n🚗 Hillard Performance — Running reminders at ${new Date().toLocaleString()}\n`)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Get all vehicles with MOT or service dates set
  const { data: vehicles, error } = await supabase
    .from('vehicles')
    .select('*, customers(first_name, last_name, email)')
    .or('mot_expiry.not.is.null,service_due.not.is.null')

  if (error) { console.error('Error fetching vehicles:', error); return }

  let sent = 0

  for (const vehicle of vehicles) {
    const customer = vehicle.customers
    if (!customer?.email) continue

    for (const type of ['mot', 'service']) {
      const dateField = type === 'mot' ? vehicle.mot_expiry : vehicle.service_due
      if (!dateField) continue

      const expiryDate = new Date(dateField)
      const daysLeft = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24))

      // Find the closest threshold
      const threshold = REMINDER_DAYS.find(d => daysLeft <= d && daysLeft > (REMINDER_DAYS[REMINDER_DAYS.indexOf(d) + 1] || -Infinity))
      if (!threshold && daysLeft > 0) continue

      const alreadySentThis = await alreadySent(vehicle.id, type, threshold || 0)
      if (alreadySentThis) continue

      try {
        await sendReminder(customer, vehicle, type, daysLeft, threshold || 0)
        sent++
      } catch (err) {
        console.error(`✗ Failed to send to ${customer.email}:`, err.message)
      }
    }
  }

  console.log(`\n✅ Done — ${sent} reminder${sent !== 1 ? 's' : ''} sent\n`)
}

run()
