/* hillard-states.js — the app's state machines in one place.
 *
 * Every status a record can be in, what it's called on screen, its colour,
 * and which statuses it can move to next. The database enforces the same
 * status lists (CHECK constraints, see supabase/migrations/20261110_*),
 * and STATE_MACHINES.md explains each one in plain English.
 *
 * Pages read window.HP_STATES but always keep their own fallback, so a page
 * still works if this file ever fails to upload.
 *
 * To add a status: add it here, add it to the CHECK constraint in a new
 * migration, and update STATE_MACHINES.md. Keep the three in step.
 */
(function () {
  var M = {
    booking: {
      table: 'bookings', column: 'status', initial: 'pending',
      states: {
        pending:     { label: 'Pending',     color: '#f0c000', next: ['confirmed', 'cancelled'] },
        confirmed:   { label: 'Confirmed',   color: '#4a9eff', next: ['in_progress', 'completed', 'cancelled', 'pending'] },
        in_progress: { label: 'In progress', color: '#a855f7', next: ['completed', 'cancelled'] },
        completed:   { label: 'Completed',   color: '#4ade80', next: [], terminal: true },
        cancelled:   { label: 'Cancelled',   color: '#6b6b7a', next: ['pending'] }   // can be reopened
      },
      // Statuses that hold a day in the diary (matches enforce_one_booking_per_day).
      active: ['pending', 'confirmed', 'in_progress'],
      // Confirming a pending booking must go through the booking-confirm function
      // so the customer is emailed exactly once.
      confirmVia: 'booking-confirm'
    },

    jobSheet: {
      table: 'job_sheets', column: 'status', initial: 'open',
      states: {
        open:     { label: 'Booked',      color: '#4a9eff', next: ['progress', 'done'] },
        progress: { label: 'In progress', color: '#f0c000', next: ['done', 'open'] },
        done:     { label: 'Done',        color: '#4ade80', next: ['invoiced', 'progress'] },
        invoiced: { label: 'Invoiced',    color: '#3ddc84', next: [], terminal: true }
      },
      // archived_at is a separate hide flag, not a status. Setting zoho_invoice_id
      // makes the database force status = invoiced.
      isInvoiced: function (r) { return !!r && (r.status === 'invoiced' || !!r.zoho_invoice_id); }
    },

    yardWorkshop: {
      table: 'yard_cars', column: 'status', where: { list: 'workshop' }, initial: 'waiting',
      states: {
        waiting: { label: 'Waiting',                   next: ['on_ramp', 'done'] },
        on_ramp: { label: 'On ramp',                   next: ['done', 'waiting'] },
        done:    { label: 'Done — awaiting collection', next: ['on_ramp'] }
      },
      // left_at set = gone from the yard (final, via the Collected button).
    },

    yardBreakers: {
      table: 'yard_cars', column: 'status', where: { list: 'breakers' }, initial: 'arrived',
      states: {
        arrived:    { label: 'Arrived',    next: ['stripping'] },
        stripping:  { label: 'Stripping',  next: ['shell_gone', 'arrived'] },
        shell_gone: { label: 'Shell gone', next: [] }
      }
    },

    invoice: {
      table: 'invoices', column: 'status',
      // Owned by Zoho Books — the sync copies Zoho's status every 30 min and never
      // moves a row off 'paid'. The portal only ever asks "paid or not?".
      states: {
        sent:           { label: 'Sent',           color: '#4a9eff' },
        viewed:         { label: 'Viewed',         color: '#4a9eff' },
        overdue:        { label: 'Overdue',        color: '#e8291c' },
        partially_paid: { label: 'Part paid',      color: '#f0c000' },
        paid:           { label: 'Paid',           color: '#4ade80', terminal: true },
        void:           { label: 'Void',           color: '#6b6b7a', terminal: true },
        unpaid:         { label: 'Unpaid',         color: '#f0c000' }
      },
      isPaid: function (r) { return !!r && r.status === 'paid'; }
    }
  };

  function machine(name) { return M[name]; }
  function label(name, s) { var m = M[name]; return (m && m.states[s] && m.states[s].label) || String(s || '').replace(/_/g, ' '); }
  function color(name, s) { var m = M[name]; return (m && m.states[s] && m.states[s].color) || null; }
  function canMove(name, from, to) {
    var m = M[name]; if (!m || from === to) return true;
    var st = m.states[from]; return !!(st && st.next && st.next.indexOf(to) > -1);
  }
  // Current status first, then the ones it can move to — for dropdowns.
  function options(name, current) {
    var m = M[name]; if (!m) return [];
    var cur = current || m.initial;
    var next = (m.states[cur] && m.states[cur].next) || [];
    return [cur].concat(next.filter(function (s) { return s !== cur; }));
  }
  // { key: label } map, for pages that used their own constant.
  function labels(name) {
    var out = {}, m = M[name]; if (!m) return out;
    Object.keys(m.states).forEach(function (k) { out[k] = m.states[k].label; });
    return out;
  }

  window.HP_STATES = { machines: M, machine: machine, label: label, color: color, canMove: canMove, options: options, labels: labels };
})();
