// Updated Index.tsx – Routes now match Sidebar permissions exactly
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

const Index = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect root '/' to dashboard (only if logged in)
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
              {/* === SYSTEM GUIDE - ALL ROLES === */}
              <Route 
                path="/system-guide" 
                element={
                  <ProtectedRoute allowedRoles={['requester', 'approver', 'issuer', 'superadmin']}>
                    <SystemGuide />
                  </ProtectedRoute>
                } 
              />

              {/* === REQUESTER ONLY === */}
              <Route 
                path="/request-forms" 
                element={
                  <ProtectedRoute allowedRoles={['requester', 'approver', 'issuer', 'superadmin']}>
                    <RequestForms />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/request-forms/:id" 
                element={
                  <ProtectedRoute allowedRoles={['requester', 'approver', 'issuer', 'superadmin']}>
                    <RequestDetails />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/item-returns" 
                element={
                  <ProtectedRoute allowedRoles={['requester', 'approver', 'issuer', 'superadmin']}>
                    <ItemReturns />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/item-returns/:id" 
                element={
                  <ProtectedRoute allowedRoles={['requester', 'approver', 'issuer', 'superadmin']}>
                    <RequestDetails />
                  </ProtectedRoute>
                } 
              />

              {/* === APPROVER ONLY === */}
              <Route 
                path="/pending-approvals" 
                element={
                  <ProtectedRoute allowedRoles={['approver', 'superadmin']}>
                    <PendingApprovals />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/pending-approvals/:id" 
                element={
                  <ProtectedRoute allowedRoles={['approver', 'superadmin']}>
                    <RequestDetails />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/low-stock" 
                element={
                  <ProtectedRoute allowedRoles={['approver', 'issuer', 'superadmin']}>
                    <LowStockAlerts />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/items-out" 
                element={
                  <ProtectedRoute allowedRoles={['approver', 'issuer', 'superadmin']}>
                    <ItemsOut />
                  </ProtectedRoute>
                } 
              />

              {/* === ISSUER & SUPERADMIN === */}
              <Route 
                path="/dashboard" 
                element={
                  <ProtectedRoute allowedRoles={['issuer', 'superadmin']}>
                    <Dashboard />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/inventory" 
                element={
                  <ProtectedRoute allowedRoles={['issuer', 'superadmin']}>
                    <Inventory />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/categories" 
                element={
                  <ProtectedRoute allowedRoles={['issuer', 'superadmin']}>
                    <Categories />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/approved-forms" 
                element={
                  <ProtectedRoute allowedRoles={['issuer', 'superadmin']}>
                    <ApprovedForms />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/approved-forms/:id" 
                element={
                  <ProtectedRoute allowedRoles={['issuer', 'superadmin']}>
                    <RequestDetails />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/reports" 
                element={
                  <ProtectedRoute allowedRoles={['issuer', 'superadmin']}>
                    <Reports />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/ai-assistant" 
                element={
                  <ProtectedRoute allowedRoles={['issuer', 'superadmin']}>
                    <AIAssistant />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/audit-logs" 
                element={
                  <ProtectedRoute allowedRoles={['issuer', 'superadmin']}>
                    <AuditLogs />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/supervisors" 
                element={
                  <ProtectedRoute allowedRoles={['issuer', 'superadmin']}>
                    <SupervisorsPage />
                  </ProtectedRoute>
                } 
              />

              {/* === SUPERADMIN ONLY === */}
              <Route 
                path="/users" 
                element={
                  <ProtectedRoute allowedRoles={['superadmin']}>
                    <UsersPage />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/settings" 
                element={
                  <ProtectedRoute allowedRoles={['superadmin']}>
                    <SettingsPage />
                  </ProtectedRoute>
                } 
              />

              {/* === ROOT REDIRECT === */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />

              {/* === CATCH-ALL === */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </div>
  );
};

export default Index;