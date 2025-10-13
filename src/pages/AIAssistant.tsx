import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, MessageSquare, HelpCircle, X, Info } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { getItems, getCategories, getItemsOut, addItem } from '../api';
import { Button } from "@/components/ui/button";

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
 * AIAssistant Component
 * Provides a conversational chat interface with item addition and natural language processing
 */
const AIAssistant: React.FC = () => {
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
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [addItemState, setAddItemState] = useState<{ step: number; itemName: string; categoryId: string | null; quantity: number | null }>({ step: 0, itemName: '', categoryId: null, quantity: null });

  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const helpTopics = [
    { topic: "Find items", command: "find cables", description: "Search by name or description" },
    { topic: "Check stock", command: "are items low", description: "See low inventory" },
    { topic: "Category details", command: "items in Electronics", description: "Browse by category" },
    { topic: "User activity", command: "who checked items", description: "View usage stats" },
    { topic: "Recent changes", command: "latest activity", description: "See recent updates" },
    { topic: "Inventory overview", command: "inventory status", description: "Get a report" },
    { topic: "Add item", command: "add Printer", description: "Add a new item to inventory" },
    { topic: "Restock suggestions", command: "suggest restock", description: "Get restocking advice" },
  ];

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadInitialData = async () => {
    try {
      const [fetchedItems, fetchedCategories, itemsOut] = await Promise.all([getItems(), getCategories(), getItemsOut()]);
      const lowStockItems = fetchedItems.filter(item => item.quantity <= item.low_stock_threshold);
      setItems(fetchedItems);
      setCategories(fetchedCategories);
      setSystemStatus({
        totalItems: fetchedItems.length,
        lowStockItems: lowStockItems.length,
        categoriesCount: fetchedCategories.length,
        recentActivity: itemsOut.length,
      });
      addMessage("👋 Hey there! I’m your friendly inventory AI. What can I help you with today?", false);
      addMessage("Try: 'Are items low?' or 'Add a new item'", false);
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const addMessage = (text: string, isUser: boolean, options?: { text: string; action: () => void }[]) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      text: text,
      isUser: isUser,
      timestamp: new Date(),
      options,
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    addMessage(input, true);
    setLoading(true);
    try {
      await processQuery(input);
    } catch (error) {
      console.error("Error:", error);
      toast({ title: "Oops!", description: "Something went wrong. Let’s try that again?", variant: "destructive" });
      addMessage("Whoops, I stumbled! Please try again or rephrase.", false);
    } finally {
      setInput('');
      setLoading(false);
      if (inputRef.current) inputRef.current.focus();
    }
  };

  const processQuery = async (query: string) => {
    const lowerQuery = query.toLowerCase().trim();
    const stringSimilarity = (window as any).stringSimilarity;

    if (lowerQuery === 'help') {
      setShowHelpPanel(true);
      addMessage("I’m here to assist! You can:", false);
      addMessage("• Search items\n• Check stock\n• Explore categories\n• View activity\n• Add items\n• Get summaries\n• Suggest restocks", false);
      return;
    }

    if (lowerQuery.includes('thank') || lowerQuery.includes('thanks')) {
      addMessage("You’re welcome! Anything else on your mind?", false);
      return;
    }

    if (lowerQuery.includes('hello') || lowerQuery.includes('hi')) {
      addMessage(`Hi! It’s 11:09 AM on June 10, 2025. How can I help your inventory today?`, false);
      return;
    }

    const [fetchedItems, itemsOut, fetchedCategories] = await Promise.all([getItems(), getItemsOut(), getCategories()]);
    if (!fetchedItems || !itemsOut || !fetchedCategories) {
      addMessage("Hmm, I can’t reach the inventory data right now. Let’s try again later?", false);
      return;
    }

    const intents = {
      stockCheck: { keywords: ['low', 'stock', 'level', 'restock', 'out', 'quantity', 'available'], weight: 1.0 },
      search: { keywords: ['find', 'search', 'show', 'look', 'where', 'have'], weight: 0.9 },
      category: { keywords: ['category', 'in', 'categories', 'section'], weight: 0.8 },
      userActivity: { keywords: ['user', 'person', 'who', 'checked', 'borrowed', 'activity'], weight: 0.7 },
      summary: { keywords: ['summary', 'overview', 'report', 'status', 'how', 'total'], weight: 0.6 },
      recommendation: { keywords: ['recommend', 'suggest', 'buy', 'restock'], weight: 0.5 },
      recentActivity: { keywords: ['recent', 'latest', 'last', 'new'], weight: 0.4 },
      addItem: { keywords: ['add', 'create', 'new'], weight: 0.3 },
    };

    let detectedIntent = null;
    let maxScore = 0;
    let entity = '';

    for (const [intent, { keywords, weight }] of Object.entries(intents)) {
      const words = lowerQuery.split(' ');
      let score = 0;
      words.forEach(word => {
        const bestMatch = stringSimilarity.findBestMatch(word, keywords).bestMatch;
        if (bestMatch.rating > 0.5) score += bestMatch.rating * weight;
      });
      if (score > maxScore) {
        maxScore = score;
        detectedIntent = intent;
        const intentIndex = words.findIndex(w => keywords.some(k => stringSimilarity.compareTwoStrings(w, k) > 0.5));
        if (intentIndex !== -1) {
          entity = words.slice(intentIndex + 1).join(' ').replace(/[^a-zA-Z0-9\s]/g, '').trim();
          if (entity) {
            const itemMatches = fetchedItems.map(item => ({ name: item.name, score: stringSimilarity.compareTwoStrings(entity, item.name) }));
            const catMatches = fetchedCategories.map(cat => ({ name: cat.name, score: stringSimilarity.compareTwoStrings(entity, cat.name) }));
            const bestItem = itemMatches.reduce((max, curr) => max.score > curr.score ? max : curr, { name: '', score: 0 });
            const bestCat = catMatches.reduce((max, curr) => max.score > curr.score ? max : curr, { name: '', score: 0 });
            entity = bestItem.score > 0.7 ? bestItem.name : (bestCat.score > 0.7 ? bestCat.name : entity);
          }
        }
      }
    }

    if (!detectedIntent || maxScore < 0.3) {
      addMessage("I’m a bit confused. Maybe try 'low stock' or 'add item'? Type 'help' for ideas!", false);
      return;
    }

    if (detectedIntent === 'addItem' && entity) {
      setAddItemState({ step: 1, itemName: entity, categoryId: null, quantity: null });
      addMessage(`Great! Let’s add ${entity}. Choose a category:`, false, categories.map(cat => ({
        text: cat.name,
        action: () => setAddItemState(prev => ({ ...prev, categoryId: cat.id, step: 2 }))
      })).concat([{ text: "Create New Category", action: () => setAddItemState(prev => ({ ...prev, step: 2, categoryId: 'new' })) }]));
      return;
    }

    switch (detectedIntent) {
      case 'stockCheck': handleStockCheck(fetchedItems, entity); break;
      case 'search': await handleSearch(fetchedItems, entity); break;
      case 'category': await handleCategory(fetchedItems, fetchedCategories, entity); break;
      case 'userActivity': handleUserActivity(itemsOut, entity); break;
      case 'summary': handleSummary(fetchedItems, itemsOut, fetchedCategories, entity); break;
      case 'recommendation': handleRecommendations(fetchedItems, entity); break;
      case 'recentActivity': handleRecentActivity(itemsOut, entity); break;
    }

    if (addItemState.step > 0) {
      if (addItemState.step === 2) {
        if (addItemState.categoryId === 'new') {
          addMessage(`Enter a new category name for ${addItemState.itemName}:`, false, [{
            text: "Submit",
            action: () => {
              const newCatName = prompt("Category name?");
              if (newCatName) {
                // Assume backend creates category (simplified)
                setAddItemState(prev => ({ ...prev, step: 3 }));
                addMessage(`Category ${newCatName} created! Now, set quantity for ${addItemState.itemName}:`, false);
              }
            }
          }]);
        } else {
          addMessage(`Category selected! Set quantity for ${addItemState.itemName}:`, false);
          setAddItemState(prev => ({ ...prev, step: 3 }));
        }
      } else if (addItemState.step === 3) {
        const quantity = parseInt(prompt("Quantity?") || "0");
        if (quantity > 0) {
          await addItem({ name: addItemState.itemName, category_id: addItemState.categoryId, quantity, low_stock_threshold: 5 });
          addMessage(`✅ Added ${addItemState.itemName} with ${quantity} units to ${categories.find(c => c.id === addItemState.categoryId)?.name || 'new category'}!`, false);
          setAddItemState({ step: 0, itemName: '', categoryId: null, quantity: null });
          loadInitialData();
        } else {
          addMessage("Please enter a valid quantity greater than 0.", false);
        }
      }
    }
  };

  const handleStockCheck = (items: Item[], entity: string) => {
    let filteredItems = items;
    if (entity) filteredItems = items.filter(item => item.name.toLowerCase().includes(entity.toLowerCase()));
    const lowStock = filteredItems.filter(item => item.quantity <= item.low_stock_threshold);
    if (lowStock.length > 0) {
      addMessage(`⚠️ ${entity ? `Stock check for ${entity}:` : 'Low stock alert:'}`, false);
      addMessage(lowStock.map(item => `• ${item.name}: ${item.quantity} (Threshold: ${item.low_stock_threshold}) ${item.quantity === 0 ? '⛔ OUT!' : '⚠️ Low'}`).join('\n'), false);
      if (lowStock.some(item => item.quantity === 0)) addMessage("Yikes, some items are out! Let’s restock soon?", false);
    } else {
      addMessage(entity ? `✅ ${entity} looks good—plenty in stock!` : "✅ Everything’s well stocked—nice job!", false);
    }
  };

  const handleSearch = async (items: Item[], entity: string) => {
    let matchingItems = entity ? items.filter(item => item.name.toLowerCase().includes(entity.toLowerCase()) || (item.description?.toLowerCase() || '').includes(entity.toLowerCase())) : items.slice(0, 10);
    if (matchingItems.length > 0) {
      addMessage(`📦 ${entity ? `Found these for ${entity}:` : 'Here’s a peek at your inventory:'}`, false);
      addMessage(matchingItems.map(item => `• ${item.name}: ${item.quantity} ${item.quantity <= item.low_stock_threshold ? (item.quantity === 0 ? '⛔ OUT' : '⚠️ LOW') : '✅ OK'}`).join('\n'), false);
      if (!entity && items.length > 10) addMessage("Want to narrow it down? Try an item name!", false);
    } else {
      addMessage(entity ? `Hmm, no ${entity} here. Try another name?` : "No items to show—time to add some!", false);
    }
  };

  const handleCategory = async (items: Item[], categories: any[], entity: string) => {
    if (!entity) {
      addMessage("📂 Here are your categories:", false);
      addMessage(categories.map(cat => `• ${cat.name} (${items.filter(i => i.category_id === cat.id).length} items)`).join('\n'), false);
      addMessage("Pick one like 'Electronics' to see inside!", false);
      return;
    }
    const cat = categories.find(c => c.name.toLowerCase().includes(entity.toLowerCase()));
    if (cat) {
      const catItems = items.filter(item => item.category_id === cat.id);
      if (catItems.length > 0) {
        addMessage(`📂 Inside ${cat.name}:`, false);
        addMessage(catItems.map(item => `• ${item.name}: ${item.quantity} ${item.quantity <= item.low_stock_threshold ? (item.quantity === 0 ? '⛔ OUT' : '⚠️ LOW') : '✅ OK'}`).join('\n'), false);
      } else {
        addMessage(`Looks like ${cat.name} is empty. Want to add something?`, false);
      }
    } else {
      addMessage(`No ${entity} category found. Try these:`, false);
      addMessage(categories.slice(0, 5).map(cat => `• ${cat.name}`).join('\n'), false);
    }
  };

  const handleUserActivity = (itemsOut: ItemOut[], entity: string) => {
    if (itemsOut.length === 0) {
      addMessage("No one’s touched the inventory yet—quiet day!", false);
      return;
    }
    const activity = itemsOut.reduce((acc, item) => {
      acc[item.person_name] = (acc[item.person_name] || 0) + item.quantity;
      return acc;
    }, {} as { [key: string]: number });
    let users = Object.entries(activity).sort(([, a], [, b]) => b - a);
    if (entity) users = users.filter(([name]) => name.toLowerCase().includes(entity.toLowerCase()));
    if (users.length > 0) {
      addMessage(`👥 ${entity ? `Activity for ${entity}:` : 'Who’s been busy?'}`, false);
      addMessage(users.slice(0, 5).map(([name, count], i) => `${i + 1}. ${name}: ${count} items`).join('\n'), false);
    } else {
      addMessage(entity ? `No ${entity} has been active.` : "No user data to share.", false);
    }
  };

  const handleSummary = (items: Item[], itemsOut: ItemOut[], categories: any[], entity: string) => {
    const total = items.reduce((sum, item) => sum + item.quantity, 0);
    const low = items.filter(item => item.quantity <= item.low_stock_threshold).length;
    const recent = itemsOut.filter(item => new Date(item.date_time) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).reduce((sum, item) => sum + item.quantity, 0);
    addMessage("📊 Inventory Snapshot (11:09 AM, June 10, 2025):", false);
    addMessage([
      `• Total stock: ${total} items`,
      `• Unique products: ${items.length}`,
      `• Low stock: ${low} items`,
      `• Checkouts (last week): ${recent}`,
      `• Categories: ${categories.length}`
    ].join('\n'), false);
    if (entity === 'detailed') {
      const byCat = categories.map(cat => [cat.name, items.filter(i => i.category_id === cat.id).reduce((sum, i) => sum + i.quantity, 0)]);
      const top3 = byCat.sort(([, a], [, b]) => b - a).slice(0, 3);
      addMessage("\nTop categories by stock:", false);
      addMessage(top3.map(([name, count]) => `• ${name}: ${count}`).join('\n'), false);
    }
  };

  const handleRecommendations = (items: Item[], entity: string) => {
    let critical = items.filter(item => item.quantity === 0 || item.quantity <= item.low_stock_threshold * 0.5);
    if (entity) critical = critical.filter(item => item.name.toLowerCase().includes(entity.toLowerCase()));
    if (critical.length > 0) {
      addMessage("🛒 Restock Ideas:", false);
      addMessage(critical.map(item => `• ${item.name}: ${item.quantity} (Threshold: ${item.low_stock_threshold}) ${item.quantity === 0 ? '⛔ URGENT!' : '⚠️ Soon'}`).join('\n'), false);
      addMessage("Let’s get these topped up soon, okay?", false);
    } else {
      addMessage("✅ Your stock’s in great shape—no restocks needed yet!", false);
    }
  };

  const handleRecentActivity = (itemsOut: ItemOut[], entity: string) => {
    let recent = itemsOut.slice(-10);
    if (entity) recent = recent.filter(item => item.person_name.toLowerCase().includes(entity.toLowerCase()) || item.item_name.toLowerCase().includes(entity.toLowerCase()));
    if (recent.length > 0) {
      addMessage("📋 What’s been happening lately:", false);
      addMessage(recent.map(item => `• ${new Date(item.date_time).toLocaleDateString()}: ${item.person_name} took ${item.quantity} ${item.item_name}`).join('\n'), false);
    } else {
      addMessage("Nothing new to report—pretty calm here!", false);
    }
  };

  const insertHelpTopic = (command: string) => {
    setInput(command);
    setShowHelpPanel(false);
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <div className="bg-white shadow-md p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-800 flex items-center">
            <Bot className="h-6 w-6 mr-2 text-blue-600" />
            AI Inventory Buddy
          </h1>
          <Button variant="outline" size="sm" onClick={() => setShowHelpPanel(!showHelpPanel)} className="flex items-center">
            <HelpCircle className="h-4 w-4 mr-1" /> Help
          </Button>
        </div>
      </div>
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          {systemStatus && (
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-blue-800 flex items-center">
                  <Info className="h-4 w-4 mr-1" /> Status
                </h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white p-3 rounded border border-blue-100">
                  <div className="text-sm text-blue-700">Items</div>
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
                  <div className="text-sm text-blue-700">Recent</div>
                  <div className="text-xl font-semibold text-blue-900">{systemStatus.recentActivity}</div>
                </div>
              </div>
            </div>
          )}
          {showHelpPanel && (
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-4 animate-fade-in">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-blue-800 flex items-center">
                  <HelpCircle className="h-4 w-4 mr-1" /> Help
                </h3>
                <button onClick={() => setShowHelpPanel(false)} aria-label="Close">
                  <X className="h-4 w-4 text-blue-800" />
                </button>
              </div>
              <p className="text-sm text-blue-700 mb-2">Click to try these:</p>
              <div className="space-y-1">
                {helpTopics.map((topic, index) => (
                  <div key={index} className="bg-white rounded-lg border border-blue-100 p-3">
                    <div className="text-sm font-medium text-blue-800">{topic.topic}</div>
                    <div className="text-xs text-blue-600 mb-2">{topic.description}</div>
                    <button className="text-sm p-2 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded w-full" onClick={() => insertHelpTopic(topic.command)}>
                      "{topic.command}"
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {messages.map(message => (
            <div key={message.id} className={`mb-4 ${message.isUser ? 'flex justify-end' : 'flex justify-start'}`}>
              <div className={`p-3 rounded-lg max-w-md ${message.isUser ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-800'}`}>
                <div className="whitespace-pre-line">{message.text}</div>
                {message.options && (
                  <div className="mt-2 space-x-2">
                    {message.options.map((opt, idx) => (
                      <Button key={idx} size="sm" onClick={opt.action} className="bg-blue-500 text-white hover:bg-blue-600">
                        {opt.text}
                      </Button>
                    ))}
                  </div>
                )}
                <div className={`text-xs mt-1 ${message.isUser ? 'text-blue-200' : 'text-gray-500'}`}>
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-center text-gray-600 mb-4">
              <div className="flex items-center space-x-2">
                <MessageSquare className="h-4 w-4 animate-pulse" />
                <span>Thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
      <div className="p-4 bg-white border-t border-gray-200">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex items-center">
            <input
              ref={inputRef}
              type="text"
              placeholder="Chat with me..."
              className="flex-1 p-3 border rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={loading}
            />
            <Button type="submit" className="rounded-r-lg bg-blue-600 hover:bg-blue-700 text-white p-3" disabled={loading || !input.trim()}>
              <Send className={`h-5 w-5 ${loading ? 'opacity-50' : ''}`} />
              <span className="sr-only">Send</span>
            </Button>
          </form>
          <div className="text-xs text-gray-500 mt-2 text-center">E.g., "Low stock?" or "Add Printer"</div>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;