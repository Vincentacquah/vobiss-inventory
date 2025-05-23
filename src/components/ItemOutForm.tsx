
import React, { useState, useEffect } from 'react';
import { supabase } from '../integrations/supabase/client';
import { useToast } from "@/hooks/use-toast";

interface Item {
  id: string;
  name: string;
  description?: string;
  quantity: number;
}

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

const ItemOutForm: React.FC<ItemOutFormProps> = ({ onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    personName: '',
    itemId: '',
    quantity: 1
  });
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const { toast } = useToast();

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      setLoading(true);
      // Using type assertions to handle the empty database schema
      const response = await supabase
        .from('items')
        .select('*')
        .gt('quantity', 0);
      
      // Type assertions to maintain compatibility
      const data = response.data as Item[] | null;
      const error = response.error;

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedItem = items.find(item => item.id === formData.itemId);
    
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

    onSave({
      ...formData,
      itemName: selectedItem.name,
      dateTime: new Date().toISOString()
    });
  };

  const selectedItem = items.find(item => item.id === formData.itemId);

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

      {selectedItem && (
        <div className="bg-gray-50 p-3 rounded-lg">
          <p className="text-sm text-gray-700">
            <strong>Available Stock:</strong> {selectedItem.quantity} units
          </p>
          <p className="text-sm text-gray-600 mt-1">{selectedItem.description}</p>
        </div>
      )}

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
