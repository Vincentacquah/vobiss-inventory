// Full server.js ready for Vercel deployment
// Key Vercel adaptations:
// - Exported app (no app.listen())
// - Multer uses memoryStorage (no disk writes in serverless)
// - File uploads to Supabase Storage (create public 'receipts' bucket)
// - CORS configurable via FRONTEND_URL env var (no hardcoding)
// - Seeding on cold start (use Supabase migrations for prod if needed)
// - All routes/auth/DB/email logic preserved
// - Add to package.json: "@supabase/supabase-js": "^2.45.4", "type": "module"
// - Env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET, FRONTEND_URL, DATABASE_URL (for pool)

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path'; // For file extensions
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { createClient } from '@supabase/supabase-js';
import {
  getItems, addItem, updateItem, deleteItem,
  getCategories, addCategory, updateCategory, deleteCategory,
  getItemsOut, issueItem, getLowStockItems, getDashboardStats,
  createRequest, getRequests, approveRequest, finalizeRequest, getRequestDetails,
  updateRequest, rejectRequest, getUserByUsername, insertAuditLog, getAuditLogs,
  getSupervisors, addSupervisor, updateSupervisor, deleteSupervisor,
  initDB, getSettings, updateSetting,
  getUsers, createUser, resetUserPassword, updateUserRole
} from '../db.js';
import pool from '../db.js';
import { sendLowStockAlert } from '../emailService.js';

dotenv.config();

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this';

// Initialize Supabase client with service role for server-side ops (storage, etc.)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Multer configuration for in-memory file handling (serverless-friendly)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL, // e.g., https://vobiss-inventory.vercel.app (set in Vercel env)
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
// No static serving - use Supabase public URLs for images

// JWT Auth Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

const requireSuperAdmin = (req, res, next) => {
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Super Admin access required' });
  }
  next();
};

const requireSuperAdminOrIssuer = (req, res, next) => {
  if (req.user.role !== 'superadmin' && req.user.role !== 'issuer') {
    return res.status(403).json({ error: 'Super Admin or Issuer access required' });
  }
  next();
};

const requireManager = (req, res, next) => {
  const allowedRoles = ['superadmin', 'issuer', 'approver'];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Manager access required' });
  }
  next();
};

// Helper: Upload file to Supabase Storage and return public URL
async function uploadToSupabase(file) {
  if (!file) return null;
  
  const fileName = `receipt-${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
  const { data, error } = await supabase.storage
    .from('receipts') // Ensure this public bucket exists in Supabase
    .upload(fileName, Buffer.from(file.buffer), {
      contentType: file.mimetype,
      upsert: false
    });
  
  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }
  
  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('receipts')
    .getPublicUrl(data.path);
  
  return publicUrl;
}

// Helper: Delete file from Supabase Storage
async function deleteFromSupabase(filePath) {
  if (!filePath) return;
  
  // Extract filename from URL
  const fileName = filePath.split('/').pop();
  const { error } = await supabase.storage
    .from('receipts')
    .remove([fileName]);
  
  if (error) {
    console.warn(`Delete failed (non-fatal): ${error.message}`);
  }
}

// Seed default user and init DB
async function seedDefaultUser() {
  try {
    await initDB();
    const defaultFirstName = 'Admin';
    const defaultLastName = 'Super';
    const defaultUsername = 'superadmin';
    const defaultEmail = 'admin@vobiss.com';
    const defaultPassword = await bcrypt.hash('admin123', 10);
    const defaultRole = 'superadmin';
    const existing = await getUserByUsername(defaultUsername);
    if (!existing) {
      await pool.query(
        'INSERT INTO users (first_name, last_name, username, email, password, role) VALUES ($1, $2, $3, $4, $5, $6)',
        [defaultFirstName, defaultLastName, defaultUsername, defaultEmail, defaultPassword, defaultRole]
      );
      console.log('Default user created: Super Admin / admin123');
    } else {
      console.log('Default user already exists');
    }
  } catch (error) {
    console.error('Error seeding default user:', error);
  }
}

await seedDefaultUser();

// Auth Routes
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await getUserByUsername(username);
    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    // Log audit
    const ip = req.ip || req.connection.remoteAddress;
    const details = { userAgent: req.get('User-Agent') };
    await insertAuditLog(user.id, 'login', ip, details);
    res.json({ 
      token, 
      user: { 
        username: user.username, 
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name,
        full_name: `${user.first_name} ${user.last_name}`.trim()
      } 
    });
  } catch (error) {
    console.error('Error in login:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/logout', authenticateToken, async (req, res) => {
  try {
    const ip = req.ip || req.connection.remoteAddress;
    const details = { userAgent: req.get('User-Agent') };
    await insertAuditLog(req.user.id, 'logout', ip, details);
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error in logout:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/audit-logs', authenticateToken, async (req, res) => {
  try {
    const logs = await getAuditLogs();
    res.json(logs);
  } catch (error) {
    console.error('Error fetching audit logs:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

// Settings Routes
app.get('/api/settings', authenticateToken, async (req, res) => {
  try {
    const settings = await getSettings();
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/settings/:key', authenticateToken, async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    const updated = await updateSetting(key, value);
    res.json(updated);
  } catch (error) {
    console.error('Error updating setting:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

// Supervisors Routes
app.get('/api/supervisors', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const supervisors = await getSupervisors();
    res.json(supervisors);
  } catch (error) {
    console.error('Error fetching supervisors:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/supervisors', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const supervisor = await addSupervisor(req.body);
    res.status(201).json(supervisor);
  } catch (error) {
    console.error('Error adding supervisor:', error.stack);
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/supervisors/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const supervisorId = parseInt(req.params.id);
    const supervisor = await updateSupervisor(supervisorId, req.body);
    res.json(supervisor);
  } catch (error) {
    console.error('Error updating supervisor:', error.stack);
    res.status(error.message === 'Supervisor not found' ? 404 : 400).json({ error: error.message });
  }
});

app.delete('/api/supervisors/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const result = await deleteSupervisor(parseInt(req.params.id));
    res.json(result);
  } catch (error) {
    console.error('Error deleting supervisor:', error.stack);
    res.status(error.message === 'Supervisor not found' ? 404 : 500).json({ error: error.message });
  }
});

// Users Routes
app.get('/api/users', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const users = await getUsers();
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/users', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { first_name, last_name, email, role } = req.body;
    if (!['requester', 'approver', 'issuer', 'superadmin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    const user = await createUser(first_name, last_name, email, role);
    res.status(201).json(user);
  } catch (error) {
    console.error('Error creating user:', error.stack);
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/users/:id/reset-password', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const result = await resetUserPassword(userId);
    res.json(result);
  } catch (error) {
    console.error('Error resetting password:', error.stack);
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/users/:id/role', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { role } = req.body;
    if (!['requester', 'approver', 'issuer', 'superadmin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    const user = await updateUserRole(userId, role);
    res.json(user);
  } catch (error) {
    console.error('Error updating user role:', error.stack);
    res.status(400).json({ error: error.message });
  }
});

// Manual low stock alert
app.post('/api/send-low-stock-alert', authenticateToken, async (req, res) => {
  try {
    const { force } = req.body;
    if (force) {
      console.log('Force-triggered low stock alert');
    }
    await sendLowStockAlert();
    res.json({ message: 'Low stock alert sent successfully (or no items to alert about)' });
  } catch (error) {
    console.error('Error in manual low stock alert trigger:', error);
    res.status(500).json({ error: 'Failed to send alert: ' + error.message });
  }
});

// Items Routes
app.get('/api/items', authenticateToken, async (req, res) => {
  try {
    const items = await getItems();
    res.json(items);
  } catch (error) {
    console.error('Error fetching items:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/items', authenticateToken, upload.single('receiptImage'), async (req, res) => {
  try {
    const itemData = req.body;
    let receiptImages = [];
    if (req.file) {
      const publicUrl = await uploadToSupabase(req.file);
      if (publicUrl) {
        receiptImages = [publicUrl];
      }
    }
    const item = await addItem({ ...itemData, receipt_images: JSON.stringify(receiptImages) });
    const parsedQuantity = parseInt(itemData.quantity, 10);
    const threshold = item.low_stock_threshold || 5;
    if (parsedQuantity <= threshold) {
      console.log('New item added is low stock, triggering alert (non-blocking)');
      sendLowStockAlert(item).catch(err => console.error('Alert failed after item add:', err));
    } else {
      console.log('New item added is not low stock, skipping alert');
    }
    res.status(201).json(item);
  } catch (error) {
    console.error('Error adding item:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/items/:id', authenticateToken, upload.single('receiptImage'), async (req, res) => {
  try {
    const itemId = parseInt(req.params.id);
    const currentItems = await getItems();
    const currentItem = currentItems.find(item => item.id === itemId);
    
    if (!currentItem) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const itemData = req.body;
    let receiptImages = [];
    try {
      receiptImages = typeof currentItem.receipt_images === 'string' ? JSON.parse(currentItem.receipt_images) : currentItem.receipt_images || [];
    } catch (e) {
      receiptImages = [];
    }

    if (req.file) {
      const publicUrl = await uploadToSupabase(req.file);
      if (publicUrl) {
        receiptImages.push(publicUrl);
      }
    }

    const updatedItemData = { ...itemData, receipt_images: JSON.stringify(receiptImages) };
    const item = await updateItem(itemId, updatedItemData);

    const oldQuantity = parseInt(currentItem.quantity, 10);
    const newQuantity = parseInt(itemData.quantity, 10);
    const threshold = item.low_stock_threshold || 5;
    if (newQuantity < oldQuantity && newQuantity <= threshold) {
      console.log('Item updated to low stock, triggering alert (non-blocking)');
      sendLowStockAlert(item).catch(err => console.error('Alert failed after item update:', err));
    } else {
      console.log('Item updated but not newly low stock, skipping alert');
    }
    res.json(item);
  } catch (error) {
    console.error('Error updating item:', error.stack);
    res.status(error.message === 'Item not found' ? 404 : 500).json({ error: error.message });
  }
});

app.delete('/api/items/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const itemId = parseInt(req.params.id);
    const currentItems = await getItems();
    const itemToDelete = currentItems.find(item => item.id === itemId);
    
    if (itemToDelete) {
      let receiptImages = [];
      try {
        receiptImages = typeof itemToDelete.receipt_images === 'string' ? JSON.parse(itemToDelete.receipt_images) : itemToDelete.receipt_images || [];
      } catch (e) {
        receiptImages = [];
      }
      // Delete files from Supabase
      for (const imgUrl of receiptImages) {
        await deleteFromSupabase(imgUrl);
      }
    }
    
    const result = await deleteItem(req.params.id);
    res.json(result);
  } catch (error) {
    console.error('Error deleting item:', error.stack);
    res.status(error.message === 'Item not found' ? 404 : 500).json({ error: error.message });
  }
});

// Categories Routes
app.get('/api/categories', authenticateToken, async (req, res) => {
  try {
    const categories = await getCategories();
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/categories', authenticateToken, async (req, res) => {
  try {
    const category = await addCategory(req.body);
    res.status(201).json(category);
  } catch (error) {
    console.error('Error adding category:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/categories/:id', authenticateToken, async (req, res) => {
  try {
    const category = await updateCategory(req.params.id, req.body);
    res.json(category);
  } catch (error) {
    console.error('Error updating category:', error.stack);
    res.status(error.message === 'Category not found' ? 404 : 500).json({ error: error.message });
  }
});

app.delete('/api/categories/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const result = await deleteCategory(req.params.id);
    res.json(result);
  } catch (error) {
    console.error('Error deleting category:', error.stack);
    res.status(error.message === 'Category not found' ? 404 : 500).json({ error: error.message });
  }
});

// Items Out Routes
app.get('/api/items-out', authenticateToken, async (req, res) => {
  try {
    const itemsOut = await getItemsOut();
    res.json(itemsOut);
  } catch (error) {
    console.error('Error fetching items out:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/items-out', authenticateToken, async (req, res) => {
  console.log('Received issueItem request with data:', req.body);
  try {
    const itemOut = await issueItem(req.body);
    console.log('Item issued, triggering low stock alert (non-blocking)');
    sendLowStockAlert().catch(err => console.error('Alert failed after item issue:', err));
    res.status(201).json(itemOut);
  } catch (error) {
    console.error('Error issuing item:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

// Low Stock Route
app.get('/api/low-stock', authenticateToken, async (req, res) => {
  try {
    const lowStockItems = await getLowStockItems();
    res.json(lowStockItems);
  } catch (error) {
    console.error('Error fetching low stock items:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

// Dashboard Stats Route
app.get('/api/dashboard-stats', authenticateToken, async (req, res) => {
  try {
    const stats = await getDashboardStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

// Requests Routes
app.post('/api/requests', authenticateToken, async (req, res) => {
  try {
    const request = await createRequest(req.body);
    res.status(201).json(request);
  } catch (error) {
    console.error('Error creating request:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/requests', authenticateToken, async (req, res) => {
  try {
    const requests = await getRequests();
    res.json(requests);
  } catch (error) {
    console.error('Error fetching requests:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/requests/:id', authenticateToken, async (req, res) => {
  try {
    const result = await updateRequest(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    console.error('Error updating request:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/requests/:id/reject', authenticateToken, requireManager, async (req, res) => {
  try {
    const result = await rejectRequest(req.params.id);
    res.json(result);
  } catch (error) {
    console.error('Error rejecting request:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/requests/:id/approve', authenticateToken, async (req, res) => {
  try {
    const result = await approveRequest(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    console.error('Error approving request:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/requests/:id/finalize', authenticateToken, requireSuperAdminOrIssuer, async (req, res) => {
  try {
    const { items, releasedBy } = req.body;
    const result = await finalizeRequest(req.params.id, items, releasedBy);
    res.json(result);
  } catch (error) {
    console.error('Error finalizing request:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/requests/:id', authenticateToken, async (req, res) => {
  try {
    const request = await getRequestDetails(req.params.id);
    res.json(request);
  } catch (error) {
    console.error('Error fetching request details:', error.stack);
    res.status(error.message === 'Request not found' ? 404 : 500).json({ error: error.message });
  }
});

// Export for Vercel serverless
export default app;