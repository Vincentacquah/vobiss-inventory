import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Package, Image, Edit } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

interface ItemFormProps {
  initialData?: {
    name: string;
    description: string;
    categoryId: string;
    quantity: number;
    lowStockThreshold: number;
    vendorName?: string;
    unitPrice?: number;
    updateReason?: string;
  };
  categories: Array<{ id: number; name: string }>;
  onSave: (data: {
    name: string;
    description: string;
    categoryId: string;
    quantity: number;
    lowStockThreshold: number;
    vendorName?: string;
    unitPrice?: number;
    updateReason?: string;
  }, receiptFile?: File | null) => Promise<void>;
  onCancel: () => void;
  mode: 'add' | 'edit';
  isInline?: boolean;
}

const ItemForm: React.FC<ItemFormProps> = ({
  initialData,
  categories,
  onSave,
  onCancel,
  mode,
  isInline = false,
}) => {
  const { toast } = useToast();
  const isEdit = mode === 'edit';
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    description: initialData?.description || '',
    categoryId: initialData?.categoryId || '',
    quantity: initialData?.quantity?.toString() || '10',
    lowStockThreshold: initialData?.lowStockThreshold?.toString() || '5',
    vendorName: initialData?.vendorName || '',
    unitPrice: initialData?.unitPrice ? initialData.unitPrice.toString() : '',
    updateReason: initialData?.updateReason || '',
  });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast({ title: "Error", description: "Item name is required", variant: "destructive" });
      return;
    }

    if (!formData.categoryId) {
      toast({ title: "Error", description: "Please select a category", variant: "destructive" });
      return;
    }

    const qty = Number(formData.quantity);
    if (isNaN(qty) || qty < 0) {
      toast({ title: "Error", description: "Valid quantity required (non-negative)", variant: "destructive" });
      return;
    }

    const threshold = Number(formData.lowStockThreshold);
    if (isNaN(threshold) || threshold < 0) {
      toast({ title: "Error", description: "Valid low stock threshold required (non-negative)", variant: "destructive" });
      return;
    }

    if (isEdit && !formData.updateReason.trim()) {
      toast({ title: "Error", description: "Update reason required", variant: "destructive" });
      return;
    }

    const price = formData.unitPrice ? Number(formData.unitPrice) : undefined;
    if (formData.unitPrice && formData.unitPrice.trim() && (isNaN(price) || price < 0)) {
      toast({ title: "Error", description: "Valid unit price required (non-negative)", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave(
        {
          name: formData.name,
          description: formData.description,
          categoryId: formData.categoryId,
          quantity: qty,
          lowStockThreshold: threshold,
          vendorName: formData.vendorName || undefined,
          unitPrice: price,
          ...(isEdit && { updateReason: formData.updateReason }),
        },
        receiptFile
      );
    } catch (error) {
      console.error('Error in form submit:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = isInline 
    ? "w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
    : "w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent";

  return (
    <form onSubmit={handleSubmit} className={isInline ? "space-y-4 p-4 bg-gray-50 rounded-lg" : "space-y-6"}>
      {!isInline && (
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {isEdit ? 'Edit Item' : 'Add New Item'}
          </h2>
          <p className="text-gray-600 mt-1">
            {isEdit ? 'Update the item details below.' : 'Fill in the details to add a new item.'}
          </p>
        </div>
      )}

      {/* Basic Information Section */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
          <Package className="h-5 w-5 mr-2 text-blue-600" />
          Basic Information
        </h3>
        <div className={isInline ? "grid grid-cols-1 md:grid-cols-2 gap-4" : "grid grid-cols-1 md:grid-cols-2 gap-6"}>
          <div className="space-y-1">
            <Label htmlFor="name" className="text-sm font-medium text-gray-700">Item Name *</Label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={inputClass}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="category" className="text-sm font-medium text-gray-700">Category *</Label>
            <select
              id="category"
              value={formData.categoryId}
              onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
              className={inputClass}
              required
            >
              <option value="">Select Category</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="quantity" className="text-sm font-medium text-gray-700">Quantity *</Label>
            <input
              id="quantity"
              type="number"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              className={inputClass}
              min="0"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="threshold" className="text-sm font-medium text-gray-700">Low Stock Threshold *</Label>
            <input
              id="threshold"
              type="number"
              value={formData.lowStockThreshold}
              onChange={(e) => setFormData({ ...formData, lowStockThreshold: e.target.value })}
              className={inputClass}
              min="0"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="vendor" className="text-sm font-medium text-gray-700">Vendor Name</Label>
            <input
              id="vendor"
              type="text"
              value={formData.vendorName}
              onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="price" className="text-sm font-medium text-gray-700">Unit Price</Label>
            <input
              id="price"
              type="number"
              value={formData.unitPrice}
              onChange={(e) => setFormData({ ...formData, unitPrice: e.target.value })}
              className={inputClass}
              min="0"
              step="0.01"
              placeholder="0.00"
            />
          </div>
        </div>
      </div>

      {/* Additional Information Section */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
          <Image className="h-5 w-5 mr-2 text-purple-600" />
          Additional Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1">
            <Label htmlFor="receipt" className="text-sm font-medium text-gray-700">Receipt Image</Label>
            <input
              id="receipt"
              type="file"
              accept="image/*"
              onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
              className={`${inputClass} file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100`}
            />
          </div>
          <div className="space-y-1 md:col-span-1">
            <Label htmlFor="description" className="text-sm font-medium text-gray-700">Description</Label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className={`${inputClass} col-span-2 resize-none`}
              rows={3}
              placeholder="Enter item description..."
            />
          </div>
        </div>
      </div>

      {/* Edit Specific Section */}
      {isEdit && (
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
            <Edit className="h-5 w-5 mr-2 text-green-600" />
            Update Details
          </h3>
          <div className="space-y-1">
            <Label htmlFor="updateReason" className="text-sm font-medium text-gray-700">Update Reason *</Label>
            <textarea
              id="updateReason"
              value={formData.updateReason}
              onChange={(e) => setFormData({ ...formData, updateReason: e.target.value })}
              className={`${inputClass} col-span-2 resize-none`}
              rows={2}
              placeholder="Enter reason for this update..."
              required
            />
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 pt-4">
        <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white flex-1 sm:flex-none">
          {isSubmitting ? 'Saving...' : (isEdit ? 'Update Item' : 'Add Item')}
        </Button>
        <Button type="button" onClick={onCancel} variant="outline" disabled={isSubmitting} className="flex-1 sm:flex-none">
          Cancel
        </Button>
      </div>
    </form>
  );
};

export default ItemForm;