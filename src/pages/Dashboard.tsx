import React, { useState, useEffect } from 'react';
import { Package, Tags, ArrowUpRight, AlertTriangle, TrendingUp, Users, BarChart3, Sparkles } from 'lucide-react';
import { getItems, getCategories, getItemsOut, getDashboardStats } from '../api';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useNavigate } from 'react-router-dom';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';

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
 * Interface for items
 */
interface Item {
  id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  quantity: number;
  low_stock_threshold: number;
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
  item_id: string;
  quantity: number;
  date_time: string;
  item_name: string;
}

/**
 * Dashboard Component
 * Displays an overview of inventory system with key statistics, recent activity, stock overview chart, and quick actions
 */
const Dashboard = () => {
  // State management
  const [stats, setStats] = useState<Stats>({
    totalItems: 0,
    totalCategories: 0,
    itemsOut: 0,
    lowStockItems: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Chart.js registration
  ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

  // Load dashboard data on component mount and set up periodic refresh
  useEffect(() => {
    loadDashboardData();
    // Refresh data every 30 seconds (adjust as needed)
    const interval = setInterval(loadDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  /**
   * Loads all dashboard data from API
   * Includes items, categories, items out, and recent activities
   */
  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch data from API
      const [items, categories, itemsOut] = await Promise.all([getItems(), getCategories(), getItemsOut()]);
      const statsData = await getDashboardStats();

      // Calculate low stock items
      const lowStock = items.filter((item) => item.quantity <= (item.low_stock_threshold || 0));
      const totalStocks = items.reduce((sum, item) => sum + item.quantity, 0);

      setStats({
        totalItems: statsData.totalItems || items.length,
        totalCategories: statsData.totalCategories || categories.length,
        itemsOut: statsData.itemsOut || itemsOut.length,
        lowStockItems: statsData.lowStockItems || lowStock.length,
      });
      setAllItems(items);

      // Get recent activities with item names
      const recentActivitiesData = itemsOut
        .slice(0, 5)
        .sort((a, b) => new Date(b.date_time).getTime() - new Date(a.date_time).getTime())
        .map((activity) => ({
          id: activity.id,
          personName: activity.person_name || 'Unknown',
          quantity: activity.quantity,
          itemName: activity.item_name || 'Unknown Item',
          dateTime: activity.date_time,
        }));
      setRecentActivity(recentActivitiesData);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load dashboard data. Please try refreshing.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
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
    description?: string;
  }

  /**
   * StatCard component for displaying statistics
   */
  const StatCard: React.FC<StatCardProps> = ({ icon: Icon, title, value, color, trend, description }) => (
    <div className="group relative bg-gradient-to-br from-white to-gray-50 rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-2xl hover:border-gray-200 transition-all duration-300 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-blue-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      <div className="relative flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1 z-10 relative">{title}</p>
          <p className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-2 z-10 relative">{value}</p>
          {description && <p className="text-xs text-gray-500 mb-2 z-10 relative">{description}</p>}
          {trend && (
            <p className="text-sm bg-gradient-to-r from-green-500 to-green-600 bg-clip-text text-transparent flex items-center z-10 relative">
              <TrendingUp className="h-4 w-4 mr-1" />
              {trend}
            </p>
          )}
        </div>
        <div className={`relative p-3 rounded-xl ${color} shadow-md transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 z-10`}>
          <Icon className="h-6 w-6 text-white drop-shadow-sm" />
        </div>
      </div>
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <Sparkles className="h-4 w-4 text-blue-400" />
      </div>
    </div>
  );

  // Prepare chart data for stock overview (with fallback if no data)
  const chartData = allItems.length > 0 ? {
    labels: allItems.slice(0, 8).map(item => item.name.substring(0, 15) + (item.name.length > 15 ? '...' : '')),
    datasets: [
      {
        label: 'Stock Quantity',
        data: allItems.slice(0, 8).map(item => item.quantity),
        backgroundColor: allItems.slice(0, 8).map((_, i) => `hsl(${i * 45}, 70%, 60%)`),
        borderColor: allItems.slice(0, 8).map((_, i) => `hsl(${i * 45}, 70%, 40%)`),
        borderWidth: 2,
        borderRadius: 4,
        borderSkipped: false,
      },
    ],
  } : {
    labels: [],
    datasets: [{
      label: 'Stock Quantity',
      data: [],
      backgroundColor: 'rgba(59, 130, 246, 0.5)',
      borderColor: 'rgba(59, 130, 246, 1)',
      borderWidth: 1,
    }],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 20,
          font: { size: 12 },
        },
      },
      title: {
        display: true,
        text: 'Top 8 Items Stock Levels',
        font: { size: 16, weight: 'bold' },
        padding: { top: 10, bottom: 20 },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0,0,0,0.05)',
        },
        ticks: {
          font: { size: 11 },
        },
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          maxRotation: 45,
          font: { size: 11 },
        },
      },
    },
    animation: {
      duration: 2000,
      easing: 'easeOutQuart',
    },
  };

  // Show loading state
  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 bg-gradient-to-br from-blue-50 via-white to-purple-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between relative">
        <div className="relative">
          <h1 className="text-2xl font-black text-gray-900 mb-1">
            Dashboard
          </h1>
          <div className="absolute -bottom-0.5 left-0 w-full h-0.5 bg-gradient-to-r from-gray-400 to-gray-600 rounded-full opacity-60"></div>
          <p className="text-gray-600 mt-1">Welcome to your inventory management system. Here's what's happening today.</p>
        </div>
        <Button onClick={loadDashboardData} variant="outline" className="mt-4 sm:mt-0 border-gray-300 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 transition-all duration-300">
          <TrendingUp className="h-4 w-4 mr-2" />
          Refresh Data
        </Button>
        <Sparkles className="absolute top-0 right-0 h-8 w-8 text-purple-400 opacity-30 animate-pulse" />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <StatCard
          icon={Package}
          title="Total Items"
          value={stats.totalItems}
          color="from-blue-500 to-blue-600 bg-gradient-to-br"
          description="Active inventory items"
          trend="+12% from last month"
        />
        <StatCard
          icon={Tags}
          title="Categories"
          value={stats.totalCategories}
          color="from-green-500 to-green-600 bg-gradient-to-br"
          description="Organized groups"
        />
        <StatCard
          icon={ArrowUpRight}
          title="Items Out"
          value={stats.itemsOut}
          color="from-purple-500 to-purple-600 bg-gradient-to-br"
          description="Currently checked out"
          trend="+8% this week"
        />
        <StatCard
          icon={AlertTriangle}
          title="Low Stock"
          value={stats.lowStockItems}
          color="from-red-500 to-red-600 bg-gradient-to-br"
          description="Needs replenishment"
        />
        <StatCard
          icon={Package}
          title="Total Stock"
          value={allItems.reduce((sum, item) => sum + item.quantity, 0)}
          color="from-yellow-500 to-yellow-600 bg-gradient-to-br"
          description="Units in inventory"
        />
      </div>

      {/* Chart and Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stock Overview Chart */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-white/20">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <BarChart3 className="h-5 w-5 mr-2 text-blue-600" />
            Stock Overview
          </h2>
          <div className="h-80 relative rounded-xl overflow-hidden bg-gradient-to-b from-gray-50 to-white">
            {allItems.length > 0 ? (
              <Bar data={chartData} options={chartOptions} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <Package className="h-12 w-12 mr-2" />
                <span>No stock data available</span>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity Panel */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-white/20">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <Users className="h-5 w-5 mr-2 text-blue-600" />
            Recent Activity
          </h2>
          <div className="space-y-3 max-h-80 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
            {recentActivity.length > 0 ? (
              recentActivity.map((activity, index) => (
                <div 
                  key={activity.id} 
                  className={`flex items-start p-4 rounded-xl border border-gray-200 hover:shadow-md transition-all duration-300 ${
                    index % 2 === 0 ? 'bg-gradient-to-r from-blue-50 to-purple-50' : 'bg-gradient-to-r from-indigo-50 to-pink-50'
                  }`}
                >
                  <div className="p-2 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full mr-3 flex-shrink-0">
                    <Users className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {activity.personName} issued {activity.quantity} x {activity.itemName}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(activity.dateTime).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4 animate-bounce" />
                <p className="text-gray-500">No recent activity</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions Panel */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-white/20">
        <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
          <ArrowUpRight className="h-5 w-5 mr-2 text-purple-600" />
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button
            className="w-full h-20 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 flex flex-col items-center justify-center text-sm font-medium shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
            onClick={() => navigate('/inventory')}
          >
            <Package className="h-6 w-6 mb-1" />
            Manage Inventory
          </Button>
          <Button
            className="w-full h-20 rounded-xl bg-gradient-to-br from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 flex flex-col items-center justify-center text-sm font-medium shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
            onClick={() => navigate('/items-out')}
          >
            <ArrowUpRight className="h-6 w-6 mb-1" />
            Issue Item
          </Button>
          <Button
            className="w-full h-20 rounded-xl bg-gradient-to-br from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 flex flex-col items-center justify-center text-sm font-medium shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
            onClick={() => navigate('/reports')}
          >
            <TrendingUp className="h-6 w-6 mb-1" />
            View Reports
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;