// SystemGuide.tsx – Updated for Current Vobiss Inventory System (Oct 2025)
import React, { useState } from 'react';
import { 
  Search, 
  ChevronDown, 
  ChevronUp,
  Copy,
  Lock,
  LayoutDashboard,
  Users,
  Package,
  FileText,
  CheckCircle,
  ArrowUpRight,
  RotateCcw,
  AlertTriangle,
  BarChart3,
  Settings,
  Bot,
  Mail,
  BookOpen,
  HelpCircle,
  UserCheck
} from 'lucide-react';

// CopyButton – Safe & moved before sections
const CopyButton = ({ code }: { code: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded text-xs transition-colors flex items-center gap-1"
      title="Copy code"
    >
      {copied ? 'Copied!' : <Copy className="h-3 w-3" />}
    </button>
  );
};

const sections = [
  {
    id: 1,
    icon: Lock,
    title: 'Logging In',
    content: (
      <>
        <ul className="space-y-2 list-disc pl-5 mb-4">
          <li>Go to the login page: <code className="bg-gray-100 px-1 rounded">/login</code></li>
          <li>Use your assigned <strong>username</strong> and <strong>password</strong>.</li>
          <li>Click <strong>Login</strong> to access dashboard.</li>
        </ul>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <p className="font-semibold text-blue-900 flex items-center gap-2">
            <UserCheck className="h-4 w-4" /> Example
          </p>
          <p className="text-sm mt-1">
            <strong>Username:</strong> <code className="bg-white px-1 rounded">kofi</code><br />
            <strong>Password:</strong> <code className="bg-white px-1 rounded">kofi@123</code>
          </p>
        </div>
        <p className="text-sm text-gray-600">Contact your admin if credentials are missing.</p>
      </>
    )
  },
  {
    id: 2,
    icon: LayoutDashboard,
    title: 'Dashboard Overview',
    content: (
      <>
        <p className="mb-4">Real-time summary:</p>
        <ul className="space-y-2 list-disc pl-5 mb-4">
          <li><strong>Total Items</strong> in stock</li>
          <li><strong>Pending Requests</strong> awaiting approval</li>
          <li><strong>Low Stock Alerts</strong> (below threshold)</li>
          <li><strong>Recent Issues & Returns</strong></li>
        </ul>
        <p>Use the <strong>sidebar</strong> to navigate.</p>
      </>
    )
  },
  {
    id: 3,
    icon: Users,
    title: 'User Roles & Permissions',
    content: (
      <>
        <p className="mb-4">Each role has specific access:</p>
        <ul className="space-y-3 text-sm">
          <li className="flex items-start gap-2">
            <strong className="text-blue-600">Requester</strong>: Submit material or return requests
          </li>
          <li className="flex items-start gap-2">
            <strong className="text-green-600">Approver</strong>: Review & approve/reject requests
          </li>
          <li className="flex items-start gap-2">
            <strong className="text-purple-600">Issuer</strong>: Issue approved items, process returns
          </li>
          <li className="flex items-start gap-2">
            <strong className="text-red-600">Super Admin</strong>: Full control — users, settings, logs, backup
          </li>
        </ul>
      </>
    )
  },
  {
    id: 4,
    icon: Package,
    title: 'Managing Inventory (Admin/Issuer)',
    content: (
      <>
        <ul className="space-y-2 list-disc pl-5 mb-4">
          <li>Go to <strong>Inventory → Items</strong></li>
          <li>Add, edit, or delete items</li>
          <li>Set <strong>low stock threshold</strong> per item</li>
          <li>Upload <strong>receipt images</strong> on update</li>
          <li>Track <strong>update reasons</strong> in history</li>
        </ul>
        <details className="mt-4 p-3 bg-gray-100 rounded-lg">
          <summary className="cursor-pointer font-medium text-blue-600 mb-2 flex items-center gap-1">
            API: Add New Item
            <ChevronDown className="h-4 w-4" />
          </summary>
          <div className="relative">
            <pre className="bg-gray-800 text-gray-100 p-4 rounded-md overflow-x-auto text-sm">
              <code>{`POST /api/items
Authorization: Bearer <token>

{
  "name": "Router",
  "description": "TP-Link Archer",
  "category_id": 2,
  "quantity": 15,
  "low_stock_threshold": 3,
  "vendor_id": 5,
  "unit_price": 125.00
}`}</code>
            </pre>
            <CopyButton code={`POST /api/items\nAuthorization: Bearer <token>\n\n{\n  "name": "Router",\n  "description": "TP-Link Archer",\n  "category_id": 2,\n  "quantity": 15,\n  "low_stock_threshold": 3,\n  "vendor_id": 5,\n  "unit_price": 125.00\n}`} />
          </div>
        </details>
      </>
    )
  },
  {
    id: 5,
    icon: FileText,
    title: 'Making a Request (Requester)',
    content: (
      <>
        <ul className="space-y-2 list-disc pl-5 mb-4">
          <li>Go to <strong>Request Forms → New Request</strong></li>
          <li>Select <strong>Material Request</strong> or <strong>Item Return</strong></li>
          <li>Fill project details, items, quantities</li>
          <li><strong>Select one or more approvers</strong></li>
          <li>Submit — appears in <strong>Pending Requests</strong></li>
        </ul>
        <details className="mt-4 p-3 bg-gray-100 rounded-lg">
          <summary className="cursor-pointer font-medium text-blue-600 mb-2 flex items-center gap-1">
            API: Submit Material Request
            <ChevronDown className="h-4 w-4" />
          </summary>
          <div className="relative">
            <pre className="bg-gray-800 text-gray-100 p-4 rounded-md overflow-x-auto text-sm">
              <code>{`POST /api/requests
Authorization: Bearer <token>

{
  "createdBy": "John Doe",
  "projectName": "Site Deployment",
  "location": "Kampala",
  "items": [
    { "name": "Laptop", "requested": 2 },
    { "name": "Mouse", "requested": 5 }
  ],
  "selectedApproverIds": [3, 7]
}`}</code>
            </pre>
            <CopyButton code={`POST /api/requests\nAuthorization: Bearer <token>\n\n{\n  "createdBy": "John Doe",\n  "projectName": "Site Deployment",\n  "location": "Kampala",\n  "items": [\n    { "name": "Laptop", "requested": 2 },\n    { "name": "Mouse", "requested": 5 }\n  ],\n  "selectedApproverIds": [3, 7]\n}`} />
          </div>
        </details>
      </>
    )
  },
  {
    id: 6,
    icon: CheckCircle,
    title: 'Approving Requests (Approver)',
    content: (
      <>
        <ul className="space-y-2 list-disc pl-5 mb-4">
          <li>Go to <strong>Pending Approvals</strong></li>
          <li>Only requests assigned to you appear</li>
          <li>Review items, quantities, purpose</li>
          <li>Click <strong>Approve</strong> or <strong>Reject with reason</strong></li>
          <li>Once approved, moves to <strong>Approved Forms</strong></li>
        </ul>
        <details className="mt-4 p-3 bg-gray-100 rounded-lg">
          <summary className="cursor-pointer font-medium text-blue-600 mb-2 flex items-center gap-1">
            API: Approve Request
            <ChevronDown className="h-4 w-4" />
          </summary>
          <div className="relative">
            <pre className="bg-gray-800 text-gray-100 p-4 rounded-md overflow-x-auto text-sm">
              <code>{`POST /api/requests/123/approve
Authorization: Bearer <token>

{
  "approverName": "Jane Approver",
  "signature": "data:image/png;base64,..."
}`}</code>
            </pre>
            <CopyButton code={`POST /api/requests/123/approve\nAuthorization: Bearer <token>\n\n{\n  "approverName": "Jane Approver",\n  "signature": "data:image/png;base64,..."\n}`} />
          </div>
        </details>
      </>
    )
  },
  {
    id: 7,
    icon: ArrowUpRight,
    title: 'Issuing Items (Issuer)',
    content: (
      <>
        <ul className="space-y-2 list-disc pl-5 mb-4">
          <li>Go to <strong>Approved Forms</strong></li>
          <li>Select request → click <strong>Issue Items</strong></li>
          <li>Enter <strong>quantity issued</strong> per item</li>
          <li>Stock deducts automatically</li>
          <li>Record saved in <strong>Items Out</strong></li>
        </ul>
        <details className="mt-4 p-3 bg-gray-100 rounded-lg">
          <summary className="cursor-pointer font-medium text-blue-600 mb-2 flex items-center gap-1">
            API: Finalize Issue
            <ChevronDown className="h-4 w-4" />
          </summary>
          <div className="relative">
            <pre className="bg-gray-800 text-gray-100 p-4 rounded-md overflow-x-auto text-sm">
              <code>{`POST /api/requests/123/finalize
Authorization: Bearer <token>

{
  "items": [
    { "itemId": 5, "quantityReceived": 2 }
  ],
  "releasedBy": "Issuer Name"
}`}</code>
            </pre>
            <CopyButton code={`POST /api/requests/123/finalize\nAuthorization: Bearer <token>\n\n{\n  "items": [\n    { "itemId": 5, "quantityReceived": 2 }\n  ],\n  "releasedBy": "Issuer Name"\n}`} />
          </div>
        </details>
      </>
    )
  },
  {
    id: 8,
    icon: RotateCcw,
    title: 'Returning Items',
    content: (
      <>
        <ul className="space-y-2 list-disc pl-5 mb-4">
          <li>Create a <strong>Return Request</strong> via form</li>
          <li>Or use <strong>Item Returns</strong> tab</li>
          <li>Stock increases on approval + finalize</li>
          <li>Full audit trail maintained</li>
        </ul>
        <details className="mt-4 p-3 bg-gray-100 rounded-lg">
          <summary className="cursor-pointer font-medium text-blue-600 mb-2 flex items-center gap-1">
            API: Return Request
            <ChevronDown className="h-4 w-4" />
          </summary>
          <div className="relative">
            <pre className="bg-gray-800 text-gray-100 p-4 rounded-md overflow-x-auto text-sm">
              <code>{`POST /api/requests
Authorization: Bearer <token>

{
  "type": "item_return",
  "items": [
    { "name": "Laptop", "requested": 1 }
  ],
  "reason": "Project completed",
  "selectedApproverIds": [3]
}`}</code>
            </pre>
            <CopyButton code={`POST /api/requests\nAuthorization: Bearer <token>\n\n{\n  "type": "item_return",\n  "items": [\n    { "name": "Laptop", "requested": 1 }\n  ],\n  "reason": "Project completed",\n  "selectedApproverIds": [3]\n}`} />
          </div>
        </details>
      </>
    )
  },
  {
    id: 9,
    icon: AlertTriangle,
    title: 'Low Stock Alerts',
    content: (
      <>
        <ul className="space-y-2 list-disc pl-5 mb-4">
          <li>Auto-triggered when quantity ≤ threshold</li>
          <li>Email sent to admins/supervisors</li>
          <li>View in <strong>Low Stock</strong> tab</li>
        </ul>
        <details className="mt-4 p-3 bg-gray-100 rounded-lg">
          <summary className="cursor-pointer font-medium text-blue-600 mb-2 flex items-center gap-1">
            API: Get Low Stock
            <ChevronDown className="h-4 w-4" />
          </summary>
          <div className="relative">
            <pre className="bg-gray-800 text-gray-100 p-4 rounded-md overflow-x-auto text-sm">
              <code>{`GET /api/items/low-stock
Authorization: Bearer <token>`}</code>
            </pre>
            <CopyButton code={`GET /api/items/low-stock\nAuthorization: Bearer <token>`} />
          </div>
        </details>
      </>
    )
  },
  {
    id: 10,
    icon: BarChart3,
    title: 'Reports & Audit Logs (Admin)',
    content: (
      <>
        <ul className="space-y-2 list-disc pl-5 mb-4">
          <li><strong>Reports</strong>: Stock levels, usage, requests</li>
          <li><strong>Audit Logs</strong>: Every action logged with IP, user, timestamp</li>
          <li>Export as CSV</li>
        </ul>
        <details className="mt-4 p-3 bg-gray-100 rounded-lg">
          <summary className="cursor-pointer font-medium text-blue-600 mb-2 flex items-center gap-1">
            API: Get Audit Logs
            <ChevronDown className="h-4 w-4" />
          </summary>
          <div className="relative">
            <pre className="bg-gray-800 text-gray-100 p-4 rounded-md overflow-x-auto text-sm">
              <code>{`GET /api/audit-logs?limit=50
Authorization: Bearer <token>`}</code>
            </pre>
            <CopyButton code={`GET /api/audit-logs?limit=50\nAuthorization: Bearer <token>`} />
          </div>
        </details>
      </>
    )
  },
  {
    id: 11,
    icon: Settings,
    title: 'Settings & User Management (Super Admin)',
    content: (
      <>
        <ul className="space-y-2 list-disc pl-5 mb-4">
          <li><strong>Users</strong>: Add, edit, reset password, change role</li>
          <li><strong>Settings</strong>: Email sender, thresholds</li>
          <li><strong>Backup/Restore</strong>: Requires developer code</li>
        </ul>
        <details className="mt-4 p-3 bg-gray-100 rounded-lg">
          <summary className="cursor-pointer font-medium text-blue-600 mb-2 flex items-center gap-1">
            API: Create User
            <ChevronDown className="h-4 w-4" />
          </summary>
          <div className="relative">
            <pre className="bg-gray-800 text-gray-100 p-4 rounded-md overflow-x-auto text-sm">
              <code>{`POST /api/users
Authorization: Bearer <token>

{
  "firstName": "Alice",
  "lastName": "Johnson",
  "email": "alice@vobiss.com",
  "role": "approver"
}`}</code>
            </pre>
            <CopyButton code={`POST /api/users\nAuthorization: Bearer <token>\n\n{\n  "firstName": "Alice",\n  "lastName": "Johnson",\n  "email": "alice@vobiss.com",\n  "role": "approver"\n}`} />
          </div>
        </details>
      </>
    )
  },
  {
    id: 12,
    icon: Bot,
    title: 'AI Assistant (Coming Soon)',
    content: (
      <p className="text-gray-600">
        Ask questions like: <em>“Show low stock items”</em> or <em>“Who issued laptops last week?”</em><br />
        Powered by Grok — natural language interface.
      </p>
    )
  },
  {
    id: 13,
    icon: Mail,
    title: 'Email Notifications',
    content: (
      <>
        <ul className="space-y-2 list-disc pl-5 mb-4">
          <li>Low stock alerts</li>
          <li>New request assignments</li>
          <li>Approval status changes</li>
          <li>User credential emails</li>
        </ul>
        <p className="text-sm text-gray-600">Configured in <strong>Settings → Email</strong></p>
      </>
    )
  },
  {
    id: 14,
    icon: BookOpen,
    title: 'Best Practices',
    content: (
      <ul className="space-y-2 list-disc pl-5 mb-4 text-sm">
        <li>Use <strong>descriptive request reasons</strong></li>
        <li>Return items <strong>promptly</strong> after use</li>
        <li>Update item details on <strong>every stock change</strong></li>
        <li>Log out on shared devices</li>
        <li>Report issues to <code>stockadmin</code></li>
      </ul>
    )
  },
  {
    id: 15,
    icon: HelpCircle,
    title: 'Need Help?',
    content: (
      <>
        <p className="mb-3">Contact:</p>
        <ul className="space-y-1 text-sm">
          <li><strong>Super Admin:</strong> <code>stockadmin</code></li>
          <li><strong>Email:</strong> support@vobiss.com</li>
          <li><strong>Guide:</strong> Reopen via sidebar anytime</li>
        </ul>
      </>
    )
  }
];

const SystemGuide = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [openSections, setOpenSections] = useState<Set<number>>(new Set([1]));

  const toggleSection = (id: number) => {
    setOpenSections(prev => {
      const newSet = new Set(prev);
      newSet.has(id) ? newSet.delete(id) : newSet.add(id);
      return newSet;
    });
  };

  const filteredSections = sections.filter(s =>
    s.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-20 bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                VOBISS INVENTORY SYSTEM
              </h1>
              <p className="text-sm text-blue-600 font-medium">USER GUIDE v2.0</p>
            </div>
            <div className="relative max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search guide..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <p className="text-base text-gray-600 mb-8 leading-relaxed">
          Welcome to the updated Vobiss Inventory System. This guide reflects the latest features including 
          multi-approver workflows, return requests, and full audit logging.
        </p>

        {filteredSections.length === 0 && searchTerm && (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm border">
            <p className="text-lg text-gray-500">No sections found. Try different keywords.</p>
          </div>
        )}

        <div className="space-y-4">
          {filteredSections.map(section => {
            const Icon = section.icon;
            return (
              <div key={section.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left bg-gradient-to-r from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 text-gray-600" />
                    <span className="text-lg font-semibold text-gray-900">
                      {section.id}. {section.title}
                    </span>
                  </div>
                  {openSections.has(section.id) ? (
                    <ChevronUp className="h-5 w-5 text-gray-500" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-500" />
                  )}
                </button>
                {openSections.has(section.id) && (
                  <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
                    <div className="prose prose-sm max-w-none text-gray-700">
                      {section.content}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {searchTerm && (
          <p className="mt-6 text-sm text-gray-500 text-right">
            Showing {filteredSections.length} of {sections.length} sections
          </p>
        )}
      </main>
    </div>
  );
};

export default SystemGuide;