
import React, { useState, useEffect } from 'react';
import * as api from '../api';

const ItemOutForm = ({ onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    personName: '',
    itemId: '',
    quantity: 1
  });
  const [items, setItems] = useState([]);

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      const data = await api.getItems();
      setItems(data);
    } catch (error) {
      console.error('Error loading items:', error);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const selectedItem = items.find(item => item.id === formData.itemId);
    
    if (!selectedItem) {
      alert('Please select an item');
      return;
    }

    if (formData.quantity > selectedItem.quantity) {
      alert(`Not enough stock! Only ${selectedItem.quantity} units available.`);
      return;
    }

    onSave({
      ...formData,
      itemName: selectedItem.name,
      dateTime: new Date().toISOString()
    });
  };

  const selectedItem = items.find(item => item.id === formData.itemId);

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
          onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
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
