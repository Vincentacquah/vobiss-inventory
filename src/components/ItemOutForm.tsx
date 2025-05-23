
import React, { useState, useEffect } from 'react';
import { supabase } from '../integrations/supabase/client';
import { useToast } from "@/hooks/use-toast";
import type { Database } from '../integrations/supabase/types';

/**
 * Interface representing an item in inventory
 */
interface Item {
  id: string;
  name: string;
  description?: string;
  quantity: number;
}

/**
 * Props for the ItemOutForm component
 */
interface ItemOutFormProps {
  onSave: (data: {
    personName: string;
    itemId: string;
    quantity: number;
    itemName: string;
    dateTime: string;
  }) => void;
  onCancel: () => void;
}

/**
 * Form component for checking out items from inventory
 * Allows users to select an item and specify quantity to be issued
 * 
 * @param {ItemOutFormProps} props - Component props
 * @returns {React.FC} The ItemOutForm component
 */
const ItemOutForm: React.FC<ItemOutFormProps> = ({ onSave, onCancel }) => {
  // State for form data
  const [formData, setFormData] = useState({
    personName: '',
    itemId: '',
    quantity: 1
  });
  
  // State for available items
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const { toast } = useToast();

  // Load items when component mounts
  useEffect(() => {
    loadItems();
  }, []);

  /**
   * Fetches available items from database
   * Only loads items with quantity greater than 0
   */
  const loadItems = async () => {
    try {
      setLoading(true);
      
      // Fetch items with quantity > 0
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .gt('quantity', 0);
      
      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error loading items:', error);
      toast({
        title: "Error",
        description: "Failed to load available items",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handles form submission
   * Validates input and calls onSave callback
   * 
   * @param {React.FormEvent} e - The form event
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedItem = items.find(item => item.id === formData.itemId);
    
    // Validation checks
    if (!selectedItem) {
      toast({
        title: "Error",
        description: "Please select an item",
        variant: "destructive"
      });
      return;
    }

    if (formData.quantity > selectedItem.quantity) {
      toast({
        title: "Error",
        description: `Not enough stock! Only ${selectedItem.quantity} units available.`,
        variant: "destructive"
      });
      return;
    }

    if (!formData.personName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a person name",
        variant: "destructive"
      });
      return;
    }

    // Call the onSave callback with form data
    onSave({
      ...formData,
      itemName: selectedItem.name,
      dateTime: new Date().toISOString()
    });
  };

  // Get the currently selected item
  const selectedItem = items.find(item => item.id === formData.itemId);

  // Show loading state
  if (loading) {
    return (
      <div className="py-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading available items...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Person Name Field */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Person Name *
        </label>
        <input
          type="text"
          value={formData.personName}
          onChange={(e) => setFormData({ ...formData, personName: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter person's name"
          required
        />
      </div>

      {/* Item Selection Dropdown */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Item *
        </label>
        <select
          value={formData.itemId}
          onChange={(e) => setFormData({ ...formData, itemId: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
        >
          <option value="">Select an item</option>
          {items.map(item => (
            <option key={item.id} value={item.id}>
              {item.name} (Stock: {item.quantity})
            </option>
          ))}
        </select>
      </div>

      {/* Display selected item details */}
      {selectedItem && (
        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-700">
            <strong>Available Stock:</strong> {selectedItem.quantity} units
          </p>
          <p className="text-sm text-gray-600 mt-1">{selectedItem.description}</p>
        </div>
      )}

      {/* Quantity Field */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Quantity *
        </label>
        <input
          type="number"
          value={formData.quantity}
          onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) || 1 })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          min="1"
          max={selectedItem ? selectedItem.quantity : 999}
          required
        />
      </div>

      {/* Form Buttons */}
      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Issue Item
        </button>
      </div>
    </form>
  );
};

export default ItemOutForm;
