# Simple Makefile for Assignment
.PHONY: help setup up down logs clean test

help:
	@echo "Assignment Commands:"
	@echo "  setup  - Build and start all services"
	@echo "  up     - Start services"
	@echo "  down   - Stop services"
	@echo "  logs   - Show logs"
	@echo "  test   - Test the system"
	@echo "  clean  - Clean up"

setup:
	docker-compose up --build -d
	sleep 10
	docker-compose exec app npm run setup-db
	docker-compose exec app npm run stock-sync

up:
	docker-compose up -d

down:
	docker-compose down

logs:
	docker-compose logs -f

test:
	curl -X POST http://localhost:3000/order \
		-H "Content-Type: application/json" \
		-d '{"productId": "LAPTOP-001", "quantity": 1, "customerId": "test"}'

clean:
	docker-compose down -v 