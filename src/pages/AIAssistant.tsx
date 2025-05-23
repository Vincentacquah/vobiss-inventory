
import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, MessageSquare, RefreshCw, Search, HelpCircle, X, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '../integrations/supabase/client';
import { Button } from "@/components/ui/button";

/**
 * Interface for chat messages
 */
interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
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
  items?: {
    name: string;
  };
}

/**
 * AIAssistant Component
 * Provides an intelligent chat interface for querying inventory data using natural language
 */
const AIAssistant: React.FC = () => {
  // State management
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showHelpPanel, setShowHelpPanel] = useState(false);
  const [systemStatus, setSystemStatus] = useState<{
    totalItems: number;
    lowStockItems: number;
    categoriesCount: number;
    recentActivity: number;
  } | null>(null);
  
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Expanded help topics for the assistant with examples
  const helpTopics = [
    { topic: "Find inventory items", command: "find all cables", description: "Search for items by name or description" },
    { topic: "Check stock levels", command: "what items are low on stock", description: "View items with low inventory" },
    { topic: "Category information", command: "show items in Electronics category", description: "Browse items by category" },
    { topic: "Check user activity", command: "who has checked out the most items", description: "View usage statistics by person" },
    { topic: "Recent activity", command: "show recent activity", description: "Get a summary of recent inventory changes" },
    { topic: "Inventory summary", command: "give me an inventory summary", description: "Get an overview of your inventory status" },
    { topic: "Stock recommendations", command: "what should I restock", description: "Get restocking recommendations" },
  ];

  // Load system status and initialize chat
  useEffect(() => {
    loadSystemStatus();
    addMessage("👋 Hello! I'm your intelligent inventory assistant. I can help you understand your inventory using natural language. Ask me anything about your items, categories, stock levels, or user activity.", false);
    addMessage("For example, try asking: \"What items are running low on stock?\" or \"Show me all items in the Electronics category\"", false);
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  /**
   * Load current system status for context awareness
   */
  const loadSystemStatus = async () => {
    try {
      const [itemsResult, categoriesResult, itemsOutResult] = await Promise.all([
        supabase.from('items').select('*'),
        supabase.from('categories').select('*'),
        supabase.from('items_out').select('*').order('date_time', { ascending: false }).limit(10)
      ]);

      const items = itemsResult.data || [];
      const lowStockItems = items.filter(item => item.quantity <= item.low_stock_threshold);
      
      setSystemStatus({
        totalItems: items.length,
        lowStockItems: lowStockItems.length,
        categoriesCount: (categoriesResult.data || []).length,
        recentActivity: (itemsOutResult.data || []).length
      });
    } catch (error) {
      console.error("Error loading system status:", error);
    }
  };

  /**
   * Scrolls the message container to the bottom
   */
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  /**
   * Adds a new message to the chat
   * 
   * @param {string} text - Message text content
   * @param {boolean} isUser - Whether the message is from the user
   */
  const addMessage = (text: string, isUser: boolean) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      text: text,
      isUser: isUser,
      timestamp: new Date()
    };
    setMessages(prevMessages => [...prevMessages, newMessage]);
  };

  /**
   * Handles sending a new message
   * Processes the user input and generates a response using natural language understanding
   */
  const handleSend = async () => {
    if (!input.trim()) return;

    // Add user message
    addMessage(input, true);
    setLoading(true);
    
    try {
      // Process the query with natural language understanding
      await processNaturalLanguageQuery(input);
    } catch (error) {
      console.error("Error processing query:", error);
      toast({
        title: "Error",
        description: "Failed to process your question. Please try again.",
        variant: "destructive"
      });
      addMessage("Sorry, I encountered an error while processing your question. Please try again or rephrase your question.", false);
    } finally {
      setInput('');
      setLoading(false);
      // Focus back on the input after processing
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  };

  /**
   * Process natural language queries with improved understanding
   * 
   * @param {string} query - The natural language query from the user
   */
  const processNaturalLanguageQuery = async (query: string) => {
    const lowerQuery = query.toLowerCase();
    
    // Special command handling
    if (lowerQuery === 'help') {
      setShowHelpPanel(true);
      addMessage("Here are some ways I can help you manage your inventory:", false);
      addMessage("• Search for items by name or description\n• Check which items are low on stock\n• Find items in specific categories\n• View user activity statistics\n• Get inventory summaries and reports", false);
      return;
    }
    
    if (lowerQuery.includes('thank') || lowerQuery.includes('thanks')) {
      addMessage("You're welcome! Is there anything else I can help you with?", false);
      return;
    }
    
    if (lowerQuery.includes('hello') || lowerQuery.includes('hi ') || lowerQuery === 'hi') {
      addMessage("Hello! How can I assist you with your inventory today?", false);
      return;
    }

    // Fetch necessary data for answering queries
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('*, categories:category_id(name)');

    const { data: itemsOut, error: itemsOutError } = await supabase
      .from('items_out')
      .select('person_name, item_id, quantity, date_time, items:item_id(name)')
      .order('date_time', { ascending: false });

    const { data: categories, error: categoriesError } = await supabase
      .from('categories')
      .select('*');

    if (itemsError || itemsOutError || categoriesError) {
      console.error("Error fetching data:", itemsError, itemsOutError, categoriesError);
      addMessage("I couldn't retrieve the necessary data to answer your question. Please try again later.", false);
      return;
    }

    // Process the natural language query using keyword and intent recognition
    
    // STOCK LEVEL QUERIES
    if (
      lowerQuery.includes('low stock') || 
      lowerQuery.includes('running low') || 
      lowerQuery.includes('low on stock') ||
      lowerQuery.includes('need to restock') ||
      lowerQuery.includes('almost out') ||
      lowerQuery.includes('stock level')
    ) {
      handleLowStockQuery(items);
      return;
    }
    
    // SEARCH QUERIES
    if (
      lowerQuery.includes('find') || 
      lowerQuery.includes('search') || 
      lowerQuery.includes('look for') ||
      lowerQuery.includes('show me') ||
      lowerQuery.includes('where is') ||
      lowerQuery.includes('do we have')
    ) {
      await handleSearchQuery(lowerQuery, items);
      return;
    }
    
    // CATEGORY QUERIES
    if (
      lowerQuery.includes('category') || 
      lowerQuery.includes(' in the ') ||
      lowerQuery.includes(' in ') && (lowerQuery.includes('category') || categories.some(cat => 
        lowerQuery.includes(cat.name.toLowerCase())
      ))
    ) {
      await handleCategoryQuery(lowerQuery, items, categories);
      return;
    }
    
    // USER ACTIVITY QUERIES
    if (
      lowerQuery.includes('user') || 
      lowerQuery.includes('person') ||
      lowerQuery.includes('who') ||
      lowerQuery.includes('checkout') ||
      lowerQuery.includes('checked out') ||
      lowerQuery.includes('borrowed')
    ) {
      handleUserActivityQuery(itemsOut);
      return;
    }
    
    // SUMMARY QUERIES
    if (
      lowerQuery.includes('summary') || 
      lowerQuery.includes('overview') ||
      lowerQuery.includes('report') ||
      lowerQuery.includes('status') ||
      lowerQuery.includes('how is') ||
      lowerQuery.includes('how are') ||
      lowerQuery.includes('tell me about')
    ) {
      handleSummaryQuery(items, itemsOut, categories);
      return;
    }
    
    // RECOMMENDATION QUERIES
    if (
      lowerQuery.includes('recommend') || 
      lowerQuery.includes('suggest') ||
      lowerQuery.includes('should i') ||
      lowerQuery.includes('what to') ||
      lowerQuery.includes('need to buy')
    ) {
      handleRecommendationsQuery(items);
      return;
    }
    
    // RECENT ACTIVITY QUERIES
    if (
      lowerQuery.includes('recent') || 
      lowerQuery.includes('latest') ||
      lowerQuery.includes('last') ||
      lowerQuery.includes('new') ||
      lowerQuery.includes('activity')
    ) {
      handleRecentActivityQuery(itemsOut);
      return;
    }

    // If no specific intent was detected
    addMessage("I'm not sure how to answer that question. You can ask about inventory items, stock levels, categories, user activity, or get summaries and reports. Type 'help' to see more examples.", false);
  };

  /**
   * Handles queries about low stock items
   */
  const handleLowStockQuery = (items: Item[]) => {
    const lowStock = items.filter(item => item.quantity <= item.low_stock_threshold);
    
    if (lowStock.length > 0) {
      addMessage(`⚠️ I found ${lowStock.length} items with low stock:`, false);
      
      // Sort by most critical (lowest quantity relative to threshold)
      const sortedLowStock = [...lowStock].sort((a, b) => {
        const aRatio = a.quantity / a.low_stock_threshold;
        const bRatio = b.quantity / b.low_stock_threshold;
        return aRatio - bRatio;
      });
      
      const itemsList = sortedLowStock.map(item => 
        `• ${item.name} - Current: ${item.quantity}, Threshold: ${item.low_stock_threshold} ${item.quantity === 0 ? '⛔ OUT OF STOCK' : '⚠️ LOW STOCK'}`
      ).join('\n');
      
      addMessage(itemsList, false);
      
      // Add recommendation if items are out of stock
      if (sortedLowStock.some(item => item.quantity === 0)) {
        addMessage("⚠️ Warning: Some items are completely out of stock and need immediate attention.", false);
      }
    } else {
      addMessage("✅ Good news! All items are above their low stock threshold.", false);
    }
  };

  /**
   * Handles search queries for items
   */
  const handleSearchQuery = async (query: string, items: Item[]) => {
    // Extract search terms using various patterns
    let searchTerms: string[] = [];
    
    if (query.includes('find') || query.includes('search')) {
      const afterFind = query.split(/find|search/i)[1].trim();
      const terms = afterFind.split(' ').filter(term => term !== 'for' && term !== 'all' && term !== 'any' && term !== 'the');
      searchTerms = terms;
    } else if (query.includes('show me')) {
      const afterShow = query.split('show me')[1].trim();
      const terms = afterShow.split(' ').filter(term => term !== 'all' && term !== 'any' && term !== 'the');
      searchTerms = terms;
    } else if (query.includes('do we have')) {
      const beforeHave = query.split('do we have')[0].trim().split(' ');
      searchTerms = [beforeHave[beforeHave.length - 1]];
    }
    
    // Filter out common words
    const stopWords = ['a', 'an', 'the', 'in', 'on', 'at', 'by', 'for', 'with', 'about', 'any', 'some'];
    searchTerms = searchTerms.filter(term => !stopWords.includes(term.toLowerCase()));
    
    // Join remaining terms
    const searchTerm = searchTerms.join(' ');
    
    if (searchTerm) {
      const matchingItems = items.filter(item => 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.description?.toLowerCase() || '').includes(searchTerm.toLowerCase())
      );
      
      if (matchingItems.length > 0) {
        addMessage(`📦 I found ${matchingItems.length} items matching "${searchTerm}":`, false);
        
        const itemsList = matchingItems.map(item => {
          const categoryName = item.categories ? item.categories.name : 'Uncategorized';
          const stockStatus = item.quantity <= 0 ? '⛔ OUT OF STOCK' : 
                             item.quantity <= item.low_stock_threshold ? '⚠️ LOW STOCK' : '✅ IN STOCK';
          
          return `• ${item.name} - ${categoryName} - Quantity: ${item.quantity} ${stockStatus}`;
        }).join('\n');
        
        addMessage(itemsList, false);
      } else {
        addMessage(`I couldn't find any items matching "${searchTerm}". Please try a different search term.`, false);
      }
    } else {
      // If no specific search term was found, show all items
      const allItems = items.slice(0, 10); // Limit to 10 items to avoid overwhelming responses
      
      addMessage(`Here are ${allItems.length} items from your inventory${items.length > 10 ? ' (showing first 10)' : ''}:`, false);
      
      const itemsList = allItems.map(item => {
        const categoryName = item.categories ? item.categories.name : 'Uncategorized';
        return `• ${item.name} - ${categoryName} - Quantity: ${item.quantity}`;
      }).join('\n');
      
      addMessage(itemsList, false);
      
      if (items.length > 10) {
        addMessage("Use more specific search terms to narrow down results.", false);
      }
    }
  };

  /**
   * Handles queries about items in specific categories
   */
  const handleCategoryQuery = async (query: string, items: Item[], categories: any[]) => {
    // Try to identify the category from the query
    let categoryName = "";
    
    // Check for "in category" pattern
    if (query.includes(' in category ')) {
      categoryName = query.split(' in category ')[1].trim();
    } 
    // Check for "in the category" pattern
    else if (query.includes(' in the category ')) {
      categoryName = query.split(' in the category ')[1].trim();
    }
    // Check for "in [category name]" pattern
    else if (query.includes(' in ')) {
      const afterIn = query.split(' in ')[1].trim().split(' ')[0];
      categoryName = afterIn.replace(/[^a-zA-Z0-9]/g, ''); // Remove punctuation
    }
    // Direct category mentions
    else {
      for (const category of categories) {
        if (query.toLowerCase().includes(category.name.toLowerCase())) {
          categoryName = category.name;
          break;
        }
      }
    }
    
    if (!categoryName) {
      // If no category was identified, show all categories
      addMessage(`📂 Here are all categories in your inventory:`, false);
      
      const categoriesList = categories.map(category => {
        const categoryItems = items.filter(item => item.category_id === category.id);
        return `• ${category.name}: ${categoryItems.length} items`;
      }).join('\n');
      
      addMessage(categoriesList, false);
      addMessage("You can ask for items in a specific category by saying 'Show items in Electronics' for example.", false);
      return;
    }
    
    // Find matching categories (partial match)
    const matchingCategories = categories.filter(category => 
      category.name.toLowerCase().includes(categoryName.toLowerCase())
    );
    
    if (matchingCategories.length > 0) {
      const category = matchingCategories[0]; // Use the first match
      
      // Find items in this category
      const categoryItems = items.filter(item => item.category_id === category.id);
      
      if (categoryItems.length > 0) {
        addMessage(`📂 Found ${categoryItems.length} items in ${category.name} category:`, false);
        
        const itemsList = categoryItems.map(item => {
          const stockStatus = item.quantity <= 0 ? '⛔ OUT OF STOCK' : 
                             item.quantity <= item.low_stock_threshold ? '⚠️ LOW STOCK' : '✅';
          return `• ${item.name} - Quantity: ${item.quantity} ${stockStatus}`;
        }).join('\n');
        
        addMessage(itemsList, false);
      } else {
        addMessage(`The ${category.name} category exists but doesn't have any items yet.`, false);
      }
    } else {
      addMessage(`I couldn't find a category matching "${categoryName}". Here are the available categories:`, false);
      
      const categoriesList = categories.slice(0, 10).map(category => `• ${category.name}`).join('\n');
      addMessage(categoriesList, false);
    }
  };

  /**
   * Handles queries about user activity
   */
  const handleUserActivityQuery = (itemsOut: ItemOut[]) => {
    if (itemsOut.length === 0) {
      addMessage("There's no recorded user activity yet.", false);
      return;
    }
    
    // Aggregate user activity
    const userCounts: { [key: string]: number } = {};
    const userItems: { [key: string]: Set<string> } = {};
    
    itemsOut.forEach(item => {
      userCounts[item.person_name] = (userCounts[item.person_name] || 0) + item.quantity;
      
      if (!userItems[item.person_name]) {
        userItems[item.person_name] = new Set();
      }
      if (item.items?.name) {
        userItems[item.person_name].add(item.items.name);
      }
    });

    const sortedUsers = Object.entries(userCounts)
      .sort(([, a], [, b]) => b - a);

    addMessage("👥 Here's the user activity information:", false);
    
    const userList = sortedUsers.map(([user, count], index) => {
      const uniqueItems = userItems[user]?.size || 0;
      return `${index + 1}. ${user}: ${count} items (${uniqueItems} unique types)`;
    }).join('\n');
    
    addMessage(userList, false);
    
    // Add recent activity for the top user
    if (sortedUsers.length > 0) {
      const topUser = sortedUsers[0][0];
      const recentActivity = itemsOut
        .filter(item => item.person_name === topUser)
        .slice(0, 3);
      
      if (recentActivity.length > 0) {
        const recentItems = recentActivity.map(item => 
          `• ${item.items?.name || 'Unknown item'} (${item.quantity})`
        ).join('\n');
        
        addMessage(`\nRecent activity for ${topUser}:\n${recentItems}`, false);
      }
    }
  };

  /**
   * Handles queries about inventory summary
   */
  const handleSummaryQuery = (items: Item[], itemsOut: ItemOut[], categories: any[]) => {
    // Calculate total inventory value
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const uniqueItems = items.length;
    
    // Find low stock items
    const lowStockItems = items.filter(item => item.quantity <= item.low_stock_threshold);
    const outOfStockItems = items.filter(item => item.quantity <= 0);
    
    // Calculate items checked out recently (last 7 days)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const recentCheckouts = itemsOut.filter(item => 
      new Date(item.date_time) >= oneWeekAgo
    );
    
    const weeklyCheckoutCount = recentCheckouts.reduce((sum, item) => sum + item.quantity, 0);

    // Calculate category distribution
    const categoryDistribution = {};
    categories.forEach(category => {
      const categoryItems = items.filter(item => item.category_id === category.id);
      const categoryQuantity = categoryItems.reduce((sum, item) => sum + item.quantity, 0);
      categoryDistribution[category.name] = categoryQuantity;
    });

    // Prepare summary
    addMessage("📊 Inventory Summary:", false);
    
    const summaryText = [
      `• Total inventory: ${totalItems} items across ${uniqueItems} unique products`,
      `• Categories: ${categories.length} categories`,
      `• Low stock alerts: ${lowStockItems.length} items need attention`,
      `• Out of stock: ${outOfStockItems.length} items`,
      `• Recent activity: ${weeklyCheckoutCount} items checked out in the last 7 days`,
      `• Inventory health: ${lowStockItems.length > uniqueItems * 0.2 ? '🟠 Needs attention' : '🟢 Good'}`
    ].join('\n');
    
    addMessage(summaryText, false);
    
    // Add top categories if available
    if (categories.length > 0) {
      const sortedCategories = Object.entries(categoryDistribution)
        .sort(([, a], [, b]) => Number(b) - Number(a))
        .slice(0, 3);
      
      if (sortedCategories.length > 0) {
        const topCategories = sortedCategories.map(([name, count]) => 
          `• ${name}: ${count} items`
        ).join('\n');
        
        addMessage(`\nTop categories by item count:\n${topCategories}`, false);
      }
    }
  };

  /**
   * Handles queries about inventory recommendations
   */
  const handleRecommendationsQuery = (items: Item[]) => {
    // Find critical items (out of stock or very low)
    const criticalItems = items.filter(item => 
      item.quantity === 0 || (item.quantity <= item.low_stock_threshold * 0.5)
    ).sort((a, b) => a.quantity - b.quantity);
    
    // Find items that need attention soon (approaching low stock)
    const warningItems = items.filter(item => 
      item.quantity > item.low_stock_threshold * 0.5 && 
      item.quantity <= item.low_stock_threshold
    );
    
    addMessage("🛒 Restocking Recommendations:", false);
    
    if (criticalItems.length > 0) {
      const criticalList = criticalItems.map(item => 
        `• ${item.name} - Current: ${item.quantity}, Threshold: ${item.low_stock_threshold} ${item.quantity === 0 ? '⛔ URGENT' : '⚠️ CRITICAL'}`
      ).join('\n');
      
      addMessage(`Items needing immediate restocking:\n${criticalList}`, false);
    } else {
      addMessage("No critical items need immediate attention.", false);
    }
    
    if (warningItems.length > 0) {
      const warningList = warningItems.map(item => 
        `• ${item.name} - Current: ${item.quantity}, Threshold: ${item.low_stock_threshold}`
      ).join('\n');
      
      addMessage(`\nItems to watch and restock soon:\n${warningList}`, false);
    }
    
    // Overall recommendation
    if (criticalItems.length === 0 && warningItems.length === 0) {
      addMessage("Your inventory is healthy! No items currently need restocking.", false);
    } else if (criticalItems.length > 0) {
      addMessage("\nRecommendation: Focus on restocking the critical items first, especially those that are completely out of stock.", false);
    }
  };

  /**
   * Handles queries about recent activity
   */
  const handleRecentActivityQuery = (itemsOut: ItemOut[]) => {
    if (itemsOut.length === 0) {
      addMessage("There's no recorded activity yet.", false);
      return;
    }
    
    // Get recent checkouts (limited to 10)
    const recentActivity = itemsOut.slice(0, 10);
    
    addMessage("📋 Recent Activity:", false);
    
    const activityList = recentActivity.map(item => {
      const date = new Date(item.date_time);
      const formattedDate = date.toLocaleDateString();
      return `• ${formattedDate}: ${item.person_name} checked out ${item.quantity} ${item.items?.name || 'Unknown item'}`;
    }).join('\n');
    
    addMessage(activityList, false);
    
    // Summarize by user
    const userCounts = {};
    recentActivity.forEach(item => {
      userCounts[item.person_name] = (userCounts[item.person_name] || 0) + item.quantity;
    });
    
    const topUsers = Object.entries(userCounts)
      .sort(([, a], [, b]) => Number(b) - Number(a))
      .slice(0, 3);
    
    if (topUsers.length > 0) {
      const userSummary = topUsers.map(([name, count]) => 
        `• ${name}: ${count} items`
      ).join('\n');
      
      addMessage(`\nMost active users recently:\n${userSummary}`, false);
    }
  };

  /**
   * Inserts a help topic in the input field
   */
  const insertHelpTopic = (command: string) => {
    setInput(command);
    setShowHelpPanel(false);
    // Focus on input
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-md p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-800 flex items-center">
            <Bot className="h-6 w-6 mr-2 text-blue-600" />
            Inventory Assistant
          </h1>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowHelpPanel(!showHelpPanel)}
              className="flex items-center"
            >
              <HelpCircle className="h-4 w-4 mr-1" />
              Help
            </Button>
          </div>
        </div>
      </div>

      {/* Message Area */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          {/* System Status Panel */}
          {systemStatus && (
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-blue-800 flex items-center">
                  <Info className="h-4 w-4 mr-1" />
                  System Status
                </h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white p-3 rounded border border-blue-100">
                  <div className="text-sm text-blue-700">Total Items</div>
                  <div className="text-xl font-semibold text-blue-900">{systemStatus.totalItems}</div>
                </div>
                <div className="bg-white p-3 rounded border border-blue-100">
                  <div className="text-sm text-blue-700">Low Stock</div>
                  <div className={`text-xl font-semibold ${systemStatus.lowStockItems > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                    {systemStatus.lowStockItems}
                  </div>
                </div>
                <div className="bg-white p-3 rounded border border-blue-100">
                  <div className="text-sm text-blue-700">Categories</div>
                  <div className="text-xl font-semibold text-blue-900">{systemStatus.categoriesCount}</div>
                </div>
                <div className="bg-white p-3 rounded border border-blue-100">
                  <div className="text-sm text-blue-700">Recent Activity</div>
                  <div className="text-xl font-semibold text-blue-900">{systemStatus.recentActivity}</div>
                </div>
              </div>
            </div>
          )}
          
          {/* Help Panel */}
          {showHelpPanel && (
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-4 animate-fade-in">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-blue-800 flex items-center">
                  <HelpCircle className="h-4 w-4 mr-1" />
                  Assistant Help
                </h3>
                <button onClick={() => setShowHelpPanel(false)} aria-label="Close help panel">
                  <X className="h-4 w-4 text-blue-800" />
                </button>
              </div>
              <p className="text-sm text-blue-700 mb-2">
                I can understand natural language. Click on any example question to try it:
              </p>
              <div className="space-y-1">
                {helpTopics.map((topic, index) => (
                  <div key={index} className="bg-white rounded-lg border border-blue-100 p-3">
                    <div className="text-sm font-medium text-blue-800">{topic.topic}</div>
                    <div className="text-xs text-blue-600 mb-2">{topic.description}</div>
                    <button 
                      className="text-sm text-left p-2 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded w-full"
                      onClick={() => insertHelpTopic(topic.command)}
                    >
                      "{topic.command}"
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Messages */}
          {messages.map(message => (
            <div 
              key={message.id} 
              className={`mb-4 ${message.isUser ? 'flex justify-end' : 'flex justify-start'}`}
            >
              <div 
                className={`p-3 rounded-lg max-w-md ${
                  message.isUser 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-white border border-gray-200 text-gray-800'
                }`}
              >
                <div className="whitespace-pre-line">{message.text}</div>
                <div 
                  className={`text-xs mt-1 ${
                    message.isUser ? 'text-blue-200' : 'text-gray-500'
                  }`}
                >
                  {message.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </div>
              </div>
            </div>
          ))}
          
          {/* Loading indicator */}
          {loading && (
            <div className="flex items-center text-gray-600 mb-4">
              <div className="flex items-center space-x-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Processing your question...</span>
              </div>
            </div>
          )}
          
          {/* Auto-scroll anchor */}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-gray-200">
        <div className="max-w-4xl mx-auto">
          <form 
            className="flex items-center" 
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
          >
            <input
              ref={inputRef}
              type="text"
              placeholder="Ask anything about your inventory..."
              className="flex-1 p-3 border rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={loading}
            />
            <Button
              type="submit"
              className="rounded-r-lg bg-blue-600 hover:bg-blue-700 text-white p-3 h-full"
              disabled={loading || !input.trim()}
            >
              <Send className={`h-5 w-5 ${loading ? 'opacity-50' : ''}`} />
              <span className="sr-only">Send</span>
            </Button>
          </form>
          <div className="text-xs text-gray-500 mt-2 text-center">
            Try asking "What items are low on stock?" or "Show me items in Electronics"
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;
