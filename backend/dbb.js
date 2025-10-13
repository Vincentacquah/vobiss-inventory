import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Load environment variables
config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Database functions

// Categories
export async function getCategories() {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*');
    if (error) throw error;
    const { data: items, error: itemError } = await supabase
      .from('items')
      .select('category_id');
    if (itemError) throw itemError;
    const categoryCounts = {};
    items.forEach(item => {
      if (item.category_id) {
        categoryCounts[item.category_id] = (categoryCounts[item.category_id] || 0) + 1;
      }
    });
    return data.map(category => ({
      ...category,
      itemCount: categoryCounts[category.id] || 0
    }));
  } catch (error) {
    console.error('Error fetching categories:', error.message);
    return [];
  }
}

export async function addCategory(categoryData) {
  try {
    const { data, error } = await supabase
      .from('categories')
      .insert([categoryData])
      .select();
    if (error) throw error;
    return data[0];
  } catch (error) {
    console.error('Error adding category:', error.message);
    throw error;
  }
}

export async function updateCategory(categoryId, categoryData) {
  try {
    const { data, error } = await supabase
      .from('categories')
      .update(categoryData)
      .eq('id', categoryId)
      .select();
    if (error) throw error;
    if (!data.length) throw new Error('Category not found');
    return data[0];
  } catch (error) {
    console.error('Error updating category:', error.message);
    throw error;
  }
}

export async function deleteCategory(categoryId) {
  try {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', categoryId);
    if (error) throw error;
    return { message: 'Category deleted' };
  } catch (error) {
    console.error('Error deleting category:', error.message);
    throw error;
  }
}

// Items
export async function getItems() {
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
    console.error('Error fetching items:', error.message);
    return [];
  }
}

export async function addItem(itemData) {
  try {
    const { data, error } = await supabase
      .from('items')
      .insert([itemData])
      .select();
    if (error) throw error;
    return data[0];
  } catch (error) {
    console.error('Error adding item:', error.message);
    throw error;
  }
}

export async function updateItem(itemId, itemData) {
  try {
    const { data, error } = await supabase
      .from('items')
      .update({
        ...itemData,
        updated_at: new Date().toISOString()
      })
      .eq('id', itemId)
      .select();
    if (error) throw error;
    if (!data.length) throw new Error('Item not found');
    return data[0];
  } catch (error) {
    console.error('Error updating item:', error.message);
    throw error;
  }
}

export async function deleteItem(itemId) {
  try {
    const { error } = await supabase
      .from('items')
      .delete()
      .eq('id', itemId);
    if (error) throw error;
    return { message: 'Item deleted' };
  } catch (error) {
    console.error('Error deleting item:', error.message);
    throw error;
  }
}

// Items Out
export async function getItemsOut() {
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
    console.error('Error fetching items out:', error.message);
    return [];
  }
}

export async function issueItem(issueData) {
  try {
    const { data, error } = await supabase
      .from('items_out')
      .insert([issueData])
      .select();
    if (error) throw error;
    return data[0];
  } catch (error) {
    console.error('Error issuing item:', error.message);
    throw error;
  }
}

// Low Stock and Dashboard Stats
export async function getLowStockItems() {
  try {
    const { data, error } = await supabase
      .from('items')
      .select(`
        *,
        categories:category_id (name)
      `)
      .lte('quantity', 'low_stock_threshold');
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching low stock items:', error.message);
    return [];
  }
}

export async function getDashboardStats() {
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
    console.error('Error fetching dashboard stats:', error.message);
    return {
      totalItems: 0,
      totalCategories: 0,
      itemsOut: 0,
      lowStockItems: 0
    };
  }
}

export default supabase;