// Updated server.js to handle type and reason in requests
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import {
  getItems, addItem, updateItem, deleteItem,
  getCategories, addCategory, updateCategory, deleteCategory,
  getItemsOut, issueItem, getLowStockItems, getDashboardStats,
  createRequest, getRequests, approveRequest, finalizeRequest, getRequestDetails,
  updateRequest, rejectRequest, getUserByUsername, insertAuditLog, getAuditLogs,
  getSupervisors, addSupervisor, updateSupervisor, deleteSupervisor,
  initDB, getSettings, updateSetting,
  getUsers, createUser, resetUserPassword, updateUserRole, updateUser, deleteUser,
  getApprovers
} from './db.js';
import pool from './db.js';
import { sendLowStockAlert } from './emailService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this';

// Ensure uploads directory exists
const uploadsDir = './uploads';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'receipt-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
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
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static('uploads'));

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

// Helper to get IP (add this near the top, after imports)
function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || req.connection.remoteAddress || 'unknown';
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
    const ip = getClientIp(req);
    const details = { userAgent: req.get('User-Agent') };
    await insertAuditLog(null, user.id, 'login', ip, details);
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
    const ip = getClientIp(req);
    const details = { userAgent: req.get('User-Agent') };
    await insertAuditLog(null, req.user.id, 'logout', ip, details);
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

// New endpoint for approvers
app.get('/api/users/approvers', authenticateToken, async (req, res) => {
  try {
    const approvers = await getApprovers();
    res.json(approvers);
  } catch (error) {
    console.error('Error fetching approvers:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

// Settings Routes (add auth if needed)
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

// Supervisors Routes (add auth)
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

// New Users Routes (Super Admin only)
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
    const ip = getClientIp(req);
    const user = await createUser(first_name, last_name, email, role, req.user.id, ip);
    res.status(201).json(user);
  } catch (error) {
    console.error('Error creating user:', error.stack);
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/users/:id/reset-password', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const ip = getClientIp(req);
    const result = await resetUserPassword(userId, req.user.id, ip);
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
    const ip = getClientIp(req);
    const user = await updateUserRole(userId, role, req.user.id, ip);
    res.json(user);
  } catch (error) {
    console.error('Error updating user role:', error.stack);
    res.status(400).json({ error: error.message });
  }
});

// Full user update route
app.put('/api/users/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const updates = req.body; // { first_name, last_name, email, role }
    const ip = getClientIp(req);
    const user = await updateUser(userId, updates, req.user.id, ip);
    res.json(user);
  } catch (error) {
    console.error('Error updating user:', error.stack);
    res.status(error.message.includes('already exists') ? 400 : (error.message.includes('not found') ? 404 : 500)).json({ error: error.message });
  }
});

// Delete user route
app.delete('/api/users/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const ip = getClientIp(req);
    const result = await deleteUser(userId, req.user.id, ip);
    res.json(result);
  } catch (error) {
    console.error('Error deleting user:', error.stack);
    res.status(error.message.includes('not found') ? 404 : 500).json({ error: error.message });
  }
});

// Dedicated route for manually triggering low stock alerts (updated to accept lowStockItems and supervisors)
app.post('/api/send-low-stock-alert', authenticateToken, async (req, res) => {
  try {
    const { force, lowStockItems, supervisors } = req.body;
    if (force) {
      console.log('Force-triggered low stock alert');
    }
    // Pass data to emailService (if not provided, emailService will fetch defaults)
    await sendLowStockAlert(lowStockItems, supervisors);
    res.json({ message: 'Low stock alert sent successfully to supervisors (or no items to alert about)' });
  } catch (error) {
    console.error('Error in manual low stock alert trigger:', error);
    res.status(500).json({ error: 'Failed to send alert: ' + error.message });
  }
});

// Items Routes (add auth where appropriate, e.g., superadmin for delete)
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
      receiptImages = [`/uploads/${req.file.filename}`];
    }
    const ip = getClientIp(req);
    const item = await addItem({ ...itemData, receipt_images: JSON.stringify(receiptImages) }, req.user.id, ip);
    const parsedQuantity = parseInt(itemData.quantity, 10);
    const threshold = item.low_stock_threshold || 5;
    // Only trigger alert if the newly added item is low stock
    if (parsedQuantity <= threshold) {
      console.log('New item added is low stock, triggering alert (non-blocking)');
      sendLowStockAlert([item]).catch(err => console.error('Alert failed after item add:', err));
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
      receiptImages.push(`/uploads/${req.file.filename}`);
    }

    const updatedItemData = { ...itemData, receipt_images: JSON.stringify(receiptImages) };
    const ip = getClientIp(req);
    const item = await updateItem(itemId, updatedItemData, req.user.id, ip);

    // Check if quantity decreased and now <= threshold (newly low or lower)
    const oldQuantity = parseInt(currentItem.quantity, 10);
    const newQuantity = parseInt(itemData.quantity, 10);
    const threshold = item.low_stock_threshold || 5;
    if (newQuantity < oldQuantity && newQuantity <= threshold) {
      console.log('Item updated to low stock, triggering alert (non-blocking)');
      sendLowStockAlert([item]).catch(err => console.error('Alert failed after item update:', err));
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
    // Delete associated receipt images
    const currentItems = await getItems();
    const itemToDelete = currentItems.find(item => item.id === parseInt(req.params.id));
    if (itemToDelete) {
      let receiptImages = [];
      try {
        receiptImages = typeof itemToDelete.receipt_images === 'string' ? JSON.parse(itemToDelete.receipt_images) : itemToDelete.receipt_images || [];
      } catch (e) {
        receiptImages = [];
      }
      receiptImages.forEach(imgPath => {
        try {
          fs.unlinkSync(`.${imgPath}`);
        } catch (unlinkError) {
          console.warn('Could not delete receipt image:', unlinkError);
        }
      });
    }
    
    const ip = getClientIp(req);
    const result = await deleteItem(req.params.id, req.user.id, ip);
    res.json(result);
  } catch (error) {
    console.error('Error deleting item:', error.stack);
    res.status(error.message === 'Item not found' ? 404 : 500).json({ error: error.message });
  }
});

// Categories Routes (add auth)
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
    const ip = getClientIp(req);
    const category = await addCategory(req.body, req.user.id, ip);
    res.status(201).json(category);
  } catch (error) {
    console.error('Error adding category:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/categories/:id', authenticateToken, async (req, res) => {
  try {
    const ip = getClientIp(req);
    const category = await updateCategory(req.params.id, req.body, req.user.id, ip);
    res.json(category);
  } catch (error) {
    console.error('Error updating category:', error.stack);
    res.status(error.message === 'Category not found' ? 404 : 500).json({ error: error.message });
  }
});

app.delete('/api/categories/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const ip = getClientIp(req);
    const result = await deleteCategory(req.params.id, req.user.id, ip);
    res.json(result);
  } catch (error) {
    console.error('Error deleting category:', error.stack);
    res.status(error.message === 'Category not found' ? 404 : 500).json({ error: error.message });
  }
});

// Items Out Routes (add auth)
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
    const ip = getClientIp(req);
    const itemOut = await issueItem(req.body, req.user.id, ip);
    // Always trigger after issuing (decreases stock)
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

// Updated Requests Routes (add support for type and reason)
app.post('/api/requests', authenticateToken, async (req, res) => {
  try {
    const { selectedApproverId, type = 'material_request', ...requestData } = req.body;
    if (!selectedApproverId) {
      return res.status(400).json({ error: 'Selected approver is required' });
    }
    const ip = getClientIp(req);
    const request = await createRequest(requestData, parseInt(selectedApproverId), type, req.user.id, ip);
    res.status(201).json(request);
  } catch (error) {
    console.error('Error creating request:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/requests', authenticateToken, async (req, res) => {
  try {
    const requests = await getRequests(req.user.role, req.user.id);
    res.json(requests);
  } catch (error) {
    console.error('Error fetching requests:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/requests/:id', authenticateToken, async (req, res) => {
  try {
    const ip = getClientIp(req);
    const result = await updateRequest(req.params.id, req.body, req.user.id, ip);
    res.json(result);
  } catch (error) {
    console.error('Error updating request:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/requests/:id/reject', authenticateToken, requireManager, async (req, res) => {
  try {
    const { reason, rejectorName } = req.body;
    const ip = getClientIp(req);
    const result = await rejectRequest(req.params.id, req.user.id, ip, { reason, rejectorName });
    res.json(result);
  } catch (error) {
    console.error('Error rejecting request:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/requests/:id/approve', authenticateToken, async (req, res) => {
  try {
    const ip = getClientIp(req);
    const result = await approveRequest(req.params.id, req.body, req.user.id, ip);
    res.json(result);
  } catch (error) {
    console.error('Error approving request:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/requests/:id/finalize', authenticateToken, requireSuperAdminOrIssuer, async (req, res) => {
  try {
    const { items, releasedBy } = req.body;
    const ip = getClientIp(req);
    const result = await finalizeRequest(req.params.id, items, releasedBy, req.user.id, ip);
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

// NEW: Serve static files from Vite's dist folder (for production) - adjusted path for /backend location
app.use(express.static(path.join(__dirname, '../dist')));

// UPDATED: Catch-all handler for client-side routes (AFTER all API routes) - removed '*' path to avoid path-to-regexp error
app.use((req, res) => {
  // Skip API and uploads paths to avoid interference
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
    return res.status(404).json({ error: 'Not Found' });
  }
  // Only handle GET requests for SPA (sendFile); others get 405
  if (req.method !== 'GET') {
    return res.status(405).send('Method Not Allowed');
  }
  // Serve index.html for SPA routing - adjusted path for /backend location
  res.sendFile(path.join(__dirname, '../dist', 'index.html'));
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});