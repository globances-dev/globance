# Globance - Cloud Mining & P2P Trading Platform

## Overview
Globance delivers cloud mining packages, referral rewards, and a peer-to-peer USDT marketplace. The platform provides automated cron-driven earnings, escrow-protected trades, and admin tooling for oversight.

## Architecture
- **Frontend:** React 18 + Vite + TypeScript + TailwindCSS
- **Backend:** Express (TypeScript) with serverless-friendly routing
- **Database:** Supabase (service-role client via `server/utils/supabase.ts`)
- **Auth:** JWT-based session handling
- **Email & Payments:** SendGrid for transactional email, NOWPayments for custodial deposits

All backend data access flows through Supabase RPC helpers (`exec` / `execSingle`) to keep a single data layer. No PostgreSQL connection strings are required.

## Key Features
- Cloud mining packages with tiered daily returns
- Referral rewards across multiple levels
- Escrowed P2P USDT trading with disputes, chat, and admin moderation
- System settings and support links managed via admin dashboard
- Internal scheduler for payouts and trade expiry

## Deployment Notes
- Preferred package manager: **pnpm**
- Production build: `pnpm run build`
- Netlify configuration publishes `dist/spa` with functions in `netlify/functions`
- Configure Supabase URL and service-role key in the environment before deploying
