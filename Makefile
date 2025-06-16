# Simple Makefile for Assignment
.PHONY: help setup up down logs logs-app logs-worker logs-db logs-rabbitmq status clean test
.PHONY: db-local-setup db-local-start db-local-stop db-local-status db-local-clean
.PHONY: local-setup local-start local-stop local-dev

help:
	@echo "Assignment Commands:"
	@echo "  setup      - Build and start all services"
	@echo "  up         - Start services"
	@echo "  down       - Stop services"
	@echo "  logs       - Show all logs"
	@echo "  logs-app   - Show app logs only"
	@echo "  logs-worker - Show worker logs only"
	@echo "  logs-db    - Show database logs only"
	@echo "  logs-rabbitmq - Show RabbitMQ logs only"
	@echo "  status     - Show container status"
	@echo "  test       - Test the system"
	@echo "  clean      - Clean up"
	@echo ""
	@echo "Local Development Commands:"
	@echo "  db-local-setup   - Create and setup local PostgreSQL database"
	@echo "  db-local-start   - Start local PostgreSQL service"
	@echo "  db-local-stop    - Stop local PostgreSQL service"
	@echo "  db-local-status  - Check local PostgreSQL service status"
	@echo "  db-local-clean   - Remove local database data"
	@echo "  local-setup      - Setup for local development (DB + RabbitMQ)"
	@echo "  local-start      - Start local development environment"
	@echo "  local-stop       - Stop local development environment"
	@echo "  local-dev        - Start app locally with local DB"

setup:
	docker-compose up --build -d
	timeout /t 10 /nobreak >nul 2>&1 || ping 127.0.0.1 -n 11 >nul
	docker-compose exec app npm run setup-db
	docker-compose exec app npm run stock-sync

up:
	docker-compose up -d

down:
	docker-compose down

logs:
	docker-compose logs -f

logs-app:
	docker-compose logs -f app

logs-worker:
	docker-compose logs -f worker

logs-db:
	docker-compose logs -f postgres

logs-rabbitmq:
	docker-compose logs -f rabbitmq

status:
	docker-compose ps

test:
	curl -X POST http://localhost:3000/order \
		-H "Content-Type: application/json" \
		-d '{"productId": "LAPTOP-001", "quantity": 1, "customerId": "test"}'

clean:
	docker-compose down -v

# Local Database Commands
db-local-setup:
	@echo "Setting up local PostgreSQL database..."
	@echo "Please ensure PostgreSQL is installed and running on your system"
	@echo "Creating database and user..."
	psql -U postgres -c "CREATE DATABASE order_aggregator;" || echo "Database may already exist"
	psql -U postgres -c "CREATE USER postgres;" || echo "User may already exist"
	psql -U postgres -c "ALTER USER postgres WITH PASSWORD 'admin';" || echo "Password may already be set"
	psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE order_aggregator TO postgres;" || echo "Privileges may already be granted"
	@echo "Setting up database schema..."
	npm run setup-db
	@echo "Local database setup complete!"

db-local-start:
	@echo "Starting local PostgreSQL service..."
	net start postgresql-x64-15 || echo "Service may already be running or named differently"
	@echo "Use 'sc query postgresql*' to check service names if this doesn't work"

db-local-stop:
	@echo "Stopping local PostgreSQL service..."
	net stop postgresql-x64-15 || echo "Service may already be stopped or named differently"

db-local-status:
	@echo "Checking local PostgreSQL service status..."
	sc query postgresql-x64-15 || echo "Service not found with this name, checking alternatives..."
	@echo "All PostgreSQL services:"
	sc query type= service | findstr /i postgres

db-local-clean:
	@echo "Cleaning local database..."
	psql -U postgres -c "DROP DATABASE IF EXISTS order_aggregator;"
	@echo "Database cleaned!"

# Local Development Environment
local-setup:
	@echo "Setting up local development environment..."
	@$(MAKE) db-local-setup
	@echo "Starting RabbitMQ with Docker..."
	docker run -d --name rabbitmq-local \
		-p 5672:5672 -p 15672:15672 \
		-e RABBITMQ_DEFAULT_USER=admin \
		-e RABBITMQ_DEFAULT_PASS=password \
		rabbitmq:3-management-alpine || echo "RabbitMQ container may already exist"
	@echo "Waiting for RabbitMQ to start..."
	timeout /t 10 /nobreak >nul 2>&1 || ping 127.0.0.1 -n 11 >nul
	@echo "Local setup complete!"

local-start:
	@echo "Starting local development environment..."
	@$(MAKE) db-local-start
	docker start rabbitmq-local || echo "RabbitMQ container may already be running"
	@echo "Environment ready!"

local-stop:
	@echo "Stopping local development environment..."
	@$(MAKE) db-local-stop
	docker stop rabbitmq-local || echo "RabbitMQ container may already be stopped"
	@echo "Environment stopped!"

local-dev:
	@echo "Starting application in local development mode..."
	@echo "Make sure local database and RabbitMQ are running"
	@echo "Starting vendor mock servers..."
	start "Vendor A" cmd /k "set PORT=3001 && set VENDOR_NAME=VendorA && node mock-vendor-server.js"
	start "Vendor B" cmd /k "set PORT=3002 && set VENDOR_NAME=VendorB && node mock-vendor-server.js"
	@echo "Waiting for vendors to start..."
	timeout /t 5 /nobreak >nul 2>&1 || ping 127.0.0.1 -n 6 >nul
	@echo "Syncing stock data..."
	npm run stock-sync
	@echo "Starting main application..."
	npm start 