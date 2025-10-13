import { Pool } from 'pg';
import { config } from 'dotenv';

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
  password: String(process.env.PG_PASSWORD || ''), // Ensure password is a string
});

// Categories
export async function getCategories() {
  try {
    const categoriesResult = await pool.query('SELECT * FROM categories');
    const itemsResult = await pool.query('SELECT category_id, COUNT(*) as count FROM items WHERE category_id IS NOT NULL GROUP BY category_id');
    
    const categoryCounts = {};
    itemsResult.rows.forEach(item => {
      categoryCounts[item.category_id] = parseInt(item.count, 10);
    });

    return categoriesResult.rows.map(category => ({
      ...category,
      itemCount: categoryCounts[category.id] || 0,
    }));
  } catch (error) {
    console.error('Error fetching categories:', error.stack);
    throw error;
  }
}

export async function addCategory(categoryData) {
  try {
    const { name, description } = categoryData;
    const result = await pool.query(
      'INSERT INTO categories (name, description) VALUES ($1, $2) RETURNING *',
      [name, description || null]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error adding category:', error.stack);
    throw error;
  }
}

export async function updateCategory(categoryId, categoryData) {
  try {
    const { name, description } = categoryData;
    const result = await pool.query(
      'UPDATE categories SET name = $1, description = $2 WHERE id = $3 RETURNING *',
      [name, description || null, categoryId]
    );
    if (result.rowCount === 0) throw new Error('Category not found');
    return result.rows[0];
  } catch (error) {
    console.error('Error updating category:', error.stack);
    throw error;
  }
}

export async function deleteCategory(categoryId) {
  try {
    const result = await pool.query('DELETE FROM categories WHERE id = $1 RETURNING *', [categoryId]);
    if (result.rowCount === 0) throw new Error('Category not found');
    return { message: 'Category deleted' };
  } catch (error) {
    console.error('Error deleting category:', error.stack);
    throw error;
  }
}

// Items
export async function getItems() {
  try {
    const result = await pool.query(`
      SELECT i.*, c.name AS category_name
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
    `);
    return result.rows;
  } catch (error) {
    console.error('Error fetching items:', error.stack);
    throw error;
  }
}

export async function addItem(itemData) {
  try {
    const { name, description, categoryId, quantity, lowStockThreshold } = itemData;
    const result = await pool.query(
      'INSERT INTO items (name, description, category_id, quantity, low_stock_threshold) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, description || null, categoryId || null, quantity, lowStockThreshold || null]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error adding item:', error.stack);
    throw error;
  }
}

export async function updateItem(itemId, itemData) {
  try {
    const { name, description, categoryId, quantity, lowStockThreshold } = itemData;
    const result = await pool.query(
      'UPDATE items SET name = $1, description = $2, category_id = $3, quantity = $4, low_stock_threshold = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6 RETURNING *',
      [name, description || null, categoryId || null, quantity, lowStockThreshold || null, itemId]
    );
    if (result.rowCount === 0) throw new Error('Item not found');
    return result.rows[0];
  } catch (error) {
    console.error('Error updating item:', error.stack);
    throw error;
  }
}

export async function deleteItem(itemId) {
  try {
    const result = await pool.query('DELETE FROM items WHERE id = $1 RETURNING *', [itemId]);
    if (result.rowCount === 0) throw new Error('Item not found');
    return { message: 'Item deleted' };
  } catch (error) {
    console.error('Error deleting item:', error.stack);
    throw error;
  }
}

// Items Out
export async function getItemsOut() {
  try {
    const result = await pool.query(`
      SELECT 
        io.*, 
        COALESCE(i.name, 'Unknown Item') AS item_name, 
        COALESCE(c.name, 'Unknown Category') AS category_name
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

export async function issueItem(issueData) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('Issuing item with data:', issueData); // Added logging
    const { personName, itemId, quantity } = issueData;

    if (!personName || !itemId || !quantity) {
      throw new Error('Missing required fields: personName, itemId, and quantity are required');
    }

    // Check available quantity with row lock
    const itemCheck = await client.query(
      'SELECT quantity FROM items WHERE id = $1 FOR UPDATE',
      [itemId]
    );
    if (itemCheck.rowCount === 0) throw new Error('Item not found');
    const availableQuantity = parseInt(itemCheck.rows[0].quantity, 10);
    if (quantity > availableQuantity || quantity <= 0) {
      throw new Error(`Insufficient stock. Only ${availableQuantity} units available. Requested: ${quantity}`);
    }

    // Insert into items_out
    const result = await client.query(
      'INSERT INTO items_out (person_name, item_id, quantity, date_time) VALUES ($1, $2, $3, CURRENT_TIMESTAMP) RETURNING *',
      [personName, itemId, quantity]
    );

    // Update items table to reduce quantity
    await client.query(
      'UPDATE items SET quantity = quantity - $1 WHERE id = $2',
      [quantity, itemId]
    );

    await client.query('COMMIT');
    return result.rows[0]; // Return the inserted row
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in issueItem transaction:', error.stack);
    throw error; // Re-throw to be handled by the caller
  } finally {
    client.release();
  }
}

// Low Stock and Dashboard Stats
export async function getLowStockItems() {
  try {
    const result = await pool.query(`
      SELECT i.*, c.name AS category_name
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      WHERE i.quantity <= COALESCE(i.low_stock_threshold, 0)
    `);
    return result.rows;
  } catch (error) {
    console.error('Error fetching low stock items:', error.stack);
    throw error;
  }
}

export async function getDashboardStats() {
  try {
    const [itemsResult, categoriesResult, itemsOutResult, lowStockResult] = await Promise.all([
      pool.query('SELECT COUNT(*) AS count FROM items'),
      pool.query('SELECT COUNT(*) AS count FROM categories'),
      pool.query('SELECT COUNT(*) AS count FROM items_out'),
      pool.query('SELECT COUNT(*) AS count FROM items WHERE quantity <= COALESCE(low_stock_threshold, 0)'),
    ]);

    return {
      totalItems: parseInt(itemsResult.rows[0].count, 10),
      totalCategories: parseInt(categoriesResult.rows[0].count, 10),
      itemsOut: parseInt(itemsOutResult.rows[0].count, 10),
      lowStockItems: parseInt(lowStockResult.rows[0].count, 10),
    };
  } catch (error) {
    console.error('Error fetching dashboard stats:', error.stack);
    throw error;
  }
}

// Requests
export async function createRequest(requestData) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { teamLeaderPhone, projectName, ispName, location, deployment, releaseBy, receivedBy, items, approvedBy1, approvedBy2 } = requestData;

    const [requestResult] = await client.query(
      'INSERT INTO requests (team_leader_phone, project_name, isp_name, location, deployment_type, release_by, received_by) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [teamLeaderPhone, projectName, ispName, location, deployment, releaseBy, receivedBy]
    );
    const requestId = requestResult.rows[0].id;

    for (const item of items) {
      const selectedItem = await client.query('SELECT id, quantity FROM items WHERE name = $1 FOR UPDATE', [item.name]);
      if (selectedItem.rowCount === 0) throw new Error('Item not found');
      const availableQuantity = parseInt(selectedItem.rows[0].quantity, 10);
      const quantityRequested = parseInt(item.requested) || 0;
      if (quantityRequested > availableQuantity) {
        throw new Error(`Insufficient stock for ${item.name}. Only ${availableQuantity} units available.`);
      }
      await client.query(
        'INSERT INTO request_items (request_id, item_id, quantity_requested, quantity_received, quantity_returned) VALUES ($1, $2, $3, $4, $5)',
        [requestId, selectedItem.rows[0].id, quantityRequested, parseInt(item.received) || null, parseInt(item.returned) || null]
      );
      await client.query('UPDATE items SET quantity = quantity - $1 WHERE id = $2', [quantityRequested, selectedItem.rows[0].id]);
    }

    if (approvedBy1) {
      await client.query(
        'INSERT INTO approvals (request_id, approver_name, signature) VALUES ($1, $2, $3)',
        [requestId, teamLeaderPhone, approvedBy1]
      );
    }
    if (approvedBy2) {
      await client.query(
        'INSERT INTO approvals (request_id, approver_name, signature) VALUES ($1, $2, $3)',
        [requestId, teamLeaderPhone, approvedBy2]
      );
    }

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

export async function getRequests() {
  try {
    const result = await pool.query(`
      SELECT r.*, COUNT(ri.id) AS item_count
      FROM requests r
      LEFT JOIN request_items ri ON r.id = ri.request_id
      GROUP BY r.id
      ORDER BY r.created_at DESC
    `);
    return result.rows;
  } catch (error) {
    console.error('Error fetching requests:', error.stack);
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