
import React, { useState, useEffect } from 'react';
import { Package, Tags, ArrowUpRight, AlertTriangle, TrendingUp, Users } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useNavigate } from 'react-router-dom';

interface Stats {
  totalItems: number;
  totalCategories: number;
  itemsOut: number;
  lowStockItems: number;
}

interface RecentActivity {
  id: string;
  personName: string;
  quantity: number;
  itemName: string;
  dateTime: string;
}

interface ItemOut {
  id: string;
  person_name: string;
  quantity: number;
  date_time: string;
  items: {
    name: string;
  };
}

const Dashboard = () => {
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

  useEffect(() => {
    loadDashboardData();
    subscribeToChanges();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Using typecasting to avoid TypeScript errors
      const [itemsResponse, categoriesResponse, itemsOutResponse] = await Promise.all([
        supabase.from('items').select('*') as Promise<{ data: any[] | null; error: any }>,
        supabase.from('categories').select('*') as Promise<{ data: any[] | null; error: any }>,
        supabase.from('items_out').select('*') as Promise<{ data: any[] | null; error: any }>
      ]);

      const items = itemsResponse.data || [];
      const categories = categoriesResponse.data || [];
      const itemsOut = itemsOutResponse.data || [];
      
      const lowStock = items.filter(item => item.quantity <= item.low_stock_threshold);

      setStats({
        totalItems: items.length,
        totalCategories: categories.length,
        itemsOut: itemsOut.length,
        lowStockItems: lowStock.length
      });

      // Get recent activities with item names
      const recentActivities = await supabase
        .from('items_out')
        .select('*, items:item_id(name)')
        .order('date_time', { ascending: false })
        .limit(5) as { data: ItemOut[] | null; error: any };

      if (recentActivities.data) {
        setRecentActivity(recentActivities.data.map(activity => ({
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

  const subscribeToChanges = () => {
    const itemsChannel = supabase
      .channel('public:items')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, () => {
        loadDashboardData();
      })
      .subscribe();

    const categoriesChannel = supabase
      .channel('public:categories')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => {
        loadDashboardData();
      })
      .subscribe();

    const itemsOutChannel = supabase
      .channel('public:items_out')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items_out' }, () => {
        loadDashboardData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(itemsChannel);
      supabase.removeChannel(categoriesChannel);
      supabase.removeChannel(itemsOutChannel);
    };
  };

  interface StatCardProps {
    icon: React.ElementType;
    title: string;
    value: number;
    color: string;
    trend?: string;
  }

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

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Activity</h2>
          <div className="space-y-4">
            {recentActivity.length > 0 ? recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-center p-3 bg-gray-50 rounded-lg">
                <Users className="h-5 w-5 text-gray-400 mr-3" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {activity.personName} took {activity.quantity} x {activity.itemName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(activity.dateTime).toLocaleDateString()}
                  </p>
                </div>
              </div>
            )) : (
              <p className="text-gray-500 text-center py-4">No recent activity</p>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <Button 
              className="w-full bg-blue-600 hover:bg-blue-700"
              onClick={() => navigate('/items-out')}
            >
              Issue Item
            </Button>
            <Button 
              className="w-full bg-green-600 hover:bg-green-700"
              onClick={() => navigate('/inventory')}
            >
              Add New Item
            </Button>
            <Button 
              className="w-full bg-purple-600 hover:bg-purple-700"
              onClick={() => navigate('/reports')}
            >
              View Reports
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
