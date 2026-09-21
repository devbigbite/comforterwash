-- Create bookings table to store all customer orders
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  
  -- Customer information
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  customer_address text not null,
  
  -- Booking details
  pickup_date date not null,
  pickup_time_window text not null check (pickup_time_window in ('9am-1pm', '3pm-7pm')),
  delivery_date date not null,
  delivery_time_window text not null check (delivery_time_window in ('9am-1pm', '3pm-7pm')),
  
  -- Order details
  num_comforters integer not null check (num_comforters > 0),
  total_amount integer not null, -- in cents
  
  -- Status tracking
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'picked_up', 'in_progress', 'out_for_delivery', 'delivered', 'cancelled')),
  
  -- Payment
  stripe_payment_intent_id text,
  payment_status text default 'pending' check (payment_status in ('pending', 'paid', 'failed', 'refunded')),
  
  -- SMS tracking
  last_sms_sent_at timestamp with time zone,
  sms_notifications_sent jsonb default '[]'::jsonb,
  
  -- Notes
  notes text
);

-- Create index for faster queries
create index if not exists bookings_pickup_date_idx on public.bookings(pickup_date);
create index if not exists bookings_delivery_date_idx on public.bookings(delivery_date);
create index if not exists bookings_status_idx on public.bookings(status);
create index if not exists bookings_created_at_idx on public.bookings(created_at desc);

-- All application booking access goes through server-side actions using the
-- service-role client. Keep the table closed to anon/authenticated PostgREST
-- callers so one tenant can never read or update another tenant's orders by
-- calling Supabase directly.
alter table public.bookings enable row level security;

revoke all on table public.bookings from anon, authenticated;
