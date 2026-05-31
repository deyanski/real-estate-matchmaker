# NovaDom Realty Matchmaker

A Next.js App Router front end for a real-estate workflow that separates broker listing creation from buyer search.

## What is implemented

- A polished broker/client dashboard in Next.js
- Broker ID verification against Supabase
- Add-listing webhook proxy with bearer-token support
- Embedded chat webhook proxy without bearer auth
- Error webhook proxy for n8n failures
- Supabase-backed property loading for broker and buyer routes
- Supabase migrations with underscore-prefixed tables

## Run locally

1. Install dependencies.
2. Copy `.env.example` to `.env.local` and fill in the Supabase and n8n variables.
3. Run `npm run dev`.

## Supabase schema

The migration is in [supabase/migrations/0001_initial.sql](supabase/migrations/0001_initial.sql).

Tables:
- `_brokers`
- `_properties`
- `_inquiry_logs`

## Webhook contracts

- Add listing: JSON payload with broker identity, property fields, and image metadata/base64.
- Chat: JSON payload with `role`, `user_id`, `conversation_id`, and message context.
- Error: JSON payload with the request ID and error envelope.

