# 🚀 Deployment Guide - Email Sender Service

Complete guide for deploying the Email Sender Service to production environments.

**Version**: 1.0.0
**Last Updated**: 2025-12-08

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development Deployment](#local-development-deployment)
3. [Production Deployment](#production-deployment)
4. [Cloud Deployments](#cloud-deployments)
5. [HTTPS/TLS Configuration](#httpstls-configuration)
6. [Environment Variables](#environment-variables)
7. [Database Setup](#database-setup)
8. [Monitoring & Logging](#monitoring--logging)
9. [Backup & Recovery](#backup--recovery)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements

#### Minimum:
- **CPU**: 2 cores
- **RAM**: 4GB
- **Storage**: 20GB
- **OS**: Ubuntu 20.04+ / Debian 11+ / CentOS 8+

#### Recommended:
- **CPU**: 4 cores
- **RAM**: 8GB
- **Storage**: 50GB SSD
- **OS**: Ubuntu 22.04 LTS

### Required Software

```bash
# Docker
Docker Engine 20.10+
Docker Compose 2.0+

# For HTTPS (production)
Nginx or Apache
Certbot (Let's Encrypt)
```

### Network Requirements

**Ports to Open**:
- `80` - HTTP (redirect to HTTPS)
- `443` - HTTPS (production)
- `3000` - Backend API (internal/reverse proxy)
- `5432` - PostgreSQL (internal only, not public)

---

## Local Development Deployment

### Quick Start

```bash
# 1. Clone repository
git clone https://github.com/yourusername/hosted-email-sender-service.git
cd hosted-email-sender-service

# 2. Configure environment
cp .env.example .env
nano .env  # Edit with your settings

# 3. Start services
docker-compose up -d --build

# 4. Verify deployment
docker-compose ps
curl http://localhost:3000/api/auth/me
```

### Access Points

- **Frontend**: http://localhost
- **Backend API**: http://localhost:3000
- **Database**: localhost:5432 (internal)

---

## Production Deployment

### Step 1: Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

### Step 2: Application Setup

```bash
# Create application directory
sudo mkdir -p /opt/email-sender-service
cd /opt/email-sender-service

# Clone repository
git clone https://github.com/yourusername/hosted-email-sender-service.git .

# Set permissions
sudo chown -R $USER:$USER /opt/email-sender-service
```

### Step 3: Environment Configuration

```bash
# Copy and edit environment file
cp .env.example .env
nano .env
```

**Production .env settings**:

```env
# Database (Use strong passwords!)
POSTGRES_USER=emailsender
POSTGRES_PASSWORD=CHANGE_THIS_TO_STRONG_PASSWORD_32_CHARS_MIN
POSTGRES_DB=emailsender_db
DATABASE_URL=postgresql://emailsender:CHANGE_THIS_TO_STRONG_PASSWORD_32_CHARS_MIN@db:5432/emailsender_db

# Backend
NODE_ENV=production
PORT=3000

# JWT (Generate with: openssl rand -hex 32)
JWT_SECRET=YOUR_SUPER_SECRET_JWT_KEY_AT_LEAST_32_CHARACTERS_LONG
JWT_EXPIRES_IN=7d

# SMTP Encryption (Generate with: openssl rand -hex 16)
SMTP_ENCRYPTION_KEY=YOUR_32_CHARACTER_ENCRYPTION_KEY_HERE

# CORS (Set to your domain)
CORS_ORIGIN=https://yourdomain.com

# Frontend API URL
REACT_APP_API_URL=https://yourdomain.com/api
```

### Step 4: Generate Secure Keys

```bash
# Generate JWT secret
openssl rand -hex 32

# Generate SMTP encryption key
openssl rand -hex 16
```

### Step 5: Build and Start

```bash
# Build and start containers
docker-compose up -d --build

# Check container status
docker-compose ps

# View logs
docker-compose logs -f
```

### Step 6: Verify Deployment

```bash
# Test backend API
curl http://localhost:3000/api/auth/me

# Expected response (401 Unauthorized):
# {"error":"No token provided"}

# Check all containers are healthy
docker-compose ps
```

---

## Cloud Deployments

### AWS Deployment

#### Option 1: EC2 Instance

```bash
# 1. Launch EC2 instance (Ubuntu 22.04, t3.medium)
# 2. Configure security groups (ports 80, 443, 22)
# 3. SSH into instance
ssh -i your-key.pem ubuntu@your-ec2-ip

# 4. Follow "Production Deployment" steps above
# 5. Configure Elastic IP for static IP
# 6. Set up Route 53 for DNS
```

#### Option 2: ECS (Elastic Container Service)

```bash
# 1. Create ECS cluster
aws ecs create-cluster --cluster-name email-sender-cluster

# 2. Create task definition
# Use docker-compose.yml as reference

# 3. Create RDS PostgreSQL instance
aws rds create-db-instance \
  --db-instance-identifier email-sender-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username emailsender \
  --master-user-password YOUR_PASSWORD \
  --allocated-storage 20

# 4. Deploy service
aws ecs create-service \
  --cluster email-sender-cluster \
  --service-name email-sender-service \
  --task-definition email-sender-task \
  --desired-count 1 \
  --launch-type FARGATE
```

### Google Cloud Platform

```bash
# 1. Create Compute Engine instance
gcloud compute instances create email-sender \
  --machine-type=n1-standard-2 \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=50GB

# 2. SSH into instance
gcloud compute ssh email-sender

# 3. Follow "Production Deployment" steps
# 4. Configure Cloud SQL for PostgreSQL
# 5. Set up Cloud Load Balancing
```

### DigitalOcean

```bash
# 1. Create Droplet (Ubuntu 22.04, 4GB RAM)
# 2. Add SSH key
# 3. SSH into droplet
ssh root@your-droplet-ip

# 4. Follow "Production Deployment" steps
# 5. Configure Floating IP
# 6. Set up Managed PostgreSQL (optional)
```

---

## HTTPS/TLS Configuration

### Using Nginx as Reverse Proxy

#### Step 1: Install Nginx

```bash
sudo apt update
sudo apt install nginx -y
```

#### Step 2: Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/email-sender
```

**Nginx Configuration**:

```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com www.yourdomain.com;

    # Let's Encrypt verification
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Redirect to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS Server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL Certificates
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Frontend (static files)
    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts for long-running requests (email sending)
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # File upload size limit
    client_max_body_size 10M;
}
```

#### Step 3: Enable Site

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/email-sender /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

#### Step 4: Install Let's Encrypt SSL

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Obtain certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

---

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `POSTGRES_USER` | Database username | `emailsender` |
| `POSTGRES_PASSWORD` | Database password (strong!) | `Str0ng_P@ssw0rd_32_Ch4rs` |
| `POSTGRES_DB` | Database name | `emailsender_db` |
| `DATABASE_URL` | Full database connection string | `postgresql://user:pass@db:5432/emailsender_db` |
| `NODE_ENV` | Environment | `production` |
| `PORT` | Backend port | `3000` |
| `JWT_SECRET` | JWT signing key (32+ chars) | `generated_with_openssl_rand_hex_32` |
| `JWT_EXPIRES_IN` | Token expiration | `7d` |
| `SMTP_ENCRYPTION_KEY` | SMTP credential encryption (32 chars) | `generated_with_openssl_rand_hex_16` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CORS_ORIGIN` | Allowed CORS origins | `*` (production: set domain) |
| `LOG_LEVEL` | Logging level | `info` |
| `RATE_LIMIT_WINDOW` | Rate limit window | `15` (minutes) |
| `RATE_LIMIT_MAX` | Max attempts | `5` |

---

## Database Setup

### PostgreSQL Configuration

#### Using Docker (Included)

The Docker Compose configuration includes PostgreSQL. Data persists in Docker volumes.

```bash
# View database container
docker-compose ps db

# Access database
docker-compose exec db psql -U emailsender -d emailsender

# Backup database
docker-compose exec db pg_dump -U emailsender emailsender > backup.sql

# Restore database
docker-compose exec -T db psql -U emailsender emailsender < backup.sql
```

#### Using External PostgreSQL

1. Create database:
```sql
CREATE DATABASE emailsender;
CREATE USER emailsender WITH PASSWORD 'strong_password';
GRANT ALL PRIVILEGES ON DATABASE emailsender TO emailsender;
```

2. Update `.env`:
```env
DATABASE_URL=postgresql://emailsender:password@external-host:5432/emailsender
```

3. Comment out `db` service in `docker-compose.yml`

---

## Monitoring & Logging

### Docker Logs

```bash
# View all logs
docker-compose logs -f

# View backend logs only
docker-compose logs -f backend

# View last 100 lines
docker-compose logs --tail=100 backend

# Save logs to file
docker-compose logs backend > backend.log
```

### Application Monitoring

#### Install Monitoring Tools

```bash
# Install monitoring stack (optional)
docker run -d --name prometheus \
  -p 9090:9090 \
  prom/prometheus

docker run -d --name grafana \
  -p 3001:3000 \
  grafana/grafana
```

### Log Rotation

```bash
# Configure Docker log rotation
sudo nano /etc/docker/daemon.json
```

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

```bash
# Restart Docker
sudo systemctl restart docker
```

---

## Backup & Recovery

### Automated Backup Script

Create `/opt/email-sender-service/backup.sh`:

```bash
#!/bin/bash

# Configuration
BACKUP_DIR="/opt/backups/email-sender"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
docker-compose exec -T db pg_dump -U emailsender emailsender | gzip > "$BACKUP_DIR/db_$DATE.sql.gz"

# Backup .env file
cp .env "$BACKUP_DIR/env_$DATE.backup"

# Remove old backups
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -name "env_*.backup" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: $DATE"
```

```bash
# Make executable
chmod +x backup.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add line:
0 2 * * * /opt/email-sender-service/backup.sh >> /var/log/email-sender-backup.log 2>&1
```

### Restore from Backup

```bash
# Stop application
docker-compose down

# Restore database
gunzip -c /opt/backups/email-sender/db_YYYYMMDD_HHMMSS.sql.gz | \
  docker-compose exec -T db psql -U emailsender emailsender

# Start application
docker-compose up -d

# Verify
docker-compose ps
```

---

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs backend

# Rebuild containers
docker-compose down
docker-compose up --build -d

# Check disk space
df -h

# Check Docker resources
docker system df
```

### Database Connection Errors

```bash
# Verify database container
docker-compose ps db

# Check database logs
docker-compose logs db

# Test connection
docker-compose exec db psql -U emailsender -d emailsender -c "SELECT 1;"

# Verify DATABASE_URL in .env
cat .env | grep DATABASE_URL
```

### SMTP Issues

```bash
# Test SMTP from backend container
docker-compose exec backend node -e "
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: 'your@gmail.com',
    pass: 'your-app-password'
  }
});
transporter.verify().then(console.log).catch(console.error);
"
```

### High Memory Usage

```bash
# Check container stats
docker stats

# Restart containers
docker-compose restart

# Limit resources in docker-compose.yml
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 512M
```

### SSL Certificate Issues

```bash
# Renew certificate manually
sudo certbot renew

# Check certificate expiration
sudo certbot certificates

# Test SSL configuration
curl -vI https://yourdomain.com
```

---

## Security Checklist

### Pre-Deployment

- [ ] Strong passwords for database (32+ characters)
- [ ] Unique JWT_SECRET (generated with openssl)
- [ ] Unique SMTP_ENCRYPTION_KEY (32 characters)
- [ ] CORS_ORIGIN set to your domain (not *)
- [ ] Firewall configured (only ports 80, 443, 22 open)
- [ ] .env file permissions set to 600
- [ ] No secrets committed to git
- [ ] npm audit run and issues fixed

### Post-Deployment

- [ ] HTTPS/TLS enabled
- [ ] SSL certificate auto-renewal configured
- [ ] Database accessible only from backend container
- [ ] Automated backups configured
- [ ] Monitoring and alerting set up
- [ ] Log rotation configured
- [ ] Security headers configured in Nginx

---

## Performance Optimization

### Database Optimization

```sql
-- Add indexes (already in init.sql)
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns(created_at);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign_id ON campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_campaign_id ON email_logs(campaign_id);

-- Analyze tables
ANALYZE campaigns;
ANALYZE campaign_recipients;
ANALYZE email_logs;
```

### Container Resource Limits

Edit `docker-compose.yml`:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
```

---

## Scaling

### Horizontal Scaling

For high-traffic deployments:

1. **Load Balancer**: Use Nginx/HAProxy for multiple backend instances
2. **Database Replication**: PostgreSQL read replicas
3. **Session Store**: Redis for session management
4. **Queue System**: Bull/RabbitMQ for email queue

### Docker Swarm Deployment

```bash
# Initialize swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.yml email-sender

# Scale backend
docker service scale email-sender_backend=3
```

---

## Support

For deployment issues:
- **Documentation**: This guide
- **GitHub Issues**: https://github.com/yourusername/hosted-email-sender-service/issues
- **Email**: support@example.com

---

**Last Updated**: 2025-12-08
**Version**: 1.0.0
