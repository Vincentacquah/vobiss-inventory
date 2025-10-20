import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, MessageSquare, HelpCircle, X, Info, User, Clock, Mail } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { getItems, getCategories, getItemsOut, addItem, getRequests, getAuditLogs } from '../api';
import { useAuth } from '../context/AuthContext';
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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
  ];

  // Real-time data refresh (every 10 seconds for responsiveness)
  useEffect(() => {
    loadInitialData();
    const interval = setInterval(loadInitialData, 10000);
    return () => clearInterval(interval);
  }, [user?.role]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadInitialData = async () => {
    try {
      const [fetchedItems, fetchedCategories, itemsOut, fetchedRequests, fetchedAuditLogs] = await Promise.all([
        getItems(),
        getCategories(),
        getItemsOut(),
        getRequests(),
        getAuditLogs()
      ]);
      const lowStockItems = fetchedItems.filter(item => item.quantity <= item.low_stock_threshold);
      const loginLogs = fetchedAuditLogs.filter(log => log.action === 'login').sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      const lastLogin = loginLogs.length > 0 ? { username: loginLogs[0].username || loginLogs[0].full_name || 'Unknown', timestamp: loginLogs[0].timestamp } : null;

      setItems(fetchedItems);
      setCategories(fetchedCategories);
      setRequests(fetchedRequests);
      setAuditLogs(fetchedAuditLogs);
      setSystemStatus({
        totalItems: fetchedItems.length,
        lowStockItems: lowStockItems.length,
        categoriesCount: fetchedCategories.length,
        recentActivity: itemsOut.length,
        lastLogin,
      });

      if (messages.length === 0) {
        addMessage("Hello! I'm your smart inventory assistant, ready to help with real-time data. What's up?", false);
        addMessage(`Try: "Show low stock" or "Add ${items[0]?.name || 'item'}"`, false);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast({ title: "Error", description: "Failed to fetch system data", variant: "destructive" });
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const addMessage = (text: string, isUser: boolean, options?: { text: string; action: () => void }[]) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      text,
      isUser,
      timestamp: new Date(),
      options,
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const sendLowStockEmail = async () => {
    try {
      await fetch('/api/send-low-stock-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ force: true }),
      });
      toast({ title: "Success", description: "Low stock email sent!", variant: "default" });
      addMessage("Sent low stock alert email to the team.", false);
    } catch (error) {
      console.error("Error sending email:", error);
      toast({ title: "Error", description: "Failed to send email", variant: "destructive" });
      addMessage("Could not send email. Check system logs.", false);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    addMessage(input, true);
    setLoading(true);
    try {
      await processQuery(input);
    } catch (error) {
      console.error("Error:", error);
      toast({ title: "Error", description: "Something went wrong. Try again?", variant: "destructive" });
      addMessage("Oops, something broke. Please rephrase or try again.", false);
    } finally {
      setInput('');
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const processQuery = async (query: string) => {
    const lowerQuery = query.toLowerCase().trim();
    const stringSimilarity = (window as any).stringSimilarity;

    // Handle conversational flow for adding items
    if (conversationState.mode === 'addingItem' && conversationState.waitingFor) {
      await handleAddItemResponse(query);
      return;
    }

    if (lowerQuery === 'help') {
      setShowHelpPanel(true);
      addMessage("Here’s what I can do for you:", false);
      addMessage("• Search items in real-time\n• Check stock and send alerts\n• Browse categories\n• Track user activity and logins\n• View requests (Super Admin)\n• Add items with ease\n• Get summaries and restock advice", false);
      return;
    }

    if (lowerQuery.includes('thank') || lowerQuery.includes('thanks')) {
      addMessage("You're very welcome! What's next?", false);
      return;
    }

    if (lowerQuery.includes('hello') || lowerQuery.includes('hi')) {
      addMessage(`Hi there! It's ${new Date().toLocaleString()}. Ready to manage your inventory?`, false);
      return;
    }

    // Fetch fresh data for every query
    const [fetchedItems, itemsOut, fetchedCategories, fetchedRequests, fetchedAuditLogs] = await Promise.all([
      getItems(),
      getItemsOut(),
      getCategories(),
      getRequests(),
      getAuditLogs()
    ]);
    setItems(fetchedItems);
    setCategories(fetchedCategories);
    setRequests(fetchedRequests);
    setAuditLogs(fetchedAuditLogs);

    if (!fetchedItems || !itemsOut || !fetchedCategories || !fetchedRequests || !fetchedAuditLogs) {
      addMessage("Can't connect to the database right now. Try again soon?", false);
      return;
    }

    // Advanced intent detection with regex
    const intents = {
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
      addMessage("I'm not sure what you want. Try 'show low stock' or 'add item'. Type 'help' for more!", false);
      return;
    }

    // Handle advanced add item (e.g., "add 5 printers to electronics")
    if (detectedIntent === 'addItem') {
      const addMatch = lowerQuery.match(/add\s+(\d+)\s+(.+?)\s+(?:to|in)\s+(.+)/i);
      if (addMatch) {
        const [, qty, name, cat] = addMatch;
        const category = categories.find(c => stringSimilarity.compareTwoStrings(cat.toLowerCase(), c.name.toLowerCase()) > 0.7);
        if (category) {
          await addItem({ name, category_id: category.id, quantity: parseInt(qty), low_stock_threshold: 5 });
          addMessage(`Success: Added ${qty} ${name} to ${category.name}!`, false);
          loadInitialData();
          return;
        }
      }
      setConversationState({ mode: 'addingItem', addItemData: { itemName: entity || '', categoryId: null, quantity: null }, waitingFor: entity ? 'category' : 'itemName' });
      if (!entity) {
        addMessage("What's the name of the item to add?", false);
      } else {
        addMessage(`Adding "${entity}". Select a category or type 'new' for a new one:`, false);
        addMessage("Categories: " + categories.map(c => c.name).join(', '), false, categories.map(cat => ({
          text: cat.name,
          action: () => handleCategorySelection(cat.id)
        })).concat([{ text: "New Category", action: () => handleCategorySelection('new') }]));
      }
      return;
    }

    switch (detectedIntent) {
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
    if (waitingFor === 'itemName') {
      setConversationState(prev => ({ ...prev, addItemData: { ...prev.addItemData, itemName: response }, waitingFor: 'category' }));
      addMessage(`Okay, adding "${response}". Choose a category or type 'new':`, false);
      addMessage("Available: " + categories.map(c => c.name).join(', '), false, categories.map(cat => ({
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
        addMessage("Didn't recognize that category. Try again or select from options.", false);
      }
    } else if (waitingFor === 'newCategoryName') {
      const newCatId = `new-${Date.now()}`; // Placeholder; replace with actual API call
      setConversationState(prev => ({ ...prev, addItemData: { ...prev.addItemData, categoryId: newCatId, newCategoryName: response }, waitingFor: 'quantity' }));
      addMessage(`New category "${response}" created. How many units of ${addItemData?.itemName}?`, false);
    } else if (waitingFor === 'quantity') {
      const quantity = parseInt(response);
      if (isNaN(quantity) || quantity <= 0) {
        addMessage("Please enter a valid positive number for quantity.", false);
        return;
      }
      const finalCatId = addItemData?.categoryId === 'new' ? addItemData.newCategoryName : addItemData?.categoryId;
      await addItem({ name: addItemData?.itemName || '', category_id: finalCatId || null, quantity, low_stock_threshold: 5 });
      addMessage(`Success: Added ${quantity} units of ${addItemData?.itemName} to ${addItemData?.newCategoryName || categories.find(c => c.id === addItemData?.categoryId)?.name || 'inventory'}!`, false);
      setConversationState({ mode: 'normal' });
      loadInitialData();
    }
  };

  const handleCategorySelection = (catId: string) => {
    if (catId === 'new') {
      setConversationState(prev => ({ ...prev, addItemData: { ...prev.addItemData, categoryId: 'new' }, waitingFor: 'newCategoryName' }));
      addMessage("What's the name for the new category?", false);
    } else {
      setConversationState(prev => ({ ...prev, addItemData: { ...prev.addItemData, categoryId: catId }, waitingFor: 'quantity' }));
      addMessage(`Category selected: ${categories.find(c => c.id === catId)?.name}. How many units?`, false);
    }
  };

  const handleStockCheck = (items: Item[], entity: string) => {
    let filteredItems = entity ? items.filter(item => stringSimilarity.compareTwoStrings(entity.toLowerCase(), item.name.toLowerCase()) > 0.6) : items;
    const lowStock = filteredItems.filter(item => item.quantity <= item.low_stock_threshold);
    if (lowStock.length > 0) {
      addMessage(`Low stock items${entity ? ` for "${entity}"` : ''}:`, false);
      addMessage(lowStock.map(item => `• ${item.name}: ${item.quantity} (Threshold: ${item.low_stock_threshold})${item.quantity === 0 ? ' - Out of stock!' : ''}`).join('\n'), false);
      sendLowStockEmail();
    } else {
      addMessage(`All items${entity ? ` for "${entity}"` : ''} are sufficiently stocked.`, false);
    }
  };

  const handleLastLogin = (auditLogs: AuditLog[], entity: string) => {
    const loginLogs = auditLogs.filter(log => log.action === 'login').sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    let filteredLogs = entity ? loginLogs.filter(log => (log.username || log.full_name || '').toLowerCase().includes(entity.toLowerCase())) : loginLogs;
    if (filteredLogs.length > 0) {
      addMessage(`Recent logins${entity ? ` for "${entity}"` : ''}:`, false);
      addMessage(filteredLogs.slice(0, 5).map(log => `• ${log.username || log.full_name || 'Unknown'} at ${new Date(log.timestamp).toLocaleString()}`).join('\n'), false);
    } else {
      addMessage("No login records found.", false);
    }
  };

  const handleRequests = (requests: Request[], entity: string) => {
    if (user?.role !== 'superadmin') {
      addMessage("Access denied: Request view is for Super Admins only.", false);
      return;
    }
    let filteredRequests = entity ? requests.filter(req => req.project_name.toLowerCase().includes(entity.toLowerCase()) || req.status.toLowerCase().includes(entity.toLowerCase())) : requests;
    if (filteredRequests.length > 0) {
      addMessage(`Requests${entity ? ` matching "${entity}"` : ''}:`, false);
      addMessage(filteredRequests.map(req => `• ID ${req.id} (${req.status}): ${req.project_name} by ${req.created_by} on ${new Date(req.created_at).toLocaleString()}`).join('\n'), false);
    } else {
      addMessage("No requests found.", false);
    }
  };

  const handleSearch = (items: Item[], entity: string) => {
    const matchingItems = entity ? items.filter(item => stringSimilarity.compareTwoStrings(entity.toLowerCase(), item.name.toLowerCase()) > 0.6 || stringSimilarity.compareTwoStrings(entity.toLowerCase(), (item.description || '').toLowerCase()) > 0.6) : items.slice(0, 10);
    if (matchingItems.length > 0) {
      addMessage(`Items${entity ? ` matching "${entity}"` : ''}:`, false);
      addMessage(matchingItems.map(item => `• ${item.name}: ${item.quantity} ${item.quantity <= item.low_stock_threshold ? (item.quantity === 0 ? '- Out' : '- Low') : ''}`).join('\n'), false);
    } else {
      addMessage("No matching items found.", false);
    }
  };

  const handleCategory = (items: Item[], categories: any[], entity: string) => {
    if (!entity) {
      addMessage("Categories:", false);
      addMessage(categories.map(cat => `• ${cat.name} (${items.filter(i => i.category_id === cat.id).length} items)`).join('\n'), false);
      return;
    }
    const cat = categories.find(c => stringSimilarity.compareTwoStrings(entity.toLowerCase(), c.name.toLowerCase()) > 0.7);
    if (cat) {
      const catItems = items.filter(item => item.category_id === cat.id);
      addMessage(`Items in ${cat.name}:`, false);
      addMessage(catItems.length > 0 ? catItems.map(item => `• ${item.name}: ${item.quantity} ${item.quantity <= item.low_stock_threshold ? (item.quantity === 0 ? '- Out' : '- Low') : ''}`).join('\n') : "No items in this category.", false);
    } else {
      addMessage(`Category "${entity}" not found. Available categories: ${categories.map(c => c.name).join(', ')}`, false);
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
      addMessage(`User activity${entity ? ` for "${entity}"` : ''}:`, false);
      addMessage(users.slice(0, 5).map(([name, count]) => `• ${name}: ${count} items checked out`).join('\n'), false);
    } else {
      addMessage("No user activity found.", false);
    }
  };

  const handleSummary = (items: Item[], itemsOut: ItemOut[], categories: any[], entity: string) => {
    const total = items.reduce((sum, item) => sum + item.quantity, 0);
    const low = items.filter(item => item.quantity <= item.low_stock_threshold).length;
    const recent = itemsOut.filter(item => new Date(item.date_time) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length;
    addMessage("Inventory Summary (Real-time):", false);
    addMessage(`• Total items: ${total}\n• Unique items: ${items.length}\n• Low stock: ${low}\n• Recent checkouts (week): ${recent}\n• Categories: ${categories.length}`, false);
    if (entity.includes('detail')) {
      const byCat = categories.map(cat => `• ${cat.name}: ${items.filter(i => i.category_id === cat.id).reduce((sum, i) => sum + i.quantity, 0)}`);
      addMessage("Category breakdown:\n" + byCat.join('\n'), false);
    }
  };

  const handleRecommendations = (items: Item[], entity: string) => {
    let critical = items.filter(item => item.quantity <= item.low_stock_threshold);
    if (entity) critical = critical.filter(item => item.name.toLowerCase().includes(entity.toLowerCase()));
    if (critical.length > 0) {
      addMessage("Restock Recommendations:", false);
      addMessage(critical.map(item => `• ${item.name}: Add at least ${item.low_stock_threshold - item.quantity + 5} more`).join('\n'), false);
    } else {
      addMessage("No restocking needed at this time.", false);
    }
  };

  const handleRecentActivity = (itemsOut: ItemOut[], entity: string) => {
    let recent = itemsOut.sort((a, b) => new Date(b.date_time).getTime() - new Date(a.date_time).getTime()).slice(0, 10);
    if (entity) recent = recent.filter(item => item.person_name.toLowerCase().includes(entity.toLowerCase()) || item.item_name.toLowerCase().includes(entity.toLowerCase()));
    if (recent.length > 0) {
      addMessage("Recent Activity:", false);
      addMessage(recent.map(item => `• ${item.person_name} checked out ${item.quantity} ${item.item_name} on ${new Date(item.date_time).toLocaleString()}`).join('\n'), false);
    } else {
      addMessage("No recent activity found.", false);
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
            <Bot className="h-6 w-6 mr-2 text-indigo-600" />
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
            <Card className="bg-indigo-50 border-indigo-200">
              <CardContent className="p-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold text-indigo-800 flex items-center">
                    <Info className="h-4 w-4 mr-1" /> System Status (Real-time)
                  </h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="bg-white p-3 rounded-md shadow-sm border border-indigo-100">
                    <p className="text-sm text-indigo-600">Total Items</p>
                    <p className="text-xl font-bold text-indigo-900">{systemStatus.totalItems}</p>
                  </div>
                  <div className="bg-white p-3 rounded-md shadow-sm border border-indigo-100">
                    <p className="text-sm text-indigo-600">Low Stock</p>
                    <p className={`text-xl font-bold ${systemStatus.lowStockItems > 0 ? 'text-amber-600' : 'text-green-600'}`}>{systemStatus.lowStockItems}</p>
                  </div>
                  <div className="bg-white p-3 rounded-md shadow-sm border border-indigo-100">
                    <p className="text-sm text-indigo-600">Categories</p>
                    <p className="text-xl font-bold text-indigo-900">{systemStatus.categoriesCount}</p>
                  </div>
                  <div className="bg-white p-3 rounded-md shadow-sm border border-indigo-100">
                    <p className="text-sm text-indigo-600">Recent Checkouts</p>
                    <p className="text-xl font-bold text-indigo-900">{systemStatus.recentActivity}</p>
                  </div>
                  <div className="bg-white p-3 rounded-md shadow-sm border border-indigo-100">
                    <p className="text-sm text-indigo-600">Last Login</p>
                    <p className="text-sm text-indigo-900 flex items-center">
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
            <Card className="bg-indigo-50 border-indigo-200 animate-fade-in">
              <CardContent className="p-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold text-indigo-800 flex items-center">
                    <HelpCircle className="h-4 w-4 mr-1" /> Quick Help
                  </h3>
                  <Button variant="ghost" size="icon" onClick={() => setShowHelpPanel(false)}>
                    <X className="h-4 w-4 text-indigo-800" />
                  </Button>
                </div>
                <p className="text-sm text-indigo-700 mb-3">Click to try these commands:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {generateHelpTopics().map((topic, index) => (
                    <Card key={index} className="bg-white border-indigo-100">
                      <CardContent className="p-3">
                        <p className="font-medium text-indigo-800">{topic.topic}</p>
                        <p className="text-xs text-indigo-600 mb-2">{topic.description}</p>
                        <Button variant="outline" className="w-full text-indigo-700 border-indigo-200 hover:bg-indigo-100" onClick={() => insertHelpTopic(topic.command)}>
                          Try: "{topic.command}"
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {messages.map(message => (
            <div key={message.id} className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}>
              <div className="flex items-start space-x-2 max-w-[80%]">
                {!message.isUser && (
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-indigo-100 text-indigo-600">AI</AvatarFallback>
                  </Avatar>
                )}
                <Card className={`${message.isUser ? 'bg-indigo-600 text-white' : 'bg-white border-gray-200'}`}>
                  <CardContent className="p-3">
                    <p className="whitespace-pre-line text-sm">{message.text}</p>
                    {message.options && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {message.options.map((opt, idx) => (
                          <Button key={idx} size="sm" variant={message.isUser ? "secondary" : "outline"} onClick={opt.action}>
                            {opt.text}
                          </Button>
                        ))}
                      </div>
                    )}
                    <p className={`text-xs mt-1 ${message.isUser ? 'text-indigo-200' : 'text-gray-500'}`}>
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </CardContent>
                </Card>
                {message.isUser && (
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-indigo-100 text-indigo-600">U</AvatarFallback>
                  </Avatar>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-center text-gray-500">
              <MessageSquare className="h-4 w-4 mr-2 animate-pulse" />
              <span>Processing...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>
      <footer className="p-4 bg-white border-t border-gray-200">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex items-center space-x-2">
            <Input
              ref={inputRef}
              placeholder="Ask me anything about your inventory..."
              className="flex-1 focus:ring-indigo-500"
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={loading}
            />
            <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={loading || !input.trim()}>
              <Send className="h-4 w-4" />
              <span className="sr-only">Send</span>
            </Button>
          </form>
          <p className="text-xs text-gray-500 mt-2 text-center">Try: "Show low stock" or "Add 10 items to a category"</p>
        </div>
      </footer>
    </div>
  );
};

export default AIAssistant;