// server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import {
  getItems, addItem, updateItem, deleteItem,
  getCategories, addCategory, updateCategory, deleteCategory,
  getItemsOut, issueItem, getLowStockItems, getDashboardStats,
  createRequest, getRequests, approveRequest, finalizeRequest, getRequestDetails,
  updateRequest, rejectRequest, getUserByUsername, insertAuditLog, getAuditLogs,
  getSupervisors, addSupervisor, updateSupervisor, deleteSupervisor,
  initDB, getSettings, updateSetting
} from './db.js';
import pool from './db.js';
import { sendLowStockAlert } from './emailService.js';

dotenv.config();

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

// Seed default user and init DB
async function seedDefaultUser() {
  try {
    await initDB();
    const defaultUsername = 'admin';
    const defaultPassword = await bcrypt.hash('admin123', 10);
    const defaultRole = 'superadmin';
    const existing = await getUserByUsername(defaultUsername);
    if (!existing) {
      await pool.query(
        'INSERT INTO users (username, password, role) VALUES ($1, $2, $3)',
        [defaultUsername, defaultPassword, defaultRole]
      );
      console.log('Default user created: admin / admin123');
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
    res.json({ token, user: { username: user.username, role: user.role } });
  } catch (error) {
    console.error('Error in login:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const ip = req.ip || req.connection.remoteAddress;
        const details = { userAgent: req.get('User-Agent') };
        await insertAuditLog(decoded.id, 'logout', ip, details);
      } catch (verifyError) {
        console.warn('Invalid token on logout:', verifyError);
      }
    }
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error in logout:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/audit-logs', async (req, res) => {
  try {
    const logs = await getAuditLogs();
    res.json(logs);
  } catch (error) {
    console.error('Error fetching audit logs:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

// Settings Routes
app.get('/api/settings', async (req, res) => {
  try {
    const settings = await getSettings();
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/settings/:key', async (req, res) => {
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
app.get('/api/supervisors', async (req, res) => {
  try {
    const supervisors = await getSupervisors();
    res.json(supervisors);
  } catch (error) {
    console.error('Error fetching supervisors:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/supervisors', async (req, res) => {
  try {
    const supervisor = await addSupervisor(req.body);
    res.status(201).json(supervisor);
  } catch (error) {
    console.error('Error adding supervisor:', error.stack);
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/supervisors/:id', async (req, res) => {
  try {
    const supervisorId = parseInt(req.params.id);
    const supervisor = await updateSupervisor(supervisorId, req.body);
    res.json(supervisor);
  } catch (error) {
    console.error('Error updating supervisor:', error.stack);
    res.status(error.message === 'Supervisor not found' ? 404 : 400).json({ error: error.message });
  }
});

app.delete('/api/supervisors/:id', async (req, res) => {
  try {
    const result = await deleteSupervisor(parseInt(req.params.id));
    res.json(result);
  } catch (error) {
    console.error('Error deleting supervisor:', error.stack);
    res.status(error.message === 'Supervisor not found' ? 404 : 500).json({ error: error.message });
  }
});

// Dedicated route for manually triggering low stock alerts
app.post('/api/send-low-stock-alert', async (req, res) => {
  try {
    // Optional: Accept a body param like { force: true } to override checks, but default to normal behavior
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
app.get('/api/items', async (req, res) => {
  try {
    const items = await getItems();
    res.json(items);
  } catch (error) {
    console.error('Error fetching items:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/items', upload.single('receiptImage'), async (req, res) => {
  try {
    const itemData = req.body;
    let receiptImages = [];
    if (req.file) {
      receiptImages = [`/uploads/${req.file.filename}`];
    }
    const item = await addItem({ ...itemData, receipt_images: JSON.stringify(receiptImages) });
    const parsedQuantity = parseInt(itemData.quantity, 10);
    const threshold = item.low_stock_threshold || 5;
    // Only trigger alert if the newly added item is low stock
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

app.put('/api/items/:id', upload.single('receiptImage'), async (req, res) => {
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
    const item = await updateItem(itemId, updatedItemData);

    // Check if quantity decreased and now <= threshold (newly low or lower)
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

app.delete('/api/items/:id', async (req, res) => {
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
    
    const result = await deleteItem(req.params.id);
    res.json(result);
  } catch (error) {
    console.error('Error deleting item:', error.stack);
    res.status(error.message === 'Item not found' ? 404 : 500).json({ error: error.message });
  }
});

// Categories Routes
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await getCategories();
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/categories', async (req, res) => {
  try {
    const category = await addCategory(req.body);
    res.status(201).json(category);
  } catch (error) {
    console.error('Error adding category:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/categories/:id', async (req, res) => {
  try {
    const category = await updateCategory(req.params.id, req.body);
    res.json(category);
  } catch (error) {
    console.error('Error updating category:', error.stack);
    res.status(error.message === 'Category not found' ? 404 : 500).json({ error: error.message });
  }
});

app.delete('/api/categories/:id', async (req, res) => {
  try {
    const result = await deleteCategory(req.params.id);
    res.json(result);
  } catch (error) {
    console.error('Error deleting category:', error.stack);
    res.status(error.message === 'Category not found' ? 404 : 500).json({ error: error.message });
  }
});

// Items Out Routes
app.get('/api/items-out', async (req, res) => {
  try {
    const itemsOut = await getItemsOut();
    res.json(itemsOut);
  } catch (error) {
    console.error('Error fetching items out:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/items-out', async (req, res) => {
  console.log('Received issueItem request with data:', req.body);
  try {
    const itemOut = await issueItem(req.body);
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
app.get('/api/low-stock', async (req, res) => {
  try {
    const lowStockItems = await getLowStockItems();
    res.json(lowStockItems);
  } catch (error) {
    console.error('Error fetching low stock items:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

// Dashboard Stats Route
app.get('/api/dashboard-stats', async (req, res) => {
  try {
    const stats = await getDashboardStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

// Requests Routes
app.post('/api/requests', async (req, res) => {
  try {
    const request = await createRequest(req.body);
    res.status(201).json(request);
  } catch (error) {
    console.error('Error creating request:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/requests', async (req, res) => {
  try {
    const requests = await getRequests();
    res.json(requests);
  } catch (error) {
    console.error('Error fetching requests:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/requests/:id', async (req, res) => {
  try {
    const result = await updateRequest(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    console.error('Error updating request:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/requests/:id/reject', async (req, res) => {
  try {
    const result = await rejectRequest(req.params.id);
    res.json(result);
  } catch (error) {
    console.error('Error rejecting request:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/requests/:id/approve', async (req, res) => {
  try {
    const result = await approveRequest(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    console.error('Error approving request:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/requests/:id/finalize', async (req, res) => {
  try {
    const { items, releasedBy } = req.body;
    const result = await finalizeRequest(req.params.id, items, releasedBy);
    res.json(result);
  } catch (error) {
    console.error('Error finalizing request:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/requests/:id', async (req, res) => {
  try {
    const request = await getRequestDetails(req.params.id);
    res.json(request);
  } catch (error) {
    console.error('Error fetching request details:', error.stack);
    res.status(error.message === 'Request not found' ? 404 : 500).json({ error: error.message });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});