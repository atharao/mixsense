import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { authApi, CreateUserRequest, UpdateUserRequest } from '../api/auth.api';
import { User } from '../types/models';

const UserManagement: React.FC = () => {
  const currentUser = useSelector((state: RootState) => state.auth.user);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'OPERATOR'>('OPERATOR');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await authApi.getAllUsers();
      setUsers(response.data.data || []);
    } catch (error: any) {
      console.error('Error loading users:', error);
      alert(error.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setUsername(user.username);
      setRole(user.role as 'ADMIN' | 'OPERATOR');
      setPassword('');
    } else {
      setEditingUser(null);
      setUsername('');
      setPassword('');
      setRole('OPERATOR');
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingUser(null);
    setUsername('');
    setPassword('');
    setRole('OPERATOR');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!username.trim()) {
      alert('Please enter a username');
      return;
    }

    if (!editingUser && !password.trim()) {
      alert('Please enter a password');
      return;
    }

    if (password && password.length < 8) {
      alert('Password must be at least 8 characters long');
      return;
    }

    try {
      if (editingUser) {
        // Update user (role cannot be changed)
        const updateData: UpdateUserRequest = {
          username: username !== editingUser.username ? username : undefined,
          password: password ? password : undefined,
          // Role is intentionally excluded - roles cannot be changed after creation
        };

        await authApi.updateUser(editingUser.id, updateData);
      } else {
        // Create user (only OPERATOR role allowed)
        const createData: CreateUserRequest = {
          username,
          password,
          role: 'OPERATOR', // Force OPERATOR role
        };

        await authApi.createUser(createData);
      }

      handleCloseModal();
      await loadUsers();
    } catch (error: any) {
      alert(error.message || 'Failed to save user');
    }
  };

  const handleDelete = async (user: User) => {
    if (currentUser?.id === user.id) {
      alert('You cannot delete your own account');
      return;
    }

    if (user.role === 'ADMIN') {
      alert('Admin users cannot be deleted for security reasons');
      return;
    }

    if (!confirm(`Are you sure you want to delete user "${user.username}"?`)) {
      return;
    }

    try {
      await authApi.deleteUser(user.id);
      await loadUsers();
    } catch (error: any) {
      alert(error.message || 'Failed to delete user');
    }
  };

  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">User Management</h2>
          <p className="text-gray-500">Manage system users and permissions</p>
        </div>
        <button onClick={() => handleOpenModal()} className="btn-primary">
          + Create User
        </button>
      </div>

      {/* Search */}
      <div className="card">
        <input
          type="text"
          placeholder="Search users..."
          className="input"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Users Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Username</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Role</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Created At</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-gray-500">
                    Loading users...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-gray-500">
                    No users found
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => (
                  <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center">
                        <span className="font-medium">{user.username}</span>
                        {currentUser?.id === user.id && (
                          <span className="ml-2 text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded">
                            You
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`badge ${
                          user.role === 'ADMIN' ? 'badge-primary' : 'badge-secondary'
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {new Date(user.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleOpenModal(user)}
                          className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(user)}
                          disabled={currentUser?.id === user.id || user.role === 'ADMIN'}
                          className="px-3 py-1 text-sm bg-danger-100 text-danger-700 rounded hover:bg-danger-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          title={
                            user.role === 'ADMIN'
                              ? 'Admin users cannot be deleted'
                              : currentUser?.id === user.id
                                ? 'You cannot delete your own account'
                                : 'Delete user'
                          }
                        >
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

      {/* Create/Edit User Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-xl font-bold mb-4">
                {editingUser ? 'Edit User' : 'Create New User'}
              </h3>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
                  <input
                    type="text"
                    className="input"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    required
                    placeholder="Enter username"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                  {editingUser ? (
                    <div>
                      <div className="input bg-gray-50 cursor-not-allowed">
                        <span
                          className={`badge ${
                            role === 'ADMIN' ? 'badge-primary' : 'badge-secondary'
                          }`}
                        >
                          {role}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        User roles cannot be changed after creation for security reasons.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <select
                        className="input"
                        value={role}
                        onChange={e => setRole(e.target.value as 'ADMIN' | 'OPERATOR')}
                        required
                        disabled
                      >
                        <option value="OPERATOR">Operator</option>
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        Only operators can be created. Admin accounts are system-managed.
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password {editingUser ? '(leave empty to keep unchanged)' : '*'}
                  </label>
                  <input
                    type="password"
                    className="input"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required={!editingUser}
                    placeholder={editingUser ? 'Enter new password' : 'Enter password'}
                    minLength={8}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Password must be at least 8 characters long
                  </p>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button type="button" onClick={handleCloseModal} className="btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    {editingUser ? 'Update User' : 'Create User'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <div className="text-sm text-gray-500 mb-1">Total Users</div>
          <div className="text-3xl font-bold text-gray-800">{users.length}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500 mb-1">Administrators</div>
          <div className="text-3xl font-bold text-primary-600">
            {users.filter(u => u.role === 'ADMIN').length}
          </div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500 mb-1">Operators</div>
          <div className="text-3xl font-bold text-secondary-600">
            {users.filter(u => u.role === 'OPERATOR').length}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
