// Updated Sidebar.tsx with Item Returns menu item
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
  CheckCircle,
  LogOut,
  FileText as AuditIcon,
  Users,
  ArrowLeftCircle // New import for returns icon
} from 'lucide-react';
import { getRequests, getLowStockItems } from '../api';
import { useAuth } from '../context/AuthContext';

const Sidebar = ({ isOpen, onToggle }) => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [approvedCount, setApprovedCount] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    const loadCounts = async () => {
      try {
        const [requestsData, lowStockData] = await Promise.all([
          getRequests(),
          getLowStockItems()
        ]);
        const pending = requestsData.filter(r => r.status === 'pending').length;
        const approved = requestsData.filter(r => r.status === 'approved').length;
        setPendingCount(pending);
        setApprovedCount(approved);
        setLowStockCount(lowStockData.length);
      } catch (error) {
        console.error('Error loading counts:', error);
      }
    };

    loadCounts();

    const interval = setInterval(loadCounts, 10000); // Refresh every 10 seconds

    return () => clearInterval(interval);
  }, []);

  // Prevent body scroll on mobile when sidebar is open
  useEffect(() => {
    if (isOpen && window.innerWidth < 1024) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await new Promise(resolve => setTimeout(resolve, 1200)); // 1.2 second delay
    logout();
    setIsLoggingOut(false);
  };

  // Role-based menu items (updated with Item Returns)
  const getMenuItems = () => {
    const baseItems = [
      { icon: BarChart3, label: 'Dashboard', path: '/' },
      { icon: Package, label: 'Items', path: '/inventory' },
      { icon: Tags, label: 'Categories', path: '/categories' },
      { icon: AlertTriangle, label: 'Low Stock Alerts', path: '/low-stock' },
      { icon: ArrowUpRight, label: 'Items Out', path: '/items-out' },
    ];

    const requestFormsItems = [
      { icon: ClipboardList, label: 'Request Forms', path: '/request-forms' },
      { icon: ArrowLeftCircle, label: 'Item Returns', path: '/item-returns' }, // New menu item
    ];

    const approvalsItems = [
      { icon: Clock, label: 'Pending Approvals', path: '/pending-approvals' },
    ];

    const approvedFormsItem = [
      { icon: CheckCircle, label: 'Approved Forms', path: '/approved-forms' },
    ];

    const adminItems = [
      { icon: AuditIcon, label: 'Audit Logs', path: '/audit-logs' },
      { icon: Settings, label: 'Settings', path: '/settings' },
    ];

    const superAdminItems = [
      { icon: Users, label: 'Users', path: '/users' },
      { icon: Users, label: 'Supervisors', path: '/supervisors' },
    ];

    const role = user?.role;

    let menuItems = [...baseItems];

    if (role === 'requester') {
      // Request Forms + Item Returns
      menuItems = [...requestFormsItems];
    } else if (role === 'approver') {
      // Request Forms + Item Returns + Pending Approvals (no Approved Forms)
      menuItems = [...requestFormsItems, ...approvalsItems];
    } else if (role === 'issuer') {
      // Everything except Users, Pending Approvals, Settings
      menuItems = [
        ...baseItems,
        ...requestFormsItems,
        ...approvedFormsItem,
        { icon: FileText, label: 'Reports', path: '/reports' },
        { icon: Bot, label: 'AI Assistant', path: '/ai-assistant' },
      ];
    } else if (role === 'superadmin') {
      // Everything
      menuItems = [
        ...baseItems,
        ...superAdminItems,
        ...requestFormsItems,
        ...approvalsItems,
        ...approvedFormsItem,
        ...adminItems,
        { icon: FileText, label: 'Reports', path: '/reports' },
        { icon: Bot, label: 'AI Assistant', path: '/ai-assistant' },
      ];
    }

    return menuItems;
  };

  const menuItems = getMenuItems();

  const renderBadge = (label: string) => {
    let count = 0;
    let isPending = false;
    let isApproved = false;
    let isLowStock = false;

    if (label === 'Pending Approvals') {
      count = pendingCount;
      isPending = true;
    } else if (label === 'Approved Forms') {
      count = approvedCount;
      isApproved = true;
    } else if (label === 'Low Stock Alerts') {
      count = lowStockCount;
      isLowStock = true;
    }

    if ((isPending || isApproved || isLowStock) && count > 0) {
      const displayCount = count > 99 ? '99+' : count.toString();
      let badgeColor = '';
      if (isPending) badgeColor = 'bg-red-500';
      else if (isApproved) badgeColor = 'bg-yellow-500';
      else if (isLowStock) badgeColor = 'bg-orange-500';
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

          {/* User Info - Updated to show full name */}
          {user && (
            <div className="px-6 py-3 border-b border-gray-200 bg-gray-50">
              <div className="text-sm font-semibold text-gray-900">{user.full_name || user.username}</div>
              <div className="text-xs text-gray-500 capitalize">{user.role}</div>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
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

          {/* Logout */}
          {user && (
            <div className="px-4 py-3 border-t border-gray-200">
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className={`
                  w-full flex items-center px-3 py-2 text-sm font-medium text-red-600 rounded-lg transition-colors
                  ${isLoggingOut ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-50'}
                `}
              >
                {isLoggingOut ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-red-600 mr-2"></div>
                ) : (
                  <LogOut className="h-4 w-4 mr-2" />
                )}
                {isLoggingOut ? 'Logging out...' : 'Logout'}
              </button>
            </div>
          )}

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 mt-auto">
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