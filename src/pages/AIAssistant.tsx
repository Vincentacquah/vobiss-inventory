import React, { useState, useEffect } from 'react';
import { Send, Bot } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '../integrations/supabase/client';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
}

const AIAssistant: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Initial greeting from the AI
    addMessage("Hello! I'm your inventory assistant. How can I help you today?", false);
  }, []);

  const addMessage = (text: string, isUser: boolean) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      text: text,
      isUser: isUser,
    };
    setMessages(prevMessages => [...prevMessages, newMessage]);
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    addMessage(input, true);
    setLoading(true);

    try {
      await queryInventory(input);
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

  const queryInventory = async (query: string) => {
    // Fetch all items and items_out data
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('*');

    const { data: itemsOut, error: itemsOutError } = await supabase
      .from('items_out')
      .select('person_name, item_id, quantity');

    if (itemsError || itemsOutError) {
      console.error("Error fetching data:", itemsError, itemsOutError);
      addMessage("Could not retrieve inventory data.", false);
      return;
    }

    if (!items || !itemsOut) {
      addMessage("No inventory data available.", false);
      return;
    }

    // Analyze the query
    const lowerQuery = query.toLowerCase();

    // Helper functions for analysis
    const searchByItemType = (itemType: string) => {
      if (itemType) {
        const matchingItems = items.filter(item => 
          item.name.toLowerCase().includes(itemType) ||
          (item.description?.toLowerCase() || '').includes(itemType)
        );
        
        if (matchingItems.length > 0) {
          const itemList = matchingItems.map(item => item.name).join(', ');
          addMessage(`Matching items found: ${itemList}`, false);
        } else {
          addMessage(`No items found matching "${itemType}".`, false);
        }
      } else {
        addMessage("Please specify an item type to search for.", false);
      }
    };

    const getUserStats = () => {
      const userCounts: { [key: string]: number } = {};
      itemsOut.forEach(item => {
        userCounts[item.person_name] = (userCounts[item.person_name] || 0) + item.quantity;
      });

      const sortedUsers = Object.entries(userCounts)
        .sort(([,a], [,b]) => Number(b) - Number(a))
        .slice(0, 5);

      if (sortedUsers.length > 0) {
        const userList = sortedUsers.map(([user, count]) => `${user}: ${count}`).join(', ');
        addMessage(`Top users: ${userList}`, false);
      } else {
        addMessage("No user stats available.", false);
      }
    };

    const getWeeklySummary = () => {
      const itemCounts: { [key: string]: number } = {};
      itemsOut.forEach(item => {
        const itemName = items.find(i => i.id === item.item_id)?.name || 'Unknown';
        itemCounts[itemName] = (itemCounts[itemName] || 0) + item.quantity;
      });

      const mostPopular = Object.entries(itemCounts)
        .sort(([,a], [,b]) => Number(b) - Number(a))[0];

      if (mostPopular) {
        addMessage(`Most popular item: ${mostPopular[0]}`, false);
      } else {
        addMessage("No usage data available.", false);
      }
    };

    // Command processing
    if (lowerQuery.includes("search for")) {
      const itemType = lowerQuery.split("search for")[1].trim();
      searchByItemType(itemType);
    } else if (lowerQuery.includes("user stats")) {
      getUserStats();
    } else if (lowerQuery.includes("weekly summary")) {
      getWeeklySummary();
    } else {
      addMessage("I'm sorry, I don't understand that command.", false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-md p-4">
        <h1 className="text-2xl font-semibold text-gray-800 flex items-center">
          <Bot className="h-6 w-6 mr-2" />
          Inventory Assistant
        </h1>
      </div>

      {/* Message Area */}
      <div className="flex-1 p-4 overflow-y-auto">
        {messages.map(message => (
          <div key={message.id} className={`mb-2 p-3 rounded-lg ${message.isUser ? 'bg-blue-200 text-blue-800 ml-auto' : 'bg-gray-200 text-gray-800 mr-auto'} max-w-md`}>
            {message.text}
          </div>
        ))}
        {loading && <div className="text-gray-600">Loading...</div>}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-gray-300">
        <div className="flex items-center">
          <input
            type="text"
            placeholder="Ask me anything about the inventory..."
            className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyPress={e => e.key === 'Enter' ? handleSend() : null}
          />
          <button
            onClick={handleSend}
            className="ml-2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;
