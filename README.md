# Distributed Order Aggregator System

A Node.js-based order processing platform that acts as a stock aggregator, syncing inventories from multiple third-party vendor systems and ensuring consistent and reliable order handling under high load.

## 🏗️ System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Vendor A API  │    │   Vendor B API  │    │  More Vendors   │
│   (Mock/Real)   │    │   (Mock/Real)   │    │   (Scalable)    │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          │ HTTP Stock Sync      │                      │
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                ┌────────────────┴────────────────┐
                │     Order Aggregator System     │
                │  ┌─────────────────────────────┐ │
                │  │    PostgreSQL Database      │ │
                │  │  - Products & Stock         │ │
                │  │  - Orders & Reservations    │ │
                │  │  - Vendor Management        │ │
                │  └─────────────────────────────┘ │
                │  ┌─────────────────────────────┐ │
                │  │      RabbitMQ Queue         │ │
                │  │  - Order Processing         │ │
                │  │  - Stock Synchronization    │ │
                │  │  - Dead Letter Queues       │ │
                │  └─────────────────────────────┘ │
                │  ┌─────────────────────────────┐ │
                │  │       Redis Cache           │ │
                │  │  - Stock Caching            │ │
                │  │  - Session Management       │ │
                │  └─────────────────────────────┘ │
                └─────────────────────────────────┘
                                 │
                ┌────────────────┴────────────────┐
                │         API Clients             │
                │  - Web Applications             │
                │  - Mobile Apps                  │
                │  - Third-party Integrations     │
                └─────────────────────────────────┘
```

## 🚀 Key Features

### ✅ Core Requirements Implementation

- **✅ Vendor Integration**: Mock vendor APIs with stock aggregation
- **✅ Order API**: POST /order with atomic stock operations  
- **✅ Queue Integration**: RabbitMQ with retry logic and DLQ
- **✅ Consistency**: ACID transactions and optimistic locking
- **✅ High Availability**: Concurrent workers and graceful shutdown

### 🎯 Advanced Features

- **Stock Reservation System**: Temporary holds with expiration
- **Atomic Operations**: Database transactions with isolation levels
- **Retry Logic**: Exponential backoff with dead letter queues
- **Graceful Degradation**: Vendor failure handling
- **Comprehensive Logging**: Structured logging with Winston
- **Health Monitoring**: System health endpoints
- **Concurrent Processing**: Multiple worker processes

## 📋 Prerequisites

- Node.js 16+ 
- Docker & Docker Compose
- PostgreSQL 15+
- RabbitMQ 3.12+
- Redis 7+

## Quick Start

```bash
make setup  # builds everything and sets up the database
make test   # places a test order
```

## Project Structure

```
src/
├── app.js              # main application file
├── workers/
│   └── orderWorker.js  # processes orders from queue
└── scripts/
    ├── setupDatabase.js
    └── stockSync.js
mock-vendor-server.js   # mock vendor APIs
```

## Features

- Stock aggregation from 2 mock vendors
- Order API with POST /order endpoint
- RabbitMQ queue processing with atomic transactions
- PostgreSQL database with basic models
- Docker setup for easy development

## API Usage

```bash
# Place an order
curl -X POST http://localhost:3000/order \
  -H "Content-Type: application/json" \
  -d '{"productId": "LAPTOP-001", "quantity": 1, "customerId": "test"}'

# View orders
curl http://localhost:3000/api/orders

# Health check
curl http://localhost:3000/health
```


## 📖 API Documentation

### Health Check
```bash
GET /health
```

### Order Management

#### Create Order
```bash
POST /api/orders
Content-Type: application/json

{
  "customerId": "customer-123",
  "customerEmail": "customer@example.com",
  "items": [
    {
      "sku": "LAPTOP-a-001",
      "quantity": 2,
      "unitPrice": 999.99
    },
    {
      "sku": "SMARTPHONE-b-002", 
      "quantity": 1,
      "unitPrice": 599.99
    }
  ],
  "shippingAddress": {
    "street": "123 Main St",
    "city": "Boston",
    "state": "MA",
    "zipCode": "02101",
    "country": "USA"
  },
  "paymentMethod": "credit_card",
  "notes": "Urgent delivery required"
}
```

#### Get Orders
```bash
GET /api/orders?page=1&limit=20&status=confirmed
```

#### Get Order by ID
```bash
GET /api/orders/{orderId}
```

#### Cancel Order
```bash
POST /api/orders/{orderId}/cancel
Content-Type: application/json

{
  "reason": "Customer requested cancellation"
}
```

## Usage Examples

### Example 1: Place a Simple Order

```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "test-customer",
    "customerEmail": "test@example.com",
    "items": [
      {
        "sku": "LAPTOP-a-001",
        "quantity": 1
      }
    ]
  }'
```

### Example 2: Check System Health

```bash
curl http://localhost:3000/health
```

### Example 3: Monitor Vendor Status

```bash
# Check VendorA health
curl http://localhost:3001/health

# Check VendorB stock
curl http://localhost:3002/stock

# Get vendor information
curl http://localhost:3001/info
```

## 🔄 Stock Synchronization

### Manual Sync Commands

```bash
# Sync all vendors
npm run stock-sync

# Sync specific vendor
npm run stock-sync vendor VendorA

# Aggregate local stocks only
npm run stock-sync aggregate
```

### Automatic Sync

Stock synchronization runs automatically every 30 seconds when the system is running.

## 🎛️ Queue Management

### RabbitMQ Management UI

- URL: http://localhost:15672
- Username: admin
- Password: password

### Queue Operations

Monitor queues:
- `order_queue` - Order processing
- `stock_sync_queue` - Stock synchronization
- `order_queue.dlq` - Failed orders
- `stock_sync_queue.dlq` - Failed sync operations

## 🧪 Testing the System

### Test Order Processing Under Load

```bash
# Test concurrent order placement
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/orders \
    -H "Content-Type: application/json" \
    -d '{
      "customerId": "load-test-'$i'",
      "items": [{"sku": "LAPTOP-a-001", "quantity": 1}]
    }' &
done
wait
```

### Test Vendor Failure Scenarios

```bash
# Stop a vendor service
docker stop vendor_a_service

# Try to sync stocks (should handle gracefully)
npm run stock-sync

# Restart vendor
docker start vendor_a_service
```

### Test Stock Fluctuations

```bash
# Simulate stock changes at VendorA
curl -X POST http://localhost:3001/simulate/fluctuation

# Re-sync stocks
npm run stock-sync
```

## 🛡️ Consistency Guarantees

### ACID Transactions
- All order operations use database transactions
- Stock reservations are atomic
- Consistent state maintained across vendors

### Concurrency Control
- Optimistic locking with version numbers
- Serializable isolation levels for critical operations
- Queue-based processing prevents race conditions

### Failure Recovery
- Dead letter queues for failed messages
- Exponential backoff retry logic
- Graceful degradation on vendor failures

## Monitoring & Observability

### Logs
```bash
# View application logs
tail -f logs/combined.log

# View error logs only
tail -f logs/error.log

# Live log monitoring
npm run dev  # Uses nodemon with live reload
```

### Metrics Endpoints

- `/health` - Overall system health
- `/api/orders?status=failed` - Failed orders
- RabbitMQ Management UI for queue metrics

## 🚀 Production Deployment

### Environment Setup

1. Set `NODE_ENV=production`
2. Configure proper database credentials
3. Set up Redis cluster for high availability
4. Configure RabbitMQ cluster
5. Set up proper logging (external log aggregation)
6. Configure monitoring and alerting

### Scaling Considerations

1. **Horizontal Scaling**: Deploy multiple API instances behind load balancer
2. **Worker Scaling**: Run multiple worker processes across different machines
3. **Database Scaling**: Use read replicas for stock queries
4. **Queue Scaling**: RabbitMQ clustering for high throughput
5. **Vendor Integration**: Implement circuit breakers and rate limiting

## 🏗️ System Design Decisions

### 1. Stock Aggregation Strategy
- **Local Copy**: Maintain aggregated stock in PostgreSQL for fast access
- **Periodic Sync**: Balance between freshness and performance  
- **Eventual Consistency**: Accept temporary inconsistencies for better availability

### 2. Order Processing Architecture
- **Queue-Based**: Decouple order creation from processing
- **Atomic Reservations**: Use database transactions for stock operations
- **Timeout Management**: Automatic reservation expiration

### 3. Consistency Model
- **Strong Consistency**: Within local order processing
- **Eventual Consistency**: Between vendor stock and local stock
- **Optimistic Locking**: Prevent concurrent modification issues

### 4. Error Handling Strategy
- **Retry Logic**: Exponential backoff with maximum attempts
- **Dead Letter Queues**: Preserve failed messages for analysis
- **Graceful Degradation**: Continue operating with partial vendor failures