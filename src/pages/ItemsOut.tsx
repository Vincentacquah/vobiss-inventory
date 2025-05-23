
import React, { useState, useEffect } from 'react';
import { Plus, Search, ArrowUpRight, Calendar, User } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import Modal from '../components/Modal';
import ItemOutForm from '../components/ItemOutForm';
import { useToast } from "@/hooks/use-toast";

interface ItemOut {
  id: string;
  person_name: string;
  item_id: string;
  quantity: number;
  date_time: string;
  items?: {
    name: string;
    categories?: {
      name: string;
    };
  };
}

const ItemsOut = () => {
  const [itemsOut, setItemsOut] = useState<ItemOut[]>([]);
  const [filteredItemsOut, setFilteredItemsOut] = useState<ItemOut[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadItemsOut();
    subscribeToChanges();
  }, []);

  useEffect(() => {
    filterItemsOut();
  }, [itemsOut, searchTerm]);

  const loadItemsOut = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('items_out')
        .select(`
          *,
          items:item_id (
            name, 
            categories:category_id (name)
          )
        `)
        .order('date_time', { ascending: false });

      if (error) throw error;
      setItemsOut(data || []);
    } catch (error) {
      console.error('Error loading items out:', error);
      toast({
        title: "Error",
        description: "Failed to load items out data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const subscribeToChanges = () => {
    const itemsOutChannel = supabase
      .channel('public:items_out')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items_out' }, () => {
        loadItemsOut();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(itemsOutChannel);
    };
  };

  const filterItemsOut = () => {
    if (!searchTerm.trim()) {
      setFilteredItemsOut(itemsOut);
      return;
    }

    const filtered = itemsOut.filter(item =>
      (item.person_name && item.person_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.items?.name && item.items.name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    setFilteredItemsOut(filtered);
  };

  const handleIssueItem = async (issueData: {
    personName: string;
    itemId: string;
    quantity: number;
    itemName: string;
    dateTime: string;
  }) => {
    try {
      const { data, error } = await supabase
        .from('items_out')
        .insert([
          {
            person_name: issueData.personName,
            item_id: issueData.itemId,
            quantity: issueData.quantity,
            date_time: issueData.dateTime
          }
        ]);

      if (error) throw error;

      setIsModalOpen(false);
      toast({
        title: "Success",
        description: `${issueData.quantity} x ${issueData.itemName} issued to ${issueData.personName}`,
        variant: "default"
      });
      
      // Item quantity will be updated automatically by the database trigger
    } catch (error) {
      console.error('Error issuing item:', error);
      toast({
        title: "Error",
        description: "Failed to issue item",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Items Out</h1>
          <p className="text-gray-600 mt-1">Track items taken from the inventory</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="mt-4 md:mt-0 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
        >
          <Plus className="h-5 w-5 mr-2" />
          Issue Item
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-6">
        <div className="relative">
          <Search className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by person name or item..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading items out data...</p>
        </div>
      )}

      {/* Items Out Table */}
      {!loading && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Person
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Item
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredItemsOut.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <User className="h-5 w-5 text-gray-400 mr-3" />
                        <div className="text-sm font-medium text-gray-900">{item.person_name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{item.items?.name || "Unknown Item"}</div>
                      <div className="text-sm text-gray-500">{item.items?.categories?.name || "Unknown Category"}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{item.quantity}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900">
                        <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                        {new Date(item.date_time).toLocaleDateString()}
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(item.date_time).toLocaleTimeString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <ArrowUpRight className="h-3 w-3 mr-1" />
                        Issued
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredItemsOut.length === 0 && !loading && (
            <div className="text-center py-12">
              <ArrowUpRight className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No items issued yet</p>
            </div>
          )}
        </div>
      )}

      {/* Issue Item Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Issue Item"
      >
        <ItemOutForm
          onSave={handleIssueItem}
          onCancel={() => setIsModalOpen(false)}
        />
      </Modal>
    </div>
  );
};

export default ItemsOut;
