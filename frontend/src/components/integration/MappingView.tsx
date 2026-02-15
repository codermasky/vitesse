import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Layout,
    Plus,
    Trash2,
    ArrowRight,
    Sparkles,
    Save,
    Check,
    AlertCircle,
    Loader2
} from 'lucide-react';
import { apiService } from '../../services/api';

interface MappingViewProps {
    integration: any;
    onComplete: () => void;
}

interface FieldMapping {
    id?: string;
    source_field: string;
    target_field: string;
    data_type: string;
    required: boolean;
    transformation?: string;
}

export const MappingView: React.FC<MappingViewProps> = ({ integration, onComplete }) => {
    const [mappings, setMappings] = useState<FieldMapping[]>(integration.field_mappings || []);
    const [isAdding, setIsAdding] = useState(false);
    const [newMapping, setNewMapping] = useState<FieldMapping>({
        source_field: '',
        target_field: '',
        data_type: 'string',
        required: true
    });
    const [isSaving, setIsSaving] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAddMapping = async () => {
        try {
            setIsSaving(true);
            const response = await apiService.addFieldMapping(integration.id, newMapping);
            setMappings([...mappings, response.data]);
            setNewMapping({
                source_field: '',
                target_field: '',
                data_type: 'string',
                required: true
            });
            setIsAdding(false);
        } catch (err) {
            console.error('Failed to add mapping:', err);
            setError('Failed to save mapping');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteMapping = async (index: number) => {
        // In a real app, delete from backend too
        const newMappings = [...mappings];
        newMappings.splice(index, 1);
        setMappings(newMappings);
    };

    const handleAutoGenerate = async () => {
        setIsGenerating(true);
        // Simulate AI generation
        setTimeout(() => {
            const suggestedMappings = [
                { source_field: 'name', target_field: 'fullName', data_type: 'string', required: true },
                { source_field: 'email', target_field: 'contactEmail', data_type: 'string', required: true },
                { source_field: 'phone', target_field: 'phoneNumber', data_type: 'string', required: false },
                { source_field: 'id', target_field: 'externalId', data_type: 'string', required: true },
            ];
            setMappings([...mappings, ...suggestedMappings]);
            setIsGenerating(false);
        }, 1500);
    };

    const handleSaveAndContinue = async () => {
        try {
            setIsSaving(true);
            await apiService.updateIntegration(integration.id, {
                status: 'testing',
                field_mappings: mappings
            });
            onComplete();
        } catch (err) {
            console.error('Failed to update integration:', err);
            setError('Failed to save progress');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-surface-900 dark:text-white flex items-center gap-2">
                        <Layout className="w-6 h-6 text-brand-500" />
                        Configure Field Mapping
                    </h2>
                    <p className="text-sm text-surface-500 mt-1">
                        Map fields from {integration.source_discovery?.api_name} to {integration.dest_discovery?.api_name}
                    </p>
                </div>
                <button
                    onClick={handleAutoGenerate}
                    disabled={isGenerating}
                    className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:from-purple-600 hover:to-pink-600 transition-all duration-200 shadow-lg flex items-center gap-2 disabled:opacity-50"
                >
                    {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Auto-Generate with AI
                </button>
            </div>

            {/* Mappings List */}
            <div className="bg-surface-50 dark:bg-surface-800/50 rounded-xl border border-surface-200 dark:border-surface-700 overflow-hidden">
                {mappings.length === 0 ? (
                    <div className="p-12 text-center text-surface-500">
                        <Layout className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No mappings configured yet.</p>
                        <button
                            onClick={() => setIsAdding(true)}
                            className="mt-4 text-brand-500 font-medium hover:underline"
                        >
                            Add your first mapping manually
                        </button>
                    </div>
                ) : (
                    <div className="divide-y divide-surface-200 dark:divide-surface-700">
                        <div className="grid grid-cols-12 gap-4 p-4 bg-surface-100 dark:bg-surface-800 text-xs font-semibold text-surface-500 uppercase tracking-wider">
                            <div className="col-span-4">Source Field</div>
                            <div className="col-span-1 flex justify-center"><ArrowRight className="w-4 h-4" /></div>
                            <div className="col-span-4">Target Field</div>
                            <div className="col-span-2">Type</div>
                            <div className="col-span-1"></div>
                        </div>
                        {mappings.map((mapping, idx) => (
                            <div key={idx} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-surface-100 dark:hover:bg-surface-700/50 transition-colors">
                                <div className="col-span-4 font-mono text-sm text-surface-700 dark:text-surface-300">
                                    {mapping.source_field}
                                </div>
                                <div className="col-span-1 flex justify-center text-surface-400">
                                    <ArrowRight className="w-4 h-4" />
                                </div>
                                <div className="col-span-4 font-mono text-sm text-surface-900 dark:text-white font-medium">
                                    {mapping.target_field}
                                </div>
                                <div className="col-span-2">
                                    <span className="px-2 py-1 text-xs rounded-full bg-surface-200 dark:bg-surface-700 text-surface-600 dark:text-surface-400">
                                        {mapping.data_type}
                                    </span>
                                </div>
                                <div className="col-span-1 flex justify-end">
                                    <button
                                        onClick={() => handleDeleteMapping(idx)}
                                        className="text-surface-400 hover:text-red-500 transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Add New Mapping Form */}
            <AnimatePresence>
                {isAdding ? (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="bg-white dark:bg-surface-800 p-4 rounded-xl border border-brand-500/30 shadow-lg"
                    >
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                            <div>
                                <label className="block text-xs font-medium text-surface-500 mb-1">Source Field</label>
                                <input
                                    type="text"
                                    value={newMapping.source_field}
                                    onChange={(e) => setNewMapping({ ...newMapping, source_field: e.target.value })}
                                    className="w-full px-3 py-2 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg text-sm"
                                    placeholder="e.g. user_id"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-surface-500 mb-1">Target Field</label>
                                <input
                                    type="text"
                                    value={newMapping.target_field}
                                    onChange={(e) => setNewMapping({ ...newMapping, target_field: e.target.value })}
                                    className="w-full px-3 py-2 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg text-sm"
                                    placeholder="e.g. externalId"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-surface-500 mb-1">Type</label>
                                <select
                                    value={newMapping.data_type}
                                    onChange={(e) => setNewMapping({ ...newMapping, data_type: e.target.value })}
                                    className="w-full px-3 py-2 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg text-sm"
                                >
                                    <option value="string">String</option>
                                    <option value="number">Number</option>
                                    <option value="boolean">Boolean</option>
                                    <option value="object">Object</option>
                                    <option value="array">Array</option>
                                </select>
                            </div>
                            <div className="flex items-end">
                                <label className="flex items-center gap-2 text-sm text-surface-700 dark:text-surface-300 h-10 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={newMapping.required}
                                        onChange={(e) => setNewMapping({ ...newMapping, required: e.target.checked })}
                                        className="w-4 h-4 text-brand-500 rounded border-surface-300 dark:border-surface-600 focus:ring-brand-500"
                                    />
                                    Required
                                </label>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setIsAdding(false)}
                                className="px-3 py-1.5 text-sm text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-white"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddMapping}
                                disabled={!newMapping.source_field || !newMapping.target_field || isSaving}
                                className="px-3 py-1.5 bg-brand-500 text-white text-sm rounded-lg hover:bg-brand-600 transition-colors disabled:opacity-50"
                            >
                                {isSaving ? 'Adding...' : 'Add Mapping'}
                            </button>
                        </div>
                    </motion.div>
                ) : (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="w-full py-3 border-2 border-dashed border-surface-200 dark:border-surface-700 rounded-xl text-surface-500 hover:border-brand-500 hover:text-brand-500 transition-all flex items-center justify-center gap-2"
                    >
                        <Plus className="w-5 h-5" />
                        Add Field Mapping
                    </button>
                )}
            </AnimatePresence>

            <div className="flex justify-between items-center pt-4 border-t border-surface-200 dark:border-surface-800">
                <div className="text-sm text-surface-500">
                    {mappings.length} mappings configured
                </div>
                <button
                    onClick={handleSaveAndContinue}
                    disabled={mappings.length === 0 || isSaving}
                    className="px-6 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 font-medium transition-all shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save & Continue to Testing
                </button>
            </div>
        </div>
    );
};
