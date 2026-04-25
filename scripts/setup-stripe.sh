#!/bin/bash
# Setup Stripe products, prices, and webhook for Organic Brand Studio
# Run in TEST mode against the PSL Stripe account

set -e

STRIPE="$HOME/.local/bin/stripe"
# Set STRIPE_API_KEY in your environment before running this script
# e.g.: export STRIPE_API_KEY="sk_test_..."
if [ -z "$STRIPE_API_KEY" ]; then
  echo "Error: STRIPE_API_KEY environment variable is not set."
  echo "Export it before running: export STRIPE_API_KEY='sk_test_...'"
  exit 1
fi

echo "=== Creating Stripe Products & Prices for Organic ==="
echo ""

# ─── Starter: $99/mo, 25 articles, 1 seat, 5 domains ───
echo "1. Creating Starter product + price..."
STARTER_PROD=$($STRIPE products create \
  --name="Organic Starter" \
  --description="25 articles/month, 1 seat, 5 domains" \
  -d "metadata[plan_id]=starter" 2>&1 | grep '"id":' | head -1 | sed 's/.*"id": "//;s/".*//')

STARTER_PRICE=$($STRIPE prices create \
  --product="$STARTER_PROD" \
  --unit-amount=9900 \
  --currency=usd \
  -d "recurring[interval]=month" \
  -d "metadata[plan_id]=starter" 2>&1 | grep '"id":' | head -1 | sed 's/.*"id": "//;s/".*//')

echo "   Product: $STARTER_PROD"
echo "   Price:   $STARTER_PRICE"

# Starter overage: $3.50/article
STARTER_OVERAGE=$($STRIPE prices create \
  --product="$STARTER_PROD" \
  --unit-amount=350 \
  --currency=usd \
  -d "recurring[interval]=month" \
  -d "recurring[usage_type]=metered" \
  -d "metadata[type]=overage" \
  -d "metadata[plan_id]=starter" 2>&1 | grep '"id":' | head -1 | sed 's/.*"id": "//;s/".*//')

echo "   Overage: $STARTER_OVERAGE"
echo ""

# ─── Standard: $299/mo, 80 articles, 3 seats, unlimited domains ───
echo "2. Creating Standard product + price..."
STANDARD_PROD=$($STRIPE products create \
  --name="Organic Standard" \
  --description="80 articles/month, 3 seats, unlimited domains, API access" \
  -d "metadata[plan_id]=standard" 2>&1 | grep '"id":' | head -1 | sed 's/.*"id": "//;s/".*//')

STANDARD_PRICE=$($STRIPE prices create \
  --product="$STANDARD_PROD" \
  --unit-amount=29900 \
  --currency=usd \
  -d "recurring[interval]=month" \
  -d "metadata[plan_id]=standard" 2>&1 | grep '"id":' | head -1 | sed 's/.*"id": "//;s/".*//')

echo "   Product: $STANDARD_PROD"
echo "   Price:   $STANDARD_PRICE"

# Standard overage: $3.00/article
STANDARD_OVERAGE=$($STRIPE prices create \
  --product="$STANDARD_PROD" \
  --unit-amount=300 \
  --currency=usd \
  -d "recurring[interval]=month" \
  -d "recurring[usage_type]=metered" \
  -d "metadata[type]=overage" \
  -d "metadata[plan_id]=standard" 2>&1 | grep '"id":' | head -1 | sed 's/.*"id": "//;s/".*//')

echo "   Overage: $STANDARD_OVERAGE"
echo ""

# ─── Scale: $999/mo, 300 articles, 10 seats, unlimited domains ───
echo "3. Creating Scale product + price..."
SCALE_PROD=$($STRIPE products create \
  --name="Organic Scale" \
  --description="300 articles/month, 10 seats, unlimited domains, API access" \
  -d "metadata[plan_id]=scale" 2>&1 | grep '"id":' | head -1 | sed 's/.*"id": "//;s/".*//')

SCALE_PRICE=$($STRIPE prices create \
  --product="$SCALE_PROD" \
  --unit-amount=99900 \
  --currency=usd \
  -d "recurring[interval]=month" \
  -d "metadata[plan_id]=scale" 2>&1 | grep '"id":' | head -1 | sed 's/.*"id": "//;s/".*//')

echo "   Product: $SCALE_PROD"
echo "   Price:   $SCALE_PRICE"

# Scale overage: $2.50/article
SCALE_OVERAGE=$($STRIPE prices create \
  --product="$SCALE_PROD" \
  --unit-amount=250 \
  --currency=usd \
  -d "recurring[interval]=month" \
  -d "recurring[usage_type]=metered" \
  -d "metadata[type]=overage" \
  -d "metadata[plan_id]=scale" 2>&1 | grep '"id":' | head -1 | sed 's/.*"id": "//;s/".*//')

echo "   Overage: $SCALE_OVERAGE"
echo ""

echo "=== All Products & Prices Created ==="
echo ""
echo "Add these to your .env.local:"
echo ""
echo "# Stripe API"
echo "STRIPE_SECRET_KEY=$STRIPE_API_KEY"
echo ""
echo "# Subscription Price IDs"
echo "STRIPE_PRICE_STARTER=$STARTER_PRICE"
echo "STRIPE_PRICE_STANDARD=$STANDARD_PRICE"
echo "STRIPE_PRICE_SCALE=$SCALE_PRICE"
echo ""
echo "# Overage Price IDs"
echo "STRIPE_OVERAGE_STARTER=$STARTER_OVERAGE"
echo "STRIPE_OVERAGE_STANDARD=$STANDARD_OVERAGE"
echo "STRIPE_OVERAGE_SCALE=$SCALE_OVERAGE"
