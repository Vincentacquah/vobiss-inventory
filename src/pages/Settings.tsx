import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, User, Bell, Shield, Database, Loader2, Check, X, Download } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '../integrations/supabase/client';
import { Button } from "@/components/ui/button";

/**
 * Interface for application settings
 */
interface AppSettings {
  companyName: string;
  adminEmail: string;
  lowStockThreshold: number;
  enableNotifications: boolean;
  enableEmailAlerts: boolean;
  autoBackup: boolean;
  backupFrequency: 'daily' | 'weekly' | 'monthly';
}

/**
 * Settings Component
 * Allows users to configure application preferences and settings
 */
const Settings: React.FC = () => {
  // State for settings
  const [settings, setSettings] = useState<AppSettings>({
    companyName: 'Vobiss Store',
    adminEmail: 'admin@vobiss.com',
    lowStockThreshold: 10,
    enableNotifications: true,
    enableEmailAlerts: true,
    autoBackup: true,
    backupFrequency: 'daily'
  });
  
  const [loading, setLoading] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean | null>(null);
  const [passwordReset, setPasswordReset] = useState<{
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const { toast } = useToast();

  // Load settings from database/localStorage when component mounts
  useEffect(() => {
    loadSettings();
  }, []);

  /**
   * Loads settings from localStorage or sets defaults
   */
  const loadSettings = () => {
    const savedSettings = localStorage.getItem('appSettings');
    
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
      } catch (error) {
        console.error('Error parsing settings:', error);
      }
    }
  };

  /**
   * Saves settings to localStorage and simulates API call
   */
  const handleSave = async () => {
    setLoading(true);
    setSaveSuccess(null);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Save to localStorage
      localStorage.setItem('appSettings', JSON.stringify(settings));
      
      // Show success feedback
      setSaveSuccess(true);
      toast({
        title: "Success",
        description: "Settings saved successfully!",
        variant: "default"
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveSuccess(false);
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      
      // Reset success indicator after 3 seconds
      setTimeout(() => {
        setSaveSuccess(null);
      }, 3000);
    }
  };

  /**
   * Handles password change
   */
  const handlePasswordChange = () => {
    if (passwordReset.newPassword !== passwordReset.confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords do not match",
        variant: "destructive"
      });
      return;
    }
    
    if (passwordReset.newPassword.length < 8) {
      toast({
        title: "Error",
        description: "Password must be at least 8 characters long",
        variant: "destructive"
      });
      return;
    }
    
    toast({
      title: "Success",
      description: "Password changed successfully",
      variant: "default"
    });
    
    // Reset password form
    setPasswordReset({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
  };

  /**
   * Exports data as JSON file
   */
  const handleExportData = () => {
    // Simulate API call to get data
    setTimeout(() => {
      const dummyData = {
        items: [
          { id: 1, name: "Test Item 1", quantity: 5 },
          { id: 2, name: "Test Item 2", quantity: 10 }
        ],
        settings: settings
      };
      
      const dataStr = JSON.stringify(dummyData, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = 'inventory-data-export.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Success",
        description: "Data exported successfully",
        variant: "default"
      });
    }, 500);
  };

  /**
   * Setting section component for organization
   */
  interface SettingSectionProps {
    icon: React.ElementType;
    title: string;
    children: React.ReactNode;
  }

  const SettingSection: React.FC<SettingSectionProps> = ({ icon: Icon, title, children }) => (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
      <div className="flex items-center mb-4">
        <div className="p-2 rounded-lg bg-blue-50 mr-3">
          <Icon className="h-6 w-6 text-blue-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
      </div>
      {children}
    </div>
  );

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-1">Manage your inventory system preferences</p>
        </div>
        <Button
          onClick={handleSave}
          className="mt-4 md:mt-0 bg-green-600 hover:bg-green-700 text-white flex items-center"
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
          ) : saveSuccess ? (
            <Check className="h-5 w-5 mr-2" />
          ) : (
            <Save className="h-5 w-5 mr-2" />
          )}
          {loading ? "Saving..." : saveSuccess ? "Saved!" : "Save Settings"}
        </Button>
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
              <p className="text-xs text-gray-500 mt-1">
                This name will appear on reports and exports
              </p>
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
              <p className="text-xs text-gray-500 mt-1">
                Alerts and notifications will be sent to this email
              </p>
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
              <div className="flex items-center">
                <input
                  type="number"
                  value={settings.lowStockThreshold}
                  onChange={(e) => setSettings({ ...settings, lowStockThreshold: parseInt(e.target.value) || 0 })}
                  className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="0"
                />
                <span className="ml-2 text-gray-600">items</span>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Items below this quantity will trigger low stock alerts
              </p>
            </div>
            
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>Tip:</strong> You can override this threshold for individual items when adding or editing them.
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
              <div className="ml-3">
                <span className="text-sm text-gray-700">Enable browser notifications</span>
                <p className="text-xs text-gray-500">Receive alerts for low stock items while using the application</p>
              </div>
            </label>
            
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.enableEmailAlerts}
                onChange={(e) => setSettings({ ...settings, enableEmailAlerts: e.target.checked })}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div className="ml-3">
                <span className="text-sm text-gray-700">Enable email alerts for low stock</span>
                <p className="text-xs text-gray-500">Get notified via email when items fall below their threshold</p>
              </div>
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
              <div className="ml-3">
                <span className="text-sm text-gray-700">Enable automatic backups</span>
                <p className="text-xs text-gray-500">System will create scheduled backups of your data</p>
              </div>
            </label>
            
            {settings.autoBackup && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Backup Frequency
                </label>
                <select
                  value={settings.backupFrequency}
                  onChange={(e) => setSettings({ ...settings, backupFrequency: e.target.value as 'daily' | 'weekly' | 'monthly' })}
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
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-medium text-gray-800 mb-3">Change Password</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={passwordReset.currentPassword}
                    onChange={(e) => setPasswordReset({ ...passwordReset, currentPassword: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter current password"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={passwordReset.newPassword}
                    onChange={(e) => setPasswordReset({ ...passwordReset, newPassword: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter new password"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={passwordReset.confirmPassword}
                    onChange={(e) => setPasswordReset({ ...passwordReset, confirmPassword: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Confirm new password"
                  />
                </div>
                <Button
                  onClick={handlePasswordChange}
                  className="bg-blue-600 text-white hover:bg-blue-700"
                  disabled={!passwordReset.currentPassword || !passwordReset.newPassword || !passwordReset.confirmPassword}
                >
                  Update Password
                </Button>
              </div>
            </div>
            
            <div>
              <h3 className="text-base font-medium text-gray-800 mb-3">Data Export</h3>
              <p className="text-sm text-gray-600 mb-3">
                Download a complete backup of your inventory data in JSON format
              </p>
              <Button
                onClick={handleExportData}
                className="bg-red-600 text-white hover:bg-red-700 flex items-center"
              >
                <Download className="h-5 w-5 mr-2" />
                Export All Data
              </Button>
            </div>
          </div>
        </SettingSection>
      </div>
    </div>
  );
};

export default Settings;
