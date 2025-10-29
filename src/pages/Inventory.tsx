import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Package, Grid, List, AlertTriangle, DollarSign, Image, Info, ChevronDown, X, ChevronLeft, ChevronRight } from 'lucide-react';
import * as api from '../api';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import ItemForm from '../components/ItemForm';

/**
 * Inventory Component
 * Manages and displays inventory items with filtering, adding, editing, and deletion capabilities
 * 
 * @returns {JSX.Element} The rendered inventory page
 */
const Inventory = () => {
  // State management
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [filteredItems, setFilteredItems] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [layout, setLayout] = useState<'grid' | 'list'>('list');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [expandedItemId, setExpandedItemId] = useState<number | null>(null);
  const [expandedViewId, setExpandedViewId] = useState<number | null>(null);
  const [showUpdateReasons, setShowUpdateReasons] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [galleryReceipts, setGalleryReceipts] = useState<any[]>([]);
  const [currentReceiptIndex, setCurrentReceiptIndex] = useState(0);
  const [currentReceiptDate, setCurrentReceiptDate] = useState('');
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
   * Format date to "Tuesday 16/10/2025 14:30"
   */
  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return 'None';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'None';
    return date.toLocaleString('en-GB', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  /**
   * Calculate total cost: unitPrice * quantity
   */
  const getTotalCost = (unitPrice: number | null, quantity: number) => {
    if (unitPrice !== null && unitPrice !== undefined && quantity > 0) {
      return `$${(Number(unitPrice) * quantity).toFixed(2)}`;
    }
    return 'N/A';
  };

  /**
   * SAFELY Transform raw item (snake_case) to form item (camelCase)
   */
  const transformToItem = (rawItem: any): any => {
    let receiptImages: any[] = [];

    if (rawItem.receipt_images) {
      try {
        const value = rawItem.receipt_images;

        if (typeof value === 'string' && value.trim()) {
          receiptImages = JSON.parse(value);
        } else if (Array.isArray(value)) {
          receiptImages = value;
        } else if (typeof value === 'object' && value !== null) {
          receiptImages = Object.values(value);
        }
      } catch (error) {
        console.warn(`Failed to parse receipt_images for item ID ${rawItem.id}:`, error);
        receiptImages = [];
      }
    }

    return {
      ...rawItem,
      categoryId: rawItem.category_id,
      lowStockThreshold: rawItem.low_stock_threshold,
      vendorName: rawItem.vendor_name,
      unitPrice: rawItem.unit_price,
      receiptImages,
      updateReasons: rawItem.update_reasons || '',
    };
  };

  /**
   * Load items and categories data from API with robust error handling
   */
  const loadData = async () => {
    try {
      const [itemsData, categoriesData] = await Promise.all([
        api.getItems().catch(err => {
          console.error('API Error: getItems failed', err);
          toast({
            title: "Warning",
            description: "Could not load items. Using empty list.",
            variant: "destructive"
          });
          return [];
        }),
        api.getCategories().catch(err => {
          console.error('API Error: getCategories failed', err);
          toast({
            title: "Warning",
            description: "Could not load categories. Using empty list.",
            variant: "destructive"
          });
          return [];
        })
      ]);

      console.log('Loaded items:', itemsData);
      console.log('Loaded categories:', categoriesData);

      // Safely transform items
      const transformedItems = Array.isArray(itemsData)
        ? itemsData.map(transformToItem)
        : [];

      setItems(transformedItems);
      setCategories(Array.isArray(categoriesData) ? categoriesData : []);
    } catch (error: any) {
      console.error('Unexpected error in loadData:', error);
      toast({
        title: "Error",
        description: "Failed to load inventory data: " + (error.message || "Unknown error"),
        variant: "destructive"
      });
      setItems([]);
      setCategories([]);
    }
  };

  /**
   * Filter items based on search term and selected category
   */
  const filterItems = () => {
    let filtered = [...items];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        item.name?.toLowerCase().includes(term) ||
        item.description?.toLowerCase().includes(term) ||
        item.vendorName?.toLowerCase().includes(term)
      );
    }
    if (selectedCategory) {
      filtered = filtered.filter(item => String(item.categoryId) === String(selectedCategory));
    }
    setFilteredItems(filtered);
  };

  /**
   * Handle saving an item (add or update)
   */
  const handleSaveItem = async (itemData: any, receiptFile: File | null = null, itemId: number | null = null) => {
    try {
      const formData = new FormData();
      formData.append('name', itemData.name);
      formData.append('description', itemData.description || '');
      formData.append('category_id', itemData.categoryId.toString());
      formData.append('quantity', itemData.quantity.toString());
      formData.append('low_stock_threshold', itemData.lowStockThreshold.toString());
      if (itemData.vendorName) formData.append('vendor_name', itemData.vendorName);
      if (itemData.unitPrice !== undefined && itemData.unitPrice !== null) {
        formData.append('unit_price', itemData.unitPrice.toString());
      }
      if (receiptFile) formData.append('receiptImage', receiptFile);
      if (itemId && itemData.updateReason) formData.append('update_reason', itemData.updateReason);

      if (itemId) {
        await api.updateItem(itemId, formData);
        toast({ title: "Success", description: 'Item updated successfully' });
      } else {
        await api.addItem(formData);
        toast({ title: "Success", description: 'Item added successfully' });
      }

      setShowAddForm(false);
      setExpandedItemId(null);
      loadData();
    } catch (error: any) {
      console.error('Error saving item:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save item",
        variant: "destructive"
      });
      throw error;
    }
  };

  /**
   * Handle deleting an item
   */
  const handleDeleteItem = async (itemId: number) => {
    try {
      await api.deleteItem(itemId);
      toast({ title: "Success", description: "Item deleted successfully" });
      loadData();
    } catch (error: any) {
      console.error('Error deleting item:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete item",
        variant: "destructive"
      });
    }
  };

  const confirmDeleteItem = async () => {
    if (itemToDelete) {
      await handleDeleteItem(itemToDelete.id);
      setConfirmDelete(false);
      setItemToDelete(null);
    }
  };

  /**
   * Get category name by ID
   */
  const getCategoryName = (categoryId: any) => {
    const category = categories.find(cat => String(cat.id) === String(categoryId));
    return category ? category.name : 'Unknown';
  };

  /**
   * Get CSS classes for stock status display
   */
  const getStockStatusColor = (quantity: number, lowStockThreshold = 10) => {
    if (quantity <= 0) return 'text-red-600 bg-red-50';
    if (quantity <= lowStockThreshold) return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
  };

  /**
   * Handle view receipt gallery
   */
  const handleViewReceipt = (index: number, receipts: any[], uploadDate: string) => {
    setCurrentReceiptIndex(index);
    setGalleryReceipts(receipts);
    setCurrentReceiptDate(formatDateTime(uploadDate));
    setShowReceiptModal(true);
  };

  /**
   * Item Details Content
   */
  const ItemDetails = ({ item }: { item: any }) => (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
              <Package className="h-5 w-5 mr-2 text-blue-600" />
              Basic Information
            </h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Name</dt>
                <dd className="font-medium text-gray-900">{item.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Description</dt>
                <dd className="text-gray-900">{item.description || 'N/A'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Category</dt>
                <dd className="text-gray-900">{getCategoryName(item.categoryId)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Vendor</dt>
                <dd className="text-gray-900">{item.vendorName || 'N/A'}</dd>
              </div>
            </dl>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-3">Timestamps</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Created</dt>
                <dd className="text-gray-900">{formatDateTime(item.created_at)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Last Updated</dt>
                <dd className="text-gray-900">{formatDateTime(item.updated_at)}</dd>
              </div>
            </dl>
          </div>
        </div>
        {/* Pricing and Stock */}
        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
              <DollarSign className="h-5 w-5 mr-2 text-green-600" />
              Pricing & Stock
            </h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Unit Price</dt>
                <dd className="font-medium text-gray-900">
                  {item.unitPrice !== null && item.unitPrice !== undefined
                    ? `$${Number(item.unitPrice).toFixed(2)}`
                    : 'N/A'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Total Cost</dt>
                <dd className="font-medium text-gray-900">{getTotalCost(item.unitPrice, item.quantity)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Quantity</dt>
                <dd className={`font-medium ${getStockStatusColor(item.quantity, item.lowStockThreshold).replace('bg-', 'text-')}`}>
                  {item.quantity} units
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Low Stock Threshold</dt>
                <dd className="text-gray-900">{item.lowStockThreshold}</dd>
              </div>
            </dl>
          </div>
          {item.receiptImages && item.receiptImages.length > 0 && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                <Image className="h-5 w-5 mr-2 text-purple-600" />
                Recent Receipts ({item.receiptImages.length})
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {item.receiptImages.map((receipt: any, index: number) => (
                  <button
                    key={index}
                    onClick={() => handleViewReceipt(index, item.receiptImages, receipt.uploaded_at)}
                    className="relative group"
                  >
                    <img
                      src={`${api.BASE_URL}${receipt.path}`}
                      alt={`Receipt ${index + 1}`}
                      className="w-full h-24 object-cover rounded-lg border cursor-pointer hover:opacity-80"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 rounded-lg transition-all"></div>
                    <p className="text-xs text-gray-500 text-center mt-1">
                      Uploaded on {formatDateTime(receipt.uploaded_at)}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      {item.updateReasons && item.updateReasons.trim() && (
        <div className="mt-6">
          <button
            onClick={() => setShowUpdateReasons(!showUpdateReasons)}
            className="flex items-center justify-between w-full mb-3"
          >
            <h3 className="font-semibold text-gray-900 flex items-center">
              <Edit className="h-5 w-5 mr-2 text-blue-600" />
              Recent Update History
            </h3>
            <ChevronDown className={`h-5 w-5 transition-transform ${showUpdateReasons ? 'rotate-180' : ''}`} />
          </button>
          {showUpdateReasons && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <ul className="space-y-2 text-sm">
                {item.updateReasons.split(' | ').filter(Boolean).reverse().map((reason: string, index: number) => (
                  <li key={index} className="bg-white p-3 rounded border-l-4 border-blue-500 pl-4">
                    {reason.trim()}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );

  /**
   * Receipt Gallery Modal
   */
  const ReceiptModal = () => {
    if (!showReceiptModal || galleryReceipts.length === 0) return null;
    const currentReceipt = galleryReceipts[currentReceiptIndex];
    const fullUrl = `${api.BASE_URL}${currentReceipt.path}`;
    const prevReceipt = () => setCurrentReceiptIndex((i) => (i - 1 + galleryReceipts.length) % galleryReceipts.length);
    const nextReceipt = () => setCurrentReceiptIndex((i) => (i + 1) % galleryReceipts.length);

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl p-4 max-w-4xl w-full max-h-[90vh] overflow-hidden">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">
              Receipt {currentReceiptIndex + 1} of {galleryReceipts.length} - {currentReceiptDate}
            </h3>
            <button
              onClick={() => {
                setShowReceiptModal(false);
                setGalleryReceipts([]);
                setCurrentReceiptIndex(0);
                setCurrentReceiptDate('');
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="relative flex items-center justify-center h-[60vh]">
            <button
              onClick={prevReceipt}
              disabled={galleryReceipts.length <= 1}
              className="absolute left-4 p-2 text-white hover:bg-white hover:bg-opacity-20 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <img
              src={fullUrl}
              alt="Receipt"
              className="max-w-full max-h-full object-contain rounded-lg"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <button
              onClick={nextReceipt}
              disabled={galleryReceipts.length <= 1}
              className="absolute right-4 p-2 text-white hover:bg-white hover:bg-opacity-20 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </div>
          {galleryReceipts.length > 1 && (
            <div className="flex gap-2 mt-4 overflow-x-auto p-2">
              {galleryReceipts.map((receipt: any, index: number) => (
                <button
                  key={index}
                  onClick={() => {
                    setCurrentReceiptIndex(index);
                    setCurrentReceiptDate(formatDateTime(receipt.uploaded_at));
                  }}
                  className={`flex-shrink-0 w-20 h-20 rounded border ${
                    index === currentReceiptIndex ? 'border-blue-500 ring-2 ring-blue-500' : 'border-gray-200'
                  }`}
                >
                  <img
                    src={`${api.BASE_URL}${receipt.path}`}
                    alt={`Thumbnail ${index + 1}`}
                    className="w-full h-full object-cover rounded"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
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
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-blue-600 text-white hover:bg-blue-700 flex items-center"
          >
            <Plus className="h-5 w-5 mr-2" />
            {showAddForm ? 'Cancel' : 'Add Item'}
          </Button>
        </div>
      </div>

      {/* Add Item Form */}
      {showAddForm && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-6 animate-slideDown">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Add New Item</h2>
            <button onClick={() => setShowAddForm(false)} className="text-gray-500 hover:text-gray-700">
              <X className="h-6 w-6" />
            </button>
          </div>
          <ItemForm
            categories={categories}
            onSave={handleSaveItem}
            onCancel={() => setShowAddForm(false)}
            mode="add"
          />
        </div>
      )}

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
                      setExpandedViewId(expandedViewId === item.id ? null : item.id);
                      if (expandedViewId !== item.id) setShowUpdateReasons(false);
                    }}
                    className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                    aria-label="View details"
                  >
                    <Info className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setExpandedItemId(expandedItemId === item.id ? null : item.id)}
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
              {item.description && <p className="text-sm text-gray-600 mb-3">{item.description}</p>}
              <div className="space-y-2 mb-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Category</span>
                  <span className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
                    {getCategoryName(item.categoryId)}
                  </span>
                </div>
                {item.vendorName && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Vendor</span>
                    <span className="text-sm text-gray-600">{item.vendorName}</span>
                  </div>
                )}
                {item.unitPrice != null && (
                  <div className="flex items-center justify-between">
                    <DollarSign className="h-3 w-3 text-gray-500" />
                    <span className="text-sm font-medium text-gray-900">${Number(item.unitPrice).toFixed(2)}</span>
                  </div>
                )}
                {item.unitPrice != null && item.quantity > 0 && (
                  <div className="flex items-center justify-between">
                    <DollarSign className="h-3 w-3 text-gray-500" />
                    <span className="text-sm font-medium text-gray-900">Total: {getTotalCost(item.unitPrice, item.quantity)}</span>
                  </div>
                )}
                {item.receiptImages?.length > 0 && (
                  <div className="flex items-center justify-between">
                    <Image className="h-3 w-3 text-gray-500" />
                    <span className="text-sm text-gray-600">{item.receiptImages.length} receipts</span>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Stock</span>
                <span className={`text-sm font-medium px-2 py-1 rounded-full ${getStockStatusColor(item.quantity, item.lowStockThreshold)}`}>
                  {item.quantity} units
                </span>
              </div>
              {expandedViewId === item.id && (
                <div className="mt-6 pt-6 border-t border-gray-200 bg-gray-50 rounded-b-xl animate-slideDown">
                  <ItemDetails item={item} />
                </div>
              )}
              {expandedItemId === item.id && (
                <div className="mt-4 pt-4 border-t border-gray-200 animate-slideDown">
                  <ItemForm
                    initialData={item}
                    categories={categories}
                    onSave={(data, file) => handleSaveItem(data, file, item.id)}
                    onCancel={() => setExpandedItemId(null)}
                    mode="edit"
                    isInline={true}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Cost</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Receipt</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredItems.map(item => (
                  <React.Fragment key={item.id}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Package className="h-5 w-5 text-blue-600 mr-3 flex-shrink-0" />
                          <div className="text-sm font-medium text-gray-900">{item.name}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4"><div className="text-sm text-gray-900">{item.description || 'No description'}</div></td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded-full">{getCategoryName(item.categoryId)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-900">{item.vendorName || 'N/A'}</div></td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {item.unitPrice != null ? `$${Number(item.unitPrice).toFixed(2)}` : 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{getTotalCost(item.unitPrice, item.quantity)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {item.receiptImages?.length > 0 ? (
                          <span className="text-sm text-gray-500">{item.receiptImages.length} receipts</span>
                        ) : (
                          <span className="text-sm text-gray-500">None</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-medium px-2 py-1 rounded-full ${getStockStatusColor(item.quantity, item.lowStockThreshold)}`}>
                          {item.quantity} units
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => {
                              setExpandedViewId(expandedViewId === item.id ? null : item.id);
                              if (expandedViewId !== item.id) setShowUpdateReasons(false);
                            }}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            <Info className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setExpandedItemId(expandedItemId === item.id ? null : item.id)}
                            className="text-green-600 hover:text-green-900"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => { setItemToDelete(item); setConfirmDelete(true); }}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedViewId === item.id && (
                      <tr>
                        <td colSpan={9} className="bg-gray-50 p-0">
                          <div className="p-6"><ItemDetails item={item} /></div>
                        </td>
                      </tr>
                    )}
                    {expandedItemId === item.id && (
                      <tr>
                        <td colSpan={9} className="bg-gray-50 p-0">
                          <ItemForm
                            initialData={item}
                            categories={categories}
                            onSave={(data, file) => handleSaveItem(data, file, item.id)}
                            onCancel={() => setExpandedItemId(null)}
                            mode="edit"
                            isInline={true}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ReceiptModal />

      {confirmDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <div className="flex items-start space-x-3 mb-4">
              <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-gray-700">
                Are you sure you want to delete <span className="font-medium">{itemToDelete?.name}</span>? This action cannot be undone.
              </p>
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => { setConfirmDelete(false); setItemToDelete(null); }}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmDeleteItem}>
                Delete Item
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;