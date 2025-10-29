import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Save,
  RefreshCw,
  AlertCircle,
  Download,
  Upload,
  Trash2,
  Lock,
  Mail,
  Database
} from 'lucide-react';
import { getSettings, updateSetting } from '../api';
import { useAuth } from '../context/AuthContext';

const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  const [settings, setSettings] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [wipeCode, setWipeCode] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [restoreCode, setRestoreCode] = useState('');

  useEffect(() => {
    if (!user || user.role !== 'superadmin') {
      navigate('/');
      return;
    }
    if (!token) {
      navigate('/login');
      return;
    }
    fetchSettings();
  }, [navigate, user, token]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const data = await getSettings();
      setSettings(data);
    } catch {
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
      setSuccess('Setting updated successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update setting');
    } finally {
      setSaving(false);
    }
  };

  const handleBackup = async () => {
    if (!backupCode.trim()) return setError('Developer code required for backup');
    try {
      const res = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ developerCode: backupCode })
      });
      if (!res.ok) throw new Error('Failed to create backup');
      const backup = await res.json();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `inventory-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      setSuccess('Backup created successfully');
      setBackupCode('');
    } catch (err: any) {
      setError(err.message || 'Backup failed');
    }
  };

  const handleRestore = async () => {
    if (!restoreFile || !restoreCode.trim()) return setError('Backup file and developer code required');
    try {
      const text = await restoreFile.text();
      const res = await fetch('/api/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ backup: text, developerCode: restoreCode })
      });
      if (!res.ok) throw new Error('Failed to restore database');
      setSuccess('Database restored successfully');
      setRestoreFile(null);
      setRestoreCode('');
    } catch (err: any) {
      setError(err.message || 'Restore failed');
    }
  };

  const handleWipe = async () => {
    if (!wipeCode.trim()) return;
    if (!confirm('This will permanently delete ALL data. Proceed?')) return;
    try {
      const res = await fetch('/api/wipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ developerCode: wipeCode })
      });
      if (!res.ok) throw new Error('Failed to wipe database');
      setSuccess('Database wiped successfully');
      setWipeCode('');
    } catch (err: any) {
      setError(err.message || 'Wipe failed');
    }
  };

  const emailSettings = [
    { key: 'from_name', label: 'Sender Name', type: 'text', desc: 'Display name for sender in low stock alert emails.' },
    { key: 'from_email', label: 'Sender Email', type: 'email', desc: 'Email address for low stock alert sender.' },
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800">System Settings</h1>
        <button
          onClick={fetchSettings}
          disabled={loading}
          className="flex items-center px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-800"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center">
          <AlertCircle className="h-5 w-5 mr-2" /> {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Email Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition">
          <div className="flex items-center mb-4">
            <Mail className="text-blue-600 h-5 w-5 mr-2" />
            <h2 className="text-lg font-semibold text-gray-800">Email Settings</h2>
          </div>
          <p className="text-gray-600 mb-6 text-sm">Configure the details for automated alert emails.</p>

          {emailSettings.map(s => (
            <div key={s.key} className="mb-4">
              <label className="text-sm font-medium text-gray-700">{s.label}</label>
              <input
                type={s.type}
                value={settings[s.key] || ''}
                onChange={e => setSettings(prev => ({ ...prev, [s.key]: e.target.value }))}
                placeholder={s.label}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">{s.desc}</p>
              <button
                onClick={() => handleUpdateSetting(s.key, settings[s.key] || '')}
                className="mt-2 flex items-center bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1.5 rounded-md"
              >
                <Save className="h-4 w-4 mr-1" /> Save
              </button>
            </div>
          ))}
        </div>

        {/* Database Management */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition">
          <div className="flex items-center mb-4">
            <Database className="text-green-600 h-5 w-5 mr-2" />
            <h2 className="text-lg font-semibold text-gray-800">Database Management</h2>
          </div>
          <p className="text-gray-600 mb-6 text-sm">Backup, restore, or wipe your database (requires developer code).</p>

          <div className="space-y-5">
            {/* Backup */}
            <div className="p-4 rounded-lg bg-green-50 border border-green-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">Backup Code</label>
              <div className="flex space-x-2">
                <input
                  type="password"
                  value={backupCode}
                  onChange={e => setBackupCode(e.target.value)}
                  placeholder="Enter developer code"
                  className="flex-1 px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500"
                />
                <button
                  onClick={handleBackup}
                  className="flex items-center bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-md"
                >
                  <Download className="h-4 w-4 mr-1" /> Backup
                </button>
              </div>
            </div>

            {/* Restore */}
            <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">Restore Code & File</label>
              <div className="flex space-x-2">
                <input
                  type="file"
                  accept=".json"
                  onChange={e => setRestoreFile(e.target.files ? e.target.files[0] : null)}
                  className="w-1/2 px-3 py-2 border rounded-md"
                />
                <input
                  type="password"
                  value={restoreCode}
                  onChange={e => setRestoreCode(e.target.value)}
                  placeholder="Developer code"
                  className="flex-1 px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleRestore}
                  className="flex items-center bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md"
                >
                  <Upload className="h-4 w-4 mr-1" /> Restore
                </button>
              </div>
            </div>

            {/* Wipe */}
            <div className="p-4 rounded-lg bg-red-50 border border-red-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">Wipe Database</label>
              <div className="flex space-x-2">
                <input
                  type="password"
                  value={wipeCode}
                  onChange={e => setWipeCode(e.target.value)}
                  placeholder="Developer code"
                  className="flex-1 px-3 py-2 border rounded-md focus:ring-2 focus:ring-red-500"
                />
                <button
                  onClick={handleWipe}
                  className="flex items-center bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-md"
                >
                  <Trash2 className="h-4 w-4 mr-1" /> Wipe
                </button>
              </div>
              <p className="text-xs text-red-700 mt-2">⚠️ This will permanently delete all data. Backup first.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
