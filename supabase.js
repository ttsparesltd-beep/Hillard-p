// ═══════════════════════════════════════════════════════
// HILLARD PERFORMANCE — Supabase client
// Import this into every screen
// ═══════════════════════════════════════════════════════

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://jkruphtrqlcrwfuoemzt.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprcnVwaHRycWxjcndmdW9lbXp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMDY4ODAsImV4cCI6MjA4Nzg4Mjg4MH0.XpCM6_7g4Gz3Lluyix8XaRxAaYjMn-ARYZYL2_l--Ho'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ── Auth helpers ──────────────────────────────────────

export async function signIn(email) {
  // Magic link — no password needed
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin + '/garage.html' }
  })
  return { error }
}

export async function signOut() {
  await supabase.auth.signOut()
  window.location.href = '/login.html'
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export async function getCustomer(userId) {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('user_id', userId)
    .single()
  return { data, error }
}

// ── Vehicle helpers ───────────────────────────────────

export async function getVehicles(customerId) {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
  return { data, error }
}

export async function addVehicle(vehicle) {
  const { data, error } = await supabase
    .from('vehicles')
    .insert(vehicle)
    .select()
    .single()
  return { data, error }
}

// ── Service history helpers ───────────────────────────

export async function getServiceHistory(customerId) {
  const { data, error } = await supabase
    .from('service_history')
    .select('*, vehicles(registration, make, model)')
    .eq('customer_id', customerId)
    .order('date', { ascending: false })
  return { data, error }
}

export async function addServiceRecord(record) {
  const { data, error } = await supabase
    .from('service_history')
    .insert(record)
    .select()
    .single()
  return { data, error }
}

// ── Invoice helpers ───────────────────────────────────

export async function getInvoices(customerId) {
  const { data, error } = await supabase
    .from('invoices')
    .select('*, invoice_line_items(*), service_history(title, date, vehicles(registration, make, model))')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
  return { data, error }
}

