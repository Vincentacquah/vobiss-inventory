
import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, MessageSquare, RefreshCw, Search, HelpCircle, X, ChevronDown, ChevronUp } from 'lucide-react';
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
 * Provides an interactive chat interface for querying inventory data
 */
const AIAssistant: React.FC = () => {
  // State management
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showHelpPanel, setShowHelpPanel] = useState(false);
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Sample help topics for the assistant
  const helpTopics = [
    { topic: "Search for items", command: "search for cables" },
    { topic: "Check user activity", command: "user stats" },
    { topic: "Get weekly summary", command: "weekly summary" },
    { topic: "Find low stock items", command: "low stock items" },
    { topic: "Find item by category", command: "items in Electronics" },
  ];

  // Initialize chat with greeting message
  useEffect(() => {
    addMessage("👋 Hello! I'm your inventory assistant. You can ask me about inventory items, user activity, or get summaries. Type 'help' to see what I can do.", false);
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  /**
   * Scrolls the message container to the bottom
   */
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  /**
   * Adds a new message to the chat
   * 
   * @param text Message text content
   * @param isUser Whether the message is from the user
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
   * Processes the user input and generates a response
   */
  const handleSend = async () => {
    if (!input.trim()) return;

    // Add user message
    addMessage(input, true);
    setLoading(true);
    
    try {
      // Special command handling
      if (input.toLowerCase() === 'help') {
        setShowHelpPanel(true);
        addMessage("Here are some things you can ask me about:", false);
        addMessage("• Search for items by typing 'search for [item name]'\n• Check user activity with 'user stats'\n• Get inventory summary with 'weekly summary'\n• Find low stock items with 'low stock items'", false);
      } else {
        // Process normal queries
        await queryInventory(input);
      }
    } catch (error) {
      console.error("Error querying inventory:", error);
      toast({
        title: "Error",
        description: "Failed to get response from AI assistant",
        variant: "destructive"
      });
      addMessage("Sorry, I encountered an error. Please try again.", false);
    } finally {
      setInput('');
      setLoading(false);
    }
  };

  /**
   * Processes inventory queries and generates responses
   * 
   * @param query User query text
   */
  const queryInventory = async (query: string) => {
    // Fetch inventory data
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('*');

    const { data: itemsOut, error: itemsOutError } = await supabase
      .from('items_out')
      .select('person_name, item_id, quantity, date_time, items:item_id(name)');

    if (itemsError || itemsOutError) {
      console.error("Error fetching data:", itemsError, itemsOutError);
      addMessage("Could not retrieve inventory data.", false);
      return;
    }

    if (!items || !itemsOut) {
      addMessage("No inventory data available.", false);
      return;
    }

    // Process the query based on keywords
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes("search for")) {
      await handleSearchQuery(lowerQuery, items);
    } else if (lowerQuery.includes("user stats")) {
      handleUserStatsQuery(itemsOut);
    } else if (lowerQuery.includes("weekly summary")) {
      handleWeeklySummaryQuery(items, itemsOut);
    } else if (lowerQuery.includes("low stock")) {
      handleLowStockQuery(items);
    } else if (lowerQuery.includes("items in")) {
      await handleCategoryQuery(lowerQuery, items);
    } else {
      addMessage("I'm not sure how to help with that query. Try asking me to 'search for [item]', show 'user stats', 'low stock items', or provide a 'weekly summary'.", false);
    }
  };

  /**
   * Handles item search queries
   */
  const handleSearchQuery = async (query: string, items: Item[]) => {
    const itemType = query.split("search for")[1].trim();
    
    if (itemType) {
      const matchingItems = items.filter(item => 
        item.name.toLowerCase().includes(itemType) ||
        (item.description?.toLowerCase() || '').includes(itemType)
      );
      
      if (matchingItems.length > 0) {
        addMessage(`📦 I found ${matchingItems.length} items matching "${itemType}":`, false);
        
        const itemsList = matchingItems.map(item => 
          `• ${item.name} - Quantity: ${item.quantity} ${item.quantity <= item.low_stock_threshold ? '⚠️ LOW STOCK' : ''}`
        ).join('\n');
        
        addMessage(itemsList, false);
      } else {
        addMessage(`No items found matching "${itemType}". Try a different search term.`, false);
      }
    } else {
      addMessage("Please specify what you're looking for, for example 'search for cables'.", false);
    }
  };

  /**
   * Handles user statistics queries
   */
  const handleUserStatsQuery = (itemsOut: ItemOut[]) => {
    const userCounts: { [key: string]: number } = {};
    
    itemsOut.forEach(item => {
      userCounts[item.person_name] = (userCounts[item.person_name] || 0) + item.quantity;
    });

    const sortedUsers = Object.entries(userCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    if (sortedUsers.length > 0) {
      addMessage("👥 Top users by items checked out:", false);
      
      const userList = sortedUsers.map(([user, count], index) => 
        `${index + 1}. ${user}: ${count} items`
      ).join('\n');
      
      addMessage(userList, false);
    } else {
      addMessage("No user activity recorded yet.", false);
    }
  };

  /**
   * Handles weekly summary queries
   */
  const handleWeeklySummaryQuery = (items: Item[], itemsOut: ItemOut[]) => {
    // Calculate total inventory value
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    
    // Find low stock items
    const lowStockItems = items.filter(item => item.quantity <= item.low_stock_threshold).length;
    
    // Calculate items checked out this week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const recentCheckouts = itemsOut.filter(item => 
      new Date(item.date_time) >= oneWeekAgo
    );
    
    const weeklyCheckoutCount = recentCheckouts.reduce((sum, item) => sum + item.quantity, 0);

    // Prepare summary
    addMessage("📊 Weekly Inventory Summary:", false);
    
    const summaryText = [
      `• Total items in stock: ${totalItems}`,
      `• Items checked out this week: ${weeklyCheckoutCount}`,
      `• Low stock alerts: ${lowStockItems}`,
      `• Inventory health: ${lowStockItems > 5 ? '🟠 Needs attention' : '🟢 Good'}`
    ].join('\n');
    
    addMessage(summaryText, false);
  };

  /**
   * Handles low stock queries
   */
  const handleLowStockQuery = (items: Item[]) => {
    const lowStock = items.filter(item => item.quantity <= item.low_stock_threshold);
    
    if (lowStock.length > 0) {
      addMessage(`⚠️ Found ${lowStock.length} items with low stock:`, false);
      
      const itemsList = lowStock.map(item => 
        `• ${item.name} - Current: ${item.quantity}, Threshold: ${item.low_stock_threshold}`
      ).join('\n');
      
      addMessage(itemsList, false);
    } else {
      addMessage("Good news! No items are currently below their low stock threshold.", false);
    }
  };

  /**
   * Handles category search queries
   */
  const handleCategoryQuery = async (query: string, items: Item[]) => {
    const categoryName = query.split("items in")[1].trim();
    
    if (categoryName) {
      // Get category id first
      const { data: categories } = await supabase
        .from('categories')
        .select('*')
        .ilike('name', `%${categoryName}%`);
      
      if (categories && categories.length > 0) {
        // Find items in this category
        const categoryItems = items.filter(item => 
          categories.some(cat => cat.id === item.category_id)
        );
        
        if (categoryItems.length > 0) {
          addMessage(`📂 Found ${categoryItems.length} items in ${categories[0].name} category:`, false);
          
          const itemsList = categoryItems.map(item => 
            `• ${item.name} - Quantity: ${item.quantity}`
          ).join('\n');
          
          addMessage(itemsList, false);
        } else {
          addMessage(`No items found in the ${categories[0].name} category.`, false);
        }
      } else {
        addMessage(`I couldn't find a category named "${categoryName}".`, false);
      }
    } else {
      addMessage("Please specify a category name, for example 'items in Electronics'.", false);
    }
  };

  /**
   * Inserts a help topic in the input field
   */
  const insertHelpTopic = (command: string) => {
    setInput(command);
    setShowHelpPanel(false);
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

      {/* Message Area */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          {/* Help Panel */}
          {showHelpPanel && (
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-4 animate-fade-in">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-blue-800 flex items-center">
                  <HelpCircle className="h-4 w-4 mr-1" />
                  Assistant Help
                </h3>
                <button onClick={() => setShowHelpPanel(false)}>
                  <X className="h-4 w-4 text-blue-800" />
                </button>
              </div>
              <p className="text-sm text-blue-700 mb-2">
                Click on any of these example commands to try them:
              </p>
              <div className="space-y-1">
                {helpTopics.map((topic, index) => (
                  <button 
                    key={index} 
                    className="block w-full text-left p-2 text-sm text-blue-700 hover:bg-blue-100 rounded"
                    onClick={() => insertHelpTopic(topic.command)}
                  >
                    <strong>{topic.topic}:</strong> "{topic.command}"
                  </button>
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
                <span>Processing...</span>
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
              type="text"
              placeholder="Ask me anything about the inventory..."
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
            Type 'help' to see what I can do
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;
