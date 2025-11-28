# Netlify Deployment Guide

This guide covers deploying Globance on Netlify with Neon PostgreSQL database and CronJob.org for mining triggers.

## Prerequisites

- GitHub repository with Globance code
- Netlify account (https://netlify.com)
- Neon account for PostgreSQL database (https://neon.tech)
- SendGrid account for email service (https://sendgrid.com)
- CronJob.org account for scheduling mining jobs (https://cron-job.org)
- NOWPayments account for crypto payments

## Step 1: Set Up Neon PostgreSQL Database

### 1.1 Create Neon Project

1. Go to https://console.neon.tech
2. Click "New Project"
3. Name: `globance-production`
4. Select region closest to your users
5. Click "Create project"

### 1.2 Get Connection String

1. In Neon dashboard, go to "Connection String"
2. Copy the connection string (looks like: `postgresql://user:password@host.neon.tech/database`)
3. Save this - you'll need it in Netlify

### 1.3 Initialize Database Schema

1. Download the migrations from `server/migrations/`
2. Connect to Neon using your connection string:
   ```bash
   psql "postgresql://user:password@host.neon.tech/database?sslmode=require"
   ```
3. Run the migration files in order:
   ```sql
   \i server/migrations/001_production_schema.sql
   \i server/migrations/002_replit_production_schema.sql
   \i server/migrations/003_add_missing_columns.sql
   -- Continue with remaining migration files
   ```

**Alternative: Use psql script**

```bash
for f in server/migrations/*.sql; do
  psql "postgresql://user:password@host.neon.tech/database?sslmode=require" -f "$f"
done
```

## Step 2: Connect Netlify to GitHub

### 2.1 Create Netlify Site

1. Go to https://netlify.com
2. Click "Add new site" → "Import an existing project"
3. Select "GitHub"
4. Authorize Netlify to access your GitHub account
5. Select your `globance` repository
6. Click "Deploy site"

### 2.2 Configure Build Settings

Netlify should auto-detect the build command from `netlify.toml`:

- **Build command:** `pnpm install --no-frozen-lockfile && pnpm run build`
- **Publish directory:** `dist/spa`
- **Functions directory:** `netlify/functions`

If not set automatically, configure in Netlify dashboard under **Build & deploy** → **Build settings**.

## Step 3: Set Environment Variables

### 3.1 Add Variables in Netlify Dashboard

1. Go to your Netlify site dashboard
2. Navigate to **Build & deploy** → **Environment**
3. Click **Edit variables**
4. Add all required variables:

```
DATABASE_URL = postgresql://user:password@host.neon.tech/database?sslmode=require
JWT_SECRET = (generate a random 32+ char string)
CRON_SECRET = (generate a random 32+ char string)
SENDGRID_API_KEY = SG.xxxxxxxxxxxxx
NOWPAYMENTS_API_KEY = your-nowpayments-api-key
NOWPAYMENTS_IPN_SECRET = your-nowpayments-secret
ENVIRONMENT = production
DEBUG_MODE = false
VITE_PUBLIC_BUILDER_KEY = your-builder-io-key
```

**Important:** Toggle the "Secret" switch for sensitive variables (API keys, secrets)

### 3.2 Verify Variables

1. Click "Deploy site" to trigger a new build with the variables
2. Monitor the build log in **Deployments** tab
3. Look for success message: "site is live"

## Step 4: Configure SendGrid

### 4.1 Verify Sender Email

1. Go to SendGrid dashboard
2. Navigate to **Settings** → **Sender Authentication**
3. Add and verify your sender email (e.g., `support@yourdomain.com`)

### 4.2 Create API Key

1. Go to **Settings** → **API Keys**
2. Click "Create API Key"
3. Name: `globance-netlify`
4. Select "Full Access"
5. Copy the key (format: `SG.xxxxx`)
6. Add to Netlify environment as `SENDGRID_API_KEY`

## Step 5: Set Up Mining Cron with CronJob.org

### 5.1 Create Cron Job

1. Go to https://cron-job.org
2. Sign up or log in
3. Click "Create Cronjob"
4. Configure:
   - **Title:** `Globance Daily Mining`
   - **URL:** `https://your-site.netlify.app/.netlify/functions/runMining`
   - **Schedule:** `0 21 * * *` (21:00 UTC daily)
   - **Request method:** POST
   - **Timeout:** 30 seconds

### 5.2 Add Custom Header

In the **Advanced** settings:

1. Click "Add HTTP Header"
2. **Header name:** `x-cron-secret`
3. **Header value:** Your `CRON_SECRET` from Netlify environment

### 5.3 Test the Job

1. Click "Save"
2. Click "Run this job now" to test
3. Check Netlify function logs for successful execution
4. Verify a cron_log entry appears in your database

**View logs in Netlify:**

1. Go to **Functions** tab in Netlify dashboard
2. Click `runMining`
3. View recent invocations

## Step 6: Configure Webhooks

### 6.1 NOWPayments Webhook

1. Go to NOWPayments dashboard
2. Settings → Webhooks
3. Add webhook:
   - **URL:** `https://your-site.netlify.app/api/webhook/nowpayments`
   - **Events:** Payment confirmation, verification updates
4. Save and test

### 6.2 Set Environment Variables for Webhooks

No additional variables needed - `NOWPAYMENTS_IPN_SECRET` handles validation.

## Step 7: Verify Deployment

### 7.1 Test API Endpoints

```bash
# Test health check
curl https://your-site.netlify.app/.netlify/functions/api/health

# Should return: {"status":"ok",...}
```

### 7.2 Test Mining Function

```bash
curl -X POST https://your-site.netlify.app/.netlify/functions/runMining \
  -H "x-cron-secret: your-cron-secret" \
  -H "Content-Type: application/json"

# Should return: {"success":true,"message":"Daily mining earnings processed..."}
```

### 7.3 Test Email Service

Register a test account - should receive a welcome email from SendGrid.

## Step 8: Monitor and Maintenance

### 8.1 View Logs

1. Netlify dashboard → **Functions** tab
2. Select function name to view invocation logs
3. Look for errors or warnings

### 8.2 Database Monitoring

Monitor your Neon database:

1. Neon dashboard → Project
2. Check:
   - Active connections
   - Query performance
   - Storage usage

### 8.3 Set Up Alerts

**Cron Job Failures:**

- CronJob.org will email if job fails 3 times in a row
- Monitor the execution history

**Netlify Build Failures:**

- Netlify sends email notifications on build failures
- Check **Notifications** settings in Netlify dashboard

## Troubleshooting

### Build Fails: "DATABASE_URL not set"

**Solution:**

1. Go to Netlify dashboard
2. **Build & deploy** → **Environment**
3. Verify `DATABASE_URL` is set
4. Trigger manual deploy with "Trigger deploy" button
5. Check build logs

### Functions Return 404

**Solution:**

1. Verify `netlify.toml` has correct functions directory
2. Check that `netlify/functions/api.ts` exists
3. Verify rewrite rule: `/api/*` → `/.netlify/functions/api/:splat`
4. Hard refresh browser (Cmd+Shift+R or Ctrl+Shift+R)

### Emails Not Sending

**Solution:**

1. Verify `SENDGRID_API_KEY` is correct in Netlify
2. Check SendGrid sender is verified
3. Review SendGrid Activity dashboard for bounces
4. Check function logs for SendGrid errors
5. Verify `DISABLE_SENDGRID` is not set to `true`

### Mining Cron Not Running

**Solution:**

1. Verify CronJob.org job is enabled
2. Check job execution history on CronJob.org
3. Test mining function manually (see Step 7.2)
4. Verify `CRON_SECRET` header matches Netlify variable
5. Check Netlify function logs for errors

### Database Connection Timeout

**Solution:**

1. Check Neon database status in dashboard
2. Verify connection string is correct
3. Ensure IP allowlist is configured in Neon (if applicable)
4. Check connection limit hasn't been exceeded
5. Review Neon logs for connection errors

## Security Checklist

- [ ] All API keys are marked as "Secret" in Netlify
- [ ] Database credentials are not in any code files
- [ ] JWT_SECRET is strong (32+ chars)
- [ ] CRON_SECRET is strong (32+ chars)
- [ ] SENDGRID_FROM_EMAIL is verified
- [ ] NOWPayments IPN secret is verified
- [ ] Webhooks validate signatures
- [ ] HTTPS is enabled on custom domain
- [ ] Environment is set to `production`
- [ ] Debug routes are disabled (`DEBUG_MODE=false`)

## Scaling Considerations

**Connection Pool:**

- Netlify Functions use optimized pool (max 5, min 0)
- Consider increasing if frequent 429 errors

**Database:**

- Monitor Neon connections
- Set up alerts for high connection count
- Consider compute size if CPU-bound

**Email Sending:**

- SendGrid can handle high volume
- Monitor quota usage
- Set up alerts for bounce rate

## Next Steps

1. Set up custom domain (Netlify dashboard → Domain settings)
2. Enable HTTPS (automatic with Netlify)
3. Configure analytics (Netlify dashboard → Analytics)
4. Set up error tracking (Sentry integration)
5. Schedule regular database backups (Neon dashboard)
