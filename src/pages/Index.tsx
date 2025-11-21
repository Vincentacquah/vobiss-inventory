// src/pages/Index.tsx ← FINAL FIXED VERSION (No Duplicates, No Errors)
import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import ProtectedRoute from '../components/ProtectedRoute';
import Dashboard from './Dashboard';
import Inventory from './Inventory';
import Categories from './Categories';
import ItemsOut from './ItemsOut';
import LowStockAlerts from './LowStockAlerts';
import Reports from './Reports';
import AIAssistant from './AIAssistant';
import SettingsPage from './SettingsPage';
import SupervisorsPage from './SupervisorsPage';
import RequestForms from './RequestForms';
import ItemReturns from './ItemReturns';
import PendingApprovals from './PendingApprovals';
import ApprovedForms from './ApprovedForms';
import RequestDetails from './RequestDetails';
import AuditLogs from './AuditLogs';
import UsersPage from './UsersPage';
import SystemGuide from './SystemGuide';

// === ASSETS MANAGER IMPORTS ===
import AssetsListPage from './assets';               // /assets
import NewAssetPage from './assets/new';               // /assets/new
import AssetDetailPage from './assets/AssetDetail';    // /assets/:id
import ComingSoon from './assets/ComingSoon';    
import VendorsList from './assets/vendors';
import NewVendorPage from './assets/vendors/new';
import VendorDetail from './assets/vendors/[id]';      
import PeopleList from './assets/assignments';
import NewPersonPage from './assets/assignments/new';
import PersonDetail from './assets/assignments/[id]';
import CategoriesLocationsPage from './assets/categories-locations';
import MaintenanceList from './assets/maintenance';
import NewMaintenancePage from './assets/maintenance/new';
import MaintenanceDetailPage from './assets/maintenance/[id]';

const Index = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.pathname === '/' && !location.search && !location.hash) {
      navigate('/dashboard', { replace: true });
    }
  }, [location.pathname, navigate]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex h-screen">
        {/* Sidebar */}
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <main className="flex-1 overflow-y-auto">
            <Routes>
              {/* === SYSTEM GUIDE === */}
              <Route path="/system-guide" element={<ProtectedRoute allowedRoles={['requester', 'approver', 'issuer', 'superadmin']}><SystemGuide /></ProtectedRoute>} />

              {/* === REQUESTER === */}
              <Route path="/request-forms" element={<ProtectedRoute allowedRoles={['requester', 'approver', 'issuer', 'superadmin']}><RequestForms /></ProtectedRoute>} />
              <Route path="/request-forms/:id" element={<ProtectedRoute allowedRoles={['requester', 'approver', 'issuer', 'superadmin']}><RequestDetails /></ProtectedRoute>} />
              <Route path="/item-returns" element={<ProtectedRoute allowedRoles={['requester', 'approver', 'issuer', 'superadmin']}><ItemReturns /></ProtectedRoute>} />
              <Route path="/item-returns/:id" element={<ProtectedRoute allowedRoles={['requester', 'approver', 'issuer', 'superadmin']}><RequestDetails /></ProtectedRoute>} />

              {/* === APPROVER === */}
              <Route path="/pending-approvals" element={<ProtectedRoute allowedRoles={['approver', 'superadmin']}><PendingApprovals /></ProtectedRoute>} />
              <Route path="/pending-approvals/:id" element={<ProtectedRoute allowedRoles={['approver', 'superadmin']}><RequestDetails /></ProtectedRoute>} />
              <Route path="/low-stock" element={<ProtectedRoute allowedRoles={['approver', 'issuer', 'superadmin']}><LowStockAlerts /></ProtectedRoute>} />
              <Route path="/items-out" element={<ProtectedRoute allowedRoles={['approver', 'issuer', 'superadmin']}><ItemsOut /></ProtectedRoute>} />

              {/* === ISSUER & SUPERADMIN === */}
              <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['issuer', 'superadmin']}><Dashboard /></ProtectedRoute>} />
              <Route path="/inventory" element={<ProtectedRoute allowedRoles={['issuer', 'superadmin']}><Inventory /></ProtectedRoute>} />
              <Route path="/categories" element={<ProtectedRoute allowedRoles={['issuer', 'superadmin']}><Categories /></ProtectedRoute>} />
              <Route path="/approved-forms" element={<ProtectedRoute allowedRoles={['issuer', 'superadmin']}><ApprovedForms /></ProtectedRoute>} />
              <Route path="/approved-forms/:id" element={<ProtectedRoute allowedRoles={['issuer', 'superadmin']}><RequestDetails /></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute allowedRoles={['issuer', 'superadmin']}><Reports /></ProtectedRoute>} />
              <Route path="/ai-assistant" element={<ProtectedRoute allowedRoles={['issuer', 'superadmin']}><AIAssistant /></ProtectedRoute>} />

              {/* === ASSETS MANAGER (LIVE) === */}
              <Route path="/assets" element={<ProtectedRoute allowedRoles={['issuer', 'superadmin']}><AssetsListPage /></ProtectedRoute>} />
              <Route path="/assets/new" element={<ProtectedRoute allowedRoles={['issuer', 'superadmin']}><NewAssetPage /></ProtectedRoute>} />
              <Route path="/assets/:id" element={<ProtectedRoute allowedRoles={['issuer', 'superadmin']}><AssetDetailPage /></ProtectedRoute>} />
              <Route path="/assets/vendors" element={<ProtectedRoute allowedRoles={['issuer', 'superadmin']}><VendorsList /></ProtectedRoute>} />
<Route path="/assets/vendors/new" element={<ProtectedRoute allowedRoles={['issuer', 'superadmin']}><NewVendorPage /></ProtectedRoute>} />
<Route path="/assets/vendors/:id" element={<ProtectedRoute allowedRoles={['issuer', 'superadmin']}><VendorDetail /></ProtectedRoute>} />
<Route path="/assets/assignments" element={<ProtectedRoute allowedRoles={['issuer', 'superadmin']}><PeopleList /></ProtectedRoute>} />
<Route path="/assets/assignments/new" element={<ProtectedRoute allowedRoles={['issuer', 'superadmin']}><NewPersonPage /></ProtectedRoute>} />
<Route path="/assets/assignments/:id" element={<ProtectedRoute allowedRoles={['issuer', 'superadmin']}><PersonDetail /></ProtectedRoute>} />
<Route path="/assets/categories" element={<ProtectedRoute allowedRoles={['issuer', 'superadmin']}><CategoriesLocationsPage /></ProtectedRoute>} />
<Route path="/assets/locations" element={<ProtectedRoute allowedRoles={['issuer', 'superadmin']}><CategoriesLocationsPage /></ProtectedRoute>} />
// === MAINTENANCE SECTION ===
<Route path="/assets/maintenance" element={<ProtectedRoute allowedRoles={['issuer', 'superadmin']}><MaintenanceList /></ProtectedRoute>} />
<Route path="/assets/maintenance/new" element={<ProtectedRoute allowedRoles={['issuer', 'superadmin']}><NewMaintenancePage /></ProtectedRoute>} />
<Route path="/assets/maintenance/:id" element={<ProtectedRoute allowedRoles={['issuer', 'superadmin']}><MaintenanceDetailPage /></ProtectedRoute>} />  {/* ← THIS WAS MISSING */}

              {/* === ASSETS MANAGER (COMING SOON) === */}
              <Route path="/assets/categories" element={<ProtectedRoute allowedRoles={['issuer', 'superadmin']}><ComingSoon /></ProtectedRoute>} />
              <Route path="/assets/locations" element={<ProtectedRoute allowedRoles={['issuer', 'superadmin']}><ComingSoon /></ProtectedRoute>} />
              
              <Route path="/assets/maintenance" element={<ProtectedRoute allowedRoles={['issuer', 'superadmin']}><ComingSoon /></ProtectedRoute>} />
              
              <Route path="/assets/reports" element={<ProtectedRoute allowedRoles={['issuer', 'superadmin']}><ComingSoon /></ProtectedRoute>} />

              {/* === SUPERADMIN ONLY === */}
              <Route path="/audit-logs" element={<ProtectedRoute allowedRoles={['superadmin']}><AuditLogs /></ProtectedRoute>} />
              <Route path="/supervisors" element={<ProtectedRoute allowedRoles={['superadmin']}><SupervisorsPage /></ProtectedRoute>} />
              <Route path="/users" element={<ProtectedRoute allowedRoles={['superadmin']}><UsersPage /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute allowedRoles={['superadmin']}><SettingsPage /></ProtectedRoute>} />

              {/* === ROOT & FALLBACK === */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </div>
  );
};

export default Index;