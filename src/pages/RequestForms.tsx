// RequestForms.tsx – FULL COMPONENT (FIXED: Default = All Approvers Selected)
import React, { useState, useEffect, useRef } from 'react';
import { Plus, Search, Clock, CheckCircle, XCircle, User, Users } from 'lucide-react';
import { getRequests, getItems, createRequest, getApprovers } from '../api';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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
  approver_name?: string;
}

interface Item {
  id: number;
  name: string;
  quantity: number;
}

interface Approver {
  id: number;
  fullName: string;
}

const RequestForms: React.FC = () => {
  const [allRequests, setAllRequests] = useState<Request[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<Request[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'completed' | 'rejected'>('pending');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Item[]>([]);
  const [approvers, setApprovers] = useState<Approver[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    loadRequests();
    loadItems();
    loadApprovers();

    const DRAFT_KEY = 'requestFormDraft';
    const TTL = 5 * 60 * 1000;
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const { timestamp } = parsed;
        if (Date.now() - timestamp < TTL) {
          toast({
            title: "Draft Found",
            description: "Opening form with your unsaved progress.",
            variant: "default"
          });
          setIsFormOpen(true);
        } else {
          localStorage.removeItem(DRAFT_KEY);
        }
      } catch (error) {
        console.error('Error checking draft:', error);
        localStorage.removeItem(DRAFT_KEY);
      }
    }
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

  const loadItems = async () => {
    try {
      const data = await getItems();
      setItems(data);
    } catch (error) {
      console.error('Error loading items:', error);
      toast({
        title: "Error",
        description: "Failed to load items",
        variant: "destructive"
      });
    }
  };

  const loadApprovers = async () => {
    try {
      const data = await getApprovers();
      setApprovers(data);
    } catch (error) {
      console.error('Error loading approvers:', error);
      toast({
        title: "Error",
        description: "Failed to load approvers",
        variant: "destructive"
      });
    }
  };

  const filterRequests = () => {
    let filtered = allRequests.filter(request => request.status === activeTab);
    if (searchTerm.trim()) {
      filtered = filtered.filter(request =>
        (request.team_leader_name && request.team_leader_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (request.team_leader_phone && request.team_leader_phone.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (request.project_name && request.project_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (request.created_by && request.created_by.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (request.approver_name && request.approver_name.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    setFilteredRequests(filtered);
  };

  const handleCreateRequest = async (formData: {
    createdBy: string;
    teamLeaderName: string;
    teamLeaderPhone: string;
    projectName: string;
    ispName: string;
    location: string;
    receivedBy: string;
    deployment: 'Deployment' | 'Maintenance';
    items: { name: string; requested: number }[];
    selectedApproverIds: number[];
  }) => {
    try {
      await createRequest({
        createdBy: formData.createdBy,
        teamLeaderName: formData.teamLeaderName,
        teamLeaderPhone: formData.teamLeaderPhone,
        projectName: formData.projectName,
        ispName: formData.ispName,
        location: formData.location,
        releaseBy: null,
        receivedBy: formData.receivedBy,
        deployment: formData.deployment,
        items: formData.items,
      }, formData.selectedApproverIds, 'material_request');

      setIsFormOpen(false);
      toast({
        title: "Success",
        description: `Material request created and sent to ${formData.selectedApproverIds.length} approver(s)`,
        variant: "default"
      });
      loadRequests();
    } catch (error: any) {
      console.error('Error creating request:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create request",
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
          <h1 className="text-3xl font-bold text-gray-900">Request Forms</h1>
          <p className="text-gray-600 mt-1">Create and manage material requests — sent to all approvers by default</p>
        </div>
        <div className="mt-4 md:mt-0">
          <Button
            onClick={() => setIsFormOpen(!isFormOpen)}
            className="bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 flex items-center shadow-lg"
          >
            <Plus className="h-5 w-5 mr-2" />
            {isFormOpen ? 'Close Form' : 'New Request'}
          </Button>
        </div>
      </div>

      {isFormOpen && (
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 mb-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-600"></div>
          <div className="text-center mb-6">
            <img src="/vobiss-logo.png" alt="Vobiss Logo" className="mx-auto h-12 w-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900">REQUEST FORM FOR MATERIALS</h2>
          </div>
          <RequestForm
            onSave={handleCreateRequest}
            onCancel={() => setIsFormOpen(false)}
            items={items}
            approvers={approvers}
          />
        </div>
      )}

      {/* Search & Tabs */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 mb-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-teal-600"></div>
        <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4">
          <div className="relative flex-1">
            <Search className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input
              type="text"
              placeholder="Search by creator, team leader, project or approver..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2"
            />
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-1">
          <TabsTrigger value="pending" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">Pending ({allRequests.filter(r => r.status === 'pending').length})</TabsTrigger>
          <TabsTrigger value="approved" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">Approved ({allRequests.filter(r => r.status === 'approved').length})</TabsTrigger>
          <TabsTrigger value="completed" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">Completed ({allRequests.filter(r => r.status === 'completed').length})</TabsTrigger>
          <TabsTrigger value="rejected" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">Rejected ({allRequests.filter(r => r.status === 'rejected').length})</TabsTrigger>
        </TabsList>
        <TabsContent value={activeTab} className="mt-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Request ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team Leader</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created By</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned Approver</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Release By</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Received By</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredRequests.map((request) => (
                    <tr key={request.id} className="hover:bg-gray-50/50 transition-all duration-200">
                      <td className="px-6 py-4 whitespace-nowrap border-r border-gray-200">
                        <Link to={`/request-forms/${request.id}`} className="text-blue-600 hover:underline font-medium transition-colors">
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
                      <td class111 className="px-6 py-4 whitespace-nowrap border-r border-gray-200">
                        <div className="text-sm font-medium text-gray-900 flex items-center">
                          <User className="h-3 w-3 mr-1 text-gray-500" />
                          {request.approver_name || 'Multiple'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap border-r border-gray-200">
                        <div className="text-sm text-gray-900">{request.release_by || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap border-r border-gray-200">
                        <div className="text-sm text-gray-900">{request.received_by || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap border-r border-gray-200">
                        <div className="text-sm font-medium text-gray-900">{request.item_count}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap border-r border-gray-200">
                        <div className="text-sm text-gray-900">{new Date(request.created_at).toLocaleDateString()}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap border-r border-gray-200">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor(request.status)} shadow-sm`}>
                          {statusIcon(request.status)}
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link to={`/request-forms/${request.id}`} className="text-blue-600 hover:text-blue-500 font-medium transition-colors">
                          View Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredRequests.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-600">No {activeTab} requests yet</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

interface RequestFormProps {
  onSave: (formData: {
    createdBy: string;
    teamLeaderName: string;
    teamLeaderPhone: string;
    projectName: string;
    ispName: string;
    location: string;
    receivedBy: string;
    deployment: 'Deployment' | 'Maintenance';
    items: { name: string; requested: number }[];
    selectedApproverIds: number[];
  }) => void;
  onCancel: () => void;
  items: Item[];
  approvers: Approver[];
}

const RequestForm: React.FC<RequestFormProps> = ({ onSave, onCancel, items, approvers }) => {
  const [formData, setFormData] = useState({
    createdBy: '',
    teamLeaderName: '',
    teamLeaderPhone: '',
    projectName: '',
    ispName: '',
    location: '',
    receivedBy: '',
    deployment: 'Deployment' as 'Deployment' | 'Maintenance',
  });
  const [selectedApproverIds, setSelectedApproverIds] = useState<number[]>([]);
  const [selectedItems, setSelectedItems] = useState<{ name: string; requested: string }[]>([{ name: '', requested: '' }]);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const DRAFT_KEY = 'requestFormDraft';
  const TTL = 5 * 60 * 1000;

  // Refs
  const createdByRef = useRef<HTMLInputElement>(null);
  const teamLeaderNameRef = useRef<HTMLInputElement>(null);
  const teamLeaderPhoneRef = useRef<HTMLInputElement>(null);
  const projectNameRef = useRef<HTMLInputElement>(null);
  const ispNameRef = useRef<HTMLInputElement>(null);
  const locationRef = useRef<HTMLInputElement>(null);
  const receivedByRef = useRef<HTMLInputElement>(null);
  const deploymentRefs = useRef<(HTMLInputElement | null)[]>([]);
  const itemNameRefs = useRef<(HTMLSelectElement | null)[]>([]);
  const itemQtyRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-select all approvers on mount & when approvers load
  useEffect(() => {
    if (approvers.length > 0) {
      setSelectedApproverIds(approvers.map(a => a.id));
    }
  }, [approvers]);

  // Load draft
  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const { formData: savedForm, selectedApproverIds: savedIds, selectedItems: savedItems, timestamp } = parsed;
        if (Date.now() - timestamp < TTL) {
          setFormData(savedForm);
          setSelectedApproverIds(savedIds || []);
          setSelectedItems(savedItems || [{ name: '', requested: '' }]);
        } else {
          localStorage.removeItem(DRAFT_KEY);
        }
      } catch (error) {
        console.error('Error loading draft:', error);
        localStorage.removeItem(DRAFT_KEY);
      }
    }
  }, []);

  // Save draft
  useEffect(() => {
    const draft = { formData, selectedApproverIds, selectedItems, timestamp: Date.now() };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [formData, selectedApproverIds, selectedItems]);

  const clearDraft = () => localStorage.removeItem(DRAFT_KEY);

  const handleKeyDown = (e: React.KeyboardEvent, nextRef: any) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      nextRef?.current?.focus();
    }
  };

  const handleApproverToggle = (id: number, checked: boolean) => {
    setSelectedApproverIds(prev =>
      checked ? [...prev, id] : prev.filter(x => x !== id)
    );
  };

  const handleSelectAll = () => {
    if (selectedApproverIds.length === approvers.length) {
      setSelectedApproverIds([]);
    } else {
      setSelectedApproverIds(approvers.map(a => a.id));
    }
  };

  const handleAddItem = () => {
    setSelectedItems([...selectedItems, { name: '', requested: '' }]);
  };

  const handleItemChange = (index: number, field: 'name' | 'requested', value: string) => {
    const newItems = [...selectedItems];
    newItems[index][field] = value;
    setSelectedItems(newItems);
  };

  const removeItemRow = (index: number) => {
    if (selectedItems.length > 1) {
      setSelectedItems(selectedItems.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    if (!formData.createdBy || !formData.teamLeaderName || !formData.projectName || !formData.location || !formData.receivedBy) {
      toast({ title: "Error", description: "Please fill all required fields", variant: "destructive" });
      setSubmitting(false);
      return;
    }

    if (selectedApproverIds.length === 0) {
      toast({ title: "Error", description: "Please select at least one approver", variant: "destructive" });
      setSubmitting(false);
      return;
    }

    const validItems = selectedItems
      .map(item => ({ name: item.name, requested: parseInt(item.requested) || 0 }))
      .filter(item => item.name && item.requested > 0);

    if (validItems.length === 0) {
      toast({ title: "Error", description: "Please add at least one item", variant: "destructive" });
      setSubmitting(false);
      return;
    }

    await onSave({ ...formData, items: validItems, selectedApproverIds });

    // Reset
    setFormData({
      createdBy: '', teamLeaderName: '', teamLeaderPhone: '', projectName: '',
      ispName: '', location: '', receivedBy: '', deployment: 'Deployment'
    });
    setSelectedApproverIds(approvers.map(a => a.id)); // Re-select all
    setSelectedItems([{ name: '', requested: '' }]);
    clearDraft();
    setSubmitting(false);
  };

  const allSelected = approvers.length > 0 && selectedApproverIds.length === approvers.length;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 w-full">
      {/* Form Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ... (all your input fields unchanged) */}
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-gray-700">Created By *</label>
          <Input ref={createdByRef} value={formData.createdBy} onChange={e => setFormData({ ...formData, createdBy: e.target.value })} onKeyDown={e => handleKeyDown(e, teamLeaderNameRef)} placeholder="Your full name" className="rounded-xl" disabled={submitting} />
        </div>
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-gray-700">Team Leader Name *</label>
          <Input ref={teamLeaderNameRef} value={formData.teamLeaderName} onChange={e => setFormData({ ...formData, teamLeaderName: e.target.value })} onKeyDown={e => handleKeyDown(e, teamLeaderPhoneRef)} placeholder="Team leader's name" className="rounded-xl" disabled={submitting} />
        </div>
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-gray-700">Team Leader Phone</label>
          <Input ref={teamLeaderPhoneRef} value={formData.teamLeaderPhone} onChange={e => setFormData({ ...formData, teamLeaderPhone: e.target.value })} onKeyDown={e => handleKeyDown(e, projectNameRef)} placeholder="Phone number" className="rounded-xl" disabled={submitting} />
        </div>
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-gray-700">Project Name *</label>
          <Input ref={projectNameRef} value={formData.projectName} onChange={e => setFormData({ ...formData, projectName: e.target.value })} onKeyDown={e => handleKeyDown(e, ispNameRef)} placeholder="Project name" className="rounded-xl" disabled={submitting} />
        </div>
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-gray-700">ISP Name</label>
          <Input ref={ispNameRef} value={formData.ispName} onChange={e => setFormData({ ...formData, ispName: e.target.value })} onKeyDown={e => handleKeyDown(e, locationRef)} placeholder="ISP name" className="rounded-xl" disabled={submitting} />
        </div>
        <div className="md:col-span-2 space-y-3">
          <label className="block text-sm font-semibold text-gray-700">Location of Project *</label>
          <Input ref={locationRef} value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} onKeyDown={e => handleKeyDown(e, receivedByRef)} placeholder="Project location" className="rounded-xl" disabled={submitting} />
        </div>
        <div className="md:col-span-2 space-y-3">
          <label className="block text-sm font-semibold text-gray-700">Received By *</label>
          <Input ref={receivedByRef} value={formData.receivedBy} onChange={e => setFormData({ ...formData, receivedBy: e.target.value })} onKeyDown={e => handleKeyDown(e, deploymentRefs.current[0])} placeholder="Received by name" className="rounded-xl" disabled={submitting} />
        </div>

        {/* APPROVER SELECTION */}
        <div className="md:col-span-2 space-y-3">
          <label className="block text-sm font-semibold text-gray-700 flex items-center">
            <Users className="h-4 w-4 mr-2 text-gray-500" />
            Assigned Approver(s) * (Default: All Selected)
          </label>
          <div className="border border-gray-300 rounded-xl p-4 shadow-sm bg-gradient-to-b from-blue-50 to-indigo-50 max-h-48 overflow-y-auto">
            <div className="flex items-center space-x-2 mb-3">
              <Checkbox id="select-all" checked={allSelected} onCheckedChange={handleSelectAll} disabled={submitting} />
              <label htmlFor="select-all" className="text-sm font-medium text-blue-700 cursor-pointer">
                {allSelected ? 'Deselect All' : 'Select All'} ({approvers.length})
              </label>
            </div>
            <div className="space-y-2">
              {approvers.map((approver) => (
                <div key={approver.id, approver.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`approver-${approver.id}`}
                    checked={selectedApproverIds.includes(approver.id)}
                    onCheckedChange={(checked) => handleApproverToggle(approver.id, !!checked)}
                    disabled={submitting}
                  />
                  <label htmlFor={`approver fontes-${approver.id}`} className="text-sm text-gray-700 cursor-pointer flex-1">
                    {approver.fullName}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Selected Badges */}
          {selectedApproverIds.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {selectedApproverIds.map(id => {
                const a = approvers.find(a => a.id === id);
                return a ? (
                  <Badge key={id} variant="secondary" className="text-xs font-medium">
                    {a.fullName}
                  </Badge>
                ) : null;
              })}
            </div>
          )}
        </div>
      </div>

      {/* Deployment Type */}
      <div className="space-y-3">
        <label className="block text-sm font-semibold text-gray-700">Type *</label>
        <div className="flex space-x-8 bg-gradient-to-r from-gray-50 to-gray-100 p-4 rounded-xl shadow-sm">
          {['Deployment', 'Maintenance'].map((type, i) => (
            <label key={type} className="flex items-center cursor-pointer space-x-3 bg-white px-4 py-3 rounded-lg shadow-sm hover:shadow-md transition-all">
              <input
                ref={el => deploymentRefs.current[i] = el}
                type="radio"
                value={type}
                checked={formData.deployment === type}
                onChange={e => setFormData({ ...formData, deployment: e.target.value as any })}
                onKeyDown={e => handleKeyDown(e, i === 0 ? deploymentRefs.current[1] : itemNameRefs.current[0])}
                className="h-4 w-4 text-blue-600"
                disabled={submitting}
              />
              <span className="text-sm font-medium">{type}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Items Table */}
      <div className="space-y-4">
        <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-sm bg-gradient-to-b from-white to-gray-50">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-blue-50 to-indigo-50">
                <th className="border-r border-gray-200 p-4 text-left text-xs font-semibold text-gray-700">SRL</th>
                <th className="border-r border-gray-200 p-4 text-left text-xs font-semibold text-gray-700">Name of Material</th>
                <th className="border-r border-gray-200 p-4 text-left text-xs font-semibold text-gray-700">Qty. Requested</th>
                <th className="p-4 text-left text-xs font-semibold text-gray-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {selectedItems.map((item, index) => (
                <tr key={index} className="border-t border-gray-100 hover:bg-white/60 transition-all">
                  <td className="border-r border-gray-200 p-4 font-semibold text-sm text-gray-900">{index + 1}</td>
                  <td className="border-r border-gray-200 p-4">
                    <Select value={item.name} onValueChange={v => handleItemChange(index, 'name', v)} disabled={submitting}>
                      <SelectTrigger ref={el => itemNameRefs.current[index] = el} className="rounded-xl" onKeyDown={e => handleKeyDown(e, itemQtyRefs.current[index])}>
                        <SelectValue placeholder="Select Item" />
                      </SelectTrigger>
                      <SelectContent>
                        {items.map(item => (
                          <SelectItem key={item.id} value={item.name}>{item.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="border-r border-gray-200 p-4">
                    <Input
                      ref={el => itemQtyRefs.current[index] = el}
                      type="number"
                      value={item.requested}
                      onChange={e => handleItemChange(index, 'requested', e.target.value)}
                      onKeyDown={e => handleKeyDown(e, index === selectedItems.length - 1 ? null : itemNameRefs.current[index + 1])}
                      className="w-20 rounded-xl"
                      min="0"
                      disabled={submitting}
                    />
                  </td>
                  <td className="p-4">
                    <Button type="button" variant="destructive" size="sm" onClick={() => removeItemRow(index)} disabled={submitting || selectedItems.length <= 1}>
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button type="button" variant="outline" onClick={handleAddItem} className="w-full rounded-xl" disabled={submitting}>
          <Plus className="h-4 w-4 mr-2" /> Add Row
        </Button>
      </div>

      {/* Submit */}
      <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting} className="rounded-xl">
          Cancel
        </Button>
        <Button type="submit" disabled={submitting} className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl shadow-lg">
          {submitting ? 'Submitting...' : 'Submit Request'}
        </Button>
      </div>
    </form>
  );
};

export default RequestForms;