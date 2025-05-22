
import React, { useState } from 'react';
import { Settings as SettingsIcon, Save, User, Bell, Shield, Database } from 'lucide-react';

const Settings = () => {
  const [settings, setSettings] = useState({
    companyName: 'Vobiss Store',
    adminEmail: 'admin@vobiss.com',
    lowStockThreshold: 10,
    enableNotifications: true,
    enableEmailAlerts: true,
    autoBackup: true,
    backupFrequency: 'daily'
  });

  const handleSave = () => {
    // Save settings logic
    console.log('Saving settings:', settings);
    alert('Settings saved successfully!');
  };

  const SettingSection = ({ icon: Icon, title, children }) => (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
      <div className="flex items-center mb-4">
        <Icon className="h-6 w-6 text-gray-600 mr-3" />
        <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
      </div>
      {children}
    </div>
  );

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">Manage your inventory system preferences</p>
      </div>

      <div className="space-y-6">
        {/* Company Settings */}
        <SettingSection icon={User} title="Company Information">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company Name
              </label>
              <input
                type="text"
                value={settings.companyName}
                onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Admin Email
              </label>
              <input
                type="email"
                value={settings.adminEmail}
                onChange={(e) => setSettings({ ...settings, adminEmail: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </SettingSection>

        {/* Inventory Settings */}
        <SettingSection icon={SettingsIcon} title="Inventory Preferences">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default Low Stock Threshold
              </label>
              <input
                type="number"
                value={settings.lowStockThreshold}
                onChange={(e) => setSettings({ ...settings, lowStockThreshold: parseInt(e.target.value) })}
                className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                min="0"
              />
              <p className="text-sm text-gray-600 mt-1">
                Items below this quantity will trigger low stock alerts
              </p>
            </div>
          </div>
        </SettingSection>

        {/* Notification Settings */}
        <SettingSection icon={Bell} title="Notifications">
          <div className="space-y-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.enableNotifications}
                onChange={(e) => setSettings({ ...settings, enableNotifications: e.target.checked })}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="ml-3 text-sm text-gray-700">Enable browser notifications</span>
            </label>
            
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.enableEmailAlerts}
                onChange={(e) => setSettings({ ...settings, enableEmailAlerts: e.target.checked })}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="ml-3 text-sm text-gray-700">Enable email alerts for low stock</span>
            </label>
          </div>
        </SettingSection>

        {/* Backup Settings */}
        <SettingSection icon={Database} title="Data Backup">
          <div className="space-y-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.autoBackup}
                onChange={(e) => setSettings({ ...settings, autoBackup: e.target.checked })}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="ml-3 text-sm text-gray-700">Enable automatic backups</span>
            </label>
            
            {settings.autoBackup && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Backup Frequency
                </label>
                <select
                  value={settings.backupFrequency}
                  onChange={(e) => setSettings({ ...settings, backupFrequency: e.target.value })}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            )}
          </div>
        </SettingSection>

        {/* Security Settings */}
        <SettingSection icon={Shield} title="Security">
          <div className="space-y-4">
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              Change Password
            </button>
            <div>
              <button className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors">
                Export All Data
              </button>
              <p className="text-sm text-gray-600 mt-1">
                Download a complete backup of your inventory data
              </p>
            </div>
          </div>
        </SettingSection>
      </div>

      {/* Save Button */}
      <div className="mt-8 flex justify-end">
        <button
          onClick={handleSave}
          className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center"
        >
          <Save className="h-5 w-5 mr-2" />
          Save Settings
        </button>
      </div>
    </div>
  );
};

export default Settings;
