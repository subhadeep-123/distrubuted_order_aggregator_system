# Simple Makefile for Assignment
.PHONY: help setup up down logs logs-app logs-worker logs-db logs-rabbitmq status clean test

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