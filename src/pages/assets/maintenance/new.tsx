// src/pages/assets/maintenance/new.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function NewMaintenancePage() {
  const navigate = useNavigate();
  const [assets, setAssets] = useState<any[]>([]);
  const [people, setPeople] = useState<any[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    asset_id: '',
    type: 'repair',
    description: '',
    technician_id: '',
    cost: '',
    notes: '',
    start_date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    const savedAssets = localStorage.getItem('assets');
    if (savedAssets) setAssets(JSON.parse(savedAssets));

    const savedPeople = localStorage.getItem('people');
    if (savedPeople) setPeople(JSON.parse(savedPeople));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotos(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const asset = assets.find(a => a.id === formData.asset_id);
    const technician = people.find(p => p.id === formData.technician_id);

    if (!asset) return;

    const records = JSON.parse(localStorage.getItem('maintenance') || '[]');
    const newRecord = {
      id: Date.now().toString(),
      asset_id: asset.id,
      asset_name: asset.name,
      asset_tag: asset.tag,
      type: formData.type,
      description: formData.description,
      status: 'pending',
      technician: technician ? `${technician.first_name} ${technician.last_name}` : undefined,
      technician_id: formData.technician_id || undefined,
      cost: formData.cost ? Number(formData.cost) : undefined,
      start_date: formData.start_date,
      notes: formData.notes || undefined,
      photos,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    records.push(newRecord);
    localStorage.setItem('maintenance', JSON.stringify(records));

    // Update asset to in_repair
    const updatedAssets = assets.map(a =>
      a.id === formData.asset_id
        ? { ...a, status: 'in_repair', assigned_to: '' }
        : a
    );
    localStorage.setItem('assets', JSON.stringify(updatedAssets));

    navigate('/assets/maintenance');
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-6">
        <div className="flex items-center justify-between mb-10">
          <h1 className="text-3xl font-bold text-gray-900">Log New Maintenance</h1>
          <button onClick={() => navigate('/assets/maintenance')} className="text-gray-600 hover:text-gray-900 text-lg">
            ← Back
          </button>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 space-y-10">
          {/* Asset Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Select Asset *</label>
            <select
              name="asset_id"
              required
              value={formData.asset_id}
              onChange={handleChange}
              className="w-full px-5 py-4 border border-gray-300 rounded-xl text-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Choose asset...</option>
              {assets
                .filter(a => a.status !== 'in_repair' && a.status !== 'damaged' && a.status !== 'assigned')
                .map(asset => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name} (#{asset.tag}) — {asset.category}
                  </option>
                ))}
            </select>
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Type of Maintenance *</label>
            <select name="type" value={formData.type} onChange={handleChange} className="w-full px-5 py-4 border border-gray-300 rounded-xl text-lg">
              <option value="repair">Repair</option>
              <option value="service">Routine Service</option>
              <option value="inspection">Inspection</option>
              <option value="upgrade">Upgrade</option>
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Description / Issue *</label>
            <textarea
              name="description"
              required
              rows={5}
              value={formData.description}
              onChange={handleChange}
              placeholder="Describe the problem or service needed..."
              className="w-full px-5 py-4 border border-gray-300 rounded-xl resize-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Technician from People */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Assigned Technician</label>
            <select
              name="technician_id"
              value={formData.technician_id}
              onChange={handleChange}
              className="w-full px-5 py-4 border border-gray-300 rounded-xl text-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">No technician assigned</option>
              {people.map(person => (
                <option key={person.id} value={person.id}>
                  {person.first_name} {person.last_name} ({person.job_title || 'Staff'})
                </option>
              ))}
            </select>
          </div>

          {/* Cost */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Estimated Cost (₱)</label>
            <input
              type="number"
              name="cost"
              value={formData.cost}
              onChange={handleChange}
              placeholder="0.00"
              className="w-full px-5 py-4 border border-gray-300 rounded-xl text-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Photos */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Photos (optional)</label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {photos.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 mt-6">
                {photos.map((p, i) => (
                  <img key={i} src={p} className="h-32 object-cover rounded-xl shadow-sm" alt={`Upload ${i + 1}`} />
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Notes / Findings</label>
            <textarea
              name="notes"
              rows={4}
              value={formData.notes}
              onChange={handleChange}
              placeholder="Additional observations, parts needed, etc."
              className="w-full px-5 py-4 border border-gray-300 rounded-xl resize-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-4 pt-6">
            <button type="button" onClick={() => navigate('/assets/maintenance')} className="px-6 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 font-medium">
              Cancel
            </button>
            <button type="submit" className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-xl hover:from-blue-700 hover:to-indigo-800 font-bold shadow-md transition">
              Create Maintenance Record
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}