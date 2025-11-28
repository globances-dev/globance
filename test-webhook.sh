#!/bin/bash
# Test NOWPayments webhook endpoint

echo "🔍 Testing NOWPayments Webhook Endpoint"
echo "========================================"
echo ""

# Test 1: Health check
echo "Test 1: Server health check..."
curl -s http://localhost:5000/api/health | head -20
echo -e "\n"

# Test 2: Webhook endpoint accessibility
echo "Test 2: Webhook endpoint (should return 400 - missing signature)..."
curl -s -X POST http://localhost:5000/api/webhook/nowpayments \
  -H "Content-Type: application/json" \
  -d '{"test": true}' | head -20
echo -e "\n"

# Test 3: Check if webhook route is registered
echo "Test 3: Checking route registration..."
curl -s -X POST http://localhost:5000/api/webhook/test 2>&1 | head -20
echo -e "\n"

echo "✅ Webhook endpoint tests complete!"
echo ""
echo "Expected results:"
echo "- Test 1: Should return {\"status\":\"ok\"}"
echo "- Test 2: Should return {\"error\":\"Missing signature or body\"}"
echo "- Test 3: Should return 404 (route not found)"
