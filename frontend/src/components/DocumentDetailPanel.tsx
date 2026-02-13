import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    FileText,
    Calendar,
    HardDrive,
    Tag,
    Edit2,
    Check,
    AlertCircle,
    CheckCircle,
    Clock,
    Download,
    Loader,
    Database,
    Layers,
    ChevronLeft
} from 'lucide-react';
import apiService from '../services/api';
import { cn } from '../services/utils';

interface DocumentDetailPanelProps {
    documentId: string;
    onClose: () => void;
    onUpdate?: () => void;
}

interface DocumentMetadata {
    id: string;
    name: string;
    type: string;
    size?: number;
    last_modified?: number;
    description?: string;
    tags?: string[];
    author?: string;
    version?: string;
    language?: string;
    category?: string;
    doc_type?: string;
    access_level?: string;
    product_id?: string;
    deployment_type?: string;
    extraction_status?: string;
    extraction_started_at?: string;
    extraction_completed_at?: string;
    extraction_error?: string;
    chunk_count?: number;
    text_length?: number;
    embedding_model?: string;
    custom_metadata?: Record<string, any>;
}

const DocumentDetailPanel: React.FC<DocumentDetailPanelProps> = ({
    documentId,
    onClose,
    onUpdate
}) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'metadata' | 'extraction' | 'indexed'>('overview');
    const [documentMetadata, setDocumentMetadata] = useState<DocumentMetadata | null>(null);
    const [loading, setLoading] = useState(true);

    const [editingName, setEditingName] = useState(false);
    const [newName, setNewName] = useState('');
    const [extractionFlow, setExtractionFlow] = useState<any>(null);
    const [chunks, setChunks] = useState<any[]>([]);
    const [indexedStats, setIndexedStats] = useState<any>(null);

    useEffect(() => {
        fetchDocumentDetails();
    }, [documentId]);

    useEffect(() => {
        if (activeTab === 'extraction') {
            fetchExtractionFlow();
        } else if (activeTab === 'indexed') {
            fetchIndexedData();
        }
    }, [activeTab]);

    const fetchDocumentDetails = async () => {
        try {
            setLoading(true);
            const response = await apiService.getDocumentDetails(documentId);
            setDocumentMetadata(response.data);
            setNewName(response.data.name);

        } catch (error) {
            console.error('Failed to fetch document details:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchExtractionFlow = async () => {
        try {
            const response = await apiService.getExtractionFlow(documentId);
            setExtractionFlow(response.data);
        } catch (error) {
            console.error('Failed to fetch extraction flow:', error);
        }
    };

    const fetchIndexedData = async () => {
        try {
            const [statsResponse, chunksResponse] = await Promise.all([
                apiService.getDocumentIndexedStats(documentId),
                apiService.getDocumentChunks(documentId, 0, 5)
            ]);
            setIndexedStats(statsResponse.data);
            setChunks(chunksResponse.data.chunks || []);
        } catch (error) {
            console.error('Failed to fetch indexed data:', error);
        }
    };

    const handleDownload = async () => {
        if (!documentMetadata) return;
        try {
            const url = `/documents/${documentId}/download`;
            const response = await apiService.downloadDocument(url);
            const blob = new Blob([response.data], { type: response.headers['content-type'] });
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.setAttribute('download', documentMetadata.name);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(downloadUrl);
        } catch (error) {

            console.error('Failed to download document:', error);
            alert('Failed to download the document. Please try again.');
        }
    };


    const handleSaveName = async () => {
        if (!newName.trim() || newName === documentMetadata?.name) {
            setEditingName(false);
            return;
        }

        try {
            await apiService.renameDocument(documentId, newName);
            setDocumentMetadata(prev => prev ? { ...prev, name: newName } : null);
            setEditingName(false);
            onUpdate?.();
        } catch (error) {

            console.error('Failed to rename document:', error);
        }
    };

    /*
    const handleAddTag = async (tag: string) => {
        if (!tag.trim()) return;
    
        try {
            await apiService.addDocumentTags(documentId, [tag]);
            setDocument(prev => prev ? {
                ...prev,
                tags: [...(prev.tags || []), tag]
            } : null);
            onUpdate?.();
        } catch (error) {
            console.error('Failed to add tag:', error);
        }
    };
    */

    const handleRemoveTag = async (tag: string) => {
        try {
            await apiService.removeDocumentTags(documentId, [tag]);
            setDocumentMetadata(prev => prev ? { ...prev, tags: (prev.tags || []).filter(t => t !== tag) } : null);
            onUpdate?.();
        } catch (error) {

            console.error('Failed to remove tag:', error);
        }
    };

    const formatDate = (dateString?: string | number) => {
        if (!dateString) return '-';
        const date = typeof dateString === 'number' ? new Date(dateString) : new Date(dateString);
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatSize = (bytes?: number) => {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const getStatusIcon = (status?: string) => {
        switch (status) {
            case 'completed':
                return <CheckCircle className="w-5 h-5 text-green-400" />;
            case 'processing':
                return <Loader className="w-5 h-5 text-brand-400 animate-spin" />;
            case 'failed':
                return <AlertCircle className="w-5 h-5 text-red-400" />;
            default:
                return <Clock className="w-5 h-5 text-surface-500" />;
        }
    };

    const getStatusColor = (status?: string) => {
        switch (status) {
            case 'completed':
                return 'bg-green-500/10 text-green-400 border-green-500/20';
            case 'processing':
                return 'bg-brand-500/10 text-brand-400 border-brand-500/20';
            case 'failed':
                return 'bg-red-500/10 text-red-400 border-red-500/20';
            default:
                return 'bg-surface-500/10 text-surface-400 border-surface-500/20';
        }
    };

    return (
        <>
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 bg-brand-950/40 backdrop-blur-sm z-40"
            />

            {/* Slide-over Panel */}
            <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-surface-900/95 backdrop-blur-xl border-l border-white/10 z-50 flex flex-col shadow-2xl"
            >
                {/* Header */}
                <div className="flex-shrink-0 p-6 border-b border-white/10">
                    <div className="flex items-center gap-3 mb-4">
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-surface-50/10 rounded-lg transition-colors"
                            title="Close panel"
                        >
                            <ChevronLeft className="w-5 h-5 text-surface-400" />
                        </button>
                        <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                            documentMetadata?.doc_type === 'archive' ? "bg-purple-500/10 text-purple-400" : "bg-brand-500/10 text-brand-400"
                        )}>

                            <FileText className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            {loading ? (
                                <div className="h-6 bg-surface-50/10 rounded animate-pulse w-3/4" />
                            ) : editingName ? (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                                        className="bg-surface-50/5 border border-white/10 rounded-lg px-3 py-1.5 text-surface-950 dark:text-white text-lg font-bold focus:outline-none focus:border-brand-500/50 flex-1"
                                        autoFocus
                                    />
                                    <button
                                        onClick={handleSaveName}
                                        className="p-1.5 hover:bg-green-500/20 text-green-400 rounded-lg transition-colors"
                                    >
                                        <Check className="w-5 h-5" />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <h2 className="text-lg font-bold text-surface-950 dark:text-white truncate">{documentMetadata?.name}</h2>

                                    <button
                                        onClick={() => setEditingName(true)}
                                        className="p-1 hover:bg-surface-50/10 rounded-lg transition-colors flex-shrink-0"
                                    >
                                        <Edit2 className="w-4 h-4 text-surface-400" />
                                    </button>
                                </div>
                            )}
                            {!loading && documentMetadata && (
                                <div className="flex items-center gap-2 mt-1">
                                    <span className={cn(
                                        "text-xs font-black uppercase px-2 py-0.5 rounded border",
                                        documentMetadata.doc_type === 'archive'
                                            ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                                            : "bg-brand-500/10 text-brand-400 border-brand-500/20"
                                    )}>
                                        {documentMetadata.doc_type === 'archive' ? 'Archive' : 'Vault'}
                                    </span>
                                    <span className="text-xs text-surface-500">{documentMetadata.type?.toUpperCase()}</span>
                                    {documentMetadata.product_id && (
                                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-brand-500/5 text-brand-500 border border-brand-500/10">
                                            {documentMetadata.product_id}
                                        </span>
                                    )}
                                    {documentMetadata.deployment_type && (
                                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-surface-500/5 text-surface-500 border border-surface-500/10">
                                            {documentMetadata.deployment_type}
                                        </span>
                                    )}
                                </div>
                            )}

                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex items-center gap-1 bg-surface-50/5 p-1 rounded-xl overflow-x-auto">
                        {[
                            { id: 'overview', label: 'Overview' },
                            { id: 'metadata', label: 'Metadata' },
                            { id: 'extraction', label: 'Extraction' },
                            { id: 'indexed', label: 'Indexed' }
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={cn(
                                    "flex-1 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap",
                                    activeTab === tab.id
                                        ? "bg-brand-600 text-surface-950 dark:text-white shadow-lg"
                                        : "text-surface-400 hover:text-surface-950 dark:text-white hover:bg-surface-50/5"
                                )}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="h-24 bg-surface-50/5 rounded-xl animate-pulse" />
                            ))}
                        </div>
                    ) : (
                        <AnimatePresence mode="wait">
                            {activeTab === 'overview' && documentMetadata && (
                                <motion.div
                                    key="overview"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-4"
                                >

                                    {/* Quick Stats */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-surface-50/5 rounded-xl p-4 border border-white/5">
                                            <div className="flex items-center gap-2 text-surface-400 text-xs mb-1">
                                                <HardDrive className="w-3.5 h-3.5" />
                                                <span>Size</span>
                                            </div>
                                            <div className="text-surface-950 dark:text-white font-bold text-lg">{formatSize(documentMetadata.size)}</div>
                                        </div>
                                        <div className="bg-surface-50/5 rounded-xl p-4 border border-white/5">
                                            <div className="flex items-center gap-2 text-surface-400 text-xs mb-1">
                                                <Calendar className="w-3.5 h-3.5" />
                                                <span>Modified</span>
                                            </div>
                                            <div className="text-surface-950 dark:text-white font-bold text-sm">{formatDate(documentMetadata.last_modified)}</div>
                                        </div>

                                    </div>

                                    {/* Actions */}
                                    <div className="bg-brand-primary/5 rounded-xl p-4 border border-brand-primary/10">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h4 className="text-brand-primary font-bold text-sm mb-1">Document Actions</h4>
                                                <p className="text-surface-500 text-xs text-brand-primary/60 font-medium">Access or modify this asset</p>
                                            </div>
                                            <button
                                                onClick={handleDownload}
                                                className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-xl shadow-lg shadow-brand-primary/20 hover:shadow-brand-primary/30 active:scale-95 transition-all text-sm font-bold"
                                            >
                                                <Download className="w-4 h-4" />
                                                Download Original
                                            </button>
                                        </div>
                                    </div>

                                    {/* Status */}
                                    <div className="bg-surface-50/5 rounded-xl p-4 border border-white/5">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-surface-400 text-sm font-bold">Extraction Status</span>
                                            {getStatusIcon(documentMetadata.extraction_status)}
                                        </div>
                                        <div className={cn(
                                            "px-3 py-2 rounded-lg text-sm font-bold border inline-block",
                                            getStatusColor(documentMetadata.extraction_status)
                                        )}>
                                            {documentMetadata.extraction_status?.toUpperCase() || 'PENDING'}
                                        </div>
                                    </div>


                                    {/* Tags */}
                                    <div className="bg-surface-50/5 rounded-xl p-4 border border-white/5">
                                        <div className="flex items-center gap-2 text-surface-400 text-sm mb-3">
                                            <Tag className="w-4 h-4" />
                                            <span className="font-bold">Tags</span>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {documentMetadata.tags?.map((tag) => (
                                                <span
                                                    key={tag}
                                                    className="px-3 py-1 bg-brand-500/10 text-brand-400 rounded-lg text-sm font-medium border border-brand-500/20 flex items-center gap-2"
                                                >

                                                    {tag}
                                                    <button
                                                        onClick={() => handleRemoveTag(tag)}
                                                        className="hover:text-red-400 transition-colors"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </span>
                                            ))}
                                            {(!documentMetadata.tags || documentMetadata.tags.length === 0) && (
                                                <span className="text-surface-500 text-sm">No tags</span>
                                            )}
                                        </div>
                                    </div>


                                    {/* Description */}
                                    {documentMetadata.description && (
                                        <div className="bg-surface-50/5 rounded-xl p-4 border border-white/5">
                                            <div className="text-surface-400 text-sm font-bold mb-2">Description</div>
                                            <div className="text-surface-950 dark:text-white text-sm leading-relaxed">{documentMetadata.description}</div>
                                        </div>
                                    )}

                                </motion.div>
                            )}

                            {activeTab === 'metadata' && documentMetadata && (
                                <motion.div
                                    key="metadata"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-3"
                                >
                                    {[
                                        { label: 'Author', value: documentMetadata.author || '-' },
                                        { label: 'Version', value: documentMetadata.version || '-' },
                                        { label: 'Language', value: documentMetadata.language || '-' },
                                        { label: 'Category', value: documentMetadata.category || '-' },
                                        { label: 'Access Level', value: documentMetadata.access_level || '-' },
                                        { label: 'Product Focus', value: documentMetadata.product_id || 'General' },
                                        { label: 'Deployment', value: documentMetadata.deployment_type || 'Cloud' },
                                    ].map((field) => (

                                        <div key={field.label} className="bg-surface-50/5 rounded-xl p-4 border border-white/5">
                                            <div className="text-surface-400 text-xs font-bold mb-1">{field.label}</div>
                                            <div className="text-surface-950 dark:text-white">{field.value}</div>
                                        </div>
                                    ))}
                                </motion.div>
                            )}

                            {activeTab === 'extraction' && (
                                <motion.div
                                    key="extraction"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-4"
                                >
                                    {extractionFlow?.timeline && extractionFlow.timeline.length > 0 ? (
                                        <div className="space-y-3">
                                            {extractionFlow.timeline.map((event: any, index: number) => (
                                                <div key={index} className="flex items-start gap-3">
                                                    <div className="flex flex-col items-center">
                                                        <div className={cn(
                                                            "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                                                            event.status === 'completed' ? "bg-green-500/20" : "bg-surface-500/20"
                                                        )}>
                                                            {event.status === 'completed' ? (
                                                                <CheckCircle className="w-4 h-4 text-green-400" />
                                                            ) : (
                                                                <Clock className="w-4 h-4 text-surface-400" />
                                                            )}
                                                        </div>
                                                        {index < extractionFlow.timeline.length - 1 && (
                                                            <div className="w-0.5 h-12 bg-surface-50/10 my-1" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 bg-surface-50/5 rounded-xl p-4 border border-white/5">
                                                        <div className="font-bold text-surface-950 dark:text-white capitalize text-sm mb-1">
                                                            {event.event.replace(/_/g, ' ')}
                                                        </div>
                                                        <div className="text-xs text-surface-400">
                                                            {formatDate(event.timestamp)}
                                                        </div>
                                                        {event.error && (
                                                            <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">
                                                                {event.error}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center text-surface-500 py-12 text-sm">
                                            No extraction flow data available
                                        </div>
                                    )}
                                </motion.div>
                            )}

                            {activeTab === 'indexed' && documentMetadata && (
                                <motion.div
                                    key="indexed"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-4"
                                >
                                    {/* Stats Grid */}
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="bg-surface-50/5 rounded-xl p-4 border border-white/5">
                                            <div className="flex items-center gap-2 text-surface-400 text-xs mb-1">
                                                <Layers className="w-3.5 h-3.5" />
                                                <span>Chunks</span>
                                            </div>
                                            <div className="text-2xl font-bold text-surface-950 dark:text-white">{documentMetadata.chunk_count || 0}</div>
                                        </div>
                                        <div className="bg-surface-50/5 rounded-xl p-4 border border-white/5">
                                            <div className="flex items-center gap-2 text-surface-400 text-xs mb-1">
                                                <FileText className="w-3.5 h-3.5" />
                                                <span>Length</span>
                                            </div>
                                            <div className="text-xl font-bold text-surface-950 dark:text-white">{((documentMetadata.text_length || 0) / 1000).toFixed(1)}k</div>
                                        </div>

                                        <div className="bg-surface-50/5 rounded-xl p-4 border border-white/5">
                                            <div className="flex items-center gap-2 text-surface-400 text-xs mb-1">
                                                <Database className="w-3.5 h-3.5" />
                                                <span>Avg Size</span>
                                            </div>
                                            <div className="text-xl font-bold text-surface-950 dark:text-white">
                                                {indexedStats?.avg_chunk_size || 0}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Embedding Model */}
                                    {documentMetadata.embedding_model && (
                                        <div className="bg-surface-50/5 rounded-xl p-4 border border-white/5">
                                            <div className="text-surface-400 text-xs font-bold mb-1">Embedding Model</div>
                                            <div className="text-surface-950 dark:text-white font-mono text-sm">{documentMetadata.embedding_model}</div>
                                        </div>
                                    )}


                                    {/* Chunk Preview */}
                                    {chunks.length > 0 && (
                                        <div className="bg-surface-50/5 rounded-xl p-4 border border-white/5">
                                            <div className="text-surface-400 text-sm font-bold mb-3">Chunk Preview</div>
                                            <div className="space-y-2">
                                                {chunks.slice(0, 3).map((chunk, index) => (
                                                    <div key={index} className="bg-surface-50/5 rounded-lg p-3 border border-white/5">
                                                        <div className="text-xs text-surface-500 mb-1 font-mono">Chunk {index + 1}</div>
                                                        <div className="text-sm text-white/80 line-clamp-3 leading-relaxed">{chunk.content}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    )}
                </div>
            </motion.div>
        </>
    );
};

export default DocumentDetailPanel;
