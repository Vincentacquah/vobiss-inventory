import React, { useState, useEffect } from 'react';
import { Search, ArrowUpRight, Calendar, Download, Filter, CheckCircle, XCircle } from 'lucide-react';
import { getRequests, getRequestDetails } from '../api';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from 'react-router-dom';

interface Request {
  id: number;
  created_by: string;
  team_leader_name: string;
  team_leader_phone: string;
  project_name: string;
  isp_name: string;
  location: string;
  deployment_type: 'Deployment' | 'Maintenance';
  release_by: string | null;
  received_by: string | null;
  status: 'pending' | 'approved' | 'completed' | 'rejected';
  created_at: string;
  updated_at: string;
  item_count: number;
  details?: {
    items: {
      id: number;
      request_id: number;
      item_id: number;
      quantity_requested: number | null;
      quantity_received: number | null;
      quantity_returned: number | null;
      item_name: string;
    }[];
    approvals: {
      id: number;
      request_id: number;
      approver_name: string;
      signature: string;
      approved_at: string;
    }[];
  };
}

const ItemsOut: React.FC = () => {
  const [allRequests, setAllRequests] = useState<Request[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<Request[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'completed' | 'rejected'>('completed');
  const { toast } = useToast();

  useEffect(() => {
    loadRequests();
  }, []);

  useEffect(() => {
    filterRequests();
  }, [allRequests, searchTerm, filterDate, activeTab]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const data = await getRequests();
      const targetStatuses = ['completed', 'rejected'];
      const targetRequests = data.filter((request: Request) => targetStatuses.includes(request.status)) || [];
      const detailsPromises = targetRequests.map(async (r: Request) => {
        try {
          const details = await getRequestDetails(r.id);
          return { ...r, details };
        } catch (error) {
          console.error(`Error loading details for request ${r.id}:`, error);
          return { ...r, details: { items: [], approvals: [] } }; // Fallback empty details
        }
      });
      const withDetails = await Promise.all(detailsPromises);
      setAllRequests(withDetails);
    } catch (error) {
      console.error('Error loading completed requests:', error);
      toast({
        title: "Error",
        description: "Failed to load completed requests",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const filterRequests = () => {
    let filtered = allRequests.filter((request: Request) => request.status === activeTab);

    if (searchTerm.trim()) {
      filtered = filtered.filter((request: Request) =>
        (request.team_leader_name && request.team_leader_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (request.team_leader_phone && request.team_leader_phone.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (request.project_name && request.project_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (request.created_by && request.created_by.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    if (filterDate !== 'all') {
      const today = new Date();
      const filterDays = parseInt(filterDate);
      today.setHours(0, 0, 0, 0);

      const cutoffDate = new Date(today);
      cutoffDate.setDate(cutoffDate.getDate() - filterDays);

      filtered = filtered.filter((request: Request) => {
        const requestDate = new Date(request.updated_at);
        return requestDate >= cutoffDate;
      });
    }

    setFilteredRequests(filtered);
  };

  const exportToCSV = async () => {
    try {
      const headers = ["Request ID", "Project Name", "Created By", "Team Leader", "Project Type", "Item", "Quantity Requested", "Quantity Received", "Approved By", "Date Finalized"];
      const rows = [];
      
      for (const request of filteredRequests as Request[]) {
        const approvedBy = request.details?.approvals[0]?.approver_name || 'N/A';
        for (const item of (request.details?.items || [])) {
          rows.push([
            request.id,
            request.project_name,
            request.created_by,
            request.team_leader_name,
            request.deployment_type,
            item.item_name,
            item.quantity_requested || 0,
            item.quantity_received || 0,
            approvedBy,
            new Date(request.updated_at).toLocaleString()
          ]);
        }
      }

      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.join(","))
      ].join("\n");

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.setAttribute('hidden', '');
      a.setAttribute('href', url);
      a.setAttribute('download', `items-out-report-${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export data",
        variant: "destructive"
      });
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'rejected': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return null;
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading finalized requests...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Items Out History</h1>
          <p className="text-gray-600 mt-1">Track all finalized and rejected issuances with logs</p>
        </div>
        <div className="mt-4 md:mt-0">
          <Button
            variant="outline"
            onClick={exportToCSV}
            className="flex items-center border-gray-300 rounded-lg"
          >
            <Download className="h-5 w-5 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-6">
        <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4">
          <div className="relative flex-1">
            <Search className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input
              type="text"
              placeholder="Search by creator, team leader or project..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <Filter className="h-5 w-5 text-gray-500" />
            <select
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Time</option>
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="90">Last 90 Days</option>
            </select>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="completed">Completed ({allRequests.filter(r => r.status === 'completed').length})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({allRequests.filter(r => r.status === 'rejected').length})</TabsTrigger>
        </TabsList>
        <TabsContent value={activeTab} className="mt-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Request ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team Leader</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created By</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Approved By</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Finalized</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(filteredRequests as Request[]).map((request) => {
                    if (!request.details) {
                      return (
                        <tr key={request.id} className="hover:bg-gray-50 transition-colors">
                          <td colSpan={10} className="px-6 py-4 text-center text-gray-500">
                            Loading details...
                          </td>
                        </tr>
                      );
                    }
                    const approvedBy = request.details.approvals[0]?.approver_name || 'N/A';
                    return (
                      <tr key={request.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap border-r border-gray-200">
                          <Link to={`/request-forms/${request.id}`} className="text-blue-600 hover:underline font-medium">
                            {request.id}
                          </Link>
                        </td>
                        <td className="px-6 py-4 border-r border-gray-200">
                          <div className="text-sm font-medium text-gray-900">{request.project_name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap border-r border-gray-200">
                          <div className="text-sm font-medium text-gray-900">{request.team_leader_name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap border-r border-gray-200">
                          <div className="text-sm text-gray-900">{request.created_by}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap border-r border-gray-200">
                          <div className="text-sm font-medium text-gray-900 capitalize">{request.deployment_type}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap border-r border-gray-200">
                          <div className="text-sm font-medium text-gray-900">{request.item_count}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap border-r border-gray-200">
                          <div className="text-sm text-gray-900">{approvedBy}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap border-r border-gray-200">
                          <div className="flex items-center text-sm text-gray-900">
                            <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                            {new Date(request.updated_at).toLocaleDateString()}
                          </div>
                          <div className="text-sm text-gray-500">
                            {new Date(request.updated_at).toLocaleTimeString()}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap border-r border-gray-200">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor(request.status)}`}>
                            {statusIcon(request.status)}
                            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Link to={`/request-forms/${request.id}`} className="text-blue-600 hover:text-blue-500 font-medium">
                            View Details
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredRequests.length === 0 && (
              <div className="text-center py-12">
                <ArrowUpRight className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No {activeTab} issuances yet</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ItemsOut;