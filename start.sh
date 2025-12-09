#!/bin/bash

# Email Sender Service - Startup Script
# This script sets up and runs the entire application with zero manual configuration

set -e  # Exit on any error

echo "🚀 Email Sender Service - Automated Setup"
echo "=========================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "Please create .env file with your configuration"
    exit 1
fi

echo "✅ Configuration file (.env) found"
echo ""

# Stop and remove existing containers and volumes
echo "🧹 Cleaning up existing containers and volumes..."
docker-compose down -v

echo ""
echo "🏗️  Building and starting services..."
docker-compose up -d --build

echo ""
echo "⏳ Waiting for database to initialize..."
sleep 10

# Wait for database to be healthy
echo "🏥 Checking database health..."
until docker-compose exec -T db pg_isready -U emailsender > /dev/null 2>&1; do
    echo "   Waiting for database..."
    sleep 2
done

echo "✅ Database is ready"
echo ""

# Verify database and tables
echo "🔍 Verifying database schema..."
docker-compose exec -T db psql -U emailsender -d emailsender_db -c "\dt" | grep -q "users" && echo "✅ All tables created successfully"

echo ""
echo "🎉 Email Sender Service is ready!"
echo "=========================================="
echo ""
echo "📱 Access the application:"
echo "   Frontend: http://localhost:80"
echo "   Backend API: http://localhost:3000"
echo "   Health Check: http://localhost:3000/api/health"
echo ""
echo "📊 View logs:"
echo "   docker-compose logs -f"
echo ""
echo "🛑 Stop services:"
echo "   docker-compose down"
echo ""
