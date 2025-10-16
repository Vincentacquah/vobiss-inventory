import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getRequestDetails, updateRequest, getItems } from '../api';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Edit, Save, X, Plus } from 'lucide-react';

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

interface RequestDetails {
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
  items: RequestItem[];
  approvals: Approval[];
}

interface EditableItem {
  name: string;
  requested: number;
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
        requestData.items.map(item => ({
          name: item.item_name,
          requested: item.quantity_requested || 0,
          received: item.quantity_received || 0,
          returned: item.quantity_returned || 0
        }))
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
    setSelectedItems([...selectedItems, { name: '', requested: 0, received: 0, returned: 0 }]);
  };

  const removeItemRow = (index: number) => {
    setSelectedItems(selectedItems.filter((_, i) => i !== index));
  };

  const handleSaveEdit = async () => {
    try {
      await updateRequest(id!, {
        createdBy: editData.created_by,
        teamLeaderName: editData.team_leader_name,
        teamLeaderPhone: editData.team_leader_phone,
        projectName: editData.project_name,
        ispName: editData.isp_name,
        location: editData.location,
        deployment: editData.deployment_type,
        items: selectedItems
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
      request!.items.map(item => ({
        name: item.item_name,
        requested: item.quantity_requested || 0,
        received: item.quantity_received || 0,
        returned: item.quantity_returned || 0
      }))
    );
  };

  if (loading) {
    return (
      <LoadingState />
    );
  }

  if (!request) {
    return (
      <NotFoundState />
    );
  }

  const isEditable = request.status === 'pending';
  const statusConfig = getStatusConfig(request.status);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            className="border-gray-300 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to List
          </Button>
          <ActionButtons
            isEditable={isEditable}
            editing={editing}
            onEdit={() => setEditing(true)}
            onCancel={handleCancelEdit}
            onSave={handleSaveEdit}
          />
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-lg shadow-md border border-gray-100 p-8">
          {/* Logo and Title */}
          <div className="text-center mb-8 pb-8 border-b border-gray-200">
            <img 
              src="/vobiss-logo.png" 
              alt="VOBISS Logo" 
              className="h-16 mx-auto mb-4"
            />
            <h1 className="text-3xl font-bold text-gray-900">REQUEST FORM FOR MATERIALS</h1>
          </div>

          {/* Title and Status */}
          <div className="flex items-center justify-between mb-8">
            <div></div>
            <StatusBadge status={request.status} config={statusConfig} />
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <DetailField
              label="Project Name"
              value={editData.project_name}
              editing={editing}
              onChange={(val) => handleFieldChange('project_name', val)}
            />
            <DetailField
              label="Created By"
              value={request.created_by}
              editing={false}
            />
            <DetailField
              label="Team Leader Name"
              value={editData.team_leader_name}
              editing={editing}
              onChange={(val) => handleFieldChange('team_leader_name', val)}
            />
            <DetailField
              label="Team Leader Phone"
              value={editData.team_leader_phone}
              editing={editing}
              onChange={(val) => handleFieldChange('team_leader_phone', val)}
            />
            <DetailField
              label="ISP Name"
              value={editData.isp_name || 'N/A'}
              editing={editing}
              onChange={(val) => handleFieldChange('isp_name', val)}
            />
            <DetailField
              label="Location"
              value={editData.location}
              editing={editing}
              onChange={(val) => handleFieldChange('location', val)}
            />
            <DeploymentTypeField
              value={editData.deployment_type}
              editing={editing}
              onChange={(val) => handleFieldChange('deployment_type', val)}
            />
            <DetailField
              label="Release By"
              value={request.release_by || 'N/A'}
              editing={false}
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
          </div>

          {/* Items and Approvals */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <ItemsTable
              items={editing ? selectedItems : request.items}
              editing={editing}
              allItems={allItems}
              onItemChange={handleItemChange}
              onRemoveRow={removeItemRow}
              onAddRow={addItemRow}
              isEditable={isEditable}
            />
            <ApprovalsSection approvals={request.approvals} />
          </div>
        </div>
      </div>
    </div>
  );
};

/* Helper Components */

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
}

function getStatusConfig(status: string): StatusConfig {
  const configs: Record<string, StatusConfig> = {
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
    approved: { bg: 'bg-blue-100', text: 'text-blue-800' },
    completed: { bg: 'bg-green-100', text: 'text-green-800' },
    rejected: { bg: 'bg-red-100', text: 'text-red-800' }
  };
  return configs[status] || { bg: 'bg-gray-100', text: 'text-gray-800' };
}

interface StatusBadgeProps {
  status: string;
  config: StatusConfig;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, config }) => (
  <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-sm font-medium ${config.bg} ${config.text}`}>
    {status.charAt(0).toUpperCase() + status.slice(1)}
  </span>
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

interface DeploymentTypeFieldProps {
  value: string | undefined;
  editing: boolean;
  onChange: (value: string) => void;
}

const DeploymentTypeField: React.FC<DeploymentTypeFieldProps> = ({ value, editing, onChange }) => (
  <div>
    <label className="block text-sm font-medium text-gray-600">Deployment Type</label>
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
}

const ItemsTable: React.FC<ItemsTableProps> = ({
  items,
  editing,
  allItems,
  onItemChange,
  onRemoveRow,
  onAddRow,
  isEditable
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
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Requested</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Received</th>
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
}

const ItemRow: React.FC<ItemRowProps> = ({
  index,
  item,
  editing,
  allItems,
  onItemChange,
  onRemoveRow
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
        <td className="px-4 py-3 text-sm font-medium text-gray-800">{item.item_name}</td>
        <td className="px-4 py-3 text-sm text-gray-800">{item.quantity_requested || 0}</td>
        <td className="px-4 py-3 text-sm text-gray-800">{item.quantity_received || 'N/A'}</td>
        <td className="px-4 py-3 text-sm text-gray-800">{item.quantity_returned || 'N/A'}</td>
      </>
    )}
  </tr>
);

interface ApprovalsSectionProps {
  approvals: any[];
}

const ApprovalsSection: React.FC<ApprovalsSectionProps> = ({ approvals }) => (
  <div>
    <h2 className="text-lg font-semibold text-gray-800 mb-4">Approvals</h2>
    <div className="bg-gray-50 rounded-lg shadow-sm border border-gray-100 p-4">
      {approvals.length > 0 ? (
        approvals.map((approval) => (
          <div key={approval.id} className="border-l-4 border-blue-500 pl-4 py-2 mb-3">
            <p className="text-sm font-medium text-gray-800">{approval.approver_name}</p>
            <p className="text-sm text-gray-600">Signature: {approval.signature}</p>
            <p className="text-sm text-gray-600">Approved: {new Date(approval.approved_at).toLocaleString()}</p>
          </div>
        ))
      ) : (
        <p className="text-gray-600 italic text-center py-4">No approvals recorded yet</p>
      )}
    </div>
  </div>
);

export default RequestDetails;