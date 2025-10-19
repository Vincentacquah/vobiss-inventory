// src/pages/AuditLogs.tsx
import React, { useState, useEffect } from 'react';
import { getAuditLogs } from '../api';

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState('All');
  const [sortBy, setSortBy] = useState('timestamp'); // Default sort by timestamp desc
  const [loginStats, setLoginStats] = useState({ totalToday: 0, usersToday: {} });

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const data = await getAuditLogs();
        setLogs(data);
        setFilteredLogs(data);
        calculateLoginStats(data);
      } catch (err) {
        setError('Failed to load audit logs');
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, []);

  // Calculate daily login stats (group by user and date)
  const calculateLoginStats = (allLogs) => {
    const today = new Date().toDateString();
    const stats = { totalToday: 0, usersToday: {} };

    const loginLogs = allLogs.filter(log => log.action === 'login');
    loginLogs.forEach(log => {
      const logDate = new Date(log.timestamp).toDateString();
      if (logDate === today) {
        stats.totalToday++;
        const userKey = log.full_name || log.username || 'Unknown';
        stats.usersToday[userKey] = (stats.usersToday[userKey] || 0) + 1;
      }
    });

    setLoginStats(stats);
  };

  // Format date as "Tuesday dd/mm/yyyy"
  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = days[date.getDay()];
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${dayName} ${day}/${month}/${year}`;
  };

  // Format time as "HH:MM AM/PM"
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  // Render details based on action for better readability
  const renderDetails = (action, details) => {
    if (!details) return 'No details';
    try {
      const parsedDetails = typeof details === 'string' ? JSON.parse(details) : details;
      switch (action) {
        case 'approve_request':
          return `Approved request ID: ${parsedDetails.request_id || 'N/A'} as ${parsedDetails.approver_name || 'Unknown'}`;
        case 'create_request':
          return `Created request ID: ${parsedDetails.request_id || 'N/A'}`;
        case 'reject_request':
          return `Rejected request ID: ${parsedDetails.request_id || 'N/A'}`;
        case 'finalize_request':
          return `Finalized request ID: ${parsedDetails.request_id || 'N/A'} released by: ${parsedDetails.released_by || 'Unknown'}`;
        case 'create_user':
          return `Created user: ${parsedDetails.username || 'N/A'} (${parsedDetails.role || 'N/A'})`;
        case 'reset_password':
          return `Reset password for user ID: ${parsedDetails.user_id || 'N/A'}`;
        case 'update_user_role':
          return `Updated role for user ID: ${parsedDetails.user_id || 'N/A'} to: ${parsedDetails.new_role || 'N/A'}`;
        case 'create_item':
          return `Created item: ${parsedDetails.item_name || 'N/A'}`;
        case 'update_item':
          return `Updated item ID: ${parsedDetails.item_id || 'N/A'} (reason: ${parsedDetails.reason || 'N/A'})`;
        case 'delete_item':
          return `Deleted item ID: ${parsedDetails.item_id || 'N/A'}`;
        case 'issue_item':
          return `Issued ${parsedDetails.quantity || 'N/A'} of item ID: ${parsedDetails.item_id || 'N/A'} to: ${parsedDetails.person_name || 'N/A'}`;
        case 'create_category':
          return `Created category: ${parsedDetails.category_name || 'N/A'}`;
        case 'update_category':
          return `Updated category ID: ${parsedDetails.category_id || 'N/A'}`;
        case 'delete_category':
          return `Deleted category ID: ${parsedDetails.category_id || 'N/A'}`;
        default:
          return (
            <pre className="bg-gray-50 p-3 rounded-md text-xs overflow-auto max-h-20">
              {JSON.stringify(parsedDetails, null, 2)}
            </pre>
          );
      }
    } catch (e) {
      return (
        <pre className="bg-gray-50 p-3 rounded-md text-xs overflow-auto max-h-20">
          {JSON.stringify(details, null, 2)}
        </pre>
      );
    }
  };

  // Filter and sort logs
  useEffect(() => {
    let filtered = [...logs];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(log =>
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.full_name || log.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.ip_address.includes(searchTerm)
      );
    }

    // User filter
    if (selectedUser !== 'All') {
      filtered = filtered.filter(log => (log.full_name || log.username) === selectedUser);
    }

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === 'timestamp') {
        return new Date(b.timestamp) - new Date(a.timestamp);
      } else if (sortBy === 'action') {
        return (a.action || '').localeCompare(b.action || '');
      } else if (sortBy === 'user') {
        return (a.full_name || a.username || '').localeCompare(b.full_name || b.username || '');
      }
      return 0;
    });

    setFilteredLogs(filtered);
  }, [logs, searchTerm, selectedUser, sortBy]);

  if (loading) {
    return (
      <div className="p-6 flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-800 px-6 py-4 rounded-lg">
          <div className="flex items-center">
            <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        </div>
      </div>
    );
  }

  // Get unique users for filter
  const uniqueUsers = [...new Set(logs.map(log => log.full_name || log.username || 'Unknown'))];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Audit Logs</h1>
        <p className="text-gray-600">Track all user activities, including logins, creations, updates, deletions, and approvals for enhanced security.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100">
              <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Logins Today</p>
              <p className="text-2xl font-bold text-gray-900">{loginStats.totalToday}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Users Today</p>
              <p className="text-2xl font-bold text-gray-900">{Object.keys(loginStats.usersToday).length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-purple-100">
              <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Entries</p>
              <p className="text-2xl font-bold text-gray-900">{logs.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <input
              type="text"
              placeholder="Search by action, user, or IP..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by User</label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="All">All Users</option>
              {uniqueUsers.map(user => (
                <option key={user} value={user}>{user}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="timestamp">Latest First</option>
              <option value="action">Action</option>
              <option value="user">User</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Activity Log</h2>
          <p className="text-sm text-gray-500">Showing {filteredLogs.length} of {logs.length} entries</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date & Time</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">IP Address</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Details</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{formatDate(log.timestamp)}</div>
                    <div className="text-sm text-gray-500">{formatTime(log.timestamp)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{log.full_name || log.username || 'N/A'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${
                      log.action === 'login' ? 'bg-green-100 text-green-800' :
                      log.action === 'logout' ? 'bg-gray-100 text-gray-800' :
                      log.action.includes('create') ? 'bg-blue-100 text-blue-800' :
                      log.action.includes('update') ? 'bg-yellow-100 text-yellow-800' :
                      log.action.includes('delete') ? 'bg-red-100 text-red-800' :
                      log.action.includes('approve') ? 'bg-purple-100 text-purple-800' :
                      log.action.includes('reject') ? 'bg-orange-100 text-orange-800' :
                      log.action.includes('issue') ? 'bg-indigo-100 text-indigo-800' : 'bg-indigo-100 text-indigo-800'
                    }`}>
                      {log.action.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <a href={`https://whatismyipaddress.com/ip/${log.ip_address}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      {log.ip_address}
                    </a>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 max-w-md">
                      {renderDetails(log.action, log.details)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredLogs.length === 0 && (
          <div className="px-6 py-12 text-center text-gray-500">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3 className="mt-2 text-sm font-medium">No audit logs</h3>
            <p className="mt-1 text-sm">No activities match the selected filters.</p>
          </div>
        )}
      </div>

      {/* Login Stats Table */}
      <div className="mt-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Today's Login Summary</h2>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Logins Today</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Last Login</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {Object.entries(loginStats.usersToday).map(([user, count]) => {
                const lastLogin = logs
                  .filter(log => (log.full_name || log.username) === user && log.action === 'login')
                  .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
                return (
                  <tr key={user} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{count}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lastLogin ? formatTime(lastLogin.timestamp) : 'N/A'}</td>
                  </tr>
                );
              })}
              {Object.keys(loginStats.usersToday).length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-4 text-center text-gray-500 text-sm">No logins today</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AuditLogs;