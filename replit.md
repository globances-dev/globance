# Globance - Cloud Mining & P2P Trading Platform

## Overview
Globance is a production-ready cloud mining and peer-to-peer marketplace platform. It allows users to invest in tiered mining packages, earn daily returns, and build referral networks. The platform also features an escrow-protected P2P marketplace for secure USDT trading. The core ambition is to provide a robust and scalable solution for cloud mining and P2P crypto trading, aiming for market potential in both financial services.

## User Preferences
- Package manager: npm (though project has pnpm configuration)
- TypeScript for type safety
- Radix UI components for consistent design
- Tailwind CSS for styling

## System Architecture
The project utilizes a modern web stack with React 18 (Vite, TypeScript, Tailwind CSS) for the frontend and Node.js (Express, TypeScript) for the backend. **Pure PostgreSQL** (Neon-backed via Replit) serves as the database with a dual-database architecture: DATABASE_URL_DEV for development and DATABASE_URL_PROD for production. Authentication is managed via JWT. Radix UI provides a consistent design system for the UI/UX.

**Key Features:**
- **Cloud Mining Packages**: 6 tiered packages (10 USDT - 1000 USDT) offering 2.5% - 3.0% daily returns.
- **Referral System**: A 3-level bonus structure (10%, 3%, 2%) on purchases and daily earnings, with auto-rank upgrades.
- **P2P Marketplace**: Escrow-protected trading system with multi-fiat support, user payment methods management, custom offer creation, a 30-minute payment window, real-time in-order chat, dispute resolution, and a professional UI.
- **Admin Dashboard**: Comprehensive system monitoring, user management, and configurable settings for customer support links.
- **Automated Cron Jobs**: Daily earnings distribution and P2P trade expiry.
- **UI/UX Decisions**: Rebranded as a mining-focused platform with updated messaging, navigation (P2P de-emphasized), dedicated referral and customer support pages, and a mobile-first approach with a Binance-style bottom navigation bar. Marketing emphasizes premium cloud-mining themes.
- **NOWPayments Custody System**: Fully custodial USDT management for automatic TRC20/BEP20 deposits (min 10 USDT) with permanent addresses and webhook-driven balance crediting. Withdrawals are now manual via admin panel (no automatic payouts).
- **Settings Management**: Admin-configurable system settings stored in the database.

**Directory Structure:**
- `/client/`: React frontend (components, pages, lib, App.tsx)
- `/server/`: Express backend (routes, utils, migrations, index.ts)
- `/shared/`: Shared types and utilities
- `/public/`: Static assets

**Deployment:**
The application is configured for Replit Autoscale Deployment, suitable for 24/7 uptime, webhook processing, and reliable cron job execution.

## External Dependencies
- **PostgreSQL (Neon)**: Dual-database architecture managed by Replit. DATABASE_URL_DEV for development, DATABASE_URL_PROD for production. No Supabase dependency.
- **NOWPayments**: Custody API for automatic USDT deposits (TRC20/BEP20). Payouts disabled as of Nov 22 - withdrawals are now manual via admin panel.
- **SendGrid**: Transactional email service for automated notifications (registration, password reset, deposit confirmation).

## Recent Changes (November 2025)
- **Telegram Keyboard Toolbar** (Nov 26, 2025): Added smart "Hide Keyboard" toolbar for Telegram WebApp compatibility:
  - Floating pill-shaped button appears only when input is focused
  - Tapping "Hide Keyboard" blurs the active input and closes the keyboard
  - Auto-hides when no input is focused
  - Works on all Telegram versions including 6.0 (which doesn't support BackButton API)
  - Styled to match Binance dark theme (dark background, subtle border, backdrop blur)
  - Universal solution that works across Chrome, Safari, and Telegram WebView

- **Critical Bug Fixes** (Nov 26, 2025): Fixed multiple platform-wide issues for 100% functionality:
  - **Admin Withdrawal Approval Fix**: Fixed "Cannot destructure property 'txid'" error when approving withdrawals
    - Frontend now sends proper `Content-Type: application/json` header and JSON body
    - Backend uses optional chaining (`req.body?.txid`) to prevent undefined errors
  - **PostgreSQL Numeric String Fix**: Applied `parseFloat(String(value)) || 0` pattern across all components
    - Fixed TypeError on `.toFixed()` calls where PostgreSQL returns numeric values as strings
    - Components fixed: Home, Wallet, Mining, Referral, Profile, P2P, TradeOffer, TradeOrder, NotificationBell
    - Admin components fixed: WithdrawalAdminManagement, WithdrawalMonitoring, DepositMonitoring, MiningMonitoring, P2POverview, CronMonitoring, AdminOverviewStats

- **Complete PostgreSQL Migration** (Nov 25, 2025): Fully migrated platform to Replit PostgreSQL:
  - Fixed all P2P trade routes to use correct column names matching database schema
  - Updated column references: `side` (not `type`), `price_fiat_per_usdt` (not `price_per_usdt`), `remaining_amount_usdt` (not `filled_amount`), `escrow_amount_usdt` (not `escrow_amount`), `fiat_currency_code` (not `fiat_currency`)
  - Fixed trade creation, cancellation, release, and dispute resolution flows
  - All routes now use Replit PostgreSQL through `getPostgresPool()`
  - Admin dashboard fully functional with all management features

- **Production Database Browser** (Nov 25, 2025): Added comprehensive admin database management feature:
  - Browse all production database tables with full CRUD operations
  - View table data with pagination and column sorting
  - Edit/delete individual records through controlled interfaces
  - Run custom read-only SQL queries (SELECT/WITH only)
  - Multi-layer security: identifier validation against information_schema, comment stripping, dangerous pattern detection
  - Available in Admin Dashboard under "Database" section
  - All modifications logged for audit purposes

- **Complete Supabase Elimination** (Nov 25, 2025): Migrated entire platform to pure PostgreSQL:
  - Removed @supabase/supabase-js package completely
  - Converted all backend files to use getPostgresPool() from server/utils/postgres.ts
  - Dual-database architecture: DATABASE_URL_DEV (development) and DATABASE_URL_PROD (production)
  - All routes converted: admin.ts, settings.ts, referral.ts, p2p-trades.ts, p2p-admin-stats.ts, payment-providers.ts, p2p-notifications.ts, p2p-cron.ts, seed-test-data.ts
  - Added complete referral utilities: checkPackageEligibility, getUplineUsers, recordReferralBonus, recordEarningsTransaction
  - Configured Replit Autoscale Deployment with production environment variables
  - Server runs without any Supabase dependencies

- **Manual Withdrawal System** (Nov 22, 2025): Replaced automatic NOWPayments payouts with manual admin-controlled withdrawals:
  - Removed all NOWPayments Mass Payout API calls from withdrawal flow
  - Users submit withdrawal requests which create pending records with immediate balance deduction
  - Admin dashboard shows comprehensive withdrawal management with status filters
  - Admin can approve (mark completed) or reject (refund full amount to user) pending withdrawals
  - Fixed 1 USDT withdrawal fee retained - tracked in platform earnings
  - Activity feed updated to display withdrawal status changes correctly
  - No external API integration required for payouts - all manual processing via admin panel
  - Column names standardized: `amount_usdt`, `fee_usdt`, `net_amount_usdt`
  - New admin endpoints: GET `/api/admin/withdrawals`, POST `/api/admin/withdrawals/:id/complete`, POST `/api/admin/withdrawals/:id/reject`

- **Complete Supabase Schema Migration** (Nov 21, 2025): Successfully migrated entire database to Supabase cloud:
  - Created all 24+ tables including users, wallets, packages, deposits, withdrawals, purchases, earnings, referrals, P2P system, auth, and admin tables
  - Added all missing columns to existing tables (tatum_ledger_id, current_rank, escrow_balance, etc.)
  - Created all indexes for performance optimization
  - Set up trigger functions for automatic timestamp management
  - Configured Row Level Security (RLS) policies
  - Inserted default data (6 mining packages, 5 fiat currencies, 7 payment providers for Ethiopia)
  - Database now fully synced between local development and Supabase cloud
- **P2P Admin UI Complete** (Nov 20, 2025): Built comprehensive P2P admin management interface:
  - **Fiat Currency Management**: Add/edit/delete fiat currencies with min/max price ranges per 1 USDT. Active/inactive toggle controls user visibility.
  - **Payment Methods Management**: Admin-approved payment providers (banks, mobile money) per currency. Supports adding providers for inactive currencies (prep before activation).
  - **Dispute Resolution Dashboard**: View all disputed trades with buyer/seller details, escrow amounts, dispute reasons. Release escrow to buyer or return to seller with resolution notes.
  - **P2P Overview**: Marketplace-wide statistics (active offers, trades today/7-days, open disputes, total volume, active users) using dedicated admin APIs.
  - **Backend APIs**: Created `approved_payment_providers` table and REST endpoints, admin stats API (`/api/p2p/admin/stats`), enhanced dispute resolution API.
  - **Database Migration**: Migration 006 adds approved payment providers with sample data for Ethiopia (CBE, Awash Bank, Dashen Bank, TeleBirr, etc.).
  - Admin can now fully manage P2P system: currencies, price ranges, approved payment methods, and resolve disputes with escrow control.
- **Withdraw Button Color Update** (Nov 20, 2025): Changed Withdraw button to blue (#3B82F6) for better visual distinction from green Deposit button:
  - Wallet page Withdraw button: Now uses blue (#3B82F6) with hover state (#2563EB)
  - Withdrawal modal "Withdraw Now" button: Matches the same blue color
  - Deposit button remains green (primary color) as before
  - Provides clear visual separation between deposit (green) and withdraw (blue) actions
- **Deposit Modal Mobile Fix** (Nov 20, 2025): Fixed mobile layout issue where Deposit modal became unusable when showing QR code:
  - Applied scrollable layout structure with fixed header
  - Modal constrained to 90% viewport height (`max-h-[90vh]`)
  - Content area scrolls independently while header and close button remain accessible
  - QR code fits properly on small screens (360×800)
- **Wallet Page Redesign** (Nov 20, 2025): Complete UI overhaul to match Home page professional styling:
  - Balance card uses gradient style matching Home page
  - Compact spacing and mobile-optimized layout
  - Transaction history with cleaner card design
  - Improved overall consistency with platform design