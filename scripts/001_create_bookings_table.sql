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

-- Enable RLS (but allow public access for now since this is a service business)
-- In production, you'd want admin authentication
alter table public.bookings enable row level security;

-- Allow anyone to insert bookings (customer orders)
create policy "Allow public to create bookings"
  on public.bookings for insert
  with check (true);

-- For now, allow reading all bookings (admin will need this)
-- In production, add admin authentication
create policy "Allow reading all bookings"
  on public.bookings for select
  using (true);

-- Allow updating bookings (for status changes, admin only in production)
create policy "Allow updating bookings"
  on public.bookings for update
  using (true);
