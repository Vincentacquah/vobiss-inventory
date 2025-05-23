
// API layer that now uses Supabase client
import { supabase } from './integrations/supabase/client';

// Items API
export const getItems = async () => {
  try {
    const { data, error } = await supabase
      .from('items')
      .select(`
        *,
        categories:category_id (name)
      `);
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching items:', error);
    return [];
  }
};

export const addItem = async (itemData) => {
  try {
    const { data, error } = await supabase
      .from('items')
      .insert([{
        name: itemData.name,
        description: itemData.description,
        category_id: itemData.categoryId,
        quantity: itemData.quantity,
        low_stock_threshold: itemData.lowStockThreshold
      }])
      .select();
    
    if (error) throw error;
    return data?.[0];
  } catch (error) {
    console.error('Error adding item:', error);
    throw error;
  }
};

export const updateItem = async (itemId, itemData) => {
  try {
    const { data, error } = await supabase
      .from('items')
      .update({
        name: itemData.name,
        description: itemData.description,
        category_id: itemData.categoryId,
        quantity: itemData.quantity,
        low_stock_threshold: itemData.lowStockThreshold,
        updated_at: new Date().toISOString()
      })
      .eq('id', itemId)
      .select();
    
    if (error) throw error;
    return data?.[0];
  } catch (error) {
    console.error('Error updating item:', error);
    throw error;
  }
};

export const deleteItem = async (itemId) => {
  try {
    const { error } = await supabase
      .from('items')
      .delete()
      .eq('id', itemId);
    
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting item:', error);
    throw error;
  }
};

// Categories API
export const getCategories = async () => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*');
    
    if (error) throw error;
    
    // Get item counts for each category
    const { data: items } = await supabase
      .from('items')
      .select('category_id');
    
    const categoryCounts = {};
    items?.forEach(item => {
      if (item.category_id) {
        categoryCounts[item.category_id] = (categoryCounts[item.category_id] || 0) + 1;
      }
    });
    
    return (data || []).map(category => ({
      ...category,
      itemCount: categoryCounts[category.id] || 0
    }));
  } catch (error) {
    console.error('Error fetching categories:', error);
    return [];
  }
};

export const addCategory = async (categoryData) => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .insert([{
        name: categoryData.name,
        description: categoryData.description
      }])
      .select();
    
    if (error) throw error;
    return data?.[0];
  } catch (error) {
    console.error('Error adding category:', error);
    throw error;
  }
};

export const updateCategory = async (categoryId, categoryData) => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .update({
        name: categoryData.name,
        description: categoryData.description
      })
      .eq('id', categoryId)
      .select();
    
    if (error) throw error;
    return data?.[0];
  } catch (error) {
    console.error('Error updating category:', error);
    throw error;
  }
};

export const deleteCategory = async (categoryId) => {
  try {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', categoryId);
    
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting category:', error);
    throw error;
  }
};

// Items Out API
export const getItemsOut = async () => {
  try {
    const { data, error } = await supabase
      .from('items_out')
      .select(`
        *,
        items:item_id (
          name,
          categories:category_id (name)
        )
      `)
      .order('date_time', { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching items out:', error);
    return [];
  }
};

export const issueItem = async (issueData) => {
  try {
    const { data, error } = await supabase
      .from('items_out')
      .insert([{
        person_name: issueData.personName,
        item_id: issueData.itemId,
        quantity: issueData.quantity,
        date_time: new Date().toISOString()
      }])
      .select();
    
    if (error) throw error;
    return data?.[0];
  } catch (error) {
    console.error('Error issuing item:', error);
    throw error;
  }
};

// Low Stock API
export const getLowStockItems = async () => {
  try {
    const { data, error } = await supabase
      .from('items')
      .select(`
        *,
        categories:category_id (name)
      `)
      .lte('quantity', supabase.rpc('least', { a: 'quantity', b: 'low_stock_threshold' }));
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching low stock items:', error);
    return [];
  }
};

// Dashboard API
export const getDashboardStats = async () => {
  try {
    const [itemsResponse, categoriesResponse, itemsOutResponse] = await Promise.all([
      supabase.from('items').select('*'),
      supabase.from('categories').select('*'),
      supabase.from('items_out').select('*')
    ]);
    
    const items = itemsResponse.data || [];
    const categories = categoriesResponse.data || [];
    const itemsOut = itemsOutResponse.data || [];
    
    const lowStock = items.filter(item => item.quantity <= item.low_stock_threshold);
    
    return {
      totalItems: items.length,
      totalCategories: categories.length,
      itemsOut: itemsOut.length,
      lowStockItems: lowStock.length
    };
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return {
      totalItems: 0,
      totalCategories: 0,
      itemsOut: 0,
      lowStockItems: 0
    };
  }
};
