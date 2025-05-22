
import React, { useState, useEffect } from 'react';
import { AlertTriangle, Package, TrendingDown } from 'lucide-react';
import * as api from '../api';

const LowStockAlerts = () => {
  const [lowStockItems, setLowStockItems] = useState([]);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [items, categoriesData] = await Promise.all([
        api.getLowStockItems(),
        api.getCategories()
      ]);
      setLowStockItems(items);
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error loading low stock data:', error);
    }
  };

  const getCategoryName = (categoryId) => {
    const category = categories.find(cat => cat.id === categoryId);
    return category ? category.name : 'Unknown';
  };

  const getStockLevel = (quantity, threshold) => {
    if (quantity <= 0) return { level: 'Out of Stock', color: 'bg-red-500' };
    if (quantity <= threshold * 0.5) return { level: 'Critical', color: 'bg-red-500' };
    if (quantity <= threshold) return { level: 'Low', color: 'bg-yellow-500' };
    return { level: 'Normal', color: 'bg-green-500' };
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Low Stock Alerts</h1>
        <p className="text-gray-600 mt-1">Items that need attention</p>
      </div>

      {/* Alert Summary */}
      <div className="bg-gradient-to-r from-red-50 to-yellow-50 border border-red-200 rounded-xl p-6 mb-6">
        <div className="flex items-center">
          <AlertTriangle className="h-8 w-8 text-red-600 mr-3" />
          <div>
            <h2 className="text-lg font-semibold text-red-900">
              {lowStockItems.length} items need attention
            </h2>
            <p className="text-red-700">
              These items are running low and may need restocking soon.
            </p>
          </div>
        </div>
      </div>

      {/* Low Stock Items */}
      <div className="space-y-4">
        {lowStockItems.map(item => {
          const stockLevel = getStockLevel(item.quantity, item.lowStockThreshold);
          
          return (
            <div key={item.id} className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Package className="h-8 w-8 text-gray-400" />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{item.name}</h3>
                    <p className="text-sm text-gray-600">{getCategoryName(item.categoryId)}</p>
                    <p className="text-sm text-gray-500 mt-1">{item.description}</p>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="flex items-center space-x-3 mb-2">
                    <div className={`w-3 h-3 rounded-full ${stockLevel.color}`}></div>
                    <span className="text-sm font-medium text-gray-900">{stockLevel.level}</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{item.quantity}</div>
                  <div className="text-sm text-gray-500">
                    Threshold: {item.lowStockThreshold}
                  </div>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="mt-4">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${stockLevel.color}`}
                    style={{ 
                      width: `${Math.min(100, (item.quantity / item.lowStockThreshold) * 100)}%` 
                    }}
                  ></div>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>0</span>
                  <span>{item.lowStockThreshold}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {lowStockItems.length === 0 && (
        <div className="text-center py-12">
          <TrendingDown className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">All items are well stocked!</h3>
          <p className="text-gray-600">No items are currently below their low stock threshold.</p>
        </div>
      )}
    </div>
  );
};

export default LowStockAlerts;
