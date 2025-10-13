const API_URL = 'http://localhost:3001/api';

// Interfaces for type safety
interface Item {
  id: number;
  name: string;
  description: string | null;
  category_id: number | null;
  quantity: number;
  low_stock_threshold: number | null;
  created_at: string;
  updated_at: string;
  category_name?: string;
}

interface Category {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  itemCount: number;
}

interface ItemOut {
  id: number;
  person_name: string;
  item_id: number;
  quantity: number;
  date_time: string;
  item_name: string;
  category_name: string;
}

interface Request {
  id: number;
  team_leader_phone: string;
  project_name: string;
  isp_name: string;
  location: string;
  deployment_type: 'Deployment' | 'Maintenance';
  release_by: string | null;
  received_by: string | null;
  status: 'pending' | 'approved' | 'completed';
  created_at: string;
  updated_at: string;
  item_count: number;
}

interface ItemRow {
  name: string;
  requested: string;
  received: string;
  returned: string;
}

// Items
export const getItems = async (): Promise<Item[]> => {
  try {
    const response = await fetch(`${API_URL}/items`);
    if (!response.ok) throw new Error('Failed to fetch items');
    return await response.json();
  } catch (error) {
    console.error('Error fetching items:', error);
    return [];
  }
};

export const addItem = async (itemData: { name: string; description?: string; categoryId?: number; quantity: number; lowStockThreshold?: number }): Promise<Item> => {
  try {
    const response = await fetch(`${API_URL}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: itemData.name,
        description: itemData.description,
        categoryId: itemData.categoryId,
        quantity: itemData.quantity,
        lowStockThreshold: itemData.lowStockThreshold,
      }),
    });
    if (!response.ok) throw new Error('Failed to add item');
    return await response.json();
  } catch (error) {
    console.error('Error adding item:', error);
    throw error;
  }
};

export const updateItem = async (itemId: number, itemData: { name: string; description?: string; categoryId?: number; quantity: number; lowStockThreshold?: number }): Promise<Item> => {
  try {
    const response = await fetch(`${API_URL}/items/${itemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: itemData.name,
        description: itemData.description,
        categoryId: itemData.categoryId,
        quantity: itemData.quantity,
        lowStockThreshold: itemData.lowStockThreshold,
      }),
    });
    if (!response.ok) throw new Error('Failed to update item');
    return await response.json();
  } catch (error) {
    console.error('Error updating item:', error);
    throw error;
  }
};

export const deleteItem = async (itemId: number): Promise<boolean> => {
  try {
    const response = await fetch(`${API_URL}/items/${itemId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete item');
    return true;
  } catch (error) {
    console.error('Error deleting item:', error);
    throw error;
  }
};

// Categories
export const getCategories = async (): Promise<Category[]> => {
  try {
    const response = await fetch(`${API_URL}/categories`);
    if (!response.ok) throw new Error('Failed to fetch categories');
    return await response.json();
  } catch (error) {
    console.error('Error fetching categories:', error);
    return [];
  }
};

export const addCategory = async (categoryData: { name: string; description?: string }): Promise<Category> => {
  try {
    const response = await fetch(`${API_URL}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(categoryData),
    });
    if (!response.ok) throw new Error('Failed to add category');
    return await response.json();
  } catch (error) {
    console.error('Error adding category:', error);
    throw error;
  }
};

export const updateCategory = async (categoryId: number, categoryData: { name: string; description?: string }): Promise<Category> => {
  try {
    const response = await fetch(`${API_URL}/categories/${categoryId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(categoryData),
    });
    if (!response.ok) throw new Error('Failed to update category');
    return await response.json();
  } catch (error) {
    console.error('Error updating category:', error);
    throw error;
  }
};

export const deleteCategory = async (categoryId: number): Promise<boolean> => {
  try {
    const response = await fetch(`${API_URL}/categories/${categoryId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete category');
    return true;
  } catch (error) {
    console.error('Error deleting category:', error);
    throw error;
  }
};

// Items Out
export const getItemsOut = async (): Promise<ItemOut[]> => {
  try {
    const response = await fetch(`${API_URL}/items-out`);
    if (!response.ok) throw new Error('Failed to fetch items out');
    return await response.json();
  } catch (error) {
    console.error('Error fetching items out:', error);
    return [];
  }
};

export const issueItem = async (issueData: { personName: string; itemId: number; quantity: number }): Promise<ItemOut> => {
  try {
    const response = await fetch(`${API_URL}/items-out`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personName: issueData.personName,
        itemId: issueData.itemId,
        quantity: issueData.quantity,
      }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to issue item: ${errorText || 'Server error'}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error issuing item:', error);
    throw error;
  }
};

// Low Stock
export const getLowStockItems = async (): Promise<Item[]> => {
  try {
    const response = await fetch(`${API_URL}/low-stock`);
    if (!response.ok) throw new Error('Failed to fetch low stock items');
    return await response.json();
  } catch (error) {
    console.error('Error fetching low stock items:', error);
    return [];
  }
};

// Dashboard Stats
export const getDashboardStats = async (): Promise<{
  totalItems: number;
  totalCategories: number;
  itemsOut: number;
  lowStockItems: number;
}> => {
  try {
    const response = await fetch(`${API_URL}/dashboard-stats`);
    if (!response.ok) throw new Error('Failed to fetch dashboard stats');
    return await response.json();
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return {
      totalItems: 0,
      totalCategories: 0,
      itemsOut: 0,
      lowStockItems: 0,
    };
  }
};

// Requests
export const createRequest = async (requestData: {
  teamLeaderPhone: string;
  projectName: string;
  ispName: string;
  location: string;
  deployment: 'Deployment' | 'Maintenance';
  releaseBy: string | null;
  receivedBy: string | null;
  items: ItemRow[];
  approvedBy1: string;
  approvedBy2: string;
}): Promise<Request> => {
  try {
    const response = await fetch(`${API_URL}/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestData),
    });
    if (!response.ok) throw new Error('Failed to create request');
    return await response.json();
  } catch (error) {
    console.error('Error creating request:', error);
    throw error;
  }
};

export const getRequests = async (): Promise<Request[]> => {
  try {
    const response = await fetch(`${API_URL}/requests`);
    if (!response.ok) throw new Error('Failed to fetch requests');
    return await response.json();
  } catch (error) {
    console.error('Error fetching requests:', error);
    return [];
  }
};