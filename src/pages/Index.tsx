// src/pages/Index.tsx
import React, { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
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
              <Route path="/" element={<Dashboard />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/categories" element={<Categories />} />
              <Route path="/items-out" element={<ItemsOut />} />
              <Route path="/low-stock" element={<LowStockAlerts />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/ai-assistant" element={<AIAssistant />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/supervisors" element={<SupervisorsPage />} />
              <Route path="/request-forms" element={<RequestForms />} />
              <Route path="/request-forms/:id" element={<RequestDetails />} />
              <Route path="/pending-approvals" element={<PendingApprovals />} />
              <Route path="/pending-approvals/:id" element={<RequestDetails />} />
              <Route path="/approved-forms" element={<ApprovedForms />} />
              <Route path="/approved-forms/:id" element={<RequestDetails />} />
              <Route path="/audit-logs" element={<AuditLogs />} />
            </Routes>
          </main>
        </div>
      </div>
    </div>
  );
};

export default Index;