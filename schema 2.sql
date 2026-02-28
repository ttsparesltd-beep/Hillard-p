create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text not null unique,
  phone text,
  created_at timestamptz default now()
);

create table if not exists vehicles (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete cascade,
  registration text not null,
  make text,
  model text,
  colour text,
  fuel_type text,
  year integer,
  mot_expiry date,
  service_due date,
  last_mileage integer,
  created_at timestamptz default now()
);

create table if not exists service_history (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid references vehicles(id) on delete cascade,
  customer_id uuid references customers(id) on delete cascade,
  job_type text not null,
  title text not null,
  description text,
  garage_name text,
  is_external boolean,
  date date not null,
  mileage integer,
  technician text,
  mot_result text,
  advisories text[],
  created_at timestamptz default now()
);

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  service_history_id uuid references service_history(id) on delete cascade,
  customer_id uuid references customers(id) on delete cascade,
  invoice_number text unique not null,
  status text,
  subtotal numeric(10,2),
  vat numeric(10,2),
  total numeric(10,2),
  stripe_payment_link text,
  paid_at timestamptz,
  due_date date,
  created_at timestamptz default now()
);

create table if not exists invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references invoices(id) on delete cascade,
  description text not null,
  amount numeric(10,2) not null,
  sort_order integer
);

create table if not exists reminder_log (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid references vehicles(id) on delete cascade,
  reminder_type text not null,
  sent_at timestamptz default now(),
  days_before integer
);

alter table customers enable row level security;
alter table vehicles enable row level security;
alter table service_history enable row level security;
alter table invoices enable row level security;
alter table invoice_line_items enable row level security;
alter table reminder_log enable row level security;

create policy "customers_own_data" on customers
  for all using (user_id = auth.uid());

create policy "vehicles_own_data" on vehicles
  for all using (
    customer_id in (select id from customers where user_id = auth.uid())
  );

create policy "history_own_data" on service_history
  for all using (
    customer_id in (select id from customers where user_id = auth.uid())
  );

create policy "invoices_own_data" on invoices
  for all using (
    customer_id in (select id from customers where user_id = auth.uid())
  );

create policy "line_items_own_data" on invoice_line_items
  for all using (
    invoice_id in (
      select i.id from invoices i
      join customers c on c.id = i.customer_id
      where c.user_id = auth.uid()
    )
  );
