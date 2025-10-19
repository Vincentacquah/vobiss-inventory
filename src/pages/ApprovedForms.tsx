import React, { useState, useEffect } from 'react';
import { Search, XCircle, CheckCircle, AlertCircle } from 'lucide-react';
import { getRequests, getRequestDetails, rejectRequest, finalizeRequest } from '../api';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
}

interface RequestDetails extends Request {
  items: {
    id: number;
    request_id: number;
    item_id: number;
    quantity_requested: number | null;
    quantity_received: number | null;
    quantity_returned: number | null;
    item_name: string;
    current_stock: number;
  }[];
  approvals: {
    id: number;
    request_id: number;
    approver_name: string;
    signature: string;
    approved_at: string;
  }[];
}

const ApprovedForms: React.FC = () => {
  const [allRequests, setAllRequests] = useState<Request[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<Request[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'approved' | 'completed' | 'rejected'>('approved');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RequestDetails | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const loadRequests = async () => {
      try {
        setLoading(true);
        const data = await getRequests();
        setAllRequests(data.filter(request => ['approved', 'completed', 'rejected'].includes(request.status)) || []);
      } catch (error) {
        console.error('Error loading requests:', error);
        toast({
          title: "Error",
          description: "Failed to load approved requests",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    loadRequests();
    const interval = setInterval(loadRequests, 30000); // Increased to 30 seconds to reduce shaking

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    filterRequests();
  }, [allRequests, searchTerm, activeTab]);

  const filterRequests = () => {
    let filtered = allRequests.filter(request => request.status === activeTab);
    if (searchTerm.trim()) {
      filtered = filtered.filter(request =>
        (request.team_leader_name && request.team_leader_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (request.team_leader_phone && request.team_leader_phone.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (request.project_name && request.project_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (request.created_by && request.created_by.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    setFilteredRequests(filtered);
  };

  const handleFinalize = async (data: { items: { itemId: number; quantityReceived: number; quantityReturned: number }[]; releasedBy: string }) => {
    if (!selectedRequest) return;
    try {
      await finalizeRequest(selectedRequest.id, data.items, data.releasedBy);
      setIsFormOpen(false);
      setSelectedRequest(null);
      toast({
        title: "Success",
        description: "Request finalized successfully",
        variant: "default"
      });
    } catch (error: any) {
      console.error('Error finalizing request:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to finalize request",
        variant: "destructive"
      });
    }
  };

  const handleReject = async () => {
    if (!selectedRequestId) return;
    try {
      await rejectRequest(selectedRequestId);
      setIsRejectOpen(false);
      toast({
        title: "Success",
        description: "Request rejected",
        variant: "default"
      });
    } catch (error) {
      console.error('Error rejecting request:', error);
      toast({
        title: "Error",
        description: "Failed to reject request",
        variant: "destructive"
      });
    }
  };

  const openFinalizeForm = async (requestId: number) => {
    try {
      const details = await getRequestDetails(requestId);
      setSelectedRequest(details);
      setIsFormOpen(true);
    } catch (error) {
      console.error('Error loading request details:', error);
      toast({
        title: "Error",
        description: "Failed to load request details",
        variant: "destructive"
      });
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="h-4 w-4" />;
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'rejected': return <XCircle className="h-4 w-4" />;
      default: return null;
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading approved requests...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Final Review History</h1>
          <p className="text-gray-600 mt-1">Manage approved requests with full logs</p>
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
              className="w-full pl-10 pr-4 py-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500"
            />
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-gray-50 rounded-xl p-1">
          <TabsTrigger value="approved" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">Approved ({allRequests.filter(r => r.status === 'approved').length})</TabsTrigger>
          <TabsTrigger value="completed" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">Completed ({allRequests.filter(r => r.status === 'completed').length})</TabsTrigger>
          <TabsTrigger value="rejected" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">Rejected ({allRequests.filter(r => r.status === 'rejected').length})</TabsTrigger>
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deployment Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Approved At</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredRequests.map((request) => (
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
                        <div className="text-sm text-gray-900">{new Date(request.updated_at).toLocaleDateString()}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap border-r border-gray-200">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor(request.status)}`}>
                          {statusIcon(request.status)}
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-x-2">
                          <Link to={`/request-forms/${request.id}`} className="text-indigo-600 hover:text-indigo-500 text-sm font-medium">
                            View
                          </Link>
                          {request.status === 'approved' && (
                            <>
                              <Button
                                onClick={() => openFinalizeForm(request.id)}
                                size="sm"
                                className="bg-green-600 text-white hover:bg-green-700 rounded-lg"
                              >
                                Finalize
                              </Button>
                              <Button
                                onClick={() => {
                                  setSelectedRequestId(request.id);
                                  setIsRejectOpen(true);
                                }}
                                variant="destructive"
                                size="sm"
                                className="rounded-lg"
                              >
                                Reject
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredRequests.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-600">No {activeTab} requests</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {isFormOpen && selectedRequest && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 mb-6">
          <div className="text-center mb-6">
            <img src="/vobiss-logo.png" alt="Vobiss Logo" className="mx-auto h-12 w-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900">FINALIZE REQUEST</h2>
            <p className="text-gray-600 mt-1">Review and confirm quantities received and returned</p>
          </div>
          <FinalizeForm
            request={selectedRequest}
            onSave={handleFinalize}
            onCancel={() => {
              setIsFormOpen(false);
              setSelectedRequest(null);
            }}
          />
        </div>
      )}

      {isRejectOpen && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 mb-6">
          <div className="text-center mb-6">
            <img src="/vobiss-logo.png" alt="Vobiss Logo" className="mx-auto h-12 w-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900">REJECT REQUEST</h2>
          </div>
          <div className="space-y-4">
            <p className="text-gray-600">Are you sure you want to reject this request? It will be marked as rejected and cannot be finalized.</p>
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <Button variant="outline" onClick={() => setIsRejectOpen(false)} className="border-gray-300 rounded-lg">Cancel</Button>
              <Button variant="destructive" onClick={handleReject} className="rounded-lg">Reject</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface FinalizeFormProps {
  request: RequestDetails;
  onSave: (data: { items: { itemId: number; quantityReceived: number; quantityReturned: number }[]; releasedBy: string }) => void;
  onCancel: () => void;
}

const FinalizeForm: React.FC<FinalizeFormProps> = ({ request, onSave, onCancel }) => {
  const [items, setItems] = useState(request.items.map(item => ({
    itemId: item.item_id,
    quantityReceived: item.quantity_received || item.quantity_requested || 0,
    quantityReturned: item.quantity_returned || 0,
  })));
  const [releasedBy, setReleasedBy] = useState('');
  const [errors, setErrors] = useState<{ [key: number]: string }>({});
  const [submitError, setSubmitError] = useState('');

  const validateItems = () => {
    const newErrors: { [key: number]: string } = {};
    let hasErrors = false;

    request.items.forEach((item, index) => {
      const received = items[index]?.quantityReceived || 0;
      if (received > item.current_stock) {
        newErrors[index] = `Received quantity cannot exceed available stock (${item.current_stock}).`;
        hasErrors = true;
      }
      if (received < 0 || (items[index]?.quantityReturned || 0) < 0) {
        newErrors[index] = 'Quantities cannot be negative.';
        hasErrors = true;
      }
    });

    setErrors(newErrors);
    return !hasErrors;
  };

  const handleItemChange = (index: number, field: string, value: number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
    // Clear error for this item on change
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[index];
      return newErrors;
    });
    setSubmitError('');
  };

  const handleSubmit = () => {
    if (!releasedBy.trim()) {
      setSubmitError('Please enter Released By name');
      return;
    }

    const isValid = validateItems();
    if (!isValid) {
      setSubmitError('Please fix the errors in the items section.');
      return;
    }

    onSave({ items, releasedBy });
  };

  return (
    <div className="space-y-6 w-full">
      {submitError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center space-x-2">
          <AlertCircle className="h-4 w-4" />
          <span>{submitError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-gray-700">Project Name</label>
          <Input
            value={request.project_name}
            disabled
            className="border border-gray-300 focus:ring-2 focus:ring-gray-500 focus:border-gray-500 rounded-lg px-4 py-3 shadow-sm bg-gray-50"
          />
        </div>
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-gray-700">ISP Name</label>
          <Input
            value={request.isp_name || 'N/A'}
            disabled
            className="border border-gray-300 focus:ring-2 focus:ring-gray-500 focus:border-gray-500 rounded-lg px-4 py-3 shadow-sm bg-gray-50"
          />
        </div>
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-gray-700">Created By</label>
          <Input
            value={request.created_by}
            disabled
            className="border border-gray-300 focus:ring-2 focus:ring-gray-500 focus:border-gray-500 rounded-lg px-4 py-3 shadow-sm bg-gray-50"
          />
        </div>
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-gray-700">Team Leader</label>
          <Input
            value={request.team_leader_name}
            disabled
            className="border border-gray-300 focus:ring-2 focus:ring-gray-500 focus:border-gray-500 rounded-lg px-4 py-3 shadow-sm bg-gray-50"
          />
        </div>
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-gray-700">Phone</label>
          <Input
            value={request.team_leader_phone}
            disabled
            className="border border-gray-300 focus:ring-2 focus:ring-gray-500 focus:border-gray-500 rounded-lg px-4 py-3 shadow-sm bg-gray-50"
          />
        </div>
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-gray-700">Location</label>
          <Input
            value={request.location}
            disabled
            className="border border-gray-300 focus:ring-2 focus:ring-gray-500 focus:border-gray-500 rounded-lg px-4 py-3 shadow-sm bg-gray-50"
          />
        </div>
        <div className="md:col-span-2 space-y-3">
          <label className="block text-sm font-semibold text-gray-700">Deployment Type</label>
          <Input
            value={request.deployment_type}
            disabled
            className="border border-gray-300 focus:ring-2 focus:ring-gray-500 focus:border-gray-500 rounded-lg px-4 py-3 shadow-sm bg-gray-50"
          />
        </div>
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-gray-700">Released By *</label>
          <Input
            value={releasedBy}
            onChange={(e) => setReleasedBy(e.target.value)}
            placeholder="Enter your full name as the releaser"
            className="border border-gray-300 focus:ring-2 focus:ring-gray-500 focus:border-gray-500 rounded-lg px-4 py-3 shadow-sm"
          />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2 flex items-center">
          Initial Approvals
          {request.approvals.length > 0 && (
            <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">{request.approvals.length}</span>
          )}
        </h3>
        <div className="bg-gray-50 p-4 rounded-lg space-y-3 max-h-48 overflow-y-auto">
          {request.approvals.length > 0 ? (
            request.approvals.map((approval) => (
              <div key={approval.id} className="text-sm border-l-4 border-blue-300 pl-3 bg-white rounded-lg p-3 shadow-sm">
                <p className="font-semibold text-gray-900">{approval.approver_name}</p>
                <p className="text-gray-500 text-xs">{new Date(approval.approved_at).toLocaleString()}</p>
                <p className="text-gray-500 text-xs italic mt-1">Signature: {approval.signature}</p>
              </div>
            ))
          ) : (
            <p className="text-gray-500 italic text-center py-4">No initial approvals recorded</p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">Items (Update Quantities)</h3>
        <p className="text-sm text-gray-600">Available stock values are fetched directly from the database. Ensure received quantities do not exceed available stock.</p>
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {request.items.map((item, index) => {
            const received = items[index]?.quantityReceived || 0;
            const returned = items[index]?.quantityReturned || 0;
            const itemError = errors[index];
            const isOverStock = received > item.current_stock;
            return (
              <div key={index} className={`p-4 rounded-lg border shadow-sm transition-all ${
                itemError ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-gray-900 text-base">{item.item_name}</span>
                  <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">Requested: {item.quantity_requested}</span>
                </div>
                <div className="mb-3 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                  <strong>Available Stock (from DB):</strong> <span className="font-mono bg-white px-2 py-1 rounded text-green-800">{item.current_stock}</span>
                  {isOverStock && (
                    <div className="mt-1 flex items-center text-red-600 text-xs">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Exceeds available stock
                    </div>
                  )}
                </div>
                {itemError && (
                  <div className="mb-3 text-red-600 text-xs flex items-center">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {itemError}
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-gray-700">Quantity Received</label>
                    <Input
                      type="number"
                      value={received}
                      onChange={(e) => handleItemChange(index, 'quantityReceived', parseInt(e.target.value) || 0)}
                      min="0"
                      className={`w-full border focus:ring-2 focus:ring-gray-500 focus:border-gray-500 rounded-lg px-3 py-2 shadow-sm ${
                        isOverStock ? 'border-red-300 bg-red-50' : 'border-gray-300'
                      }`}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-gray-700">Quantity Returned</label>
                    <Input
                      type="number"
                      value={returned}
                      onChange={(e) => handleItemChange(index, 'quantityReturned', parseInt(e.target.value) || 0)}
                      min="0"
                      className="w-full border border-gray-300 focus:ring-2 focus:ring-gray-500 focus:border-gray-500 rounded-lg px-3 py-2 shadow-sm"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
        <Button
          variant="outline"
          onClick={onCancel}
          className="border-gray-300 hover:bg-gray-50 rounded-lg shadow-sm px-6"
        >
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit}
          disabled={!releasedBy.trim()}
          className="bg-gray-800 text-white hover:bg-gray-900 rounded-lg shadow-sm px-6 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Finalize Request
        </Button>
      </div>
    </div>
  );
};

export default ApprovedForms;