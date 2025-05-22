
// API layer for backend communication
// This file will handle all backend interactions

const API_BASE_URL = 'http://localhost:3001/api'; // Update with your backend URL

// Helper function to handle API responses
const handleResponse = async (response) => {
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }
  return response.json();
};

// Helper function to make API calls
const apiCall = async (endpoint, options = {}) => {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });
    return handleResponse(response);
  } catch (error) {
    console.error(`API call failed for ${endpoint}:`, error);
    // Return mock data for development/testing
    return getMockData(endpoint, options.method);
  }
};

// Mock data for testing without backend
const getMockData = (endpoint, method) => {
  const mockItems = [
    { id: '1', name: 'ONT Router', description: 'Optical Network Terminal Router', categoryId: '1', quantity: 25, lowStockThreshold: 10 },
    { id: '2', name: 'Ethernet Cable', description: 'Cat6 Ethernet Cable 5m', categoryId: '2', quantity: 150, lowStockThreshold: 20 },
    { id: '3', name: 'Network Switch', description: '8-port Gigabit Switch', categoryId: '3', quantity: 8, lowStockThreshold: 5 },
    { id: '4', name: 'WiFi Router', description: 'Dual Band AC1200 Router', categoryId: '1', quantity: 15, lowStockThreshold: 8 },
    { id: '5', name: 'Fiber Cable', description: 'Single mode fiber optic cable', categoryId: '2', quantity: 45, lowStockThreshold: 15 }
  ];

  const mockCategories = [
    { id: '1', name: 'Routers', description: 'Network routing equipment', itemCount: 2 },
    { id: '2', name: 'Cables', description: 'Network cables and connectors', itemCount: 2 },
    { id: '3', name: 'Switches', description: 'Network switching equipment', itemCount: 1 },
    { id: '4', name: 'ONTs', description: 'Optical Network Terminals', itemCount: 0 }
  ];

  const mockItemsOut = [
    { id: '1', personName: 'John Smith', itemId: '1', itemName: 'ONT Router', categoryName: 'Routers', quantity: 2, dateTime: '2024-01-21T10:30:00Z' },
    { id: '2', personName: 'Sarah Johnson', itemId: '2', itemName: 'Ethernet Cable', categoryName: 'Cables', quantity: 5, dateTime: '2024-01-21T14:15:00Z' },
    { id: '3', personName: 'Mike Davis', itemId: '3', itemName: 'Network Switch', categoryName: 'Switches', quantity: 1, dateTime: '2024-01-20T09:45:00Z' },
    { id: '4', personName: 'Emily Brown', itemId: '4', itemName: 'WiFi Router', categoryName: 'Routers', quantity: 1, dateTime: '2024-01-19T16:20:00Z' },
    { id: '5', personName: 'David Wilson', itemId: '2', itemName: 'Ethernet Cable', categoryName: 'Cables', quantity: 3, dateTime: '2024-01-19T11:10:00Z' }
  ];

  // Route mock responses
  if (endpoint === '/items') {
    if (method === 'POST') return { id: Date.now().toString(), ...mockItems[0] };
    return mockItems;
  }
  if (endpoint === '/categories') {
    if (method === 'POST') return { id: Date.now().toString(), ...mockCategories[0] };
    return mockCategories;
  }
  if (endpoint === '/items-out') {
    if (method === 'POST') return { id: Date.now().toString(), ...mockItemsOut[0] };
    return mockItemsOut;
  }
  if (endpoint === '/low-stock') {
    return mockItems.filter(item => item.quantity <= item.lowStockThreshold);
  }
  
  return [];
};

// Items API
export const getItems = () => apiCall('/items');

export const addItem = (itemData) => apiCall('/items', {
  method: 'POST',
  body: JSON.stringify(itemData),
});

export const updateItem = (itemId, itemData) => apiCall(`/items/${itemId}`, {
  method: 'PUT',
  body: JSON.stringify(itemData),
});

export const deleteItem = (itemId) => apiCall(`/items/${itemId}`, {
  method: 'DELETE',
});

// Categories API
export const getCategories = () => apiCall('/categories');

export const addCategory = (categoryData) => apiCall('/categories', {
  method: 'POST',
  body: JSON.stringify(categoryData),
});

export const updateCategory = (categoryId, categoryData) => apiCall(`/categories/${categoryId}`, {
  method: 'PUT',
  body: JSON.stringify(categoryData),
});

export const deleteCategory = (categoryId) => apiCall(`/categories/${categoryId}`, {
  method: 'DELETE',
});

// Items Out API
export const getItemsOut = () => apiCall('/items-out');

export const issueItem = (issueData) => apiCall('/items-out', {
  method: 'POST',
  body: JSON.stringify(issueData),
});

// Low Stock API
export const getLowStockItems = () => apiCall('/low-stock');

// Reports API
export const getUsageData = (days = 7) => apiCall(`/reports/usage?days=${days}`);

export const getTopItems = (days = 7) => apiCall(`/reports/top-items?days=${days}`);

export const getTopUsers = (days = 7) => apiCall(`/reports/top-users?days=${days}`);

// Dashboard API
export const getDashboardStats = () => apiCall('/dashboard/stats');
