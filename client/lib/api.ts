const API_BASE = '/api';

interface RequestOptions {
  method?: string;
  body?: any;
  token?: string;
}

async function apiCall(endpoint: string, options: RequestOptions = {}) {
  const { method = 'GET', body, token } = options;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      let errorMessage = 'API request failed';
      const responseText = await response.text();

      try {
        const error = responseText ? JSON.parse(responseText) : null;
        errorMessage =
          (error && (error.error || error.message)) ||
          errorMessage;
      } catch {
        // Ignore JSON parse errors and fall through to text handling
      }

      if (errorMessage === 'API request failed') {
        errorMessage =
          responseText.trim() ||
          `Server error: ${response.status}${
            response.statusText ? ` ${response.statusText}` : ''
          }`;
      }

      throw new Error(errorMessage);
    }

    if (response.headers.get('content-type')?.includes('application/json')) {
      return response.json();
    }

    throw new Error('Unexpected response format from server');
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Network error or invalid response');
  }
}

// Auth API
export const auth = {
  register: (data: {
    email: string;
    password: string;
    full_name: string;
    ref_by?: string;
  }) => apiCall('/auth/register', { method: 'POST', body: data }),

  login: (email: string, password: string) =>
    apiCall('/auth/login', { method: 'POST', body: { email, password } }),

  getCurrentUser: (token: string) =>
    apiCall('/auth/me', { token }),

  passwordResetRequest: (email: string) =>
    apiCall('/auth/password-reset-request', { method: 'POST', body: { email } }),
};

// Wallet API
export const wallet = {
  getMe: (token: string) =>
    apiCall('/wallet/me', { token }),

  getBalance: (token: string) =>
    apiCall('/wallet/balance', { token }),

  getDepositAddresses: (token: string) =>
    apiCall('/wallet/deposit-addresses', { token }),

  getDepositHistory: (token: string) =>
    apiCall('/wallet/deposit-history', { token }),

  requestWithdrawal: (
    token: string,
    data: { amount: number; address: string; network: 'TRC20' | 'BEP20' }
  ) => apiCall('/wallet/withdrawal-request', { method: 'POST', body: data, token }),

  getWithdrawalHistory: (token: string) =>
    apiCall('/wallet/withdrawal-history', { token }),
};

// Packages API
export const packages = {
  getAll: () => apiCall('/packages'),

  getById: (id: string) => apiCall(`/packages/${id}`),

  buy: (token: string, package_id: string) =>
    apiCall('/packages/buy', { method: 'POST', body: { package_id }, token }),

  getUserPurchases: (token: string) =>
    apiCall('/packages/user/purchases', { token }),
};

// Mining API
export const mining = {
  processDailyEarnings: (cronSecret: string) =>
    fetch(`${API_BASE}/mining/process-daily-earnings`, {
      method: 'POST',
      headers: {
        'x-cron-secret': cronSecret,
      },
    }).then((r) => r.json()),
};

// P2P API
export const p2p = {
  getOffers: (filters?: {
    type?: 'buy' | 'sell';
    currency?: string;
    country?: string;
    network?: 'TRC20' | 'BEP20';
  }) => {
    const params = new URLSearchParams();
    if (filters?.type) params.append('type', filters.type);
    if (filters?.currency) params.append('currency', filters.currency);
    if (filters?.country) params.append('country', filters.country);
    if (filters?.network) params.append('network', filters.network);

    return apiCall(`/p2p/offers?${params.toString()}`);
  },

  createOffer: (
    token: string,
    data: {
      type: 'buy' | 'sell';
      amount: number;
      price: number;
      network: 'TRC20' | 'BEP20';
      fiat_currency: string;
      country: string;
      payment_method: string;
      min_limit?: number;
      max_limit?: number;
      margin?: number;
      kyc_required?: boolean;
    }
  ) => apiCall('/p2p/offers', { method: 'POST', body: data, token }),

  getMyOffers: (token: string) =>
    apiCall('/p2p/my-offers', { token }),

  acceptOffer: (token: string, data: { offer_id: string; amount: number }) =>
    apiCall('/p2p/accept-offer', { method: 'POST', body: data, token }),

  getMyTrades: (token: string) =>
    apiCall('/p2p/my-trades', { token }),

  markAsPaid: (token: string, tradeId: string) =>
    apiCall(`/p2p/trades/${tradeId}/mark-paid`, { method: 'POST', token }),

  confirmReceived: (token: string, tradeId: string) =>
    apiCall(`/p2p/trades/${tradeId}/confirm-received`, { method: 'POST', token }),
};

// Activity API
export const activity = {
  getFeed: (token: string) =>
    apiCall('/activity/feed', { token }),

  getTodayEarnings: (token: string) =>
    apiCall('/activity/today-earnings', { token }),
};

// Admin API
export const admin = {
  getUsers: (token: string, filters?: { search?: string; role?: string }) => {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.role) params.append('role', filters.role);

    return apiCall(`/admin/users?${params.toString()}`, { token });
  },

  freezeUser: (token: string, userId: string, isFrozen: boolean) =>
    apiCall(`/admin/users/${userId}/freeze`, {
      method: 'POST',
      body: { is_frozen: isFrozen },
      token,
    }),

  changeUserRole: (token: string, userId: string, role: 'user' | 'admin') =>
    apiCall(`/admin/users/${userId}/role`, {
      method: 'POST',
      body: { role },
      token,
    }),

  getPendingWithdrawals: (token: string) =>
    apiCall('/admin/withdrawals/pending', { token }),

  executeWithdrawal: (token: string, withdrawalId: string, providerTxid?: string) =>
    apiCall(`/admin/withdrawals/${withdrawalId}/execute`, {
      method: 'POST',
      body: { provider_txid: providerTxid },
      token,
    }),

  createOrUpdatePackage: (
    token: string,
    data: {
      id?: string;
      name: string;
      min_amount: number;
      daily_percent: number;
      referral_required: number;
    }
  ) => apiCall('/admin/packages', { method: 'POST', body: data, token }),

  setPriceRange: (
    token: string,
    data: { fiat_currency: string; min_price: number; max_price: number }
  ) => apiCall('/admin/p2p-price-ranges', { method: 'POST', body: data, token }),

  getDisputes: (token: string, filters?: { status?: string }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);

    return apiCall(`/admin/disputes?${params.toString()}`, { token });
  },

  resolveDispute: (
    token: string,
    disputeId: string,
    data: { resolution: string; refund_to?: 'buyer' | 'seller' }
  ) =>
    apiCall(`/admin/disputes/${disputeId}/resolve`, {
      method: 'POST',
      body: data,
      token,
    }),

  getAuditLogs: (token: string) =>
    apiCall('/admin/audit-logs', { token }),

  getDeposits: (token: string, filters?: { status?: string; userId?: string; email?: string; network?: string; startDate?: string; endDate?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.userId) params.append('userId', filters.userId);
    if (filters?.email) params.append('email', filters.email);
    if (filters?.network) params.append('network', filters.network);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.limit) params.append('limit', filters.limit.toString());

    return apiCall(`/admin/deposits?${params.toString()}`, { token });
  },

  getDepositDetails: (token: string, depositId: string) =>
    apiCall(`/admin/deposits/${depositId}`, { token }),

  getWithdrawals: (token: string, filters?: { status?: string; userId?: string; email?: string; network?: string; startDate?: string; endDate?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.userId) params.append('userId', filters.userId);
    if (filters?.email) params.append('email', filters.email);
    if (filters?.network) params.append('network', filters.network);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.limit) params.append('limit', filters.limit.toString());

    return apiCall(`/admin/withdrawals?${params.toString()}`, { token });
  },

  getWithdrawalDetails: (token: string, withdrawalId: string) =>
    apiCall(`/admin/withdrawals/${withdrawalId}`, { token }),

  getMiningPurchases: (token: string, filters?: { status?: string; email?: string; package_id?: string; startDate?: string; endDate?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.email) params.append('email', filters.email);
    if (filters?.package_id) params.append('package_id', filters.package_id);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.limit) params.append('limit', filters.limit.toString());

    return apiCall(`/admin/mining?${params.toString()}`, { token });
  },

  getMiningPurchaseDetails: (token: string, purchaseId: string) =>
    apiCall(`/admin/mining/${purchaseId}`, { token }),
};

// Token management
export const tokenManager = {
  getToken: () => localStorage.getItem('globance_token'),
  setToken: (token: string) => localStorage.setItem('globance_token', token),
  removeToken: () => localStorage.removeItem('globance_token'),
  isAuthenticated: () => !!localStorage.getItem('globance_token'),
};

export default { auth, wallet, packages, mining, p2p, activity, admin, tokenManager };
