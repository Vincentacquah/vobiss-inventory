import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, MessageSquare, HelpCircle, X, Info, User, Clock, Mail, Download, FileText, Calendar as CalendarIcon, FileSpreadsheet } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { 
  getItems, 
  getCategories, 
  getItemsOut, 
  addItem, 
  getRequests, 
  getRequestDetails,
  getAuditLogs,
  getLowStockItems,
  sendLowStockAlert,
  getSupervisors,
  getDashboardStats
} from '../api';
import { useAuth } from '../context/AuthContext';
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

// Load string-similarity via CDN
const script = document.createElement('script');
script.src = 'https://cdn.jsdelivr.net/npm/string-similarity@4.0.4/umd/string-similarity.min.js';
script.async = true;
document.body.appendChild(script);

/**
 * Interface for chat messages
 */
interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  options?: { text: string; action: () => void }[];
  downloadBlob?: Blob;
  downloadFilename?: string;
}

/**
 * Interface for inventory items
 */
interface Item {
  id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  quantity: number;
  low_stock_threshold: number;
  category_name?: string; // Added for PDF compatibility
}

/**
 * Interface for items checked out
 */
interface ItemOut {
  person_name: string;
  item_id: string;
  quantity: number;
  date_time: string;
  item_name: string;
  category_name: string;
}

/**
 * Interface for requests
 */
interface Request {
  id: number;
  status: string;
  project_name: string;
  created_by: string;
  created_at: string;
}

/**
 * Interface for audit logs
 */
interface AuditLog {
  id: number;
  action: string;
  username?: string;
  full_name?: string;
  ip_address: string;
  details: any;
  timestamp: string;
}

/**
 * Interface for combined issuance for daily reports
 */
interface CombinedIssuance {
  person_name: string;
  item_name: string;
  category_name: string;
  quantity: number;
  date_time: string;
  requester?: string;
  approver?: string;
  current_stock?: number;
  source: 'direct' | 'request';
}

/**
 * PDF Result Interface
 */
interface PDFResult {
  blob: Blob | null;
  filename: string;
  message: string;
}

/**
 * AIAssistant Component
 * Provides a conversational chat interface with real-time database interaction
 */
const AIAssistant: React.FC = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showHelpPanel, setShowHelpPanel] = useState(false);
  const [systemStatus, setSystemStatus] = useState<{
    totalItems: number;
    lowStockItems: number;
    categoriesCount: number;
    recentActivity: number;
    lastLogin: { username: string; timestamp: string } | null;
  } | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [conversationState, setConversationState] = useState<{
    mode: 'normal' | 'addingItem';
    addItemData?: { itemName: string; categoryId: string | null; quantity: number | null; newCategoryName?: string };
    waitingFor?: 'itemName' | 'category' | 'newCategoryName' | 'quantity';
  }>({ mode: 'normal' });
  const [dataCache, setDataCache] = useState<any>({ lastUpdate: 0 });

  // New state for daily report
  const [selectedReportDate, setSelectedReportDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Dynamic help topics based on real system data
  const generateHelpTopics = () => [
    { topic: "Find items", command: `find ${items[0]?.name || 'item'}`, description: "Search for items by name or description" },
    { topic: "Check stock", command: "show low stock", description: "View low stock items and send alerts" },
    { topic: "Category details", command: `items in ${categories[0]?.name || 'category'}`, description: "Explore items in a category" },
    { topic: "User activity", command: "who checked out items", description: "See user checkout history" },
    { topic: "Recent logins", command: "last login", description: "Check the most recent login" },
    { topic: "All requests", command: "show requests", description: "View all requests (Super Admin only)" },
    { topic: "Recent changes", command: "recent activity", description: "See latest inventory updates" },
    { topic: "Inventory overview", command: "inventory status", description: "Get a system summary" },
    { topic: "Add item", command: `add ${items[0]?.name || 'item'}`, description: "Add a new item to inventory" },
    { topic: "Restock suggestions", command: "suggest restock", description: "Get recommendations for restocking" },
    { topic: "Send alert", command: "send low stock alert", description: "Notify supervisors about low stock via email" },
    { topic: "Generate report", command: "generate low stock report", description: "Create a PDF report of low stock items" },
    { topic: "Full system report", command: "generate full system report", description: "Comprehensive PDF with logins, inventory, issues, and health" },
    { topic: "Daily report", command: "generate daily report", description: "Generate PDF/Excel for a specific day's issuances" },
  ];

  // Reduced real-time data refresh (every 30 seconds for speed)
  useEffect(() => {
    loadInitialData();
    const interval = setInterval(loadInitialData, 30000); // Less frequent for speed
    return () => clearInterval(interval);
  }, [user?.role]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadInitialData = async () => {
    const now = Date.now();
    if (dataCache.lastUpdate && now - dataCache.lastUpdate < 30000) return; // Cache for 30s

    try {
      const [fetchedItems, fetchedCategories, itemsOut, fetchedRequests, fetchedAuditLogs, stats] = await Promise.all([
        getItems(),
        getCategories(),
        getItemsOut(),
        getRequests(),
        getAuditLogs(),
        getDashboardStats()
      ]);
      const lowStockItems = fetchedItems.filter(item => item.quantity <= item.low_stock_threshold);
      const loginLogs = fetchedAuditLogs.filter(log => log.action === 'login').sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      const lastLogin = loginLogs.length > 0 ? { username: loginLogs[0].username || loginLogs[0].full_name || 'Unknown', timestamp: loginLogs[0].timestamp } : null;

      setItems(fetchedItems);
      setCategories(fetchedCategories);
      setRequests(fetchedRequests);
      setAuditLogs(fetchedAuditLogs);
      setSystemStatus({
        totalItems: stats.totalItems,
        lowStockItems: stats.lowStockItems,
        categoriesCount: stats.totalCategories,
        recentActivity: stats.itemsOut,
        lastLogin,
      });
      setDataCache({ ...dataCache, lastUpdate: now, items: fetchedItems, categories: fetchedCategories, requests: fetchedRequests, auditLogs: fetchedAuditLogs, itemsOut, stats });
    } catch (error) {
      console.error("Error loading data:", error);
      toast({ title: "Error", description: "Failed to fetch system data", variant: "destructive" });
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const addMessage = (text: string, isUser: boolean, options?: { text: string; action: () => void }[], downloadBlob?: Blob, downloadFilename?: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      text,
      isUser,
      timestamp: new Date(),
      options,
      downloadBlob,
      downloadFilename,
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const handleDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const loadLogo = async (): Promise<string> => {
    try {
      const response = await fetch('/vobiss-logo.png');
      if (!response.ok) throw new Error('Logo not found');
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error loading logo:', error);
      return ''; // Return empty if failed
    }
  };

  // New function to generate daily report data
  const generateDailyReportData = async (reportDate: Date): Promise<CombinedIssuance[]> => {
    const dateStr = format(reportDate, 'yyyy-MM-dd');
    const startDateTime = new Date(`${dateStr}T00:00:00`);
    const endDateTime = new Date(`${dateStr}T23:59:59.999`);

    const [itemsOutData, requestsData, itemsData] = await Promise.all([
      getItemsOut(),
      getRequests(),
      getItems()
    ]);

    // Filter direct issuances
    const directIssuances = itemsOutData
      .map((io: ItemOut) => {
        const issuanceDate = new Date(io.date_time);
        if (issuanceDate >= startDateTime && issuanceDate <= endDateTime) {
          const itemDetail = itemsData.find((i: Item) => i.id.toString() === io.item_id.toString());
          return {
            ...io,
            source: 'direct' as const,
            requester: undefined,
            approver: undefined,
            current_stock: itemDetail?.quantity || 0,
          } as CombinedIssuance;
        }
        return null;
      })
      .filter(Boolean) as CombinedIssuance[];

    // Filter completed requests and fetch details
    const completedRequests = requestsData.filter((r: Request) => r.status === 'completed');
    const requestIssuances: CombinedIssuance[] = [];
    for (const request of completedRequests) {
      const requestDate = new Date(request.created_at);
      if (requestDate >= startDateTime && requestDate <= endDateTime && request.release_by) {
        const details = await getRequestDetails(request.id);
        if (details.items) {
          const approver = details.approvals?.[0]?.approver_name || null;
          details.items.forEach((item) => {
            if (item.quantity_received && item.quantity_received > 0) {
              const itemDetail = itemsData.find((i: Item) => i.id.toString() === item.item_id.toString());
              requestIssuances.push({
                person_name: request.release_by,
                item_id: item.item_id.toString(),
                quantity: item.quantity_received,
                date_time: request.created_at,
                item_name: item.item_name,
                category_name: itemDetail?.category_name || 'Uncategorized',
                source: 'request',
                requester: request.created_by,
                approver,
                current_stock: itemDetail?.quantity || 0,
              } as CombinedIssuance);
            }
          });
        }
      }
    }

    return [...directIssuances, ...requestIssuances].sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());
  };

  const generateDailyPDF = async (reportDate: Date, issuances: CombinedIssuance[]): Promise<PDFResult> => {
    try {
      if (issuances.length === 0) {
        return {
          blob: null,
          filename: '',
          message: `No issuances recorded for ${format(reportDate, 'MMMM do, yyyy')} – a quiet day! No report needed, but let's check another date?`
        };
      }

      const doc = new jsPDF();
      const dateStr = format(reportDate, 'MMMM do, yyyy');
      const logoBase64 = await loadLogo();
      
      let yPos = 20;
      
      // Add logo if available
      if (logoBase64) {
        doc.addImage(logoBase64, 'PNG', 20, yPos, 30, 10);
        yPos += 15;
      }

      // Title with grey background
      doc.setFillColor(158, 158, 158); // Grey-500
      doc.rect(20, yPos, 170, 12, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont(undefined, 'bold');
      doc.text(`Daily Issuances Report - ${dateStr}`, 105, yPos + 8, { align: 'center' });
      yPos += 20;
      
      // Subtitle
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.setFont(undefined, 'normal');
      doc.text(`Generated on: ${new Date().toLocaleDateString()} | Total Issuances: ${issuances.length}`, 20, yPos);
      yPos += 15;

      // Decorative line
      doc.setDrawColor(189, 195, 199); // Grey-400
      doc.setLineWidth(1);
      doc.line(20, yPos, 190, yPos);
      yPos += 10;

      // Table setup
      const tableX = 20;
      const tableWidth = 170;
      const colWidths = { time: 25, item: 35, cat: 25, qty: 15, stock: 20, source: 20, req: 25, app: 20, iss: 25 };
      const headerHeight = 8;
      const rowHeight = 6;

      // Table header
      doc.setFillColor(189, 195, 199); // Lighter grey header
      doc.rect(tableX, yPos, tableWidth, headerHeight, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont(undefined, 'bold');
      let colX = tableX;
      ['Time', 'Item', 'Category', 'Qty Taken', 'Stock Left', 'Source', 'Requester', 'Approver', 'Issuer'].forEach(header => {
        doc.text(header, colX + 2, yPos + 6, { align: 'left' });
        colX += (colWidths as any)[header.toLowerCase().replace(/\s/g, '')] || 20;
      });
      yPos += headerHeight;

      // Table border
      doc.setDrawColor(158, 158, 158);
      doc.setLineWidth(0.5);
      const tableHeight = headerHeight + (issuances.length * rowHeight) + 1;
      doc.rect(tableX, yPos - headerHeight, tableWidth, tableHeight, 'S');

      // Table rows
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(8);
      doc.setFont(undefined, 'normal');
      issuances.forEach((issuance, index) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
          // Add logo on new page if available
          if (logoBase64) {
            doc.addImage(logoBase64, 'PNG', 20, yPos, 30, 10);
            yPos += 15;
          }
          // Redraw header on new page
          doc.setFillColor(189, 195, 199);
          doc.rect(tableX, yPos, tableWidth, headerHeight, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFont(undefined, 'bold');
          colX = tableX;
          ['Time', 'Item', 'Category', 'Qty Taken', 'Stock Left', 'Source', 'Requester', 'Approver', 'Issuer'].forEach(header => {
            doc.text(header, colX + 2, yPos + 6, { align: 'left' });
            colX += (colWidths as any)[header.toLowerCase().replace(/\s/g, '')] || 20;
          });
          yPos += headerHeight;
          doc.setTextColor(0, 0, 0);
          doc.setFont(undefined, 'normal');
        }

        const time = format(new Date(issuance.date_time), 'HH:mm');
        const sourceBadge = issuance.source === 'direct' ? 'Direct' : 'Request';
        const sourceColor = issuance.source === 'direct' ? [59, 130, 246] : [16, 185, 129]; // Blue, Green
        doc.setTextColor(sourceColor[0], sourceColor[1], sourceColor[2]);
        doc.setFont(undefined, 'bold');

        colX = tableX;
        doc.text(time, colX + 2, yPos + 5, { align: 'left' });
        colX += colWidths.time;
        doc.text(issuance.item_name.substring(0, 15) + (issuance.item_name.length > 15 ? '...' : ''), colX + 2, yPos + 5, { align: 'left' });
        colX += colWidths.item;
        doc.text((issuance.category_name || 'Uncategorized').substring(0, 12) + '...', colX + 2, yPos + 5, { align: 'left' });
        colX += colWidths.cat;
        doc.text(issuance.quantity.toString(), colX + 2, yPos + 5, { align: 'left' });
        colX += colWidths.qty;
        doc.text(issuance.current_stock?.toString() || 'N/A', colX + 2, yPos + 5, { align: 'left' });
        colX += colWidths.stock;
        doc.text(sourceBadge, colX + 2, yPos + 5, { align: 'left' });
        colX += colWidths.source;
        doc.text((issuance.requester || 'N/A').substring(0, 10) + '...', colX + 2, yPos + 5, { align: 'left' });
        colX += colWidths.req;
        doc.text((issuance.approver || 'N/A').substring(0, 8) + '...', colX + 2, yPos + 5, { align: 'left' });
        colX += colWidths.app;
        doc.text(issuance.person_name.substring(0, 10) + '...', colX + 2, yPos + 5, { align: 'left' });

        doc.setTextColor(0, 0, 0);
        doc.setFont(undefined, 'normal');
        yPos += rowHeight;
      });

      // Footer note with heart
      doc.setTextColor(149, 165, 166); // Grey-600
      doc.setFontSize(8);
      doc.text('Generated with love by Vobiss Inventory AI Assistant ❤️', 20, yPos + 10);

      const pdfBlob = doc.output('blob');
      const filename = `daily-report-${format(reportDate, 'yyyy-MM-dd')}.pdf`;

      return {
        blob: pdfBlob,
        filename,
        message: `Daily report for ${dateStr} ready! 📅 It details ${issuances.length} issuances with full breakdowns (taken, stock left, who/when). Click below to download. Fancy Excel version or another day?`
      };
    } catch (error) {
      console.error("Error generating daily PDF:", error);
      toast({ title: "Error", description: "Failed to generate daily report.", variant: "destructive" });
      return {
        blob: null,
        filename: '',
        message: "Daily report hit a snag – data's solid, but PDF glitch. Retry or chat for details?"
      };
    }
  };

  const generateDailyExcel = async (reportDate: Date, issuances: CombinedIssuance[]): Promise<PDFResult> => {
    try {
      if (issuances.length === 0) {
        return {
          blob: null,
          filename: '',
          message: `No issuances for ${format(reportDate, 'MMMM do, yyyy')} – quiet day vibes! Let's pick another.`
        };
      }

      const wsData = [
        ['Time', 'Item', 'Category', 'Qty Taken', 'Stock Left', 'Source', 'Requester', 'Approver', 'Issuer'],
        ...issuances.map(iss => [
          format(new Date(iss.date_time), 'HH:mm'),
          iss.item_name,
          iss.category_name || 'Uncategorized',
          iss.quantity,
          iss.current_stock || 'N/A',
          iss.source,
          iss.requester || 'N/A',
          iss.approver || 'N/A',
          iss.person_name
        ])
      ];

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Daily Issuances');
      const excelBlob = new Blob([new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }))], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const filename = `daily-report-${format(reportDate, 'yyyy-MM-dd')}.xlsx`;

      return {
        blob: excelBlob,
        filename,
        message: `Daily Excel for ${format(reportDate, 'MMMM do, yyyy')} exported! 📊 ${issuances.length} rows of issuances data, ready for crunching. Download below. PDF alt or date swap?`
      };
    } catch (error) {
      console.error("Error generating daily Excel:", error);
      toast({ title: "Error", description: "Failed to generate Excel.", variant: "destructive" });
      return {
        blob: null,
        filename: '',
        message: "Excel export fumbled – try PDF or chat it out?"
      };
    }
  };

  const handleGenerateDailyReport = async (formatType: 'pdf' | 'excel' = 'pdf') => {
    setLoading(true);
    try {
      const reportDate = selectedReportDate;
      const issuances = await generateDailyReportData(reportDate);
      const result = formatType === 'pdf' 
        ? await generateDailyPDF(reportDate, issuances)
        : await generateDailyExcel(reportDate, issuances);
      addMessage(result.message, false, undefined, result.blob, result.filename);
    } catch (error) {
      console.error("Error in daily report:", error);
      addMessage("Daily report ran into turbulence – fresh data pull needed? Let's troubleshoot.", false);
    } finally {
      setLoading(false);
    }
  };

  const handleSendAlert = async () => {
    try {
      setLoading(true);
      const lowStockItems = await getLowStockItems();
      if (lowStockItems.length === 0) {
        addMessage("No low stock items to alert on – the team's off the hook today! What next?", false);
        setLoading(false);
        return;
      }

      const supervisors = await getSupervisors();
      const response = await sendLowStockAlert({ lowStockItems, supervisors });

      addMessage(`Alert fired off! 📧 I let the supervisors know about those ${lowStockItems.length} items. They'll jump on restocking. Response: "${response.message}". High five? What's up next?`, false, [{
        text: "Generate Daily Report",
        action: () => handleGenerateDailyReport()
      }]);
    } catch (error) {
      console.error("Error sending alert:", error);
      toast({ title: "Oops", description: "Alert send failed. Check settings?", variant: "destructive" });
      addMessage("Hit a bump sending the alert – maybe check the email setup? Want me to try again?", false);
    } finally {
      setLoading(false);
    }
  };

  const generateLowStockPDF = async (): Promise<PDFResult> => {
    try {
      const lowStockItems = await getLowStockItems();
      if (lowStockItems.length === 0) {
        return {
          blob: null,
          filename: '',
          message: "No low stock items right now – everything's looking good! No report needed."
        };
      }

      const doc = new jsPDF();
      const date = new Date().toLocaleDateString();
      const logoBase64 = await loadLogo();
      
      let yPos = 20;
      
      // Add logo if available
      if (logoBase64) {
        doc.addImage(logoBase64, 'PNG', 20, yPos, 30, 10);
        yPos += 15;
      }

      // Title with grey background
      doc.setFillColor(158, 158, 158); // Grey-500
      doc.rect(20, yPos, 170, 12, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont(undefined, 'bold');
      doc.text('Low Stock Report - Vobiss Inventory', 105, yPos + 8, { align: 'center' });
      yPos += 20;
      
      // Subtitle
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.setFont(undefined, 'normal');
      doc.text(`Generated on: ${date}`, 20, yPos);
      yPos += 5;
      doc.text(`Total Low Stock Items: ${lowStockItems.length}`, 20, yPos);
      yPos += 15;

      // Decorative line
      doc.setDrawColor(189, 195, 199); // Grey-400
      doc.setLineWidth(1);
      doc.line(20, yPos, 190, yPos);
      yPos += 10;

      // Table setup
      const tableX = 20;
      const tableWidth = 170;
      const colWidths = { item: 80, qty: 25, thresh: 25, status: 40 };
      const headerHeight = 8;
      const rowHeight = 7;

      // Table header
      doc.setFillColor(189, 195, 199); // Lighter grey header
      doc.rect(tableX, yPos, tableWidth, headerHeight, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.text('Item', tableX + 5, yPos + 6, { align: 'left' });
      doc.text('Quantity', tableX + colWidths.item + 5, yPos + 6, { align: 'left' });
      doc.text('Threshold', tableX + colWidths.item + colWidths.qty + 5, yPos + 6, { align: 'left' });
      doc.text('Status', tableX + colWidths.item + colWidths.qty + colWidths.thresh + 5, yPos + 6, { align: 'left' });
      yPos += headerHeight;

      // Table border
      doc.setDrawColor(158, 158, 158);
      doc.setLineWidth(0.5);
      doc.rect(tableX, yPos - headerHeight, tableWidth, headerHeight + (lowStockItems.length * rowHeight) + 1, 'S');

      // Table rows
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      lowStockItems.forEach((item: any, index: number) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
          // Add logo on new page if available
          if (logoBase64) {
            doc.addImage(logoBase64, 'PNG', 20, yPos, 30, 10);
            yPos += 15;
          }
          // Redraw header on new page
          doc.setFillColor(189, 195, 199);
          doc.rect(tableX, yPos, tableWidth, headerHeight, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFont(undefined, 'bold');
          doc.text('Item', tableX + 5, yPos + 6, { align: 'left' });
          doc.text('Quantity', tableX + colWidths.item + 5, yPos + 6, { align: 'left' });
          doc.text('Threshold', tableX + colWidths.item + colWidths.qty + 5, yPos + 6, { align: 'left' });
          doc.text('Status', tableX + colWidths.item + colWidths.qty + colWidths.thresh + 5, yPos + 6, { align: 'left' });
          yPos += headerHeight;
          doc.setTextColor(0, 0, 0);
          doc.setFont(undefined, 'normal');
        }

        const status = item.quantity === 0 ? 'OUT OF STOCK ❤️' : item.quantity < 3 ? 'CRITICAL' : 'LOW';
        const statusColor = item.quantity === 0 ? [220, 53, 69] : item.quantity < 3 ? [255, 193, 7] : [40, 167, 69]; // Red, Yellow, Green
        doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
        doc.setFont(undefined, 'bold');

        doc.text(item.name.substring(0, 20) + (item.name.length > 20 ? '...' : ''), tableX + 5, yPos + 5, { align: 'left' });
        doc.text(item.quantity.toString(), tableX + colWidths.item + 5, yPos + 5, { align: 'left' });
        doc.text(item.low_stock_threshold.toString(), tableX + colWidths.item + colWidths.qty + 5, yPos + 5, { align: 'left' });
        doc.text(status, tableX + colWidths.item + colWidths.qty + colWidths.thresh + 5, yPos + 5, { align: 'left' });

        doc.setTextColor(0, 0, 0);
        doc.setFont(undefined, 'normal');
        yPos += rowHeight;
      });

      // Footer note with heart
      doc.setTextColor(149, 165, 166); // Grey-600
      doc.setFontSize(8);
      doc.text('Generated with love by Vobiss Inventory AI Assistant ❤️', 20, yPos + 10);

      const pdfBlob = doc.output('blob');
      const filename = `low-stock-report-${date}.pdf`;

      return {
        blob: pdfBlob,
        filename,
        message: `PDF report generated! It includes all ${lowStockItems.length} low stock items with details. Click below to download.`
      };
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({ title: "Error", description: "Failed to generate report.", variant: "destructive" });
      return {
        blob: null,
        filename: '',
        message: "Sorry, couldn't create the PDF right now. Let's try again or check the low stock manually?"
      };
    }
  };

  const generateFullSystemPDF = async (): Promise<PDFResult> => {
    try {
      setLoading(true);
      const [stats, auditLogsFull, itemsFull, itemsOutFull, lowStockItems] = await Promise.all([
        getDashboardStats(),
        getAuditLogs(),
        getItems(),
        getItemsOut(),
        getLowStockItems()
      ]);

      const loginLogs = auditLogsFull.filter(log => log.action === 'login').slice(0, 10);
      const recentIssues = itemsOutFull.slice(0, 20);
      const date = new Date().toLocaleDateString();
      const logoBase64 = await loadLogo();

      const doc = new jsPDF();
      let yPos = 20;

      // Add logo
      if (logoBase64) {
        doc.addImage(logoBase64, 'PNG', 20, yPos, 30, 10);
        yPos += 15;
      }

      // Title with grey background
      doc.setFillColor(158, 158, 158); // Grey-500
      doc.rect(20, yPos, 170, 12, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont(undefined, 'bold');
      doc.text('Vobiss Inventory System - Full Health Report', 105, yPos + 8, { align: 'center' });
      yPos += 15;
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.text(`Generated: ${date} | User: ${user?.full_name || 'Admin'}`, 105, yPos, { align: 'center' });
      yPos += 20;
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'normal');

      // Decorative line
      doc.setDrawColor(189, 195, 199);
      doc.setLineWidth(1);
      doc.line(20, yPos, 190, yPos);
      yPos += 10;

      // Section 1: System Health Overview - Use a simple table
      doc.setFillColor(189, 195, 199); // Lighter grey header
      doc.setTextColor(255, 255, 255);
      doc.setFont(undefined, 'bold');
      doc.text('1. System Health Overview', 20, yPos);
      yPos += 10;
      doc.setFillColor(248, 249, 250); // Very light grey for rows
      doc.rect(20, yPos, 170, 25, 'F');
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text(`Total Items: ${stats.totalItems}`, 25, yPos + 7);
      doc.text(`Categories: ${stats.totalCategories}`, 25, yPos + 14);
      doc.text(`Items Issued: ${stats.itemsOut}`, 90, yPos + 7);
      doc.text(`Pending Requests: ${stats.pendingRequests}`, 90, yPos + 14);
      doc.text(`Low Stock Alerts: ${stats.lowStockItems}`, 155, yPos + 7);
      const healthStatus = stats.lowStockItems === 0 ? 'Healthy ❤️' : 'Needs Attention';
      const healthColor = stats.lowStockItems === 0 ? [40, 167, 69] : [220, 53, 69];
      doc.setTextColor(healthColor[0], healthColor[1], healthColor[2]);
      doc.setFont(undefined, 'bold');
      doc.text(`System Status: ${healthStatus}`, 155, yPos + 14);
      yPos += 35;
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'normal');

      // Section 2: Recent Logins - Table
      doc.setFillColor(189, 195, 199);
      doc.setTextColor(255, 255, 255);
      doc.setFont(undefined, 'bold');
      doc.setFontSize(12);
      doc.text('2. Recent Logins (Last 10)', 20, yPos);
      yPos += 10;
      doc.setFontSize(10);
      if (loginLogs.length > 0) {
        const tableX = 20;
        const tableWidth = 170;
        const colWidths = { num: 10, user: 60, time: 50, ip: 50 };
        const headerHeight = 8;
        const rowHeight = 6;
        let tableY = yPos;

        // Header
        doc.setFillColor(158, 158, 158);
        doc.rect(tableX, tableY, tableWidth, headerHeight, 'F');
        doc.setTextColor(255, 255, 255);
        doc.text('#', tableX + 5, tableY + 6);
        doc.text('User', tableX + colWidths.num + 5, tableY + 6);
        doc.text('Time', tableX + colWidths.num + colWidths.user + 5, tableY + 6);
        doc.text('IP', tableX + colWidths.num + colWidths.user + colWidths.time + 5, tableY + 6);
        tableY += headerHeight;
        doc.setTextColor(0, 0, 0);
        doc.setFont(undefined, 'normal');

        // Border
        doc.setDrawColor(158, 158, 158);
        doc.rect(tableX, yPos, tableWidth, headerHeight + (Math.min(loginLogs.length, 10) * rowHeight) + 1, 'S');

        // Rows
        loginLogs.slice(0, 10).forEach((log, index) => {
          if (tableY > 270) {
            doc.addPage();
            tableY = 20;
            // Add logo on new page
            if (logoBase64) {
              doc.addImage(logoBase64, 'PNG', 20, tableY, 30, 10);
              tableY += 15;
            }
            // Redraw header
            doc.setFillColor(158, 158, 158);
            doc.rect(tableX, tableY, tableWidth, headerHeight, 'F');
            doc.setTextColor(255, 255, 255);
            doc.text('#', tableX + 5, tableY + 6);
            doc.text('User', tableX + colWidths.num + 5, tableY + 6);
            doc.text('Time', tableX + colWidths.num + colWidths.user + 5, tableY + 6);
            doc.text('IP', tableX + colWidths.num + colWidths.user + colWidths.time + 5, tableY + 6);
            tableY += headerHeight;
            doc.setTextColor(0, 0, 0);
          }
          doc.text((index + 1).toString(), tableX + 5, tableY + 5);
          doc.text((log.full_name || log.username || 'Unknown').substring(0, 15) + '...', tableX + colWidths.num + 5, tableY + 5);
          doc.text(new Date(log.timestamp).toLocaleString().substring(0, 20) + '...', tableX + colWidths.num + colWidths.user + 5, tableY + 5);
          doc.text(log.ip_address.substring(0, 15) + '...', tableX + colWidths.num + colWidths.user + colWidths.time + 5, tableY + 5);
          tableY += rowHeight;
        });
        yPos = tableY + 10;
      } else {
        doc.text('No recent logins recorded. All quiet! ❤️', 20, yPos);
        yPos += 10;
      }

      // Section 3: Current Inventory Summary - Simple list with colors
      doc.setFillColor(189, 195, 199);
      doc.setTextColor(255, 255, 255);
      doc.setFont(undefined, 'bold');
      doc.text('3. Current Inventory Summary', 20, yPos);
      yPos += 10;
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'normal');
      const categoryTotals = itemsFull.reduce((acc, item) => {
        const catName = item.category_name || 'Uncategorized';
        acc[catName] = (acc[catName] || 0) + item.quantity;
        return acc;
      }, {} as { [key: string]: number });
      Object.entries(categoryTotals).forEach(([cat, total]) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
          if (logoBase64) {
            doc.addImage(logoBase64, 'PNG', 20, yPos, 30, 10);
            yPos += 15;
          }
        }
        const catColor = total < 10 ? [220, 53, 69] : [40, 167, 69]; // Red if low total, green otherwise
        doc.setTextColor(catColor[0], catColor[1], catColor[2]);
        doc.setFont(undefined, total < 10 ? 'bold' : 'normal');
        doc.text(`${cat}: ${total} units total ❤️`, 20, yPos);
        doc.setTextColor(0, 0, 0);
        doc.setFont(undefined, 'normal');
        yPos += 7;
      });
      yPos += 10;

      // Section 4: Recent Issued Items - Table
      doc.setFillColor(189, 195, 199);
      doc.setTextColor(255, 255, 255);
      doc.setFont(undefined, 'bold');
      doc.setFontSize(12);
      doc.text('4. Recent Issued Items (Last 20)', 20, yPos);
      yPos += 10;
      doc.setFontSize(10);
      if (recentIssues.length > 0) {
        const tableX = 20;
        const tableWidth = 170;
        const colWidths = { num: 10, user: 50, qtyItem: 60, time: 50 };
        const headerHeight = 8;
        const rowHeight = 6;
        let tableY = yPos;

        // Header
        doc.setFillColor(158, 158, 158);
        doc.rect(tableX, tableY, tableWidth, headerHeight, 'F');
        doc.setTextColor(255, 255, 255);
        doc.text('#', tableX + 5, tableY + 6);
        doc.text('User', tableX + colWidths.num + 5, tableY + 6);
        doc.text('Qty x Item', tableX + colWidths.num + colWidths.user + 5, tableY + 6);
        doc.text('Time', tableX + colWidths.num + colWidths.user + colWidths.qtyItem + 5, tableY + 6);
        tableY += headerHeight;
        doc.setTextColor(0, 0, 0);
        doc.setFont(undefined, 'normal');

        // Border
        doc.setDrawColor(158, 158, 158);
        doc.rect(tableX, yPos, tableWidth, headerHeight + (Math.min(recentIssues.length, 20) * rowHeight) + 1, 'S');

        // Rows
        recentIssues.slice(0, 20).forEach((issue, index) => {
          if (tableY > 270) {
            doc.addPage();
            tableY = 20;
            if (logoBase64) {
              doc.addImage(logoBase64, 'PNG', 20, tableY, 30, 10);
              tableY += 15;
            }
            // Redraw header
            doc.setFillColor(158, 158, 158);
            doc.rect(tableX, tableY, tableWidth, headerHeight, 'F');
            doc.setTextColor(255, 255, 255);
            doc.text('#', tableX + 5, tableY + 6);
            doc.text('User', tableX + colWidths.num + 5, tableY + 6);
            doc.text('Qty x Item', tableX + colWidths.num + colWidths.user + 5, tableY + 6);
            doc.text('Time', tableX + colWidths.num + colWidths.user + colWidths.qtyItem + 5, tableY + 6);
            tableY += headerHeight;
            doc.setTextColor(0, 0, 0);
          }
          doc.text((index + 1).toString(), tableX + 5, tableY + 5);
          doc.text(issue.person_name.substring(0, 15) + '...', tableX + colWidths.num + 5, tableY + 5);
          doc.text(`${issue.quantity} x ${issue.item_name.substring(0, 20)}...`, tableX + colWidths.num + colWidths.user + 5, tableY + 5);
          doc.text(new Date(issue.date_time).toLocaleString().substring(0, 20) + '...', tableX + colWidths.num + colWidths.user + colWidths.qtyItem + 5, tableY + 5);
          tableY += rowHeight;
        });
        yPos = tableY + 10;
      } else {
        doc.text('No issued items recorded. Peaceful day! ❤️', 20, yPos);
        yPos += 10;
      }

      // Section 5: Low Stock Items - Reuse low stock table logic
      doc.setFillColor(189, 195, 199);
      doc.setTextColor(255, 255, 255);
      doc.setFont(undefined, 'bold');
      doc.setFontSize(12);
      doc.text('5. Low Stock Items', 20, yPos);
      yPos += 10;
      doc.setFontSize(10);
      if (lowStockItems.length > 0) {
        const tableX = 20;
        const tableWidth = 170;
        const colWidths = { num: 10, item: 70, qtyThresh: 40, cat: 50 };
        const headerHeight = 8;
        const rowHeight = 6;
        let tableY = yPos;

        // Header
        doc.setFillColor(158, 158, 158);
        doc.rect(tableX, tableY, tableWidth, headerHeight, 'F');
        doc.setTextColor(255, 255, 255);
        doc.text('#', tableX + 5, tableY + 6);
        doc.text('Item', tableX + colWidths.num + 5, tableY + 6);
        doc.text('Qty/Threshold', tableX + colWidths.num + colWidths.item + 5, tableY + 6);
        doc.text('Category', tableX + colWidths.num + colWidths.item + colWidths.qtyThresh + 5, tableY + 6);
        tableY += headerHeight;
        doc.setTextColor(0, 0, 0);
        doc.setFont(undefined, 'normal');

        // Border
        doc.setDrawColor(158, 158, 158);
        doc.rect(tableX, yPos, tableWidth, headerHeight + (lowStockItems.length * rowHeight) + 1, 'S');

        // Rows
        lowStockItems.forEach((item, index) => {
          if (tableY > 270) {
            doc.addPage();
            tableY = 20;
            if (logoBase64) {
              doc.addImage(logoBase64, 'PNG', 20, tableY, 30, 10);
              tableY += 15;
            }
            // Redraw header
            doc.setFillColor(158, 158, 158);
            doc.rect(tableX, tableY, tableWidth, headerHeight, 'F');
            doc.setTextColor(255, 255, 255);
            doc.text('#', tableX + 5, tableY + 6);
            doc.text('Item', tableX + colWidths.num + 5, tableY + 6);
            doc.text('Qty/Threshold', tableX + colWidths.num + colWidths.item + 5, tableY + 6);
            doc.text('Category', tableX + colWidths.num + colWidths.item + colWidths.qtyThresh + 5, tableY + 6);
            tableY += headerHeight;
            doc.setTextColor(0, 0, 0);
          }
          doc.text((index + 1).toString(), tableX + 5, tableY + 5);
          doc.text(item.name.substring(0, 20) + '...', tableX + colWidths.num + 5, tableY + 5);
          doc.text(`${item.quantity}/${item.low_stock_threshold}`, tableX + colWidths.num + colWidths.item + 5, tableY + 5);
          const catColor = item.quantity === 0 ? [220, 53, 69] : [255, 193, 7];
          doc.setTextColor(catColor[0], catColor[1], catColor[2]);
          doc.text((item.category_name || 'N/A').substring(0, 15) + '...', tableX + colWidths.num + colWidths.item + colWidths.qtyThresh + 5, tableY + 5);
          doc.setTextColor(0, 0, 0);
          tableY += rowHeight;
        });
        yPos = tableY + 10;
      } else {
        doc.setTextColor(40, 167, 69);
        doc.text('No low stock items – system is balanced! ❤️', 20, yPos);
        yPos += 10;
      }

      // Footer
      doc.setTextColor(149, 165, 166);
      doc.setFontSize(8);
      doc.text('Generated with love by Vobiss Inventory AI Assistant ❤️', 20, yPos);

      const pdfBlob = doc.output('blob');
      const filename = `full-system-report-${date}.pdf`;

      return {
        blob: pdfBlob,
        filename,
        message: `Full system report compiled! 📊 It covers health stats, recent logins (${loginLogs.length}), inventory breakdown, issued items (${recentIssues.length}), and low stock alerts (${lowStockItems.length}). Your all-in-one health check. Click below to download. What stands out, or need a deeper dive?`
      };
    } catch (error) {
      console.error("Error generating full PDF:", error);
      toast({ title: "Error", description: "Failed to generate full report.", variant: "destructive" });
      return {
        blob: null,
        filename: '',
        message: "Bump in the road on that full report – data's there, but PDF hiccup. Retry or snag sections individually?"
      };
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMessage = input.trim();
    addMessage(userMessage, true);
    setInput('');
    setLoading(true);
    inputRef.current?.focus();

    try {
      await processQuery(userMessage);
    } catch (error) {
      console.error("Error:", error);
      toast({ title: "Error", description: "Something went wrong. Try again?", variant: "destructive" });
      addMessage("Whoops – that didn't go as planned. Rephrase it, and I'll give it another shot!", false);
    } finally {
      setLoading(false);
    }
  };

  const processQuery = async (query: string) => {
    const lowerQuery = query.toLowerCase().trim();
    const stringSimilarity = (window as any).stringSimilarity;

    // Fetch fresh data only if cache is stale (for speed)
    if (!dataCache.lastUpdate || Date.now() - dataCache.lastUpdate > 10000) {
      await loadInitialData();
    }
    const { items: fetchedItems, itemsOut, categories: fetchedCategories, requests: fetchedRequests, auditLogs: fetchedAuditLogs, stats } = dataCache;

    // Handle conversational flow for adding items
    if (conversationState.mode === 'addingItem' && conversationState.waitingFor) {
      await handleAddItemResponse(query);
      return;
    }

    // New intent for daily report
    const dailyReportMatch = lowerQuery.match(/generate.*daily.*report(?:\s+for\s+(.+))?/i);
    if (dailyReportMatch) {
      const dateStr = dailyReportMatch[1];
      let reportDate = new Date();
      if (dateStr) {
        const parsedDate = new Date(dateStr);
        if (!isNaN(parsedDate.getTime())) {
          reportDate = parsedDate;
        }
      }
      setSelectedReportDate(reportDate);
      await handleGenerateDailyReport('pdf'); // Default to PDF
      return;
    }

    if (lowerQuery === 'help') {
      setShowHelpPanel(true);
      addMessage("Hey! I'm here to make inventory management a breeze. Here's a quick guide to get you chatting:", false);
      return;
    }

    if (lowerQuery.includes('thank') || lowerQuery.includes('thanks')) {
      addMessage("My pleasure! Always happy to dive into the details with you. What's on deck?", false);
      return;
    }

    if (lowerQuery.includes('hello') || lowerQuery.includes('hi') || messages.length === 0) {
      addMessage(`Hey ${user?.first_name || 'there'}! Ready to tackle inventory? Just ask away – I'm all ears (or algorithms). What's first?`, false);
      return;
    }

    // Advanced intent detection with regex
    const intents = {
      generateFullReport: { patterns: [/full.*report|system.*report|complete.*overview|system.*health|full.*health/i], weight: 1.0 },
      generateReport: { patterns: [/generate.*report|pdf.*report|low.*stock.*report|export.*low/i], weight: 1.0 },
      sendAlert: { patterns: [/send.*alert|notify.*supervisors|email.*low.*stock|alert.*team/i], weight: 1.0 },
      stockCheck: { patterns: [/low.*stock|stock.*level|restock|out.*stock|quantity|available/i], weight: 1.0 },
      search: { patterns: [/find|search|show|look|where|have/i], weight: 0.9 },
      category: { patterns: [/category|in.*category|categories|section/i], weight: 0.8 },
      userActivity: { patterns: [/user|person|who.*checked|borrowed|activity/i], weight: 0.7 },
      lastLogin: { patterns: [/last.*login|signed.*in|recent.*login/i], weight: 0.8 },
      requests: { patterns: [/request|show.*requests|all.*requests/i], weight: 0.9 },
      summary: { patterns: [/summary|overview|report|status|how.*many|total/i], weight: 0.6 },
      recommendation: { patterns: [/recommend|suggest|buy|restock/i], weight: 0.5 },
      recentActivity: { patterns: [/recent|latest|last|new.*activity/i], weight: 0.4 },
      addItem: { patterns: [/add|create|new.*item/i], weight: 0.3 },
    };

    let detectedIntent = null;
    let maxScore = 0;
    let entity = '';

    for (const [intent, { patterns, weight }] of Object.entries(intents)) {
      let score = 0;
      patterns.forEach(pattern => {
        if (pattern.test(lowerQuery)) score += 1 * weight;
      });
      const words = lowerQuery.split(' ');
      words.forEach(word => {
        const keywords = intent.split(/(?=[A-Z])/).map(k => k.toLowerCase());
        const bestMatch = stringSimilarity.findBestMatch(word, keywords).bestMatch;
        if (bestMatch.rating > 0.6) score += bestMatch.rating * weight * 0.5;
      });
      if (score > maxScore) {
        maxScore = score;
        detectedIntent = intent;
        const entityMatch = lowerQuery.match(/(?:find|search|add|in|for|about)\s+(.+)/i);
        if (entityMatch) {
          entity = entityMatch[1].trim();
          const itemMatches = fetchedItems.map(item => ({ name: item.name, score: stringSimilarity.compareTwoStrings(entity.toLowerCase(), item.name.toLowerCase()) }));
          const catMatches = fetchedCategories.map(cat => ({ name: cat.name, score: stringSimilarity.compareTwoStrings(entity.toLowerCase(), cat.name.toLowerCase()) }));
          const bestItem = itemMatches.reduce((max, curr) => (curr.score > max.score ? curr : max), { name: '', score: 0 });
          const bestCat = catMatches.reduce((max, curr) => (curr.score > max.score ? curr : max), { name: '', score: 0 });
          entity = bestItem.score > 0.7 ? bestItem.name : (bestCat.score > 0.7 ? bestCat.name : entity);
        }
      }
    }

    if (!detectedIntent || maxScore < 0.3) {
      addMessage("Hmm, not quite sure on that one – but I'm learning! Try 'show low stock' or 'help' for ideas. What's your query?", false);
      return;
    }

    // Handle advanced add item (e.g., "add 5 printers to electronics")
    if (detectedIntent === 'addItem') {
      const addMatch = lowerQuery.match(/add\s+(\d+)\s+(.+?)\s+(?:to|in)\s+(.+)/i);
      if (addMatch) {
        const [, qty, name, cat] = addMatch;
        const category = fetchedCategories.find(c => stringSimilarity.compareTwoStrings(cat.toLowerCase(), c.name.toLowerCase()) > 0.7);
        if (category) {
          await addItem({ name, category_id: category.id, quantity: parseInt(qty), low_stock_threshold: 5 });
          addMessage(`Nailed it! Added ${qty} ${name} to ${category.name}. Stock updated live. Boom!`, false);
          loadInitialData();
          return;
        }
      }
      setConversationState({ mode: 'addingItem', addItemData: { itemName: entity || '', categoryId: null, quantity: null }, waitingFor: entity ? 'category' : 'itemName' });
      if (!entity) {
        addMessage("Let's add that item! What's its name?", false);
      } else {
        addMessage(`Cool, adding "${entity}". Pick a category (or 'new' for fresh one):`, false, fetchedCategories.map(cat => ({
          text: cat.name,
          action: () => handleCategorySelection(cat.id)
        })).concat([{ text: "New Category", action: () => handleCategorySelection('new') }]));
      }
      return;
    }

    switch (detectedIntent) {
      case 'generateFullReport': {
        const result = await generateFullSystemPDF();
        addMessage(result.message, false, undefined, result.blob, result.filename);
        break;
      }
      case 'generateReport': {
        const result = await generateLowStockPDF();
        addMessage(result.message, false, undefined, result.blob, result.filename);
        break;
      }
      case 'sendAlert': await handleSendAlert(); break;
      case 'stockCheck': handleStockCheck(fetchedItems, entity); break;
      case 'search': handleSearch(fetchedItems, entity); break;
      case 'category': handleCategory(fetchedItems, fetchedCategories, entity); break;
      case 'userActivity': handleUserActivity(itemsOut, entity); break;
      case 'lastLogin': handleLastLogin(fetchedAuditLogs, entity); break;
      case 'requests': handleRequests(fetchedRequests, entity); break;
      case 'summary': handleSummary(fetchedItems, itemsOut, fetchedCategories, entity); break;
      case 'recommendation': handleRecommendations(fetchedItems, entity); break;
      case 'recentActivity': handleRecentActivity(itemsOut, entity); break;
    }
  };

  const handleAddItemResponse = async (response: string) => {
    const { waitingFor, addItemData } = conversationState;
    const stringSimilarity = (window as any).stringSimilarity;
    if (waitingFor === 'itemName') {
      setConversationState(prev => ({ ...prev, addItemData: { ...prev.addItemData, itemName: response }, waitingFor: 'category' }));
      addMessage(`Got it – "${response}". Now, category time:`, false, categories.map(cat => ({
        text: cat.name,
        action: () => handleCategorySelection(cat.id)
      })).concat([{ text: "New Category", action: () => handleCategorySelection('new') }]));
    } else if (waitingFor === 'category') {
      const cat = categories.find(c => stringSimilarity.compareTwoStrings(response.toLowerCase(), c.name.toLowerCase()) > 0.7);
      if (cat) {
        handleCategorySelection(cat.id);
      } else if (response.toLowerCase().includes('new')) {
        handleCategorySelection('new');
      } else {
        addMessage("Category not found – double-check or pick from the buttons? Let's keep rolling!", false);
      }
    } else if (waitingFor === 'newCategoryName') {
      const newCatId = `new-${Date.now()}`; // Placeholder; replace with actual API call
      setConversationState(prev => ({ ...prev, addItemData: { ...prev.addItemData, categoryId: newCatId, newCategoryName: response }, waitingFor: 'quantity' }));
      addMessage(`Category "${response}" set. How many ${addItemData?.itemName} units are we adding?`, false);
    } else if (waitingFor === 'quantity') {
      const quantity = parseInt(response);
      if (isNaN(quantity) || quantity <= 0) {
        addMessage("Quantity needs to be a positive number. Shoot me a valid one?", false);
        return;
      }
      const finalCatId = addItemData?.categoryId === 'new' ? addItemData.newCategoryName : addItemData?.categoryId;
      await addItem({ name: addItemData?.itemName || '', category_id: finalCatId || null, quantity, low_stock_threshold: 5 });
      addMessage(`Done deal! ${quantity} x ${addItemData?.itemName} added to ${addItemData?.newCategoryName || categories.find(c => c.id === addItemData?.categoryId)?.name || 'inventory'}. Fresh stock alert! What's next on the list?`, false);
      setConversationState({ mode: 'normal' });
      loadInitialData();
    }
  };

  const handleCategorySelection = (catId: string) => {
    if (catId === 'new') {
      setConversationState(prev => ({ ...prev, addItemData: { ...prev.addItemData, categoryId: 'new' }, waitingFor: 'newCategoryName' }));
      addMessage("New category – what's its name?", false);
    } else {
      setConversationState(prev => ({ ...prev, addItemData: { ...prev.addItemData, categoryId: catId }, waitingFor: 'quantity' }));
      addMessage(`Selected ${categories.find(c => c.id === catId)?.name}. Quantity?`, false);
    }
  };

  const handleStockCheck = (items: Item[], entity: string) => {
    const stringSimilarity = (window as any).stringSimilarity;
    let filteredItems = entity ? items.filter(item => stringSimilarity.compareTwoStrings(entity.toLowerCase(), item.name.toLowerCase()) > 0.6) : items;
    const lowStock = filteredItems.filter(item => item.quantity <= item.low_stock_threshold);
    if (lowStock.length > 0) {
      addMessage(`Quick stock scan${entity ? ` on "${entity}"` : ''} complete. Heads up – these are low:`, false);
      const lowStockList = lowStock.map(item => `• ${item.name}: ${item.quantity}/${item.low_stock_threshold} ${item.quantity === 0 ? '🚨 OUT!' : item.quantity < 3 ? '⚠️ Critical' : '🟡 Low'}`).join('\n');
      addMessage(lowStockList, false, [{
        text: "Send Alert",
        action: handleSendAlert
      }, {
        text: "PDF Report",
        action: async () => {
          const result = await generateLowStockPDF();
          addMessage(result.message, false, undefined, result.blob, result.filename);
        }
      }, {
        text: "Full System Report",
        action: async () => {
          const result = await generateFullSystemPDF();
          addMessage(result.message, false, undefined, result.blob, result.filename);
        }
      }]);
      addMessage("Options above to alert the team, snag a PDF, or go full system scan. Your call – what sparks joy (or fixes stock)?", false);
    } else {
      addMessage(`All clear${entity ? ` for "${entity}"` : ''}! Stock's healthy. Green light on everything. Next adventure?`, false);
    }
  };

  const handleLastLogin = (auditLogs: AuditLog[], entity: string) => {
    const loginLogs = auditLogs.filter(log => log.action === 'login').sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    let filteredLogs = entity ? loginLogs.filter(log => (log.username || log.full_name || '').toLowerCase().includes(entity.toLowerCase())) : loginLogs;
    if (filteredLogs.length > 0) {
      addMessage(`Login radar on${entity ? ` for "${entity}"` : ''}:`, false);
      addMessage(filteredLogs.slice(0, 5).map(log => `• ${log.username || log.full_name || 'Unknown'} – ${new Date(log.timestamp).toLocaleString()}`).join('\n'), false);
      addMessage("Team's logging in steadily. Security check passed! Dig deeper?", false);
    } else {
      addMessage("No recent logins match that. Ghost mode activated? 😏 Let's pivot.", false);
    }
  };

  const handleRequests = (requests: Request[], entity: string) => {
    if (user?.role !== 'superadmin') {
      addMessage("Super Admin eyes only for requests. Share deets if you need a hand crafting one!", false);
      return;
    }
    let filteredRequests = entity ? requests.filter(req => req.project_name.toLowerCase().includes(entity.toLowerCase()) || req.status.toLowerCase().includes(entity.toLowerCase())) : requests;
    if (filteredRequests.length > 0) {
      addMessage(`Request roundup${entity ? ` for "${entity}"` : ''}:`, false);
      addMessage(filteredRequests.map(req => `• #${req.id} | ${req.status.toUpperCase()} | ${req.project_name} (${req.created_by}, ${new Date(req.created_at).toLocaleDateString()})`).join('\n'), false);
      addMessage("All queued up. Approve, reject, or create? Your command.", false);
    } else {
      addMessage("Requests drawer empty for that query. Time to start a new one?", false);
    }
  };

  const handleSearch = (items: Item[], entity: string) => {
    const stringSimilarity = (window as any).stringSimilarity;
    const matchingItems = entity ? items.filter(item => stringSimilarity.compareTwoStrings(entity.toLowerCase(), item.name.toLowerCase()) > 0.6 || stringSimilarity.compareTwoStrings(entity.toLowerCase(), (item.description || '').toLowerCase()) > 0.6) : items.slice(0, 10);
    if (matchingItems.length > 0) {
      addMessage(`Search results for "${entity}":`, false);
      addMessage(matchingItems.map(item => `• ${item.name}: ${item.quantity} avail${item.quantity <= item.low_stock_threshold ? (item.quantity === 0 ? ' – zilch!' : ' – low vibes') : ''}`).join('\n'), false);
      addMessage("Spot on? Or refine the hunt?", false);
    } else {
      addMessage(`No hits on "${entity}". Broaden the net or try synonyms? I'm game.`, false);
    }
  };

  const handleCategory = (items: Item[], categories: any[], entity: string) => {
    const stringSimilarity = (window as any).stringSimilarity;
    if (!entity) {
      addMessage("Category carousel:", false);
      addMessage(categories.map(cat => `• ${cat.name} (${items.filter(i => i.category_id === cat.id).length} items)`).join('\n'), false);
      return;
    }
    const cat = categories.find(c => stringSimilarity.compareTwoStrings(entity.toLowerCase(), c.name.toLowerCase()) > 0.7);
    if (cat) {
      const catItems = items.filter(item => item.category_id === cat.id);
      addMessage(`Spotlight on ${cat.name}:`, false);
      if (catItems.length > 0) {
        addMessage(catItems.map(item => `• ${item.name}: ${item.quantity}${item.quantity <= item.low_stock_threshold ? (item.quantity === 0 ? ' – empty!' : ' – low') : ''}`).join('\n'), false);
      } else {
        addMessage("Category's a blank canvas. Add some flair?", false);
      }
      addMessage("Deep dive done. Explore another?", false);
    } else {
      addMessage(`"${entity}" not in the lineup. Categories: ${categories.map(c => c.name).join(', ')}. Choose your fighter!`, false);
    }
  };

  const handleUserActivity = (itemsOut: ItemOut[], entity: string) => {
    const activity = itemsOut.reduce((acc, item) => {
      acc[item.person_name] = (acc[item.person_name] || 0) + item.quantity;
      return acc;
    }, {} as { [key: string]: number });
    let users = Object.entries(activity).sort(([, a], [, b]) => b - a);
    if (entity) users = users.filter(([name]) => name.toLowerCase().includes(entity.toLowerCase()));
    if (users.length > 0) {
      addMessage(`Activity leaders${entity ? ` near "${entity}"` : ''}:`, false);
      addMessage(users.slice(0, 5).map(([name, count]) => `• ${name}: ${count} items out`).join('\n'), false);
      addMessage("Who's hustling! Track more or switch gears?", false);
    } else {
      addMessage("Activity log's quiet. Perfect storm for planning?", false);
    }
  };

  const handleSummary = (items: Item[], itemsOut: ItemOut[], categories: any[], entity: string) => {
    const total = items.reduce((sum, item) => sum + item.quantity, 0);
    const low = items.filter(item => item.quantity <= item.low_stock_threshold).length;
    const recent = itemsOut.filter(item => new Date(item.date_time) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length;
    addMessage("Inventory snapshot – crisp and current:", false);
    addMessage(`• Units total: ${total.toLocaleString()}\n• Item types: ${items.length}\n• Low flags: ${low} ${low > 0 ? '⚠️' : '✅'}\n• Weekly moves: ${recent}\n• Category count: ${categories.length}`, false);
    if (entity.includes('detail')) {
      const byCat = categories.map(cat => `• ${cat.name}: ${items.filter(i => i.category_id === cat.id).reduce((sum, i) => sum + i.quantity, 0)} units`);
      addMessage("Category split:\n" + byCat.join('\n'), false);
    }
    addMessage("Solid overview! Zoom in on anything?", false);
  };

  const handleRecommendations = (items: Item[], entity: string) => {
    let critical = items.filter(item => item.quantity <= item.low_stock_threshold);
    if (entity) critical = critical.filter(item => item.name.toLowerCase().includes(entity.toLowerCase()));
    if (critical.length > 0) {
      addMessage("Restock radar pinging:", false);
      addMessage(critical.map(item => `• ${item.name}: Grab ${item.low_stock_threshold - item.quantity + 10} more (safety net included)`).join('\n'), false);
      addMessage("Smart buys ahead. PDF this or alert the crew?", false, [{
        text: "PDF Report",
        action: async () => {
          const result = await generateLowStockPDF();
          addMessage(result.message, false, undefined, result.blob, result.filename);
        }
      }, {
        text: "Send Alert",
        action: handleSendAlert
      }, {
        text: "Full System Report",
        action: async () => {
          const result = await generateFullSystemPDF();
          addMessage(result.message, false, undefined, result.blob, result.filename);
        }
      }]);
    } else {
      addMessage("Stock's in sweet spot – no buys urgent. Celebrate with a dashboard dance? 🎉", false);
    }
  };

  const handleRecentActivity = (itemsOut: ItemOut[], entity: string) => {
    let recent = itemsOut.sort((a, b) => new Date(b.date_time).getTime() - new Date(a.date_time).getTime()).slice(0, 10);
    if (entity) recent = recent.filter(item => item.person_name.toLowerCase().includes(entity.toLowerCase()) || item.item_name.toLowerCase().includes(entity.toLowerCase()));
    if (recent.length > 0) {
      addMessage("Fresh tracks:", false);
      addMessage(recent.map(item => `• ${item.person_name} snagged ${item.quantity} ${item.item_name} (${new Date(item.date_time).toLocaleString()})`).join('\n'), false);
      addMessage("Action log updated. History lesson over – future plans?", false);
    } else {
      addMessage("No fresh action. Calm before the storm? Let's stir something up.", false);
    }
  };

  const insertHelpTopic = (command: string) => {
    setInput(command);
    setShowHelpPanel(false);
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <header className="bg-white shadow-sm p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Bot className="h-6 w-6 mr-2 text-gray-600" />
            Inventory AI Assistant
          </h1>
          <Button variant="ghost" onClick={() => setShowHelpPanel(!showHelpPanel)} className="flex items-center text-gray-600 hover:text-gray-900">
            <HelpCircle className="h-5 w-5 mr-1" /> Help
          </Button>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {systemStatus && (
            <Card className="bg-gray-50 border-gray-200">
              <CardContent className="p-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold text-gray-800 flex items-center">
                    <Info className="h-4 w-4 mr-1" /> System Status (Live)
                  </h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="bg-white p-3 rounded-md shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-600">Total Items</p>
                    <p className="text-xl font-bold text-gray-900">{systemStatus.totalItems}</p>
                  </div>
                  <div className="bg-white p-3 rounded-md shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-600">Low Stock</p>
                    <p className={`text-xl font-bold ${systemStatus.lowStockItems > 0 ? 'text-amber-600' : 'text-green-600'}`}>{systemStatus.lowStockItems}</p>
                  </div>
                  <div className="bg-white p-3 rounded-md shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-600">Categories</p>
                    <p className="text-xl font-bold text-gray-900">{systemStatus.categoriesCount}</p>
                  </div>
                  <div className="bg-white p-3 rounded-md shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-600">Recent Checkouts</p>
                    <p className="text-xl font-bold text-gray-900">{systemStatus.recentActivity}</p>
                  </div>
                  <div className="bg-white p-3 rounded-md shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-600">Last Login</p>
                    <p className="text-sm text-gray-900 flex items-center">
                      {systemStatus.lastLogin ? (
                        <>
                          <User className="h-3 w-3 mr-1" />
                          {systemStatus.lastLogin.username}
                          <Clock className="h-3 w-3 ml-2 mr-1" />
                          {new Date(systemStatus.lastLogin.timestamp).toLocaleTimeString()}
                        </>
                      ) : 'N/A'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          {showHelpPanel && (
            <Card className="bg-gray-50 border-gray-200 animate-in slide-in-from-top-2 duration-300">
              <CardContent className="p-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold text-gray-800 flex items-center">
                    <HelpCircle className="h-4 w-4 mr-1" /> Quick Commands
                  </h3>
                  <Button variant="ghost" size="icon" onClick={() => setShowHelpPanel(false)}>
                    <X className="h-4 w-4 text-gray-800" />
                  </Button>
                </div>
                <p className="text-sm text-gray-700 mb-3">Spark a convo with these – click to load:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {generateHelpTopics().map((topic, index) => (
                    <Card key={index} className="bg-white border-gray-100 hover:shadow-md transition-shadow">
                      <CardContent className="p-3">
                        <p className="font-medium text-gray-800">{topic.topic}</p>
                        <p className="text-xs text-gray-600 mb-2">{topic.description}</p>
                        <Button variant="outline" className="w-full text-gray-700 border-gray-200 hover:bg-gray-50" onClick={() => insertHelpTopic(topic.command)}>
                          "{topic.command}"
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {messages.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Bot className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg">Ready when you are! Type a query like "show low stock" to kick things off.</p>
            </div>
          )}
          {messages.map(message => (
            <div key={message.id} className={`flex ${message.isUser ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-200`}>
              <div className="flex items-start space-x-2 max-w-[80%]">
                {!message.isUser && (
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarFallback className="bg-gray-100 text-gray-600">AI</AvatarFallback>
                  </Avatar>
                )}
                <Card className={`flex-1 ${message.isUser ? 'bg-gray-600 text-white' : 'bg-white border-gray-200 shadow-sm'}`}>
                  <CardContent className="p-3">
                    <p className="whitespace-pre-line text-sm leading-relaxed">{message.text}</p>
                    {message.options && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {message.options.map((opt, idx) => (
                          <Button key={idx} size="sm" variant={message.isUser ? "secondary" : "outline"} onClick={opt.action} className="text-xs px-3 py-1">
                            {opt.text}
                          </Button>
                        ))}
                      </div>
                    )}
                    {message.downloadBlob && (
                      <div className="mt-3">
                        <Button 
                          variant="outline" 
                          onClick={() => handleDownload(message.downloadBlob!, message.downloadFilename!)}
                          className="w-full text-gray-700 border-gray-200 hover:bg-gray-50"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download {message.downloadFilename?.endsWith('.pdf') ? 'PDF' : 'Excel'}
                        </Button>
                      </div>
                    )}
                    <p className={`text-xs mt-2 ${message.isUser ? 'text-gray-200' : 'text-gray-500'}`}>
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </CardContent>
                </Card>
                {message.isUser && (
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarFallback className="bg-gray-100 text-gray-600">U</AvatarFallback>
                  </Avatar>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-center justify-start text-gray-500 animate-pulse">
              <MessageSquare className="h-4 w-4 mr-2" />
              <span className="text-sm">Thinking fast...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
          {/* New Quick Actions Section */}
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-2 justify-center">
                <Button 
                  variant="outline" 
                  onClick={handleSendAlert}
                  className="flex items-center gap-2 text-sm px-4 py-2 border-gray-300 hover:bg-gray-50"
                  disabled={loading}
                >
                  <Mail className="h-4 w-4" />
                  Send Low Stock Alert
                </Button>
                <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      onClick={() => setShowDatePicker(true)}
                      className="flex items-center gap-2 text-sm px-4 py-2 border-gray-300 hover:bg-gray-50"
                      disabled={loading}
                    >
                      <CalendarIcon className="h-4 w-4" />
                      Generate Daily Report
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <div className="p-4 space-y-2">
                      <Label>Select Date</Label>
                      <Calendar
                        mode="single"
                        selected={selectedReportDate}
                        onSelect={(date) => {
                          setSelectedReportDate(date || new Date());
                          setShowDatePicker(false);
                          handleGenerateDailyReport('pdf');
                        }}
                        className="rounded-md border"
                      />
                      <div className="flex gap-2 pt-2">
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          onClick={() => {
                            setSelectedReportDate(new Date());
                            setShowDatePicker(false);
                            handleGenerateDailyReport('pdf');
                          }}
                        >
                          Today
                        </Button>
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          onClick={() => setShowDatePicker(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <footer className="p-4 bg-white border-t border-gray-200">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex items-center space-x-2">
            <Input
              ref={inputRef}
              placeholder="What's on your mind? (e.g., 'show low stock' or 'generate daily report for yesterday')"
              className="flex-1 focus:ring-2 focus:ring-gray-500 focus:border-gray-500 transition-colors"
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={loading}
            />
            <Button type="submit" className="bg-gray-600 hover:bg-gray-700 disabled:opacity-50" disabled={loading || !input.trim()}>
              <Send className="h-4 w-4" />
              <span className="sr-only">Send</span>
            </Button>
          </form>
          {messages.length > 0 && (
            <p className="text-xs text-gray-500 mt-2 text-center italic">Pro tip: Say "help" for command ideas.</p>
          )}
        </div>
      </footer>
    </div>
  );
};

export default AIAssistant;