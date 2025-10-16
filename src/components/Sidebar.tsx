import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  BarChart3, 
  Package, 
  Tags, 
  ArrowUpRight, 
  AlertTriangle, 
  FileText, 
  Bot, 
  Settings,
  ClipboardList,
  Clock,
  CheckCircle 
} from 'lucide-react';
import { getRequests } from '../api';

const Sidebar = ({ isOpen, onToggle }) => {
  const location = useLocation();
  const [pendingCount, setPendingCount] = useState(0);
  const [approvedCount, setApprovedCount] = useState(0);

  useEffect(() => {
    const loadCounts = async () => {
      try {
        const data = await getRequests();
        const pending = data.filter(r => r.status === 'pending').length;
        const approved = data.filter(r => r.status === 'approved').length;
        setPendingCount(pending);
        setApprovedCount(approved);
      } catch (error) {
        console.error('Error loading counts:', error);
      }
    };

    loadCounts();

    const interval = setInterval(loadCounts, 10000); // Refresh every 10 seconds

    return () => clearInterval(interval);
  }, []);

  const menuItems = [
    { icon: BarChart3, label: 'Dashboard', path: '/' },
    { icon: Package, label: 'Items', path: '/inventory' },
    { icon: Tags, label: 'Categories', path: '/categories' },
    { icon: AlertTriangle, label: 'Low Stock Alerts', path: '/low-stock' },
    { icon: ArrowUpRight, label: 'Items Out', path: '/items-out' },
    { icon: ClipboardList, label: 'Request Forms', path: '/request-forms' },
    { icon: Clock, label: 'Pending Approvals', path: '/pending-approvals' },
    { icon: CheckCircle, label: 'Approved Forms', path: '/approved-forms' },
    { icon: FileText, label: 'Reports', path: '/reports' },
    { icon: Bot, label: 'AI Assistant', path: '/ai-assistant' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ];

  const renderBadge = (label: string) => {
    let count = 0;
    let isPending = false;
    let isApproved = false;

    if (label === 'Pending Approvals') {
      count = pendingCount;
      isPending = true;
    } else if (label === 'Approved Forms') {
      count = approvedCount;
      isApproved = true;
    }

    if ((isPending || isApproved) && count > 0) {
      const displayCount = count > 99 ? '99+' : count.toString();
      const badgeColor = isPending ? 'bg-red-500' : 'bg-yellow-500'; // Red for pending, yellow for approved
      return (
        <span className={`${badgeColor} text-white text-xs rounded-full h-5 w-5 flex items-center justify-center ml-2 min-w-[20px]`}>
          {displayCount}
        </span>
      );
    }
    return null;
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={onToggle}
        />
      )}
      
      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-30 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out
        lg:translate-x-0 lg:static lg:inset-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center px-6 py-6 border-b border-gray-200">
            <img src="/vobiss-logo.png" alt="Vobiss Logo" className="h-12 w-12 mr-3 flex-shrink-0" />
            <div className="flex flex-col">
              <span className="text-xl font-bold text-gray-900">Vobiss</span>
              <span className="text-sm text-gray-600">Inventory</span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`
                    flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors
                    ${isActive 
                      ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700' 
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }
                  `}
                  onClick={() => {
                    if (window.innerWidth < 1024) onToggle();
                  }}
                >
                  <Icon className="h-5 w-5 mr-3" />
                  <span className="flex-1">{item.label}</span>
                  {renderBadge(item.label)}
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200">
            <div className="text-xs text-gray-500">
              Version 1.0.0
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu button */}
      <button
        onClick={onToggle}
        className="lg:hidden fixed top-4 left-4 z-40 bg-white p-2 rounded-lg shadow-md"
      >
        <Package className="h-6 w-6" />
      </button>
    </>
  );
};

export default Sidebar;