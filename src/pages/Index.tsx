// Updated Index.tsx with updated ProtectedRoute for Approved Forms (exclude approver)
import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import ProtectedRoute from '../components/ProtectedRoute'; // New import
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
import PendingApprovals from './PendingApprovals';
import ApprovedForms from './ApprovedForms';
import RequestDetails from './RequestDetails';
import AuditLogs from './AuditLogs';
import UsersPage from './UsersPage';

const Index = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex h-screen">
        {/* Sidebar */}
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
        
        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <main className="flex-1 overflow-y-auto">
            <Routes>
              {/* Public/Dashboard - accessible to all roles */}
              <Route path="/" element={<Dashboard />} />
              
              {/* Inventory & Categories - all roles */}
              <Route path="/inventory" element={<ProtectedRoute allowedRoles={['requester', 'approver', 'issuer', 'superadmin']}><Inventory /></ProtectedRoute>} />
              <Route path="/categories" element={<ProtectedRoute allowedRoles={['requester', 'approver', 'issuer', 'superadmin']}><Categories /></ProtectedRoute>} />
              
              {/* Low Stock & Items Out - all roles */}
              <Route path="/low-stock" element={<ProtectedRoute allowedRoles={['requester', 'approver', 'issuer', 'superadmin']}><LowStockAlerts /></ProtectedRoute>} />
              <Route path="/items-out" element={<ProtectedRoute allowedRoles={['requester', 'approver', 'issuer', 'superadmin']}><ItemsOut /></ProtectedRoute>} />
              
              {/* Request Forms - requester, approver, issuer, superadmin */}
              <Route path="/request-forms" element={<ProtectedRoute allowedRoles={['requester', 'approver', 'issuer', 'superadmin']}><RequestForms /></ProtectedRoute>} />
              <Route path="/request-forms/:id" element={<ProtectedRoute allowedRoles={['requester', 'approver', 'issuer', 'superadmin']}><RequestDetails /></ProtectedRoute>} />
              
              {/* Pending Approvals - approver, superadmin only */}
              <Route path="/pending-approvals" element={<ProtectedRoute allowedRoles={['approver', 'superadmin']}><PendingApprovals /></ProtectedRoute>} />
              <Route path="/pending-approvals/:id" element={<ProtectedRoute allowedRoles={['approver', 'superadmin']}><RequestDetails /></ProtectedRoute>} />
              
              {/* Approved Forms - issuer and superadmin only (excluded approver) */}
              <Route path="/approved-forms" element={<ProtectedRoute allowedRoles={['issuer', 'superadmin']}><ApprovedForms /></ProtectedRoute>} />
              <Route path="/approved-forms/:id" element={<ProtectedRoute allowedRoles={['issuer', 'superadmin']}><RequestDetails /></ProtectedRoute>} />
              
              {/* Reports & AI - issuer and superadmin */}
              <Route path="/reports" element={<ProtectedRoute allowedRoles={['issuer', 'superadmin']}><Reports /></ProtectedRoute>} />
              <Route path="/ai-assistant" element={<ProtectedRoute allowedRoles={['issuer', 'superadmin']}><AIAssistant /></ProtectedRoute>} />
              
              {/* Super Admin Only */}
              <Route path="/users" element={<ProtectedRoute allowedRoles={['superadmin']}><UsersPage /></ProtectedRoute>} />
              <Route path="/supervisors" element={<ProtectedRoute allowedRoles={['superadmin']}><SupervisorsPage /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute allowedRoles={['superadmin']}><SettingsPage /></ProtectedRoute>} />
              <Route path="/audit-logs" element={<ProtectedRoute allowedRoles={['superadmin']}><AuditLogs /></ProtectedRoute>} />
              
              {/* Catch-all redirect to dashboard */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </div>
  );
};

export default Index;