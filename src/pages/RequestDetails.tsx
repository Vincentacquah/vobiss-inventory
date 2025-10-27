import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getRequestDetails, updateRequest, getItems } from '../api';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Edit, Save, X, Plus, Printer } from 'lucide-react';

interface RequestItem {
  id: number;
  request_id: number;
  item_id: number;
  quantity_requested: number | null;
  quantity_received: number | null;
  quantity_returned: number | null;
  item_name: string;
}

interface Approval {
  id: number;
  request_id: number;
  approver_name: string;
  signature: string;
  approved_at: string;
}

interface Rejection {
  id: number;
  request_id: number;
  rejector_name: string;
  reason: string;
  created_at: string;
}

interface RequestDetails {
  id: number;
  type?: 'material_request' | 'item_return';
  created_by: string;
  team_leader_name?: string;
  team_leader_phone?: string;
  project_name: string;
  isp_name?: string;
  location: string;
  deployment_type?: 'Deployment' | 'Maintenance';
  release_by: string | null;
  received_by: string | null;
  reason?: string;
  status: 'pending' | 'approved' | 'completed' | 'rejected';
  created_at: string;
  updated_at: string;
  items: RequestItem[];
  approvals: Approval[];
  rejections?: Rejection[];
}

interface EditableItem {
  name: string;
  requested?: number;
  received?: number;
  returned?: number;
}

const RequestDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [request, setRequest] = useState<RequestDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<RequestDetails>>({});
  const [allItems, setAllItems] = useState<any[]>([]);
  const [selectedItems, setSelectedItems] = useState<EditableItem[]>([]);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [requestData, itemsData] = await Promise.all([
        getRequestDetails(id!),
        getItems()
      ]);
      
      setRequest(requestData);
      setEditData(requestData);
      setAllItems(itemsData);
      setSelectedItems(
        requestData.items.map(item => {
          const base = {
            name: item.item_name,
            requested: item.quantity_requested || 0,
            received: item.quantity_received || 0,
            returned: item.quantity_returned || 0
          };
          if (requestData.type === 'item_return') {
            base.returned = item.quantity_requested || 0;
          }
          return base;
        })
      );
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load request details",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (field: keyof RequestDetails, value: any) => {
    setEditData({ ...editData, [field]: value });
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...selectedItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setSelectedItems(newItems);
  };

  const addItemRow = () => {
    const newItem: EditableItem = request?.type === 'item_return' 
      ? { name: '', returned: 0 } 
      : { name: '', requested: 0, received: 0, returned: 0 };
    setSelectedItems([...selectedItems, newItem]);
  };

  const removeItemRow = (index: number) => {
    setSelectedItems(selectedItems.filter((_, i) => i !== index));
  };

  const handleSaveEdit = async () => {
    try {
      const isReturn = request?.type === 'item_return';
      const itemsToSave = selectedItems.map(item => ({
        ...item,
        requested: isReturn ? (item.returned || 0) : (item.requested || 0)
      }));
      await updateRequest(id!, {
        createdBy: editData.created_by,
        ...(isReturn ? { reason: editData.reason } : {
          teamLeaderName: editData.team_leader_name,
          teamLeaderPhone: editData.team_leader_phone,
          projectName: editData.project_name,
          ispName: editData.isp_name,
          location: editData.location,
          deployment: editData.deployment_type,
        }),
        items: itemsToSave
      });
      setEditing(false);
      await loadData();
      toast({
        title: "Success",
        description: "Request updated successfully",
      });
    } catch (error) {
      console.error('Error updating request:', error);
      toast({
        title: "Error",
        description: "Failed to update request",
        variant: "destructive"
      });
    }
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setEditData(request!);
    setSelectedItems(
      request!.items.map(item => {
        const base = {
          name: item.item_name,
          requested: item.quantity_requested || 0,
          received: item.quantity_received || 0,
          returned: item.quantity_returned || 0
        };
        if (request!.type === 'item_return') {
          base.returned = item.quantity_requested || 0;
        }
        return base;
      })
    );
  };

  const generateId = () => {
    const digits = '0123456789';
    let idStr = '';
    // Position 0: random digit
    idStr += digits[Math.floor(Math.random() * 10)];
    // Position 1: V
    idStr += 'V';
    // Position 2: random digit
    idStr += digits[Math.floor(Math.random() * 10)];
    // Position 3: random digit
    idStr += digits[Math.floor(Math.random() * 10)];
    // Position 4: i
    idStr += 'i';
    // Position 5: random digit
    idStr += digits[Math.floor(Math.random() * 10)];
    // Position 6: random digit
    idStr += digits[Math.floor(Math.random() * 10)];
    // Position 7: N
    idStr += 'N';
    return idStr;
  };

  const handlePrint = () => {
    const newId = generateId();
    const printContent = document.getElementById('print-content');
    if (printContent) {
      const idElement = printContent.querySelector('#form-id');
      if (idElement) {
        idElement.textContent = newId;
      }
      const originalContent = document.body.innerHTML;
      document.body.innerHTML = printContent.innerHTML;
      window.print();
      document.body.innerHTML = originalContent;
      window.location.reload();
    }
  };

  if (loading) {
    return <LoadingState />;
  }

  if (!request) {
    return <NotFoundState />;
  }

  const isReturn = request.type === 'item_return';
  const isEditable = request.status === 'pending';
  const statusConfig = getStatusConfig(request.status);
  const statusText = request.status.charAt(0).toUpperCase() + request.status.slice(1);
  const formTitle = isReturn ? 'ITEM RETURN FORM' : 'REQUEST FORM FOR MATERIALS';
  const requesterLabel = isReturn ? 'Returned by' : 'Requested by';

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header - Screen Only */}
        <div className="mb-8 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            className="border-gray-300 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to List
          </Button>
          <div className="flex space-x-3">
            <ActionButtons
              isEditable={isEditable}
              editing={editing}
              onEdit={() => setEditing(true)}
              onCancel={handleCancelEdit}
              onSave={handleSaveEdit}
            />
            {request.status === 'completed' && (
              <Button 
                onClick={handlePrint} 
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
            )}
          </div>
        </div>

        {/* Screen View */}
        <div className="bg-white rounded-lg shadow-md border border-gray-100 p-8" id="screen-content">
          {/* Logo and Title - Screen */}
          <div className="text-center mb-8 pb-8 border-b border-gray-200">
            <img 
              src="/vobiss-logo.png" 
              alt="VOBISS Logo" 
              className="h-16 mx-auto mb-4"
            />
            <h1 className="text-3xl font-bold text-gray-900">{formTitle}</h1>
          </div>

          <div className="flex justify-end mb-8">
            <StatusBadge status={statusText} config={statusConfig} />
          </div>

          {/* Project Information Section - Screen */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 border-b border-gray-200 pb-2">
              {isReturn ? 'Return Information' : 'Project Information'}
            </h2>
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="mb-6 italic text-gray-600 text-center border-b border-gray-200 pb-3">
                <p className="text-lg">{requesterLabel}: <span className="font-semibold">{request.created_by}</span></p>
              </div>
              {editing ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {isReturn ? (
                    <>
                      <DetailField
                        label="Project Name"
                        value={editData.project_name}
                        editing={true}
                        onChange={(val) => handleFieldChange('project_name', val)}
                      />
                      <DetailField
                        label="Location"
                        value={editData.location}
                        editing={true}
                        onChange={(val) => handleFieldChange('location', val)}
                      />
                      <div className="lg:col-span-3">
                        <ReasonField
                          label="Return Reason"
                          value={editData.reason || ''}
                          editing={true}
                          onChange={(val) => handleFieldChange('reason', val)}
                        />
                      </div>
                      <DetailField
                        label="Received By"
                        value={request.received_by || 'N/A'}
                        editing={false}
                      />
                      <DateField
                        label="Created At"
                        value={request.created_at}
                      />
                      <DateField
                        label="Updated At"
                        value={request.updated_at}
                      />
                    </>
                  ) : (
                    <>
                      <DetailField
                        label="Project Name"
                        value={editData.project_name}
                        editing={true}
                        onChange={(val) => handleFieldChange('project_name', val)}
                      />
                      <DetailField
                        label="Team Leader Name"
                        value={editData.team_leader_name}
                        editing={true}
                        onChange={(val) => handleFieldChange('team_leader_name', val)}
                      />
                      <DetailField
                        label="Team Leader Phone"
                        value={editData.team_leader_phone}
                        editing={true}
                        onChange={(val) => handleFieldChange('team_leader_phone', val)}
                      />
                      <DetailField
                        label="ISP Name"
                        value={editData.isp_name || 'N/A'}
                        editing={true}
                        onChange={(val) => handleFieldChange('isp_name', val)}
                      />
                      <DetailField
                        label="Location"
                        value={editData.location}
                        editing={true}
                        onChange={(val) => handleFieldChange('location', val)}
                      />
                      <DeploymentTypeField
                        value={editData.deployment_type}
                        editing={true}
                        onChange={(val) => handleFieldChange('deployment_type', val)}
                      />
                      <DetailField
                        label="Received By"
                        value={request.received_by || 'N/A'}
                        editing={false}
                      />
                      <DateField
                        label="Created At"
                        value={request.created_at}
                      />
                      <DateField
                        label="Updated At"
                        value={request.updated_at}
                      />
                    </>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200">
                    <tbody className="bg-white divide-y divide-gray-200">
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 bg-gray-50">Project Name</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{editData.project_name || 'N/A'}</td>
                      </tr>
                      {!isReturn && (
                        <>
                          <tr className="bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">Team Leader Name</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{editData.team_leader_name || 'N/A'}</td>
                          </tr>
                          <tr>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 bg-gray-50">Team Leader Phone</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{editData.team_leader_phone || 'N/A'}</td>
                          </tr>
                          <tr className="bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">ISP Name</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{editData.isp_name || 'N/A'}</td>
                          </tr>
                        </>
                      )}
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 bg-gray-50">Location</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{editData.location || 'N/A'}</td>
                      </tr>
                      {isReturn && (
                        <tr className="bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">Return Reason</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{editData.reason || 'N/A'}</td>
                        </tr>
                      )}
                      {!isReturn && (
                        <tr>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 bg-gray-50">Project Type</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{editData.deployment_type || 'N/A'}</td>
                        </tr>
                      )}
                      <tr className="bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">Received By</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{request.received_by || 'N/A'}</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 bg-gray-50">Created At</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(request.created_at).toLocaleString()}</td>
                      </tr>
                      <tr className="bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">Updated At</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(request.updated_at).toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          {/* Items and History - Screen */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <ItemsTable
              items={editing ? selectedItems : request.items}
              editing={editing}
              allItems={allItems}
              onItemChange={handleItemChange}
              onRemoveRow={removeItemRow}
              onAddRow={addItemRow}
              isEditable={isEditable}
              isReturn={isReturn}
            />
            <HistorySection 
              approvals={request.approvals} 
              rejections={request.rejections} 
              releaseBy={request.release_by} 
            />
          </div>
        </div>
      </div>

      {/* Print Content - Hidden on Screen */}
      <div id="print-content" className="hidden">
        <div className="p-1 max-w-4xl mx-auto bg-white">
          {/* Header - Print */}
          <header className="mb-2 border-b border-gray-500 pb-1 flex items-start justify-between">
            <img 
              src="/vobiss-logo.png" 
              alt="VOBISS Logo" 
              className="h-14"
            />
            <div className="flex-1 text-center mx-1">
              <h1 className="text-xl font-bold uppercase tracking-wide text-gray-900">{formTitle}</h1>
            </div>
            <div className="text-right bg-gray-50 border border-gray-300 rounded px-1 py-0.5">
              <StatusBadgePrint status={statusText} config={statusConfig} />
            </div>
          </header>

          {/* Section 1: Project Information - Table Layout */}
          <section className="mb-2">
            <h2 className="text-base font-bold mb-1 border-b border-gray-300 pb-0.5 text-gray-800">
              {isReturn ? 'Return Information' : 'Project Information'}
            </h2>
            <div className="italic text-gray-600 mb-1 text-center border-b border-gray-200 pb-0.5 font-serif">
              <p className="text-sm">{requesterLabel}: <span className="font-medium text-gray-900">{request.created_by}</span></p>
            </div>
            <div className="overflow-hidden rounded border border-gray-300">
              <table className="w-full text-xs bg-white">
                <tbody>
                  <tr className="border-b border-gray-300">
                    <td className="font-bold border-r border-gray-300 px-3 py-1.5 bg-gray-50 text-gray-900">Project Name</td>
                    <td className="border border-gray-300 px-3 py-1.5 text-gray-800 font-medium">{editData.project_name || 'N/A'}</td>
                  </tr>
                  {!isReturn && (
                    <>
                      <tr className="bg-gray-50 border-b border-gray-300">
                        <td className="font-bold border-r border-gray-300 px-3 py-1.5 text-gray-900">Team Leader Name</td>
                        <td className="border border-gray-300 px-3 py-1.5 text-gray-800 font-medium">{editData.team_leader_name || 'N/A'}</td>
                      </tr>
                      <tr className="border-b border-gray-300">
                        <td className="font-bold border-r border-gray-300 px-3 py-1.5 bg-gray-50 text-gray-900">Team Leader Phone</td>
                        <td className="border border-gray-300 px-3 py-1.5 text-gray-800 font-medium">{editData.team_leader_phone || 'N/A'}</td>
                      </tr>
                      <tr className="bg-gray-50 border-b border-gray-300">
                        <td className="font-bold border-r border-gray-300 px-3 py-1.5 text-gray-900">ISP Name</td>
                        <td className="border border-gray-300 px-3 py-1.5 text-gray-800 font-medium">{editData.isp_name || 'N/A'}</td>
                      </tr>
                    </>
                  )}
                  <tr className="border-b border-gray-300">
                    <td className="font-bold border-r border-gray-300 px-3 py-1.5 bg-gray-50 text-gray-900">Location</td>
                    <td className="border border-gray-300 px-3 py-1.5 text-gray-800 font-medium">{editData.location || 'N/A'}</td>
                  </tr>
                  {isReturn && (
                    <tr className="bg-gray-50 border-b border-gray-300">
                      <td className="font-bold border-r border-gray-300 px-3 py-1.5 text-gray-900">Return Reason</td>
                      <td className="border border-gray-300 px-3 py-1.5 text-gray-800 font-medium">{editData.reason || 'N/A'}</td>
                    </tr>
                  )}
                  {!isReturn && (
                    <tr className="border-b border-gray-300">
                      <td className="font-bold border-r border-gray-300 px-3 py-1.5 bg-gray-50 text-gray-900">Project Type</td>
                      <td className="border border-gray-300 px-3 py-1.5 text-gray-800 font-medium">{editData.deployment_type || 'N/A'}</td>
                    </tr>
                  )}
                  <tr className="bg-gray-50 border-b border-gray-300">
                    <td className="font-bold border-r border-gray-300 px-3 py-1.5 text-gray-900">Received By</td>
                    <td className="border border-gray-300 px-3 py-1.5 text-gray-800 font-medium">{request.received_by || 'N/A'}</td>
                  </tr>
                  <tr className="border-b border-gray-300">
                    <td className="font-bold border-r border-gray-300 px-3 py-1.5 bg-gray-50 text-gray-900">Created At</td>
                    <td className="border border-gray-300 px-3 py-1.5 text-gray-800 font-medium">{new Date(request.created_at).toLocaleString()}</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="font-bold border-r border-gray-300 px-3 py-1.5 text-gray-900">Updated At</td>
                    <td className="border border-gray-300 px-3 py-1.5 text-gray-800 font-medium">{new Date(request.updated_at).toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <hr className="my-1 border-gray-300" />

          {/* Section 2: Items Table */}
          <section className="mb-2">
            <h2 className="text-base font-bold mb-1 border-b border-gray-300 pb-0.5 text-gray-800">Items</h2>
            <div className="overflow-hidden rounded border border-gray-300">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-3 py-1.5 text-left font-bold text-gray-900 uppercase tracking-wide text-xs">Item Name</th>
                    {!isReturn ? (
                      <>
                        <th className="border border-gray-300 px-3 py-1.5 text-left font-bold text-gray-900 uppercase tracking-wide text-xs">Requested</th>
                        <th className="border border-gray-300 px-3 py-1.5 text-left font-bold text-gray-900 uppercase tracking-wide text-xs">Received</th>
                      </>
                    ) : null}
                    <th className="border border-gray-300 px-3 py-1.5 text-left font-bold text-gray-900 uppercase tracking-wide text-xs">Returned</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {request.items.map((item, index) => (
                    <tr key={index}>
                      <td className="border border-gray-300 px-3 py-1.5 font-medium text-gray-900 text-xs">{item.item_name}</td>
                      {!isReturn ? (
                        <>
                          <td className="border border-gray-300 px-3 py-1.5 text-gray-800 font-medium text-xs">{item.quantity_requested || 0}</td>
                          <td className="border border-gray-300 px-3 py-1.5 text-gray-800 font-medium text-xs">{item.quantity_received || 'N/A'}</td>
                        </>
                      ) : null}
                      <td className="border border-gray-300 px-3 py-1.5 text-gray-800 font-medium text-xs">{isReturn ? (item.quantity_requested || 0) : (item.quantity_returned || 'N/A')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 3: History */}
          <section className="mb-4">
            <h2 className="text-base font-bold mb-1 border-b border-gray-300 pb-0.5 text-gray-800">History</h2>
            <div className="border border-gray-300 rounded p-2 bg-gray-50 text-xs">
              {request.release_by && (
                <div className="mb-2 pb-1 border-b border-gray-200">
                  <div className="flex mb-0.5 font-bold text-gray-900"><span className="w-16">Issuer:</span><span className="ml-1">{request.release_by}</span></div>
                  <div className="flex text-gray-700"><span className="w-16">Date:</span><span className="ml-1 font-medium">{new Date(request.updated_at).toLocaleString()}</span></div>
                </div>
              )}
              {request.approvals.length > 0 && (
                <div className="mb-2 pb-1 border-b border-gray-200">
                  <h3 className="font-bold text-blue-900 mb-1">Approvals</h3>
                  {request.approvals.map((approval, index) => (
                    <div key={approval.id} className={`pb-2 ${index < request.approvals.length - 1 ? 'border-b border-gray-200 mb-2' : ''}`}>
                      <div className="flex mb-0.5 font-bold text-gray-900"><span className="w-16">Approver:</span><span className="ml-1">{approval.approver_name}</span></div>
                      <div className="flex mb-0.5 text-gray-700"><span className="w-16 font-medium">Signature:</span><span className="ml-1 italic">{approval.signature}</span></div>
                      <div className="flex text-gray-700"><span className="w-16">Date:</span><span className="ml-1 font-medium">{new Date(approval.approved_at).toLocaleString()}</span></div>
                    </div>
                  ))}
                </div>
              )}
              {request.rejections && request.rejections.length > 0 ? (
                <div className="mb-2 pb-1 border-b border-gray-200">
                  <h3 className="font-bold text-red-900 mb-1">Rejections</h3>
                  {request.rejections.map((rejection, index) => (
                    <div key={rejection.id} className={`pb-2 ${index < request.rejections!.length - 1 ? 'border-b border-gray-200 mb-2' : ''}`}>
                      <div className="flex mb-0.5 font-bold text-red-900"><span className="w-16">Rejector:</span><span className="ml-1">{rejection.rejector_name}</span></div>
                      <div className="flex mb-0.5 text-red-700"><span className="w-16 font-medium">Reason:</span><span className="ml-1 italic">{rejection.reason}</span></div>
                      <div className="flex text-red-700"><span className="w-16">Date:</span><span className="ml-1 font-medium">{new Date(rejection.created_at).toLocaleString()}</span></div>
                    </div>
                  ))}
                </div>
              ) : null}
              {(!request.approvals.length && (!request.rejections || request.rejections.length === 0)) && (
                <p className="italic text-gray-500 text-center py-2 font-serif">No history recorded yet</p>
              )}
            </div>
          </section>

          {/* Form ID */}
          <div className="mt-4 text-center italic text-xs text-gray-500 border-t border-gray-300 pt-1">
            Form ID: <span id="form-id">TEMP</span>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-content, #print-content * {
            visibility: visible;
          }
          #print-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          #screen-content {
            display: none !important;
          }
          .toast {
            display: none !important;
          }
          @page {
            size: A4 portrait;
            margin: 0;
            @top-left {
              content: none;
            }
            @top-center {
              content: none;
            }
            @top-right {
              content: none;
            }
            @bottom-left {
              content: none;
            }
            @bottom-center {
              content: none;
            }
            @bottom-right {
              content: none;
            }
            @left-middle {
              content: none;
            }
            @right-middle {
              content: none;
            }
          }
          body {
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact;
            color-adjust: exact;
          }
          #print-content {
            font-family: 'Times New Roman', serif;
            line-height: 1.2;
            font-size: 10pt;
          }
          table {
            page-break-inside: avoid;
          }
          h1, h2 {
            page-break-after: avoid;
          }
        }
      `}</style>
    </div>
  );
};

/* Helper Components - Updated for Print */

const LoadingState: React.FC = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50">
    <div className="text-center">
      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-600 font-medium">Loading request details...</p>
    </div>
  </div>
);

const NotFoundState: React.FC = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50">
    <p className="text-gray-600 font-medium">Request not found</p>
  </div>
);

interface ActionButtonsProps {
  isEditable: boolean;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({
  isEditable,
  editing,
  onEdit,
  onCancel,
  onSave
}) => {
  if (!isEditable) return null;

  return (
    <div className="flex space-x-3">
      {!editing ? (
        <Button onClick={onEdit} className="bg-blue-600 hover:bg-blue-700 text-white">
          <Edit className="h-4 w-4 mr-2" />
          Edit Details
        </Button>
      ) : (
        <>
          <Button onClick={onCancel} variant="outline" className="border-gray-300 hover:bg-gray-100">
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={onSave} className="bg-green-600 hover:bg-green-700 text-white">
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </>
      )}
    </div>
  );
};

interface StatusConfig {
  bg: string;
  text: string;
  border: string;
}

function getStatusConfig(status: string): StatusConfig {
  const configs: Record<string, StatusConfig> = {
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
    approved: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
    completed: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' },
    rejected: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' }
  };
  return configs[status] || { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300' };
}

interface StatusBadgeProps {
  status: string;
  config: StatusConfig;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, config }) => (
  <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-sm font-medium ${config.bg} ${config.text} border ${config.border}`}>
    {status}
  </span>
);

const StatusBadgePrint: React.FC<StatusBadgeProps> = ({ status, config }) => (
  <div className={`px-1 py-0.5 rounded text-xs font-medium ${config.bg} ${config.text} border ${config.border} inline-block uppercase font-bold`}>
    {status}
  </div>
);

interface DetailFieldProps {
  label: string;
  value: any;
  editing?: boolean;
  onChange?: (value: any) => void;
}

const DetailField: React.FC<DetailFieldProps> = ({ label, value, editing, onChange }) => (
  <div>
    <label className="block text-sm font-medium text-gray-600">{label}</label>
    {editing && onChange ? (
      <Input
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500"
      />
    ) : (
      <p className="mt-1 text-base font-medium text-gray-800">{value}</p>
    )}
  </div>
);

interface ReasonFieldProps {
  label: string;
  value: string;
  editing?: boolean;
  onChange?: (value: string) => void;
}

const ReasonField: React.FC<ReasonFieldProps> = ({ label, value, editing, onChange }) => (
  <div>
    <label className="block text-sm font-medium text-gray-600">{label}</label>
    {editing && onChange ? (
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500 min-h-[80px]"
      />
    ) : (
      <p className="mt-1 text-base font-medium text-gray-800">{value}</p>
    )}
  </div>
);

interface DeploymentTypeFieldProps {
  value: string | undefined;
  editing: boolean;
  onChange: (value: string) => void;
}

const DeploymentTypeField: React.FC<DeploymentTypeFieldProps> = ({ value, editing, onChange }) => (
  <div>
    <label className="block text-sm font-medium text-gray-600">Project Type</label>
    {editing ? (
      <Select value={value || ''} onValueChange={onChange}>
        <SelectTrigger className="mt-1 w-full rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="Deployment">Deployment</SelectItem>
          <SelectItem value="Maintenance">Maintenance</SelectItem>
        </SelectContent>
      </Select>
    ) : (
      <p className="mt-1 text-base font-medium text-gray-800">{value}</p>
    )}
  </div>
);

interface DateFieldProps {
  label: string;
  value: string;
}

const DateField: React.FC<DateFieldProps> = ({ label, value }) => (
  <div>
    <label className="block text-sm font-medium text-gray-600">{label}</label>
    <p className="mt-1 text-sm text-gray-600">{new Date(value).toLocaleString()}</p>
  </div>
);

interface ItemsTableProps {
  items: any[];
  editing: boolean;
  allItems: any[];
  onItemChange: (index: number, field: string, value: any) => void;
  onRemoveRow: (index: number) => void;
  onAddRow: () => void;
  isEditable: boolean;
  isReturn: boolean;
}

const ItemsTable: React.FC<ItemsTableProps> = ({
  items,
  editing,
  allItems,
  onItemChange,
  onRemoveRow,
  onAddRow,
  isEditable,
  isReturn
}) => (
  <div>
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg font-semibold text-gray-800">Items</h2>
      {isEditable && editing && (
        <Button onClick={onAddRow} variant="ghost" size="sm" className="text-blue-600 hover:text-blue-800">
          <Plus className="h-4 w-4" />
        </Button>
      )}
    </div>
    <div className="bg-gray-50 rounded-lg shadow-sm border border-gray-100 overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Item Name</th>
            {!isReturn ? (
              <>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Requested</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Received</th>
              </>
            ) : null}
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Returned</th>
            {editing && <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Actions</th>}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {items.map((item: any, index: number) => (
            <ItemRow
              key={index}
              index={index}
              item={item}
              editing={editing}
              allItems={allItems}
              onItemChange={onItemChange}
              onRemoveRow={onRemoveRow}
              isReturn={isReturn}
            />
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

interface ItemRowProps {
  index: number;
  item: any;
  editing: boolean;
  allItems: any[];
  onItemChange: (index: number, field: string, value: any) => void;
  onRemoveRow: (index: number) => void;
  isReturn: boolean;
}

const ItemRow: React.FC<ItemRowProps> = ({
  index,
  item,
  editing,
  allItems,
  onItemChange,
  onRemoveRow,
  isReturn
}) => (
  <tr className="hover:bg-gray-50">
    {editing ? (
      <>
        <td className="px-4 py-3">
          <Select value={item.name} onValueChange={(val) => onItemChange(index, 'name', val)}>
            <SelectTrigger className="w-full rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500">
              <SelectValue placeholder="Select item" />
            </SelectTrigger>
            <SelectContent>
              {allItems.map((i) => (
                <SelectItem key={i.id} value={i.name}>{i.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </td>
        {!isReturn ? (
          <>
            <td className="px-4 py-3">
              <Input
                type="number"
                value={item.requested}
                onChange={(e) => onItemChange(index, 'requested', parseInt(e.target.value) || 0)}
                className="w-20 rounded-md border-gray-300"
                min="0"
              />
            </td>
            <td className="px-4 py-3">
              <Input
                type="number"
                value={item.received || 0}
                onChange={(e) => onItemChange(index, 'received', parseInt(e.target.value) || 0)}
                className="w-20 rounded-md border-gray-300"
                min="0"
              />
            </td>
          </>
        ) : null}
        <td className="px-4 py-3">
          <Input
            type="number"
            value={item.returned || 0}
            onChange={(e) => onItemChange(index, 'returned', parseInt(e.target.value) || 0)}
            className="w-20 rounded-md border-gray-300"
            min="0"
          />
        </td>
        <td className="px-4 py-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onRemoveRow(index)}
            className="text-red-500 hover:bg-red-50"
          >
            <X className="h-4 w-4" />
          </Button>
        </td>
      </>
    ) : (
      <>
        <td className="px-4 py-3 text-sm font-medium text-gray-800">{item.item_name || item.name}</td>
        {!isReturn ? (
          <>
            <td className="px-4 py-3 text-sm text-gray-800">{item.quantity_requested || item.requested || 0}</td>
            <td className="px-4 py-3 text-sm text-gray-800">{item.quantity_received || item.received || 'N/A'}</td>
          </>
        ) : null}
        <td className="px-4 py-3 text-sm text-gray-800">{isReturn ? (item.quantity_requested || item.requested || 0) : (item.quantity_returned || item.returned || 'N/A')}</td>
      </>
    )}
  </tr>
);

interface HistorySectionProps {
  approvals: any[];
  rejections?: any[];
  releaseBy?: string | null;
}

const HistorySection: React.FC<HistorySectionProps> = ({ approvals, rejections, releaseBy }) => (
  <div>
    <h2 className="text-lg font-semibold text-gray-800 mb-4">History</h2>
    <div className="bg-gray-50 rounded-lg shadow-sm border border-gray-100 p-4">
      {releaseBy && (
        <div className="mb-3 pb-3 border-b border-gray-200">
          <p className="text-sm font-medium text-gray-800">Issuer: {releaseBy}</p>
        </div>
      )}
      {approvals.length > 0 && (
        <div className="mb-3 pb-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-blue-800 mb-2">Approvals</h3>
          {approvals.map((approval) => (
            <div key={approval.id} className="border-l-4 border-blue-500 pl-4 py-2 mb-3 bg-blue-50 rounded">
              <p className="text-sm font-medium text-gray-800">{approval.approver_name}</p>
              <p className="text-sm text-gray-600">Signature: {approval.signature}</p>
              <p className="text-sm text-gray-600">Approved: {new Date(approval.approved_at).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
      {rejections && rejections.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-red-800 mb-2">Rejections</h3>
          {rejections.map((rejection) => (
            <div key={rejection.id} className="border-l-4 border-red-500 pl-4 py-2 mb-3 bg-red-50 rounded">
              <p className="text-sm font-medium text-red-800">Rejected by: {rejection.rejector_name}</p>
              <p className="text-sm text-red-600"><strong>Reason:</strong> {rejection.reason}</p>
              <p className="text-sm text-red-600">Rejected: {new Date(rejection.created_at).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
      {(!approvals.length && (!rejections || rejections.length === 0)) && (
        <p className="text-gray-600 italic text-center py-4">No history recorded yet</p>
      )}
    </div>
  </div>
);

export default RequestDetails;