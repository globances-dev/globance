# System Architecture

## Overview

Globance has been migrated from Supabase + Replit to a modern, scalable serverless stack:

```
┌─────────────────────────────────────────────────────────────────┐
│                      End Users / Telegram                       │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              Frontend (React + Builder.io)                      │
│  - Hosted on Netlify CDN                                        │
│  - API calls to /.netlify/functions/api/*                       │
│  - Builder.io for UI components                                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│         Netlify Functions (Serverless Backend)                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ /api/*              - Main API router                    │  │
│  │ /runMining          - Daily mining processor (triggered) │  │
│  └───────────────────────────────────���──────────────────────┘  │
│                                                                 │
│  Technology: Node.js/Express wrapped with serverless-http      │
│  Scaling: Automatic (per-request)                              │
│  Cold start: <2 seconds                                        │
└──────────────────────┬──────────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┬──────────────┐
        │              │              │              │
        ▼              ▼              ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌─────────────┐ ┌─────────┐
│ Neon         │ │ SendGrid     │ │ CronJob.org │ │ Payment │
│ PostgreSQL   │ │ Email        │ │ Scheduler   │ │ Gateway │
│              │ │              │ │             │ │         │
│ • Users      │ │ • Welcome    │ │ • 21:00 UTC │ │ NOWPay  │
│ • Wallets    │ │ • Reset      │ │   mining    │ │ Tatum   │
│ • Mining Pkg │ │ • Deposit    │ │ • Retry on  │ │ Crypto  │
│ • Referrals  │ │ • Withdraw   │ │   failure   │ │ payments│
│ • P2P Trades │ │ • Rewards    │ │             │ │         │
│ • Settings   │ │              │ │ Calls:      │ │         │
│              │ │ Rate limit:  │ │ POST        │ │         │
│ Connection:  │ │ 100/sec      │ │ /.netlify.. │ │         │
│ Pool: 5 max  │ │              │ │ /runMining  │ │         │
└──────────────┘ └──────────────┘ └─────────────┘ └─────────┘
```

## Component Details

### 1. Frontend Layer

**Technology:** React 18 + TypeScript + Vite + Builder.io

- **Deployment:** Netlify CDN (globally distributed)
- **Build:** SPA (Single Page Application)
- **API Communication:** Relative `/api` calls (proxied by Netlify)
- **Authentication:** JWT tokens stored in localStorage
- **Features:**
  - Mining packages dashboard
  - Wallet management
  - P2P trading
  - Referral tracking
  - User account management

**Key Files:**
- `client/` - React components and pages
- `client/lib/api.ts` - API client wrapper
- `client/hooks/` - Custom React hooks
- `vite.config.ts` - Build configuration

### 2. Backend Layer (Netlify Functions)

**Technology:** Node.js 22 + Express + TypeScript

#### Main API Function
- **Path:** `netlify/functions/api.ts`
- **Routes:** All `/api/*` endpoints
- **Architecture:** Express server wrapped with serverless-http

**API Endpoints:**
```
/api/auth/*              - Authentication (register, login, password reset)
/api/wallet/*            - Wallet operations (deposit, withdraw)
/api/packages/*          - Mining packages management
/api/mining/*            - Mining data and earnings
/api/referral/*          - Referral system
/api/p2p/*               - P2P marketplace
/api/webhook/*           - Payment webhooks (NOWPayments, etc.)
/api/admin/*             - Admin operations (requires admin role)
/api/settings/*          - App settings
/api/activity/*          - User activity logs
```

#### Mining Processor Function
- **Path:** `netlify/functions/runMining.ts`
- **Trigger:** External HTTP POST from CronJob.org
- **Authentication:** `x-cron-secret` header validation
- **Execution:** Once daily at 21:00 UTC

**Responsibilities:**
- Calculate daily mining earnings
- Process referral commissions (10%, 3%, 2%)
- Update user wallet balances
- Expire overdue P2P trades
- Log cron execution
- Send notifications (via SendGrid)

### 3. Database Layer (Neon PostgreSQL)

**Technology:** PostgreSQL 15+ on Neon

**Connection Method:**
- Pool size: 5 (optimized for serverless)
- SSL: Required
- Idle timeout: 30 seconds

**Schema:**
```
Tables:
  - users                      - User accounts and auth
  - wallets                    - User USDT balances
  - purchases                  - Mining package purchases
  - earnings_transactions      - Earnings records
  - referral_commissions       - Referral rewards
  - p2p_offers                 - P2P marketplace listings
  - p2p_trades                 - P2P transaction records
  - payment_deposits           - Deposit records
  - payment_withdrawals        - Withdrawal records
  - cron_logs                  - Mining scheduler execution logs
  - settings                   - App configuration
  - email_verification_codes   - Verification codes
  - password_reset_tokens      - Password reset tokens
```

**Migrations:**
- Located in `server/migrations/*.sql`
- Run once during initial setup
- Updated sequentially for schema changes

### 4. Email Service (SendGrid)

**Technology:** SendGrid SMTP API

**Configuration:**
- API Key: Environment variable `SENDGRID_API_KEY`
- Sender: Environment variable `SENDGRID_FROM_EMAIL`
- Rate limit: 100 emails/second

**Email Types:**
1. Welcome email (registration)
2. Email verification codes
3. Password reset links
4. Deposit confirmation
5. Withdrawal notifications
6. Mining rewards alerts
7. Referral notifications

**Implementation:**
- `server/utils/email.ts` - Email utility functions
- Sent synchronously after database updates
- Failures are logged but don't block operations

### 5. Scheduler (CronJob.org)

**Technology:** CronJob.org (external HTTP trigger)

**Configuration:**
- **URL:** `https://your-site/.netlify/functions/runMining`
- **Schedule:** `0 21 * * *` (21:00 UTC daily)
- **Method:** POST
- **Header:** `x-cron-secret: [CRON_SECRET]`
- **Timeout:** 30 seconds

**Execution Flow:**
1. CronJob.org sends HTTP POST at 21:00 UTC
2. Netlify receives request at `/runMining`
3. Function validates `x-cron-secret` header
4. Executes mining earnings calculation
5. Logs result to database
6. Returns success/failure response

**Backup Job (optional):**
- Set up second job at 21:05 UTC for redundancy
- Same configuration as primary
- Database has idempotency check to prevent double-processing

### 6. Payment Processing

**Supported Gateways:**
- NOWPayments (crypto payments)
- Tatum (webhook integration)

**Flow:**
1. User initiates deposit/withdrawal
2. Payment gateway processes transaction
3. Webhook sent to `/api/webhook/*`
4. Backend verifies signature
5. Updates database
6. Sends confirmation email

## Data Flow

### Registration Flow
```
User Input → Frontend → /api/auth/register
            ↓
     Database Insert (user, wallet)
            ↓
     Send Welcome Email
            ↓
     Return JWT Token → Frontend
```

### Mining Earnings Flow
```
CronJob.org (21:00 UTC)
      ↓
  /runMining Function
      ↓
  1. Get active purchases
  2. Calculate daily earnings
  3. Update user wallets
  4. Calculate referral commissions
  5. Update referral wallets
  6. Log transaction
  7. Expire overdue P2P trades
      ↓
  Update Neon Database
      ↓
  Return success response
```

### Deposit Flow
```
User → Payment Gateway (NOWPayments)
       ↓
    User sends crypto
       ↓
Payment Gateway confirms
       ↓
Webhook → /api/webhook/nowpayments
       ↓
Verify signature
       ↓
Update deposit record
       ↓
Send confirmation email
       ↓
Credit user wallet
```

## Environment Variables

### Required (Production)
- `DATABASE_URL` - Neon connection string
- `JWT_SECRET` - Token signing secret (32+ chars)
- `CRON_SECRET` - Mining trigger secret (32+ chars)
- `SENDGRID_API_KEY` - Email service key
- `NOWPAYMENTS_API_KEY` - Payment gateway key
- `NOWPAYMENTS_IPN_SECRET` - Webhook verification secret

### Configuration
- `ENVIRONMENT` - `production` or `development`
- `DEBUG_MODE` - `true` or `false`
- `VITE_PUBLIC_BUILDER_KEY` - Builder.io public key

### Optional
- `APP_URL` - Application URL (default: `https://globance.app`)
- `SENDGRID_FROM_EMAIL` - Sender email (default: `support@globance.com`)
- `DISABLE_SENDGRID` - Skip email sending (dev only)

## Scalability & Performance

### Horizontal Scaling
- **Frontend:** Netlify CDN scales automatically (geo-distributed)
- **Functions:** Netlify auto-scales per request (no configuration needed)
- **Database:** Neon scales on usage (plan-based)

### Performance Optimization
- **Connection pooling:** Reuses connections between function invocations
- **Database indexing:** Indexed on frequently queried columns
- **Caching:** Frontend caches API responses where appropriate
- **Compression:** Gzip compression on assets and API responses

### Monitoring
- **Frontend:** Netlify analytics + Sentry (error tracking)
- **Functions:** Netlify function logs + Sentry
- **Database:** Neon dashboard metrics
- **Cron:** CronJob.org execution history

## Security Architecture

### Authentication
- JWT tokens signed with `JWT_SECRET`
- Tokens stored in localStorage (SPA)
- Validated on every protected API call
- Password hashing with bcrypt

### Authorization
- Role-based access control (user/admin/moderator)
- Admin routes require admin role + valid token
- Webhook endpoints verify signatures

### API Security
- Input validation on all endpoints
- SQL injection prevention (parameterized queries)
- CORS enabled for frontend domain only
- Rate limiting (configurable per endpoint)

### Data Protection
- Passwords hashed before storage
- API keys stored as environment variables (not in code)
- Sensitive data logged only in debug mode
- HTTPS enforced by Netlify

## Disaster Recovery

### Backup Strategy
- **Database:** Neon provides automatic backups (configurable retention)
- **Code:** Git version control (GitHub)
- **Secrets:** Netlify environment variables (encrypted at rest)

### Recovery Procedures
1. **Database corruption:** Restore from Neon backup
2. **Code issues:** Revert to previous git commit
3. **Secrets compromise:** Rotate in Netlify dashboard
4. **Function failure:** Rollback deployment via Netlify

## Migration from Old Stack

### What Changed
- **❌ Removed:** Supabase (auth + database)
- **❌ Removed:** Replit (server hosting + internal cron)
- **✅ Added:** Netlify Functions (serverless backend)
- **✅ Added:** Neon PostgreSQL (database only)
- **✅ Added:** CronJob.org (external scheduler)
- **✅ Kept:** Builder.io (frontend UI)
- **✅ Kept:** SendGrid (email service)
- **✅ Kept:** NOWPayments (payment processing)

### Backward Compatibility
- API endpoints remain unchanged
- Database schema compatible
- Authentication method unchanged (JWT)
- Email system enhanced but compatible

## Deployment Process

1. **Push to GitHub** → Triggers Netlify build
2. **Build phase** → Install deps, run tests, build SPA + functions
3. **Deploy phase** → Upload to Netlify CDN
4. **Go live** → DNS points to Netlify (automatic)
5. **Functions available** → At `/.netlify/functions/*` paths

**Build time:** ~2-3 minutes
**Deployment time:** <1 minute
**Total time:** ~3-4 minutes from push to live

## Appendix: Comparison Table

| Aspect | Old Stack | New Stack |
|--------|-----------|-----------|
| Hosting | Replit | Netlify |
| Database | Supabase | Neon |
| Auth | Supabase Auth | JWT + Database |
| Scheduler | Replit Cron | CronJob.org |
| Email | SendGrid | SendGrid |
| Payments | NOWPayments | NOWPayments |
| Frontend | React/Builder.io | React/Builder.io |
| Scaling | Manual | Automatic |
| Cost | $25/month | Variable (usage-based) |
| Performance | Good | Better (CDN + serverless) |
| Uptime | 99.5% | 99.99% |
