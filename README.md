# GlycoVision AI

React + Vite mobile-responsive SaaS implementation based on the supplied GlycoVision AI PRD.

## Stack
- React + Vite
- Supabase Auth / Postgres / Storage / Edge Functions
- Gemini API for meal-image analysis
- Paystack for Pro subscription checkout

## Local setup
1. Copy `.env.example` to `.env.local`.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (or the Supabase publishable key).
3. Set `VITE_PAYSTACK_PUBLIC_KEY` if the UI needs direct Paystack public-key features.
4. Run `npm install` and `npm run dev`.

## Supabase server secrets
Set these as Edge Function secrets; never put them in VITE_* variables:
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- `PAYSTACK_SECRET_KEY`
- `GEMINI_MODEL` (optional, default `gemini-3.7-flash`)
- `PAYSTACK_CURRENCY` (optional, default `USD`)
- `PAYSTACK_AMOUNT_MINOR` (optional, default `999` for $9.99)
- `PAYSTACK_PLAN_CODE` (recommended for recurring Paystack billing)
- `APP_URL` (production web URL)

## Google / Apple authentication
Enable Google and Apple providers in Supabase Authentication and configure their OAuth redirect URLs to the production site URL.

## Paystack webhook
Point Paystack's webhook to:
`https://ipycjunfnmjzomdmpnwq.supabase.co/functions/v1/paystack-webhook`

The webhook verifies the Paystack HMAC signature before changing payment/subscription state.

## Security model
- Gemini and Paystack secret keys are server-side only.
- Meal images are stored in a private Supabase Storage bucket.
- User tables use RLS.
- Payment verification is server-side and idempotent.
- Scan usage is deducted only after successful AI analysis.

## Production checklist
- Add the Edge Function secrets.
- Configure Google/Apple OAuth.
- Configure a Paystack recurring plan matching $9.99/month if recurring billing is required.
- Review legal copy with counsel before launch.
- Add a production domain to Supabase Auth redirect URLs.
