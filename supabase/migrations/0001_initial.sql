create extension if not exists vector;

create table if not exists public._brokers (
  broker_id text primary key,
  display_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public._properties (
  id text primary key,
  title text not null,
  property_type text not null,
  listing_type text not null,
  location text not null,
  price numeric(12, 2) not null,
  description text not null,
  image_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public._property_vectors (
  id bigserial primary key,
  property_id text not null references public._properties(id) on delete cascade,
  embedding vector(1536) not null,
  price numeric(12, 2) not null,
  listing_type text not null,
  location text not null,
  property_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public._inquiry_logs (
  id bigserial primary key,
  buyer_query text not null,
  matched_property_ids text[] not null default '{}'::text[],
  created_at timestamptz not null default now()
);

create index if not exists _property_vectors_embedding_idx on public._property_vectors using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index if not exists _properties_listing_type_idx on public._properties (listing_type);
create index if not exists _properties_property_type_idx on public._properties (property_type);
create index if not exists _properties_location_idx on public._properties (location);
create index if not exists _inquiry_logs_created_at_idx on public._inquiry_logs (created_at desc);

insert into public._brokers (broker_id, display_name, active)
values
  ('BRK-001', 'Mira Petkova', true),
  ('BRK-014', 'Georgi Ivanov', true)
on conflict (broker_id) do update
set display_name = excluded.display_name,
    active = excluded.active;

insert into public._properties (id, title, property_type, listing_type, location, price, description, image_url)
values
  ('P-001', 'Two-bedroom apartment', 'apartment', 'for_sale', 'Lozenets, Sofia', 189000, 'Bright two-bedroom with a renovated kitchen, oak flooring, a large south-facing balcony, and a separate storage room. Quiet street, close to parks and metro.', 'https://images.unsplash.com/photo-1502672023488-70e25813eb80?auto=format&fit=crop&w=1200&q=80'),
  ('P-002', 'Studio', 'studio', 'for_sale', 'Studentski Grad, Sofia', 72000, 'Compact furnished studio ideal for students or investment. Newly built block, elevator, secured entrance, low maintenance fees.', 'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80'),
  ('P-003', 'Three-bedroom house', 'house', 'for_sale', 'Bistritsa, Sofia', 415000, 'Detached family house with a garden, garage for two cars, fireplace, and panoramic mountain views. Needs minor cosmetic updates.', 'https://images.unsplash.com/photo-1511818966892-d7d671e672a2?auto=format&fit=crop&w=1200&q=80'),
  ('P-004', 'One-bedroom apartment', 'apartment', 'for_sale', 'Center, Plovdiv', 98500, 'Renovated one-bedroom in a historic building, high ceilings, original details, walking distance to the Old Town. No elevator, third floor.', 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1200&q=80'),
  ('P-005', 'Maisonette', 'maisonette', 'for_sale', 'Vitosha, Sofia', 312000, 'Spacious two-level maisonette with three bedrooms, two bathrooms, a private terrace, underfloor heating, and a dedicated parking spot.', 'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80'),
  ('P-006', 'Two-bedroom apartment', 'apartment', 'for_rent', 'Mladost, Sofia', 950, 'Modern furnished two-bedroom for rent, air conditioning, fully equipped kitchen, balcony, close to a metro station and a shopping mall.', 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80'),
  ('P-007', 'Office space', 'office', 'for_rent', 'Business Park, Sofia', 1450, 'Open-plan office of 120 sqm in a class A business building, air conditioning, server room, 4 parking spots, ready to move in.', 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80')
on conflict (id) do update
set title = excluded.title,
    property_type = excluded.property_type,
    listing_type = excluded.listing_type,
    location = excluded.location,
    price = excluded.price,
    description = excluded.description,
    image_url = excluded.image_url,
    updated_at = now();
