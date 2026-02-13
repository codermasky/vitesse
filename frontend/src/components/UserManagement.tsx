import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Edit2,
    Trash2,
    Search,
    UserPlus,
    CheckCircle2,
    XCircle,
    X,
} from 'lucide-react';
import apiService from '../services/api';
import { useNotifications } from '../contexts/NotificationContext';


// Types
interface User {
    id: number;
    email: string;
    full_name?: string;
    is_active: boolean;
    is_superuser: boolean;
    role: string;
    created_at: string;
}

const UserManagement: React.FC = () => {
    const { addNotification } = useNotifications();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<Partial<User> & { password?: string }>({});
    const [isSaving, setIsSaving] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);

    // Fetch users
    const fetchUsers = async () => {
        setLoading(true);
        try {
            const response = await apiService.getUsers({ limit: 100 });
            setUsers(response.data);
        } catch (error) {
            console.error("Failed to fetch users:", error);
            addNotification({ message: "Failed to load users.", type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    // Filter users
    const filteredUsers = users.filter(user =>
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.full_name && user.full_name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const handleOpenModal = (user?: User) => {
        if (user) {
            setEditingUser({ ...user, password: '' }); // Don't show password, allow reset
        } else {
            setEditingUser({
                email: '',
                full_name: '',
                password: '',
                role: 'REQUESTOR',
                is_active: true,
                is_superuser: false
            });
        }
        setIsModalOpen(true);
    };

    const handleSaveUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            if (editingUser.id) {
                // Update
                const updateData: any = { ...editingUser };
                if (!updateData.password) delete updateData.password; // Don't send empty password
                delete updateData.id;
                delete updateData.created_at;

                await apiService.updateUser(editingUser.id, updateData);
                addNotification({ message: "User updated successfully.", type: 'success' });
            } else {
                // Create
                if (!editingUser.email || !editingUser.password) {
                    addNotification({ message: "Email and password are required.", type: 'error' });
                    setIsSaving(false);
                    return;
                }
                await apiService.createUser(editingUser as any);
                addNotification({ message: "User created successfully.", type: 'success' });
            }
            setIsModalOpen(false);
            fetchUsers();
        } catch (error: any) {
            console.error("Failed to save user:", error);
            addNotification({
                message: error.response?.data?.detail || "Failed to save user.",
                type: 'error'
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteUser = async (userId: number) => {
        try {
            await apiService.deleteUser(userId);
            addNotification({ message: "User deleted successfully.", type: 'success' });
            setShowDeleteConfirm(null);
            fetchUsers();
        } catch (error: any) {
            console.error("Failed to delete user:", error);
            addNotification({
                message: error.response?.data?.detail || "Failed to delete user.",
                type: 'error'
            });
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                    <input
                        type="text"
                        placeholder="Search users..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-surface-100 dark:bg-surface-900 border border-surface-200 dark:border-brand-500/10 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                    />
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl shadow-lg shadow-brand-500/20 transition-all text-sm font-medium"
                >
                    <UserPlus className="w-4 h-4" />
                    Add User
                </button>
            </div>

            <div className="bg-white dark:bg-surface-950 border border-surface-200 dark:border-brand-500/10 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-surface-50 dark:bg-surface-900/50 border-b border-surface-200 dark:border-brand-500/10">
                                <th className="px-6 py-4 text-xs font-semibold text-surface-500 uppercase tracking-wider">User</th>
                                <th className="px-6 py-4 text-xs font-semibold text-surface-500 uppercase tracking-wider">Role</th>
                                <th className="px-6 py-4 text-xs font-semibold text-surface-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-xs font-semibold text-surface-500 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-200 dark:divide-brand-500/5">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-surface-500">
                                        <div className="flex justify-center items-center gap-2">
                                            <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                                            Loading users...
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-surface-500">
                                        No users found.
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((user) => (
                                    <tr key={user.id} className="hover:bg-surface-50 dark:hover:bg-brand-500/[0.02] transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-500 to-brand-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">
                                                    {user.full_name ? user.full_name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-surface-900 dark:text-white">
                                                        {user.full_name || 'No Name'}
                                                    </div>
                                                    <div className="text-xs text-surface-500">{user.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface-100 dark:bg-surface-800 text-surface-800 dark:text-surface-300 border border-surface-200 dark:border-brand-500/10">
                                                {user.is_superuser ? 'Super Admin' : user.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {user.is_active ? (
                                                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                                    <CheckCircle2 className="w-3 h-3" /> Active
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400">
                                                    <XCircle className="w-3 h-3" /> Inactive
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => handleOpenModal(user)}
                                                    className="p-1.5 text-surface-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded-lg transition-colors"
                                                    title="Edit User"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                {showDeleteConfirm === user.id ? (
                                                    <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-lg border border-red-200 dark:border-red-900/30">
                                                        <span className="text-xs text-red-600">Sure?</span>
                                                        <button
                                                            onClick={() => handleDeleteUser(user.id)}
                                                            className="text-xs font-bold text-red-600 hover:underline"
                                                        >
                                                            Yes
                                                        </button>
                                                        <button
                                                            onClick={() => setShowDeleteConfirm(null)}
                                                            className="text-xs text-surface-500 hover:text-surface-700"
                                                        >
                                                            No
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => setShowDeleteConfirm(user.id)}
                                                        className="p-1.5 text-surface-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                                                        title="Delete User"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                            onClick={() => setIsModalOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-4"
                        >
                            <div className="bg-white dark:bg-surface-950 w-full max-w-md rounded-2xl shadow-2xl border border-surface-200 dark:border-brand-500/10 pointer-events-auto overflow-hidden">
                                <div className="p-6 border-b border-surface-200 dark:border-brand-500/10 flex justify-between items-center">
                                    <h3 className="text-lg font-bold text-surface-900 dark:text-white">
                                        {editingUser.id ? 'Edit User' : 'Create New User'}
                                    </h3>
                                    <button
                                        onClick={() => setIsModalOpen(false)}
                                        className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                                <form onSubmit={handleSaveUser} className="p-6 space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                                            Email Address
                                        </label>
                                        <input
                                            type="email"
                                            value={editingUser.email}
                                            onChange={(e) => setEditingUser(prev => ({ ...prev, email: e.target.value }))}
                                            className="w-full px-4 py-2 bg-surface-50 dark:bg-black/20 border border-surface-200 dark:border-brand-500/10 rounded-xl text-sm"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                                            Full Name
                                        </label>
                                        <input
                                            type="text"
                                            value={editingUser.full_name || ''}
                                            onChange={(e) => setEditingUser(prev => ({ ...prev, full_name: e.target.value }))}
                                            className="w-full px-4 py-2 bg-surface-50 dark:bg-black/20 border border-surface-200 dark:border-brand-500/10 rounded-xl text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                                            Password {editingUser.id && <span className="text-xs text-surface-400 font-normal">(Leave blank to keep current)</span>}
                                        </label>
                                        <input
                                            type="password"
                                            value={editingUser.password || ''}
                                            onChange={(e) => setEditingUser(prev => ({ ...prev, password: e.target.value }))}
                                            className="w-full px-4 py-2 bg-surface-50 dark:bg-black/20 border border-surface-200 dark:border-brand-500/10 rounded-xl text-sm"
                                            required={!editingUser.id}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                                                Role
                                            </label>
                                            <select
                                                value={editingUser.role}
                                                onChange={(e) => setEditingUser(prev => ({ ...prev, role: e.target.value }))}
                                                className="w-full px-4 py-2 bg-surface-50 dark:bg-black/20 border border-surface-200 dark:border-brand-500/10 rounded-xl text-sm"
                                            >
                                                <option value="REQUESTOR">Requestor</option>
                                                <option value="REVIEWER">Reviewer</option>
                                                <option value="ANALYST">Analyst</option>
                                                <option value="ADMIN">Admin</option>
                                            </select>
                                        </div>
                                        <div className="flex flex-col justify-end gap-2 pb-2">
                                            <label className="flex items-center gap-2 text-sm text-surface-700 dark:text-surface-300 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={editingUser.is_active}
                                                    onChange={(e) => setEditingUser(prev => ({ ...prev, is_active: e.target.checked }))}
                                                    className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                                                />
                                                Active User
                                            </label>
                                            <label className="flex items-center gap-2 text-sm text-surface-700 dark:text-surface-300 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={editingUser.is_superuser}
                                                    onChange={(e) => setEditingUser(prev => ({ ...prev, is_superuser: e.target.checked }))}
                                                    className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                                                />
                                                Superadmin
                                            </label>
                                        </div>
                                    </div>

                                    <div className="pt-4 flex justify-end gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setIsModalOpen(false)}
                                            className="px-4 py-2 text-sm font-medium text-surface-600 hover:text-surface-900 dark:text-surface-400 dark:hover:text-white transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isSaving}
                                            className="px-6 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl shadow-lg shadow-brand-500/20 transition-all disabled:opacity-50 text-sm font-medium"
                                        >
                                            {isSaving ? 'Saving...' : 'Save User'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

export default UserManagement;
