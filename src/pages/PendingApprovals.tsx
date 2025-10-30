import React, { useState, useEffect } from 'react';
import { Search, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { getRequests, approveRequest, rejectRequest } from '../api';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';

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
  reject_reason?: string | null;
}

const PendingApprovals: React.FC = () => {
  const { user } = useAuth();
  const [allRequests, setAllRequests] = useState<Request[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<Request[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'completed' | 'rejected'>('pending');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadRequests();
  }, []);

  useEffect(() => {
    filterRequests();
  }, [allRequests, searchTerm, activeTab]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const data = await getRequests();
      setAllRequests(data);
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

  const handleApprove = async (approverData: { approverName: string; signature: string }) => {
    if (!selectedRequestId) return;
    try {
      await approveRequest(selectedRequestId, approverData);
      setIsModalOpen(false);
      toast({
        title: "Success",
        description: "Request approved and moved to final review",
        variant: "default"
      });
      loadRequests();
    } catch (error) {
      console.error('Error approving request:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to approve request",
        variant: "destructive"
      });
    }
  };

  const handleReject = async (reason: string) => {
    if (!selectedRequestId || !reason.trim()) {
      toast({
        title: "Error",
        description: "Rejection reason is required",
        variant: "destructive"
      });
      return;
    }
    try {
      const rejectorName = user?.full_name || user?.username || 'Unknown User';
      await rejectRequest(selectedRequestId, { reason, rejectorName });
      setIsRejectModalOpen(false);
      toast({
        title: "Success",
        description: "Request rejected successfully",
        variant: "default"
      });
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

  const statusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'approved': return <CheckCircle className="h-4 w-4 text-blue-500" />;
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'rejected': return <XCircle className="h-4 w-4 text-red-500" />;
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

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading requests...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Approval History</h1>
          <p className="text-gray-600 mt-1">Review all requests with full logs and status history</p>
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
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="pending">Pending ({allRequests.filter(r => r.status === 'pending').length})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({allRequests.filter(r => r.status === 'approved').length})</TabsTrigger>
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created By</th>
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
                        <div className="text-sm text-gray-900">{request.team_leader_phone}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap border-r border-gray-200">
                        <div className="text-sm text-gray-900">{request.created_by}</div>
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
                          <Link to={`/request-forms/${request.id}`} className="text-blue-600 hover:text-blue-500 text-sm font-medium">
                            Edit
                          </Link>
                          <Link to={`/request-forms/${request.id}`} className="text-indigo-600 hover:text-indigo-500 text-sm font-medium">
                            View
                          </Link>
                          {request.status === 'pending' && (
                            <>
                              <Button
                                onClick={() => {
                                  setSelectedRequestId(request.id);
                                  setIsModalOpen(true);
                                }}
                                size="sm"
                                className="bg-green-600 text-white hover:bg-green-700 rounded-lg"
                              >
                                Approve
                              </Button>
                              <Button
                                onClick={() => {
                                  setSelectedRequestId(request.id);
                                  setIsRejectModalOpen(true);
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

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Approve Request">
        <ApprovalForm onSave={handleApprove} onCancel={() => setIsModalOpen(false)} />
      </Modal>

      <Modal isOpen={isRejectModalOpen} onClose={() => setIsRejectModalOpen(false)} title="Reject Request">
        <RejectForm onSave={handleReject} onCancel={() => setIsRejectModalOpen(false)} />
      </Modal>
    </div>
  );
};

interface ApprovalFormProps {
  onSave: (data: { approverName: string; signature: string }) => void;
  onCancel: () => void;
}

const ApprovalForm: React.FC<ApprovalFormProps> = ({ onSave, onCancel }) => {
  const [approverName, setApproverName] = useState('');
  const [signature, setSignature] = useState('');

  const handleSubmit = () => {
    if (!approverName || !signature) {
      alert('Please fill all fields');
      return;
    }
    onSave({ approverName, signature });
  };

  return (
    <div className="space-y-6 p-4 max-w-md mx-auto">
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700 mb-1">Approver Name *</label>
        <p className="text-xs text-gray-500 mb-2">Enter your full name as the approver.</p>
        <Input
          value={approverName}
          onChange={(e) => setApproverName(e.target.value)}
          placeholder="e.g., John Doe"
          className="w-full border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
        />
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700 mb-1">Digital Signature / Approval Notes *</label>
        <p className="text-xs text-gray-500 mb-2">Provide your digital signature or detailed approval notes. Use multiple lines if needed for clarity.</p>
        <Textarea
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
          placeholder="e.g., Approved with no issues. Proceed to deployment. Signed: John Doe"
          className="w-full h-32 resize-none border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
          rows={4}
        />
      </div>
      <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
        <Button 
          variant="outline" 
          onClick={onCancel} 
          className="border-gray-300 rounded-lg px-6 py-2"
        >
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit} 
          className="bg-green-600 text-white hover:bg-green-700 rounded-lg px-6 py-2 font-semibold"
        >
          Approve Request
        </Button>
      </div>
    </div>
  );
};

interface RejectFormProps {
  onSave: (reason: string) => void;
  onCancel: () => void;
}

const RejectForm: React.FC<RejectFormProps> = ({ onSave, onCancel }) => {
  const [reason, setReason] = useState('');

  const handleSubmit = () => {
    if (!reason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }
    onSave(reason);
  };

  return (
    <div className="space-y-6 p-4 max-w-md mx-auto">
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700 mb-1">Rejection Reason *</label>
        <p className="text-xs text-gray-500 mb-2">Provide a detailed reason for rejection to help the requester understand and improve.</p>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g., Missing required documentation for the project. Please resubmit with attachments."
          className="w-full h-40 resize-none border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
          rows={6}
        />
      </div>
      <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
        <Button 
          variant="outline" 
          onClick={onCancel} 
          className="border-gray-300 rounded-lg px-6 py-2"
        >
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit} 
          variant="destructive" 
          className="rounded-lg px-6 py-2 font-semibold"
        >
          Reject Request
        </Button>
      </div>
    </div>
  );
};

export default PendingApprovals;