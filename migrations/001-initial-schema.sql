-- Create database schema for WhatsApp HubSpot Calling Integration

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- HubSpot Accounts table
CREATE TABLE IF NOT EXISTS hubspot_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hubspot_account_id VARCHAR(100) NOT NULL UNIQUE,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    token_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    whatsapp_sender VARCHAR(50),
    calling_settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Call Permissions table
CREATE TABLE IF NOT EXISTS call_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contact_phone VARCHAR(50) NOT NULL,
    hubspot_account_id UUID NOT NULL,
    permission_status VARCHAR(20) DEFAULT 'pending' CHECK (permission_status IN ('pending', 'granted', 'denied', 'expired', 'revoked')),
    granted_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    request_count INTEGER DEFAULT 0,
    last_request_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(contact_phone, hubspot_account_id),
    FOREIGN KEY (hubspot_account_id) REFERENCES hubspot_accounts(id)
);

-- Calls table
CREATE TABLE IF NOT EXISTS calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    twilio_call_sid VARCHAR(255) NOT NULL UNIQUE,
    hubspot_contact_id BIGINT,
    hubspot_engagement_id BIGINT,
    hubspot_account_id UUID NOT NULL,
    from_number VARCHAR(50) NOT NULL,
    to_number VARCHAR(50) NOT NULL,
    call_direction VARCHAR(20) NOT NULL CHECK (call_direction IN ('inbound', 'outbound')),
    call_status VARCHAR(20) DEFAULT 'initiated' CHECK (call_status IN ('initiated', 'ringing', 'in-progress', 'completed', 'failed', 'no-answer', 'busy')),
    call_duration INTEGER DEFAULT 0,
    recording_url VARCHAR(500),
    transcription TEXT,
    contact_owner_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (hubspot_account_id) REFERENCES hubspot_accounts(id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_hubspot_accounts_account_id ON hubspot_accounts(hubspot_account_id);
CREATE INDEX IF NOT EXISTS idx_hubspot_accounts_active ON hubspot_accounts(is_active);

CREATE INDEX IF NOT EXISTS idx_call_permissions_phone_account ON call_permissions(contact_phone, hubspot_account_id);
CREATE INDEX IF NOT EXISTS idx_call_permissions_status ON call_permissions(permission_status);
CREATE INDEX IF NOT EXISTS idx_call_permissions_expires ON call_permissions(expires_at);

CREATE INDEX IF NOT EXISTS idx_calls_twilio_sid ON calls(twilio_call_sid);
CREATE INDEX IF NOT EXISTS idx_calls_hubspot_contact ON calls(hubspot_contact_id);
CREATE INDEX IF NOT EXISTS idx_calls_hubspot_account ON calls(hubspot_account_id);
CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(call_status);
CREATE INDEX IF NOT EXISTS idx_calls_direction ON calls(call_direction);
CREATE INDEX IF NOT EXISTS idx_calls_created_at ON calls(created_at);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_hubspot_accounts_updated_at BEFORE UPDATE ON hubspot_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_call_permissions_updated_at BEFORE UPDATE ON call_permissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_calls_updated_at BEFORE UPDATE ON calls FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();