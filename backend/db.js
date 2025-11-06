import { Pool } from 'pg';
import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcrypt';
import crypto from 'crypto'; // For password generation
// Load environment variables
config({ path: './.env' });
// Debug environment variables
console.log('Environment variables:', {
  PG_HOST: process.env.PG_HOST,
  PG_PORT: process.env.PG_PORT,
  PG_DATABASE: process.env.PG_DATABASE,
  PG_USER: process.env.PG_USER,
  PG_PASSWORD: process.env.PG_PASSWORD ? '[REDACTED]' : 'undefined',
});
// Initialize PostgreSQL client
const pool = new Pool({
  host: process.env.PG_HOST,
  port: process.env.PG_PORT,
  database: process.env.PG_DATABASE,
  user: process.env.PG_USER,
  password: String(process.env.PG_PASSWORD || ''),
});
// Developer code for wipe, backup, restore (can be moved to env in production)
const DEVELOPER_CODE = process.env.DEVELOPER_CODE || 'DEVELOPER_WIPE_2025';
// Function to generate unique 6-character password
function generatePassword() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}
// Function to generate unique username based on last name
async function generateUniqueUsername(lastName) {
  let baseUsername = lastName.toLowerCase().trim().replace(/\s+/g, '');
  let username = baseUsername;
  let counter = 1;
  while (true) {
    const exists = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (exists.rowCount === 0) {
      return username;
    }
    username = `${baseUsername}${counter}`;
    counter++;
  }
}
// Enhanced table creation with graceful error handling
async function createTableIfNotExists(query, tableName) {
  try {
    await pool.query(query);
    console.log(`Table "${tableName}" created or already exists.`);
  } catch (error) {
    const code = error && error.code ? error.code : null;
    const message = error && error.message ? error.message : String(error);
    if (code === '42P07' || (message && message.includes('already exists'))) {
      console.log(`Table "${tableName}" already exists - skipping creation.`);
    } else {
      console.error(`Error creating table "${tableName}":`, message);
      throw error; // Re-throw non-idempotent errors
    }
  }
}
// Helper function to add column if not exists using DO block
async function addColumnIfNotExists(tableName, columnName, columnDefinition) {
  const query = `
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = '${tableName}' AND column_name = '${columnName}'
        ) THEN
            ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition};
        END IF;
    END $$;
  `;
  try {
    await pool.query(query);
    console.log(`Column "${columnName}" added to table "${tableName}" or already exists.`);
  } catch (error) {
    console.warn(`Warning adding column "${columnName}" to "${tableName}":`, error.message);
  }
}
// Database backup function (updated to require developer code, include new junction table and serial numbers)
export async function backupDatabase(developerCode) {
  if (developerCode !== DEVELOPER_CODE) {
    throw new Error('Invalid developer code');
  }
  try {
    const tables = [
      'users', 'supervisors', 'settings', 'audit_logs', 'categories', 'vendors',
      'items', 'items_out', 'requests', 'request_items', 'approvals', 'rejections',
      'request_approvers', 'item_serial_numbers' // New table
    ];
    const backup = {};
    for (const table of tables) {
      const result = await pool.query(`SELECT * FROM ${table}`);
      backup[table] = result.rows;
    }
    console.log('Database backup completed successfully.');
    return backup;
  } catch (error) {
    console.error('Error creating database backup:', error.stack);
    throw error;
  }
}
// Database restore function (updated to require developer code, fixed to preserve original IDs and reset sequences, handle new tables)
export async function restoreDatabase(backupData, developerCode) {
  if (developerCode !== DEVELOPER_CODE) {
    throw new Error('Invalid developer code');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Truncate tables in reverse dependency order (CASCADE handles FK)
    const truncateOrder = [
      'audit_logs', 'rejections', 'approvals', 'request_items', 'request_approvers', 'item_serial_numbers',
      'requests', 'items_out', 'items', 'vendors', 'categories', 'settings', 'supervisors', 'users'
    ];
    for (const table of truncateOrder) {
      await client.query(`TRUNCATE TABLE ${table} CASCADE`);
    }
    // Insert tables in dependency order, preserving original IDs
    const insertOrder = [
      'users', 'supervisors', 'settings', 'categories', 'vendors', 'items',
      'item_serial_numbers', 'items_out', 'requests', 'request_approvers',
      'request_items', 'approvals', 'rejections', 'audit_logs'
    ];
    for (const table of insertOrder) {
      if (!backupData[table] || backupData[table].length === 0) {
        // For empty tables, reset sequence to 1
        await client.query(`SELECT setval('${table}_id_seq', 1, false);`);
        continue;
      }
      for (const row of backupData[table]) {
        const keys = Object.keys(row);
        const columns = keys.join(', ');
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
        const values = keys.map(key => row[key]);
        await client.query(`INSERT INTO ${table} (${columns}) VALUES (${placeholders})`, values);
      }
      // Reset sequence after inserting
      const maxId = Math.max(...backupData[table].map(r => r.id || 0));
      const isCalled = maxId > 0;
      await client.query(`SELECT setval('${table}_id_seq', ${maxId}, ${isCalled});`);
    }
    await client.query('COMMIT');
    console.log('Database restore completed successfully.');
    return { message: 'Database restored successfully' };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error restoring database:', error.stack);
    throw error;
  } finally {
    client.release();
  }
}
// Database wipe function (requires developer code, updated for new table)
export async function wipeDatabase(developerCode) {
  if (developerCode !== DEVELOPER_CODE) {
    throw new Error('Invalid developer code');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Truncate all tables (CASCADE handles FK)
    const truncateOrder = [
      'audit_logs', 'rejections', 'approvals', 'request_items', 'request_approvers', 'item_serial_numbers',
      'requests', 'items_out', 'items', 'vendors', 'categories', 'settings', 'supervisors', 'users'
    ];
    for (const table of truncateOrder) {
      await client.query(`TRUNCATE TABLE ${table} CASCADE`);
    }
    await client.query('COMMIT');
    console.log('Database wiped successfully.');
    return { message: 'Database wiped successfully' };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error wiping database:', error.stack);
    throw error;
  } finally {
    client.release();
  }
}
// Initialize database tables with enhanced error handling (add request_approvers junction table and serial numbers)
export async function initDB() {
  try {
    // Users table
    await createTableIfNotExists(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        first_name VARCHAR(255) NOT NULL,
        last_name VARCHAR(255) NOT NULL,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'requester' CHECK (role IN ('requester', 'approver', 'issuer', 'superadmin')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP
      );
    `, 'users');
    await addColumnIfNotExists('users', 'deleted_at', 'TIMESTAMP');
    // Add/migrate columns for users if needed (using helper for conditional add)
    try {
      await addColumnIfNotExists('users', 'first_name', 'VARCHAR(255) NOT NULL DEFAULT \'\'');
      await addColumnIfNotExists('users', 'last_name', 'VARCHAR(255) NOT NULL DEFAULT \'\'');
      await addColumnIfNotExists('users', 'email', 'VARCHAR(255) UNIQUE NOT NULL DEFAULT \'\'');
      // Drop defaults after adding (safe if column exists)
      await pool.query(`ALTER TABLE users ALTER COLUMN first_name DROP DEFAULT;`);
      await pool.query(`ALTER TABLE users ALTER COLUMN last_name DROP DEFAULT;`);
      await pool.query(`ALTER TABLE users ALTER COLUMN email DROP DEFAULT;`);
      await pool.query(`ALTER TABLE users ADD CONSTRAINT IF NOT EXISTS check_role CHECK (role IN ('requester', 'approver', 'issuer', 'superadmin'));`);
      console.log('Users table migration completed successfully.');
    } catch (alterError) {
      if (!alterError.message.includes('already exists') && !alterError.message.includes('already have')) {
        console.warn('Warning during users schema migration:', alterError.message);
      } else {
        console.log('Users migration skipped (already applied).');
      }
    }
    // Supervisors table
    await createTableIfNotExists(`
      CREATE TABLE IF NOT EXISTS supervisors (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP
      );
    `, 'supervisors');
    await addColumnIfNotExists('supervisors', 'deleted_at', 'TIMESTAMP');
    // Settings table
    await createTableIfNotExists(`
      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        key_name VARCHAR(255) UNIQUE NOT NULL,
        value TEXT NOT NULL,
        description TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, 'settings');
    // Audit logs table
    await createTableIfNotExists(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        action VARCHAR(255) NOT NULL,
        ip_address VARCHAR(45),
        details JSONB,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, 'audit_logs');
    // Categories table
    await createTableIfNotExists(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        parent_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP,
        deleted_at TIMESTAMP
      );
    `, 'categories');
    await addColumnIfNotExists('categories', 'deleted_at', 'TIMESTAMP');
    // Ensure parent_id column exists (for migration)
    await addColumnIfNotExists('categories', 'parent_id', 'INTEGER REFERENCES categories(id) ON DELETE CASCADE');
    // Vendors table
    await createTableIfNotExists(`
      CREATE TABLE IF NOT EXISTS vendors (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        contact_info TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP
      );
    `, 'vendors');
    await addColumnIfNotExists('vendors', 'deleted_at', 'TIMESTAMP');
    // Items table
    await createTableIfNotExists(`
      CREATE TABLE IF NOT EXISTS items (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category_id INTEGER REFERENCES categories(id),
        vendor_id INTEGER REFERENCES vendors(id),
        quantity INTEGER NOT NULL DEFAULT 0,
        low_stock_threshold INTEGER DEFAULT 5,
        vendor_name VARCHAR(255),
        unit_price DECIMAL(10,2),
        receipt_images JSONB DEFAULT '[]',
        update_reasons TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP,
        deleted_at TIMESTAMP
      );
    `, 'items');
    // Add deleted_at column to items
    await addColumnIfNotExists('items', 'deleted_at', 'TIMESTAMP');
    // Migrate vendor_id if needed
    try {
      await addColumnIfNotExists('items', 'vendor_id', 'INTEGER REFERENCES vendors(id)');
      console.log('Items vendor_id migration completed.');
    } catch (alterError) {
      if (!alterError.message.includes('already exists')) {
        console.warn('Warning during items schema migration:', alterError.message);
      } else {
        console.log('Items migration skipped (already applied).');
      }
    }
    // New: Item Serial Numbers table
    await createTableIfNotExists(`
      CREATE TABLE IF NOT EXISTS item_serial_numbers (
        id SERIAL PRIMARY KEY,
        item_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
        serial_number VARCHAR(255) UNIQUE NOT NULL,
        status VARCHAR(50) DEFAULT 'in_stock' CHECK (status IN ('in_stock', 'issued', 'returned', 'damaged', 'lost')),
        issued_to VARCHAR(255),
        issued_at TIMESTAMP,
        returned_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP
      );
    `, 'item_serial_numbers');
    // Items out table
    await createTableIfNotExists(`
      CREATE TABLE IF NOT EXISTS items_out (
        id SERIAL PRIMARY KEY,
        person_name VARCHAR(255) NOT NULL,
        item_id INTEGER REFERENCES items(id),
        quantity INTEGER NOT NULL,
        date_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, 'items_out');
    // Requests table (removed selected_approver_id, as multi now handled by junction)
    await createTableIfNotExists(`
      CREATE TABLE IF NOT EXISTS requests (
        id SERIAL PRIMARY KEY,
        created_by VARCHAR(255) NOT NULL,
        team_leader_name VARCHAR(255),
        team_leader_phone VARCHAR(50),
        project_name VARCHAR(255),
        isp_name VARCHAR(255),
        location TEXT,
        deployment_type VARCHAR(100),
        release_by VARCHAR(255),
        received_by VARCHAR(255),
        type VARCHAR(50) DEFAULT 'material_request' CHECK (type IN ('material_request', 'item_return')),
        reason TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP,
        deleted_at TIMESTAMP
      );
    `, 'requests');
    await addColumnIfNotExists('requests', 'deleted_at', 'TIMESTAMP');
    // New junction table for multi-approvers
    await createTableIfNotExists(`
      CREATE TABLE IF NOT EXISTS request_approvers (
        id SERIAL PRIMARY KEY,
        request_id INTEGER REFERENCES requests(id) ON DELETE CASCADE,
        approver_id INTEGER REFERENCES users(id),
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(request_id, approver_id)
      );
    `, 'request_approvers');
    // Request items table
    await createTableIfNotExists(`
      CREATE TABLE IF NOT EXISTS request_items (
        id SERIAL PRIMARY KEY,
        request_id INTEGER REFERENCES requests(id) ON DELETE CASCADE,
        item_id INTEGER REFERENCES items(id),
        quantity_requested INTEGER NOT NULL,
        quantity_received INTEGER,
        quantity_returned INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP
      );
    `, 'request_items');
    await addColumnIfNotExists('request_items', 'serial_number', 'VARCHAR(255)');
    // Approvals table
    await createTableIfNotExists(`
      CREATE TABLE IF NOT EXISTS approvals (
        id SERIAL PRIMARY KEY,
        request_id INTEGER REFERENCES requests(id) ON DELETE CASCADE,
        approver_name VARCHAR(255) NOT NULL,
        signature TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, 'approvals');
    // Rejections table
    await createTableIfNotExists(`
      CREATE TABLE IF NOT EXISTS rejections (
        id SERIAL PRIMARY KEY,
        request_id INTEGER REFERENCES requests(id) ON DELETE CASCADE,
        rejector_name VARCHAR(255) NOT NULL,
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, 'rejections');
    // Seed default settings if not exist
    const defaults = [
      { key: 'from_name', value: 'Inventory System', desc: 'Sender name for low stock alert emails' },
      { key: 'from_email', value: 'helloriceug@gmail.com', desc: 'Sender email for low stock alert emails' }
    ];
    for (const def of defaults) {
      try {
        const exists = await pool.query('SELECT id FROM settings WHERE key_name = $1', [def.key]);
        if (exists.rowCount === 0) {
          await pool.query(
            'INSERT INTO settings (key_name, value, description) VALUES ($1, $2, $3)',
            [def.key, def.value, def.desc]
          );
          console.log(`Default setting "${def.key}" inserted.`);
        } else {
          console.log(`Default setting "${def.key}" already exists.`);
        }
      } catch (seedError) {
        console.warn(`Error seeding default setting "${def.key}":`, seedError.message);
      }
    }
    // Seed default superadmin user: stockadmin
    try {
      const adminExists = await pool.query('SELECT id FROM users WHERE username = $1', ['stockadmin']);
      if (adminExists.rowCount === 0) {
        const plainPassword = 'ezekeil@vobissadmin';
        const hashedPassword = await bcrypt.hash(plainPassword, 10);
        await pool.query(
          'INSERT INTO users (first_name, last_name, username, email, password, role, created_at) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)',
          ['Stock', 'Admin', 'stockadmin', 'stockadmin@inventory.local', hashedPassword, 'superadmin']
        );
        console.log('Default superadmin user "stockadmin" created with password: ezekeil@vobissadmin');
      } else {
        console.log('Default superadmin user "stockadmin" already exists.');
      }
    } catch (seedError) {
      console.warn('Error seeding default superadmin user:', seedError.message);
    }
    console.log('Database initialization completed successfully. All tables are ready.');
  } catch (error) {
    console.error('Critical error during database initialization:', error.stack);
    throw error; // Re-throw to prevent server start if DB init fails
  }
}
// Settings functions remain the same...
export async function getSettings() {
  try {
    const result = await pool.query('SELECT * FROM settings ORDER BY key_name ASC');
    const settingsMap = {};
    result.rows.forEach(row => {
      settingsMap[row.key_name] = row.value;
    });
    return { ...settingsMap, all: result.rows };
  } catch (error) {
    console.error('Error fetching settings:', error.stack);
    throw error;
  }
}
export async function updateSetting(keyName, value) {
  try {
    const result = await pool.query(
      'UPDATE settings SET value = $1, updated_at = CURRENT_TIMESTAMP WHERE key_name = $2 RETURNING *',
      [value, keyName]
    );
    if (result.rowCount === 0) {
      // Insert if not exists
      await pool.query(
        'INSERT INTO settings (key_name, value, description) VALUES ($1, $2, $3)',
        [keyName, value, '']
      );
    }
    return { key: keyName, value };
  } catch (error) {
    console.error('Error updating setting:', error.stack);
    throw error;
  }
}
// Updated Users functions with audit logging
export async function getUserByUsername(username) {
  try {
    const result = await pool.query('SELECT id, first_name, last_name, username, email, password, role FROM users WHERE username = $1 AND deleted_at IS NULL', [username]);
    return result.rows[0];
  } catch (error) {
    console.error('Error fetching user:', error.stack);
    throw error;
  }
}
export async function getUsers() {
  try {
    const result = await pool.query('SELECT id, first_name, last_name, username, email, role, created_at FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC');
    return result.rows;
  } catch (error) {
    console.error('Error fetching users:', error.stack);
    throw error;
  }
}
// New function to get approvers
export async function getApprovers() {
  try {
    const result = await pool.query(`
      SELECT id, first_name, last_name
      FROM users
      WHERE role = 'approver' AND deleted_at IS NULL
      ORDER BY last_name ASC, first_name ASC
    `);
    return result.rows.map(row => ({
      id: row.id,
      fullName: `${row.first_name} ${row.last_name}`.trim()
    }));
  } catch (error) {
    console.error('Error fetching approvers:', error.stack);
    throw error;
  }
}
export async function createUser(firstName, lastName, email, role, userId, ip) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const username = await generateUniqueUsername(lastName);
    const plainPassword = generatePassword();
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    const result = await client.query(
      'INSERT INTO users (first_name, last_name, username, email, password, role, created_at, deleted_at) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, NULL) RETURNING *',
      [firstName.trim(), lastName.trim(), username, email.trim().toLowerCase(), hashedPassword, role]
    );
    // Log audit
    await insertAuditLog(client, userId, 'create_user', ip, { username, role });
    // Send email (import and call from emailService)
    const { sendUserCredentials } = await import('./emailService.js');
    await sendUserCredentials(email, username, plainPassword);
    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating user:', error.stack);
    if (error.code === '23505') {
      throw new Error('Email already exists');
    }
    throw error;
  } finally {
    client.release();
  }
}
export async function resetUserPassword(userId, currentUserId, ip) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const userResult = await client.query('SELECT email, username FROM users WHERE id = $1 AND deleted_at IS NULL', [userId]);
    if (userResult.rowCount === 0) throw new Error('User not found');
    const { email, username } = userResult.rows[0];
    const plainPassword = generatePassword();
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    await client.query(
      'UPDATE users SET password = $1 WHERE id = $2 RETURNING *',
      [hashedPassword, userId]
    );
    // Log audit
    await insertAuditLog(client, currentUserId, 'reset_password', ip, { user_id: userId, username });
    // Send reset email
    const { sendResetPassword } = await import('./emailService.js');
    await sendResetPassword(email, username, plainPassword);
    await client.query('COMMIT');
    return { message: 'Password reset and email sent' };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error resetting password:', error.stack);
    throw error;
  } finally {
    client.release();
  }
}
export async function updateUserRole(userId, role, currentUserId, ip) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const current = await client.query('SELECT role AS old_role, username FROM users WHERE id = $1 AND deleted_at IS NULL', [userId]);
    if (current.rowCount === 0) throw new Error('User not found');
    const old_role = current.rows[0].old_role;
    const username = current.rows[0].username;
    const result = await client.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING *',
      [role, userId]
    );
    if (result.rowCount === 0) throw new Error('User not found');
    // Log audit
    await insertAuditLog(client, currentUserId, 'update_user_role', ip, { user_id: userId, username, old_role, new_role: role });
    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating user role:', error.stack);
    throw error;
  } finally {
    client.release();
  }
}
// Update user details (name, email, role)
export async function updateUser(userId, updates, currentUserId, ip) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { first_name, last_name, email, role } = updates;
   
    // Validate role
    if (!['requester', 'approver', 'issuer', 'superadmin'].includes(role)) {
      throw new Error('Invalid role');
    }
   
    // Check if email already exists (excluding current user)
    if (email) {
      const emailCheck = await client.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2 AND deleted_at IS NULL',
        [email.trim().toLowerCase(), userId]
      );
      if (emailCheck.rowCount > 0) {
        throw new Error('Email already exists');
      }
    }
   
    const current = await client.query(
      'SELECT first_name AS old_first_name, last_name AS old_last_name, email AS old_email, role AS old_role, username FROM users WHERE id = $1 AND deleted_at IS NULL',
      [userId]
    );
    if (current.rowCount === 0) throw new Error('User not found');
    const old_values = current.rows[0];
    delete old_values.username; // No need to include username in old_values
   
    const result = await client.query(
      'UPDATE users SET first_name = $1, last_name = $2, email = $3, role = $4 WHERE id = $5 RETURNING *',
      [first_name?.trim(), last_name?.trim(), email?.trim().toLowerCase(), role, userId]
    );
   
    if (result.rowCount === 0) throw new Error('User not found');
   
    // Log audit
    await insertAuditLog(client, currentUserId, 'update_user', ip, { user_id: userId, username: old_values.username, old_values, new_values: { first_name, last_name, email, role } });
   
    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating user:', error.stack);
    throw error;
  } finally {
    client.release();
  }
}
// Delete user
export async function deleteUser(userId, currentUserId, ip) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
   
    // Prevent self-deletion
    if (userId === currentUserId) {
      throw new Error('Cannot delete your own account');
    }
   
    const userResult = await client.query('SELECT first_name, last_name, username, email FROM users WHERE id = $1 AND deleted_at IS NULL', [userId]);
    if (userResult.rowCount === 0) throw new Error('User not found');
    const deletedUser = userResult.rows[0];
   
    await client.query('UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [userId]);
   
    // Log audit
    await insertAuditLog(client, currentUserId, 'delete_user', ip, { user_id: userId, deleted_user });
   
    await client.query('COMMIT');
    return { message: 'User deleted successfully' };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting user:', error.stack);
    throw error;
  } finally {
    client.release();
  }
}
// Supervisors functions remain the same...
export async function getSupervisors() {
  try {
    const result = await pool.query('SELECT * FROM supervisors WHERE deleted_at IS NULL ORDER BY name ASC');
    return result.rows;
  } catch (error) {
    console.error('Error fetching supervisors:', error.stack);
    throw error;
  }
}
export async function addSupervisor(supervisorData) {
  try {
    const { name, email } = supervisorData;
    if (!name || !email) {
      throw new Error('Name and email are required');
    }
    const result = await pool.query(
      'INSERT INTO supervisors (name, email, created_at, deleted_at) VALUES ($1, $2, CURRENT_TIMESTAMP, NULL) RETURNING *',
      [name.trim(), email.trim().toLowerCase()]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error adding supervisor:', error.stack);
    if (error.code === '23505') { // Unique violation
      throw new Error('Email already exists');
    }
    throw error;
  }
}
export async function updateSupervisor(supervisorId, supervisorData) {
  try {
    const { name, email } = supervisorData;
    if (!name || !email) {
      throw new Error('Name and email are required');
    }
    const result = await pool.query(
      'UPDATE supervisors SET name = $1, email = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND deleted_at IS NULL RETURNING *',
      [name.trim(), email.trim().toLowerCase(), supervisorId]
    );
    if (result.rowCount === 0) throw new Error('Supervisor not found');
    return result.rows[0];
  } catch (error) {
    console.error('Error updating supervisor:', error.stack);
    if (error.code === '23505') { // Unique violation
      throw new Error('Email already exists');
    }
    throw error;
  }
}
export async function deleteSupervisor(supervisorId) {
  try {
    const result = await pool.query('UPDATE supervisors SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND deleted_at IS NULL RETURNING *', [supervisorId]);
    if (result.rowCount === 0) throw new Error('Supervisor not found');
    return { message: 'Supervisor deleted' };
  } catch (error) {
    console.error('Error deleting supervisor:', error.stack);
    throw error;
  }
}
// Updated Audit Logs to include full name
export async function insertAuditLog(clientOrPool, userId, action, ip, details = null) {
  let client = pool;
  let uid = userId;
  let act = action;
  let iip = ip;
  let det = details;
  if (clientOrPool === null || clientOrPool === undefined) {
    // no client provided, use pool
  } else if (clientOrPool && typeof clientOrPool === 'object' && typeof clientOrPool.query === 'function') {
    client = clientOrPool;
  } else {
    // first arg is actually userId, shift the arguments
    det = iip;
    iip = act;
    act = uid;
    uid = clientOrPool;
  }
  try {
    await client.query(
      'INSERT INTO audit_logs (user_id, action, ip_address, details, timestamp) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)',
      [uid, act, iip, det ? JSON.stringify(det) : null]
    );
  } catch (error) {
    console.error('Error inserting audit log:', error.stack);
    throw error;
  }
}
export async function getAuditLogs() {
  try {
    const result = await pool.query(`
      SELECT al.*, u.first_name, u.last_name, u.username
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ORDER BY al.timestamp DESC
    `);
    return result.rows.map(row => ({
      ...row,
      full_name: `${row.first_name} ${row.last_name}`.trim()
    }));
  } catch (error) {
    console.error('Error fetching audit logs:', error.stack);
    throw error;
  }
}
// Categories functions with audit logging and hierarchy support
export async function getCategories() {
  try {
    const allCategories = await pool.query('SELECT * FROM categories WHERE deleted_at IS NULL ORDER BY name ASC');
    const itemsResult = await pool.query('SELECT category_id, COUNT(*) as count FROM items WHERE category_id IS NOT NULL AND deleted_at IS NULL GROUP BY category_id');
    const categoryCounts = {};
    itemsResult.rows.forEach(item => {
      categoryCounts[item.category_id] = parseInt(item.count, 10);
    });
    // Build hierarchy
    const categoryMap = {};
    const roots = [];
    allCategories.rows.forEach(cat => {
      cat.subcategories = [];
      cat.itemCount = categoryCounts[cat.id] || 0;
      categoryMap[cat.id] = cat;
      if (!cat.parent_id) {
        roots.push(cat);
      } else {
        if (categoryMap[cat.parent_id]) {
          categoryMap[cat.parent_id].subcategories.push(cat);
        }
      }
    });
    // Aggregate totalItems for main categories
    roots.forEach(root => {
      root.totalItems = root.subcategories.reduce((sum, sub) => sum + (sub.itemCount || 0), 0);
    });
    return roots;
  } catch (error) {
    console.error('Error fetching categories:', error.stack);
    throw error;
  }
}
export async function addCategory(categoryData, userId, ip) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { name, description, subcategories = [] } = categoryData;
    const mainResult = await client.query(
      'INSERT INTO categories (name, description, parent_id, created_at, deleted_at) VALUES ($1, $2, NULL, CURRENT_TIMESTAMP, NULL) RETURNING *',
      [name, description || null]
    );
    const mainId = mainResult.rows[0].id;
    for (const sub of subcategories) {
      await client.query(
        'INSERT INTO categories (name, description, parent_id, created_at, deleted_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, NULL)',
        [sub.name, sub.description || null, mainId]
      );
    }
    // Log audit
    await insertAuditLog(client, userId, 'create_category', ip, { category_name: name, sub_count: subcategories.length });
    await client.query('COMMIT');
    return mainResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error adding category:', error.stack);
    throw error;
  } finally {
    client.release();
  }
}
export async function updateCategory(categoryId, categoryData, userId, ip) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { name, description, subcategories = [] } = categoryData;
    const current = await client.query('SELECT name FROM categories WHERE id = $1 AND parent_id IS NULL AND deleted_at IS NULL', [categoryId]);
    if (current.rowCount === 0) throw new Error('Main category not found');
    await client.query(
      'UPDATE categories SET name = $1, description = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND deleted_at IS NULL',
      [name, description || null, categoryId]
    );
    // Fetch existing subs
    const existingSubs = await client.query('SELECT id FROM categories WHERE parent_id = $1 AND deleted_at IS NULL', [categoryId]);
    const existingIds = existingSubs.rows.map(r => r.id);
    const providedIds = subcategories.filter(s => s.id).map(s => parseInt(s.id));
    // Delete removed
    const toDelete = existingIds.filter(id => !providedIds.includes(id));
    for (const delId of toDelete) {
      await client.query('UPDATE categories SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [delId]);
    }
    // Update or create
    for (const sub of subcategories) {
      if (sub.id) {
        await client.query(
          'UPDATE categories SET name = $1, description = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND deleted_at IS NULL',
          [sub.name, sub.description || null, sub.id]
        );
      } else {
        await client.query(
          'INSERT INTO categories (name, description, parent_id, created_at, deleted_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, NULL)',
          [sub.name, sub.description || null, categoryId]
        );
      }
    }
    // Log audit
    await insertAuditLog(client, userId, 'update_category', ip, { category_id: categoryId, category_name: name, sub_count: subcategories.length });
    await client.query('COMMIT');
    return { id: categoryId, name, description };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating category:', error.stack);
    throw error;
  } finally {
    client.release();
  }
}
export async function deleteCategory(categoryId, userId, ip) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const current = await client.query('SELECT name FROM categories WHERE id = $1 AND deleted_at IS NULL', [categoryId]);
    if (current.rowCount === 0) throw new Error('Category not found');
    await client.query('UPDATE categories SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *', [categoryId]);
    // Log audit
    await insertAuditLog(client, userId, 'delete_category', ip, { category_id: categoryId, category_name: current.rows[0]?.name });
    await client.query('COMMIT');
    return { message: 'Category deleted' };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting category:', error.stack);
    throw error;
  } finally {
    client.release();
  }
}
// Items functions with audit logging
export async function getItems() {
  try {
    const result = await pool.query(`
      SELECT i.*, c.name AS category_name, COALESCE(v.name, i.vendor_name) AS vendor_name
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN vendors v ON i.vendor_id = v.id
      WHERE i.deleted_at IS NULL
      ORDER BY i.created_at DESC
    `);
    return result.rows;
  } catch (error) {
    console.error('Error fetching items:', error.stack);
    throw error;
  }
}
export async function addItem(itemData, userId, ip) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { name, description, category_id, quantity, low_stock_threshold, vendor_id, vendor_name, unit_price, receipt_images, serial_numbers } = itemData;
   
    const parsedQuantity = parseInt(quantity, 10);
    let parsedLowStockThreshold = low_stock_threshold ? parseInt(low_stock_threshold, 10) : 5;
    if (isNaN(parsedLowStockThreshold) || parsedLowStockThreshold < 0) {
      parsedLowStockThreshold = 5;
    }
    const parsedUnitPrice = unit_price ? parseFloat(unit_price) : null;
    const parsedCategoryId = category_id ? parseInt(category_id, 10) : null;
    const parsedVendorId = vendor_id ? parseInt(vendor_id, 10) : null;
    if (isNaN(parsedQuantity) || parsedQuantity < 0) {
      throw new Error('Quantity is required and must be non-negative');
    }
    if (unit_price && (isNaN(parsedUnitPrice) || parsedUnitPrice < 0)) {
      throw new Error('Unit price must be non-negative if provided');
    }
    const result = await client.query(
      'INSERT INTO items (name, description, category_id, vendor_id, quantity, low_stock_threshold, vendor_name, unit_price, receipt_images, created_at, updated_at, deleted_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, NULL, NULL) RETURNING *',
      [name, description || null, parsedCategoryId, parsedVendorId, parsedQuantity, parsedLowStockThreshold, vendor_name || null, parsedUnitPrice, receipt_images || JSON.stringify([])]
    );
    const itemId = result.rows[0].id;
    // Insert serial numbers if provided
    if (Array.isArray(serial_numbers) && serial_numbers.length > 0) {
      for (const sn of serial_numbers) {
        await client.query(
          'INSERT INTO item_serial_numbers (item_id, serial_number, status) VALUES ($1, $2, $3)',
          [itemId, sn.trim(), 'in_stock']
        );
      }
    }
    // Log audit
    await insertAuditLog(client, userId, 'create_item', ip, { item_name: name, serial_count: Array.isArray(serial_numbers) ? serial_numbers.length : 0 });
    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error adding item:', error.stack);
    throw error;
  } finally {
    client.release();
  }
}
// Items update with low stock check and audit logging
export async function updateItem(itemId, itemData, userId, ip) {
  const client = await pool.connect();
  let prevQuantity = 0;
  try {
    await client.query('BEGIN');
   
    // Fetch previous quantity and threshold
    const currentResult = await client.query('SELECT quantity, low_stock_threshold, name AS item_name FROM items WHERE id = $1 AND deleted_at IS NULL FOR UPDATE', [itemId]);
    if (currentResult.rowCount === 0) throw new Error('Item not found or deleted');
    prevQuantity = parseInt(currentResult.rows[0].quantity, 10);
    const threshold = currentResult.rows[0].low_stock_threshold || 5;
    const item_name = currentResult.rows[0].item_name;
    const { name, description, category_id, quantity, low_stock_threshold, vendor_id, vendor_name, unit_price, update_reason, receipt_images: providedReceiptImages, serial_numbers } = itemData;
   
    if (!update_reason || !update_reason.trim()) {
      throw new Error('Update reason is required');
    }
    // Get current data for update_reasons and receipt_images
    const itemCurrentResult = await client.query('SELECT update_reasons, receipt_images FROM items WHERE id = $1', [itemId]);
    let currentReasons = itemCurrentResult.rows[0].update_reasons || '';
    let currentReceiptImages;
    const receiptImagesValue = itemCurrentResult.rows[0].receipt_images;
    if (receiptImagesValue && typeof receiptImagesValue === 'string' && receiptImagesValue.trim() !== '') {
      try {
        currentReceiptImages = JSON.parse(receiptImagesValue);
      } catch (parseError) {
        console.warn('Failed to parse existing receipt_images, defaulting to empty array:', parseError.message);
        currentReceiptImages = [];
      }
    } else {
      currentReceiptImages = [];
    }
    const timestamp = new Date().toLocaleString();
    const newReasonEntry = `${update_reason} at ${timestamp}`;
    const newReasons = currentReasons ? `${currentReasons} | ${newReasonEntry}` : newReasonEntry;
    // Handle new receipt if provided
    let newReceiptImagesArray = [...currentReceiptImages];
    if (providedReceiptImages) {
      try {
        const parsedProvided = JSON.parse(providedReceiptImages);
        const newPaths = parsedProvided.filter(path => !currentReceiptImages.some(img => img.path === path));
        newPaths.forEach(newPath => {
          const newReceiptObj = {
            path: newPath,
            uploaded_at: new Date().toISOString()
          };
          newReceiptImagesArray.push(newReceiptObj);
        });
      } catch (e) {
        if (!currentReceiptImages.some(img => img.path === providedReceiptImages)) {
          const newReceiptObj = {
            path: providedReceiptImages,
            uploaded_at: new Date().toISOString()
          };
          newReceiptImagesArray.push(newReceiptObj);
        }
      }
    }
    const parsedQuantity = parseInt(quantity, 10);
    let parsedLowStockThreshold = low_stock_threshold ? parseInt(low_stock_threshold, 10) : null;
    const parsedUnitPrice = unit_price !== undefined ? (unit_price ? parseFloat(unit_price) : null) : null;
    const parsedCategoryId = category_id ? parseInt(category_id, 10) : null;
    const parsedVendorId = vendor_id ? parseInt(vendor_id, 10) : null;
    if (isNaN(parsedQuantity) || parsedQuantity < 0) {
      throw new Error('Quantity must be non-negative');
    }
    if (parsedLowStockThreshold !== null && (isNaN(parsedLowStockThreshold) || parsedLowStockThreshold < 0)) {
      throw new Error('Low stock threshold must be non-negative if provided');
    }
    if (parsedUnitPrice !== null && (isNaN(parsedUnitPrice) || parsedUnitPrice < 0)) {
      throw new Error('Unit price must be non-negative if provided');
    }
    const result = await client.query(
      'UPDATE items SET name = $1, description = $2, category_id = $3, vendor_id = $4, quantity = $5, low_stock_threshold = COALESCE($6, low_stock_threshold), vendor_name = $7, unit_price = $8, receipt_images = $9, update_reasons = $10, updated_at = CURRENT_TIMESTAMP WHERE id = $11 AND deleted_at IS NULL RETURNING *',
      [name, description || null, parsedCategoryId, parsedVendorId, parsedQuantity, parsedLowStockThreshold, vendor_name || null, parsedUnitPrice, JSON.stringify(newReceiptImagesArray), newReasons, itemId]
    );
    if (result.rowCount === 0) throw new Error('Item not found or deleted');
    // Handle serial numbers update
    if (Array.isArray(serial_numbers)) {
      // Delete all existing serials and re-insert
      await client.query('DELETE FROM item_serial_numbers WHERE item_id = $1', [itemId]);
      for (const sn of serial_numbers) {
        await client.query(
          'INSERT INTO item_serial_numbers (item_id, serial_number, status) VALUES ($1, $2, $3) ON CONFLICT (serial_number) DO NOTHING',
          [itemId, sn.trim(), 'in_stock']
        );
      }
    }
    // Prepare audit details
    let auditDetails = { item_id: itemId, item_name, reason: update_reason };
    if (parsedQuantity !== prevQuantity) {
      auditDetails.old_quantity = prevQuantity;
      auditDetails.new_quantity = parsedQuantity;
    }
    // Log audit
    await insertAuditLog(client, userId, 'update_item', ip, auditDetails);
    await client.query('COMMIT');
    const updatedItem = result.rows[0];
    const fullItem = await client.query(`
      SELECT i.*, c.name AS category_name, COALESCE(v.name, i.vendor_name) AS vendor_name
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN vendors v ON i.vendor_id = v.id
      WHERE i.id = $1
    `, [itemId]);
    return fullItem.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating item:', error.stack);
    throw error;
  } finally {
    client.release();
  }
}
export async function deleteItem(itemId, userId, ip) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const itemResult = await client.query('SELECT name, quantity FROM items WHERE id = $1 AND deleted_at IS NULL', [itemId]);
    if (itemResult.rowCount === 0) throw new Error('Item not found or already deleted');
    const item_name = itemResult.rows[0].name;
    const deleted_quantity = itemResult.rows[0].quantity;
    const result = await client.query('UPDATE items SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND deleted_at IS NULL RETURNING *', [itemId]);
    if (result.rowCount === 0) throw new Error('Item not found or already deleted');
   
    // Log audit
    await insertAuditLog(client, userId, 'delete_item', ip, { item_id: itemId, item_name, deleted_quantity });
    await client.query('COMMIT');
    return { message: 'Item deleted' };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting item:', error.stack);
    throw error;
  } finally {
    client.release();
  }
}
// New: Get serial numbers for an item
export async function getSerialNumbersForItem(itemId) {
  try {
    const result = await pool.query(`
      SELECT isn.*, i.name AS item_name
      FROM item_serial_numbers isn
      JOIN items i ON isn.item_id = i.id
      WHERE isn.item_id = $1
      ORDER BY isn.created_at DESC
    `, [itemId]);
    return result.rows;
  } catch (error) {
    console.error('Error fetching serial numbers:', error.stack);
    throw error;
  }
}
// Items Out functions with audit logging
export async function getItemsOut() {
  try {
    const result = await pool.query(`
      SELECT io.*, COALESCE(i.name, 'Unknown Item') AS item_name, COALESCE(c.name, 'Unknown Category') AS category_name
      FROM items_out io
      LEFT JOIN items i ON io.item_id = i.id
      LEFT JOIN categories c ON i.category_id = c.id
      ORDER BY io.date_time DESC
    `);
    return result.rows.map(row => ({
      id: row.id,
      person_name: row.person_name,
      item_id: row.item_id,
      quantity: row.quantity,
      date_time: row.date_time,
      item_name: row.item_name,
      category_name: row.category_name,
    }));
  } catch (error) {
    console.error('Error fetching items out:', error.stack);
    throw error;
  }
}
export async function issueItem(issueData, userId, ip) {
  const client = await pool.connect();
  let prevQuantity = 0;
  let threshold = 5;
  let itemDetails = null;
  try {
    await client.query('BEGIN');
    console.log('Issuing item with data:', issueData);
    const { personName, itemId, quantity: issueQuantity, serial_numbers } = issueData;
    if (!personName || !itemId || !issueQuantity) {
      throw new Error('Missing required fields: personName, itemId, and quantity are required');
    }
    const parsedIssueQuantity = parseInt(issueQuantity, 10);
    if (parsedIssueQuantity <= 0) {
      throw new Error('Quantity must be positive');
    }
    const itemCheck = await client.query(
      'SELECT quantity, low_stock_threshold, name FROM items WHERE id = $1 AND deleted_at IS NULL FOR UPDATE',
      [itemId]
    );
    if (itemCheck.rowCount === 0) throw new Error('Item not found or deleted');
    prevQuantity = parseInt(itemCheck.rows[0].quantity, 10);
    threshold = itemCheck.rows[0].low_stock_threshold || 5;
    const availableQuantity = prevQuantity;
    if (parsedIssueQuantity > availableQuantity) {
      throw new Error(`Insufficient stock. Only ${availableQuantity} units available. Requested: ${parsedIssueQuantity}`);
    }
    // Validate serial numbers if provided
    if (Array.isArray(serial_numbers) && serial_numbers.length > 0) {
      if (serial_numbers.length !== parsedIssueQuantity) {
        throw new Error('Number of serial numbers must match issued quantity');
      }
      for (const sn of serial_numbers) {
        const snCheck = await client.query(
          'SELECT id, status FROM item_serial_numbers WHERE item_id = $1 AND serial_number = $2 FOR UPDATE',
          [itemId, sn]
        );
        if (snCheck.rowCount === 0) throw new Error(`Serial number ${sn} not found for this item`);
        if (snCheck.rows[0].status !== 'in_stock') throw new Error(`Serial number ${sn} is already issued or not available`);
      }
    }
    const result = await client.query(
      'INSERT INTO items_out (person_name, item_id, quantity, date_time) VALUES ($1, $2, $3, CURRENT_TIMESTAMP) RETURNING *',
      [personName, itemId, parsedIssueQuantity]
    );
    await client.query(
      'UPDATE items SET quantity = quantity - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [parsedIssueQuantity, itemId]
    );
    // Update serial numbers status
    if (Array.isArray(serial_numbers) && serial_numbers.length > 0) {
      for (const sn of serial_numbers) {
        await client.query(
          'UPDATE item_serial_numbers SET status = $1, issued_to = $2, issued_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE item_id = $3 AND serial_number = $4',
          ['issued', personName, itemId, sn]
        );
      }
    }
    // Fetch updated item details for alert
    const updatedItemResult = await client.query('SELECT i.*, c.name AS category_name, COALESCE(v.name, i.vendor_name) AS vendor_name FROM items i LEFT JOIN categories c ON i.category_id = c.id LEFT JOIN vendors v ON i.vendor_id = v.id WHERE i.id = $1', [itemId]);
    itemDetails = updatedItemResult.rows[0];
    // Log audit
    await insertAuditLog(client, userId, 'issue_item', ip, { item_id: itemId, item_name: itemCheck.rows[0].name, quantity: parsedIssueQuantity, person_name: personName, serial_numbers });
    await client.query('COMMIT');
    return { ...result.rows[0], item: itemDetails };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in issueItem transaction:', error.stack);
    throw error;
  } finally {
    client.release();
  }
}
// Low Stock and Dashboard Stats remain the same...
export async function getLowStockItems() {
  try {
    const result = await pool.query(`
      SELECT i.*, c.name AS category_name, COALESCE(v.name, i.vendor_name) AS vendor_name
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN vendors v ON i.vendor_id = v.id
      WHERE i.quantity <= COALESCE(i.low_stock_threshold, 5) AND i.deleted_at IS NULL
      ORDER BY i.created_at DESC
    `);
    return result.rows;
  } catch (error) {
    console.error('Error fetching low stock items:', error.stack);
    throw error;
  }
}
export async function getDashboardStats() {
  try {
    const [itemsResult, categoriesResult, itemsOutResult, lowStockResult, requestsResult] = await Promise.all([
      pool.query('SELECT COUNT(*) AS count FROM items WHERE deleted_at IS NULL'),
      pool.query('SELECT COUNT(*) AS count FROM categories WHERE deleted_at IS NULL'),
      pool.query('SELECT COUNT(*) AS count FROM items_out'),
      pool.query('SELECT COUNT(*) AS count FROM items WHERE quantity <= COALESCE(low_stock_threshold, 5) AND deleted_at IS NULL'),
      pool.query('SELECT COUNT(*) AS count FROM requests WHERE status = $1 AND deleted_at IS NULL', ['pending']),
    ]);
    return {
      totalItems: parseInt(itemsResult.rows[0].count, 10),
      totalCategories: parseInt(categoriesResult.rows[0].count, 10),
      itemsOut: parseInt(itemsOutResult.rows[0].count, 10),
      lowStockItems: parseInt(lowStockResult.rows[0].count, 10),
      pendingRequests: parseInt(requestsResult.rows[0].count, 10),
    };
  } catch (error) {
    console.error('Error fetching dashboard stats:', error.stack);
    throw error;
  }
}
// Updated createRequest to handle array of selectedApproverIds via junction table
export async function createRequest(requestData, selectedApproverIds, requestType = 'material_request', userId, ip) {
  if (!Array.isArray(selectedApproverIds) || selectedApproverIds.length === 0) {
    throw new Error('At least one approver ID is required');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let { createdBy, teamLeaderName, teamLeaderPhone, projectName, ispName, location, deployment, releaseBy, receivedBy, items, reason } = requestData;
   
    // Set defaults for return requests or missing fields
    const teamLeaderNameValue = teamLeaderName || createdBy || '';
    const teamLeaderPhoneValue = teamLeaderPhone || '';
    const ispNameValue = ispName || null;
    const deploymentValue = deployment || null;
    const releaseByValue = releaseBy || null;
    const receivedByValue = receivedBy || null;
   
    const requestResult = await client.query(
      'INSERT INTO requests (created_by, team_leader_name, team_leader_phone, project_name, isp_name, location, deployment_type, release_by, received_by, type, reason, status, created_at, deleted_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, NULL) RETURNING *',
      [createdBy, teamLeaderNameValue, teamLeaderPhoneValue, projectName, ispNameValue, location, deploymentValue, releaseByValue, receivedByValue, requestType, reason || null, 'pending']
    );
    const requestId = requestResult.rows[0].id;
    // Insert into junction table for each approver
    for (const approverId of selectedApproverIds) {
      await client.query(
        'INSERT INTO request_approvers (request_id, approver_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [requestId, approverId]
      );
    }
    for (const item of items) {
      const selectedItem = await client.query('SELECT id FROM items WHERE name = $1 AND deleted_at IS NULL', [item.name]);
      if (selectedItem.rowCount === 0) throw new Error(`Item not found: ${item.name}`);
      const quantityRequested = parseInt(item.requested) || 0;
      await client.query(
        'INSERT INTO request_items (request_id, item_id, quantity_requested, created_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)',
        [requestId, selectedItem.rows[0].id, quantityRequested]
      );
    }
    // Log audit
    await insertAuditLog(client, userId, 'create_request', ip, { request_id: requestId, selected_approver_ids: selectedApproverIds, type: requestType });
    await client.query('COMMIT');
    return requestResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating request:', error.stack);
    throw error;
  } finally {
    client.release();
  }
}
// Updated getRequests to aggregate approver_names from junction table
export async function getRequests(userRole, userId) {
  try {
    let query = `
      SELECT r.*, r.type, r.reason,
             (SELECT reason FROM rejections WHERE request_id = r.id ORDER BY created_at DESC LIMIT 1) AS reject_reason,
             COUNT(ri.id) AS item_count,
             COALESCE(
               (SELECT STRING_AGG(u.first_name || ' ' || u.last_name, ', ')
                FROM request_approvers ra
                JOIN users u ON ra.approver_id = u.id
                WHERE ra.request_id = r.id),
               'Unassigned'
             ) AS approver_names
      FROM requests r
      LEFT JOIN request_items ri ON r.id = ri.request_id
      WHERE r.deleted_at IS NULL
    `;
    let params = [];
    let whereClause = ' GROUP BY r.id, r.type, r.reason, reject_reason';
    let orderBy = ' ORDER BY r.created_at DESC';
    if (userRole === 'approver') {
      query += ` AND (r.status != 'pending' OR (r.status = 'pending' AND EXISTS (SELECT 1 FROM request_approvers ra WHERE ra.request_id = r.id AND ra.approver_id = $1)))`;
      params.push(userId);
    }
    query += whereClause + orderBy;
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Error fetching requests:', error.stack);
    throw error;
  }
}
export async function updateRequest(requestId, requestData, userId, ip) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { createdBy, teamLeaderName, teamLeaderPhone, projectName, ispName, location, deployment, items, reason } = requestData;
    // Update main request
    await client.query(
      'UPDATE requests SET team_leader_name = $1, team_leader_phone = $2, project_name = $3, isp_name = $4, location = $5, deployment_type = $6, reason = $7, updated_at = CURRENT_TIMESTAMP WHERE id = $8 AND deleted_at IS NULL',
      [teamLeaderName, teamLeaderPhone, projectName, ispName || null, location, deployment, reason || null, requestId]
    );
    // Delete old items and re-insert (simple approach; adjust if needed)
    await client.query('DELETE FROM request_items WHERE request_id = $1', [requestId]);
    for (const item of items) {
      const selectedItem = await client.query('SELECT id FROM items WHERE name = $1 AND deleted_at IS NULL', [item.name]);
      if (selectedItem.rowCount === 0) throw new Error(`Item not found: ${item.name}`);
      await client.query(
        'INSERT INTO request_items (request_id, item_id, quantity_requested, created_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)',
        [requestId, selectedItem.rows[0].id, item.requested]
      );
    }
    // Log audit
    await insertAuditLog(client, userId, 'update_request', ip, { request_id: requestId });
    await client.query('COMMIT');
    return { message: 'Request updated' };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating request:', error.stack);
    throw error;
  } finally {
    client.release();
  }
}
export async function rejectRequest(requestId, userId, ip, rejectData) {
  const { rejectorName, reason } = rejectData || {};
  if (!reason || !reason.trim()) {
    throw new Error('Rejection reason is required');
  }
  if (!rejectorName || !rejectorName.trim()) {
    throw new Error('Rejector name is required');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      'UPDATE requests SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND status IN ($3, $4) AND deleted_at IS NULL RETURNING *',
      ['rejected', requestId, 'pending', 'approved']
    );
    if (result.rowCount === 0) throw new Error('Request not found or not rejectable (must be pending or approved)');
    await client.query(
      'INSERT INTO rejections (request_id, rejector_name, reason, created_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)',
      [requestId, rejectorName, reason]
    );
    // Log audit
    await insertAuditLog(client, userId, 'reject_request', ip, { request_id: requestId, reason });
    await client.query('COMMIT');
    return { message: 'Request rejected' };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error rejecting request:', error.stack);
    throw error;
  } finally {
    client.release();
  }
}
export async function approveRequest(requestId, approverData, userId, ip) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { approverName, signature } = approverData;
    await client.query(
      'INSERT INTO approvals (request_id, approver_name, signature, created_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)',
      [requestId, approverName, signature]
    );
    const approvalCount = await client.query(
      'SELECT COUNT(*) AS count FROM approvals WHERE request_id = $1',
      [requestId]
    );
    if (parseInt(approvalCount.rows[0].count, 10) >= 1) { // Single initial approval (for multi, could adjust to require all)
      await client.query(
        'UPDATE requests SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['approved', requestId]
      );
    }
    // Log audit
    await insertAuditLog(client, userId, 'approve_request', ip, { request_id: requestId, approver_name: approverName });
    await client.query('COMMIT');
    return { message: 'Approval recorded' };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error approving request:', error.stack);
    throw error;
  } finally {
    client.release();
  }
}
// Updated finalizeRequest to handle returns (add to stock) vs requests (deduct from stock)
export async function finalizeRequest(requestId, items, releasedBy, userId, ip) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const request = await client.query(
      'SELECT status, type FROM requests WHERE id = $1 AND deleted_at IS NULL',
      [requestId]
    );
    if (request.rowCount === 0) throw new Error('Request not found');
    if (request.rows[0].status !== 'approved') throw new Error('Request is not approved');
    const reqType = request.rows[0].type;
    for (const item of items) {
      const { itemId, quantityReceived, quantityReturned, serial_number } = item;
      const itemCheck = await client.query(
        'SELECT quantity FROM items WHERE id = $1 AND deleted_at IS NULL FOR UPDATE',
        [itemId]
      );
      if (itemCheck.rowCount === 0) throw new Error('Item not found');
      const currentQuantity = parseInt(itemCheck.rows[0].quantity, 10);
      const quantityToAdjust = parseInt(quantityReceived) || 0;
      if (quantityToAdjust <= 0) continue; // Skip if no quantity
      if (reqType === 'material_request') {
        // For requests: deduct (check availability)
        if (quantityToAdjust > currentQuantity) {
          throw new Error(`Insufficient stock for item ID ${itemId}. Only ${currentQuantity} units available.`);
        }
        await client.query(
          'UPDATE items SET quantity = quantity - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [quantityToAdjust, itemId]
        );
      } else if (reqType === 'item_return') {
        // For returns: add back to stock (no availability check needed)
        await client.query(
          'UPDATE items SET quantity = quantity + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [quantityToAdjust, itemId]
        );
      }
      await client.query(
        'UPDATE request_items SET quantity_received = $1, quantity_returned = $2, serial_number = $3, updated_at = CURRENT_TIMESTAMP WHERE request_id = $4 AND item_id = $5',
        [quantityReceived || null, quantityReturned || null, serial_number || null, requestId, itemId]
      );
    }
    await client.query(
      'UPDATE requests SET status = $1, release_by = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      ['completed', releasedBy, requestId]
    );
    // Log audit
    await insertAuditLog(client, userId, 'finalize_request', ip, { request_id: requestId, released_by: releasedBy, type: reqType });
    await client.query('COMMIT');
    return { message: 'Request finalized' };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error finalizing request:', error.stack);
    throw error;
  } finally {
    client.release();
  }
}
// Updated getRequestDetails to include approvers array from junction
export async function getRequestDetails(requestId) {
  try {
    const request = await pool.query(
      'SELECT * FROM requests WHERE id = $1 AND deleted_at IS NULL',
      [requestId]
    );
    if (request.rowCount === 0) throw new Error('Request not found');
    const items = await pool.query(
      `SELECT ri.*, i.name AS item_name, i.quantity AS current_stock, ri.serial_number
       FROM request_items ri
       JOIN items i ON ri.item_id = i.id
       WHERE ri.request_id = $1
       ORDER BY ri.created_at DESC`,
      [requestId]
    );
    const approvals = await pool.query(
      'SELECT * FROM approvals WHERE request_id = $1 ORDER BY created_at DESC',
      [requestId]
    );
    const rejections = await pool.query(
      'SELECT * FROM rejections WHERE request_id = $1 ORDER BY created_at DESC',
      [requestId]
    );
    // New: Fetch approvers
    const approvers = await pool.query(`
      SELECT u.id, u.first_name, u.last_name, u.username, ra.assigned_at
      FROM request_approvers ra
      JOIN users u ON ra.approver_id = u.id
      WHERE ra.request_id = $1
      ORDER BY ra.assigned_at ASC
    `, [requestId]);
    return {
      ...request.rows[0],
      items: items.rows,
      approvals: approvals.rows,
      rejections: rejections.rows,
      approvers: approvers.rows.map(row => ({
        id: row.id,
        fullName: `${row.first_name} ${row.last_name}`.trim(),
        username: row.username,
        assigned_at: row.assigned_at
      }))
    };
  } catch (error) {
    console.error('Error fetching request details:', error.stack);
    throw error;
  }
}
// Export the pool for manual queries if needed
export default pool;
// Close the pool on application termination
process.on('SIGTERM', async () => {
  await pool.end();
  console.log('Database connection pool closed');
});
// Note on IP Address Logging: In your API routes (e.g., login, createRequest, etc.), extract the public IP like this:
// const ip = req.body.ip || req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || req.connection.remoteAddress || 'unknown';
// Then pass it to the DB functions, e.g., await createRequest(data, req.user.id, ip);
// For login: After successful auth, await insertAuditLog(null, userId, 'login', ip);
// This ensures audit logs capture the real public IP from the request.