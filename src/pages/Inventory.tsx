import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Package, Grid, List, AlertTriangle } from 'lucide-react';
import * as api from '../api';
import Modal from '../components/Modal';
import ItemForm from '../components/ItemForm';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

/**
 * Inventory Component
 * Manages and displays inventory items with filtering, adding, editing, and deletion capabilities
 * 
 * @returns {JSX.Element} The rendered inventory page
 */
const Inventory = () => {
  // State management
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [layout, setLayout] = useState<'grid' | 'list'>('list');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const { toast } = useToast();

  // Load initial data
  useEffect(() => {
    loadData();
  }, []);

  // Apply filters whenever items, searchTerm, or selectedCategory changes
  useEffect(() => {
    filterItems();
  }, [items, searchTerm, selectedCategory]);

  /**
   * Load items and categories data from API
   */
  const loadData = async () => {
    try {
      const [itemsData, categoriesData] = await Promise.all([
        api.getItems(),
        api.getCategories()
      ]);
      console.log('Loaded items:', itemsData);
      console.log('Loaded categories:', categoriesData);
      setItems(itemsData || []);
      setCategories(categoriesData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load inventory data",
        variant: "destructive"
      });
    }
  };

  /**
   * Filter items based on search term and selected category
   */
  const filterItems = () => {
    let filtered = items;

    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedCategory) {
      filtered = filtered.filter(item => String(item.category_id) === String(selectedCategory));
    }

    setFilteredItems(filtered);
  };

  /**
   * Handle saving an item (add or update)
   * 
   * @param {Object} itemData - The item data to save
   */
  const handleSaveItem = async (itemData) => {
    try {
      if (editingItem) {
        await api.updateItem(editingItem.id, itemData);
        toast({
          title: "Success",
          description: "Item updated successfully",
        });
      } else {
        await api.addItem(itemData);
        toast({
          title: "Success",
          description: "Item added successfully",
        });
      }
      setIsModalOpen(false);
      setEditingItem(null);
      loadData();
    } catch (error) {
      console.error('Error saving item:', error);
      toast({
        title: "Error",
        description: "Failed to save item",
        variant: "destructive"
      });
    }
  };

  /**
   * Handle deleting an item
   * 
   * @param {string} itemId - ID of the item to delete
   */
  const handleDeleteItem = async (itemId) => {
    try {
      await api.deleteItem(itemId);
      toast({
        title: "Success",
        description: "Item deleted successfully",
      });
      loadData();
    } catch (error) {
      console.error('Error deleting item:', error);
      toast({
        title: "Error",
        description: "Failed to delete item",
        variant: "destructive"
      });
    }
  };

  /**
   * Confirm delete item
   */
  const confirmDeleteItem = async () => {
    if (itemToDelete) {
      await handleDeleteItem(itemToDelete.id);
      setConfirmDelete(false);
      setItemToDelete(null);
    }
  };

  /**
   * Get category name by ID
   * 
   * @param {string} categoryId - The category ID
   * @returns {string} The category name
   */
  const getCategoryName = (categoryId) => {
    const category = categories.find(cat => String(cat.id) === String(categoryId));
    return category ? category.name : 'Unknown';
  };

  /**
   * Get CSS classes for stock status display
   * 
   * @param {number} quantity - Current stock quantity
   * @param {number} lowStockThreshold - Low stock threshold value
   * @returns {string} CSS class names
   */
  const getStockStatusColor = (quantity, lowStockThreshold = 10) => {
    if (quantity <= 0) return 'text-red-600 bg-red-50';
    if (quantity <= lowStockThreshold) return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Inventory</h1>
          <p className="text-gray-600 mt-1">Manage your stock items and quantities</p>
        </div>
        <div className="flex items-center space-x-4 mt-4 md:mt-0">
          <Button
            variant={layout === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setLayout('grid')}
            className="flex items-center"
          >
            <Grid className="h-4 w-4 mr-2" />
            Grid
          </Button>
          <Button
            variant={layout === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setLayout('list')}
            className="flex items-center"
          >
            <List className="h-4 w-4 mr-2" />
            List
          </Button>
          <Button
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 text-white hover:bg-blue-700 flex items-center"
          >
            <Plus className="h-5 w-5 mr-2" />
            Add Item
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Categories</option>
            {categories.map(category => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Items Display */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-12">
          <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No items found</p>
        </div>
      ) : layout === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredItems.map(item => (
            <div key={item.id} className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <Package className="h-8 w-8 text-blue-600" />
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      setEditingItem(item);
                      setIsModalOpen(true);
                    }}
                    className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                    aria-label="Edit item"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      setItemToDelete(item);
                      setConfirmDelete(true);
                    }}
                    className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                    aria-label="Delete item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.name}</h3>
              {item.description && (
                <p className="text-sm text-gray-600 mb-3">{item.description}</p>
              )}
              
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-700">Category</span>
                <span className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
                  {getCategoryName(item.category_id)}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Stock</span>
                <span className={`text-sm font-medium px-2 py-1 rounded-full ${getStockStatusColor(item.quantity, item.low_stock_threshold)}`}>
                  {item.quantity} units
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stock
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Package className="h-5 w-5 text-blue-600 mr-3 flex-shrink-0" />
                        <div className="text-sm font-medium text-gray-900">{item.name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{item.description || 'No description'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
                        {getCategoryName(item.category_id)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-medium px-2 py-1 rounded-full ${getStockStatusColor(item.quantity, item.low_stock_threshold)}`}>
                        {item.quantity} units
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            setEditingItem(item);
                            setIsModalOpen(true);
                          }}
                          className="text-blue-600 hover:text-blue-900"
                          aria-label="Edit item"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            setItemToDelete(item);
                            setConfirmDelete(true);
                          }}
                          className="text-red-600 hover:text-red-900"
                          aria-label="Delete item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Item Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingItem(null);
        }}
        title={editingItem ? 'Edit Item' : 'Add New Item'}
      >
        <ItemForm
          item={editingItem}
          categories={categories}
          onSave={handleSaveItem}
          onCancel={() => {
            setIsModalOpen(false);
            setEditingItem(null);
          }}
        />
      </Modal>

      {/* Confirm Delete Modal */}
      <Modal
        isOpen={confirmDelete}
        onClose={() => {
          setConfirmDelete(false);
          setItemToDelete(null);
        }}
        title="Confirm Delete"
      >
        <div className="flex items-start space-x-3 mb-4">
          <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-gray-700">
            Are you sure you want to delete <span className="font-medium">{itemToDelete?.name}</span>? This action cannot be undone.
          </p>
        </div>
        <div className="flex justify-end space-x-2 pt-4">
          <Button
            variant="outline"
            onClick={() => {
              setConfirmDelete(false);
              setItemToDelete(null);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={confirmDeleteItem}
          >
            Delete Item
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default Inventory;