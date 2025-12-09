-- Email Sender Database Schema
-- Created: 2025-12-03
-- Updated: 2025-12-04 (Phase 4 schema updates)
-- Description: Multi-user bulk email sender with Gmail SMTP integration

-- Enable UUID extension (optional, for future use)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- Table: users
-- Description: User accounts with authentication
-- =====================================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for email lookups (login)
CREATE INDEX idx_users_email ON users(email);

-- Comments for documentation
COMMENT ON TABLE users IS 'User accounts for multi-user authentication';
COMMENT ON COLUMN users.email IS 'Unique email address used for login';
COMMENT ON COLUMN users.password_hash IS 'Bcrypt hashed password (never store plain text)';

-- =====================================================
-- Table: smtp_configs
-- Description: Gmail SMTP credentials per user
-- =====================================================
CREATE TABLE smtp_configs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    gmail_address VARCHAR(255) NOT NULL,
    app_password_encrypted TEXT NOT NULL,
    from_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for user lookups
CREATE INDEX idx_smtp_configs_user_id ON smtp_configs(user_id);

-- Comments
COMMENT ON TABLE smtp_configs IS 'Gmail SMTP configuration per user (one per user)';
COMMENT ON COLUMN smtp_configs.app_password_encrypted IS 'AES-256 encrypted Gmail app password';
COMMENT ON COLUMN smtp_configs.from_name IS 'Display name shown in From field';

-- =====================================================
-- Table: campaigns
-- Description: Email campaigns (bulk send sessions)
-- =====================================================
CREATE TABLE campaigns (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    email_body TEXT NOT NULL,
    html_body TEXT,
    recipient_count INTEGER NOT NULL DEFAULT 0,
    sent_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for querying
CREATE INDEX idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX idx_campaigns_created_at ON campaigns(created_at DESC);
CREATE INDEX idx_campaigns_status ON campaigns(status);

-- Check constraint for status values
ALTER TABLE campaigns ADD CONSTRAINT check_campaign_status
    CHECK (status IN ('draft', 'queued', 'sending', 'completed', 'failed', 'cancelled'));

-- Comments
COMMENT ON TABLE campaigns IS 'Email campaigns with templates and send statistics';
COMMENT ON COLUMN campaigns.name IS 'Campaign name for identification';
COMMENT ON COLUMN campaigns.subject IS 'Email subject line with template variables';
COMMENT ON COLUMN campaigns.email_body IS 'Plain text email body with template variables';
COMMENT ON COLUMN campaigns.html_body IS 'HTML email body with template variables (optional)';
COMMENT ON COLUMN campaigns.status IS 'Current status: draft, queued, sending, completed, failed, cancelled';
COMMENT ON COLUMN campaigns.started_at IS 'Timestamp when campaign sending started';
COMMENT ON COLUMN campaigns.completed_at IS 'Timestamp when campaign finished (NULL if not completed)';

-- =====================================================
-- Table: campaign_recipients
-- Description: Individual recipients for each campaign
-- =====================================================
CREATE TABLE campaign_recipients (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    custom_fields JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    sent_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for querying
CREATE INDEX idx_campaign_recipients_campaign_id ON campaign_recipients(campaign_id);
CREATE INDEX idx_campaign_recipients_status ON campaign_recipients(status);

-- Check constraint for status values
ALTER TABLE campaign_recipients ADD CONSTRAINT check_recipient_status
    CHECK (status IN ('pending', 'sent', 'failed'));

-- Comments
COMMENT ON TABLE campaign_recipients IS 'Individual recipients imported from CSV for each campaign';
COMMENT ON COLUMN campaign_recipients.email IS 'Recipient email address';
COMMENT ON COLUMN campaign_recipients.name IS 'Recipient name (optional)';
COMMENT ON COLUMN campaign_recipients.custom_fields IS 'Custom fields from CSV as JSON for template variables';
COMMENT ON COLUMN campaign_recipients.status IS 'Send status: pending, sent, failed';

-- =====================================================
-- Table: email_logs
-- Description: Individual email send results
-- =====================================================
CREATE TABLE email_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
    recipient_id INTEGER REFERENCES campaign_recipients(id) ON DELETE CASCADE,
    recipient_email VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    status VARCHAR(20) NOT NULL,
    message_id VARCHAR(255),
    error_message TEXT,
    sent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for querying campaign results
CREATE INDEX idx_email_logs_user_id ON email_logs(user_id);
CREATE INDEX idx_email_logs_campaign_id ON email_logs(campaign_id);
CREATE INDEX idx_email_logs_status ON email_logs(status);

-- Check constraint for status values
ALTER TABLE email_logs ADD CONSTRAINT check_email_log_status
    CHECK (status IN ('sent', 'failed', 'bounced'));

-- Comments
COMMENT ON TABLE email_logs IS 'Individual email send results for each recipient';
COMMENT ON COLUMN email_logs.user_id IS 'User who sent the email';
COMMENT ON COLUMN email_logs.campaign_id IS 'Campaign this email belongs to (NULL for non-campaign emails)';
COMMENT ON COLUMN email_logs.recipient_id IS 'Campaign recipient record (NULL for non-campaign emails)';
COMMENT ON COLUMN email_logs.subject IS 'Email subject that was sent';
COMMENT ON COLUMN email_logs.status IS 'Send result: sent, failed, bounced';
COMMENT ON COLUMN email_logs.message_id IS 'SMTP message ID from mail server (if sent successfully)';
COMMENT ON COLUMN email_logs.error_message IS 'Error details if status is failed (NULL if sent)';

-- =====================================================
-- Trigger: Update updated_at timestamp automatically
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to users table
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to smtp_configs table
CREATE TRIGGER update_smtp_configs_updated_at
    BEFORE UPDATE ON smtp_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to campaigns table
CREATE TRIGGER update_campaigns_updated_at
    BEFORE UPDATE ON campaigns
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Sample Data (Optional - for development/testing)
-- =====================================================
-- Uncomment below to create a test user
-- Password: 'testpassword123' (hashed with bcrypt)
-- INSERT INTO users (full_name, email, password_hash) VALUES
-- ('Test User', 'test@example.com', '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890');

-- =====================================================
-- Verification Queries
-- =====================================================
-- List all tables
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- Show table structures
-- \d users
-- \d smtp_configs
-- \d campaigns
-- \d campaign_recipients
-- \d email_logs
