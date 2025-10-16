// server.js (or app.js)
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  getItems, addItem, updateItem, deleteItem,
  getCategories, addCategory, updateCategory, deleteCategory,
  getItemsOut, issueItem, getLowStockItems, getDashboardStats,
  createRequest, getRequests, approveRequest, finalizeRequest, getRequestDetails,
  updateRequest, rejectRequest
} from './db.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

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

// ... (rest of routes remain the same)

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