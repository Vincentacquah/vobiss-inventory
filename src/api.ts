// Updated api.ts with support for item returns (type and reason fields)
const API_URL = 'http://localhost:3001/api';

// Helper to get auth header
const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Custom fetch wrapper to handle auth and 401 errors smoothly
const apiFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      ...getAuthHeader(),
    },
  });

  if (response.status === 401) {
    localStorage.removeItem('token');
    throw new Error('Session expired. Please log in again.');
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  return response;
};

// Interfaces for type safety
interface Item {
  id: number;
  name: string;
  description: string | null;
  category_id: number | null;
  quantity: number;
  low_stock_threshold: number;
  vendor_name: string | null;
  unit_price: number | null;
  receipt_image: string | null;
  update_reason: string | null;
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
  created_by: string;
  team_leader_name: string;
  team_leader_phone: string;
  project_name: string;
  isp_name: string;
  location: string;
  deployment_type: 'Deployment' | 'Maintenance';
  release_by: string | null;
  received_by: string | null;
  type: 'material_request' | 'item_return'; // Added type
  reason?: string; // Added reason
  status: 'pending' | 'approved' | 'completed' | 'rejected';
  created_at: string;
  updated_at: string;
  item_count: number;
  reject_reason?: string | null; // Added for quick access in lists
  approver_name?: string;
}

interface RequestDetails extends Request {
  items: {
    id: number;
    request_id: number;
    item_id: number;
    quantity_requested: number | null;
    quantity_received: number | null;
    quantity_returned: number | null;
    item_name: string;
    current_stock: number;
  }[];
  approvals: {
    id: number;
    request_id: number;
    approver_name: string;
    signature: string;
    approved_at: string;
  }[];
  rejections?: { // Added for rejection details
    id: number;
    request_id: number;
    rejector_name: string;
    reason: string;
    created_at: string;
  }[];
}

interface ItemRow {
  name: string;
  requested: string;
  received: string;
  returned: string;
}

interface AuditLog {
  id: number;
  user_id: number;
  username?: string;
  full_name?: string;
  action: string;
  ip_address: string;
  details: any;
  timestamp: string;
}

interface Supervisor {
  id: number;
  name: string;
  email: string;
  created_at: string;
}

interface User {
  id: number;
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  role: 'requester' | 'approver' | 'issuer' | 'superadmin';
  created_at: string;
}

interface Setting {
  key_name: string;
  value: string;
  description?: string;
  updated_at: string;
}

interface Approver {
  id: number;
  fullName: string;
}

// Helper function to fetch public IP
const fetchPublicIP = async (): Promise<string> => {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    if (!response.ok) throw new Error('Failed to fetch IP');
    const data = await response.json();
    return data.ip;
  } catch (error) {
    console.warn('Failed to fetch public IP, using fallback:', error);
    return 'unknown';
  }
};

// Auth
export const loginUser = async (username: string, password: string, ip?: string): Promise<{ token: string; user: { username: string; role: string; first_name?: string; last_name?: string; full_name?: string } }> => {
  try {
    const effectiveIP = ip || await fetchPublicIP();
    const response = await apiFetch(`${API_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password, ip: effectiveIP }),
    });
    return await response.json();
  } catch (error) {
    console.error('Error logging in:', error);
    throw error;
  }
};

export const logoutUser = async (): Promise<void> => {
  try {
    const response = await apiFetch(`${API_URL}/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error logging out:', error);
    // Don't throw; logout should still clear local state
  }
};

// Users
export const getUsers = async (): Promise<User[]> => {
  try {
    const response = await apiFetch(`${API_URL}/users`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return await response.json();
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
};

export const createUser = async (firstName: string, lastName: string, email: string, role: string): Promise<User> => {
  try {
    const response = await apiFetch(`${API_URL}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ first_name: firstName, last_name: lastName, email, role }),
    });
    return await response.json();
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
};

export const updateUser = async (userId: number, updates: { first_name: string; last_name: string; email: string; role: string }): Promise<User> => {
  try {
    const response = await apiFetch(`${API_URL}/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });
    return await response.json();
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
};

export const deleteUser = async (userId: number): Promise<{ message: string }> => {
  try {
    const response = await apiFetch(`${API_URL}/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return await response.json();
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
};

export const resetUserPassword = async (userId: number): Promise<{ message: string }> => {
  try {
    const response = await apiFetch(`${API_URL}/users/${userId}/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return await response.json();
  } catch (error) {
    console.error('Error resetting password:', error);
    throw error;
  }
};

export const updateUserRole = async (userId: number, role: string): Promise<User> => {
  try {
    const response = await apiFetch(`${API_URL}/users/${userId}/role`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role }),
    });
    return await response.json();
  } catch (error) {
    console.error('Error updating role:', error);
    throw error;
  }
};

export const getApprovers = async (): Promise<Approver[]> => {
  try {
    const response = await apiFetch(`${API_URL}/users/approvers`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return await response.json();
  } catch (error) {
    console.error('Error fetching approvers:', error);
    return [];
  }
};

// Supervisors
export const getSupervisors = async (): Promise<Supervisor[]> => {
  try {
    const response = await apiFetch(`${API_URL}/supervisors`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return await response.json();
  } catch (error) {
    console.error('Error fetching supervisors:', error);
    return [];
  }
};

export const addSupervisor = async (supervisorData: { name: string; email: string }): Promise<Supervisor> => {
  try {
    const response = await apiFetch(`${API_URL}/supervisors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(supervisorData),
    });
    return await response.json();
  } catch (error) {
    console.error('Error adding supervisor:', error);
    throw error;
  }
};

export const updateSupervisor = async (supervisorId: number, supervisorData: { name: string; email: string }): Promise<Supervisor> => {
  try {
    const response = await apiFetch(`${API_URL}/supervisors/${supervisorId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(supervisorData),
    });
    return await response.json();
  } catch (error) {
    console.error('Error updating supervisor:', error);
    throw error;
  }
};

export const deleteSupervisor = async (supervisorId: number): Promise<boolean> => {
  try {
    const response = await apiFetch(`${API_URL}/supervisors/${supervisorId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return true;
  } catch (error) {
    console.error('Error deleting supervisor:', error);
    throw error;
  }
};

// Low Stock Alert
export const sendLowStockAlert = async (data: { lowStockItems: Item[]; supervisors: Supervisor[] }): Promise<{ message: string }> => {
  try {
    const response = await apiFetch(`${API_URL}/send-low-stock-alert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    return await response.json();
  } catch (error) {
    console.error('Error sending low stock alert:', error);
    throw error;
  }
};

// Items
export const getItems = async (): Promise<Item[]> => {
  try {
    const response = await apiFetch(`${API_URL}/items`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return await response.json();
  } catch (error) {
    console.error('Error fetching items:', error);
    return [];
  }
};

export const addItem = async (formData: FormData): Promise<Item> => {
  try {
    const response = await apiFetch(`${API_URL}/items`, {
      method: 'POST',
      headers: getAuthHeader(), // No Content-Type for FormData
      body: formData,
    });
    return await response.json();
  } catch (error) {
    console.error('Error adding item:', error);
    throw error;
  }
};

export const updateItem = async (itemId: number, formData: FormData): Promise<Item> => {
  try {
    const response = await apiFetch(`${API_URL}/items/${itemId}`, {
      method: 'PUT',
      headers: getAuthHeader(), // No Content-Type for FormData
      body: formData,
    });
    return await response.json();
  } catch (error) {
    console.error('Error updating item:', error);
    throw error;
  }
};

export const deleteItem = async (itemId: number): Promise<boolean> => {
  try {
    const response = await apiFetch(`${API_URL}/items/${itemId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return true;
  } catch (error) {
    console.error('Error deleting item:', error);
    throw error;
  }
};

// Categories
export const getCategories = async (): Promise<Category[]> => {
  try {
    const response = await apiFetch(`${API_URL}/categories`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return await response.json();
  } catch (error) {
    console.error('Error fetching categories:', error);
    return [];
  }
};

export const addCategory = async (categoryData: { name: string; description?: string }): Promise<Category> => {
  try {
    const response = await apiFetch(`${API_URL}/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(categoryData),
    });
    return await response.json();
  } catch (error) {
    console.error('Error adding category:', error);
    throw error;
  }
};

export const updateCategory = async (categoryId: number, categoryData: { name: string; description?: string }): Promise<Category> => {
  try {
    const response = await apiFetch(`${API_URL}/categories/${categoryId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(categoryData),
    });
    return await response.json();
  } catch (error) {
    console.error('Error updating category:', error);
    throw error;
  }
};

export const deleteCategory = async (categoryId: number): Promise<boolean> => {
  try {
    const response = await apiFetch(`${API_URL}/categories/${categoryId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return true;
  } catch (error) {
    console.error('Error deleting category:', error);
    throw error;
  }
};

// Items Out
export const getItemsOut = async (): Promise<ItemOut[]> => {
  try {
    const response = await apiFetch(`${API_URL}/items-out`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return await response.json();
  } catch (error) {
    console.error('Error fetching items out:', error);
    return [];
  }
};

export const issueItem = async (issueData: { personName: string; itemId: number; quantity: number }): Promise<ItemOut> => {
  try {
    const response = await apiFetch(`${API_URL}/items-out`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personName: issueData.personName,
        itemId: issueData.itemId,
        quantity: issueData.quantity,
      }),
    });
    return await response.json();
  } catch (error) {
    console.error('Error issuing item:', error);
    throw error;
  }
};

// Low Stock
export const getLowStockItems = async (): Promise<Item[]> => {
  try {
    const response = await apiFetch(`${API_URL}/low-stock`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
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
  pendingRequests: number;
}> => {
  try {
    const response = await apiFetch(`${API_URL}/dashboard-stats`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return await response.json();
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return {
      totalItems: 0,
      totalCategories: 0,
      itemsOut: 0,
      lowStockItems: 0,
      pendingRequests: 0,
    };
  }
};

// Requests
export const createRequest = async (requestData: {
  createdBy: string;
  teamLeaderName?: string; // Optional for returns
  teamLeaderPhone?: string; // Optional for returns
  projectName: string;
  ispName?: string | null; // Optional for returns
  location: string;
  deployment?: 'Deployment' | 'Maintenance'; // Optional for returns
  releaseBy?: string | null; // Optional for returns
  receivedBy?: string | null; // Optional for returns
  reason?: string; // Optional for requests, required for returns
  items: { name: string; requested: number }[];
}, selectedApproverId: number, type: 'material_request' | 'item_return' = 'material_request'): Promise<Request> => {
  try {
    const response = await apiFetch(`${API_URL}/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...requestData, selectedApproverId, type }),
    });
    return await response.json();
  } catch (error) {
    console.error('Error creating request:', error);
    throw error;
  }
};

export const getRequests = async (): Promise<Request[]> => {
  try {
    const response = await apiFetch(`${API_URL}/requests`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return await response.json();
  } catch (error) {
    console.error('Error fetching requests:', error);
    return [];
  }
};

export const updateRequest = async (id: string | number, requestData: {
  createdBy: string;
  teamLeaderName?: string;
  teamLeaderPhone?: string;
  projectName: string;
  ispName?: string | null;
  location: string;
  deployment?: 'Deployment' | 'Maintenance';
  reason?: string;
  items: { name: string; requested: number }[];
}): Promise<{ message: string }> => {
  try {
    const response = await apiFetch(`${API_URL}/requests/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
    });
    return await response.json();
  } catch (error) {
    console.error('Error updating request:', error);
    throw error;
  }
};

export const rejectRequest = async (id: string | number, data: { reason: string; rejectorName: string }): Promise<{ message: string }> => {
  try {
    const response = await apiFetch(`${API_URL}/requests/${id}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    return await response.json();
  } catch (error) {
    console.error('Error rejecting request:', error);
    throw error;
  }
};

export const getRequestDetails = async (id: string | number): Promise<RequestDetails> => {
  try {
    const response = await apiFetch(`${API_URL}/requests/${id}`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return await response.json();
  } catch (error) {
    console.error('Error fetching request details:', error);
    throw error;
  }
};

export const approveRequest = async (id: string | number, data: { approverName: string; signature: string }): Promise<{ message: string }> => {
  try {
    const response = await apiFetch(`${API_URL}/requests/${id}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    return await response.json();
  } catch (error) {
    console.error('Error approving request:', error);
    throw error;
  }
};

export const finalizeRequest = async (id: string | number, items: { itemId: number; quantityReceived: number; quantityReturned: number }[], releasedBy: string): Promise<{ message: string }> => {
  try {
    const response = await apiFetch(`${API_URL}/requests/${id}/finalize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        items, 
        releasedBy
      }),
    });
    return await response.json();
  } catch (error) {
    console.error('Error finalizing request:', error);
    throw error;
  }
};

// Audit Logs
export const getAuditLogs = async (): Promise<AuditLog[]> => {
  try {
    const response = await apiFetch(`${API_URL}/audit-logs`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return await response.json();
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return [];
  }
};

// Settings
export const getSettings = async (): Promise<{ [key: string]: string; all: Setting[] }> => {
  try {
    const response = await apiFetch(`${API_URL}/settings`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return await response.json();
  } catch (error) {
    console.error('Error fetching settings:', error);
    return { from_name: 'Inventory System', from_email: 'noreply@inventory.com', all: [] };
  }
};

export const updateSetting = async (key: string, value: string): Promise<{ key: string; value: string }> => {
  try {
    const response = await apiFetch(`${API_URL}/settings/${key}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ value }),
    });
    return await response.json();
  } catch (error) {
    console.error('Error updating setting:', error);
    throw error;
  }
};