import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, ScatterChart, Scatter, ZAxis } from 'recharts';
import { Calendar, TrendingUp, Download, Filter, RefreshCw, ChevronDown, ChevronUp, Settings, BarChart2, PieChart as PieChartIcon, Users, FileText, Package } from 'lucide-react';
import { getItemsOut, getCategories, getRequests, getRequestDetails, getItems } from '../api';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

interface UsageData {
  date: string;
  formattedDate: string;
  items: number;
  users: number;
  source_direct: number;
  source_request: number;
}

interface UsageTracking {
  date: string;
  items: number;
  users: Set<string>;
  source_direct: number;
  source_request: number;
}

interface TopItem {
  name: string;
  count: number;
  category: string;
  source: 'direct' | 'request';
}

interface TopUser {
  name: string;
  count: number;
  source: 'direct' | 'request';
}

interface ItemOut {
  id: string;
  person_name: string;
  item_id: string;
  quantity: number;
  date_time: string;
  item_name: string;
  category_name: string;
}

interface CombinedIssuance extends ItemOut {
  source: 'direct' | 'request';
  requester?: string;
  approver?: string;
  current_stock?: number;
}

interface Category {
  id: string;
  name: string;
}

interface Item {
  id: string;
  name: string;
  category_name: string;
  quantity: number;
}

interface Request {
  id: number;
  created_by: string;
  release_by: string | null;
  updated_at: string;
  status?: string;
  details?: {
    items: {
      id: number;
      item_id: number;
      quantity_received: number | null;
      item_name: string;
    }[];
    approvals?: {
      approver_name: string;
    }[];
  };
}

const Reports: React.FC = () => {
  const [usageData, setUsageData] = useState<UsageData[]>([]);
  const [topItems, setTopItems] = useState<TopItem[]>([]);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [filteredIssuances, setFilteredIssuances] = useState<CombinedIssuance[]>([]);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie' | 'scatter'>('bar');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const { toast } = useToast();

  useEffect(() => {
    loadReportData(startDate, endDate);
  }, [startDate, endDate]);

  const loadReportData = async (start: string, end: string) => {
    try {
      setIsLoading(true);
      const [itemsOutData, categoriesData, requestsData, itemsData] = await Promise.all([
        getItemsOut(), 
        getCategories(), 
        getRequests(), 
        getItems()
      ]);
      
      if (!Array.isArray(categoriesData)) {
        throw new Error('Invalid categories data');
      }
      if (!Array.isArray(itemsData)) {
        throw new Error('Invalid items data');
      }

      // Fetch details for completed requests
      const completedRequests = requestsData.filter((r: Request) => r.status === 'completed');
      const requestDetailsPromises = completedRequests.map((r: Request) => getRequestDetails(r.id));
      const requestDetailsArray = await Promise.all(requestDetailsPromises);

      // Create flat issuances from completed requests
      const requestIssuances: CombinedIssuance[] = [];
      requestDetailsArray.forEach((details, index) => {
        const request = completedRequests[index];
        if (request.release_by && details.items) {
          const approver = details.approvals?.[0]?.approver_name || null;
          const requester = request.created_by;
          details.items.forEach((item) => {
            if (item.quantity_received && item.quantity_received > 0) {
              const itemDetail = itemsData.find((i: Item) => i.id.toString() === item.item_id.toString());
              requestIssuances.push({
                id: `req-${request.id}-${item.id}`,
                person_name: request.release_by,
                item_id: item.item_id.toString(),
                quantity: item.quantity_received,
                date_time: request.updated_at,
                item_name: item.item_name,
                category_name: itemDetail?.category_name || 'Uncategorized',
                source: 'request',
                requester,
                approver,
                current_stock: itemDetail?.quantity || 0,
              });
            }
          });
        }
      });

      // Combine direct issuances and request issuances
      const allIssuances: CombinedIssuance[] = [
        ...itemsOutData.map((io: ItemOut) => ({ 
          ...io, 
          source: 'direct' as const,
          requester: undefined,
          approver: undefined,
          current_stock: itemsData.find((i: Item) => i.id.toString() === io.item_id.toString())?.quantity || 0,
        })),
        ...requestIssuances,
      ];

      // Filter issuances by date range
      const startDateTime = new Date(start + 'T00:00:00');
      const endDateTime = new Date(end + 'T23:59:59.999');
      const filteredIssuancesLocal = allIssuances.filter((issuance) => {
        const issuanceDate = new Date(issuance.date_time);
        return issuanceDate >= startDateTime && issuanceDate <= endDateTime;
      });
      setFilteredIssuances(filteredIssuancesLocal);

      const usageByDate = generateUsageByDate(filteredIssuancesLocal, start, end);
      setUsageData(usageByDate);

      const itemUsage = generateTopItems(filteredIssuancesLocal, categoriesData);
      setTopItems(itemUsage);

      const userUsage = generateTopUsers(filteredIssuancesLocal);
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
      setFilteredIssuances([]);
    } finally {
      setIsLoading(false);
    }
  };

  const generateUsageByDate = (issuances: CombinedIssuance[], startStr: string, endStr: string): UsageData[] => {
    const dateMap: { [key: string]: UsageTracking } = {};
    const start = new Date(startStr + 'T00:00:00');
    const end = new Date(endStr + 'T23:59:59.999');
    let current = new Date(start);

    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];
      dateMap[dateStr] = { date: dateStr, items: 0, users: new Set<string>(), source_direct: 0, source_request: 0 };
      current.setDate(current.getDate() + 1);
    }

    issuances.forEach((issuance) => {
      const dateStr = new Date(issuance.date_time).toISOString().split('T')[0];
      if (dateMap[dateStr]) {
        dateMap[dateStr].items += issuance.quantity || 0;
        dateMap[dateStr].users.add(issuance.person_name || 'Unknown');
        if (issuance.source === 'direct') {
          dateMap[dateStr].source_direct += issuance.quantity || 0;
        } else {
          dateMap[dateStr].source_request += issuance.quantity || 0;
        }
      }
    });

    return Object.values(dateMap)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((entry) => ({
        date: entry.date,
        formattedDate: formatDateForDisplay(entry.date),
        items: entry.items,
        users: entry.users.size,
        source_direct: entry.source_direct,
        source_request: entry.source_request,
      }));
  };

  const generateTopItems = (issuances: CombinedIssuance[], categories: Category[]): TopItem[] => {
    const itemCounts: { [key: string]: { count: number; name: string; category: string; source: 'direct' | 'request' } } = {};

    issuances.forEach((record) => {
      const itemId = record.item_id;
      const itemName = record.item_name || 'Unknown Item';
      const categoryName = record.category_name || 'Uncategorized';

      if (!itemCounts[itemId]) {
        itemCounts[itemId] = { count: 0, name: itemName, category: categoryName, source: record.source };
      } else if (itemCounts[itemId].source !== record.source) {
        itemCounts[itemId].source = record.source;
      }
      itemCounts[itemId].count += record.quantity || 0;
    });

    return Object.values(itemCounts)
      .map((item) => ({
        name: item.name,
        count: item.count,
        category: item.category,
        source: item.source,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  };

  const generateTopUsers = (issuances: CombinedIssuance[]): TopUser[] => {
    const userCounts: { [key: string]: { count: number; source: 'direct' | 'request' } } = {};

    issuances.forEach((record) => {
      const personName = record.person_name || 'Unknown';
      if (!userCounts[personName]) {
        userCounts[personName] = { count: 0, source: record.source };
      } else if (userCounts[personName].source !== record.source) {
        userCounts[personName].source = record.source;
      }
      userCounts[personName].count += record.quantity || 0;
    });

    return Object.entries(userCounts)
      .map(([name, data]) => ({ name, count: data.count, source: data.source }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  };

  const formatDateForDisplay = (dateStr: string) => {
    const date = new Date(dateStr);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[date.getDay()];
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${dayName}, ${day}/${month}/${year}`;
  };

  const formatDate = (dateTime: string) => {
    const date = new Date(dateTime);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[date.getDay()];
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return {
      fullDate: `${dayName}, ${day}/${month}/${year}`,
      time: `${hours}:${minutes}`
    };
  };

  const handleExport = () => {
    if (filteredIssuances.length === 0) {
      toast({
        title: 'No Data',
        description: 'No issuances to export',
        variant: 'destructive',
      });
      return;
    }
    const csvContent = [
      'Date,Item,Category,Quantity Taken,Current Stock,Source,Requester,Approver,Issuer',
      ...filteredIssuances.map((iss) => {
        const { fullDate } = formatDate(iss.date_time);
        return `"${fullDate}","${iss.item_name}","${iss.category_name}","${iss.quantity}","${iss.current_stock}","${iss.source}","${iss.requester || 'N/A'}","${iss.approver || 'N/A'}","${iss.person_name}"`;
      })
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-report-${startDate}-to-${endDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast({
      title: 'Success',
      description: 'Detailed report data has been exported to CSV',
      variant: 'default',
    });
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const formattedLabel = formatDateForDisplay(label);
      return (
        <div className="bg-white p-3 border border-gray-200 shadow-md rounded-md">
          <p className="font-medium text-gray-900">{formattedLabel}</p>
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
  const numDays = usageData.length;
  const avgDailyUsage = numDays > 0 ? Math.round(totalItemsIssued / numDays) : 0;
  const totalDirect = usageData.reduce((sum, day) => sum + day.source_direct, 0);
  const totalRequest = usageData.reduce((sum, day) => sum + day.source_request, 0);
  const COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444'];

  const formattedStartDate = formatDateForDisplay(startDate);
  const formattedEndDate = formatDateForDisplay(endDate);
  const isSingleDay = startDate === endDate;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-600 mt-1">Analyze comprehensive usage trends across direct issuances and finalized requests</p>
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
          <Button onClick={handleExport} className="bg-green-600 hover:bg-green-700 text-white" disabled={filteredIssuances.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export Detailed CSV
          </Button>
        </div>
      </div>

      {showSettings && (
        <div className="mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm animate-in slide-in-from-top-2 duration-300">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Chart Type</label>
              <div className="flex space-x-2">
                <Button
                  variant={chartType === 'bar' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setChartType('bar')}
                  className={`flex-1 ${chartType === 'bar' ? 'bg-blue-500 text-white' : 'bg-white'}`}
                >
                  <BarChart2 className="h-4 w-4 mr-1" /> Bar
                </Button>
                <Button
                  variant={chartType === 'line' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setChartType('line')}
                  className={`flex-1 ${chartType === 'line' ? 'bg-green-500 text-white' : 'bg-white'}`}
                >
                  <TrendingUp className="h-4 w-4 mr-1" /> Line
                </Button>
                <Button
                  variant={chartType === 'pie' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setChartType('pie')}
                  className={`flex-1 ${chartType === 'pie' ? 'bg-purple-500 text-white' : 'bg-white'}`}
                >
                  <PieChartIcon className="h-4 w-4 mr-1" /> Pie
                </Button>
                <Button
                  variant={chartType === 'scatter' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setChartType('scatter')}
                  className={`flex-1 ${chartType === 'scatter' ? 'bg-orange-500 text-white' : 'bg-white'}`}
                >
                  <Package className="h-4 w-4 mr-1" /> Scatter
                </Button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Actions</label>
              <Button variant="outline" size="sm" className="bg-white w-full" onClick={() => loadReportData(startDate, endDate)}>
                <RefreshCw className="h-4 w-4 mr-2" /> Refresh Data
              </Button>
            </div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading comprehensive report data...</p>
        </div>
      )}

      {!isLoading && usageData.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Items Issued</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{totalItemsIssued}</p>
                  <p className="text-sm text-blue-600 mt-1">{formattedStartDate} to {formattedEndDate}</p>
                  <p className="text-xs text-gray-500 mt-1">Direct: {totalDirect} | Requests: {totalRequest}</p>
                </div>
                <div className="p-3 rounded-lg bg-blue-100">
                  <TrendingUp className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Peak Active Users</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{maxActiveUsers}</p>
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
                  <p className="text-3xl font-bold text-gray-900 mt-2">{avgDailyUsage}</p>
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
                  Usage Trend ({chartType})
                </h2>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                {chartType === 'bar' ? (
                  <BarChart data={usageData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="formattedDate" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="source_direct" fill="#3B82F6" name="Direct" />
                    <Bar dataKey="source_request" fill="#10B981" name="Requests" />
                    <Bar dataKey="users" fill="#8B5CF6" name="Users" stackId="a" />
                  </BarChart>
                ) : chartType === 'line' ? (
                  <LineChart data={usageData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="formattedDate" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Line type="monotone" dataKey="source_direct" stroke="#3B82F6" name="Direct" strokeWidth={2} />
                    <Line type="monotone" dataKey="source_request" stroke="#10B981" name="Requests" strokeWidth={2} />
                    <Line type="monotone" dataKey="users" stroke="#8B5CF6" name="Users" strokeWidth={2} dot={false} />
                  </LineChart>
                ) : chartType === 'pie' ? (
                  <PieChart>
                    <Pie
                      data={topItems.map(item => ({ name: item.name, value: item.count }))}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
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
                ) : chartType === 'scatter' ? (
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="category" dataKey="formattedDate" name="Date" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={60} />
                    <YAxis type="number" name="Items" tick={{ fontSize: 12 }} />
                    <ZAxis type="number" range={[100]} name="Users" />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                    <Scatter name="Direct" data={usageData} fill="#3B82F6" />
                    <Scatter name="Requests" data={usageData.map(d => ({ ...d, items: d.source_request }))} fill="#10B981" />
                  </ScatterChart>
                ) : null}
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
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="flex items-center">
                        <div className={`w-3 h-3 rounded-full mr-3 ${item.source === 'direct' ? 'bg-blue-500' : 'bg-green-500'}`}></div>
                        <div>
                          <p className="font-medium text-gray-900">{item.name}</p>
                          <p className="text-xs text-gray-500">{item.category} ({item.source})</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">{item.count}</p>
                        <div className="w-24 bg-gray-200 rounded-full h-2 mt-1">
                          <div
                            className={`h-2 rounded-full ${item.source === 'direct' ? 'bg-blue-500' : 'bg-green-500'}`}
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
                    <div className={`w-16 h-16 ${user.source === 'direct' ? 'bg-blue-100' : 'bg-green-100'} rounded-full flex items-center justify-center mx-auto mb-3 border-2 border-blue-200`}>
                      <span className={`text-xl font-bold ${user.source === 'direct' ? 'text-blue-600' : 'text-green-600'}`}>{user.name.charAt(0)}</span>
                    </div>
                    <p className="font-medium text-gray-900">{user.name}</p>
                    <p className="text-xs text-gray-500 mt-1">({user.source})</p>
                    <p className="text-sm text-gray-600 mt-1">{user.count} items</p>
                    <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${user.source === 'direct' ? 'bg-blue-600' : 'bg-green-600'}`}
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

          {isSingleDay && filteredIssuances.length > 0 && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mt-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                <FileText className="h-5 w-5 mr-2 text-indigo-600" />
                Daily Issuances Details - {formattedStartDate}
              </h2>
              <p className="text-sm text-gray-600 mb-4">Items taken out and current stock levels</p>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date & Time</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty Taken</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Stock</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requester</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Approver</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Issuer</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredIssuances.map((iss, index) => {
                      const { fullDate, time } = formatDate(iss.date_time);
                      return (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div className="font-medium">{fullDate}</div>
                            <div className="text-gray-500 text-xs">{time}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{iss.item_name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{iss.category_name || 'Uncategorized'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{iss.quantity}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{iss.current_stock || 0}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              iss.source === 'direct' 
                                ? 'bg-blue-100 text-blue-800' 
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {iss.source.charAt(0).toUpperCase() + iss.source.slice(1)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">{iss.requester || 'N/A'}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">{iss.approver || 'N/A'}</td>
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">{iss.person_name}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Reports;