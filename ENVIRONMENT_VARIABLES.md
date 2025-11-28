# Environment Variables

## Required Variables for Production (Netlify)

All of the following variables must be set in your Netlify environment:

### Database

- **DATABASE_URL** (required)
  - Neon PostgreSQL connection string
  - Format: `postgresql://user:password@host.neon.tech/database?sslmode=require`
  - Get this from Neon dashboard → Project → Connection string

### Authentication & Security

- **JWT_SECRET** (required)
  - Minimum 32 characters
  - Used to sign and verify JWT tokens
  - Example: `c5f61b4e9f784c7b9841ad0b7c6d3f4e2f164b7b0cb8e25fa9d5b1cf66e8d2a1`

- **CRON_SECRET** (required)
  - Minimum 32 characters
  - Secret key for CronJob.org to verify mining trigger requests
  - Must be passed as `x-cron-secret` header when calling mining function
  - Example: `your-secure-cron-secret-min-32-chars`

### Email Service

- **SENDGRID_API_KEY** (required)
  - SendGrid API key for sending emails
  - Get this from SendGrid dashboard → Settings → API Keys
  - Format: `SG.xxxxxxxxxxxxxxxxxxxxxx`

- **SENDGRID_FROM_EMAIL** (optional)
  - Email address to send from
  - Default: `support@globance.com`
  - Must be verified in SendGrid

### Payment Integration

- **NOWPAYMENTS_API_KEY** (required)
  - NOWPayments API key for crypto payment processing
  - Get from NOWPayments dashboard

- **NOWPAYMENTS_IPN_SECRET** (required)
  - NOWPayments IPN secret for webhook verification
  - Get from NOWPayments dashboard

### Application Settings

- **ENVIRONMENT** (required)
  - Set to: `production`
  - Controls feature flags and logging

- **DEBUG_MODE** (optional)
  - Set to: `false` for production
  - Disables debug routes and verbose logging

- **VITE_PUBLIC_BUILDER_KEY** (required)
  - Builder.io public API key for frontend
  - Obtained from Builder.io dashboard

### Optional

- **APP_URL** (optional)
  - Your Globance app URL
  - Used in email links
  - Default: `https://globance.app`
  - Example: `https://yourdomain.netlify.app`

- **SENDGRID_FROM_EMAIL** (optional)
  - Sender email address
  - Default: `support@globance.com`

## Setting Variables in Netlify

1. Go to your Netlify project dashboard
2. Navigate to **Build & deploy** → **Environment**
3. Click **Edit variables**
4. Add each required variable from above
5. For sensitive variables (API keys, secrets), enable "Secret" toggle
6. Save and redeploy

## Local Development (.env)

Create a `.env` file in the root directory for local development:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/globance
JWT_SECRET=your-dev-secret-min-32-chars
CRON_SECRET=your-dev-cron-secret-min-32-chars
SENDGRID_API_KEY=SG.your-sendgrid-key
NOWPAYMENTS_API_KEY=your-nowpayments-key
NOWPAYMENTS_IPN_SECRET=your-nowpayments-secret
ENVIRONMENT=development
DEBUG_MODE=true
VITE_PUBLIC_BUILDER_KEY=your-builder-key
```

## Verification Checklist

- [ ] DATABASE_URL is set and Neon database is accessible
- [ ] JWT_SECRET is a strong random string (min 32 chars)
- [ ] CRON_SECRET is a strong random string (min 32 chars)
- [ ] SENDGRID_API_KEY is valid and active
- [ ] NOWPAYMENTS_API_KEY and NOWPAYMENTS_IPN_SECRET are configured
- [ ] All sensitive variables are marked as "Secret" in Netlify
- [ ] ENVIRONMENT is set to `production` for live deployment
- [ ] All variables are deployed (redeploy after adding them)

## Troubleshooting

**Error: "DATABASE_URL not set"**

- Check that DATABASE_URL is set in Netlify environment
- Verify the connection string format
- Test the connection: `psql "postgresql://..."` from terminal

**Error: "SENDGRID_API_KEY is invalid"**

- Verify the key starts with `SG.`
- Check that the key hasn't expired in SendGrid dashboard
- Ensure the email address is verified in SendGrid

**Error: "JWT_SECRET too short"**

- Minimum 32 characters required
- Use a strong random string generator

**Mining function not triggering**

- Verify CRON_SECRET is set in Netlify
- Check CronJob.org configuration
- Verify the cron secret matches in both Netlify and CronJob.org settings
