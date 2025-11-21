// src/components/Sidebar.tsx ← FINAL + Assets Manager "Prototype" popup
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  BarChart3, Package, Tags, ArrowUpRight, AlertTriangle, FileText, Bot, Settings,
  ClipboardList, Clock, CheckCircle, LogOut, FileText as AuditIcon, Users, ArrowLeftCircle,
  HelpCircle, Bell, X,
  Monitor, ChevronDown, ChevronRight,
  Plus, MapPin, UserCheck, Building2, Wrench
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
  const [showNotif, setShowNotif] = useState(false);
  const [isAssetsOpen, setIsAssetsOpen] = useState(false); // closed by default now

  // NEW: Prototype modal state
  const [showAssetsPrototypeModal, setShowAssetsPrototypeModal] = useState(false);

  const [notifications] = useState([
    { id: 1, title: "Welcome back", message: "Your inventory dashboard is ready.", time: "Just now", type: "info", read: false },
   { id: 2, title: "Assets Manager Prototype Ready", message: "You can now test the prototype for tracking company assets like laptops, furniture, and equipment.", time: "2 hours ago", type: "success", read: false },

    { id: 3, title: "Stay Updated", message: "Refresh dashboard to see latest features.", time: "1 day ago", type: "info", read: false },
  ]);

  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    const loadCounts = async () => {
      try {
        const [requestsData, lowStockData] = await Promise.all([getRequests(), getLowStockItems()]);
        setPendingCount(requestsData.filter(r => r.status === 'pending').length);
        setApprovedCount(requestsData.filter(r => r.status === 'approved').length);
        setLowStockCount(lowStockData.length);
      } catch (error) { console.error('Error loading counts:', error); }
    };
    loadCounts();
    const interval = setInterval(loadCounts, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await new Promise(r => setTimeout(r, 1200));
    logout();
    setIsLoggingOut(false);
  };

  const getMenuItems = () => {
    const baseItems = [
      { icon: BarChart3, label: 'Dashboard', path: '/dashboard' },
      { icon: Package, label: 'Items', path: '/inventory' },
      { icon: Tags, label: 'Categories', path: '/categories' },
      { icon: AlertTriangle, label: 'Low Stock Alerts', path: '/low-stock' },
      { icon: ArrowUpRight, label: 'Items Out', path: '/items-out' },
    ];

    const requestFormsItems = [
      { icon: ClipboardList, label: 'Request Forms', path: '/request-forms' },
      { icon: ArrowLeftCircle, label: 'Item Returns', path: '/item-returns' },
    ];

    const approvalsItems = [{ icon: Clock, label: 'Pending Approvals', path: '/pending-approvals' }];
    const approvedFormsItem = [{ icon: CheckCircle, label: 'Approved Forms', path: '/approved-forms' }];
    const reportsItem = [{ icon: FileText, label: 'Reports', path: '/reports' }];
    const aiAssistantItem = [{ icon: Bot, label: 'AI Assistant', path: '/ai-assistant' }];

    const assetsManagerItems = [
      { icon: Package, label: 'All Assets', path: '/assets' },
      { icon: Plus, label: 'Add New Asset', path: '/assets/new' },
      { icon: Tags, label: 'Categories', path: '/assets/categories' },
      { icon: MapPin, label: 'Locations', path: '/assets/locations' },
      { icon: UserCheck, label: 'Assignments', path: '/assets/assignments' },
      { icon: Wrench, label: 'Maintenance', path: '/assets/maintenance' },
      { icon: Building2, label: 'Vendors', path: '/assets/vendors' },
      { icon: FileText, label: 'Reports', path: '/assets/reports' },
    ];

    const role = user?.role;
    let menuItems: any[] = [];

    if (role === 'requester') {
      menuItems = [baseItems[0], ...requestFormsItems];
    } else if (role === 'approver') {
      menuItems = [...baseItems, ...requestFormsItems, ...approvalsItems];
    } else if (role === 'issuer' || role === 'superadmin') {
      menuItems = [
        ...baseItems,
        ...requestFormsItems,
        ...approvedFormsItem,
        ...reportsItem,
        ...aiAssistantItem,
      ];

      // === ASSETS MANAGER – NOW WITH PROTOTYPE POPUP ===
      menuItems.push({
        icon: Monitor,
        label: 'Assets Manager',
        isCollapsible: true,
        isOpen: isAssetsOpen,
        onToggle: () => setShowAssetsPrototypeModal(true), // ← show modal instead of toggle
        subItems: assetsManagerItems
      });

      menuItems.push({ icon: AuditIcon, label: 'Audit Logs', path: '/audit-logs' });

      if (role === 'superadmin') {
        menuItems.push(
          { icon: Users, label: 'Supervisors', path: '/supervisors' },
          { icon: Users, label: 'Users', path: '/users' },
          { icon: Settings, label: 'Settings', path: '/settings' }
        );
      }
    }

    return menuItems;
  };

  const menuItems = getMenuItems();

  const renderBadge = (label: string) => {
    let count = 0, color = '';
    if (label === 'Pending Approvals') { count = pendingCount; color = 'bg-red-500'; }
    else if (label === 'Approved Forms') { count = approvedCount; color = 'bg-yellow-500'; }
    else if (label === 'Low Stock Alerts') { count = lowStockCount; color = 'bg-orange-500'; }
    if (count > 0) return <span className={`${color} text-white text-xs rounded-full h-5 w-5 flex items-center justify-center ml-2 min-w-[20px]`}>{count > 99 ? '99+' : count}</span>;
    return null;
  };

  const isActivePath = (path: string) => location.pathname.startsWith(path);

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && <div className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden" onClick={onToggle} />}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:z-auto ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="relative flex items-center justify-between px-6 py-7 bg-gradient-to-b from-blue-50 to-white border-b border-gray-200">
            <div className="flex items-center space-x-4">
              <img src="/vobiss-logo.png" alt="Vobiss Logo" className="h-16 w-16 object-contain drop-shadow-md" />
              <div>
                <span className="text-2xl font-bold text-gray-900 tracking-tight">Vobiss</span>
                <span className="block text-sm font-medium text-blue-600">Inventory System</span>
              </div>
            </div>
            <button onClick={() => setShowNotif(!showNotif)} className="relative p-3 rounded-xl hover:bg-white/70 transition-all">
              <Bell className="h-6 w-6 text-gray-700" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center animate-pulse shadow-lg">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
          </div>

          {user && (
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div className="text-sm font-semibold text-gray-900">{user.full_name || user.username}</div>
              <div className="text-xs text-gray-500 capitalize">{user.role}</div>
            </div>
          )}

          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto [&::-webkit-scrollbar]:hidden">
            {menuItems.map((item: any, index) => {
              if (item.isCollapsible) {
                const Icon = item.icon;
                const active = isActivePath('/assets');
                return (
                  <div key={index} className="space-y-1">
                    <div
                      onClick={item.onToggle}
                      className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg cursor-pointer transition-colors ${
                        active ? 'bg-blue-50 text-blue-700 border-r-4 border-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <Icon className="h-5 w-5 mr-3 flex-shrink-0" />
                      <span className="flex-1">{item.label}</span>
                      <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">Prototype</span>
                    </div>

                    {/* Sub-items only visible after clicking "Try Prototype" */}
                    {isAssetsOpen && item.subItems.map((sub: any) => {
                      const SubIcon = sub.icon;
                      const subActive = location.pathname === sub.path;
                      return (
                        <Link
                          key={sub.path}
                          to={sub.path}
                          className={`flex items-center px-4 py-3 pl-12 text-sm font-medium rounded-lg transition-colors ${
                            subActive ? 'bg-blue-50 text-blue-700 border-r-4 border-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                          }`}
                          onClick={() => window.innerWidth < 1024 && onToggle()}
                        >
                          <SubIcon className="h-4 w-4 mr-3 flex-shrink-0" />
                          <span>{sub.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                );
              }

              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={index}
                  to={item.path}
                  className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                    isActive ? 'bg-blue-50 text-blue-700 border-r-4 border-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                  onClick={() => window.innerWidth < 1024 && onToggle()}
                >
                  <Icon className="h-5 w-5 mr-3 flex-shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {renderBadge(item.label)}
                </Link>
              );
            })}
          </nav>

          {user && (
            <div className="px-4 py-4 border-t border-gray-200">
              <button onClick={handleLogout} disabled={isLoggingOut} className={`w-full flex items-center px-4 py-3 text-sm font-medium text-red-600 rounded-lg transition-colors ${isLoggingOut ? 'opacity-50' : 'hover:bg-red-50'}`}>
                {isLoggingOut ? <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-red-600 mr-3"></div> : <LogOut className="h-5 w-5 mr-3" />}
                <span>{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
              </button>
            </div>
          )}
          <div className="px-6 py-4 border-t border-gray-200 text-center text-xs text-gray-500">Version 2.1.0 + Assets Manager</div>
        </div>
      </div>

      {/* === ASSETS MANAGER PROTOTYPE MODAL === */}
      {showAssetsPrototypeModal && (
        <>
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50" onClick={() => setShowAssetsPrototypeModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white">
                <Monitor className="h-12 w-12 mb-3" />
                <h2 className="text-2xl font-bold">Assets Manager – Prototype</h2>
                <p className="mt-2 opacity-90">This module is currently under active development and not fully live yet.</p>
              </div>
              <div className="p-6">
                <p className="text-gray-700 mb-6">
                  You’re seeing a preview of the upcoming Assets Manager where you’ll be able to track laptops, furniture, vehicles, and more with full assignment, maintenance, and vendor tracking.
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setShowAssetsPrototypeModal(false)}
                    className="px-5 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                  >
                    Maybe Later
                  </button>
                  <button
                    onClick={() => {
                      setIsAssetsOpen(true);
                      setShowAssetsPrototypeModal(false);
                    }}
                    className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-medium rounded-lg hover:shadow-lg transition shadow-md"
                  >
                    Try Prototype Now
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* === NOTIFICATION PANEL — UNTOUCHED === */}
      {showNotif && (
        <>
          <div className="fixed inset-0 z-20 backdrop-blur-sm bg-black/5 transition-all duration-300" onClick={() => setShowNotif(false)} />
          <div className="fixed top-20 left-64 z-50 pointer-events-none">
            <div className="relative pointer-events-auto">
              <div className="absolute top-0 left-0 w-12 h-12 -translate-x-full -translate-y-8">
                <svg width="48" height="48" viewBox="0 0 48 48" className="overflow-visible">
                  <path d="M 0 32 Q 20 32, 40 8" stroke="#eeb109ff" strokeWidth="3" fill="none" />
                </svg>
              </div>

              <div className="w-96 bg-white rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-left-12 fade-in duration-300">
                <div className="flex items-center justify-between px-6 py-4 bg-gray-100 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-800">Notifications</h3>
                  <div className="flex items-center gap-3">
                    {unreadCount > 0 && (
                      <button onClick={() => {}} className="text-sm text-gray-600 hover:text-gray-900">
                        Mark all read
                      </button>
                    )}
                    <button onClick={() => setShowNotif(false)} className="p-1 hover:bg-gray-200 rounded-lg">
                      <X className="h-5 w-5 text-gray-600" />
                    </button>
                  </div>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.map(notif => (
                    <div
                      key={notif.id}
                      className={`px-6 py-4 border-b border-gray-100 hover:bg-gray-50 transition cursor-pointer ${!notif.read ? 'bg-blue-50/50' : ''}`}
                    >
                      <div className="flex gap-3">
                        <Bell className="h-5 w-5 text-gray-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{notif.title}</p>
                          <p className="text-sm text-gray-600 mt-1">{notif.message}</p>
                          <p className="text-xs text-gray-400 mt-2">{notif.time}</p>
                        </div>
                        {!notif.read && <div className="h-2 w-2 bg-blue-600 rounded-full mt-2"></div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Mobile Toggle */}
      <button onClick={onToggle} className="lg:hidden fixed top-4 left-4 z-50 bg-white p-3 rounded-xl shadow-lg border border-gray-200">
        <Package className="h-6 w-6 text-gray-700" />
      </button>
    </>
  );
};

export default Sidebar;