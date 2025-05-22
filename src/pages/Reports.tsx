
import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Calendar, TrendingUp, Download, Filter } from 'lucide-react';
import * as api from '../api';

const Reports = () => {
  const [usageData, setUsageData] = useState([]);
  const [topItems, setTopItems] = useState([]);
  const [topUsers, setTopUsers] = useState([]);
  const [timeRange, setTimeRange] = useState('7'); // days
  const [chartType, setChartType] = useState('bar');

  useEffect(() => {
    loadReportData();
  }, [timeRange]);

  const loadReportData = async () => {
    try {
      const [usage, items, users] = await Promise.all([
        api.getUsageData(timeRange),
        api.getTopItems(timeRange),
        api.getTopUsers(timeRange)
      ]);
      
      setUsageData(usage);
      setTopItems(items);
      setTopUsers(users);
    } catch (error) {
      console.error('Error loading report data:', error);
      // Mock data for demonstration
      const mockUsageData = [
        { date: '2024-01-15', items: 12, users: 5 },
        { date: '2024-01-16', items: 8, users: 3 },
        { date: '2024-01-17', items: 15, users: 7 },
        { date: '2024-01-18', items: 10, users: 4 },
        { date: '2024-01-19', items: 18, users: 8 },
        { date: '2024-01-20', items: 14, users: 6 },
        { date: '2024-01-21', items: 20, users: 9 }
      ];
      
      const mockTopItems = [
        { name: 'ONT Router', count: 45, category: 'Routers' },
        { name: 'Ethernet Cable', count: 38, category: 'Cables' },
        { name: 'Network Switch', count: 25, category: 'Switches' },
        { name: 'WiFi Router', count: 22, category: 'Routers' },
        { name: 'Fiber Cable', count: 18, category: 'Cables' }
      ];
      
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
    }
  };

  const handleExport = () => {
    // Generate CSV data
    const csvData = usageData.map(row => 
      `${row.date},${row.items},${row.users}`
    ).join('\n');
    
    const blob = new Blob([`Date,Items,Users\n${csvData}`], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-report-${timeRange}days.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-600 mt-1">Analyze usage trends and patterns</p>
        </div>
        <div className="flex items-center space-x-4 mt-4 md:mt-0">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
          <button
            onClick={handleExport}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center"
          >
            <Download className="h-5 w-5 mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Items Issued</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {usageData.reduce((sum, day) => sum + day.items, 0)}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Users</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {Math.max(...usageData.map(day => day.users))}
              </p>
            </div>
            <Calendar className="h-8 w-8 text-green-600" />
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Daily Usage</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {Math.round(usageData.reduce((sum, day) => sum + day.items, 0) / usageData.length) || 0}
              </p>
            </div>
            <Filter className="h-8 w-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Usage Trend Chart */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Usage Trend</h2>
            <select
              value={chartType}
              onChange={(e) => setChartType(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded text-sm"
            >
              <option value="bar">Bar Chart</option>
              <option value="line">Line Chart</option>
            </select>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            {chartType === 'bar' ? (
              <BarChart data={usageData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="items" fill="#3B82F6" name="Items" />
                <Bar dataKey="users" fill="#10B981" name="Users" />
              </BarChart>
            ) : (
              <LineChart data={usageData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="items" stroke="#3B82F6" name="Items" />
                <Line type="monotone" dataKey="users" stroke="#10B981" name="Users" />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Top Items */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Most Used Items</h2>
          <div className="space-y-4">
            {topItems.map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{item.name}</p>
                  <p className="text-sm text-gray-600">{item.category}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-900">{item.count}</p>
                  <div className="w-20 bg-gray-200 rounded-full h-2 mt-1">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${(item.count / Math.max(...topItems.map(i => i.count))) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Users */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Most Active Users</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {topUsers.map((user, index) => (
            <div key={index} className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-blue-600 font-bold">{user.name.charAt(0)}</span>
              </div>
              <p className="font-medium text-gray-900">{user.name}</p>
              <p className="text-sm text-gray-600">{user.count} items</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Reports;
