import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUsers, createUser, resetUserPassword, updateUserRole, updateUser, deleteUser } from '../api';
import { UserPlus, Mail, Key, Users, AlertCircle, X, CheckCircle, Edit, Trash2, Crown } from 'lucide-react';

const UsersPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [formData, setFormData] = useState({ first_name: '', last_name: '', email: '', role: 'requester' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [deletingUser, setDeletingUser] = useState<any>(null);
  const [resetting, setResetting] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editFormData, setEditFormData] = useState({ first_name: '', last_name: '', email: '', role: 'requester' });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (err) {
      setError('Failed to load users');
    }
  };

  // FIXED: Correct parameter order for createUser
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await createUser(
        formData.first_name.trim(),
        formData.last_name.trim(),
        formData.email.trim(),
        formData.role
      );
      await loadUsers();
      setFormData({ first_name: '', last_name: '', email: '', role: 'requester' });
      setSuccess('User created successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  const openResetModal = (userToReset: any) => {
    if (userToReset.role === 'superadmin') {
      setError('Cannot reset password for Super Admin');
      setTimeout(() => setError(''), 3000);
      return;
    }
    setSelectedUser(userToReset);
    setShowResetModal(true);
  };

  const closeResetModal = () => {
    setShowResetModal(false);
    setSelectedUser(null);
  };

  const confirmResetPassword = async () => {
    if (!selectedUser) return;
    setResetting(true);
    try {
      await resetUserPassword(selectedUser.id);
      setSuccess(`Password reset email sent to ${selectedUser.email}`);
      setTimeout(() => setSuccess(''), 3000);
      closeResetModal();
    } catch (err: any) {
      setError('Failed to reset password');
      setTimeout(() => setError(''), 3000);
    } finally {
      setResetting(false);
    }
  };

  const openEditModal = (userToEdit: any) => {
    if (userToEdit.username === 'superadmin') {
      setError('Cannot edit Super Admin');
      setTimeout(() => setError(''), 3000);
      return;
    }
    setEditingUser(userToEdit);
    setEditFormData({
      first_name: userToEdit.first_name || '',
      last_name: userToEdit.last_name || '',
      email: userToEdit.email || '',
      role: userToEdit.role || 'requester'
    });
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingUser(null);
    setEditFormData({ first_name: '', last_name: '', email: '', role: 'requester' });
  };

  // FIXED: Proper syntax + correct object structure
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setUpdating(true);
    setError('');
    setSuccess('');
    try {
      await updateUser(editingUser.id, {
        first_name: editFormData.first_name.trim(),
        last_name: editFormData.last_name.trim(),
        email: editFormData.email.trim(),
        role: editFormData.role
      });
      await loadUsers();
      setSuccess('User updated successfully');
      setTimeout(() => setSuccess(''), 3000);
      closeEditModal();
    } catch (err: any) {
      setError(err.message || 'Failed to update user');
    } finally {
      setUpdating(false);
    }
  };

  const openDeleteModal = (userToDelete: any) => {
    if (userToDelete.id === currentUser?.id) {
      setError('Cannot delete your own account');
      setTimeout(() => setError(''), 3000);
      return;
    }
    if (userToDelete.username === 'Superadmin') {
      setError('Cannot delete Super Admin');
      setTimeout(() => setError(''), 3000);
      return;
    }
    setDeletingUser(userToDelete);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setDeletingUser(null);
  };

  const confirmDeleteUser = async () => {
    if (!deletingUser) return;
    setDeleting(true);
    setError('');
    setSuccess('');
    try {
      await deleteUser(deletingUser.id);
      await loadUsers();
      setSuccess('User deleted successfully');
      setTimeout(() => setSuccess(''), 3000);
      closeDeleteModal();
    } catch (err: any) {
      setError(err.message || 'Failed to delete user');
    } finally {
      setDeleting(false);
    }
  };

  const handleRoleChange = async (userId: number, newRole: string) => {
    try {
      await updateUserRole(userId, newRole);
      await loadUsers();
      setSuccess('Role updated successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError('Failed to update role');
      setTimeout(() => setError(''), 3000);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    const colors = {
      superadmin: 'bg-purple-100 text-purple-800 border-purple-200',
      approver: 'bg-blue-100 text-blue-800 border-blue-200',
      issuer: 'bg-green-100 text-green-800 border-green-200',
      requester: 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return colors[role] || colors.requester;
  };

  const isMainSuperadmin = (u: any) => u.username === 'superadmin';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-6 h-6 text-slate-700" />
            <h1 className="text-2xl font-bold text-slate-800">User Management</h1>
          </div>
          <p className="text-slate-600 text-sm">Manage user accounts, roles, and permissions</p>
        </div>

        {/* Alert Messages */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}
        
        {success && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
            <p className="text-green-800 text-sm">{success}</p>
          </div>
        )}

        {/* Create User Form */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 mb-6 overflow-hidden">
          <div className="bg-gradient-to-r from-gray-600 to-gray-700 px-4 py-3">
            <div className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-white" />
              <h2 className="text-lg font-semibold text-white">Create New User</h2>
            </div>
          </div>
          
          <div className="p-4">
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    placeholder="Enter first name"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none transition"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    placeholder="Enter last name"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none transition"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      placeholder="user@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none transition"
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    User Role
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none transition bg-white"
                    required
                  >
                    <option value="requester">Requester</option>
                    <option value="approver">Approver</option>
                    <option value="issuer">Issuer</option>
                    <option value="superadmin">Super Admin</option>
                  </select>
                </div>
              </div>
              
              <button 
                type="submit"
                disabled={loading || !formData.first_name || !formData.last_name || !formData.email}
                className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white font-medium px-4 py-2 rounded-md transition duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <UserPlus className="w-3 h-3" />
                {loading ? 'Creating User...' : 'Create User'}
              </button>
            </form>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
            <h2 className="text-base font-semibold text-slate-800">All Users ({users.length})</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Username
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500 text-sm">
                      No users found. Create your first user above.
                    </td>
                  </tr>
                ) : (
                  users.map((u: any) => (
                    <tr key={u.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-8 w-8 bg-gradient-to-br from-gray-500 to-gray-600 rounded-full flex items-center justify-center">
                            <span className="text-white font-semibold text-xs">
                              {u.first_name?.charAt(0)}{u.last_name?.charAt(0)}
                            </span>
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-slate-900">
                              {u.first_name} {u.last_name}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-slate-900">{u.username}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-slate-600">{u.email}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isMainSuperadmin(u) ? (
                          <span className={`text-xs font-medium px-2 py-1 rounded-full border ${getRoleBadgeColor(u.role)} flex items-center`}>
                            Super Admin <Crown className="w-3 h-3 ml-1" />
                          </span>
                        ) : (
                          <select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            className={`text-xs font-medium px-2 py-1 rounded-full border ${getRoleBadgeColor(u.role)} cursor-pointer hover:opacity-80 transition`}
                          >
                            <option value="requester">Requester</option>
                            <option value="approver">Approver</option>
                            <option value="issuer">Issuer</option>
                            <option value="superadmin">Super Admin</option>
                          </select>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEditModal(u)}
                            disabled={isMainSuperadmin(u)}
                            className={`${isMainSuperadmin(u) ? 'text-blue-300 cursor-not-allowed' : 'text-blue-600 hover:text-blue-800'} font-medium transition flex items-center gap-1 text-xs`}
                          >
                            <Edit className="w-3 h-3" />
                            Edit
                          </button>
                          <button
                            onClick={() => openResetModal(u)}
                            disabled={u.role === 'superadmin'}
                            className={`${u.role === 'superadmin' ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:text-gray-800'} font-medium transition flex items-center gap-1 text-xs`}
                          >
                            <Key className="w-3 h-3" />
                            Reset
                          </button>
                          <button
                            onClick={() => openDeleteModal(u)}
                            disabled={isMainSuperadmin(u)}
                            className={`${isMainSuperadmin(u) ? 'text-red-300 cursor-not-allowed' : 'text-red-600 hover:text-red-800'} font-medium transition flex items-center gap-1 text-xs`}
                          >
                            <Trash2 className="w-3 h-3" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Reset Password Modal */}
        {showResetModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 z-50">
            <div className="bg-white rounded-lg shadow-2xl max-w-sm w-full overflow-hidden">
              <div className="bg-gradient-to-r from-gray-600 to-gray-700 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="bg-white bg-opacity-20 p-1.5 rounded-md">
                    <Key className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">Reset Password</h3>
                </div>
                <button
                  onClick={closeResetModal}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-md p-1 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="p-4">
                <div className="mb-4">
                  <p className="text-slate-700 mb-3 text-sm">
                    You are about to reset the password for:
                  </p>
                  <div className="bg-slate-50 rounded-md p-3 border border-slate-200">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-br from-gray-500 to-gray-600 rounded-full flex items-center justify-center">
                        <span className="text-white font-semibold text-sm">
                          {selectedUser?.first_name?.charAt(0)}{selectedUser?.last_name?.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-900">
                          {selectedUser?.first_name} {selectedUser?.last_name}
                        </div>
                        <div className="text-xs text-slate-600">{selectedUser?.email}</div>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 mt-3">
                    A new temporary password will be generated and sent to the user's email address.
                  </p>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={closeResetModal}
                    disabled={resetting}
                    className="flex-1 px-3 py-2 border border-slate-300 text-slate-700 font-medium rounded-md hover:bg-slate-50 transition disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmResetPassword}
                    disabled={resetting}
                    className="flex-1 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white font-medium px-3 py-2 rounded-md transition shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {resetting ? 'Resetting...' : 'Confirm Reset'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit User Modal */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 z-50">
            <div className="bg-white rounded-lg shadow-2xl max-w-md w-full overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="bg-white bg-opacity-20 p-1.5 rounded-md">
                    <Edit className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">Edit User</h3>
                </div>
                <button
                  onClick={closeEditModal}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-md p-1 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="p-4">
                <form onSubmit={handleEditSubmit}>
                  <div className="space-y-3 mb-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">First Name</label>
                      <input
                        type="text"
                        value={editFormData.first_name}
                        onChange={(e) => setEditFormData({ ...editFormData, first_name: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Last Name</label>
                      <input
                        type="text"
                        value={editFormData.last_name}
                        onChange={(e) => setEditFormData({ ...editFormData, last_name: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Email Address</label>
                      <input
                        type="email"
                        value={editFormData.email}
                        onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">User Role</label>
                      <select
                        value={editFormData.role}
                        onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white"
                        required
                      >
                        <option value="requester">Requester</option>
                        <option value="approver">Approver</option>
                        <option value="issuer">Issuer</option>
                        <option value="superadmin">Super Admin</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={closeEditModal}
                      disabled={updating}
                      className="flex-1 px-3 py-2 border border-slate-300 text-slate-700 font-medium rounded-md hover:bg-slate-50 transition disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={updating || !editFormData.first_name || !editFormData.last_name || !editFormData.email}
                      className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium px-3 py-2 rounded-md transition shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {updating ? 'Updating...' : 'Update User'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Delete User Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 z-50">
            <div className="bg-white rounded-lg shadow-2xl max-w-sm w-full overflow-hidden">
              <div className="bg-gradient-to-r from-red-600 to-red-700 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="bg-white bg-opacity-20 p-1.5 rounded-md">
                    <Trash2 className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">Delete User</h3>
                </div>
                <button
                  onClick={closeDeleteModal}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-md p-1 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="p-4">
                <div className="mb-4">
                  <p className="text-slate-700 mb-3 text-sm">
                    You are about to permanently delete this user:
                  </p>
                  <div className="bg-slate-50 rounded-md p-3 border border-slate-200">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-br from-gray-500 to-gray-600 rounded-full flex items-center justify-center">
                        <span className="text-white font-semibold text-sm">
                          {deletingUser?.first_name?.charAt(0)}{deletingUser?.last_name?.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-900">
                          {deletingUser?.first_name} {deletingUser?.last_name}
                        </div>
                        <div className="text-xs text-slate-600">{deletingUser?.email}</div>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-red-600 mt-3">
                    This action cannot be undone. Are you sure?
                  </p>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={closeDeleteModal}
                    disabled={deleting}
                    className="flex-1 px-3 py-2 border border-slate-300 text-slate-700 font-medium rounded-md hover:bg-slate-50 transition disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDeleteUser}
                    disabled={deleting}
                    className="flex-1 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-medium px-3 py-2 rounded-md transition shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deleting ? 'Deleting...' : 'Confirm Delete'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UsersPage;