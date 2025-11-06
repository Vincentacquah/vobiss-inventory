import React, { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Plus } from 'lucide-react';

interface Subcategory {
  id?: string;
  name: string;
  description: string;
}

interface CategoryFormProps {
  category?: {
    id?: string;
    name: string;
    description: string;
    subcategories: Subcategory[];
  } | null;
  onSave: (data: { name: string; description: string; subcategories: Subcategory[] }) => void;
  onCancel: () => void;
}

const CategoryForm: React.FC<CategoryFormProps> = ({ category, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    subcategories: [] as Subcategory[]
  });
  const { toast } = useToast();

  useEffect(() => {
    if (category) {
      setFormData({
        name: category.name || '',
        description: category.description || '',
        subcategories: category.subcategories || []
      });
    } else {
      setFormData({
        name: '',
        description: '',
        subcategories: []
      });
    }
  }, [category]);

  const handleMainChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubChange = (index: number, field: string, value: string) => {
    const newSubs = [...formData.subcategories];
    newSubs[index] = { ...newSubs[index], [field]: value };
    setFormData(prev => ({ ...prev, subcategories: newSubs }));
  };

  const addSubcategory = () => {
    setFormData(prev => ({
      ...prev,
      subcategories: [...prev.subcategories, { name: '', description: '' }]
    }));
  };

  const removeSubcategory = (index: number) => {
    const newSubs = formData.subcategories.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, subcategories: newSubs }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Main category name is required",
        variant: "destructive"
      });
      return;
    }
    // Validate subs
    for (const sub of formData.subcategories) {
      if (!sub.name.trim()) {
        toast({
          title: "Error",
          description: "Subcategory names are required",
          variant: "destructive"
        });
        return;
      }
    }
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Main Category Name *
        </label>
        <Input
          type="text"
          value={formData.name}
          onChange={(e) => handleMainChange('name', e.target.value)}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Main Category Description
        </label>
        <Textarea
          value={formData.description}
          onChange={(e) => handleMainChange('description', e.target.value)}
          rows={3}
        />
      </div>

      <div>
        <div className="flex justify-between items-center mb-3">
          <label className="block text-sm font-medium text-gray-700">
            Subcategories
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addSubcategory}
            className="flex items-center"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Subcategory
          </Button>
        </div>
        {formData.subcategories.map((sub, index) => (
          <div key={index} className="border border-gray-200 rounded-lg p-4 mb-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subcategory Name *
              </label>
              <Input
                type="text"
                value={sub.name}
                onChange={(e) => handleSubChange(index, 'name', e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subcategory Description
              </label>
              <Textarea
                value={sub.description}
                onChange={(e) => handleSubChange(index, 'description', e.target.value)}
                rows={2}
              />
            </div>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => removeSubcategory(index)}
              className="flex items-center"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Remove
            </Button>
          </div>
        ))}
        {formData.subcategories.length === 0 && (
          <p className="text-sm text-gray-500">No subcategories added yet.</p>
        )}
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="submit"
        >
          {category ? 'Update' : 'Add'} Category
        </Button>
      </div>
    </form>
  );
};

export default CategoryForm;