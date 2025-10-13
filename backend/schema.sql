-- Create requests table
CREATE TABLE requests (
  id SERIAL PRIMARY KEY,
  team_leader_phone VARCHAR(20) NOT NULL,
  project_name VARCHAR(100) NOT NULL,
  isp_name VARCHAR(100) NOT NULL,
  location VARCHAR(100) NOT NULL,
  deployment_type ENUM('Deployment', 'Maintenance') NOT NULL,
  release_by VARCHAR(50) NULL,
  received_by VARCHAR(50) NULL,
  status ENUM('pending', 'approved', 'completed') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create request_items table
CREATE TABLE request_items (
  id SERIAL PRIMARY KEY,
  request_id INTEGER REFERENCES requests(id) ON DELETE CASCADE,
  item_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
  quantity_requested INTEGER NULL,
  quantity_received INTEGER NULL,
  quantity_returned INTEGER NULL
);

-- Create approvals table
CREATE TABLE approvals (
  id SERIAL PRIMARY KEY,
  request_id INTEGER REFERENCES requests(id) ON DELETE CASCADE,
  approver_name VARCHAR(50) NOT NULL,
  signature VARCHAR(100) NOT NULL,
  approved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Grant privileges
GRANT ALL ON requests TO vobiss;
GRANT ALL ON request_items TO vobiss;
GRANT ALL ON approvals TO vobiss;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO vobiss;

-- Create indexes
CREATE INDEX idx_requests_team_leader_phone ON requests(team_leader_phone);
CREATE INDEX idx_request_items_request_id ON request_items(request_id);
CREATE INDEX idx_request_items_item_id ON request_items(item_id);
CREATE INDEX idx_approvals_request_id ON approvals(request_id);

-- Update trigger for requests
CREATE TRIGGER update_requests_timestamp
BEFORE UPDATE ON requests
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();