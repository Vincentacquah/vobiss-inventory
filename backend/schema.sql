-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create items table
CREATE TABLE IF NOT EXISTS items (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    quantity INTEGER DEFAULT 0 NOT NULL CHECK (quantity >= 0),
    low_stock_threshold INTEGER NOT NULL CHECK (low_stock_threshold >= 0),
    vendor_name VARCHAR(255),
    unit_price DECIMAL(10, 2) CHECK (unit_price >= 0),
    receipt_image VARCHAR(500),
    update_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create items_out table
CREATE TABLE IF NOT EXISTS items_out (
    id SERIAL PRIMARY KEY,
    person_name VARCHAR(255) NOT NULL,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    date_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create requests table
CREATE TABLE IF NOT EXISTS requests (
    id SERIAL PRIMARY KEY,
    created_by VARCHAR(255) NOT NULL,
    team_leader_name VARCHAR(255) NOT NULL,
    team_leader_phone VARCHAR(20),
    project_name VARCHAR(255) NOT NULL,
    isp_name VARCHAR(255),
    location VARCHAR(255) NOT NULL,
    deployment_type VARCHAR(100) NOT NULL,
    release_by VARCHAR(255),
    received_by VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending' NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create request_items table
CREATE TABLE IF NOT EXISTS request_items (
    id SERIAL PRIMARY KEY,
    request_id INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    quantity_requested INTEGER NOT NULL CHECK (quantity_requested > 0),
    quantity_received INTEGER DEFAULT NULL CHECK (quantity_received >= 0),
    quantity_returned INTEGER DEFAULT NULL CHECK (quantity_returned >= 0)
);

-- Create approvals table
CREATE TABLE IF NOT EXISTS approvals (
    id SERIAL PRIMARY KEY,
    request_id INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    approver_name VARCHAR(255) NOT NULL,
    signature VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_items_category_id ON items(category_id);
CREATE INDEX IF NOT EXISTS idx_items_out_item_id ON items_out(item_id);
CREATE INDEX IF NOT EXISTS idx_request_items_request_id ON request_items(request_id);
CREATE INDEX IF NOT EXISTS idx_request_items_item_id ON request_items(item_id);
CREATE INDEX IF NOT EXISTS idx_approvals_request_id ON approvals(request_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests(created_at);