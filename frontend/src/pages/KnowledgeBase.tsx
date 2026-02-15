import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search,
    Filter,
    Trash2,
    FileText,
    RefreshCw,
    LayoutGrid,
    List as ListIcon,
    Upload // Added missing import
} from 'lucide-react';
import apiService from '../services/api';
import { cn } from '../services/utils';
import { useNotifications } from '../contexts/NotificationContext';

// Types
interface KBDocument {
    id: string;
    name: string;
    path: string;
    size: number;
    last_modified: number;
    file_type: string;
    source: string;
    status: string;
    doc_type?: string;
    product_id?: string;
    deployment_type?: string;
}

const KnowledgeBase: React.FC = () => {
    const { addNotification } = useNotifications();
    const [documents, setDocuments] = useState<KBDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState<'all' | 'vault' | 'archive'>('all'); // Renamed from activeTab
    const [uploadType, setUploadType] = useState('vault');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [isUploading, setIsUploading] = useState(false);
    const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
    const [productId, setProductId] = useState<string>('credo');
    const [revectorizingId, setRevectorizingId] = useState<string | null>(null);

    useEffect(() => {
        fetchDocuments();
        fetchAvailableProducts();
    }, []);

    const fetchAvailableProducts = async () => {
        try {
            const response = await apiService.getProducts();
            if (response.data) {
                const products = response.data;
                if (products.length > 0 && !products.includes(productId)) {
                    setProductId(products[0]);
                }
            }
        } catch (error) {
            console.error('Failed to fetch products:', error);
        }
    };

    const fetchDocuments = async (showLoading = true) => {
        try {
            if (showLoading) setLoading(true);
            const response = await apiService.getDocuments();
            let rawDocs = response.data;
            if (!Array.isArray(rawDocs)) {
                if (rawDocs?.items && Array.isArray(rawDocs.items)) rawDocs = rawDocs.items;
                else if (rawDocs?.data && Array.isArray(rawDocs.data)) rawDocs = rawDocs.data;
                else rawDocs = [];
            }

            const docs = rawDocs.map((d: any) => ({
                ...d,
                source: d.source || 'local',
                doc_type: d.doc_type || 'vault'
            }));
            setDocuments(docs);
        } catch (error) {
            console.error('Failed to fetch KB documents:', error);
            addNotification({
                type: 'error',
                message: 'Failed to fetch documents.',
            });
        } finally {
            if (showLoading) setLoading(false);
        }
    };

    const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        setIsUploading(true);
        addNotification({
            type: 'info',
            message: `Uploading ${files.length} file(s)...`
        });

        try {
            let uploadResponse;
            // Use deploymentType 'cloud' as default since we removed state
            const deploymentType = 'cloud';
            if (files.length === 1) {
                uploadResponse = await apiService.uploadDocument(files[0], uploadType, productId, deploymentType);
            } else {
                uploadResponse = await apiService.uploadDocumentsBulk(files, uploadType, productId, deploymentType);
            }

            if (!uploadResponse?.data) throw new Error('Invalid response');

            await new Promise(resolve => setTimeout(resolve, 500));
            await fetchDocuments();

            addNotification({
                type: 'success',
                message: 'Upload successful. Processing started.',
            });
        } catch (error: any) {
            addNotification({
                type: 'error',
                message: `Upload failed: ${error.message || 'Unknown error'} `,
            });
        } finally {
            setIsUploading(false);
            event.target.value = '';
        }
    };

    const handleRevectorize = async (documentId: string, documentName: string) => {
        setRevectorizingId(documentId);
        try {
            await apiService.revectorizeDocument(documentId);
            addNotification({
                type: 'success',
                message: `Re-vectorizing "${documentName}"...`,
            });
            await fetchDocuments(false);
        } catch (error) {
            addNotification({
                type: 'error',
                message: 'Revectorization failed.',
            });
        } finally {
            setRevectorizingId(null);
        }
    };

    const handleDelete = async (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (!window.confirm('Are you sure you want to delete this document?')) return;

        try {
            await apiService.deleteDocument(id);
            setDocuments(prev => prev.filter(d => d.id !== id));
            addNotification({
                type: 'success',
                message: 'Document deleted.',
            });
        } catch (error) {
            addNotification({
                type: 'error',
                message: 'Delete failed.',
            });
        }
    };

    const filteredDocuments = documents.filter(doc => {
        const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesProduct = productId ? doc.product_id === productId : !doc.product_id;

        // Simplified logic since deploymentType is defaulting to 'cloud' effectively or we ignored it
        // If we want to keep logic we can, but likely 'both' covers it.
        // Let's assume matchesDeployment is always true for now as we removed the selector

        if (!matchesProduct) return false;
        if (activeFilter === 'vault') return matchesSearch && doc.doc_type === 'vault';
        if (activeFilter === 'archive') return matchesSearch && doc.doc_type === 'archive';
        return matchesSearch;
    });

    const formatSize = (bytes: number) => {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60 mb-2">
                        Knowledge Base
                    </h1>
                    <p className="text-surface-400">
                        Manage your intelligence assets and vector embeddings.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <input
                        type="file"
                        id="multi-upload-input"
                        multiple
                        className="hidden"
                        onChange={handleUpload}
                    />
                    <div className="flex bg-surface-800/50 rounded-lg p-1 border border-white/5">
                        <button
                            onClick={() => setUploadType('vault')}
                            className={cn(
                                "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                                uploadType === 'vault' ? "bg-brand-500 text-white shadow-sm" : "text-surface-400 hover:text-white"
                            )}
                        >
                            Vault
                        </button>
                        <button
                            onClick={() => setUploadType('archive')}
                            className={cn(
                                "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                                uploadType === 'archive' ? "bg-purple-500 text-white shadow-sm" : "text-surface-400 hover:text-white"
                            )}
                        >
                            Archive
                        </button>
                    </div>

                    <button
                        onClick={() => document.getElementById('multi-upload-input')?.click()}
                        disabled={isUploading}
                        className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg transition-all shadow-lg shadow-brand-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isUploading ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                            <Upload className="w-4 h-4" />
                        )}
                        <span>Upload</span>
                    </button>
                </div>
            </div>

            {/* Controls Bar */}
            <div className="premium-card p-4 flex flex-wrap items-center gap-4">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search documents..."
                        className="w-full bg-surface-900/50 border border-white/10 rounded-lg py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-brand-500/50 transition-all placeholder:text-surface-500"
                    />
                </div>

                {/* Filters */}
                <div className="flex items-center gap-2 border-l border-white/10 pl-4">
                    <Filter className="w-4 h-4 text-surface-400" />
                    <div className="flex gap-1">
                        {['all', 'vault', 'archive'].map((filter) => (
                            <button
                                key={filter}
                                onClick={() => setActiveFilter(filter as any)}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all",
                                    activeFilter === filter
                                        ? "bg-surface-800 text-white border border-white/10"
                                        : "text-surface-400 hover:text-white hover:bg-surface-800/50"
                                )}
                            >
                                {filter}
                            </button>
                        ))}
                    </div>
                </div>

                {/* View Toggle */}
                <div className="flex bg-surface-900/50 rounded-lg p-1 border border-white/10">
                    <button
                        onClick={() => setViewMode('grid')}
                        className={cn(
                            "p-1.5 rounded transition-all",
                            viewMode === 'grid' ? "bg-surface-700 text-white" : "text-surface-400 hover:text-white"
                        )}
                    >
                        <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        className={cn(
                            "p-1.5 rounded transition-all",
                            viewMode === 'list' ? "bg-surface-700 text-white" : "text-surface-400 hover:text-white"
                        )}
                    >
                        <ListIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Documents Grid */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-48 rounded-2xl bg-surface-800/50 animate-pulse border border-white/5" />
                    ))}
                </div>
            ) : filteredDocuments.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-white/10 rounded-2xl bg-surface-900/20">
                    <div className="w-16 h-16 rounded-full bg-surface-800 flex items-center justify-center mx-auto mb-4">
                        <FileText className="w-8 h-8 text-surface-500" />
                    </div>
                    <h3 className="text-xl font-medium text-white mb-2">No documents found</h3>
                    <p className="text-surface-400 max-w-md mx-auto">
                        Upload documents to populate your knowledge base or adjust your search filters.
                    </p>
                </div>
            ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    <AnimatePresence mode="popLayout">
                        {filteredDocuments.map((doc) => (
                            <motion.div
                                key={doc.id}
                                layout
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                onClick={() => setSelectedDocumentId(doc.id)}
                                className={cn(
                                    "premium-card group relative overflow-hidden transition-all hover:-translate-y-1 cursor-pointer",
                                    selectedDocumentId === doc.id && "ring-2 ring-brand-500/50"
                                )}
                            >
                                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleRevectorize(doc.id, doc.name);
                                        }}
                                        className="p-1.5 rounded-lg bg-surface-800 text-surface-400 hover:text-brand-400 hover:bg-surface-700 border border-white/10"
                                    >
                                        <RefreshCw className={cn("w-3.5 h-3.5", revectorizingId === doc.id && "animate-spin")} />
                                    </button>
                                    <button
                                        onClick={(e) => handleDelete(doc.id, e)}
                                        className="p-1.5 rounded-lg bg-surface-800 text-surface-400 hover:text-red-400 hover:bg-surface-700 border border-white/10"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>

                                <div className="p-5">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className={cn(
                                            "w-10 h-10 rounded-xl flex items-center justify-center",
                                            doc.doc_type === 'archive'
                                                ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                                                : "bg-brand-500/10 text-brand-400 border border-brand-500/20"
                                        )}>
                                            <FileText className="w-5 h-5" />
                                        </div>
                                        {doc.status === 'processing' && (
                                            <span className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-brand-400 bg-brand-500/10 px-2 py-1 rounded-full">
                                                <RefreshCw className="w-3 h-3 animate-spin" />
                                                Processing
                                            </span>
                                        )}
                                    </div>

                                    <h3 className="font-semibold text-white mb-1 truncate" title={doc.name}>
                                        {doc.name}
                                    </h3>
                                    <p className="text-xs text-surface-400 mb-4">
                                        {formatSize(doc.size)} • {new Date(doc.last_modified).toLocaleDateString()}
                                    </p>

                                    <div className="flex items-center gap-2">
                                        <span className={cn(
                                            "text-[10px] uppercase font-bold px-2 py-0.5 rounded border",
                                            doc.doc_type === 'archive'
                                                ? "bg-purple-500/5 text-purple-400 border-purple-500/20"
                                                : "bg-brand-500/5 text-brand-400 border-brand-500/20"
                                        )}>
                                            {doc.doc_type === 'archive' ? 'Archive' : 'Vault'}
                                        </span>
                                        {doc.product_id && (
                                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded border border-white/10 text-surface-400 bg-surface-800/50">
                                                {doc.product_id}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            ) : (
                <div className="premium-card overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/5 bg-surface-800/30">
                                <th className="p-4 text-xs font-semibold text-surface-400 uppercase tracking-wider">Name</th>
                                <th className="p-4 text-xs font-semibold text-surface-400 uppercase tracking-wider">Type</th>
                                <th className="p-4 text-xs font-semibold text-surface-400 uppercase tracking-wider">Size</th>
                                <th className="p-4 text-xs font-semibold text-surface-400 uppercase tracking-wider">Date</th>
                                <th className="p-4 text-xs font-semibold text-surface-400 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredDocuments.map((doc) => (
                                <tr
                                    key={doc.id}
                                    onClick={() => setSelectedDocumentId(doc.id)}
                                    className="border-b border-white/5 hover:bg-surface-800/30 transition-colors cursor-pointer group"
                                >
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "w-8 h-8 rounded-lg flex items-center justify-center",
                                                doc.doc_type === 'archive'
                                                    ? "bg-purple-500/10 text-purple-400"
                                                    : "bg-brand-500/10 text-brand-400"
                                            )}>
                                                <ListIcon className="w-4 h-4" />
                                            </div>
                                            <span className="font-medium text-white">{doc.name}</span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className={cn(
                                            "text-[10px] uppercase font-bold px-2 py-0.5 rounded border",
                                            doc.doc_type === 'archive'
                                                ? "bg-purple-500/5 text-purple-400 border-purple-500/20"
                                                : "bg-brand-500/5 text-brand-400 border-brand-500/20"
                                        )}>
                                            {doc.doc_type}
                                        </span>
                                    </td>
                                    <td className="p-4 text-sm text-surface-400">{formatSize(doc.size)}</td>
                                    <td className="p-4 text-sm text-surface-400">{new Date(doc.last_modified).toLocaleDateString()}</td>
                                    <td className="p-4 text-right">
                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleRevectorize(doc.id, doc.name);
                                                }}
                                                className="p-1.5 text-surface-400 hover:text-brand-400 transition-colors"
                                            >
                                                <RefreshCw className={cn("w-4 h-4", revectorizingId === doc.id && "animate-spin")} />
                                            </button>
                                            <button
                                                onClick={(e) => handleDelete(doc.id, e)}
                                                className="p-1.5 text-surface-400 hover:text-red-400 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default KnowledgeBase;
