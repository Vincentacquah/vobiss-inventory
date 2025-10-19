// New UsersPage.tsx (add to src/pages/)
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUsers, createUser, resetUserPassword, updateUserRole } from '../api'; // Assume api.ts has these

const UsersPage: React.FC = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [formData, setFormData] = useState({ first_name: '', last_name: '', email: '', role: 'requester' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await createUser(formData.first_name, formData.last_name, formData.email, formData.role);
      loadUsers();
      setFormData({ first_name: '', last_name: '', email: '', role: 'requester' });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (userId: number) => {
    if (!confirm('Reset password and send new one via email?')) return;
    try {
      await resetUserPassword(userId);
      alert('Password reset and emailed');
    } catch (err: any) {
      alert('Failed to reset password');
    }
  };

  const handleRoleChange = async (userId: number, newRole: string) => {
    try {
      await updateUserRole(userId, newRole);
      loadUsers();
    } catch (err: any) {
      alert('Failed to update role');
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">User Management</h1>
      
      {/* Add User Form */}
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-xl font-semibold mb-4">Create New User</h2>
        <div className="grid grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="First Name"
            value={formData.first_name}
            onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
            className="p-2 border rounded"
            required
          />
          <input
            type="text"
            placeholder="Last Name"
            value={formData.last_name}
            onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
            className="p-2 border rounded"
            required
          />
          <input
            type="email"
            placeholder="Email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="p-2 border rounded"
            required
          />
          <select
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            className="p-2 border rounded"
          >
            <option value="requester">Requester</option>
            <option value="approver">Approver</option>
            <option value="issuer">Issuer</option>
            <option value="superadmin">Super Admin</option>
          </select>
        </div>
        <button type="submit" disabled={loading} className="mt-4 bg-blue-500 text-white px-4 py-2 rounded">
          {loading ? 'Creating...' : 'Create User'}
        </button>
        {error && <p className="text-red-500 mt-2">{error}</p>}
      </form>

      {/* Users List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Full Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((u: any) => (
              <tr key={u.id}>
                <td className="px-6 py-4 whitespace-nowrap">{u.first_name} {u.last_name}</td>
                <td className="px-6 py-4 whitespace-nowrap">{u.username}</td>
                <td className="px-6 py-4 whitespace-nowrap">{u.email}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <select
                    value={u.role}
                    onChange={(e) => handleRoleChange(u.id, e.target.value)}
                    className="p-1 border rounded text-sm"
                  >
                    <option value="requester">Requester</option>
                    <option value="approver">Approver</option>
                    <option value="issuer">Issuer</option>
                    <option value="superadmin">Super Admin</option>
                  </select>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => handleResetPassword(u.id)}
                    className="text-indigo-600 hover:text-indigo-900 mr-4"
                  >
                    Reset Password
                  </button>
                  {/* Add delete if needed */}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UsersPage;