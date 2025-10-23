import React, { useState, useEffect, useRef } from 'react';
import { Search, XCircle, CheckCircle, AlertCircle, UserCheck } from 'lucide-react';
import { getRequests, getRequestDetails, rejectRequest, finalizeRequest, approveRequest } from '../api';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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
  reject_reason?: string | null; // Added for rejection reason
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
  rejections?: { // Added for rejection details
    id: number;
    request_id: number;
    rejector_name: string;
    reason: string;
    created_at: string;
  }[];
}

const ApprovedForms: React.FC = () => {
  const { user } = useAuth();
  const canManageRequests = user?.role === 'superadmin' || user?.role === 'issuer' || user?.role === 'approver';
  const canFinalize = user?.role === 'superadmin' || user?.role === 'issuer';
  const [allRequests, setAllRequests] = useState<Request[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<Request[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'completed' | 'rejected'>('approved');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RequestDetails | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);
  const [approverName, setApproverName] = useState('');
  const [signature, setSignature] = useState('');
  const [rejectReason, setRejectReason] = useState(''); // Added for rejection reason
  const [loading, setLoading] = useState(true);
  const [isInteracting, setIsInteracting] = useState(false); // Track if user is in a modal/form
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  // Pause polling when interacting (modals open)
  useEffect(() => {
    const anyModalOpen = isFormOpen || isRejectOpen || isApproveOpen;
    setIsInteracting(anyModalOpen);
  }, [isFormOpen, isRejectOpen, isApproveOpen]);

  useEffect(() => {
    const loadRequests = async () => {
      // Skip load if user is interacting (modal open) to prevent clearing forms
      if (isInteracting) {
        console.log('Skipping request reload due to active interaction');
        return;
      }

      try {
        setLoading(true);
        const data = await getRequests();
        const filteredData = canManageRequests 
          ? data 
          : data.filter(request => ['approved', 'completed', 'rejected'].includes(request.status));
        setAllRequests(filteredData);
      } catch (error) {
        console.error('Error loading requests:', error);
        toast({
          title: "Error",
          description: "Failed to load requests",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    loadRequests();
    intervalRef.current = setInterval(loadRequests, 30000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [canManageRequests, isInteracting]); // Re-run effect if interaction state changes

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

    if (!canFinalize) {
      toast({
        title: "Access Denied",
        description: "Super Admin or Issuer access required to finalize requests",
        variant: "destructive"
      });
      return;
    }

    try {
      await finalizeRequest(selectedRequest.id, data.items, data.releasedBy);
      setIsFormOpen(false);
      setSelectedRequest(null);
      setIsInteracting(false); // Resume polling after action
      toast({
        title: "Success",
        description: "Request finalized successfully",
        variant: "default"
      });
      // Optionally reload after success
      const loadRequests = async () => {
        try {
          const data = await getRequests();
          const filteredData = canManageRequests 
            ? data 
            : data.filter(request => ['approved', 'completed', 'rejected'].includes(request.status));
          setAllRequests(filteredData);
        } catch (error) {
          console.error('Error reloading requests after finalize:', error);
        }
      };
      loadRequests();
    } catch (error: any) {
      console.error('Error finalizing request:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to finalize request",
        variant: "destructive"
      });
    }
  };

  const handleApprove = async () => {
    if (!selectedRequestId || !approverName || !signature) return;
    try {
      await approveRequest(selectedRequestId, { approverName, signature });
      setIsApproveOpen(false);
      setApproverName('');
      setSignature('');
      setIsInteracting(false); // Resume polling
      toast({
        title: "Success",
        description: "Request approved successfully",
        variant: "default"
      });
      // Reload after approve
      const loadRequests = async () => {
        try {
          const data = await getRequests();
          const filteredData = canManageRequests 
            ? data 
            : data.filter(request => ['approved', 'completed', 'rejected'].includes(request.status));
          setAllRequests(filteredData);
        } catch (error) {
          console.error('Error reloading requests after approve:', error);
        }
      };
      loadRequests();
    } catch (error: any) {
      console.error('Error approving request:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to approve request",
        variant: "destructive"
      });
    }
  };

  const handleReject = async () => {
    if (!selectedRequestId || !rejectReason.trim()) {
      toast({
        title: "Error",
        description: "Rejection reason is required",
        variant: "destructive"
      });
      return;
    }
    try {
      const rejectorName = user?.full_name || user?.username || 'Unknown User';
      await rejectRequest(selectedRequestId, { reason: rejectReason, rejectorName });
      setIsRejectOpen(false);
      setRejectReason('');
      setIsInteracting(false); // Resume polling
      toast({
        title: "Success",
        description: "Request rejected successfully",
        variant: "default"
      });
      // Reload after reject
      const loadRequests = async () => {
        try {
          const data = await getRequests();
          const filteredData = canManageRequests 
            ? data 
            : data.filter(request => ['approved', 'completed', 'rejected'].includes(request.status));
          setAllRequests(filteredData);
        } catch (error) {
          console.error('Error reloading requests after reject:', error);
        }
      };
      loadRequests();
    } catch (error: any) {
      console.error('Error rejecting request:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to reject request",
        variant: "destructive"
      });
    }
  };

  const openFinalizeForm = async (requestId: number) => {
    if (!canFinalize) {
      toast({
        title: "Access Denied",
        description: "Super Admin or Issuer access required to finalize requests",
        variant: "destructive"
      });
      return;
    }

    try {
      const details = await getRequestDetails(requestId);
      setSelectedRequest(details);
      setIsFormOpen(true);
      setIsInteracting(true); // Pause polling
    } catch (error) {
      console.error('Error loading request details:', error);
      toast({
        title: "Error",
        description: "Failed to load request details",
        variant: "destructive"
      });
    }
  };

  const openApproveForm = async (requestId: number) => {
    setSelectedRequestId(requestId);
    setIsApproveOpen(true);
    setIsInteracting(true); // Pause polling
  };

  const openRejectForm = (requestId: number) => {
    setSelectedRequestId(requestId);
    setRejectReason(''); // Reset reason
    setIsRejectOpen(true);
    setIsInteracting(true); // Pause polling
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <UserCheck className="h-4 w-4" />;
      case 'approved': return <CheckCircle className="h-4 w-4" />;
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'rejected': return <XCircle className="h-4 w-4" />;
      default: return null;
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const tabs = canManageRequests ? 
    ['pending', 'approved', 'completed', 'rejected'] : 
    ['approved', 'completed', 'rejected'];

  const tabCounts = {
    pending: allRequests.filter(r => r.status === 'pending').length,
    approved: allRequests.filter(r => r.status === 'approved').length,
    completed: allRequests.filter(r => r.status === 'completed').length,
    rejected: allRequests.filter(r => r.status === 'rejected').length,
  };

  if (loading) {
    return <SkeletonTable canManageRequests={canManageRequests} tabs={tabs} />;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Request Management</h1>
          <p className="text-gray-600 mt-1">{canManageRequests ? 'Review and approve pending requests' : 'Manage approved requests with full logs'}</p>
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
        <TabsList className={`grid ${canManageRequests ? 'grid-cols-4' : 'grid-cols-3'} w-full bg-gray-50 rounded-xl p-1`}>
          {canManageRequests && (
            <TabsTrigger value="pending" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">
              Pending ({tabCounts.pending})
            </TabsTrigger>
          )}
          <TabsTrigger value="approved" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">
            Approved ({tabCounts.approved})
          </TabsTrigger>
          <TabsTrigger value="completed" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">
            Completed ({tabCounts.completed})
          </TabsTrigger>
          <TabsTrigger value="rejected" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">
            Rejected ({tabCounts.rejected})
          </TabsTrigger>
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
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
                        <div className="text-sm text-gray-900">{new Date(request.created_at).toLocaleDateString()}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap border-r border-gray-200">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor(request.status)}`}>
                          {statusIcon(request.status)}
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                          {request.status === 'rejected' && request.reject_reason && (
                            <div className="ml-2 text-xs bg-red-200 px-2 py-1 rounded-full max-w-32 truncate" title={request.reject_reason}>
                              {request.reject_reason.length > 20 ? `${request.reject_reason.substring(0, 20)}...` : request.reject_reason}
                            </div>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-x-2">
                          <Link to={`/request-forms/${request.id}`} className="text-indigo-600 hover:text-indigo-500 text-sm font-medium">
                            View
                          </Link>
                          {request.status === 'pending' && canManageRequests && (
                            <>
                              <Button
                                onClick={() => openApproveForm(request.id)}
                                size="sm"
                                className="bg-blue-600 text-white hover:bg-blue-700 rounded-lg"
                              >
                                Approve
                              </Button>
                              <Button
                                onClick={() => openRejectForm(request.id)}
                                variant="destructive"
                                size="sm"
                                className="rounded-lg"
                              >
                                Reject
                              </Button>
                            </>
                          )}
                          {request.status === 'approved' && (
                            <>
                              {canFinalize && (
                                <Button
                                  onClick={() => openFinalizeForm(request.id)}
                                  size="sm"
                                  className="bg-green-600 text-white hover:bg-green-700 rounded-lg"
                                >
                                  Finalize
                                </Button>
                              )}
                              {canManageRequests && (
                                <Button
                                  onClick={() => openRejectForm(request.id)}
                                  variant="destructive"
                                  size="sm"
                                  className="rounded-lg"
                                >
                                  Reject
                                </Button>
                              )}
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
              setIsInteracting(false); // Resume polling
            }}
          />
        </div>
      )}

      {isApproveOpen && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 mb-6">
          <div className="text-center mb-6">
            <img src="/vobiss-logo.png" alt="Vobiss Logo" className="mx-auto h-12 w-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900">APPROVE REQUEST</h2>
            <p className="text-gray-600">Provide your approval details</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Approver Name *</label>
              <Input
                value={approverName}
                onChange={(e) => setApproverName(e.target.value)}
                placeholder="Enter your full name"
                className="w-full border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 rounded-lg px-4 py-3"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Signature/Notes *</label>
              <Input
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                placeholder="Enter signature or approval notes"
                className="w-full border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 rounded-lg px-4 py-3"
              />
            </div>
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <Button variant="outline" onClick={() => { setIsApproveOpen(false); setIsInteracting(false); }} className="border-gray-300 rounded-lg">Cancel</Button>
              <Button 
                onClick={handleApprove}
                disabled={!approverName.trim() || !signature.trim()}
                className="bg-blue-600 text-white hover:bg-blue-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Approve Request
              </Button>
            </div>
          </div>
        </div>
      )}

      {isRejectOpen && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 mb-6">
          <div className="text-center mb-6">
            <img src="/vobiss-logo.png" alt="Vobiss Logo" className="mx-auto h-12 w-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900">REJECT REQUEST</h2>
            <p className="text-gray-600">Provide a reason for rejection. This will be logged and visible in request details.</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Rejection Reason *</label>
              <Input
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter the reason for rejecting this request"
                className="w-full border border-gray-300 focus:ring-2 focus:ring-red-500 focus:border-red-500 rounded-lg px-4 py-3"
              />
            </div>
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <Button variant="outline" onClick={() => { setIsRejectOpen(false); setRejectReason(''); setIsInteracting(false); }} className="border-gray-300 rounded-lg">Cancel</Button>
              <Button 
                onClick={handleReject}
                disabled={!rejectReason.trim()}
                variant="destructive" 
                className="rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reject Request
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface SkeletonTableProps {
  canManageRequests: boolean;
  tabs: ('pending' | 'approved' | 'completed' | 'rejected')[];
}

const SkeletonTable: React.FC<SkeletonTableProps> = ({ canManageRequests, tabs }) => {
  const numRows = 5; // Number of skeleton rows to show

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 animate-pulse">
        <div className="space-y-2">
          <div className="h-8 w-48 bg-gray-200 rounded"></div>
          <div className="h-4 w-64 bg-gray-200 rounded"></div>
        </div>
      </div>

      {/* Search Bar Skeleton */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-6 animate-pulse">
        <div className="h-10 w-full bg-gray-200 rounded-lg"></div>
      </div>

      {/* Tabs Skeleton */}
      <div className="w-full animate-pulse">
        <div className={`grid ${canManageRequests ? 'grid-cols-4' : 'grid-cols-3'} w-full bg-gray-50 rounded-xl p-1 mb-6`}>
          {tabs.map((tab, index) => (
            <div key={index} className="h-10 bg-gray-200 rounded-lg"></div>
          ))}
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-pulse">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Request ID', 'Project', 'Team Leader', 'Created By', 'Project Type', 'Items', 'Created At', 'Status', 'Actions'].map((header, index) => (
                  <th key={index} className="px-6 py-3">
                    <div className="h-4 w-full bg-gray-200 rounded"></div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {Array.from({ length: numRows }).map((_, rowIndex) => (
                <tr key={rowIndex}>
                  {Array.from({ length: 9 }).map((_, colIndex) => (
                    <td key={colIndex} className="px-6 py-4">
                      <div className={`h-4 ${colIndex < 8 ? 'w-32' : 'w-48'} bg-gray-200 rounded`}></div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

interface FinalizeFormProps {
  request: RequestDetails;
  onSave: (data: { items: { itemId: number; quantityReceived: number; quantityReturned: number }[]; releasedBy: string }) => void;
  onCancel: () => void;
}

const FinalizeForm: React.FC<FinalizeFormProps> = ({ request, onSave, onCancel }) => {
  const [items, setItems] = useState(request.items.map((item, index) => ({
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
      if (received > (item.current_stock || 0)) {
        newErrors[index] = `Received quantity cannot exceed available stock (${item.current_stock || 0}).`;
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

  const handleItemChange = (index: number, field: 'quantityReceived' | 'quantityReturned', value: number) => {
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
          <label className="block text-sm font-semibold text-gray-700">Project Type</label>
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
            const isOverStock = received > (item.current_stock || 0);
            return (
              <div key={item.id} className={`p-4 rounded-lg border shadow-sm transition-all ${
                itemError ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-gray-900 text-base">{item.item_name}</span>
                  <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">Requested: {item.quantity_requested}</span>
                </div>
                <div className="mb-3 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                  <strong>Available Stock (from DB):</strong> <span className="font-mono bg-white px-2 py-1 rounded text-green-800">{item.current_stock || 0}</span>
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