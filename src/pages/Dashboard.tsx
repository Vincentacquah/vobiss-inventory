
import React, { useState, useEffect } from 'react';
import { Package, Tags, ArrowUpRight, AlertTriangle, TrendingUp, Users } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useNavigate } from 'react-router-dom';

/**
 * Interface for dashboard statistics
 */
interface Stats {
  totalItems: number;
  totalCategories: number;
  itemsOut: number;
  lowStockItems: number;
}

/**
 * Interface for recent activity items
 */
interface RecentActivity {
  id: string;
  personName: string;
  quantity: number;
  itemName: string;
  dateTime: string;
}

/**
 * Interface for items checked out of inventory
 */
interface ItemOut {
  id: string;
  person_name: string;
  quantity: number;
  date_time: string;
  items: {
    name: string;
  };
}

/**
 * Dashboard Component
 * Displays an overview of inventory system with key statistics and recent activity
 */
const Dashboard = () => {
  // State management
  const [stats, setStats] = useState<Stats>({
    totalItems: 0,
    totalCategories: 0,
    itemsOut: 0,
    lowStockItems: 0
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Load dashboard data on component mount and set up real-time subscriptions
  useEffect(() => {
    loadDashboardData();
    const unsubscribe = subscribeToChanges();
    return () => unsubscribe();
  }, []);

  /**
   * Loads all dashboard data from Supabase
   * Includes items, categories, items out, and recent activities
   */
  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch data from multiple tables
      const { data: items = [] } = await supabase.from('items').select('*');
      const { data: categories = [] } = await supabase.from('categories').select('*');
      const { data: itemsOut = [] } = await supabase.from('items_out').select('*');
      
      // Calculate low stock items
      const lowStock = items.filter(item => item.quantity <= item.low_stock_threshold);

      // Update statistics
      setStats({
        totalItems: items.length,
        totalCategories: categories.length,
        itemsOut: itemsOut.length,
        lowStockItems: lowStock.length
      });

      // Get recent activities with item names
      const { data: recentActivitiesData } = await supabase
        .from('items_out')
        .select('*, items:item_id(name)')
        .order('date_time', { ascending: false })
        .limit(5);

      if (recentActivitiesData) {
        // Transform data for display
        setRecentActivity(recentActivitiesData.map(activity => ({
          id: activity.id,
          personName: activity.person_name,
          quantity: activity.quantity,
          itemName: activity.items?.name || 'Unknown Item',
          dateTime: activity.date_time
        })));
      }

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Sets up real-time subscriptions to database changes
   * Automatically refreshes data when changes occur
   * @returns Function to unsubscribe from all channels
   */
  const subscribeToChanges = () => {
    // Subscribe to items table changes
    const itemsChannel = supabase
      .channel('public:items')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, () => {
        loadDashboardData();
      })
      .subscribe();

    // Subscribe to categories table changes
    const categoriesChannel = supabase
      .channel('public:categories')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => {
        loadDashboardData();
      })
      .subscribe();

    // Subscribe to items_out table changes
    const itemsOutChannel = supabase
      .channel('public:items_out')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items_out' }, () => {
        loadDashboardData();
      })
      .subscribe();

    // Return cleanup function
    return () => {
      supabase.removeChannel(itemsChannel);
      supabase.removeChannel(categoriesChannel);
      supabase.removeChannel(itemsOutChannel);
    };
  };

  /**
   * Props interface for StatCard component
   */
  interface StatCardProps {
    icon: React.ElementType;
    title: string;
    value: number;
    color: string;
    trend?: string;
  }

  /**
   * StatCard component for displaying statistics
   */
  const StatCard: React.FC<StatCardProps> = ({ icon: Icon, title, value, color, trend }) => (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
          {trend && (
            <p className="text-sm text-green-600 mt-1 flex items-center">
              <TrendingUp className="h-4 w-4 mr-1" />
              {trend}
            </p>
          )}
        </div>
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </div>
  );

  // Show loading state
  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome to your inventory management system.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          icon={Package}
          title="Total Items"
          value={stats.totalItems}
          color="bg-blue-500"
          trend="+12% from last month"
        />
        <StatCard
          icon={Tags}
          title="Categories"
          value={stats.totalCategories}
          color="bg-green-500"
        />
        <StatCard
          icon={ArrowUpRight}
          title="Items Out"
          value={stats.itemsOut}
          color="bg-purple-500"
          trend="+8% this week"
        />
        <StatCard
          icon={AlertTriangle}
          title="Low Stock"
          value={stats.lowStockItems}
          color="bg-red-500"
        />
      </div>

      {/* Recent Activity and Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity Panel */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <Users className="h-5 w-5 mr-2 text-blue-600" />
            Recent Activity
          </h2>
          <div className="space-y-4">
            {recentActivity.length > 0 ? recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-center p-3 bg-gray-50 rounded-lg border border-gray-100 hover:bg-gray-100 transition-colors">
                <Users className="h-5 w-5 text-gray-400 mr-3" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {activity.personName} took {activity.quantity} x {activity.itemName}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(activity.dateTime).toLocaleDateString()} at {new Date(activity.dateTime).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            )) : (
              <p className="text-gray-500 text-center py-4">No recent activity</p>
            )}
          </div>
        </div>

        {/* Quick Actions Panel */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <ArrowUpRight className="h-5 w-5 mr-2 text-purple-600" />
            Quick Actions
          </h2>
          <div className="space-y-4">
            <Button 
              className="w-full bg-blue-600 hover:bg-blue-700 py-6 flex items-center justify-center"
              onClick={() => navigate('/items-out')}
            >
              <ArrowUpRight className="h-5 w-5 mr-2" />
              Issue Item
            </Button>
            <Button 
              className="w-full bg-green-600 hover:bg-green-700 py-6 flex items-center justify-center"
              onClick={() => navigate('/inventory')}
            >
              <Package className="h-5 w-5 mr-2" />
              Add New Item
            </Button>
            <Button 
              className="w-full bg-purple-600 hover:bg-purple-700 py-6 flex items-center justify-center"
              onClick={() => navigate('/reports')}
            >
              <TrendingUp className="h-5 w-5 mr-2" />
              View Reports
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
