
import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Calendar, TrendingUp, Download, Filter, RefreshCw, ChevronDown, ChevronUp, Settings, BarChart2, PieChart as PieChartIcon, Users } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

/**
 * Interface for usage data
 */
interface UsageData {
  date: string;
  items: number;
  users: number;
}

/**
 * Interface for tracking data during processing
 */
interface UsageTracking {
  date: string;
  items: number;
  users: Set<string>;
}

/**
 * Interface for top items
 */
interface TopItem {
  name: string;
  count: number;
  category: string;
}

/**
 * Interface for top users
 */
interface TopUser {
  name: string;
  count: number;
}

/**
 * Reports Component
 * Displays analytics and reports for inventory system
 */
const Reports: React.FC = () => {
  // State management
  const [usageData, setUsageData] = useState<UsageData[]>([]);
  const [topItems, setTopItems] = useState<TopItem[]>([]);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [timeRange, setTimeRange] = useState<string>('7'); // days
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie'>('bar');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const { toast } = useToast();

  // Load report data when component mounts or time range changes
  useEffect(() => {
    loadReportData();
  }, [timeRange]);

  /**
   * Loads report data from Supabase
   * Generates analytics based on items_out records
   */
  const loadReportData = async () => {
    try {
      setIsLoading(true);
      
      // Get date range for filtering
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(timeRange));
      
      // Fetch items_out records for the specified period
      const { data: itemsOutData } = await supabase
        .from('items_out')
        .select('*, items:item_id(name, category_id)')
        .gte('date_time', startDate.toISOString())
        .order('date_time', { ascending: false });

      // Fetch all categories for reference
      const { data: categoriesData } = await supabase
        .from('categories')
        .select('*');
      
      if (!itemsOutData) {
        setIsLoading(false);
        return;
      }
      
      // Generate usage data by date
      const usageByDate = generateUsageByDate(itemsOutData, parseInt(timeRange));
      setUsageData(usageByDate);
      
      // Generate top items data
      const itemUsage = generateTopItems(itemsOutData, categoriesData || []);
      setTopItems(itemUsage);
      
      // Generate top users data
      const userUsage = generateTopUsers(itemsOutData);
      setTopUsers(userUsage);
      
    } catch (error) {
      console.error('Error loading report data:', error);
      toast({
        title: "Error",
        description: "Failed to load report data",
        variant: "destructive"
      });
      // Use mock data for demonstration
      generateMockData();
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Generates usage data grouped by date
   */
  const generateUsageByDate = (itemsOutData: any[], days: number) => {
    // Create date map for the specified number of days
    const dateMap: { [key: string]: UsageTracking } = {};
    const today = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(today.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      dateMap[dateStr] = {
        date: dateStr,
        items: 0,
        users: new Set<string>()
      };
    }
    
    // Fill in actual usage data
    itemsOutData.forEach(item => {
      const dateStr = new Date(item.date_time).toISOString().split('T')[0];
      if (dateMap[dateStr]) {
        dateMap[dateStr].items += item.quantity;
        dateMap[dateStr].users.add(item.person_name);
      }
    });
    
    // Convert sets to counts for final data
    const result = Object.values(dateMap).map(entry => ({
      date: entry.date,
      items: entry.items,
      users: entry.users.size
    }));
    
    return result;
  };

  /**
   * Generates top items data
   */
  const generateTopItems = (itemsOutData: any[], categories: any[]): TopItem[] => {
    const itemCounts: { [key: string]: { count: number, name: string, categoryId: string | null } } = {};
    
    // Count items
    itemsOutData.forEach(record => {
      const itemId = record.item_id;
      const itemName = record.items?.name || 'Unknown Item';
      const categoryId = record.items?.category_id;
      
      if (!itemCounts[itemId]) {
        itemCounts[itemId] = { count: 0, name: itemName, categoryId };
      }
      
      itemCounts[itemId].count += record.quantity;
    });
    
    // Convert to array and sort
    const categoryMap = Object.fromEntries(
      categories.map(category => [category.id, category.name])
    );
    
    const topItems = Object.values(itemCounts)
      .map(item => ({
        name: item.name,
        count: item.count,
        category: item.categoryId ? categoryMap[item.categoryId] || 'Unknown' : 'Unknown'
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    return topItems;
  };

  /**
   * Generates top users data
   */
  const generateTopUsers = (itemsOutData: any[]): TopUser[] => {
    const userCounts: { [key: string]: number } = {};
    
    // Count items per user
    itemsOutData.forEach(record => {
      const personName = record.person_name;
      
      if (!userCounts[personName]) {
        userCounts[personName] = 0;
      }
      
      userCounts[personName] += record.quantity;
    });
    
    // Convert to array and sort
    const topUsers = Object.entries(userCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    return topUsers;
  };

  /**
   * Generates mock data for demonstration
   */
  const generateMockData = () => {
    // Mock usage data
    const mockUsageData = Array.from({ length: parseInt(timeRange) }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (parseInt(timeRange) - 1) + i);
      const dateStr = date.toISOString().split('T')[0];
      
      return {
        date: dateStr,
        items: Math.floor(Math.random() * 20) + 5,
        users: Math.floor(Math.random() * 10) + 1
      };
    });
    
    // Mock top items
    const mockTopItems = [
      { name: 'ONT Router', count: 45, category: 'Routers' },
      { name: 'Ethernet Cable', count: 38, category: 'Cables' },
      { name: 'Network Switch', count: 25, category: 'Switches' },
      { name: 'WiFi Router', count: 22, category: 'Routers' },
      { name: 'Fiber Cable', count: 18, category: 'Cables' }
    ];
    
    // Mock top users
    const mockTopUsers = [
      { name: 'John Smith', count: 15 },
      { name: 'Sarah Johnson', count: 12 },
      { name: 'Mike Davis', count: 10 },
      { name: 'Emily Brown', count: 8 },
      { name: 'David Wilson', count: 7 }
    ];
    
    setUsageData(mockUsageData);
    setTopItems(mockTopItems);
    setTopUsers(mockTopUsers);
  };

  /**
   * Exports data to CSV
   */
  const handleExport = () => {
    // Generate CSV data
    const csvData = usageData.map(row => 
      `${row.date},${row.items},${row.users}`
    ).join('\n');
    
    const blob = new Blob([`Date,Items,Users\n${csvData}`], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-report-${timeRange}-days.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    toast({
      title: "Success",
      description: "Report data has been exported to CSV",
      variant: "default"
    });
  };

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 shadow-md rounded-md">
          <p className="font-medium text-gray-900">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Calculate totals for summary cards
  const totalItemsIssued = usageData.reduce((sum, day) => sum + day.items, 0);
  const maxActiveUsers = Math.max(...usageData.map(day => day.users), 0);
  const avgDailyUsage = Math.round(totalItemsIssued / (usageData.length || 1));

  // Custom colors for charts
  const COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444'];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-600 mt-1">Analyze usage trends and patterns</p>
        </div>
        <div className="flex items-center space-x-2 mt-4 md:mt-0">
          <Button
            variant="outline"
            className="bg-white border border-gray-300 hover:bg-gray-50"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings className="h-4 w-4 mr-2" />
            Settings
            {showSettings ? (
              <ChevronUp className="h-4 w-4 ml-2" />
            ) : (
              <ChevronDown className="h-4 w-4 ml-2" />
            )}
          </Button>
          <Button
            onClick={handleExport}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Settings Panel (Collapsible) */}
      {showSettings && (
        <div className="mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Time Range
              </label>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="7">Last 7 days</option>
                <option value="14">Last 14 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Chart Type
              </label>
              <div className="flex space-x-2">
                <Button
                  variant={chartType === 'bar' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setChartType('bar')}
                  className={`flex-1 ${chartType === 'bar' ? '' : 'bg-white'}`}
                >
                  <BarChart2 className="h-4 w-4 mr-1" />
                  Bar
                </Button>
                <Button
                  variant={chartType === 'line' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setChartType('line')}
                  className={`flex-1 ${chartType === 'line' ? '' : 'bg-white'}`}
                >
                  <TrendingUp className="h-4 w-4 mr-1" />
                  Line
                </Button>
                <Button
                  variant={chartType === 'pie' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setChartType('pie')}
                  className={`flex-1 ${chartType === 'pie' ? '' : 'bg-white'}`}
                >
                  <PieChartIcon className="h-4 w-4 mr-1" />
                  Pie
                </Button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Actions
              </label>
              <Button 
                variant="outline" 
                size="sm"
                className="bg-white w-full"
                onClick={loadReportData}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Data
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading report data...</p>
        </div>
      )}

      {!isLoading && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Items Issued</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {totalItemsIssued}
                  </p>
                  <p className="text-sm text-blue-600 mt-1">
                    Last {timeRange} days
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-blue-100">
                  <TrendingUp className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Users</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {maxActiveUsers}
                  </p>
                  <p className="text-sm text-green-600 mt-1">
                    Maximum per day
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-green-100">
                  <Calendar className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg Daily Usage</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {avgDailyUsage}
                  </p>
                  <p className="text-sm text-purple-600 mt-1">
                    Items per day
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-purple-100">
                  <Filter className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Usage Trend Chart */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                  <TrendingUp className="h-5 w-5 mr-2 text-blue-600" />
                  Usage Trend
                </h2>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                {chartType === 'bar' ? (
                  <BarChart data={usageData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="items" fill="#3B82F6" name="Items" />
                    <Bar dataKey="users" fill="#10B981" name="Users" />
                  </BarChart>
                ) : chartType === 'line' ? (
                  <LineChart data={usageData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Line type="monotone" dataKey="items" stroke="#3B82F6" name="Items" strokeWidth={2} />
                    <Line type="monotone" dataKey="users" stroke="#10B981" name="Users" strokeWidth={2} />
                  </LineChart>
                ) : (
                  <PieChart>
                    <Pie
                      data={topItems}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                      nameKey="name"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {topItems.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                )}
              </ResponsiveContainer>
            </div>

            {/* Top Items */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                <BarChart2 className="h-5 w-5 mr-2 text-green-600" />
                Most Used Items
              </h2>
              <div className="space-y-4">
                {topItems.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg transition-colors">
                    <div>
                      <p className="font-medium text-gray-900">{item.name}</p>
                      <p className="text-sm text-gray-600">{item.category}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">{item.count}</p>
                      <div className="w-32 bg-gray-200 rounded-full h-2 mt-1">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${(item.count / Math.max(...topItems.map(i => i.count))) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
                {topItems.length === 0 && (
                  <p className="text-center py-4 text-gray-500">No item usage data available</p>
                )}
              </div>
            </div>
          </div>

          {/* Top Users */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
              <Users className="h-5 w-5 mr-2 text-purple-600" />
              Most Active Users
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {topUsers.map((user, index) => (
                <div key={index} className="text-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-xl text-blue-600 font-bold">{user.name.charAt(0)}</span>
                  </div>
                  <p className="font-medium text-gray-900">{user.name}</p>
                  <p className="text-sm text-gray-600 mt-1">{user.count} items</p>
                  <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className="bg-purple-600 h-1.5 rounded-full"
                      style={{ width: `${(user.count / Math.max(...topUsers.map(u => u.count))) * 100}%` }}
                    ></div>
                  </div>
                </div>
              ))}
              {topUsers.length === 0 && (
                <div className="col-span-5 text-center py-4 text-gray-500">
                  No user activity data available
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Reports;
