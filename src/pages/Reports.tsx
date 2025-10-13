import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Calendar, TrendingUp, Download, Filter, RefreshCw, ChevronDown, ChevronUp, Settings, BarChart2, PieChart as PieChartIcon, Users } from 'lucide-react';
import { getItemsOut, getCategories } from '../api';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

interface UsageData {
  date: string;
  items: number;
  users: number;
}

interface UsageTracking {
  date: string;
  items: number;
  users: Set<string>;
}

interface TopItem {
  name: string;
  count: number;
  category: string;
}

interface TopUser {
  name: string;
  count: number;
}

interface ItemOut {
  id: string;
  person_name: string;
  item_id: string;
  quantity: number;
  date_time: string;
  item_name: string; // Updated to match getItemsOut response
  category_name: string; // Updated to match getItemsOut response
}

interface Category {
  id: string;
  name: string;
}

const Reports: React.FC = () => {
  const [usageData, setUsageData] = useState<UsageData[]>([]);
  const [topItems, setTopItems] = useState<TopItem[]>([]);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [timeRange, setTimeRange] = useState<string>('7');
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie'>('bar');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const { toast } = useToast();

  useEffect(() => {
    loadReportData();
  }, [timeRange]);

  const loadReportData = async () => {
    try {
      setIsLoading(true);
      const [itemsOutData, categoriesData] = await Promise.all([getItemsOut(), getCategories()]);
      console.log('Items Out Data:', itemsOutData); // Debug log
      console.log('Categories Data:', categoriesData); // Debug log
      if (!itemsOutData || itemsOutData.length === 0) {
        throw new Error('No items out data available');
      }
      if (!Array.isArray(categoriesData)) {
        throw new Error('Invalid categories data');
      }

      const usageByDate = generateUsageByDate(itemsOutData, parseInt(timeRange));
      setUsageData(usageByDate);

      const itemUsage = generateTopItems(itemsOutData, categoriesData);
      setTopItems(itemUsage);

      const userUsage = generateTopUsers(itemsOutData);
      setTopUsers(userUsage);
    } catch (error) {
      console.error('Error loading report data:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to load report data',
        variant: 'destructive',
      });
      setUsageData([]);
      setTopItems([]);
      setTopUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const generateUsageByDate = (itemsOutData: ItemOut[], days: number): UsageData[] => {
    const dateMap: { [key: string]: UsageTracking } = {};
    const today = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      dateMap[dateStr] = { date: dateStr, items: 0, users: new Set<string>() };
    }

    itemsOutData.forEach((item) => {
      const dateStr = new Date(item.date_time).toISOString().split('T')[0];
      if (dateMap[dateStr]) {
        dateMap[dateStr].items += item.quantity || 0;
        dateMap[dateStr].users.add(item.person_name || 'Unknown');
      }
    });

    return Object.values(dateMap).map((entry) => ({
      date: entry.date,
      items: entry.items,
      users: entry.users.size,
    }));
  };

  const generateTopItems = (itemsOutData: ItemOut[], categories: Category[]): TopItem[] => {
    const itemCounts: { [key: string]: { count: number; name: string; category: string } } = {};

    itemsOutData.forEach((record) => {
      const itemId = record.item_id;
      const itemName = record.item_name || 'Unknown Item'; // Use item_name directly
      const categoryName = record.category_name || 'Unknown'; // Use category_name directly

      if (!itemCounts[itemId]) {
        itemCounts[itemId] = { count: 0, name: itemName, category: categoryName };
      }
      itemCounts[itemId].count += record.quantity || 0;
    });

    return Object.values(itemCounts)
      .map((item) => ({
        name: item.name,
        count: item.count,
        category: item.category,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  };

  const generateTopUsers = (itemsOutData: ItemOut[]): TopUser[] => {
    const userCounts: { [key: string]: number } = {};

    itemsOutData.forEach((record) => {
      const personName = record.person_name || 'Unknown';
      userCounts[personName] = (userCounts[personName] || 0) + (record.quantity || 0);
    });

    return Object.entries(userCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  };

  const handleExport = () => {
    const csvData = usageData.map((row) => `${row.date},${row.items},${row.users}`).join('\n');
    const blob = new Blob([`Date,Items,Users\n${csvData}`], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-report-${timeRange}-days.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast({
      title: 'Success',
      description: 'Report data has been exported to CSV',
      variant: 'default',
    });
  };

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

  const totalItemsIssued = usageData.reduce((sum, day) => sum + day.items, 0);
  const maxActiveUsers = Math.max(...usageData.map((day) => day.users), 0);
  const avgDailyUsage = Math.round(totalItemsIssued / (usageData.length || 1));
  const COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444'];

  return (
    <div className="p-6 max-w-7xl mx-auto">
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
            {showSettings ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
          </Button>
          <Button onClick={handleExport} className="bg-green-600 hover:bg-green-700 text-white">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {showSettings && (
        <div className="mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Time Range</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Chart Type</label>
              <div className="flex space-x-2">
                <Button
                  variant={chartType === 'bar' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setChartType('bar')}
                  className={`flex-1 ${chartType === 'bar' ? '' : 'bg-white'}`}
                >
                  <BarChart2 className="h-4 w-4 mr-1" /> Bar
                </Button>
                <Button
                  variant={chartType === 'line' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setChartType('line')}
                  className={`flex-1 ${chartType === 'line' ? '' : 'bg-white'}`}
                >
                  <TrendingUp className="h-4 w-4 mr-1" /> Line
                </Button>
                <Button
                  variant={chartType === 'pie' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setChartType('pie')}
                  className={`flex-1 ${chartType === 'pie' ? '' : 'bg-white'}`}
                >
                  <PieChartIcon className="h-4 w-4 mr-1" /> Pie
                </Button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Actions</label>
              <Button variant="outline" size="sm" className="bg-white w-full" onClick={loadReportData}>
                <RefreshCw className="h-4 w-4 mr-2" /> Refresh Data
              </Button>
            </div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading report data...</p>
        </div>
      )}

      {!isLoading && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Items Issued</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{totalItemsIssued || 0}</p>
                  <p className="text-sm text-blue-600 mt-1">Last {timeRange} days</p>
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
                  <p className="text-3xl font-bold text-gray-900 mt-2">{maxActiveUsers || 0}</p>
                  <p className="text-sm text-green-600 mt-1">Maximum per day</p>
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
                  <p className="text-3xl font-bold text-gray-900 mt-2">{avgDailyUsage || 0}</p>
                  <p className="text-sm text-purple-600 mt-1">Items per day</p>
                </div>
                <div className="p-3 rounded-lg bg-purple-100">
                  <Filter className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
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
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                <BarChart2 className="h-5 w-5 mr-2 text-green-600" />
                Most Used Items
              </h2>
              <div className="space-y-4">
                {topItems.length > 0 ? (
                  topItems.map((item, index) => (
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
                            style={{ width: `${(item.count / Math.max(...topItems.map((i) => i.count))) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center py-4 text-gray-500">No item usage data available</p>
                )}
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
              <Users className="h-5 w-5 mr-2 text-purple-600" />
              Most Active Users
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {topUsers.length > 0 ? (
                topUsers.map((user, index) => (
                  <div key={index} className="text-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <span className="text-xl text-blue-600 font-bold">{user.name.charAt(0)}</span>
                    </div>
                    <p className="font-medium text-gray-900">{user.name}</p>
                    <p className="text-sm text-gray-600 mt-1">{user.count} items</p>
                    <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className="bg-purple-600 h-1.5 rounded-full"
                        style={{ width: `${(user.count / Math.max(...topUsers.map((u) => u.count))) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-5 text-center py-4 text-gray-500">No user activity data available</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Reports;