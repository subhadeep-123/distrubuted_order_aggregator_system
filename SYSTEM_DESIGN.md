# System Design: Order Aggregator

## Overview

A distributed order processing system that handles stock aggregation from multiple vendors and processes orders through a message queue. Built to demonstrate the key concepts:

- Stock aggregation and synchronization from vendor APIs
- Atomic order processing to prevent overselling
- Asynchronous order handling using RabbitMQ
- Basic fault tolerance when vendors are unavailable

This is designed for the assignment requirements - keeping things simple without the complexity you'd see in production systems.

## Architecture

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│   Vendor A  │    │   Vendor B   │    │   Client    │
│ (Mock API)  │    │  (Mock API)  │    │             │
└─────┬───────┘    └──────┬───────┘    └─────┬───────┘
      │                   │                  │
      │ GET /stock        │ GET /stock       │ POST /order
      ▼                   ▼                  ▼
┌─────────────────────────────────────────────────────────┐
│                  Main App (app.js)                     │
│  ┌─────────────┐ ┌──────────────┐ ┌─────────────────┐  │
│  │   Models    │ │     API      │ │  Stock Sync     │  │
│  │ ·Product    │ │ ·POST /order │ │ ·Vendor calls   │  │
│  │ ·Stock      │ │ ·GET /orders │ │ ·DB updates     │  │
│  │ ·Order      │ │ ·GET /health │ │                 │  │
│  └─────────────┘ └──────────────┘ └─────────────────┘  │
└─────────────┬───────────────────────────────────────────┘
              │
              ▼ Queue Message
┌─────────────────────────────────────────────────────────┐
│                    RabbitMQ                            │
│              Order Processing Queue                     │
└─────────────┬───────────────────────────────────────────┘
              │
              ▼ Process Message
┌─────────────────────────────────────────────────────────┐
│               Order Worker                              │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ 1. Parse order from queue                          │ │
│  │ 2. Start database transaction                      │ │
│  │ 3. Reserve stock atomically                        │ │
│  │ 4. Update order status                             │ │
│  │ 5. Commit or rollback                              │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────┬───────────────────────────────────────────┘
              │
              ▼ Database Operations
┌─────────────────────────────────────────────────────────┐
│                  PostgreSQL                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────────────┐ │
│  │ Products │ │  Stock   │ │        Orders            │ │
│  │          │ │          │ │                          │ │
│  └──────────┘ └──────────┘ └──────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Components

### Main App (app.js)
The core application handles API requests and includes the basic Sequelize models inline. Pretty straightforward Express server with a few endpoints and the vendor integration logic.

### Order Worker
Separate process that consumes messages from RabbitMQ and handles the actual order processing with database transactions. This is where the atomic stock operations happen.

### Mock Vendors
Simple Express servers that provide stock data via REST APIs. In the real world these would be external vendor systems.

### Infrastructure
- PostgreSQL for data persistence
- RabbitMQ for message queuing

## Data Models

Just three simple models:

```javascript
Product: { sku, name, price }
Stock:   { sku, vendor, quantity }  
Order:   { id, customerId, items, status }
```

Pretty basic - no complex relationships or foreign keys to keep things simple.

## How It Works

### Stock Sync
On startup, the app makes HTTP calls to both vendor APIs, gets their stock data, and stores it in the local database. Pretty straightforward.

### Order Processing
When someone POSTs to /order, we check local stock availability, create an order record, and send a message to RabbitMQ. The worker picks up the message and does the actual stock reservation in a database transaction.

### Stock Reservation
The worker uses database transactions to atomically:
- Reserve stock from local inventory
- Make API calls to vendors to reduce their stock
- Update the order status
- Rollback everything if anything fails

### Retry Logic
If order processing fails, the worker retries up to 3 times with a 60-second delay between attempts. After that, orders go to a failed queue.