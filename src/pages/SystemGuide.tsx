// Updated SystemGuide.tsx with CopyButton moved before sections to fix initialization error
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
  HelpCircle
} from 'lucide-react';

// Simple CopyButton Component (moved before sections)
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
      className="absolute top-2 right-2 bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded text-xs transition-colors"
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
      <ul className="space-y-2 list-disc pl-5">
        <li>Access the login page.</li>
        <li>Enter username and password.</li>
        <li>Click <strong>Login</strong> for dashboard.</li>
        <li>Contact admin for forgotten credentials.</li>
      </ul>
    )
  },
  {
    id: 2,
    icon: LayoutDashboard,
    title: 'Dashboard Overview',
    content: (
      <>
        <p className="mb-4">Quick summary includes:</p>
        <ul className="space-y-2 list-disc pl-5 mb-4">
          <li>Total stock count.</li>
          <li>Pending/approved requests.</li>
          <li>Low-stock alerts.</li>
          <li>Recent issues/returns.</li>
        </ul>
        <p>Navigate via sidebar.</p>
      </>
    )
  },
  {
    id: 3,
    icon: Users,
    title: 'User Roles',
    content: (
      <>
        <p className="mb-4">Permissions by role:</p>
        <ul className="space-y-2 list-disc pl-5">
          <li><strong>Requester:</strong> Submit requests.</li>
          <li><strong>Approver:</strong> Approve/reject requests.</li>
          <li><strong>Issuer:</strong> Issue items and handle returns.</li>
          <li><strong>Super Admin:</strong> Full access to users, settings, reports, logs.</li>
        </ul>
      </>
    )
  },
  {
    id: 4,
    icon: Package,
    title: 'Managing Inventory',
    content: (
      <>
        <ul className="space-y-2 list-disc pl-5 mb-4">
          <li>View items in <strong>Inventory</strong>.</li>
          <li>Issuers/admins: add/edit/delete items.</li>
          <li>Organize via <strong>Categories</strong>.</li>
          <li>Monitor quantities in real time.</li>
        </ul>
        {/* Interactive Code Example: Adding an Item (Admin) */}
        <details className="mt-4 p-3 bg-gray-100 rounded-lg">
          <summary className="cursor-pointer font-medium text-blue-600 mb-2 flex items-center space-x-1">
            <span>Interactive Example: API Call to Add Item</span>
            <ChevronDown className="h-4 w-4" />
          </summary>
          <div className="relative">
            <pre className="bg-gray-800 text-gray-100 p-4 rounded-md overflow-x-auto text-sm">
              <code>{`POST /api/items
{
  "name": "Laptop",
  "category_id": 1,
  "quantity": 10,
  "threshold": 5
}`}</code>
            </pre>
            <CopyButton code={`POST /api/items\n{\n  "name": "Laptop",\n  "category_id": 1,\n  "quantity": 10,\n  "threshold": 5\n}`} />
          </div>
          <p className="text-xs text-gray-500 mt-2">Copy and use in API client like Postman.</p>
        </details>
      </>
    )
  },
  {
    id: 5,
    icon: FileText,
    title: 'Making a Request (Requester Role)',
    content: (
      <>
        <ul className="space-y-2 list-disc pl-5 mb-4">
          <li>Go to <strong>Request Forms</strong>.</li>
          <li>Enter item, quantity, purpose.</li>
          <li>Select approver and submit.</li>
          <li>Track requests on the page.</li>
        </ul>
        {/* Interactive Code Example: Submitting a Request */}
        <details className="mt-4 p-3 bg-gray-100 rounded-lg">
          <summary className="cursor-pointer font-medium text-blue-600 mb-2 flex items-center space-x-1">
            <span>Interactive Example: API Call to Submit Request</span>
            <ChevronDown className="h-4 w-4" />
          </summary>
          <div className="relative">
            <pre className="bg-gray-800 text-gray-100 p-4 rounded-md overflow-x-auto text-sm">
              <code>{`POST /api/requests
{
  "item_id": 123,
  "quantity": 2,
  "purpose": "Project work",
  "approver_id": 456
}`}</code>
            </pre>
            <CopyButton code={`POST /api/requests\n{\n  "item_id": 123,\n  "quantity": 2,\n  "purpose": "Project work",\n  "approver_id": 456\n}`} />
          </div>
          <p className="text-xs text-gray-500 mt-2">Simulate request submission.</p>
        </details>
      </>
    )
  },
  {
    id: 6,
    icon: CheckCircle,
    title: 'Approving Requests (Approver Role)',
    content: (
      <>
        <ul className="space-y-2 list-disc pl-5 mb-4">
          <li>Access <strong>Pending Approvals</strong>.</li>
          <li>Review request details.</li>
          <li>Approve or reject instantly.</li>
          <li>Approved items route to <strong>Approved Forms</strong>.</li>
        </ul>
        {/* Interactive Code Example: Approving a Request */}
        <details className="mt-4 p-3 bg-gray-100 rounded-lg">
          <summary className="cursor-pointer font-medium text-blue-600 mb-2 flex items-center space-x-1">
            <span>Interactive Example: API Call to Approve Request</span>
            <ChevronDown className="h-4 w-4" />
          </summary>
          <div className="relative">
            <pre className="bg-gray-800 text-gray-100 p-4 rounded-md overflow-x-auto text-sm">
              <code>{`PATCH /api/requests/789/approve
{
  "notes": "Approved for immediate use"
}`}</code>
            </pre>
            <CopyButton code={`PATCH /api/requests/789/approve\n{\n  "notes": "Approved for immediate use"\n}`} />
          </div>
          <p className="text-xs text-gray-500 mt-2">Approve a pending request via API.</p>
        </details>
      </>
    )
  },
  {
    id: 7,
    icon: ArrowUpRight,
    title: 'Issuing Items (Issuer Role)',
    content: (
      <>
        <ul className="space-y-2 list-disc pl-5 mb-4">
          <li>Check <strong>Approved Forms</strong>.</li>
          <li>Confirm issue; stock deducts automatically.</li>
          <li>Records saved for tracking.</li>
        </ul>
        {/* Interactive Code Example: Issuing an Item */}
        <details className="mt-4 p-3 bg-gray-100 rounded-lg">
          <summary className="cursor-pointer font-medium text-blue-600 mb-2 flex items-center space-x-1">
            <span>Interactive Example: API Call to Issue Item</span>
            <ChevronDown className="h-4 w-4" />
          </summary>
          <div className="relative">
            <pre className="bg-gray-800 text-gray-100 p-4 rounded-md overflow-x-auto text-sm">
              <code>{`POST /api/issues
{
  "request_id": 789,
  "issued_quantity": 2
}`}</code>
            </pre>
            <CopyButton code={`POST /api/issues\n{\n  "request_id": 789,\n  "issued_quantity": 2\n}`} />
          </div>
          <p className="text-xs text-gray-500 mt-2">Issue approved items.</p>
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
          <li>Navigate to <strong>Item Returns</strong>.</li>
          <li>Enter item, quantity, reason.</li>
          <li>Submit; stock updates automatically.</li>
          <li>Record logged for reports/audits.</li>
        </ul>
        {/* Interactive Code Example: Returning an Item */}
        <details className="mt-4 p-3 bg-gray-100 rounded-lg">
          <summary className="cursor-pointer font-medium text-blue-600 mb-2 flex items-center space-x-1">
            <span>Interactive Example: API Call to Return Item</span>
            <ChevronDown className="h-4 w-4" />
          </summary>
          <div className="relative">
            <pre className="bg-gray-800 text-gray-100 p-4 rounded-md overflow-x-auto text-sm">
              <code>{`POST /api/returns
{
  "issue_id": 101,
  "returned_quantity": 1,
  "reason": "Unused"
}`}</code>
            </pre>
            <CopyButton code={`POST /api/returns\n{\n  "issue_id": 101,\n  "returned_quantity": 1,\n  "reason": "Unused"\n}`} />
          </div>
          <p className="text-xs text-gray-500 mt-2">Process a return via API.</p>
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
          <li>Auto-email on low thresholds to supervisors/admins.</li>
          <li>View items in <strong>Low Stock Alerts</strong>.</li>
        </ul>
        {/* Interactive Code Example: Fetching Low Stock */}
        <details className="mt-4 p-3 bg-gray-100 rounded-lg">
          <summary className="cursor-pointer font-medium text-blue-600 mb-2 flex items-center space-x-1">
            <span>Interactive Example: API Call to Get Low Stock</span>
            <ChevronDown className="h-4 w-4" />
          </summary>
          <div className="relative">
            <pre className="bg-gray-800 text-gray-100 p-4 rounded-md overflow-x-auto text-sm">
              <code>{`GET /api/low-stock`}</code>
            </pre>
            <CopyButton code={`GET /api/low-stock`} />
          </div>
          <p className="text-xs text-gray-500 mt-2">Retrieve low stock items.</p>
        </details>
      </>
    )
  },
  {
    id: 10,
    icon: BarChart3,
    title: 'Reports & Audit Logs (Admin Only)',
    content: (
      <>
        <ul className="space-y-2 list-disc pl-5 mb-4">
          <li><strong>Reports:</strong> Stock, requests, usage data.</li>
          <li><strong>Audit Logs:</strong> All actions tracked.</li>
        </ul>
        {/* Interactive Code Example: Fetching Reports */}
        <details className="mt-4 p-3 bg-gray-100 rounded-lg">
          <summary className="cursor-pointer font-medium text-blue-600 mb-2 flex items-center space-x-1">
            <span>Interactive Example: API Call for Reports</span>
            <ChevronDown className="h-4 w-4" />
          </summary>
          <div className="relative">
            <pre className="bg-gray-800 text-gray-100 p-4 rounded-md overflow-x-auto text-sm">
              <code>{`GET /api/reports?type=monthly`}</code>
            </pre>
            <CopyButton code={`GET /api/reports?type=monthly`} />
          </div>
          <p className="text-xs text-gray-500 mt-2">Generate monthly reports.</p>
        </details>
      </>
    )
  },
  {
    id: 11,
    icon: Settings,
    title: 'Settings and User Management (Super Admin)',
    content: (
      <>
        <ul className="space-y-2 list-disc pl-5 mb-4">
          <li><strong>Settings:</strong> Company details, thresholds, notifications.</li>
          <li><strong>Users:</strong> Add/edit/deactivate accounts.</li>
          <li><strong>Supervisors:</strong> Manage approvers.</li>
        </ul>
        {/* Interactive Code Example: Adding a User */}
        <details className="mt-4 p-3 bg-gray-100 rounded-lg">
          <summary className="cursor-pointer font-medium text-blue-600 mb-2 flex items-center space-x-1">
            <span>Interactive Example: API Call to Add User</span>
            <ChevronDown className="h-4 w-4" />
          </summary>
          <div className="relative">
            <pre className="bg-gray-800 text-gray-100 p-4 rounded-md overflow-x-auto text-sm">
              <code>{`POST /api/users
{
  "username": "newuser",
  "role": "requester",
  "email": "user@example.com"
}`}</code>
            </pre>
            <CopyButton code={`POST /api/users\n{\n  "username": "newuser",\n  "role": "requester",\n  "email": "user@example.com"\n}`} />
          </div>
          <p className="text-xs text-gray-500 mt-2">Add a new user account.</p>
        </details>
      </>
    )
  },
  {
    id: 12,
    icon: Bot,
    title: 'AI Assistant',
    content: (
      <>
        <p className="mb-4">Analyze trends or get help via <strong>AI Assistant</strong>.</p>
        <p>Query examples: “Low stock items?” or “Last month’s requests.”</p>
        {/* Interactive Code Example: AI Query */}
        <details className="mt-4 p-3 bg-gray-100 rounded-lg">
          <summary className="cursor-pointer font-medium text-blue-600 mb-2 flex items-center space-x-1">
            <span>Interactive Example: Sample AI Query</span>
            <ChevronDown className="h-4 w-4" />
          </summary>
          <div className="relative">
            <pre className="bg-gray-800 text-gray-100 p-4 rounded-md overflow-x-auto text-sm">
              <code>{`Query: "Show low stock items"

Response: Items below threshold: Laptop (3/5), Mouse (1/2)`}</code>
            </pre>
            <CopyButton code={`Query: "Show low stock items"\n\nResponse: Items below threshold: Laptop (3/5), Mouse (1/2)`} />
          </div>
          <p className="text-xs text-gray-500 mt-2">Example interaction with AI.</p>
        </details>
      </>
    )
  },
  {
    id: 13,
    icon: Mail,
    title: 'Email Notifications',
    content: (
      <>
        <ul className="space-y-2 list-disc pl-5 mb-4">
          <li>Auto-emails for alerts/updates (SMTP required).</li>
          <li>Verify email for notifications.</li>
        </ul>
      </>
    )
  },
  {
    id: 14,
    icon: BookOpen,
    title: 'Best Practices',
    content: (
      <>
        <ul className="space-y-2 list-disc pl-5 mb-4">
          <li>Log out after use.</li>
          <li>Avoid unauthorized stock edits.</li>
          <li>Check low-stock alerts regularly.</li>
          <li>Record returns promptly.</li>
          <li>Use descriptive request notes.</li>
        </ul>
      </>
    )
  },
  {
    id: 15,
    icon: HelpCircle,
    title: 'Getting Help',
    content: (
      <p className="mb-4">Contact admin/supervisor for issues. Revisit guide via sidebar.</p>
    )
  }
];

const SystemGuide = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [openSections, setOpenSections] = useState<Set<number>>(new Set([1])); // Open first section by default

  const toggleSection = (id: number) => {
    setOpenSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const filteredSections = sections.filter(section =>
    section.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Static Responsive Header */}
      <header className="sticky top-0 z-20 bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
            {/* Title */}
            <div className="flex flex-col">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                VOBISS INVENTORY SYSTEM
              </h1>
              <p className="text-sm text-blue-600 font-medium">USER GUIDE</p>
            </div>
            
            {/* Search Bar */}
            <div className="relative flex-1 max-w-md w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search sections (e.g., 'login' or 'requests')"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 shadow-sm"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <p className="text-base text-gray-600 mb-8 leading-relaxed">
          Welcome to the Vobiss Inventory System, a platform designed to help manage company inventory, process item requests, and handle approvals efficiently.
          This guide explains how to use the system based on your role and available features.
        </p>

        {/* No results */}
        {filteredSections.length === 0 && searchTerm && (
          <div className="text-center py-12 text-gray-500 bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="text-6xl mb-4 mx-auto">🔍</div>
            <p className="text-lg">No sections match your search. Try different keywords.</p>
          </div>
        )}

        {/* Sections */}
        <div className="space-y-4">
          {filteredSections.map((section) => {
            const Icon = section.icon;
            return (
              <div key={section.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow duration-200">
                {/* Header */}
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left bg-gradient-to-r from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 transition-all duration-200"
                >
                  <div className="flex items-center space-x-3">
                    <Icon className="h-5 w-5 text-gray-500 flex-shrink-0" />
                    <span className="text-lg font-semibold text-gray-900">
                      {section.id}. {section.title}
                    </span>
                  </div>
                  {openSections.has(section.id) ? (
                    <ChevronUp className="h-5 w-5 text-gray-500 transition-transform duration-200" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-500 transition-transform duration-200" />
                  )}
                </button>
                {/* Content */}
                {openSections.has(section.id) && (
                  <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
                    <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed">
                      {section.content}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Results count */}
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