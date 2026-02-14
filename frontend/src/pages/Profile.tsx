import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'framer-motion';
import { User, Key, Mail, Shield, Save, AlertCircle } from 'lucide-react';
import apiService from '../services/api';
import { useNotifications } from '../contexts/NotificationContext';

const Profile: React.FC = () => {
    const { user } = useAuth(); // Re-login might be needed if password changes, strictly speaking not needed for updating name but good practice
    const { addNotification } = useNotifications();

    const [formData, setFormData] = useState({
        full_name: user?.full_name || '',
        email: user?.email || '',
        current_password: '', // Not used currently for verification but could be added
        new_password: '',
        confirm_password: ''
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (formData.new_password && formData.new_password !== formData.confirm_password) {
            setError("New passwords do not match.");
            setLoading(false);
            return;
        }

        try {
            const updateData: any = {};
            if (formData.full_name !== user?.full_name) updateData.full_name = formData.full_name;
            if (formData.new_password) updateData.password = formData.new_password;

            if (Object.keys(updateData).length === 0) {
                addNotification({ message: "No changes to save.", type: 'info' });
                setLoading(false);
                return;
            }

            // Using the new endpoint (assuming it's implemented as PUT /users/me)
            // But checking api.ts, we need to add the method first or use a direct call if we haven't updated api.ts yet.
            // Let's assume we will update api.ts shortly.
            await apiService.updateCurrentUser(updateData);

            addNotification({ message: "Profile updated successfully.", type: 'success' });

            // Clear sensitive fields
            setFormData(prev => ({ ...prev, new_password: '', confirm_password: '' }));

        } catch (err: any) {
            console.error(err);
            setError(err.response?.data?.detail || "Failed to update profile.");
            addNotification({ message: "Failed to update profile.", type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-12 max-w-4xl mx-auto pb-20">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass rounded-[2.5rem] p-12 border border-brand-500/10 space-y-6"
            >
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-brand-500/10 flex items-center justify-center border border-brand-500/20">
                        <User className="w-7 h-7 text-brand-500" />
                    </div>
                    <div>
                        <h1 className="text-5xl lg:text-6xl font-black tracking-tight text-surface-950 dark:text-white leading-[1.1]">My Profile</h1>
                        <p className="text-lg text-surface-600 dark:text-surface-400 font-medium">Manage your personal information and security settings.</p>
                    </div>
                </div>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* User Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="md:col-span-1"
                >
                    <div className="glass p-6 rounded-2xl border border-surface-200 dark:border-brand-500/10 flex flex-col items-center text-center space-y-4">
                        <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-brand-500 to-brand-600 flex items-center justify-center shadow-lg shadow-brand-500/30">
                            <span className="text-3xl font-bold text-white">
                                {user?.full_name ? user.full_name.charAt(0).toUpperCase() : user?.email.charAt(0).toUpperCase()}
                            </span>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-surface-950 dark:text-white">{user?.full_name || 'User'}</h2>
                            <p className="text-sm text-surface-500 dark:text-surface-400">{user?.email}</p>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1 bg-brand-50 dark:bg-brand-500/10 rounded-full border border-brand-200 dark:border-brand-500/20">
                            <Shield className="w-3 h-3 text-brand-600 dark:text-brand-400" />
                            <span className="text-xs font-medium text-brand-700 dark:text-brand-300 uppercase tracking-wider">{user?.role}</span>
                        </div>
                    </div>
                </motion.div>

                {/* Edit Form */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="md:col-span-2"
                >
                    <div className="glass p-8 rounded-2xl border border-surface-200 dark:border-brand-500/10">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {error && (
                                <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl flex items-center gap-3 text-red-600 dark:text-red-400">
                                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                    <p className="text-sm font-medium">{error}</p>
                                </div>
                            )}

                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold text-surface-950 dark:text-white flex items-center gap-2">
                                    <User className="w-4 h-4 text-brand-500" />
                                    Personal Information
                                </h3>
                                <div className="grid grid-cols-1 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                                            Email Address
                                        </label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <Mail className="h-4 w-4 text-surface-400" />
                                            </div>
                                            <input
                                                type="email"
                                                value={formData.email}
                                                disabled
                                                className="w-full pl-10 pr-4 py-2 bg-surface-100 dark:bg-surface-900 border border-surface-200 dark:border-brand-500/10 rounded-xl text-surface-500 dark:text-surface-400 cursor-not-allowed text-sm"
                                            />
                                        </div>
                                        <p className="mt-1 text-xs text-surface-400">Email address cannot be changed.</p>
                                    </div>
                                    <div>
                                        <label htmlFor="full_name" className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                                            Full Name
                                        </label>
                                        <input
                                            type="text"
                                            name="full_name"
                                            id="full_name"
                                            value={formData.full_name}
                                            onChange={handleInputChange}
                                            className="w-full px-4 py-2 bg-white dark:bg-black/20 border border-surface-200 dark:border-brand-500/10 rounded-xl text-surface-900 dark:text-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all text-sm"
                                            placeholder="Enter your full name"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-surface-200 dark:border-brand-500/10 space-y-4">
                                <h3 className="text-lg font-semibold text-surface-950 dark:text-white flex items-center gap-2">
                                    <Key className="w-4 h-4 text-brand-500" />
                                    Security
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="new_password" className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                                            New Password
                                        </label>
                                        <input
                                            type="password"
                                            name="new_password"
                                            id="new_password"
                                            value={formData.new_password}
                                            onChange={handleInputChange}
                                            className="w-full px-4 py-2 bg-white dark:bg-black/20 border border-surface-200 dark:border-brand-500/10 rounded-xl text-surface-900 dark:text-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all text-sm"
                                            placeholder="Leave blank to keep current"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="confirm_password" className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                                            Confirm New Password
                                        </label>
                                        <input
                                            type="password"
                                            name="confirm_password"
                                            id="confirm_password"
                                            value={formData.confirm_password}
                                            onChange={handleInputChange}
                                            className="w-full px-4 py-2 bg-white dark:bg-black/20 border border-surface-200 dark:border-brand-500/10 rounded-xl text-surface-900 dark:text-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all text-sm"
                                            placeholder="Confirm new password"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 flex justify-end">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex items-center gap-2 px-6 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl shadow-lg shadow-brand-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
                                >
                                    {loading ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-4 h-4" />
                                            Save Changes
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default Profile;
