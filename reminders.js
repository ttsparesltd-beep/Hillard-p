/**
 * Hillard Performance — MOT & Service Reminder System
 * =====================================================
 * Runs daily via cron. Checks all vehicles and sends
 * reminder emails at 30 days before MOT or service due.
 *
 * Stack: Node.js + Nodemailer (Gmail) + Supabase
 * Run daily with: node reminders.js
 * Or schedule with cron: 0 8 * * * node /path/to/reminders.js
 */

const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// ─── Config ────────────────────────────────────────────────────────────────
const CONFIG = {
  // Gmail — use an App Password (not your main password)
  // Generate at: myaccount.google.com/apppasswords
  gmail: {
    user: process.env.GMAIL_USER,           // e.g. bookings@hillardperformance.co.uk
    appPassword: process.env.GMAIL_APP_PASSWORD,
    fromName: 'Hillard Performance'
  },

  // Supabase — your database
  supabase: {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_KEY   // Use service key for server-side
  },

  // Your garage details (shown in emails)
  garage: {
    name: 'Hillard Performance',
    phone: process.env.GARAGE_PHONE || '01234 567890',
    address: process.env.GARAGE_ADDRESS || 'Unit 1, Example Road, Your Town, AB1 2CD',
    bookingLink: process.env.BOOKING_LINK || 'https://hillardperformance.co.uk/book',
    appLink: process.env.APP_LINK || 'https://mygarage.hillardperformance.co.uk'
  },

  // Reminder thresholds in days
  reminders: {
    mot: [30],       // Send at 30 days before MOT
    service: [30]    // Send at 30 days before service due
  }
};

// ─── Init ──────────────────────────────────────────────────────────────────
const supabase = createClient(CONFIG.supabase.url, CONFIG.supabase.key);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: CONFIG.gmail.user,
    pass: CONFIG.gmail.appPassword
  }
});

// Load email template
const emailTemplate = fs.readFileSync(
  path.join(__dirname, 'email-template.html'), 'utf8'
);

// ─── Main ──────────────────────────────────────────────────────────────────
async function runReminders() {
  console.log(`[${new Date().toISOString()}] Starting reminder check...`);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let motSent = 0;
  let serviceSent = 0;
  let errors = 0;

  // Fetch all active vehicles with customer info
  const { data: vehicles, error } = await supabase
    .from('vehicles')
    .select(`
      id,
      registration,
      make,
      model,
      year,
      mot_expiry_date,
      service_due_date,
      customers (
        id,
        name,
        email,
        reminders_enabled
      )
    `)
    .eq('active', true);

  if (error) {
    console.error('Failed to fetch vehicles:', error.message);
    process.exit(1);
  }

  console.log(`Found ${vehicles.length} active vehicles to check`);

  for (const vehicle of vehicles) {
    const customer = vehicle.customers;

    // Skip if customer has opted out of reminders
    if (!customer || !customer.email || customer.reminders_enabled === false) {
      continue;
    }

    // ── MOT reminders ──────────────────────────────────────────────────
    if (vehicle.mot_expiry_date) {
      const motExpiry = new Date(vehicle.mot_expiry_date);
      const daysUntilMot = Math.round((motExpiry - today) / (1000 * 60 * 60 * 24));

      for (const threshold of CONFIG.reminders.mot) {
        if (daysUntilMot === threshold) {
          const alreadySent = await checkAlreadySent(vehicle.id, 'mot', threshold);
          if (!alreadySent) {
            try {
              await sendMotReminder(customer, vehicle, daysUntilMot, motExpiry);
              await logReminderSent(vehicle.id, customer.id, 'mot', threshold);
              motSent++;
              console.log(`✓ MOT reminder sent → ${customer.email} (${vehicle.registration}) — ${daysUntilMot} days`);
            } catch (e) {
              errors++;
              console.error(`✗ Failed to send MOT reminder to ${customer.email}:`, e.message);
            }
          }
        }
      }
    }

    // ── Service reminders ──────────────────────────────────────────────
    if (vehicle.service_due_date) {
      const serviceDue = new Date(vehicle.service_due_date);
      const daysUntilService = Math.round((serviceDue - today) / (1000 * 60 * 60 * 24));

      for (const threshold of CONFIG.reminders.service) {
        if (daysUntilService === threshold) {
          const alreadySent = await checkAlreadySent(vehicle.id, 'service', threshold);
          if (!alreadySent) {
            try {
              await sendServiceReminder(customer, vehicle, daysUntilService, serviceDue);
              await logReminderSent(vehicle.id, customer.id, 'service', threshold);
              serviceSent++;
              console.log(`✓ Service reminder sent → ${customer.email} (${vehicle.registration}) — ${daysUntilService} days`);
            } catch (e) {
              errors++;
              console.error(`✗ Failed to send service reminder to ${customer.email}:`, e.message);
            }
          }
        }
      }
    }
  }

  console.log(`\nDone. MOT reminders: ${motSent} | Service reminders: ${serviceSent} | Errors: ${errors}`);
}

// ─── Send MOT reminder ─────────────────────────────────────────────────────
async function sendMotReminder(customer, vehicle, daysRemaining, expiryDate) {
  const html = buildEmail(emailTemplate, {
    CUSTOMER_NAME: customer.name,
    VEHICLE_MAKE: vehicle.make,
    VEHICLE_MODEL: vehicle.model || '',
    VEHICLE_REG: formatReg(vehicle.registration),
    VEHICLE_YEAR: vehicle.year || '',
    MOT_EXPIRY_DATE: formatDate(expiryDate),
    DAYS_REMAINING: `${daysRemaining} days`,
    BOOKING_LINK: CONFIG.garage.bookingLink,
    PHONE: CONFIG.garage.phone,
    GARAGE_ADDRESS: CONFIG.garage.address,
    UNSUBSCRIBE_LINK: `${CONFIG.garage.appLink}/unsubscribe?customer=${customer.id}`
  });

  await transporter.sendMail({
    from: `"${CONFIG.gmail.fromName}" <${CONFIG.gmail.user}>`,
    to: customer.email,
    subject: `⚠ MOT due in ${daysRemaining} days — ${vehicle.registration}`,
    html
  });
}

// ─── Send Service reminder ─────────────────────────────────────────────────
async function sendServiceReminder(customer, vehicle, daysRemaining, dueDate) {
  // Clone template and swap MOT language for Service language
  let html = buildEmail(emailTemplate, {
    CUSTOMER_NAME: customer.name,
    VEHICLE_MAKE: vehicle.make,
    VEHICLE_MODEL: vehicle.model || '',
    VEHICLE_REG: formatReg(vehicle.registration),
    VEHICLE_YEAR: vehicle.year || '',
    MOT_EXPIRY_DATE: formatDate(dueDate),
    DAYS_REMAINING: `${daysRemaining} days`,
    BOOKING_LINK: CONFIG.garage.bookingLink,
    PHONE: CONFIG.garage.phone,
    GARAGE_ADDRESS: CONFIG.garage.address,
    UNSUBSCRIBE_LINK: `${CONFIG.garage.appLink}/unsubscribe?customer=${customer.id}`
  });

  // Swap MOT-specific text for service text
  html = html
    .replace(/MOT Due in 30 Days/g, 'Service Due in 30 Days')
    .replace(/Time to book your MOT/g, 'Time to book your service')
    .replace(/your MOT is due soon/g, 'your annual service is due soon')
    .replace(/Book My MOT/g, 'Book My Service')
    .replace(/MOT Expiry/g, 'Service Due')
    .replace(/without a valid MOT can invalidate your insurance/g, 'with an overdue service can cause preventable damage');

  await transporter.sendMail({
    from: `"${CONFIG.gmail.fromName}" <${CONFIG.gmail.user}>`,
    to: customer.email,
    subject: `🔧 Service due in ${daysRemaining} days — ${vehicle.registration}`,
    html
  });
}

// ─── Helpers ───────────────────────────────────────────────────────────────

// Replace all {{PLACEHOLDERS}} in template
function buildEmail(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || '');
}

// Check if we already sent this reminder (prevents duplicates if script runs twice)
async function checkAlreadySent(vehicleId, type, threshold) {
  const { data } = await supabase
    .from('reminder_log')
    .select('id')
    .eq('vehicle_id', vehicleId)
    .eq('reminder_type', type)
    .eq('days_threshold', threshold)
    .gte('sent_at', new Date(new Date().getFullYear(), 0, 1).toISOString()) // This year
    .limit(1);

  return data && data.length > 0;
}

// Log that a reminder was sent
async function logReminderSent(vehicleId, customerId, type, threshold) {
  await supabase.from('reminder_log').insert({
    vehicle_id: vehicleId,
    customer_id: customerId,
    reminder_type: type,
    days_threshold: threshold,
    sent_at: new Date().toISOString()
  });
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
}

function formatReg(reg) {
  reg = reg.replace(/\s/g, '');
  if (reg.length === 7) return reg.slice(0, 4) + ' ' + reg.slice(4);
  return reg;
}

// ─── Run ───────────────────────────────────────────────────────────────────
runReminders().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
