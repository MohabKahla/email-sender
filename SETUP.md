# Email Sender Service - Quick Setup Guide

This guide will help you run the Email Sender Service on any machine with **zero manual database setup**.

## Prerequisites

- Docker and Docker Compose installed
- Ports 80, 3000, and 5432 available

## Quick Start (Automated)

### Option 1: Use the startup script (Recommended)

```bash
./start.sh
```

This script will:
- Clean up any existing containers and volumes
- Build and start all services
- Automatically create the database
- Initialize the schema with all tables
- Verify everything is working

### Option 2: Manual commands

```bash
# Stop any existing containers and remove volumes
docker-compose down -v

# Start all services
docker-compose up -d

# Wait for services to be ready (about 10 seconds)
sleep 10

# Verify database
docker exec email-sender-db psql -U emailsender -d emailsender_db -c "\dt"
```

## How It Works

The setup is **fully automated** through Docker:

1. **Database Creation**: PostgreSQL automatically creates the `emailsender_db` database on first startup using the `POSTGRES_DB` environment variable

2. **Schema Initialization**: The `database/init.sql` file is mounted to `/docker-entrypoint-initdb.d/` which PostgreSQL executes automatically on first initialization

3. **No Manual Steps**: Everything runs automatically when you start the containers

## Configuration

All configuration is in the `.env` file:

```env
# Database settings (automatically used by Docker)
POSTGRES_USER=emailsender
POSTGRES_PASSWORD=SecureP@ssw0rd2024!
POSTGRES_DB=emailsender_db

# Connection string (backend uses this)
DATABASE_URL=postgresql://emailsender:SecureP@ssw0rd2024!@db:5432/emailsender_db
```

## Accessing the Application

- **Frontend**: http://localhost:80
- **Backend API**: http://localhost:3000
- **Health Check**: http://localhost:3000/api/health

## Useful Commands

### View logs
```bash
docker-compose logs -f
docker-compose logs -f backend
docker-compose logs -f db
```

### Stop services
```bash
docker-compose down
```

### Complete reset (clean everything)
```bash
docker-compose down -v
docker-compose up -d
```

### Access database directly
```bash
docker exec -it email-sender-db psql -U emailsender -d emailsender_db
```

### Test database connection
```bash
docker-compose exec backend node src/test-db.js
```

## Troubleshooting

### "Database does not exist" error

This usually happens if:
1. Old volumes exist with stale data
2. Database wasn't fully initialized

**Solution**: Clean restart
```bash
docker-compose down -v
docker-compose up -d
```

### Port already in use

If ports 80, 3000, or 5432 are already in use:
1. Stop the conflicting services
2. Or modify the ports in `docker-compose.yml`

### Can't connect to database

Check if the database is healthy:
```bash
docker-compose ps
```

All services should show `(healthy)` status.

## Running on a New Machine

1. Clone the repository
2. Ensure `.env` file exists (copy from `.env.example` if needed)
3. Run `./start.sh`

That's it! No manual database setup required.

## Database Schema

The following tables are automatically created:
- `users` - User accounts
- `smtp_configs` - SMTP/Gmail configurations per user
- `campaigns` - Email campaigns
- `campaign_recipients` - Recipients for each campaign
- `email_logs` - Email send history

All tables are defined in `database/init.sql`.
