/**
 * NOWPayments API Integration - Custody Solution
 * 
 * This module handles all NOWPayments API interactions for the Globance platform.
 * Uses NOWPayments' Custody solution for permanent deposit addresses.
 * Uses JWT authentication (via email/password) for payouts.
 * 
 * Key Features:
 * - Permanent deposit address creation (TRC20 & BEP20)
 * - IPN signature verification
 * - Minimum 10 USDT enforcement
 * - Automatic deposit processing via webhooks
 * - Automatic withdrawals via NOWPayments Payout API with JWT auth
 */

import crypto from 'crypto';

const NOWPAYMENTS_API_KEY = process.env.NOWPAYMENTS_API_KEY || '';
const NOWPAYMENTS_IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET || '';
const NOWPAYMENTS_EMAIL = process.env.NOWPAYMENTS_EMAIL || '';
const NOWPAYMENTS_PASSWORD = process.env.NOWPAYMENTS_PASSWORD || '';
const NOWPAYMENTS_API_URL = 'https://api.nowpayments.io/v1';
const MIN_USDT_AMOUNT = 10; // Platform minimum: 10 USDT

export interface NOWPaymentsWebhookPayload {
  payment_id: number;
  invoice_id: string | null;
  order_id: string;
  order_description: string;
  payment_status: string;
  pay_address: string;
  price_amount: number;
  price_currency: string;
  pay_amount: number;
  actually_paid: number;
  actually_paid_at_fiat: number;
  pay_currency: string;
  outcome_amount: number;
  outcome_currency: string;
}

/**
 * NOWPayments API request helper for standard API calls (using API Key)
 */
async function nowpaymentsRequest(
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  body?: any
): Promise<any> {
  const url = `${NOWPAYMENTS_API_URL}${endpoint}`;
  
  const headers: Record<string, string> = {
    'x-api-key': NOWPAYMENTS_API_KEY,
    'Content-Type': 'application/json',
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `Payment gateway error: ${response.status} - ${errorData.message || response.statusText}`
    );
  }

  return response.json();
}

/**
 * Create a permanent deposit address using NOWPayments Custody
 * This creates a reusable address for USDT deposits on TRC20 or BEP20
 */
export async function createPermanentDepositAddress(
  userId: string,
  network: 'TRC20' | 'BEP20'
): Promise<{ address: string; paymentId: string }> {
  try {
    // Map network to NOWPayments currency code
    const currency = network === 'TRC20' ? 'usdttrc20' : 'usdtbsc';
    
    // Get callback URL
    const serverBaseUrl = process.env.SERVER_BASE_URL || 
      (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : '');
    const ipnCallbackUrl = serverBaseUrl ? `${serverBaseUrl}/api/webhook/nowpayments` : undefined;
    
    // Create a payment that will generate a permanent address
    // We use minimum amount to create the address
    const result = await nowpaymentsRequest('/payment', 'POST', {
      price_amount: MIN_USDT_AMOUNT,
      price_currency: 'usd',
      pay_currency: currency,
      order_id: `USER_${userId}_${network}_${Date.now()}`,
      order_description: `Permanent ${network} deposit address for user ${userId}`,
      ipn_callback_url: ipnCallbackUrl,
      is_fixed_rate: false,
      is_fee_paid_by_user: false,
    });

    console.log(`[NOWPayments] Created permanent ${network} address for user ${userId}:`, result.pay_address);

    return {
      address: result.pay_address,
      paymentId: result.payment_id.toString(),
    };
  } catch (error) {
    console.error(`[NOWPayments] Error creating ${network} address:`, error);
    throw error;
  }
}

/**
 * Verify NOWPayments IPN signature
 * Critical for security - prevents fraudulent webhook calls
 */
export function verifyIPNSignature(
  requestBody: any,
  receivedSignature: string
): boolean {
  try {
    // Sort the request body alphabetically by keys (recursive)
    const sortedBody = sortObjectKeys(requestBody);
    
    // Convert to JSON string
    const sortedJson = JSON.stringify(sortedBody);
    
    // Generate HMAC SHA-512 signature
    const hmac = crypto.createHmac('sha512', NOWPAYMENTS_IPN_SECRET);
    hmac.update(sortedJson);
    const calculatedSignature = hmac.digest('hex');
    
    // Compare signatures
    return calculatedSignature === receivedSignature;
  } catch (error) {
    console.error('[NOWPayments] Error verifying IPN signature:', error);
    return false;
  }
}

/**
 * Recursively sort object keys alphabetically
 */
function sortObjectKeys(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }
  
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj)
      .sort()
      .reduce((result: any, key) => {
        result[key] = sortObjectKeys(obj[key]);
        return result;
      }, {});
  }
  
  return obj;
}

/**
 * Get minimum USDT amount (platform standard)
 */
export function getMinimumUSDT(): number {
  return MIN_USDT_AMOUNT;
}

/**
 * Get payment status from NOWPayments
 */
export async function getPaymentStatus(paymentId: string | number): Promise<any> {
  try {
    return await nowpaymentsRequest(`/payment/${paymentId}`);
  } catch (error) {
    console.error('[NOWPayments] Error getting payment status:', error);
    throw error;
  }
}

/**
 * Check API status
 */
export async function checkAPIStatus(): Promise<{ message: string }> {
  try {
    return await nowpaymentsRequest('/status');
  } catch (error) {
    console.error('[NOWPayments] Error checking API status:', error);
    throw error;
  }
}

/**
 * Parse currency network from NOWPayments currency code
 * e.g., "usdttrc20" -> "TRC20", "usdtbsc" -> "BEP20"
 */
export function parseNetwork(payCurrency: string): 'TRC20' | 'BEP20' | null {
  const currency = payCurrency.toLowerCase();
  
  if (currency.includes('trc20') || currency.includes('tron')) {
    return 'TRC20';
  }
  
  if (currency.includes('bsc') || currency.includes('bep20')) {
    return 'BEP20';
  }
  
  return null;
}

/**
 * PAYOUT / WITHDRAWAL FUNCTIONS - Uses JWT Authentication
 */

// In-memory cache for JWT token (expires after 5 minutes)
let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Authenticate to get JWT token for Payout API
 * Per NOWPayments support: Must authenticate via email/password to get JWT
 * JWT is valid for 5 minutes and is cached for 4 minutes to avoid frequent auth calls
 */
export async function authenticateMassPayouts(): Promise<string> {
  // Check if we have a valid cached token
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    console.log('[NOWPayments] Using cached JWT token (expires in ' + Math.round((cachedToken.expiresAt - Date.now()) / 1000) + 's)');
    return cachedToken.token;
  }

  if (!NOWPAYMENTS_EMAIL || !NOWPAYMENTS_PASSWORD) {
    throw new Error('NOWPayments credentials not configured (NOWPAYMENTS_EMAIL or NOWPAYMENTS_PASSWORD missing). JWT authentication required for payouts.');
  }

  try {
    const authUrl = `${NOWPAYMENTS_API_URL}/auth`;
    console.log(`\n[NOWPayments] ========== JWT AUTH REQUEST START ==========`);
    console.log(`[NOWPayments] URL: POST ${authUrl}`);
    console.log(`[NOWPayments] Email: ${NOWPAYMENTS_EMAIL.substring(0, 5)}***${NOWPAYMENTS_EMAIL.substring(NOWPAYMENTS_EMAIL.length - 8)}`);
    console.log(`[NOWPayments] Password length: ${NOWPAYMENTS_PASSWORD.length} chars`);
    
    const authBody = {
      email: NOWPAYMENTS_EMAIL,
      password: NOWPAYMENTS_PASSWORD,
    };
    console.log(`[NOWPayments] Request body: ${JSON.stringify(authBody)}`);
    
    const response = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': NOWPAYMENTS_API_KEY,
      },
      body: JSON.stringify(authBody),
    });

    console.log(`[NOWPayments] Auth response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      let errorData: any = {};
      let responseBody = '';
      try {
        responseBody = await response.text();
        try {
          errorData = JSON.parse(responseBody);
        } catch {
          errorData = { raw: responseBody };
        }
        console.error('[NOWPayments] Auth error response body:', responseBody);
      } catch (e) {
        console.error('[NOWPayments] Could not read error response:', e);
      }
      
      console.log(`[NOWPayments] ========== JWT AUTH FAILED ==========\n`);
      const errorMsg = errorData.message || errorData.error || response.statusText;
      throw new Error(`NOWPayments JWT Auth Failed (${response.status}): ${errorMsg}`);
    }

    const data = await response.json();
    console.log(`[NOWPayments] Auth success response:`, JSON.stringify(data, null, 2));
    
    if (!data.token) {
      console.error('[NOWPayments] No token in auth response:', data);
      console.log(`[NOWPayments] ========== JWT AUTH FAILED - NO TOKEN ==========\n`);
      throw new Error('No JWT token received from NOWPayments auth endpoint');
    }
    
    // Cache token for 4 minutes (API returns 5 minute expiration)
    const expiresIn = (data.expires_in || 300) * 1000; // Convert to milliseconds
    cachedToken = {
      token: data.token,
      expiresAt: Date.now() + Math.min(expiresIn, 4 * 60 * 1000), // Use min of actual expiration or 4 min
    };

    console.log(`[NOWPayments] ✓ Successfully obtained JWT token`);
    console.log(`[NOWPayments] Token (first 20 chars): ${data.token.substring(0, 20)}...`);
    console.log(`[NOWPayments] Expires in: ${data.expires_in || 300} seconds`);
    console.log(`[NOWPayments] ========== JWT AUTH SUCCESS ==========\n`);
    return data.token;
  } catch (error) {
    console.error('[NOWPayments] ✗ JWT authentication error:', error);
    console.log(`[NOWPayments] ========== JWT AUTH EXCEPTION ==========\n`);
    throw error;
  }
}

/**
 * Get network currency code for NOWPayments
 */
function getNetworkCurrency(network: 'TRC20' | 'BEP20'): string {
  return network === 'TRC20' ? 'usdttrc20' : 'usdtbsc';
}

export interface PayoutWithdrawal {
  address: string;
  currency: string;
  amount: number;
  ipn_callback_url?: string;
}

export interface PayoutResult {
  id: string;
  withdrawals: Array<{
    id: string;
    address: string;
    currency: string;
    amount: string;
    status: string;
    hash: string | null;
    error: string | null;
  }>;
}

/**
 * Create a payout (withdrawal) using NOWPayments Payout API
 * Per NOWPayments support: Must use JWT token in Authorization header
 * This sends USDT from NOWPayments custody balance to user's address
 */
export async function createPayout(
  address: string,
  network: 'TRC20' | 'BEP20',
  amount: number
): Promise<PayoutResult> {
  try {
    console.log(`\n[NOWPayments] ========== PAYOUT REQUEST START ==========`);
    console.log(`[NOWPayments] Network: ${network}, Amount: ${amount}, Address: ${address}`);
    
    // Get JWT token (will use cached if valid)
    const jwtToken = await authenticateMassPayouts();
    const currency = getNetworkCurrency(network);

    // Get callback URL for IPN notifications
    const serverBaseUrl = process.env.SERVER_BASE_URL || 
      (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : '');
    const ipnCallbackUrl = serverBaseUrl ? `${serverBaseUrl}/api/webhook/nowpayments-payout` : undefined;

    // Payout payload using NOWPayments Mass Payouts format
    const payload = {
      withdrawals: [
        {
          address,
          currency,
          amount: Number(amount.toFixed(6)), // Max 6 decimals as per API docs
          ipn_callback_url: ipnCallbackUrl,
        },
      ],
    };

    console.log(`[NOWPayments] Payout Request URL: POST ${NOWPAYMENTS_API_URL}/payout`);
    console.log(`[NOWPayments] Payout Headers: Authorization: Bearer <JWT>, Content-Type: application/json`);
    console.log(`[NOWPayments] Payout Payload:`, JSON.stringify(payload, null, 2));

    // Call NOWPayments payout API with JWT in Authorization header
    const response = await fetch(`${NOWPAYMENTS_API_URL}/payout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    console.log(`[NOWPayments] Payout Response Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      let errorData: any = {};
      try {
        errorData = await response.json();
        console.error('[NOWPayments] Payout error response body:', JSON.stringify(errorData, null, 2));
      } catch {
        const text = await response.text();
        console.error('[NOWPayments] Payout error response text:', text);
      }
      
      const errorMsg = errorData.message || errorData.error || response.statusText;
      const fullError = `NOWPayments Payout API failed (${response.status}): ${errorMsg}`;
      console.error(`[NOWPayments] ✗ ${fullError}`);
      throw new Error(fullError);
    }

    const result = await response.json();
    console.log(`[NOWPayments] ✓ Payout created successfully:`, JSON.stringify(result, null, 2));
    console.log(`[NOWPayments] ========== PAYOUT REQUEST END ==========\n`);
    
    return result;
  } catch (error) {
    console.error('[NOWPayments] ✗ Payout creation error:', error);
    console.log(`[NOWPayments] ========== PAYOUT REQUEST FAILED ==========\n`);
    throw error;
  }
}

/**
 * Get payout status using JWT authentication
 */
export async function getPayoutStatus(payoutId: string): Promise<any> {
  try {
    const jwtToken = await authenticateMassPayouts();

    const response = await fetch(`${NOWPAYMENTS_API_URL}/payout/${payoutId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Failed to get payout status: ${errorData.message || response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[NOWPayments] Error getting payout status:', error);
    throw error;
  }
}

/**
 * Get account balance using JWT authentication
 */
export async function getPayoutBalance(): Promise<any> {
  try {
    const jwtToken = await authenticateMassPayouts();

    const response = await fetch(`${NOWPAYMENTS_API_URL}/balance`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Failed to get balance: ${errorData.message || response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[NOWPayments] Error getting balance:', error);
    throw error;
  }
}

// Note: Payout functions (authenticateMassPayouts, createPayout, getPayoutStatus, getPayoutBalance)
// are exported but NO LONGER USED as of Nov 22, 2025.
// Withdrawals now use manual admin approval system instead of automatic NOWPayments payouts.
// Functions kept for reference only - to be removed in future cleanup.

export { MIN_USDT_AMOUNT };
