# External Cron Setup Instructions

## Overview
The Globance mining payout system has an internal scheduler that runs daily. For maximum reliability in production, you should also set up an external cron service as a backup trigger.

## Internal Scheduler (Already Implemented)
✅ **Status**: Active
- **Trigger Time**: 21:00 UTC (9 PM UTC) every day
- **Function**: Automatically processes mining earnings and distributes daily rewards
- **Runs On**: Application startup (no external service needed)

## External Cron Backup (Recommended for Production)
Set up one of these services to call the mining endpoint daily at 21:00 UTC as a backup.

### Option 1: EasyCron (Recommended - Free Tier Available)
1. Go to https://www.easycron.com/
2. Sign up for a free account
3. Click "Add a Cron Job"
4. Fill in the following:
   - **URL**: `https://globance.app/api/mining/process-daily-earnings`
   - **HTTP Method**: POST
   - **HTTP Headers** (add custom header):
     ```
     x-cron-secret: globance-cron-secret-2024-production
     ```
   - **Cron Expression**: `0 21 * * *` (21:00 UTC daily)
   - **Execution Timeout**: 60 seconds
5. Click "Create Cron Job"

### Option 2: Uptime Robot (Free Tier Available)
1. Go to https://uptimerobot.com/
2. Sign up for a free account
3. Click "Create Monitor" → "Cron Job"
4. Fill in:
   - **Name**: Globance Daily Mining Payout
   - **URL**: `https://globance.app/api/mining/process-daily-earnings`
   - **HTTP Method**: POST
   - **Custom Headers**:
     ```
     x-cron-secret: globance-cron-secret-2024-production
     ```
   - **Schedule**: `0 21 * * *` (21:00 UTC daily)
5. Click "Create Monitor"

### Option 3: AWS EventBridge (Enterprise)
1. Go to AWS Console → EventBridge
2. Create Rule:
   - **Name**: globance-mining-payout
   - **Schedule**: `cron(0 21 * * ? *)` (AWS format)
   - **Target**: HTTP endpoint with URL and headers
3. Configure target with:
   - **URL**: `https://globance.app/api/mining/process-daily-earnings`
   - **HTTP Method**: POST
   - **Headers**:
     ```json
     {
       "x-cron-secret": "globance-cron-secret-2024-production"
     }
     ```

## Production Domain
Replace `globance.app` with your actual domain if different.

## Security
- **CRON_SECRET**: `globance-cron-secret-2024-production`
- Always include the `x-cron-secret` header in requests
- This secret is configured in your environment variables

## Monitoring
Check mining payout status in admin panel:
- **Endpoint**: `/api/admin/cron-logs`
- Shows all cron job executions with timestamps and number of users paid

## Testing the Setup
To manually test if the cron endpoint works:
```bash
curl -X POST https://globance.app/api/mining/process-daily-earnings \
  -H "x-cron-secret: globance-cron-secret-2024-production" \
  -H "Content-Type: application/json"
```

Expected response:
```json
{
  "success": true,
  "processed": 42,
  "message": "Daily earnings processed"
}
```

## Redundancy Strategy
1. **Primary**: Internal Node.js scheduler (always running)
2. **Secondary**: External cron service (manual setup above)
3. **Tertiary**: Admin manual trigger (if needed)

This ensures mining payouts continue even if one system fails.
