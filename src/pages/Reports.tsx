import React, { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, ScatterChart, Scatter, ZAxis } from 'recharts';
import { Calendar, TrendingUp, Download, Filter, RefreshCw, ChevronDown, ChevronUp, Settings, BarChart2, PieChart as PieChartIcon, Users, FileText, Package, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { getItemsOut, getCategories, getRequests, getRequestDetails, getItems } from '../api';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

interface UsageData {
  date: string;
  formattedDate: string;
  items_out: number;
  items_in: number;
  net_change: number;
  users: number;
  source_direct: number;
  source_request: number;
  source_return: number;
  stock_before?: number;
  stock_after?: number;
}

interface UsageTracking {
  date: string;
  items_out: number;
  items_in: number;
  net_change: number;
  users: Set<string>;
  source_direct: number;
  source_request: number;
  source_return: number;
}

interface TopItem {
  name: string;
  count: number;
  category: string;
  source: 'direct' | 'request' | 'return';
}

interface TopUser {
  name: string;
  count: number;
  source: 'direct' | 'request' | 'return';
}

interface ItemOut {
  id: string;
  person_name: string;
  item_id: string;
  quantity: number;
  date_time: string;
  item_name: string;
  category_name: string;
}

interface CombinedTransaction extends ItemOut {
  source: 'direct' | 'request' | 'return';
  requester?: string;
  approver?: string;
  current_stock?: number;
  transaction_type: 'out' | 'in';
}

interface Category {
  id: string;
  name: string;
}

interface Item {
  id: string;
  name: string;
  category_name: string;
  quantity: number;
}

interface Request {
  id: number;
  created_by: string;
  release_by: string | null;
  updated_at: string;
  status?: string;
  type?: 'material_request' | 'item_return';
  details?: {
    items: {
      id: number;
      item_id: number;
      quantity_received: number | null;
      item_name: string;
    }[];
    approvals?: {
      approver_name: string;
    }[];
  };
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  formatDate: (dateStr: string) => string;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label, formatDate }) => {
  if (active && payload && payload.length) {
    const formattedLabel = formatDate(label || '');
    return (
      <div className="bg-white p-3 border border-gray-200 shadow-md rounded-md">
        <p className="font-medium text-gray-900">{formattedLabel}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} style={{ color: entry.color }}>
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const Reports: React.FC = () => {
  const [usageData, setUsageData] = useState<UsageData[]>([]);
  const [topItemsOut, setTopItemsOut] = useState<TopItem[]>([]);
  const [topItemsIn, setTopItemsIn] = useState<TopItem[]>([]);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [filteredIssuances, setFilteredIssuances] = useState<CombinedTransaction[]>([]);
  const [filteredReturns, setFilteredReturns] = useState<CombinedTransaction[]>([]);
  const [currentTotal, setCurrentTotal] = useState<number>(0);
  const [allOutTotal, setAllOutTotal] = useState<number>(0);
  const [allInTotal, setAllInTotal] = useState<number>(0);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie' | 'scatter'>('bar');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const { toast } = useToast();

  useEffect(() => {
    loadReportData(startDate, endDate);
  }, [startDate, endDate]);

  const formatDateForDisplay = useCallback((dateStr: string) => {
    const date = new Date(dateStr);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[date.getDay()];
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${dayName}, ${day}/${month}/${year}`;
  }, []);

  const formatDate = useCallback((dateTime: string) => {
    const date = new Date(dateTime);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[date.getDay()];
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return {
      fullDate: `${dayName}, ${day}/${month}/${year}`,
      time: `${hours}:${minutes}`
    };
  }, []);

  // Compute historical stock snapshots for all transactions
  const computeHistoricalStocks = useCallback((allTransactions: CombinedTransaction[], itemsData: Item[]) => {
    // Group transactions by item_id
    const itemGroups: { [key: string]: CombinedTransaction[] } = {};
    allTransactions.forEach((trans) => {
      if (!itemGroups[trans.item_id]) {
        itemGroups[trans.item_id] = [];
      }
      itemGroups[trans.item_id].push(trans);
    });

    // For each item, compute running stock backwards from current
    Object.keys(itemGroups).forEach((itemId) => {
      const group = itemGroups[itemId];
      const currentItem = itemsData.find((i: Item) => i.id.toString() === itemId);
      let runningStock = currentItem?.quantity || 0;

      // Sort by date_time descending (newest first)
      group.sort((a, b) => new Date(b.date_time).getTime() - new Date(a.date_time).getTime());

      group.forEach((trans) => {
        // Assign stock AFTER this transaction
        trans.current_stock = runningStock;

        // Undo the transaction to get stock before it
        const qty = trans.quantity || 0;
        if (trans.transaction_type === 'out') {
          // Issuance: undo by adding back
          runningStock += qty;
        } else {
          // Return: undo by subtracting
          runningStock -= qty;
        }
      });
    });

    return allTransactions;
  }, []);

  const loadReportData = async (start: string, end: string) => {
    try {
      setIsLoading(true);
      const [itemsOutData, categoriesData, requestsData, itemsData] = await Promise.all([
        getItemsOut(), 
        getCategories(), 
        getRequests(), 
        getItems()
      ]);
      
      if (!Array.isArray(categoriesData)) {
        throw new Error('Invalid categories data');
      }
      if (!Array.isArray(itemsData)) {
        throw new Error('Invalid items data');
      }

      // Fetch details for ALL completed material requests (outgoings) - no date filter yet
      const allCompletedRequests = requestsData.filter((r: Request) => r.status === 'completed' && r.type === 'material_request');
      const allRequestDetailsPromises = allCompletedRequests.map((r: Request) => getRequestDetails(r.id));
      const allRequestDetailsArray = await Promise.all(allRequestDetailsPromises);

      // Create flat issuances from ALL completed requests
      const allRequestIssuances: CombinedTransaction[] = [];
      allRequestDetailsArray.forEach((details, index) => {
        const request = allCompletedRequests[index];
        if (request.release_by && details.items) {
          const approver = details.approvals?.[0]?.approver_name || null;
          const requester = request.created_by;
          details.items.forEach((item) => {
            if (item.quantity_received && item.quantity_received > 0) {
              const itemDetail = itemsData.find((i: Item) => i.id.toString() === item.item_id.toString());
              allRequestIssuances.push({
                id: `req-${request.id}-${item.id}`,
                person_name: request.release_by,
                item_id: item.item_id.toString(),
                quantity: item.quantity_received,
                date_time: request.updated_at,
                item_name: item.item_name,
                category_name: itemDetail?.category_name || 'Uncategorized',
                source: 'request',
                requester,
                approver,
                transaction_type: 'out' as const,
              });
            }
          });
        }
      });

      // Fetch details for ALL completed item returns (incomings)
      const allCompletedReturns = requestsData.filter((r: Request) => r.status === 'completed' && r.type === 'item_return');
      const allReturnDetailsPromises = allCompletedReturns.map((r: Request) => getRequestDetails(r.id));
      const allReturnDetailsArray = await Promise.all(allReturnDetailsPromises);

      // Create flat returns from ALL completed return requests
      const allReturnIssuances: CombinedTransaction[] = [];
      allReturnDetailsArray.forEach((details, index) => {
        const retRequest = allCompletedReturns[index];
        if (retRequest.release_by && details.items) {
          const approver = details.approvals?.[0]?.approver_name || null;
          const requester = retRequest.created_by;
          details.items.forEach((item) => {
            if (item.quantity_received && item.quantity_received > 0) {
              const itemDetail = itemsData.find((i: Item) => i.id.toString() === item.item_id.toString());
              allReturnIssuances.push({
                id: `ret-${retRequest.id}-${item.id}`,
                person_name: retRequest.release_by,
                item_id: item.item_id.toString(),
                quantity: item.quantity_received,
                date_time: retRequest.updated_at,
                item_name: item.item_name,
                category_name: itemDetail?.category_name || 'Uncategorized',
                source: 'return',
                requester,
                approver,
                transaction_type: 'in' as const,
              });
            }
          });
        }
      });

      // Combine ALL direct issuances, request issuances, and return issuances
      let allTransactions: CombinedTransaction[] = [
        ...itemsOutData.map((io: ItemOut) => ({ 
          ...io, 
          source: 'direct' as const,
          requester: undefined,
          approver: undefined,
          transaction_type: 'out' as const,
        })),
        ...allRequestIssuances,
        ...allReturnIssuances,
      ];

      // Compute historical stocks for ALL transactions
      allTransactions = computeHistoricalStocks(allTransactions, itemsData);

      // Now sort all by date_time
      allTransactions.sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());

      // Filter by date range
      const startDateTime = new Date(start + 'T00:00:00');
      const endDateTime = new Date(end + 'T23:59:59.999');
      const filteredAll = allTransactions.filter((trans) => {
        const transDate = new Date(trans.date_time);
        return transDate >= startDateTime && transDate <= endDateTime;
      });

      // Separate issuances (out) and returns (in)
      const filteredIssuancesLocal = filteredAll.filter(t => t.transaction_type === 'out');
      const filteredReturnsLocal = filteredAll.filter(t => t.transaction_type === 'in');
      setFilteredIssuances(filteredIssuancesLocal);
      setFilteredReturns(filteredReturnsLocal);

      const usageByDateTemp = generateUsageByDate(filteredAll, start, end);
      
      // Compute current total and all-time totals
      const currentTotalLocal = itemsData.reduce((sum, i) => sum + (i.quantity || 0), 0);
      setCurrentTotal(currentTotalLocal);
      
      const allOutLocal = allTransactions.filter(t => t.transaction_type === 'out').reduce((s, t) => s + (t.quantity || 0), 0);
      const allInLocal = allTransactions.filter(t => t.transaction_type === 'in').reduce((s, t) => s + (t.quantity || 0), 0);
      setAllOutTotal(allOutLocal);
      setAllInTotal(allInLocal);
      
      // Compute range sums
      const sumOutRange = usageByDateTemp.reduce((s, d) => s + d.items_out, 0);
      const sumInRange = usageByDateTemp.reduce((s, d) => s + d.items_in, 0);
      
      // Compute stock snapshots
      let runningStock = currentTotalLocal - sumInRange + sumOutRange; // stock before first day
      usageByDateTemp.forEach((day) => {
        day.stock_before = runningStock;
        runningStock += day.net_change;
        day.stock_after = runningStock;
      });
      
      setUsageData(usageByDateTemp);

      const itemUsageOut = generateTopItems(filteredIssuancesLocal, categoriesData, 'out');
      setTopItemsOut(itemUsageOut);

      const itemUsageIn = generateTopItems(filteredReturnsLocal, categoriesData, 'in');
      setTopItemsIn(itemUsageIn);

      const userUsage = generateTopUsers(filteredAll);
      setTopUsers(userUsage);
    } catch (error) {
      console.error('Error loading report data:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to load report data',
        variant: 'destructive',
      });
      setUsageData([]);
      setTopItemsOut([]);
      setTopItemsIn([]);
      setTopUsers([]);
      setFilteredIssuances([]);
      setFilteredReturns([]);
      setCurrentTotal(0);
      setAllOutTotal(0);
      setAllInTotal(0);
    } finally {
      setIsLoading(false);
    }
  };

  const generateUsageByDate = (transactions: CombinedTransaction[], startStr: string, endStr: string): UsageData[] => {
    const dateMap: { [key: string]: UsageTracking } = {};
    const start = new Date(startStr + 'T00:00:00');
    const end = new Date(endStr + 'T23:59:59.999');
    let current = new Date(start);

    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];
      dateMap[dateStr] = { 
        date: dateStr, 
        items_out: 0, 
        items_in: 0, 
        net_change: 0,
        users: new Set<string>(), 
        source_direct: 0, 
        source_request: 0,
        source_return: 0 
      };
      current.setDate(current.getDate() + 1);
    }

    transactions.forEach((trans) => {
      const dateStr = new Date(trans.date_time).toISOString().split('T')[0];
      if (dateMap[dateStr]) {
        dateMap[dateStr].users.add(trans.person_name || 'Unknown');
        const qty = trans.quantity || 0;
        if (trans.transaction_type === 'out') {
          dateMap[dateStr].items_out += qty;
          dateMap[dateStr].net_change -= qty;
          if (trans.source === 'direct') {
            dateMap[dateStr].source_direct += qty;
          } else if (trans.source === 'request') {
            dateMap[dateStr].source_request += qty;
          }
        } else if (trans.transaction_type === 'in') {
          dateMap[dateStr].items_in += qty;
          dateMap[dateStr].net_change += qty;
          dateMap[dateStr].source_return += qty;
        }
      }
    });

    return Object.values(dateMap)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((entry) => ({
        date: entry.date,
        formattedDate: formatDateForDisplay(entry.date),
        items_out: entry.items_out,
        items_in: entry.items_in,
        net_change: entry.net_change,
        users: entry.users.size,
        source_direct: entry.source_direct,
        source_request: entry.source_request,
        source_return: entry.source_return,
      }));
  };

  const generateTopItems = (transactions: CombinedTransaction[], categories: Category[], type: 'out' | 'in'): TopItem[] => {
    const itemCounts: { [key: string]: { count: number; name: string; category: string; source: 'direct' | 'request' | 'return' } } = {};

    transactions.forEach((record) => {
      const itemId = record.item_id;
      const itemName = record.item_name || 'Unknown Item';
      const categoryName = record.category_name || 'Uncategorized';

      if (!itemCounts[itemId]) {
        itemCounts[itemId] = { count: 0, name: itemName, category: categoryName, source: record.source };
      } else if (itemCounts[itemId].source !== record.source) {
        itemCounts[itemId].source = record.source;
      }
      itemCounts[itemId].count += record.quantity || 0;
    });

    return Object.values(itemCounts)
      .map((item) => ({
        name: item.name,
        count: item.count,
        category: item.category,
        source: item.source,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  };

  const generateTopUsers = (transactions: CombinedTransaction[]): TopUser[] => {
    const userCounts: { [key: string]: { count: number; source: 'direct' | 'request' | 'return' } } = {};

    transactions.forEach((record) => {
      const personName = record.person_name || 'Unknown';
      if (!userCounts[personName]) {
        userCounts[personName] = { count: 0, source: record.source };
      } else if (userCounts[personName].source !== record.source) {
        userCounts[personName].source = record.source;
      }
      userCounts[personName].count += record.quantity || 0;
    });

    return Object.entries(userCounts)
      .map(([name, data]) => ({ name, count: data.count, source: data.source }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  };

  // Helper to add blank rows in Excel when date changes
  const addBlankRowsOnDateChange = (sheet: any, transactions: CombinedTransaction[], formatDateFn: (dt: string) => { fullDate: string }) => {
    let prevDate = '';
    transactions.forEach((trans) => {
      const { fullDate } = formatDateFn(trans.date_time);
      if (fullDate !== prevDate && prevDate !== '') {
        // Add 3 blank rows for spacing
        for (let i = 0; i < 3; i++) {
          sheet.addRow([]); // Empty row
        }
      }
      prevDate = fullDate;
    });
  };

  const handleExport = async () => {
    if (filteredIssuances.length === 0 && filteredReturns.length === 0) {
      toast({
        title: 'No Data',
        description: 'No transactions to export',
        variant: 'destructive',
      });
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      const filename = `inventory-report-${startDate}-to-${endDate}.xlsx`;

      // Group transactions by date for mini-tables
      const issuancesByDate: Record<string, CombinedTransaction[]> = {};
      filteredIssuances.forEach((trans) => {
        const dateKey = new Date(trans.date_time).toISOString().split('T')[0];
        if (!issuancesByDate[dateKey]) issuancesByDate[dateKey] = [];
        issuancesByDate[dateKey].push(trans);
      });
      const returnsByDate: Record<string, CombinedTransaction[]> = {};
      filteredReturns.forEach((trans) => {
        const dateKey = new Date(trans.date_time).toISOString().split('T')[0];
        if (!returnsByDate[dateKey]) returnsByDate[dateKey] = [];
        returnsByDate[dateKey].push(trans);
      });

      // Sheet 1: Daily Summary (Main sheet)
      const summarySheet = workbook.addWorksheet('Daily Summary');
      summarySheet.views = [
        { state: 'frozen', xSplit: 0, ySplit: 1, activeCell: 'A2' }
      ];

      // Headers for Summary
      const summaryHeaders = ['Date', 'Stock Before', 'Items Issued (Direct/Req)', 'Items Returned', 'Net Change (Positive = Gain)', 'Stock After', 'Active Users'];
      summarySheet.addRow(summaryHeaders);
      summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      summarySheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
      };

      // Add summary data with mini-tables
      let currentRow = 2;
      usageData.forEach((day) => {
        const dayRow = currentRow;
        summarySheet.getCell(`A${dayRow}`).value = day.formattedDate;
        summarySheet.getCell(`B${dayRow}`).value = day.stock_before;
        summarySheet.getCell(`C${dayRow}`).value = `${day.items_out} (${day.source_direct}/${day.source_request})`;
        summarySheet.getCell(`D${dayRow}`).value = day.items_in;
        summarySheet.getCell(`E${dayRow}`).value = day.net_change;
        summarySheet.getCell(`F${dayRow}`).value = { formula: `B${dayRow} + E${dayRow}` };
        summarySheet.getCell(`G${dayRow}`).value = day.users;
        currentRow = dayRow + 1;

        // Issued mini-table
        const dateKey = day.date;
        const dayIss = issuancesByDate[dateKey] || [];
        if (dayIss.length > 0) {
          currentRow++; // Section header
          summarySheet.getCell(`A${currentRow}`).value = `Issued Items - ${day.formattedDate}`;
          summarySheet.getCell(`A${currentRow}`).font = { bold: true, size: 12 };
          currentRow++;

          // Sub-headers
          summarySheet.getCell(`A${currentRow}`).value = 'Item Name';
          summarySheet.getCell(`B${currentRow}`).value = 'Category';
          summarySheet.getCell(`C${currentRow}`).value = 'Qty';
          summarySheet.getCell(`D${currentRow}`).value = 'Source';
          summarySheet.getCell(`E${currentRow}`).value = 'Stock After Issuance (Historical Balance)';
          summarySheet.getRow(currentRow).font = { bold: true };
          currentRow++;

          dayIss.forEach((iss) => {
            summarySheet.getCell(`A${currentRow}`).value = iss.item_name || 'Unknown Item';
            summarySheet.getCell(`B${currentRow}`).value = iss.category_name || 'Uncategorized';
            summarySheet.getCell(`C${currentRow}`).value = iss.quantity;
            summarySheet.getCell(`D${currentRow}`).value = iss.source.charAt(0).toUpperCase() + iss.source.slice(1);
            summarySheet.getCell(`E${currentRow}`).value = iss.current_stock || 0;
            currentRow++;
          });

          // Subtotal
          summarySheet.getCell(`A${currentRow}`).value = 'Daily Issued Total:';
          summarySheet.getCell(`C${currentRow}`).value = day.items_out;
          summarySheet.getRow(currentRow).font = { bold: true };
          currentRow += 2; // Blanks
        } else {
          currentRow++;
          summarySheet.getCell(`A${currentRow}`).value = 'No issuances this day.';
          summarySheet.getCell(`A${currentRow}`).font = { italic: true };
          currentRow++;
        }

        // Returns mini-table
        const dayRet = returnsByDate[dateKey] || [];
        if (dayRet.length > 0) {
          currentRow++; // Section header
          summarySheet.getCell(`A${currentRow}`).value = `Returned Items - ${day.formattedDate}`;
          summarySheet.getCell(`A${currentRow}`).font = { bold: true, size: 12 };
          currentRow++;

          // Sub-headers
          summarySheet.getCell(`A${currentRow}`).value = 'Item Name';
          summarySheet.getCell(`B${currentRow}`).value = 'Category';
          summarySheet.getCell(`C${currentRow}`).value = 'Qty';
          summarySheet.getCell(`D${currentRow}`).value = 'Stock After Return (Historical Balance)';
          summarySheet.getRow(currentRow).font = { bold: true };
          currentRow++;

          dayRet.forEach((ret) => {
            summarySheet.getCell(`A${currentRow}`).value = ret.item_name || 'Unknown Item';
            summarySheet.getCell(`B${currentRow}`).value = ret.category_name || 'Uncategorized';
            summarySheet.getCell(`C${currentRow}`).value = ret.quantity;
            summarySheet.getCell(`D${currentRow}`).value = ret.current_stock || 0;
            currentRow++;
          });

          // Subtotal
          summarySheet.getCell(`A${currentRow}`).value = 'Daily Returned Total:';
          summarySheet.getCell(`C${currentRow}`).value = day.items_in;
          summarySheet.getRow(currentRow).font = { bold: true };
          currentRow += 2; // Blanks
        } else {
          currentRow++;
          summarySheet.getCell(`A${currentRow}`).value = 'No returns this day.';
          summarySheet.getCell(`A${currentRow}`).font = { italic: true };
          currentRow++;
        }
      });

      // Grand totals
      const totalItemsIssued = usageData.reduce((sum, day) => sum + day.items_out, 0);
      const totalItemsReturned = usageData.reduce((sum, day) => sum + day.items_in, 0);
      const totalNetChange = usageData.reduce((sum, day) => sum + day.net_change, 0);
      const totalDirect = usageData.reduce((sum, day) => sum + day.source_direct, 0);
      const totalRequest = usageData.reduce((sum, day) => sum + day.source_request, 0);
      const grandRow = currentRow + 1;
      summarySheet.getCell(`A${grandRow}`).value = 'Grand Total';
      summarySheet.getCell(`B${grandRow}`).value = usageData[0]?.stock_before || 0;
      summarySheet.getCell(`C${grandRow}`).value = `${totalItemsIssued} (${totalDirect}/${totalRequest})`;
      summarySheet.getCell(`D${grandRow}`).value = totalItemsReturned;
      summarySheet.getCell(`E${grandRow}`).value = totalNetChange;
      summarySheet.getCell(`F${grandRow}`).value = usageData[usageData.length - 1]?.stock_after || 0;
      summarySheet.getCell(`G${grandRow}`).value = '';
      const grandRowObj = summarySheet.getRow(grandRow);
      grandRowObj.font = { bold: true };
      grandRowObj.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
      if (totalNetChange < 0) {
        summarySheet.getCell(`E${grandRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F3FF' } };
      } else if (totalNetChange > 0) {
        summarySheet.getCell(`E${grandRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E8' } };
      }

      // Conditional formatting for Net Change column
      const lastSummaryRow = grandRow;
      summarySheet.addConditionalFormatting({
        ref: `E2:E${lastSummaryRow}`,
        rules: [
          {
            type: 'expression',
            formulae: ['$E2 > 0'],
            style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E8' } } }
          },
          {
            type: 'expression',
            formulae: ['$E2 < 0'],
            style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F3FF' } } }
          }
        ]
      });

      // Column widths for summary
      summarySheet.columns = [
        { width: 20 }, { width: 12 }, { width: 22 }, { width: 12 },
        { width: 15 }, { width: 12 }, { width: 12 }
      ];

      // Sheet 2: Overall Inventory History
      const overallSheet = workbook.addWorksheet('Overall Inventory History');
      overallSheet.views = [
        { state: 'frozen', xSplit: 0, ySplit: 1, activeCell: 'A2' }
      ];

      const overallHeaders = ['Event', 'Quantity Change', 'Running Total', 'Notes'];
      overallSheet.addRow(overallHeaders);
      overallSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      overallSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
      };

      const initialStockApprox = currentTotal + allOutTotal - allInTotal;
      let runningOverall = initialStockApprox;
      overallSheet.addRow(['Initial Stock (Approximated)', '', initialStockApprox, 'Reverse calc: Current Stock + All Issued Ever - All Returned Ever']);
      runningOverall += allInTotal;
      overallSheet.addRow(['Total Inflows (All Returns Ever)', allInTotal, runningOverall, '']);
      runningOverall -= allOutTotal;
      overallSheet.addRow(['Total Outflows (All Issued Ever)', -allOutTotal, runningOverall, 'Direct + Requests']);
      overallSheet.addRow(['Net Lifetime Change', allInTotal - allOutTotal, runningOverall, '']);
      overallSheet.addRow(['Current Total Stock', '', currentTotal, `As of ${new Date().toLocaleDateString()}, total stock left: ${currentTotal} (down ${((initialStockApprox - currentTotal) / initialStockApprox * 100).toFixed(1)}% from start)`]);

      // Chart data section (for reference, chart addition removed due to compatibility)
      const chartStartRow = 10;
      overallSheet.getCell(`A${chartStartRow}`).value = 'Category';
      overallSheet.getCell(`B${chartStartRow}`).value = 'Quantity';
      overallSheet.addRow([]); // blank
      overallSheet.getCell(`A${chartStartRow + 1}`).value = 'Total Issued';
      overallSheet.getCell(`B${chartStartRow + 1}`).value = allOutTotal;
      overallSheet.getCell(`A${chartStartRow + 2}`).value = 'Total Returned';
      overallSheet.getCell(`B${chartStartRow + 2}`).value = allInTotal;
      overallSheet.getCell(`A${chartStartRow + 3}`).value = 'Note: Pie chart for % distribution can be manually added in Excel using this data.';

      overallSheet.columns = [
        { width: 30 }, { width: 15 }, { width: 15 }, { width: 40 }
      ];

      // Sheet 3: Issuances (Out)
      const issuancesSheet = workbook.addWorksheet('Issuances (Out)');
      issuancesSheet.views = [
        { state: 'frozen', xSplit: 0, ySplit: 1, activeCell: 'A2' }
      ];

      // Headers for Issuances
      const issuanceHeaders = [
        'Date',
        'Time',
        'Item Name',
        'Category',
        'Quantity Issued',
        'Stock After Issuance',
        'Source (Direct/Request)',
        'Requester',
        'Approver',
        'Issuer'
      ];
      issuancesSheet.addRow(issuanceHeaders);
      issuancesSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      issuancesSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
      };

      // Sort issuances by date_time
      const sortedIssuances = [...filteredIssuances].sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());

      // Add data rows with blank spacing on date change
      let totalQtyIssued = 0;
      let prevDate = '';
      sortedIssuances.forEach((iss) => {
        const { fullDate, time } = formatDate(iss.date_time);
        if (fullDate !== prevDate && prevDate !== '') {
          // Add 3 blank rows
          for (let i = 0; i < 3; i++) {
            issuancesSheet.addRow([]);
          }
        }
        const row = [
          fullDate,
          time,
          iss.item_name || 'Unknown Item',
          iss.category_name || 'Uncategorized',
          iss.quantity,
          iss.current_stock || 0,
          iss.source.charAt(0).toUpperCase() + iss.source.slice(1),
          iss.requester || 'N/A',
          iss.approver || 'N/A',
          iss.person_name || 'Unknown'
        ];
        issuancesSheet.addRow(row);
        totalQtyIssued += iss.quantity || 0;
        prevDate = fullDate;
      });

      // Total row for issuances
      const totalIssuanceRow = issuancesSheet.addRow(['', '', '', '', `Total Issued: ${totalQtyIssued}`, '', '', '', '', '']);
      totalIssuanceRow.font = { bold: true };
      totalIssuanceRow.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };

      // Column widths
      issuancesSheet.columns = [
        { width: 20 }, { width: 12 }, { width: 25 }, { width: 15 },
        { width: 15 }, { width: 18 }, { width: 15 }, { width: 15 },
        { width: 15 }, { width: 15 }
      ];

      // Conditional formatting for Source in issuances
      const lastRowIss = issuancesSheet.rowCount;
      issuancesSheet.addConditionalFormatting({
        ref: `G2:G${lastRowIss}`,
        rules: [
          {
            type: 'cellIs',
            operator: 'equal',
            formulae: ['"Direct"'],
            style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F3FF' } } }
          },
          {
            type: 'cellIs',
            operator: 'equal',
            formulae: ['"Request"'],
            style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E8' } } }
          }
        ]
      });

      // Sheet 4: Returns (In)
      const returnsSheet = workbook.addWorksheet('Returns (In)');
      returnsSheet.views = [
        { state: 'frozen', xSplit: 0, ySplit: 1, activeCell: 'A2' }
      ];

      // Headers for Returns
      const returnHeaders = [
        'Date',
        'Time',
        'Item Name',
        'Category',
        'Quantity Returned',
        'Stock After Return',
        'Requester',
        'Approver',
        'Returner'
      ];
      returnsSheet.addRow(returnHeaders);
      returnsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      returnsSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF70AD47' }
      };

      // Sort returns by date_time
      const sortedReturns = [...filteredReturns].sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());

      // Add data rows with blank spacing on date change
      let totalQtyReturned = 0;
      prevDate = '';
      sortedReturns.forEach((ret) => {
        const { fullDate, time } = formatDate(ret.date_time);
        if (fullDate !== prevDate && prevDate !== '') {
          // Add 3 blank rows
          for (let i = 0; i < 3; i++) {
            returnsSheet.addRow([]);
          }
        }
        const row = [
          fullDate,
          time,
          ret.item_name || 'Unknown Item',
          ret.category_name || 'Uncategorized',
          ret.quantity,
          ret.current_stock || 0,
          ret.requester || 'N/A',
          ret.approver || 'N/A',
          ret.person_name || 'Unknown'
        ];
        returnsSheet.addRow(row);
        totalQtyReturned += ret.quantity || 0;
        prevDate = fullDate;
      });

      // Total row for returns
      const totalReturnRow = returnsSheet.addRow(['', '', '', '', `Total Returned: ${totalQtyReturned}`, '', '', '', '']);
      totalReturnRow.font = { bold: true };
      totalReturnRow.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };

      // Column widths for returns
      returnsSheet.columns = [
        { width: 20 }, { width: 12 }, { width: 25 }, { width: 15 },
        { width: 15 }, { width: 18 }, { width: 15 }, { width: 15 }, { width: 15 }
      ];

      // Sheet 5: Top Items Issued
      const itemsOutSheet = workbook.addWorksheet('Top Items Issued');
      itemsOutSheet.views = [
        { state: 'frozen', xSplit: 0, ySplit: 1, activeCell: 'A2' }
      ];

      const itemOutHeaders = ['Rank', 'Item Name', 'Category', 'Source', 'Quantity Issued'];
      itemsOutSheet.addRow(itemOutHeaders);
      itemsOutSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      itemsOutSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFED7D31' }
      };

      topItemsOut.forEach((item, index) => {
        itemsOutSheet.addRow([index + 1, item.name, item.category, item.source, item.count]);
      });

      itemsOutSheet.columns = [
        { width: 8 }, { width: 30 }, { width: 20 }, { width: 10 }, { width: 15 }
      ];

      // Sheet 6: Top Items Returned
      const itemsInSheet = workbook.addWorksheet('Top Items Returned');
      itemsInSheet.views = [
        { state: 'frozen', xSplit: 0, ySplit: 1, activeCell: 'A2' }
      ];

      const itemInHeaders = ['Rank', 'Item Name', 'Category', 'Quantity Returned'];
      itemsInSheet.addRow(itemInHeaders);
      itemsInSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      itemsInSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF70AD47' }
      };

      topItemsIn.forEach((item, index) => {
        itemsInSheet.addRow([index + 1, item.name, item.category, item.count]);
      });

      itemsInSheet.columns = [
        { width: 8 }, { width: 30 }, { width: 20 }, { width: 15 }
      ];

      // Sheet 7: Top Users
      const usersSheet = workbook.addWorksheet('Top Users');
      usersSheet.views = [
        { state: 'frozen', xSplit: 0, ySplit: 1, activeCell: 'A2' }
      ];

      const userHeaders = ['Rank', 'User Name', 'Source', 'Total Quantity'];
      usersSheet.addRow(userHeaders);
      usersSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      usersSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFED7D31' }
      };

      topUsers.forEach((user, index) => {
        usersSheet.addRow([index + 1, user.name, user.source, user.count]);
      });

      usersSheet.columns = [
        { width: 8 }, { width: 25 }, { width: 10 }, { width: 15 }
      ];

      // Generate and download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, filename);

      toast({
        title: 'Success',
        description: `Enhanced Excel report exported successfully (with Daily Summary, Overall History, and breakdowns)`,
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Export Error',
        description: 'Failed to generate Excel file',
        variant: 'destructive',
      });
    }
  };

  const totalItemsIssued = usageData.reduce((sum, day) => sum + day.items_out, 0);
  const totalItemsReturned = usageData.reduce((sum, day) => sum + day.items_in, 0);
  const totalNetChange = usageData.reduce((sum, day) => sum + day.net_change, 0);
  const maxActiveUsers = Math.max(...usageData.map((day) => day.users), 0);
  const numDays = usageData.length;
  const avgDailyNet = numDays > 0 ? Math.round(totalNetChange / numDays) : 0;
  const totalDirect = usageData.reduce((sum, day) => sum + day.source_direct, 0);
  const totalRequest = usageData.reduce((sum, day) => sum + day.source_request, 0);
  const totalReturn = usageData.reduce((sum, day) => sum + day.source_return, 0);
  const COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#10B981'];

  const formattedStartDate = formatDateForDisplay(startDate);
  const formattedEndDate = formatDateForDisplay(endDate);
  const isSingleDay = startDate === endDate;

  const tooltipContent = useCallback(({ active, payload, label }: any) => {
    return <CustomTooltip active={active} payload={payload} label={label} formatDate={formatDateForDisplay} />;
  }, [formatDateForDisplay]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-600 mt-1">Analyze comprehensive usage trends, including issuances, returns, and net stock changes</p>
        </div>
        <div className="flex items-center space-x-2 mt-4 md:mt-0">
          <Button
            variant="outline"
            className="bg-white border border-gray-300 hover:bg-gray-50"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings className="h-4 w-4 mr-2" />
            Settings
            {showSettings ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
          </Button>
          <Button onClick={handleExport} className="bg-green-600 hover:bg-green-700 text-white" disabled={filteredIssuances.length === 0 && filteredReturns.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export Enhanced Excel
          </Button>
        </div>
      </div>

      {showSettings && (
        <div className="mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm animate-in slide-in-from-top-2 duration-300">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Chart Type</label>
              <div className="flex space-x-2">
                <Button
                  variant={chartType === 'bar' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setChartType('bar')}
                  className={`flex-1 ${chartType === 'bar' ? 'bg-blue-500 text-white' : 'bg-white'}`}
                >
                  <BarChart2 className="h-4 w-4 mr-1" /> Bar
                </Button>
                <Button
                  variant={chartType === 'line' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setChartType('line')}
                  className={`flex-1 ${chartType === 'line' ? 'bg-green-500 text-white' : 'bg-white'}`}
                >
                  <TrendingUp className="h-4 w-4 mr-1" /> Line
                </Button>
                <Button
                  variant={chartType === 'pie' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setChartType('pie')}
                  className={`flex-1 ${chartType === 'pie' ? 'bg-purple-500 text-white' : 'bg-white'}`}
                >
                  <PieChartIcon className="h-4 w-4 mr-1" /> Pie
                </Button>
                <Button
                  variant={chartType === 'scatter' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setChartType('scatter')}
                  className={`flex-1 ${chartType === 'scatter' ? 'bg-orange-500 text-white' : 'bg-white'}`}
                >
                  <Package className="h-4 w-4 mr-1" /> Scatter
                </Button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Actions</label>
              <Button variant="outline" size="sm" className="bg-white w-full" onClick={() => loadReportData(startDate, endDate)}>
                <RefreshCw className="h-4 w-4 mr-2" /> Refresh Data
              </Button>
            </div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading comprehensive report data...</p>
        </div>
      )}

      {!isLoading && usageData.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Items Issued</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{totalItemsIssued}</p>
                  <p className="text-sm text-blue-600 mt-1">{formattedStartDate} to {formattedEndDate}</p>
                  <p className="text-xs text-gray-500 mt-1">Direct: {totalDirect} | Requests: {totalRequest}</p>
                </div>
                <div className="p-3 rounded-lg bg-blue-100">
                  <ArrowDownCircle className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Items Returned</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{totalItemsReturned}</p>
                  <p className="text-sm text-green-600 mt-1">Additions to stock</p>
                </div>
                <div className="p-3 rounded-lg bg-green-100">
                  <ArrowUpCircle className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Net Stock Change</p>
                  <p className={`text-3xl font-bold mt-2 ${totalNetChange < 0 ? 'text-red-600' : totalNetChange > 0 ? 'text-green-600' : 'text-gray-600'}`}>
                    {totalNetChange >= 0 ? '+' : ''}{totalNetChange}
                  </p>
                  <p className="text-sm text-purple-600 mt-1">Avg daily: {avgDailyNet}</p>
                </div>
                <div className="p-3 rounded-lg bg-purple-100">
                  <Filter className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                  <TrendingUp className="h-5 w-5 mr-2 text-blue-600" />
                  Stock Flow Trend ({chartType})
                </h2>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                {chartType === 'bar' ? (
                  <BarChart data={usageData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="formattedDate" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip content={tooltipContent} />
                    <Legend />
                    <Bar dataKey="source_direct" fill="#3B82F6" name="Direct Out" stackId="out" />
                    <Bar dataKey="source_request" fill="#8B5CF6" name="Request Out" stackId="out" />
                    <Bar dataKey="source_return" fill="#10B981" name="Returns In" stackId="in" />
                    <Bar dataKey="net_change" fill="#EF4444" name="Net Change" />
                  </BarChart>
                ) : chartType === 'line' ? (
                  <LineChart data={usageData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="formattedDate" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip content={tooltipContent} />
                    <Legend />
                    <Line type="monotone" dataKey="items_out" stroke="#3B82F6" name="Issued" strokeWidth={2} strokeDasharray="5 5" />
                    <Line type="monotone" dataKey="items_in" stroke="#10B981" name="Returned" strokeWidth={2} />
                    <Line type="monotone" dataKey="net_change" stroke="#8B5CF6" name="Net" strokeWidth={3} />
                    <Line type="monotone" dataKey="users" stroke="#F59E0B" name="Users" strokeWidth={2} dot={false} />
                  </LineChart>
                ) : chartType === 'pie' ? (
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Direct', value: totalDirect },
                        { name: 'Requests', value: totalRequest },
                        { name: 'Returns', value: totalReturn }
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {[{ name: 'Direct', value: totalDirect }, { name: 'Requests', value: totalRequest }, { name: 'Returns', value: totalReturn }].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                ) : chartType === 'scatter' ? (
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="category" dataKey="formattedDate" name="Date" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={60} />
                    <YAxis type="number" name="Quantity" tick={{ fontSize: 12 }} />
                    <ZAxis type="number" range={[100]} name="Users" />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                    <Scatter name="Issued" data={usageData.map(d => ({ ...d, items: d.items_out }))} fill="#3B82F6" />
                    <Scatter name="Returned" data={usageData.map(d => ({ ...d, items: d.items_in }))} fill="#10B981" />
                  </ScatterChart>
                ) : null}
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                <BarChart2 className="h-5 w-5 mr-2 text-red-600" />
                Most Issued Items
              </h2>
              <div className="space-y-4">
                {topItemsOut.length > 0 ? (
                  topItemsOut.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="flex items-center">
                        <div className={`w-3 h-3 rounded-full mr-3 ${item.source === 'direct' ? 'bg-blue-500' : 'bg-purple-500'}`}></div>
                        <div>
                          <p className="font-medium text-gray-900">{item.name}</p>
                          <p className="text-xs text-gray-500">{item.category} ({item.source})</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">{item.count}</p>
                        <div className="w-24 bg-gray-200 rounded-full h-2 mt-1">
                          <div
                            className={`h-2 rounded-full ${item.source === 'direct' ? 'bg-blue-500' : 'bg-purple-500'}`}
                            style={{ width: `${(item.count / Math.max(...topItemsOut.map((i) => i.count))) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center py-4 text-gray-500">No issuance data available</p>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                <BarChart2 className="h-5 w-5 mr-2 text-green-600" />
                Most Returned Items
              </h2>
              <div className="space-y-4">
                {topItemsIn.length > 0 ? (
                  topItemsIn.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full mr-3 bg-green-500"></div>
                        <div>
                          <p className="font-medium text-gray-900">{item.name}</p>
                          <p className="text-xs text-gray-500">{item.category}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">{item.count}</p>
                        <div className="w-24 bg-gray-200 rounded-full h-2 mt-1">
                          <div
                            className="h-2 rounded-full bg-green-500"
                            style={{ width: `${(item.count / Math.max(...topItemsIn.map((i) => i.count))) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center py-4 text-gray-500">No return data available</p>
                )}
              </div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                <Users className="h-5 w-5 mr-2 text-purple-600" />
                Most Active Users
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {topUsers.length > 0 ? (
                  topUsers.map((user, index) => (
                    <div key={index} className="text-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 border-2 ${user.source === 'direct' ? 'bg-blue-100 border-blue-200' : user.source === 'request' ? 'bg-purple-100 border-purple-200' : 'bg-green-100 border-green-200'}`}>
                        <span className={`text-xl font-bold ${user.source === 'direct' ? 'text-blue-600' : user.source === 'request' ? 'text-purple-600' : 'text-green-600'}`}>{user.name.charAt(0)}</span>
                      </div>
                      <p className="font-medium text-gray-900">{user.name}</p>
                      <p className="text-xs text-gray-500 mt-1">({user.source})</p>
                      <p className="text-sm text-gray-600 mt-1">{user.count} items</p>
                      <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${user.source === 'direct' ? 'bg-blue-600' : user.source === 'request' ? 'bg-purple-600' : 'bg-green-600'}`}
                          style={{ width: `${(user.count / Math.max(...topUsers.map((u) => u.count))) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-5 text-center py-4 text-gray-500">No user activity data available</div>
                )}
              </div>
            </div>
          </div>

          {isSingleDay && (filteredIssuances.length > 0 || filteredReturns.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredIssuances.length > 0 && (
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                    <FileText className="h-5 w-5 mr-2 text-indigo-600" />
                    Daily Issuances - {formattedStartDate}
                  </h2>
                  <p className="text-sm text-gray-600 mb-4">Items taken out (stock after issuance)</p>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date & Time</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty Issued</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock After</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requester</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Approver</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Issuer</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredIssuances.map((iss, index) => {
                          const { fullDate, time } = formatDate(iss.date_time);
                          return (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                <div className="font-medium">{fullDate}</div>
                                <div className="text-gray-500 text-xs">{time}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{iss.item_name}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{iss.category_name || 'Uncategorized'}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{iss.quantity}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{iss.current_stock || 0}</td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                  iss.source === 'direct' 
                                    ? 'bg-blue-100 text-blue-800' 
                                    : 'bg-purple-100 text-purple-800'
                                }`}>
                                  {iss.source.charAt(0).toUpperCase() + iss.source.slice(1)}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-900">{iss.requester || 'N/A'}</td>
                              <td className="px-6 py-4 text-sm text-gray-900">{iss.approver || 'N/A'}</td>
                              <td className="px-6 py-4 text-sm font-medium text-gray-900">{iss.person_name}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {filteredReturns.length > 0 && (
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                    <FileText className="h-5 w-5 mr-2 text-green-600" />
                    Daily Returns - {formattedStartDate}
                  </h2>
                  <p className="text-sm text-gray-600 mb-4">Items added back to stock (stock after return)</p>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date & Time</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty Returned</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock After</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requester</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Approver</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Returner</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredReturns.map((ret, index) => {
                          const { fullDate, time } = formatDate(ret.date_time);
                          return (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                <div className="font-medium">{fullDate}</div>
                                <div className="text-gray-500 text-xs">{time}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{ret.item_name}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ret.category_name || 'Uncategorized'}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{ret.quantity}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{ret.current_stock || 0}</td>
                              <td className="px-6 py-4 text-sm text-gray-900">{ret.requester || 'N/A'}</td>
                              <td className="px-6 py-4 text-sm text-gray-900">{ret.approver || 'N/A'}</td>
                              <td className="px-6 py-4 text-sm font-medium text-gray-900">{ret.person_name}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {!isLoading && usageData.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No data available for the selected date range.</p>
          <p className="text-gray-400 text-sm mt-2">Try adjusting the date filters in settings.</p>
        </div>
      )}
    </div>
  );
};

export default Reports;