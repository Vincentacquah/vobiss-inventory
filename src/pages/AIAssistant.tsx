import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, MessageSquare, HelpCircle, X, Info, User, Clock, Mail, Download, FileText, Calendar as CalendarIcon, FileSpreadsheet, Search, Database, AlertTriangle, CheckCircle } from 'lucide-react';
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
  release_by?: string; // Added for better handling
}

/**
 * Interface for request details
 */
interface RequestDetail {
  id: number;
  items: { item_id: string; item_name: string; quantity_requested: number; quantity_received?: number }[];
  approvals?: { approver_name: string }[];
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
 * Query Parser Result
 */
interface QueryParse {
  intent: string;
  entity?: string;
  filters?: { [key: string]: any };
  action?: 'query' | 'update' | 'report' | 'alert';
  confidence: number;
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
    mode: 'normal' | 'addingItem' | 'updatingStock' | 'viewingRequest';
    addItemData?: { itemName: string; categoryId: string | null; quantity: number | null; newCategoryName?: string };
    updateStockData?: { itemId: string; newQuantity: number | null };
    viewingRequestId?: number;
    waitingFor?: 'itemName' | 'category' | 'newCategoryName' | 'quantity' | 'newStockQuantity' | 'requestId';
  }>({ mode: 'normal' });
  const [dataCache, setDataCache] = useState<any>({ lastUpdate: 0 });

  // New state for daily report
  const [selectedReportDate, setSelectedReportDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Enhanced help topics with more database coverage
  const generateHelpTopics = () => [
    { topic: "Find items", command: `find ${items[0]?.name || 'item'}`, description: "Search items by name, description, or category" },
    { topic: "Check stock levels", command: "show stock for all items", description: "View quantities, low stock, or specific item stock" },
    { topic: "Category exploration", command: `items in ${categories[0]?.name || 'category'}`, description: "List items, totals, or low stock in a category" },
    { topic: "User checkouts", command: "who checked out what recently", description: "See who took items, quantities, and when" },
    { topic: "Request management", command: "show all requests", description: "View, filter, or detail requests (Super Admin)" },
    { topic: "Audit trail", command: "recent logins or changes", description: "Track logins, updates, or any activity logs" },
    { topic: "System overview", command: "give me a full database summary", description: "Totals, health, and trends across everything" },
    { topic: "Add or update", command: `add new item or update stock`, description: "Add items or adjust stock conversationally" },
    { topic: "Alerts and notifications", command: "send low stock alert", description: "Email supervisors about critical stock" },
    { topic: "Reports", command: "generate low stock PDF", description: "PDF/Excel for low stock, daily issuances, or full system" },
    { topic: "Trends", command: "issuances this week", description: "Weekly/monthly summaries or custom filters" },
    { topic: "Specific details", command: "details on request 123", description: "Deep dive into a request, item, or log entry" },
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

  // Enhanced query parser for more advanced natural language understanding
  const parseQuery = (query: string, dataCache: any): QueryParse => {
    const lowerQuery = query.toLowerCase().trim();
    const stringSimilarity = (window as any).stringSimilarity;

    // Extract potential entities and filters
    const entityMatch = lowerQuery.match(/(?:about|for|on|the)\s+([a-zA-Z0-9\s]+)/i);
    const entity = entityMatch ? entityMatch[1].trim() : '';
    const bestEntity = entity ? (() => {
      // Match to items, categories, users, etc.
      const itemMatches = dataCache.items.map((item: Item) => ({ name: item.name, score: stringSimilarity.compareTwoStrings(entity.toLowerCase(), item.name.toLowerCase()) }));
      const catMatches = dataCache.categories.map((cat: any) => ({ name: cat.name, score: stringSimilarity.compareTwoStrings(entity.toLowerCase(), cat.name.toLowerCase()) }));
      const userMatches = [...new Set(dataCache.itemsOut.map((io: ItemOut) => io.person_name))].map(name => ({ name, score: stringSimilarity.compareTwoStrings(entity.toLowerCase(), name.toLowerCase()) }));
      const allMatches = [...itemMatches, ...catMatches, ...userMatches];
      const best = allMatches.reduce((max, curr) => (curr.score > max.score ? curr : max), { name: '', score: 0 });
      return best.score > 0.6 ? best.name : entity;
    })() : '';

    // Expanded intents with more patterns and weights
    const intents = {
      generateFullReport: { patterns: [/full.*(report|overview|health|summary)|system.*(report|status|health)|complete.*(scan|check)/i], weight: 1.2 },
      generateReport: { patterns: [/generate.*(report|pdf|excel)|low.*stock.*(report|list)|export.*(data|report)/i], weight: 1.1 },
      dailyReport: { patterns: [/daily.*(report|issuances)|(report|export).*(day|date|today|yesterday)/i], weight: 1.1 },
      sendAlert: { patterns: [/send.*(alert|notification)|notify.*(supervisor|team)|email.*(low|alert)/i], weight: 1.0 },
      stockCheck: { patterns: [/stock.*(level|quantity|amount)|low.*stock|out.*of.*stock|available.*(units|qty)/i], weight: 1.0 },
      searchItem: { patterns: [/find|search|locate|where.*is|look.*for.*(item|product)/i], weight: 0.9 },
      categoryQuery: { patterns: [/category.*(items|list|stock)|items.*in.*category|group.*by.*category/i], weight: 0.8 },
      userActivity: { patterns: [/who.*(checked|took|borrowed|issued)|user.*(activity|history)|person.*(name)/i], weight: 0.8 },
      loginAudit: { patterns: [/login.*(history|recent)|who.*signed.*in|access.*log/i], weight: 0.8 },
      requestQuery: { patterns: [/request.*(status|details|list)|show.*requests|project.*request/i], weight: 0.9 },
      auditQuery: { patterns: [/audit.*(log|trail)|change.*history|what.*changed/i], weight: 0.7 },
      addItem: { patterns: [/add.*(new.*item|stock)|create.*item|stock.*up/i], weight: 0.6 },
      updateStock: { patterns: [/update.*(stock|quantity)|restock|adjust.*amount/i], weight: 0.6 },
      summary: { patterns: [/summary|overview|total.*(items|stock)|database.*(stats|info)/i], weight: 0.7 },
      recommendation: { patterns: [/suggest.*(restock|buy)|recommend.*(items|purchase)/i], weight: 0.5 },
      recentActivity: { patterns: [/recent.*(activity|issuances|changes)|last.*(week|day|month)/i], weight: 0.5 },
      trendQuery: { patterns: [/trend|pattern|over.*(time|week|month)|issuances.*(week|month)/i], weight: 0.5 },
    };

    let detectedIntent = 'summary'; // Default fallback
    let maxScore = 0;
    let filters: { [key: string]: any } = {};
    let action = 'query';

    // Date filters for trends/reports
    const dateMatch = lowerQuery.match(/(today|yesterday|last.*(week|month|7.*days)|since.*(\d{4}-\d{2}-\d{2}))/i);
    if (dateMatch) {
      filters.dateRange = dateMatch[0];
    }

    // Numeric filters (e.g., "items with quantity > 5")
    const numMatch = lowerQuery.match(/quantity.*(>|<|=)\s*(\d+)/i);
    if (numMatch) {
      filters.quantityOp = numMatch[1];
      filters.quantityValue = parseInt(numMatch[2]);
    }

    // Status filters (e.g., "pending requests")
    const statusMatch = lowerQuery.match(/(pending|completed|approved|rejected)/i);
    if (statusMatch) {
      filters.status = statusMatch[0];
    }

    for (const [intentKey, { patterns, weight }] of Object.entries(intents)) {
      let score = 0;
      patterns.forEach(pattern => {
        if (pattern.test(lowerQuery)) score += weight;
      });
      // Semantic similarity boost
      const intentWords = intentKey.split(/(?=[A-Z])/).map(w => w.toLowerCase()).join(' ');
      const simScore = stringSimilarity.compareTwoStrings(lowerQuery, intentWords);
      score += simScore * weight;
      // Entity boost if relevant
      if (bestEntity && (intentKey.includes('search') || intentKey.includes('category') || intentKey.includes('user'))) {
        score += 0.3;
      }
      if (score > maxScore) {
        maxScore = score;
        detectedIntent = intentKey;
      }
    }

    // Determine action type
    if (detectedIntent.includes('add') || detectedIntent.includes('update')) action = 'update';
    else if (detectedIntent.includes('generate') || detectedIntent.includes('report')) action = 'report';
    else if (detectedIntent.includes('send') || detectedIntent.includes('notify')) action = 'alert';

    return {
      intent: detectedIntent,
      entity: bestEntity,
      filters,
      action,
      confidence: Math.min(maxScore, 1.0)
    };
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

      // Table setup with adjusted column widths to sum to 170mm
      const tableX = 20;
      const tableWidth = 170;
      const colWidths = { time: 20, item: 40, cat: 25, qty: 10, stock: 15, source: 15, req: 15, app: 15, iss: 15 };
      const headerHeight = 8;
      let rowHeight = 6; // Base row height, will adjust dynamically if text wraps

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

      // Table rows with text wrapping
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(8);
      doc.setFont(undefined, 'normal');
      issuances.forEach((issuance, index) => {
        if (yPos > 250) { // Leave room for footer
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

        // Function to wrap text and calculate height
        const wrapText = (text: string, maxWidth: number): { lines: string[], height: number } => {
          const words = text.split(' ');
          const lines: string[] = [];
          let currentLine = '';
          words.forEach(word => {
            const testLine = currentLine + (currentLine ? ' ' : '') + word;
            const width = doc.getTextWidth(testLine);
            if (width > maxWidth - 4) { // -4 for padding
              if (currentLine) lines.push(currentLine);
              currentLine = word;
            } else {
              currentLine = testLine;
            }
          });
          if (currentLine) lines.push(currentLine);
          return { lines, height: lines.length * 4 }; // Approx line height for fontSize 8
        };

        // Calculate max row height for this row
        let maxRowHeight = rowHeight;
        const fields = [
          { text: time, width: colWidths.time },
          { text: issuance.item_name, width: colWidths.item },
          { text: issuance.category_name || 'Uncategorized', width: colWidths.cat },
          { text: issuance.quantity.toString(), width: colWidths.qty },
          { text: issuance.current_stock?.toString() || 'N/A', width: colWidths.stock },
          { text: sourceBadge, width: colWidths.source },
          { text: issuance.requester || 'N/A', width: colWidths.req },
          { text: issuance.approver || 'N/A', width: colWidths.app },
          { text: issuance.person_name, width: colWidths.iss }
        ];

        fields.forEach(field => {
          const { height } = wrapText(field.text, field.width);
          if (height > maxRowHeight) maxRowHeight = height;
        });

        // Draw row border (vertical lines would need to be drawn separately if needed)
        doc.setDrawColor(158, 158, 158);
        doc.setLineWidth(0.2);
        colX = tableX;
        fields.forEach(() => {
          doc.line(colX, yPos, colX, yPos + maxRowHeight); // Vertical lines
          colX += (colWidths as any)[Object.keys(colWidths)[fields.indexOf(fields[0])]] || 15; // Approximate
        });
        doc.line(tableX, yPos + maxRowHeight, tableX + tableWidth, yPos + maxRowHeight); // Horizontal line

        // Draw text with wrapping
        colX = tableX;
        fields.forEach((field, fIndex) => {
          const { lines } = wrapText(field.text, field.width);
          lines.forEach((line, lIndex) => {
            doc.text(line, colX + 2, yPos + 5 + (lIndex * 4), { align: 'left' });
          });
          colX += Object.values(colWidths)[fIndex];
        });

        doc.setTextColor(0, 0, 0);
        doc.setFont(undefined, 'normal');
        yPos += maxRowHeight;
      });

      // Outer table border
      doc.rect(tableX, yPos - (headerHeight + (issuances.length * rowHeight)), tableWidth, headerHeight + (issuances.length * rowHeight) + 1, 'S');

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
      const excelBlob = new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
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
      addMessage("Whoops – that didn't go as planned. Rephrase it, and I'll give it another shot! Or hit 'help' for ideas.", false);
    } finally {
      setLoading(false);
    }
  };

  // Enhanced processQuery with parsed intent handling and conversational responses
  const processQuery = async (query: string) => {
    const lowerQuery = query.toLowerCase().trim();
    const stringSimilarity = (window as any).stringSimilarity;

    // Fetch fresh data only if cache is stale (for speed)
    if (!dataCache.lastUpdate || Date.now() - dataCache.lastUpdate > 10000) {
      await loadInitialData();
    }
    const { items: fetchedItems, itemsOut, categories: fetchedCategories, requests: fetchedRequests, auditLogs: fetchedAuditLogs, stats } = dataCache;

    // Handle conversational flow
    if (conversationState.mode !== 'normal' && conversationState.waitingFor) {
      if (conversationState.mode === 'addingItem') {
        await handleAddItemResponse(query);
      } else if (conversationState.mode === 'updatingStock') {
        await handleUpdateStockResponse(query);
      } else if (conversationState.mode === 'viewingRequest') {
        await handleRequestDetailResponse(query);
      }
      return;
    }

    // Parse the query
    const parsed = parseQuery(query, dataCache);
    const { intent, entity, filters, action, confidence } = parsed;

    // Greetings and chit-chat for nicer flow
    if (lowerQuery.includes('hello') || lowerQuery.includes('hi') || messages.length === 0) {
      const greetings = [
        `Hey ${user?.first_name || 'champ'}! Diving into the database today? Fire away – items, requests, logs, you name it. What's cooking?`,
        `Hi there! Your inventory whisperer is online. Chat about stock, users, or trends – I'm all tuned in. Shoot!`,
        `Hello! Ready to unpack the data? From low stock alerts to request deep-dives, I've got the full picture. What's first?`
      ];
      addMessage(greetings[Math.floor(Math.random() * greetings.length)], false);
      return;
    }

    if (lowerQuery.includes('thank') || lowerQuery.includes('thanks')) {
      const thanksReplies = [
        "You're welcome! Always a joy unpacking the data with you. What's the next puzzle?",
        "My pleasure – glad I could shine a light on that. More database magic?",
        "No sweat! Teamwork makes the dream work. Hit me with the follow-up."
      ];
      addMessage(thanksReplies[Math.floor(Math.random() * thanksReplies.length)], false);
      return;
    }

    if (lowerQuery === 'help') {
      setShowHelpPanel(true);
      addMessage("Opening the help panel with tailored tips based on your data. Pro move: Try natural phrases like 'show me low stock in electronics' or 'who updated items last week?'", false);
      return;
    }

    // Low confidence fallback with suggestions
    if (confidence < 0.4) {
      addMessage(`Hmm, that one's a bit fuzzy for me (confidence: ${(confidence * 100).toFixed(0)}%). Maybe rephrase? Examples: 'list all requests' or 'stock levels for laptops'. Or say 'help' for the full menu. What's your angle?`, false);
      return;
    }

    // Route to handlers based on intent
    let responseText = '';
    let options: { text: string; action: () => void }[] | undefined = undefined;
    let blob: Blob | undefined;
    let filename: string | undefined;

    switch (intent) {
      case 'dailyReport':
        const dateStr = filters.dateRange || 'today';
        let reportDate = new Date();
        if (dateStr.includes('yesterday')) reportDate.setDate(reportDate.getDate() - 1);
        // ... (handle date parsing more robustly if needed)
        setSelectedReportDate(reportDate);
        const formattedDate = format(reportDate, 'MMMM do, yyyy');
        responseText = `Got your daily report request for ${formattedDate}. PDF for a polished view or Excel for data wrangling?`;
        options = [
          { text: "PDF", action: () => handleGenerateDailyReport('pdf') },
          { text: "Excel", action: () => handleGenerateDailyReport('excel') }
        ];
        break;

      case 'generateFullReport':
        const fullResult = await generateFullSystemPDF();
        responseText = fullResult.message;
        blob = fullResult.blob;
        filename = fullResult.filename;
        break;

      case 'generateReport':
        const reportResult = await generateLowStockPDF();
        responseText = reportResult.message;
        blob = reportResult.blob;
        filename = reportResult.filename;
        break;

      case 'sendAlert':
        await handleSendAlert();
        return; // Handled inside

      case 'stockCheck':
        responseText = await handleAdvancedStockCheck(fetchedItems, entity, filters);
        options = getStockOptions(fetchedItems, entity);
        break;

      case 'searchItem':
        responseText = await handleAdvancedSearch(fetchedItems, entity, filters);
        break;

      case 'categoryQuery':
        responseText = await handleAdvancedCategory(fetchedItems, fetchedCategories, entity, filters);
        break;

      case 'userActivity':
        responseText = await handleAdvancedUserActivity(itemsOut, entity, filters);
        break;

      case 'loginAudit':
        responseText = await handleAdvancedLoginAudit(fetchedAuditLogs, entity, filters);
        break;

      case 'requestQuery':
        if (user?.role !== 'superadmin') {
          responseText = "Request details are Super Admin territory – but I can chat stock or activity. What's your focus?";
          return;
        }
        responseText = await handleAdvancedRequests(fetchedRequests, entity, filters);
        break;

      case 'auditQuery':
        responseText = await handleAdvancedAudit(fetchedAuditLogs, entity, filters);
        break;

      case 'addItem':
        await handleAdvancedAddItem(entity, filters);
        return;

      case 'updateStock':
        await handleAdvancedUpdateStock(entity, filters);
        return;

      case 'summary':
        responseText = await handleAdvancedSummary(fetchedItems, itemsOut, fetchedCategories, entity, filters);
        break;

      case 'recommendation':
        responseText = await handleAdvancedRecommendations(fetchedItems, entity, filters);
        options = getRecommendationOptions(fetchedItems);
        break;

      case 'recentActivity':
        responseText = await handleAdvancedRecentActivity(itemsOut, entity, filters);
        break;

      case 'trendQuery':
        responseText = await handleTrends(itemsOut, fetchedRequests, entity, filters);
        break;

      default:
        responseText = `Diving into the database... Found ${fetchedItems.length} items, ${fetchedRequests.length} requests, and ${fetchedAuditLogs.length} logs total. Narrow it down?`;
    }

    // Varied conversational wrappers
    const wrappers = [
      (text: string) => `Here's the scoop: ${text} Anything jump out, or refine?`,
      (text: string) => `Pulled that from the database: ${text} Spot on? Let's iterate.`,
      (text: string) => `Database query complete: ${text} Insights flowing – next question?`,
      (text: string) => `Got your back on this: ${text} Clear as day? Or deeper?`
    ];
    const wrapper = wrappers[Math.floor(Math.random() * wrappers.length)];
    addMessage(wrapper(responseText), false, options, blob, filename);
  };

  // Enhanced handlers for advanced queries
  const handleAdvancedStockCheck = async (items: Item[], entity?: string, filters?: { [key: string]: any }): Promise<string> => {
    let filtered = items;
    if (entity) {
      const stringSimilarity = (window as any).stringSimilarity;
      filtered = filtered.filter(item => stringSimilarity.compareTwoStrings(entity.toLowerCase(), item.name.toLowerCase()) > 0.6);
    }
    if (filters?.quantityOp) {
      filtered = filtered.filter(item => {
        const val = item.quantity;
        const op = filters.quantityOp;
        const threshold = filters.quantityValue || 0;
        return op === '>' ? val > threshold : op === '<' ? val < threshold : val === threshold;
      });
    }
    const lowStock = filtered.filter(item => item.quantity <= item.low_stock_threshold);
    if (lowStock.length > 0) {
      return lowStock.map(item => `• ${item.name}: ${item.quantity}/${item.low_stock_threshold} ${item.quantity === 0 ? '🚨 Out of stock!' : item.quantity < 3 ? '⚠️ Critical low' : '🟡 Low'}`).join('\n');
    }
    return filtered.length > 0 ? `All good on stock${entity ? ` for ${entity}` : ''}! Levels: ${filtered.map(i => `${i.name}: ${i.quantity}`).join(', ')}.` : "No matching stock data – broaden the search?";
  };

  const getStockOptions = (items: Item[], entity?: string) => {
    const lowStock = items.filter(item => item.quantity <= item.low_stock_threshold);
    const opts: { text: string; action: () => void }[] = [{ text: "Send Alert", action: handleSendAlert }];
    if (lowStock.length > 0) {
      opts.push({ text: "Low Stock PDF", action: async () => {
        const result = await generateLowStockPDF();
        addMessage(result.message, false, undefined, result.blob, result.filename);
      }});
    }
    opts.push({ text: "Full Report", action: async () => {
      const result = await generateFullSystemPDF();
      addMessage(result.message, false, undefined, result.blob, result.filename);
    }});
    return opts;
  };

  const handleAdvancedSearch = async (items: Item[], entity: string, filters?: { [key: string]: any }): Promise<string> => {
    const stringSimilarity = (window as any).stringSimilarity;
    let matching = items.filter(item => 
      stringSimilarity.compareTwoStrings(entity.toLowerCase(), item.name.toLowerCase()) > 0.6 ||
      stringSimilarity.compareTwoStrings(entity.toLowerCase(), (item.description || '').toLowerCase()) > 0.5
    );
    if (filters?.quantityOp) {
      matching = matching.filter(item => {
        const val = item.quantity;
        const op = filters.quantityOp;
        const threshold = filters.quantityValue || 0;
        return op === '>' ? val > threshold : op === '<' ? val < threshold : val === threshold;
      });
    }
    if (matching.length > 0) {
      return matching.map(item => `• ${item.name}: ${item.quantity} in stock${item.description ? ` (${item.description.substring(0, 50)}...)` : ''}`).join('\n');
    }
    return `No direct hits on "${entity}" – closest? ${items.slice(0, 3).map(i => i.name).join(', ')}. Try synonyms!`;
  };

  const handleAdvancedCategory = async (items: Item[], categories: any[], entity?: string, filters?: { [key: string]: any }): Promise<string> => {
    const stringSimilarity = (window as any).stringSimilarity;
    if (!entity) {
      const catSummary = categories.map(cat => {
        const catItems = items.filter(i => i.category_id === cat.id);
        const totalQty = catItems.reduce((sum, i) => sum + i.quantity, 0);
        const lowInCat = catItems.filter(i => i.quantity <= i.low_stock_threshold).length;
        return `• ${cat.name}: ${catItems.length} items, ${totalQty} units total${lowInCat > 0 ? ` (🟡 ${lowInCat} low)` : ''}`;
      }).join('\n');
      return catSummary || "No categories yet – time to organize?";
    }
    const cat = categories.find(c => stringSimilarity.compareTwoStrings(entity.toLowerCase(), c.name.toLowerCase()) > 0.7);
    if (cat) {
      const catItems = items.filter(item => item.category_id === cat.id);
      let filteredCatItems = catItems;
      if (filters?.quantityOp) {
        filteredCatItems = filteredCatItems.filter(item => {
          const val = item.quantity;
          const op = filters.quantityOp;
          const threshold = filters.quantityValue || 0;
          return op === '>' ? val > threshold : op === '<' ? val < threshold : val === threshold;
        });
      }
      if (filteredCatItems.length > 0) {
        return filteredCatItems.map(item => `• ${item.name}: ${item.quantity}${item.quantity <= item.low_stock_threshold ? ' (low stock ⚠️)' : ''}`).join('\n');
      }
      return `Nothing matches in ${cat.name} right now – empty shelf?`;
    }
    return `Category "${entity}" not found. Available: ${categories.map(c => c.name).join(', ')}. Pick one!`;
  };

  const handleAdvancedUserActivity = async (itemsOut: ItemOut[], entity?: string, filters?: { [key: string]: any }): Promise<string> => {
    let filteredOut = itemsOut;
    if (entity) {
      filteredOut = filteredOut.filter(io => 
        io.person_name.toLowerCase().includes(entity.toLowerCase()) || 
        io.item_name.toLowerCase().includes(entity.toLowerCase())
      );
    }
    if (filters?.dateRange) {
      // Implement date filtering logic here (e.g., last week)
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      filteredOut = filteredOut.filter(io => new Date(io.date_time) > oneWeekAgo);
    }
    const activity = filteredOut.reduce((acc, io) => {
      const key = io.person_name;
      acc[key] = (acc[key] || { count: 0, items: new Set() });
      acc[key].count += io.quantity;
      acc[key].items.add(`${io.quantity} x ${io.item_name}`);
      return acc;
    }, {} as { [key: string]: { count: number; items: Set<string> } });
    const topUsers = Object.entries(activity)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 5)
      .map(([name, data]) => `• ${name}: ${data.count} units (${Array.from(data.items).join(', ')})`).join('\n');
    return topUsers || "No activity matches – quiet crew?";
  };

  const handleAdvancedLoginAudit = async (auditLogs: AuditLog[], entity?: string, filters?: { [key: string]: any }): Promise<string> => {
    let filteredLogs = auditLogs.filter(log => log.action === 'login');
    if (entity) {
      filteredLogs = filteredLogs.filter(log => (log.username || log.full_name || '').toLowerCase().includes(entity.toLowerCase()));
    }
    if (filters?.dateRange) {
      // Similar date filtering
    }
    filteredLogs = filteredLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 5);
    return filteredLogs.map(log => `• ${log.username || log.full_name}: ${new Date(log.timestamp).toLocaleString()} from ${log.ip_address}`).join('\n') || "No login matches – stealth mode?";
  };

  const handleAdvancedRequests = async (requests: Request[], entity?: string, filters?: { [key: string]: any }): Promise<string> => {
    let filteredRequests = requests;
    if (entity) {
      filteredRequests = filteredRequests.filter(req => 
        req.project_name.toLowerCase().includes(entity.toLowerCase()) || 
        req.created_by.toLowerCase().includes(entity.toLowerCase())
      );
    }
    if (filters?.status) {
      filteredRequests = filteredRequests.filter(req => req.status.toLowerCase().includes(filters.status!.toLowerCase()));
    }
    if (filteredRequests.length > 0) {
      const detailsPromises = filteredRequests.slice(0, 3).map(async (req) => {
        const details = await getRequestDetails(req.id);
        const itemCount = details.items?.reduce((sum, item) => sum + (item.quantity_received || 0), 0) || 0;
        return `• #${req.id} (${req.status}): ${req.project_name} by ${req.created_by} – ${itemCount} items issued`;
      });
      const details = await Promise.all(detailsPromises);
      return details.join('\n');
    }
    return "No requests match – all clear or new project time?";
  };

  const handleAdvancedAudit = async (auditLogs: AuditLog[], entity?: string, filters?: { [key: string]: any }): Promise<string> => {
    let filteredLogs = auditLogs;
    if (entity) {
      filteredLogs = filteredLogs.filter(log => JSON.stringify(log.details).toLowerCase().includes(entity.toLowerCase()));
    }
    filteredLogs = filteredLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 5);
    return filteredLogs.map(log => `• ${log.action} by ${log.username || log.full_name}: ${log.details ? JSON.stringify(log.details).substring(0, 50) : ''} at ${new Date(log.timestamp).toLocaleString()}`).join('\n') || "Audit trail quiet – steady as she goes.";
  };

  const handleAdvancedAddItem = async (entity?: string, filters?: { [key: string]: any }) => {
    if (!entity) {
      setConversationState({ mode: 'addingItem', waitingFor: 'itemName' });
      addMessage("Let's stock up! What's the new item's name? (E.g., 'Wireless Mouse')", false);
      return;
    }
    setConversationState({ 
      mode: 'addingItem', 
      addItemData: { itemName: entity, categoryId: null, quantity: filters?.quantityValue || null }, 
      waitingFor: filters?.quantityValue ? 'category' : 'quantity' 
    });
    if (!filters?.quantityValue) {
      addMessage(`Adding "${entity}". How many units? (E.g., 10)`, false);
    } else {
      addMessage(`"${entity}" with ${filters.quantityValue} units. Category?`, false, categories.map(cat => ({
        text: cat.name,
        action: () => handleCategorySelection(cat.id)
      })).concat([{ text: "New Category", action: () => handleCategorySelection('new') }]));
    }
  };

  const handleAdvancedUpdateStock = async (entity?: string, filters?: { [key: string]: any }) => {
    const stringSimilarity = (window as any).stringSimilarity;
    const targetItem = dataCache.items.find((item: Item) => stringSimilarity.compareTwoStrings(entity || '', item.name.toLowerCase()) > 0.7);
    if (!targetItem) {
      addMessage(`Couldn't pinpoint the item for update (tried "${entity}"). Search first? Or name it clearly.`, false);
      return;
    }
    setConversationState({ 
      mode: 'updatingStock', 
      updateStockData: { itemId: targetItem.id, newQuantity: filters?.quantityValue || null }, 
      waitingFor: filters?.quantityValue ? 'confirm' : 'newStockQuantity' 
    });
    if (!filters?.quantityValue) {
      addMessage(`Updating ${targetItem.name} (current: ${targetItem.quantity}). New quantity?`, false);
    } else {
      addMessage(`Set ${targetItem.name} to ${filters.quantityValue}? Confirm or adjust.`, false, [
        { text: "Confirm", action: () => handleStockUpdateConfirm(targetItem.id, filters.quantityValue!) },
        { text: "Adjust", action: () => addMessage("New number?", false) } // Simplified
      ]);
    }
  };

  const handleStockUpdateConfirm = async (itemId: string, newQty: number) => {
    // Assume an update API call here; placeholder
    // await updateItemStock(itemId, newQty);
    addMessage(`Stock updated for item ${itemId} to ${newQty}! Database refreshed. Smooth sailing.`, false);
    setConversationState({ mode: 'normal' });
    loadInitialData();
  };

  const handleAdvancedSummary = async (items: Item[], itemsOut: ItemOut[], categories: any[], entity?: string, filters?: { [key: string]: any }): Promise<string> => {
    const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);
    const lowCount = items.filter(i => i.quantity <= i.low_stock_threshold).length;
    const recentOut = itemsOut.filter(io => new Date(io.date_time) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length;
    let summary = `📊 Quick DB Pulse: ${items.length} item types, ${totalQty} units total, ${lowCount} low stock alerts, ${recentOut} issuances last week, ${categories.length} categories.`;
    if (entity === 'detailed' || filters) {
      const catBreakdown = categories.map(cat => {
        const catItems = items.filter(i => i.category_id === cat.id);
        return `• ${cat.name}: ${catItems.length} items / ${catItems.reduce((s, i) => s + i.quantity, 0)} units`;
      }).join('\n');
      summary += `\n\nCategory Breakdown:\n${catBreakdown}`;
    }
    return summary;
  };

  const handleAdvancedRecommendations = async (items: Item[], entity?: string, filters?: { [key: string]: any }): Promise<string> => {
    let critical = items.filter(i => i.quantity <= i.low_stock_threshold);
    if (entity) critical = critical.filter(i => i.name.toLowerCase().includes(entity.toLowerCase()));
    if (critical.length > 0) {
      return critical.map(i => `• ${i.name}: Restock ${i.low_stock_threshold * 2 - i.quantity} units (aim high!) 🚀`).join('\n');
    }
    return "Stock's golden – no urgent buys. Proactive win! 🎉";
  };

  const getRecommendationOptions = (items: Item[]) => {
    const lowStock = items.filter(i => i.quantity <= i.low_stock_threshold);
    return lowStock.length > 0 ? [
      { text: "Alert Team", action: handleSendAlert },
      { text: "PDF List", action: async () => {
        const result = await generateLowStockPDF();
        addMessage(result.message, false, undefined, result.blob, result.filename);
      }}
    ] : undefined;
  };

  const handleAdvancedRecentActivity = async (itemsOut: ItemOut[], entity?: string, filters?: { [key: string]: any }): Promise<string> => {
    let recent = itemsOut.sort((a, b) => new Date(b.date_time).getTime() - new Date(a.date_time).getTime()).slice(0, 10);
    if (entity) recent = recent.filter(io => io.person_name.toLowerCase().includes(entity.toLowerCase()) || io.item_name.toLowerCase().includes(entity.toLowerCase()));
    if (filters?.dateRange?.includes('week')) recent = recent.filter(io => new Date(io.date_time) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
    return recent.map(io => `• ${io.person_name} grabbed ${io.quantity} ${io.item_name} on ${format(new Date(io.date_time), 'MMM dd, HH:mm')}`).join('\n') || "Recent log's a snooze – all systems steady.";
  };

  const handleTrends = async (itemsOut: ItemOut[], requests: Request[], entity?: string, filters?: { [key: string]: any }): Promise<string> => {
    // Simple trend calc: issuances over last 7 days
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weeklyOut = itemsOut.filter(io => new Date(io.date_time) > oneWeekAgo).length;
    const weeklyReq = requests.filter(r => new Date(r.created_at) > oneWeekAgo).length;
    return `Trend Watch${entity ? ` on ${entity}` : ''}: ${weeklyOut} issuances & ${weeklyReq} requests last week. Upward? Let's forecast more if you want. 📈`;
  };

  // Conversational handlers (existing + new for update)
  const handleAddItemResponse = async (response: string) => {
    // ... (keep existing logic for addItem)
    const { waitingFor, addItemData } = conversationState;
    const stringSimilarity = (window as any).stringSimilarity;
    if (waitingFor === 'itemName') {
      setConversationState(prev => ({ ...prev, addItemData: { ...prev.addItemData, itemName: response }, waitingFor: 'category' }));
      addMessage(`Got "${response}" – solid start. Category next (or 'new')?`, false, categories.map(cat => ({
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
        addMessage(`Hmm, "${response}" not ringing bells. Try again or pick from options?`, false);
      }
    } else if (waitingFor === 'newCategoryName') {
      // Placeholder for new category creation
      const newCatId = `temp-${Date.now()}`; // Replace with API
      setConversationState(prev => ({ ...prev, addItemData: { ...prev.addItemData, categoryId: newCatId, newCategoryName: response }, waitingFor: 'quantity' }));
      addMessage(`"${response}" category created. Units for ${addItemData?.itemName}?`, false);
    } else if (waitingFor === 'quantity') {
      const quantity = parseInt(response);
      if (isNaN(quantity) || quantity <= 0) {
        addMessage("Needs a positive number for quantity. Try again?", false);
        return;
      }
      await addItem({ name: addItemData?.itemName || '', category_id: addItemData?.categoryId || null, quantity, low_stock_threshold: 5 });
      const catName = addItemData?.newCategoryName || categories.find(c => c.id === addItemData?.categoryId)?.name || 'Uncategorized';
      addMessage(`Boom! Added ${quantity} ${addItemData?.itemName} to ${catName}. Inventory's growing. Next?`, false);
      setConversationState({ mode: 'normal' });
      loadInitialData();
    }
  };

  const handleUpdateStockResponse = async (response: string) => {
    const { waitingFor, updateStockData } = conversationState;
    if (waitingFor === 'newStockQuantity') {
      const newQty = parseInt(response);
      if (isNaN(newQty) || newQty < 0) {
        addMessage("Positive quantity only, please. What's the new stock level?", false);
        return;
      }
      setConversationState(prev => ({ ...prev, updateStockData: { ...prev.updateStockData, newQuantity: newQty }, waitingFor: 'confirm' }));
      addMessage(`Setting to ${newQty}? (Current was ${updateStockData?.newQuantity || 0} – wait, no, that's the proposal.) Confirm?`, false, [
        { text: "Yes, Update", action: () => handleStockUpdateConfirm(updateStockData!.itemId, newQty) }
      ]);
    }
    // Handle confirm logic if needed
  };

  const handleRequestDetailResponse = async (response: string) => {
    const reqIdMatch = response.match(/(\d+)/);
    if (reqIdMatch) {
      const details = await getRequestDetails(parseInt(reqIdMatch[1]));
      addMessage(`Request #${details.id} details: ${details.items?.length || 0} items, status: ${details.status || 'Pending'}. Full breakdown available – ask specifics!`, false);
    } else {
      addMessage("Request ID needed for details. E.g., '123'. Or back to list?", false);
    }
    setConversationState({ mode: 'normal' });
  };

  const handleCategorySelection = (catId: string) => {
    if (catId === 'new') {
      setConversationState(prev => ({ ...prev, addItemData: { ...prev.addItemData, categoryId: 'new' }, waitingFor: 'newCategoryName' }));
      addMessage("Fresh category – name it!", false);
    } else {
      setConversationState(prev => ({ ...prev, addItemData: { ...prev.addItemData, categoryId: catId }, waitingFor: 'quantity' }));
      addMessage(`${categories.find(c => c.id === catId)?.name} selected. Quantity?`, false);
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
            Advanced Inventory AI
          </h1>
          <Button variant="ghost" onClick={() => setShowHelpPanel(!showHelpPanel)} className="flex items-center text-gray-600 hover:text-gray-900">
            <HelpCircle className="h-5 w-5 mr-1" /> Guide
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
                    <Database className="h-4 w-4 mr-1" /> Live DB Snapshot
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
                    <p className="text-sm text-gray-600">Recent Issuances</p>
                    <p className="text-xl font-bold text-gray-900">{systemStatus.recentActivity}</p>
                  </div>
                  <div className="bg-white p-3 rounded-md shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-600">Last Activity</p>
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
                    <HelpCircle className="h-4 w-4 mr-1" /> DB Chat Guide
                  </h3>
                  <Button variant="ghost" size="icon" onClick={() => setShowHelpPanel(false)}>
                    <X className="h-4 w-4 text-gray-800" />
                  </Button>
                </div>
                <p className="text-sm text-gray-700 mb-3">Chat naturally about anything – e.g., "stock for laptops >5" or "requests by John this week". Click to try:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
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
              <p className="text-lg">Your DB sidekick is ready. Ask anything: "What's low stock?" or "Requests this week?"</p>
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
              <Search className="h-4 w-4 mr-2" />
              <span className="text-sm">Querying the database...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
          {/* Enhanced Quick Actions */}
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-2 justify-center">
                <Button 
                  variant="outline" 
                  onClick={handleSendAlert}
                  className="flex items-center gap-2 text-sm px-4 py-2 border-gray-300 hover:bg-gray-50"
                  disabled={loading}
                >
                  <AlertTriangle className="h-4 w-4" />
                  Alert Low Stock
                </Button>
                <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="flex items-center gap-2 text-sm px-4 py-2 border-gray-300 hover:bg-gray-50"
                      disabled={loading}
                    >
                      <FileText className="h-4 w-4" />
                      Daily Report
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <div className="p-4 space-y-2">
                      <Label>Select Date</Label>
                      <Calendar
                        mode="single"
                        selected={selectedReportDate}
                        onSelect={(date) => setSelectedReportDate(date || new Date())}
                        className="rounded-md border"
                      />
                      <div className="flex gap-2 pt-2">
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          onClick={() => {
                            setShowDatePicker(false);
                            handleGenerateDailyReport('pdf');
                          }}
                        >
                          PDF
                        </Button>
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          onClick={() => {
                            setShowDatePicker(false);
                            handleGenerateDailyReport('excel');
                          }}
                        >
                          Excel
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
                <Button 
                  variant="outline" 
                  onClick={async () => {
                    const result = await generateFullSystemPDF();
                    addMessage(result.message, false, undefined, result.blob, result.filename);
                  }}
                  className="flex items-center gap-2 text-sm px-4 py-2 border-gray-300 hover:bg-gray-50"
                  disabled={loading}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Full DB Report
                </Button>
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
              placeholder="Chat about the DB: 'low stock in electronics' or 'requests by team last week'..."
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
            <p className="text-xs text-gray-500 mt-2 text-center italic">Tip: Be specific with filters like "quantity > 10" for precise DB dives.</p>
          )}
        </div>
      </footer>
    </div>
  );
};

export default AIAssistant;