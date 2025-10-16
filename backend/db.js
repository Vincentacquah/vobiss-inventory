import { Pool } from 'pg';
import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';

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

// Categories
export async function getCategories() {
  try {
    const categoriesResult = await pool.query('SELECT * FROM categories ORDER BY created_at DESC');
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
      'INSERT INTO categories (name, description, created_at) VALUES ($1, $2, CURRENT_TIMESTAMP) RETURNING *',
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
      'UPDATE categories SET name = $1, description = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
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
      ORDER BY i.created_at DESC
    `);
    return result.rows;
  } catch (error) {
    console.error('Error fetching items:', error.stack);
    throw error;
  }
}

export async function addItem(itemData) {
  try {
    const { name, description, category_id, quantity, low_stock_threshold, vendor_name, unit_price, receipt_images } = itemData;
    
    const parsedQuantity = parseInt(quantity, 10);
    let parsedLowStockThreshold = low_stock_threshold ? parseInt(low_stock_threshold, 10) : 5;
    if (isNaN(parsedLowStockThreshold) || parsedLowStockThreshold < 0) {
      parsedLowStockThreshold = 5;
    }
    const parsedUnitPrice = unit_price ? parseFloat(unit_price) : null;
    const parsedCategoryId = category_id ? parseInt(category_id, 10) : null;

    if (isNaN(parsedQuantity) || parsedQuantity < 0) {
      throw new Error('Quantity is required and must be non-negative');
    }
    if (unit_price && (isNaN(parsedUnitPrice) || parsedUnitPrice < 0)) {
      throw new Error('Unit price must be non-negative if provided');
    }

    const result = await pool.query(
      'INSERT INTO items (name, description, category_id, quantity, low_stock_threshold, vendor_name, unit_price, receipt_images, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, NULL) RETURNING *',
      [name, description || null, parsedCategoryId, parsedQuantity, parsedLowStockThreshold, vendor_name || null, parsedUnitPrice, receipt_images || JSON.stringify([])]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error adding item:', error.stack);
    throw error;
  }
}

export async function updateItem(itemId, itemData) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { name, description, category_id, quantity, low_stock_threshold, vendor_name, unit_price, update_reason, receipt_images: providedReceiptImages } = itemData;
    
    if (!update_reason || !update_reason.trim()) {
      throw new Error('Update reason is required');
    }

    // Get current data for update_reasons and receipt_images
    const currentResult = await client.query('SELECT update_reasons, receipt_images FROM items WHERE id = $1', [itemId]);
    if (currentResult.rowCount === 0) throw new Error('Item not found');
    let currentReasons = currentResult.rows[0].update_reasons || '';
    let currentReceiptImages = currentResult.rows[0].receipt_images ? JSON.parse(currentResult.rows[0].receipt_images) : [];
    const timestamp = new Date().toLocaleString();
    const newReasonEntry = `${update_reason} at ${timestamp}`;
    const newReasons = currentReasons ? `${currentReasons} | ${newReasonEntry}` : newReasonEntry;

    // Handle new receipt if provided
    let newReceiptImagesArray = [...currentReceiptImages];
    if (providedReceiptImages) {
      try {
        const parsedProvided = JSON.parse(providedReceiptImages);
        // Find new paths not in current
        const newPaths = parsedProvided.filter(path => !currentReceiptImages.some(img => img.path === path));
        newPaths.forEach(newPath => {
          const newReceiptObj = {
            path: newPath,
            uploaded_at: new Date().toISOString()
          };
          newReceiptImagesArray.push(newReceiptObj);
        });
      } catch (e) {
        // If not JSON, assume it's a single new path
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
      'UPDATE items SET name = $1, description = $2, category_id = $3, quantity = $4, low_stock_threshold = COALESCE($5, low_stock_threshold), vendor_name = $6, unit_price = $7, receipt_images = $8, update_reasons = $9, updated_at = CURRENT_TIMESTAMP WHERE id = $10 RETURNING *',
      [name, description || null, parsedCategoryId, parsedQuantity, parsedLowStockThreshold, vendor_name || null, parsedUnitPrice, JSON.stringify(newReceiptImagesArray), newReasons, itemId]
    );
    if (result.rowCount === 0) throw new Error('Item not found');
    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating item:', error.stack);
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteItem(itemId) {
  try {
    // Delete associated receipt images
    const itemResult = await pool.query('SELECT receipt_images FROM items WHERE id = $1', [itemId]);
    if (itemResult.rowCount > 0) {
      const receiptImages = itemResult.rows[0].receipt_images ? JSON.parse(itemResult.rows[0].receipt_images) : [];
      receiptImages.forEach((imgObj) => {
        const imgPath = imgObj.path;
        try {
          fs.unlinkSync(`.${imgPath}`);
        } catch (unlinkError) {
          console.warn('Could not delete receipt image:', unlinkError);
        }
      });
    }
    
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

export async function issueItem(issueData) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('Issuing item with data:', issueData);
    const { personName, itemId, quantity } = issueData;
    if (!personName || !itemId || !quantity) {
      throw new Error('Missing required fields: personName, itemId, and quantity are required');
    }
    const itemCheck = await client.query(
      'SELECT quantity FROM items WHERE id = $1 FOR UPDATE',
      [itemId]
    );
    if (itemCheck.rowCount === 0) throw new Error('Item not found');
    const availableQuantity = parseInt(itemCheck.rows[0].quantity, 10);
    if (quantity > availableQuantity || quantity <= 0) {
      throw new Error(`Insufficient stock. Only ${availableQuantity} units available. Requested: ${quantity}`);
    }
    const result = await client.query(
      'INSERT INTO items_out (person_name, item_id, quantity, date_time) VALUES ($1, $2, $3, CURRENT_TIMESTAMP) RETURNING *',
      [personName, itemId, quantity]
    );
    await client.query(
      'UPDATE items SET quantity = quantity - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [quantity, itemId]
    );
    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in issueItem transaction:', error.stack);
    throw error;
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
      pool.query('SELECT COUNT(*) AS count FROM items'),
      pool.query('SELECT COUNT(*) AS count FROM categories'),
      pool.query('SELECT COUNT(*) AS count FROM items_out'),
      pool.query('SELECT COUNT(*) AS count FROM items WHERE quantity <= COALESCE(low_stock_threshold, 0)'),
      pool.query('SELECT COUNT(*) AS count FROM requests WHERE status = $1', ['pending']),
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

// Requests
export async function createRequest(requestData) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { createdBy, teamLeaderName, teamLeaderPhone, projectName, ispName, location, deployment, releaseBy, receivedBy, items } = requestData;
    const requestResult = await client.query(
      'INSERT INTO requests (created_by, team_leader_name, team_leader_phone, project_name, isp_name, location, deployment_type, release_by, received_by, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP) RETURNING *',
      [createdBy, teamLeaderName, teamLeaderPhone, projectName, ispName || null, location, deployment, releaseBy || null, receivedBy || null, 'pending']
    );
    const requestId = requestResult.rows[0].id;
    for (const item of items) {
      const selectedItem = await client.query('SELECT id FROM items WHERE name = $1', [item.name]);
      if (selectedItem.rowCount === 0) throw new Error(`Item not found: ${item.name}`);
      const quantityRequested = parseInt(item.requested) || 0;
      await client.query(
        'INSERT INTO request_items (request_id, item_id, quantity_requested, created_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)',
        [requestId, selectedItem.rows[0].id, quantityRequested]
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

export async function updateRequest(requestId, requestData) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { createdBy, teamLeaderName, teamLeaderPhone, projectName, ispName, location, deployment, items } = requestData;
    // Update main request
    await client.query(
      'UPDATE requests SET team_leader_name = $1, team_leader_phone = $2, project_name = $3, isp_name = $4, location = $5, deployment_type = $6, updated_at = CURRENT_TIMESTAMP WHERE id = $7',
      [teamLeaderName, teamLeaderPhone, projectName, ispName || null, location, deployment, requestId]
    );
    // Delete old items and re-insert (simple approach; adjust if needed)
    await client.query('DELETE FROM request_items WHERE request_id = $1', [requestId]);
    for (const item of items) {
      const selectedItem = await client.query('SELECT id FROM items WHERE name = $1', [item.name]);
      if (selectedItem.rowCount === 0) throw new Error(`Item not found: ${item.name}`);
      await client.query(
        'INSERT INTO request_items (request_id, item_id, quantity_requested, created_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)',
        [requestId, selectedItem.rows[0].id, item.requested]
      );
    }
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

export async function rejectRequest(requestId) {
  try {
    const result = await pool.query(
      'UPDATE requests SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND status = $3 RETURNING *',
      ['rejected', requestId, 'approved']
    );
    if (result.rowCount === 0) throw new Error('Request not found or not approved');
    return { message: 'Request rejected' };
  } catch (error) {
    console.error('Error rejecting request:', error.stack);
    throw error;
  }
}

export async function approveRequest(requestId, approverData) {
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
    if (parseInt(approvalCount.rows[0].count, 10) >= 1) {  // Single initial approval
      await client.query(
        'UPDATE requests SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['approved', requestId]
      );
    }
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

export async function finalizeRequest(requestId, items, releasedBy) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const request = await client.query(
      'SELECT status FROM requests WHERE id = $1',
      [requestId]
    );
    if (request.rowCount === 0) throw new Error('Request not found');
    if (request.rows[0].status !== 'approved') throw new Error('Request is not approved');
    for (const item of items) {
      const { itemId, quantityReceived, quantityReturned } = item;
      const itemCheck = await client.query(
        'SELECT quantity FROM items WHERE id = $1 FOR UPDATE',
        [itemId]
      );
      if (itemCheck.rowCount === 0) throw new Error('Item not found');
      const availableQuantity = parseInt(itemCheck.rows[0].quantity, 10);
      const quantityToDeduct = parseInt(quantityReceived) || 0;
      if (quantityToDeduct > availableQuantity) {
        throw new Error(`Insufficient stock for item ID ${itemId}. Only ${availableQuantity} units available.`);
      }
      await client.query(
        'UPDATE request_items SET quantity_received = $1, quantity_returned = $2, updated_at = CURRENT_TIMESTAMP WHERE request_id = $3 AND item_id = $4',
        [quantityReceived || null, quantityReturned || null, requestId, itemId]
      );
      if (quantityToDeduct > 0) {
        await client.query(
          'UPDATE items SET quantity = quantity - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [quantityToDeduct, itemId]
        );
      }
    }
    await client.query(
      'UPDATE requests SET status = $1, release_by = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      ['completed', releasedBy, requestId]
    );
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

export async function getRequestDetails(requestId) {
  try {
    const request = await pool.query(
      'SELECT * FROM requests WHERE id = $1',
      [requestId]
    );
    if (request.rowCount === 0) throw new Error('Request not found');
    const items = await pool.query(
      `SELECT ri.*, i.name AS item_name, i.quantity AS current_stock
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
    return {
      ...request.rows[0],
      items: items.rows,
      approvals: approvals.rows,
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