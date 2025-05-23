
import React, { useState, useEffect } from 'react';
import { Plus, Search, ArrowUpRight, Calendar, User, Download, Filter } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import Modal from '../components/Modal';
import ItemOutForm from '../components/ItemOutForm';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

/**
 * Interface for items checked out of inventory
 */
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

/**
 * ItemsOut Component
 * Manages the tracking and issuing of items taken from inventory
 */
const ItemsOut = () => {
  // State management
  const [itemsOut, setItemsOut] = useState<ItemOut[]>([]);
  const [filteredItemsOut, setFilteredItemsOut] = useState<ItemOut[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [filterDate, setFilterDate] = useState<string>('all');

  // Load data on component mount and set up real-time subscriptions
  useEffect(() => {
    loadItemsOut();
    const unsubscribe = subscribeToChanges();
    return () => unsubscribe();
  }, []);

  // Filter items when search term or items data changes
  useEffect(() => {
    filterItemsOut();
  }, [itemsOut, searchTerm, filterDate]);

  /**
   * Loads items out data from Supabase
   * Includes item details and category information
   */
  const loadItemsOut = async () => {
    try {
      setLoading(true);
      // Fetch items out with related data
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

  /**
   * Sets up real-time subscription to items_out table changes
   * @returns Function to unsubscribe from channel
   */
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

  /**
   * Filters items based on search term and date filter
   */
  const filterItemsOut = () => {
    let filtered = [...itemsOut];
    
    // Apply search filter
    if (searchTerm.trim()) {
      filtered = filtered.filter(item =>
        (item.person_name && item.person_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.items?.name && item.items.name.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Apply date filter
    if (filterDate !== 'all') {
      const today = new Date();
      const filterDays = parseInt(filterDate);
      today.setHours(0, 0, 0, 0);
      
      const cutoffDate = new Date(today);
      cutoffDate.setDate(cutoffDate.getDate() - filterDays);
      
      filtered = filtered.filter(item => {
        const itemDate = new Date(item.date_time);
        return itemDate >= cutoffDate;
      });
    }

    setFilteredItemsOut(filtered);
  };

  /**
   * Handles issuing a new item
   * Creates record in items_out table and updates item quantity
   * 
   * @param issueData Object containing data about the item being issued
   */
  const handleIssueItem = async (issueData: {
    personName: string;
    itemId: string;
    quantity: number;
    itemName: string;
    dateTime: string;
  }) => {
    try {
      // Insert new record into items_out table
      const { error } = await supabase
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

  /**
   * Exports items out data to CSV
   */
  const exportToCSV = () => {
    // Create CSV content
    const headers = ["Person Name", "Item", "Category", "Quantity", "Date/Time"];
    const rows = filteredItemsOut.map(item => [
      item.person_name,
      item.items?.name || "Unknown",
      item.items?.categories?.name || "Unknown",
      item.quantity,
      new Date(item.date_time).toLocaleString()
    ]);
    
    // Convert to CSV string
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `items-out-report-${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Items Out</h1>
          <p className="text-gray-600 mt-1">Track items taken from the inventory</p>
        </div>
        <div className="mt-4 md:mt-0 flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={exportToCSV}
            className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center"
          >
            <Download className="h-5 w-5 mr-2" />
            Export
          </Button>
          <Button
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 text-white hover:bg-blue-700 flex items-center"
          >
            <Plus className="h-5 w-5 mr-2" />
            Issue Item
          </Button>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-6">
        <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4">
          <div className="relative flex-1">
            <Search className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by person name or item..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div className="flex items-center">
            <Filter className="h-5 w-5 mr-2 text-gray-500" />
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
                        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                          <User className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="text-sm font-medium text-gray-900">{item.person_name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{item.items?.name || "Unknown Item"}</div>
                      <div className="text-sm text-gray-500">{item.items?.categories?.name || "Unknown Category"}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{item.quantity}</div>
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
