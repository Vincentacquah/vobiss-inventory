
import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User } from 'lucide-react';
import * as api from '../api';

const AIAssistant = () => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'bot',
      content: "Hello! I'm your inventory assistant. I can help you with questions about your stock, usage patterns, and provide insights. Try asking me something like 'How many cables are left?' or 'Who took the most items this week?'"
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const analyzeQuestion = async (question) => {
    const lowercaseQ = question.toLowerCase();
    
    try {
      // Get data
      const [items, itemsOut, categories] = await Promise.all([
        api.getItems(),
        api.getItemsOut(),
        api.getCategories()
      ]);

      // Stock quantity questions
      if (lowercaseQ.includes('how many') && (lowercaseQ.includes('left') || lowercaseQ.includes('stock'))) {
        const itemType = extractItemType(lowercaseQ);
        if (itemType) {
          const matchingItems = items.filter(item => 
            item.name.toLowerCase().includes(itemType) ||
            item.description?.toLowerCase().includes(itemType)
          );
          
          if (matchingItems.length > 0) {
            const totalStock = matchingItems.reduce((sum, item) => sum + item.quantity, 0);
            return `I found ${matchingItems.length} items matching "${itemType}". Total stock: ${totalStock} units.\n\nBreakdown:\n${matchingItems.map(item => `• ${item.name}: ${item.quantity} units`).join('\n')}`;
          }
        }
        
        const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
        return `Total inventory: ${totalItems} units across ${items.length} different items.`;
      }

      // Who took most items
      if (lowercaseQ.includes('who took') && lowercaseQ.includes('most')) {
        const timeframe = extractTimeframe(lowercaseQ);
        const filteredItems = filterByTimeframe(itemsOut, timeframe);
        
        const userCounts = {};
        filteredItems.forEach(item => {
          userCounts[item.personName] = (userCounts[item.personName] || 0) + item.quantity;
        });
        
        const sortedUsers = Object.entries(userCounts)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5);
        
        if (sortedUsers.length === 0) {
          return `No items were taken ${timeframe ? `in the ${timeframe}` : 'recently'}.`;
        }
        
        const topUser = sortedUsers[0];
        return `${topUser[0]} took the most items ${timeframe ? `in the ${timeframe}` : 'recently'} with ${topUser[1]} items.\n\nTop users:\n${sortedUsers.map(([name, count], index) => `${index + 1}. ${name}: ${count} items`).join('\n')}`;
      }

      // Last item taken
      if (lowercaseQ.includes('last item') || lowercaseQ.includes('latest item')) {
        if (itemsOut.length === 0) {
          return "No items have been taken out yet.";
        }
        
        const lastItem = itemsOut[itemsOut.length - 1];
        return `The last item taken was ${lastItem.quantity} x ${lastItem.itemName} by ${lastItem.personName} on ${new Date(lastItem.dateTime).toLocaleDateString()} at ${new Date(lastItem.dateTime).toLocaleTimeString()}.`;
      }

      // Low stock items
      if (lowercaseQ.includes('low stock') || lowercaseQ.includes('running low')) {
        const lowStockItems = items.filter(item => item.quantity <= (item.lowStockThreshold || 10));
        
        if (lowStockItems.length === 0) {
          return "Good news! No items are currently running low on stock.";
        }
        
        return `${lowStockItems.length} items are running low:\n\n${lowStockItems.map(item => `• ${item.name}: ${item.quantity} units (threshold: ${item.lowStockThreshold || 10})`).join('\n')}`;
      }

      // Weekly/daily summary
      if (lowercaseQ.includes('summary') || lowercaseQ.includes('last week') || lowercaseQ.includes('this week')) {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        
        const weeklyItems = itemsOut.filter(item => new Date(item.dateTime) >= weekAgo);
        const uniqueUsers = new Set(weeklyItems.map(item => item.personName)).size;
        const totalItems = weeklyItems.reduce((sum, item) => sum + item.quantity, 0);
        
        const itemCounts = {};
        weeklyItems.forEach(item => {
          itemCounts[item.itemName] = (itemCounts[item.itemName] || 0) + item.quantity;
        });
        
        const mostPopular = Object.entries(itemCounts)
          .sort(([,a], [,b]) => b - a)[0];
        
        return `Weekly Summary:\n\n• ${uniqueUsers} people took ${totalItems} items\n• Most popular item: ${mostPopular ? `${mostPopular[0]} (${mostPopular[1]} taken)` : 'None'}\n• Active categories: ${categories.length}\n• Current stock levels: ${items.length} different items`;
      }

      // Category questions
      if (lowercaseQ.includes('category') || lowercaseQ.includes('categories')) {
        return `We have ${categories.length} categories:\n\n${categories.map(cat => `• ${cat.name}: ${cat.description || 'No description'}`).join('\n')}`;
      }

      // Default response for unrecognized questions
      return "I'm here to help with inventory questions! Try asking me about:\n\n• Stock levels: 'How many cables are left?'\n• Usage patterns: 'Who took the most items this week?'\n• Recent activity: 'What was the last item taken?'\n• Low stock: 'Which items are running low?'\n• Summaries: 'Give me a weekly summary'";
      
    } catch (error) {
      console.error('AI Analysis error:', error);
      return "I'm having trouble accessing the inventory data right now. Please try again in a moment.";
    }
  };

  const extractItemType = (question) => {
    const itemKeywords = ['cable', 'router', 'switch', 'ont', 'fiber', 'ethernet', 'wifi'];
    return itemKeywords.find(keyword => question.includes(keyword));
  };

  const extractTimeframe = (question) => {
    if (question.includes('this week') || question.includes('week')) return 'last 7 days';
    if (question.includes('today')) return 'today';
    if (question.includes('month')) return 'last 30 days';
    return null;
  };

  const filterByTimeframe = (items, timeframe) => {
    if (!timeframe) return items;
    
    const now = new Date();
    let cutoff = new Date();
    
    if (timeframe.includes('7 days') || timeframe.includes('week')) {
      cutoff.setDate(now.getDate() - 7);
    } else if (timeframe.includes('today')) {
      cutoff.setHours(0, 0, 0, 0);
    } else if (timeframe.includes('30 days') || timeframe.includes('month')) {
      cutoff.setDate(now.getDate() - 30);
    }
    
    return items.filter(item => new Date(item.dateTime) >= cutoff);
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputMessage
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsTyping(true);

    // Simulate thinking time
    setTimeout(async () => {
      const response = await analyzeQuestion(inputMessage);
      
      const botMessage = {
        id: Date.now() + 1,
        type: 'bot',
        content: response
      };

      setMessages(prev => [...prev, botMessage]);
      setIsTyping(false);
    }, 1000);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto h-full flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">AI Assistant</h1>
        <p className="text-gray-600 mt-1">Ask questions about your inventory and get intelligent insights</p>
      </div>

      {/* Chat Container */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
        {/* Messages */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="space-y-4">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex items-start space-x-3 max-w-3xl ${message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                  <div className={`p-2 rounded-full ${message.type === 'user' ? 'bg-blue-100' : 'bg-gray-100'}`}>
                    {message.type === 'user' ? (
                      <User className="h-5 w-5 text-blue-600" />
                    ) : (
                      <Bot className="h-5 w-5 text-gray-600" />
                    )}
                  </div>
                  <div className={`p-4 rounded-lg ${message.type === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'}`}>
                    <pre className="whitespace-pre-wrap font-sans">{message.content}</pre>
                  </div>
                </div>
              </div>
            ))}
            
            {isTyping && (
              <div className="flex justify-start">
                <div className="flex items-start space-x-3 max-w-3xl">
                  <div className="p-2 rounded-full bg-gray-100">
                    <Bot className="h-5 w-5 text-gray-600" />
                  </div>
                  <div className="p-4 rounded-lg bg-gray-100">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex space-x-4">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me anything about your inventory..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isTyping}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isTyping}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;
