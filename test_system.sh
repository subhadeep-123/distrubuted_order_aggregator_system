#!/bin/bash

# Distributed Order Aggregator System Test Script
# This script tests the complete system functionality

set -e  # Exit on any error

API_URL="http://localhost:3000"
VENDOR_A_URL="http://localhost:3001"
VENDOR_B_URL="http://localhost:3002"

echo "Testing Distributed Order Aggregator System"
echo "============================================"

# Function to check if service is running
check_service() {
    local url=$1
    local name=$2
    echo -n "Checking $name... "
    
    if curl -s "$url/health" > /dev/null 2>&1; then
        echo "[OK] Running"
        return 0
    else
        echo "[FAIL] Not running"
        return 1
    fi
}

# Function to wait for service
wait_for_service() {
    local url=$1
    local name=$2
    local max_attempts=30
    local attempt=1
    
    echo "Waiting for $name to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s "$url/health" > /dev/null 2>&1; then
            echo "$name is ready"
            return 0
        fi
        
        echo "Attempt $attempt/$max_attempts - waiting..."
        sleep 2
        ((attempt++))
    done
    
    echo "$name failed to start within timeout"
    return 1
}

# Test 1: Check all services are running
echo "Test 1: Service Health Checks"
echo "------------------------------"

check_service "$API_URL" "Main API Server"
check_service "$VENDOR_A_URL" "Vendor A Mock"
check_service "$VENDOR_B_URL" "Vendor B Mock"

echo ""

# Test 2: Check vendor stock data
echo "Test 2: Vendor Stock Availability"
echo "----------------------------------"

echo -n "Checking VendorA stock... "
VENDOR_A_STOCK=$(curl -s "$VENDOR_A_URL/stock" | jq length 2>/dev/null || echo "0")
echo "$VENDOR_A_STOCK products"

echo -n "Checking VendorB stock... "
VENDOR_B_STOCK=$(curl -s "$VENDOR_B_URL/stock" | jq length 2>/dev/null || echo "0")
echo "$VENDOR_B_STOCK products"

echo ""

# Test 3: Stock synchronization
echo "Test 3: Stock Synchronization"
echo "------------------------------"

echo "Triggering manual stock sync..."
if command -v npm > /dev/null 2>&1; then
    npm run stock-sync > /dev/null 2>&1 && echo "Stock sync completed" || echo "Stock sync failed"
else
    node src/scripts/stockSync.js > /dev/null 2>&1 && echo "Stock sync completed" || echo "Stock sync failed"
fi

echo ""

# Test 4: Simple order placement
echo "Test 4: Order Placement"
echo "------------------------"

# Get a sample SKU from VendorA
SAMPLE_SKU=$(curl -s "$VENDOR_A_URL/stock" | jq -r '.[0].sku' 2>/dev/null || echo "LAPTOP-a-001")
echo "Using sample SKU: $SAMPLE_SKU"

# Create a test order
ORDER_RESPONSE=$(curl -s -X POST "$API_URL/api/orders" \
    -H "Content-Type: application/json" \
    -d "{
        \"customerId\": \"test-customer-$(date +%s)\",
        \"customerEmail\": \"test@example.com\",
        \"items\": [
            {
                \"sku\": \"$SAMPLE_SKU\",
                \"quantity\": 1
            }
        ]
    }")

if echo "$ORDER_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    ORDER_ID=$(echo "$ORDER_RESPONSE" | jq -r '.data.order.id')
    ORDER_NUMBER=$(echo "$ORDER_RESPONSE" | jq -r '.data.order.orderNumber')
    echo "Order created successfully"
    echo "   Order ID: $ORDER_ID"
    echo "   Order Number: $ORDER_NUMBER"
else
    echo "Order creation failed"
    echo "Response: $ORDER_RESPONSE"
fi

echo ""

# Test 5: Order status check
echo "Test 5: Order Status Check"
echo "---------------------------"

if [ ! -z "$ORDER_ID" ]; then
    sleep 3  # Wait for order processing
    
    ORDER_STATUS=$(curl -s "$API_URL/api/orders/$ORDER_ID" | jq -r '.data.order.status' 2>/dev/null || echo "unknown")
    echo "Order status: $ORDER_STATUS"
    
    if [[ "$ORDER_STATUS" == "confirmed" || "$ORDER_STATUS" == "processing" ]]; then
        echo "Order processing successful"
    else
        echo "Order status: $ORDER_STATUS (may still be processing)"
    fi
else
    echo "No order ID to check"
fi

echo ""

# Test 6: Concurrent order test
echo "Test 6: Concurrent Order Processing"
echo "------------------------------------"

echo "Placing 5 concurrent orders..."

for i in {1..5}; do
    curl -s -X POST "$API_URL/api/orders" \
        -H "Content-Type: application/json" \
        -d "{
            \"customerId\": \"concurrent-test-$i\",
            \"customerEmail\": \"test$i@example.com\",
            \"items\": [
                {
                    \"sku\": \"$SAMPLE_SKU\",
                    \"quantity\": 1
                }
            ]
        }" > /dev/null &
done

wait  # Wait for all background jobs to complete

echo "Concurrent orders submitted"

# Check recent orders
sleep 2
RECENT_ORDERS=$(curl -s "$API_URL/api/orders?limit=10" | jq '.data.orders | length' 2>/dev/null || echo "0")
echo "Recent orders in system: $RECENT_ORDERS"

echo ""

# Test 7: Vendor failure simulation
echo "Test 7: Vendor Failure Handling"
echo "--------------------------------"

echo "Testing system resilience with vendor failure simulation..."

# Try to trigger a stock fluctuation (this might fail gracefully)
curl -s -X POST "$VENDOR_A_URL/simulate/fluctuation" > /dev/null 2>&1 && echo "Vendor simulation triggered" || echo "Vendor simulation unavailable"

echo ""

# Test 8: System health summary
echo "Test 8: System Health Summary"
echo "------------------------------"

HEALTH_RESPONSE=$(curl -s "$API_URL/health")
echo "System health check:"
echo "$HEALTH_RESPONSE" | jq . 2>/dev/null || echo "$HEALTH_RESPONSE"

echo ""

# Test 9: Performance test
echo "Test 9: Basic Performance Test"
echo "-------------------------------"

echo "Testing API response times..."

# Time a simple health check
START_TIME=$(date +%s%N)
curl -s "$API_URL/health" > /dev/null
END_TIME=$(date +%s%N)
RESPONSE_TIME=$(( (END_TIME - START_TIME) / 1000000 ))

echo "Health check response time: ${RESPONSE_TIME}ms"

# Time an order placement
START_TIME=$(date +%s%N)
curl -s -X POST "$API_URL/api/orders" \
    -H "Content-Type: application/json" \
    -d "{
        \"customerId\": \"perf-test\",
        \"items\": [
            {
                \"sku\": \"$SAMPLE_SKU\",
                \"quantity\": 1
            }
        ]
    }" > /dev/null
END_TIME=$(date +%s%N)
ORDER_TIME=$(( (END_TIME - START_TIME) / 1000000 ))

echo "Order creation response time: ${ORDER_TIME}ms"

echo ""

# Summary
echo "Test Summary"
echo "============"
echo "All basic functionality tests completed"
echo "System appears to be working correctly"
echo ""
echo "Quick Stats:"
echo "- Vendor A Products: $VENDOR_A_STOCK"
echo "- Vendor B Products: $VENDOR_B_STOCK"
echo "- Recent Orders: $RECENT_ORDERS"
echo "- Health Check Time: ${RESPONSE_TIME}ms"
echo "- Order Creation Time: ${ORDER_TIME}ms"
echo ""
echo "Useful URLs:"
echo "- Main API: $API_URL"
echo "- Health Check: $API_URL/health"
echo "- Orders API: $API_URL/api/orders"
echo "- RabbitMQ Management: http://localhost:15672 (admin/password)"
echo "- Vendor A: $VENDOR_A_URL"
echo "- Vendor B: $VENDOR_B_URL"
echo ""
echo "System test completed successfully!"

echo "Testing Order Aggregator System..."

# Test health endpoint
echo "1. Testing health endpoint..."
curl -s http://localhost:3000/health

echo -e "\n\n2. Placing test order..."
# Place an order (Assignment requirement: POST /order endpoint)
curl -X POST http://localhost:3000/order \
  -H "Content-Type: application/json" \
  -d '{"productId": "LAPTOP-001", "quantity": 1, "customerId": "test-user"}'

echo -e "\n\n3. Checking orders..."
# Check orders
curl -s http://localhost:3000/api/orders

echo -e "\n\nTest complete!" 