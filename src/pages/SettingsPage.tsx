// SettingsPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, RefreshCw, AlertCircle } from 'lucide-react';
import { getSettings, updateSetting } from '../api';
import { useAuth } from '../context/AuthContext';

const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<{ [key: string]: string }>({});
  const [allSettings, setAllSettings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!user || user.role !== 'superadmin') {
      navigate('/');
      return;
    }
    fetchSettings();
  }, [navigate, user]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const data = await getSettings();
      setSettings(data);
      setAllSettings(data.all || []);
    } catch (err) {
      setError('Failed to fetch settings');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSetting = async (key: string, value: string) => {
    try {
      setSaving(true);
      setError(null);
      const updated = await updateSetting(key, value);
      setSettings(prev => ({ ...prev, [key]: updated.value }));
      setAllSettings(prev => prev.map(s => s.key_name === key ? { ...s, value: updated.value } : s));
      setSuccess('Setting updated successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update setting');
    } finally {
      setSaving(false);
    }
  };

  const emailSettings = [
    { key: 'from_name', label: 'Sender Name', type: 'text', description: 'The display name for the sender in low stock alert emails' },
    { key: 'from_email', label: 'Sender Email', type: 'email', description: 'The email address for the sender in low stock alert emails' },
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Email Settings</h1>
        <button
          onClick={fetchSettings}
          disabled={loading}
          className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center">
          <AlertCircle className="h-5 w-5 mr-2" />
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
          {success}
        </div>
      )}

      <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Low Stock Alert Configuration</h2>
        <p className="text-gray-600 mb-6">Configure the sender details for automated low stock alert emails. SMTP server settings are configured via environment variables for security.</p>
        
        <div className="space-y-6">
          {emailSettings.map((setting) => (
            <div key={setting.key} className="border-b pb-4 last:border-b-0">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {setting.label}
                <p className="text-xs text-gray-500 mt-1">{setting.description}</p>
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type={setting.type}
                  value={settings[setting.key] || ''}
                  onChange={(e) => setSettings(prev => ({ ...prev, [setting.key]: e.target.value }))}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={`Enter ${setting.label.toLowerCase()}`}
                />
                <button
                  onClick={() => handleUpdateSetting(setting.key, settings[setting.key] || '')}
                  disabled={saving || !settings[setting.key]?.trim()}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="font-medium text-yellow-800 mb-2">Note on SMTP Configuration</h3>
          <p className="text-sm text-yellow-700">
            For sending emails, ensure SMTP settings are configured in your <code className="bg-yellow-100 px-1 rounded">.env</code> file:
            <br />
            <code>SMTP_HOST=smtp.gmail.com</code><br />
            <code>SMTP_PORT=587</code><br />
            <code>SMTP_USER=your-email@gmail.com</code><br />
            <code>SMTP_PASS=your-app-password</code><br />
            <code>SMTP_SECURE=false</code>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;