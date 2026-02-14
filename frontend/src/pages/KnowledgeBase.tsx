import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search,
    FileText,
    Upload,
    RefreshCw,
    Trash2,
    LayoutGrid,
    List as ListIcon,
    Calendar,
    HardDrive,
    Clock,
    AlertCircle,
    CheckCircle,
    Shield,
    History,
    Sparkles,
    Settings,
    X,
    Save
} from 'lucide-react';
import apiService from '../services/api';
import { cn } from '../services/utils';
import { useNotifications } from '../contexts/NotificationContext';
import DocumentDetailPanel from '../components/DocumentDetailPanel';

// Types assuming similar structure to what discoverDocuments returns or a general document type
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

// Helper function to format status for display
const getStatusMessage = (status: string): string => {
    const messages: Record<string, string> = {
        'pending': 'Waiting to process',
        'processing': 'Extracting knowledge',
        'completed': 'Ready to search',
        'indexed': 'Ready to search',
        'failed': 'Processing failed',
    };
    return messages[status] || status;
};

const KnowledgeBase: React.FC = () => {
    const { addNotification } = useNotifications();
    const [documents, setDocuments] = useState<KBDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState<'all' | 'sharepoint' | 'local' | 'vault' | 'archive'>('all');
    const [uploadType, setUploadType] = useState('vault');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [isUploading, setIsUploading] = useState(false);
    const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [idToDelete, setIdToDelete] = useState<string | null>(null);
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);
    const [productId, setProductId] = useState<string>('credo');
    const [deploymentType, setDeploymentType] = useState<string>('cloud');
    const [availableProducts, setAvailableProducts] = useState<string[]>(['credo', 'enterprise', 'compliance']);
    const [previousDocIds, setPreviousDocIds] = useState<Set<string>>(new Set());

    // Bulk Update State
    const [isBulkUpdating, setIsBulkUpdating] = useState(false);
    const [showBulkUpdateModal, setShowBulkUpdateModal] = useState(false);
    const [bulkUpdateProduct, setBulkUpdateProduct] = useState<string>('');
    const [bulkUpdateDeployment, setBulkUpdateDeployment] = useState<string>('');

    // Revectorization State
    const [revectorizingId, setRevectorizingId] = useState<string | null>(null);

    useEffect(() => {
        fetchDocuments();
        fetchAvailableProducts();
    }, []);

    const fetchAvailableProducts = async () => {
        try {
            const response = await apiService.getProducts();
            console.log('Fetched products:', response.data);
            if (response.data) {
                const products = response.data;
                setAvailableProducts(products);

                // Ensure current perspective is valid
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
            console.log('Raw API response:', response);
            console.log('Response data:', response.data);
            
            const docs = response.data.map((d: any) => ({
                ...d,
                source: d.source || 'local',
                doc_type: d.doc_type || 'vault'
            }));
            console.log('Formatted documents:', docs);
            console.log('Document count:', docs.length);
            setDocuments(docs);
        } catch (error) {
            console.error('Failed to fetch KB documents:', error);
            addNotification({
                type: 'error',
                message: 'Failed to fetch documents. Check console for details.',
                duration: 5000,
            });
        } finally {
            if (showLoading) setLoading(false);
        }
    };

    // Polling for processing documents
    useEffect(() => {
        const hasProcessing = documents.some(doc =>
            doc.status === 'pending' || doc.status === 'processing'
        );

        // Detect newly completed documents and show notifications
        documents.forEach(doc => {
            if ((doc.status === 'completed' || doc.status === 'indexed') && previousDocIds.has(doc.id)) {
                // This document was being processed and is now complete
                addNotification({
                    type: 'success',
                    message: `✓ "${doc.name}" is ready to search`,
                    duration: 4000,
                });
            } else if (doc.status === 'failed' && previousDocIds.has(doc.id)) {
                // This document failed processing
                addNotification({
                    type: 'error',
                    message: `✗ "${doc.name}" failed processing. This is usually due to missing embedding models (OpenAI API key not configured). Documents uploaded successfully but need vectorization enabled.`,
                    duration: 7000,
                });
            }
        });

        if (hasProcessing) {
            const interval = setInterval(() => {
                fetchDocuments(false);
            }, 3000); // Poll every 3 seconds

            return () => clearInterval(interval);
        }

        // Update the set of document IDs we've seen
        setPreviousDocIds(new Set(documents.map(d => d.id)));
    }, [documents]);

    const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        const fileCount = files.length;

        setIsUploading(true);
        
        // Show upload started notification
        addNotification({
            type: 'info',
            message: `Uploading ${fileCount} file${fileCount > 1 ? 's' : ''}... Please wait.`,
            duration: 0, // Keep visible until upload completes
        });

        try {
            let uploadResponse;
            if (files.length === 1) {
                uploadResponse = await apiService.uploadDocument(files[0], uploadType, productId, deploymentType);
            } else {
                uploadResponse = await apiService.uploadDocumentsBulk(files, uploadType, productId, deploymentType);
            }
            
            console.log('Upload response:', uploadResponse);
            
            // Check if upload actually succeeded
            if (!uploadResponse?.data) {
                throw new Error('Upload response was empty or invalid');
            }
            
            // For bulk uploads, check if any failed
            if (uploadResponse.data.results && Array.isArray(uploadResponse.data.results)) {
                const hasFailures = uploadResponse.data.results.some((r: any) => r.status === 'failed');
                if (hasFailures) {
                    const failedFiles = uploadResponse.data.results
                        .filter((r: any) => r.status === 'failed')
                        .map((r: any) => r.error || r.filename);
                    throw new Error(`Some files failed: ${failedFiles.join(', ')}`);
                }
            }
            
            // Wait a moment for backend to process
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Refresh document list
            await fetchDocuments();
            console.log('Documents after upload:', documents);
            
            // Show success notification
            addNotification({
                type: 'success',
                message: `✓ Successfully uploaded ${fileCount} file${fileCount > 1 ? 's' : ''}. Processing in background...`,
                duration: 5000,
            });
        } catch (error: any) {
            console.error('Upload failed:', error);
            
            // Show error notification
            const errorMessage = error?.response?.data?.detail 
                || error?.message 
                || error?.toString()
                || 'Failed to upload files. Please try again.';
            
            addNotification({
                type: 'error',
                message: `Upload failed: ${errorMessage}`,
                duration: 6000,
            });
        } finally {
            setIsUploading(false);
            event.target.value = '';
        }
    };

    const handleRevectorize = async (documentId: string, documentName: string) => {
        setRevectorizingId(documentId);
        addNotification({
            type: 'info',
            message: `Re-vectorizing \"${documentName}\"... Processing in background.`,
            duration: 0,
        });

        try {
            const response = await apiService.revectorizeDocument(documentId);
            console.log('Revectorization response:', response);

            addNotification({
                type: 'success',
                message: `✓ \"${documentName}\" queued for re-vectorization. Updated embeddings will be ready soon.`,
                duration: 5000,
            });

            // Refresh documents to show updated status
            await new Promise(resolve => setTimeout(resolve, 500));
            await fetchDocuments(false);
        } catch (error: any) {
            console.error('Revectorization failed:', error);
            const errorMessage = error?.response?.data?.detail 
                || error?.message 
                || 'Failed to revectorize document';
            
            addNotification({
                type: 'error',
                message: `Revectorization failed for \"${documentName}\": ${errorMessage}`,
                duration: 6000,
            });
        } finally {
            setRevectorizingId(null);
        }
    };

    const toggleSelection = (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredDocuments.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredDocuments.map(doc => doc.id));
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await apiService.deleteDocument(id);
            setSelectedIds(prev => prev.filter(item => item !== id));
            await fetchDocuments(false);
            setIdToDelete(null);
        } catch (error) {
            console.error('Delete failed:', error);
            alert('Failed to delete document. Please try again.');
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;

        try {
            await apiService.deleteDocumentsBulk(selectedIds);
            setSelectedIds([]);
            await fetchDocuments(false);
            setIsBulkDeleting(false);
        } catch (error) {
            console.error('Bulk delete failed:', error);
            alert('Failed to delete some documents. Please try again.');
        }
    };

    const handleBulkUpdate = async () => {
        if (selectedIds.length === 0) return;

        // If nothing selected to change, just close
        if (!bulkUpdateProduct && !bulkUpdateDeployment) {
            setShowBulkUpdateModal(false);
            return;
        }

        setIsBulkUpdating(true);
        try {
            await apiService.updateDocumentsBulk(
                selectedIds,
                bulkUpdateProduct || undefined,
                bulkUpdateDeployment || undefined
            );

            // Allow time for backend to commit
            setTimeout(async () => {
                await fetchDocuments(false);
                setSelectedIds([]);
                setShowBulkUpdateModal(false);
                setIsBulkUpdating(false);
                // Reset form
                setBulkUpdateProduct('');
                setBulkUpdateDeployment('');
            }, 500);

        } catch (error) {
            console.error('Bulk update failed:', error);
            alert('Failed to update documents. Please try again.');
            setIsBulkUpdating(false);
        }
    };

    const filteredDocuments = documents.filter(doc => {
        const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase());

        // Product Perspective Filter
        // If productId is '' (Global), we show ONLY documents with no product assigned (or explicitly 'global' if that's a value).
        // If productId is set, strict match.
        const matchesProduct = productId ? doc.product_id === productId : !doc.product_id;

        // Deployment Context Filter
        // Support 'both' visibility in specific contexts
        let matchesDeployment = true;
        if (deploymentType) {
            if (deploymentType === 'both') {
                matchesDeployment = doc.deployment_type === 'both';
            } else {
                // If context is cloud -> show cloud OR both
                // If context is on-prem -> show on-prem OR both
                matchesDeployment = doc.deployment_type === deploymentType || doc.deployment_type === 'both' || !doc.deployment_type;
            }
        }

        if (!matchesProduct || !matchesDeployment) {
            console.debug(`Filtered out ${doc.name}: matchesProduct=${matchesProduct}, matchesDeployment=${matchesDeployment}, productId=${productId}, doc.product_id=${doc.product_id}`);
            return false;
        }

        if (activeFilter === 'all') return matchesSearch;
        if (activeFilter === 'sharepoint') return matchesSearch && doc.source === 'sharepoint';
        if (activeFilter === 'vault') return matchesSearch && doc.doc_type === 'vault';
        if (activeFilter === 'archive') return matchesSearch && doc.doc_type === 'archive';

        return matchesSearch;
    });

    const formatDate = (ms: number) => {
        if (!ms) return '-';
        return new Date(ms).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const formatSize = (bytes: number) => {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    return (
        <div className="space-y-12">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass rounded-[2.5rem] p-12 border border-brand-500/10 space-y-6"
            >
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-brand-500/10 flex items-center justify-center border border-brand-500/20">
                        <HardDrive className="w-7 h-7 text-brand-500" />
                    </div>
                    <div>
                        <h1 className="text-5xl lg:text-6xl font-black tracking-tight text-surface-950 dark:text-white leading-[1.1]">Knowledge Base</h1>
                        <p className="text-lg text-surface-600 dark:text-surface-400 font-medium">Manage your intelligence assets used for RAG generation.</p>
                    </div>
                </div>
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-6 glass p-4 rounded-2xl border border-brand-primary/10 backdrop-blur-md"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center border border-brand-primary/20">
                            <Shield className="w-5 h-5 text-brand-primary" />
                        </div>
                        <div>
                            <div className="text-surface-950 dark:text-white text-xs font-black uppercase tracking-widest mb-0.5">The Vault</div>
                            <div className="text-surface-500 text-[10px] font-black uppercase tracking-tight">Vetted Content</div>
                        </div>
                    </div>
                    <div className="w-px h-10 bg-brand-primary/10" />
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-brand-secondary/10 flex items-center justify-center border border-brand-secondary/20">
                            <History className="w-5 h-5 text-brand-secondary" />
                        </div>
                        <div>
                            <div className="text-surface-950 dark:text-white text-xs font-black uppercase tracking-widest mb-0.5">The Archive</div>
                            <div className="text-surface-500 text-[10px] font-black uppercase tracking-tight">Historical Data</div>
                        </div>
                    </div>
                </motion.div>
            </motion.div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-6 glass p-4 rounded-2xl border border-brand-100 dark:border-brand-500/10">
                {/* View & Selection Group */}
                <div className="flex flex-1 items-center gap-3">
                    <button
                        onClick={toggleSelectAll}
                        title={selectedIds.length === filteredDocuments.length ? "Deselect All" : "Select All"}
                        className={cn(
                            "flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all text-xs font-bold uppercase tracking-wider",
                            selectedIds.length > 0 && selectedIds.length === filteredDocuments.length
                                ? "bg-brand-500/20 border-brand-500/50 text-brand-600 dark:text-brand-400"
                                : "bg-transparent border-brand-200 dark:border-brand-500/10 text-surface-500 hover:border-brand-300 dark:hover:border-white/20"
                        )}
                    >
                        <div className={cn(
                            "w-4 h-4 rounded border flex items-center justify-center transition-all",
                            selectedIds.length > 0 ? "bg-brand-500 border-brand-500" : "border-surface-400 dark:border-surface-600"
                        )}>
                            {selectedIds.length > 0 && (
                                <div className={cn(
                                    "w-2 h-2 rounded-sm bg-white",
                                    selectedIds.length < filteredDocuments.length && "w-2 h-0.5"
                                )} />
                            )}
                        </div>
                        <span className="hidden leading-none 2xl:block">{selectedIds.length === filteredDocuments.length ? "Deselect" : "Select All"}</span>
                    </button>

                    <div className="flex items-center bg-brand-50/50 dark:bg-brand-500/5 border border-brand-100 dark:border-brand-500/10 rounded-xl p-1">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={cn(
                                "p-2 rounded-lg transition-all",
                                viewMode === 'grid' ? "bg-surface-100 dark:bg-surface-700 text-surface-950 dark:text-white shadow-sm" : "text-surface-400 hover:text-surface-600 dark:hover:text-white"
                            )}
                            title="Grid View"
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={cn(
                                "p-2 rounded-lg transition-all",
                                viewMode === 'list' ? "bg-surface-100 dark:bg-surface-700 text-surface-950 dark:text-white shadow-sm" : "text-surface-400 hover:text-surface-600 dark:hover:text-white"
                            )}
                            title="List View"
                        >
                            <ListIcon className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="h-8 w-px bg-brand-200 dark:bg-brand-500/10 mx-1" />

                    <div className="flex items-center bg-brand-50/50 dark:bg-brand-500/5 border border-brand-100 dark:border-brand-500/10 rounded-xl p-1">
                        <button
                            onClick={() => setActiveFilter('all')}
                            className={cn("px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all", activeFilter === 'all' ? "bg-surface-100 dark:bg-surface-800 text-surface-950 dark:text-white shadow-sm" : "text-surface-400 hover:text-surface-600 dark:hover:text-white")}
                        >
                            All
                        </button>
                        <button
                            onClick={() => setActiveFilter('vault')}
                            className={cn("px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all", activeFilter === 'vault' ? "bg-brand-600 text-surface-950 dark:text-white shadow-sm" : "text-surface-400 hover:text-surface-600 dark:hover:text-white")}
                        >
                            Vault
                        </button>
                        <button
                            onClick={() => setActiveFilter('archive')}
                            className={cn("px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all", activeFilter === 'archive' ? "bg-purple-600 text-surface-950 dark:text-white shadow-sm" : "text-surface-400 hover:text-surface-600 dark:hover:text-white")}
                        >
                            Archive
                        </button>
                    </div>

                    <div className="relative w-64 group ml-auto">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 group-focus-within:text-brand-500 transition-colors" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search intelligence..."
                            className="w-full bg-brand-50/50 dark:bg-brand-500/5 border border-brand-100 dark:border-brand-500/10 rounded-xl py-2 pl-10 pr-4 text-xs text-surface-950 dark:text-white focus:outline-none focus:border-brand-500/50 transition-all placeholder:text-surface-400"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="flex items-center bg-brand-50/50 dark:bg-brand-500/5 border border-brand-100 dark:border-brand-500/10 rounded-xl p-1">
                            <button
                                onClick={() => setUploadType('vault')}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-[0.1em] transition-all",
                                    uploadType === 'vault' ? "bg-brand-500 text-white shadow-sm" : "text-surface-400 hover:text-surface-600 dark:hover:text-white"
                                )}
                            >
                                Vault
                            </button>
                            <button
                                onClick={() => setUploadType('archive')}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-[0.1em] transition-all",
                                    uploadType === 'archive' ? "bg-purple-500 text-white shadow-sm" : "text-surface-400 hover:text-surface-600 dark:hover:text-white"
                                )}
                            >
                                Archive
                            </button>
                        </div>

                        <button
                            onClick={() => document.getElementById('multi-upload-input')?.click()}
                            className={cn(
                                "p-2.5 rounded-xl transition-all shadow-lg active:scale-95",
                                uploadType === 'archive'
                                    ? "bg-purple-600 hover:bg-purple-500 shadow-purple-600/20"
                                    : "bg-brand-600 hover:bg-brand-500 shadow-brand-600/20"
                            )}
                            title={`Upload to ${uploadType === 'archive' ? 'Archive' : 'Vault'}`}
                        >
                            {isUploading ? <RefreshCw className="w-4 h-4 animate-spin text-white" /> : <Upload className="w-4 h-4 text-white" />}
                        </button>

                        <button
                            onClick={() => fetchDocuments()}
                            className="p-2.5 bg-brand-50/50 dark:bg-brand-500/5 border border-brand-100 dark:border-brand-500/10 text-surface-400 hover:text-surface-600 dark:hover:text-surface-950 dark:text-white hover:border-brand-200 dark:hover:border-white/20 rounded-xl transition-all"
                        >
                            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                        </button>
                    </div>
                </div>

                {/* Perspective Group */}
                <div className="flex items-center gap-3 bg-brand-500/5 dark:bg-brand-500/[0.03] p-1 rounded-2xl border border-brand-500/10">
                    <div className="flex items-center gap-2 pl-2 pr-1 border-r border-brand-500/10">
                        <Sparkles className="w-3.5 h-3.5 text-brand-500 shadow-brand-500/50" />
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-brand-500/60 leading-none">Perspective</span>
                    </div>

                    <div className="flex gap-1">
                        <button
                            onClick={() => setProductId('')}
                            className={cn(
                                "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                                productId === ''
                                    ? "bg-brand-600 text-white shadow-[0_0_15px_rgba(59,130,246,0.2)]"
                                    : "text-surface-400 hover:text-surface-950 dark:text-white hover:bg-surface-50/10"
                            )}
                        >
                            Global
                        </button>
                        {availableProducts.map(id => (
                            <button
                                key={id}
                                onClick={() => setProductId(id)}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                                    productId === id
                                        ? "bg-brand-600 text-white shadow-[0_0_15px_rgba(59,130,246,0.2)]"
                                        : "text-surface-400 hover:text-surface-950 dark:text-white hover:bg-surface-50/10"
                                )}
                            >
                                {id}
                            </button>
                        ))}
                    </div>

                    <div className="hidden sm:block h-4 w-px bg-brand-500/10" />

                    <div className="flex items-center gap-1">
                        {['cloud', 'on-prem', 'both'].map((d) => (
                            <button
                                key={d}
                                onClick={() => setDeploymentType(d)}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                                    deploymentType === d ? "bg-brand-500 text-white shadow-sm" : "text-surface-400 hover:text-surface-600 dark:hover:text-white"
                                )}
                            >
                                {d}
                            </button>
                        ))}
                    </div>
                </div>


            </div>

            {/* Active Processing Status */}
            {
                (isUploading || documents.some(d => d.status === 'pending' || d.status === 'processing')) && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-6 bg-brand-500/10 border border-brand-500/20 rounded-2xl p-4 flex items-center justify-between"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-brand-600/20 flex items-center justify-center animate-spin">
                                <RefreshCw className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                            </div>
                            <div>
                                <h3 className="text-surface-950 dark:text-white font-bold">Document Intelligence at Work</h3>
                                <p className="text-surface-500 text-sm">
                                    {isUploading
                                        ? "Uploading files to secure storage..."
                                        : `Extracting knowledge from ${documents.filter(d => d.status === 'pending' || d.status === 'processing').length} documents...`}
                                </p>
                            </div>
                        </div>
                        <div className="px-4 py-2 bg-brand-500/20 border border-brand-500/30 rounded-xl text-brand-600 dark:text-brand-400 text-xs font-black uppercase tracking-widest">
                            {isUploading ? "Uploading" : "Processing"}
                        </div>
                    </motion.div>
                )
            }

            {/* Content Area */}
            {
                viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        <AnimatePresence mode="popLayout">
                            {filteredDocuments.map((doc, idx) => (
                                <motion.div
                                    key={doc.id || idx}
                                    layout
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    transition={{ delay: idx * 0.05 }}
                                    onClick={() => setSelectedDocumentId(doc.id)}
                                    className={cn(
                                        "bg-surface-100 dark:bg-brand-500/[0.02] border rounded-2xl p-4 group transition-all hover:shadow-lg relative overflow-hidden cursor-pointer",
                                        doc.doc_type === 'archive'
                                            ? "border-purple-200 dark:border-purple-500/20 hover:border-purple-300 dark:hover:border-purple-500/50"
                                            : "border-brand-200 dark:border-brand-500/20 hover:border-brand-300 dark:hover:border-brand-500/50",
                                        selectedIds.includes(doc.id) && "ring-2 ring-brand-500/50 bg-surface-100 dark:bg-brand-500/[0.02] border-brand-500/30"
                                    )}
                                >
                                    <div className="absolute top-4 left-4 z-10">
                                        <div
                                            onClick={(e) => toggleSelection(doc.id, e)}
                                            className={cn(
                                                "w-5 h-5 rounded-lg border flex items-center justify-center transition-all cursor-pointer",
                                                selectedIds.includes(doc.id)
                                                    ? "bg-brand-500 border-brand-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                                                    : "bg-surface-50/80 dark:bg-brand-950/20 border-surface-300 dark:border-brand-500/20 group-hover:border-surface-400 dark:group-hover:border-white/40"
                                            )}
                                        >
                                            {selectedIds.includes(doc.id) && (
                                                <motion.div
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                    className="w-2 h-2 rounded-sm bg-white"
                                                />
                                            )}
                                        </div>
                                    </div>

                                    <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                e.preventDefault();
                                                handleRevectorize(doc.id, doc.name);
                                            }}
                                            disabled={revectorizingId === doc.id}
                                            className="p-2 bg-blue-100 dark:bg-blue-500/10 hover:bg-blue-200 dark:hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg transition-colors border border-blue-200 dark:border-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                            title="Re-vectorize Document"
                                        >
                                            {revectorizingId === doc.id ? (
                                                <RefreshCw className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <RefreshCw className="w-4 h-4" />
                                            )}
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                e.preventDefault();
                                                setIdToDelete(doc.id);
                                            }}
                                            className="p-2 bg-red-100 dark:bg-red-500/10 hover:bg-red-200 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg transition-colors border border-red-200 dark:border-red-500/20"
                                            title="Delete Document"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>

                                    <div className={cn(
                                        "w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors relative",
                                        doc.doc_type === 'archive'
                                            ? "bg-purple-100 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400"
                                            : "bg-brand-100 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400"
                                    )}>
                                        <FileText className="w-6 h-6" />
                                        {/* Status Overlay */}
                                        <div className="absolute -bottom-1 -right-1">
                                            {doc.status === 'processing' && (
                                                <div className="bg-brand-600 rounded-full p-1 shadow-lg animate-spin">
                                                    <RefreshCw className="w-3 h-3 text-white" />
                                                </div>
                                            )}
                                            {doc.status === 'pending' && (
                                                <div className="bg-surface-500 rounded-full p-1 shadow-lg">
                                                    <Clock className="w-3 h-3 text-white" />
                                                </div>
                                            )}
                                            {doc.status === 'failed' && (
                                                <div className="bg-red-600 rounded-full p-1 shadow-lg">
                                                    <AlertCircle className="w-3 h-3 text-white" />
                                                </div>
                                            )}
                                            {(doc.status === 'completed' || doc.status === 'indexed') && (
                                                <div className="bg-emerald-500 rounded-full p-1 shadow-lg">
                                                    <CheckCircle className="w-3 h-3 text-white" />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <h3 className="text-surface-950 dark:text-white font-bold text-sm mb-1 truncate" title={doc.name}>
                                        {doc.name}
                                    </h3>
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className={cn(
                                            "text-[10px] font-black uppercase px-1.5 py-0.5 rounded border",
                                            doc.doc_type === 'archive'
                                                ? "bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/20"
                                                : "bg-surface-100 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-200 dark:border-brand-500/20"
                                        )}>
                                            {doc.doc_type === 'archive' ? 'Archive' : 'Vault'}
                                        </span>
                                        <span className="text-[10px] text-surface-500 uppercase">{doc.file_type} • {formatSize(doc.size)}</span>
                                    </div>

                                    {doc.product_id || doc.deployment_type ? (
                                        <div className="flex flex-wrap gap-1.5 mb-3">
                                            {doc.product_id && (
                                                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-brand-500/5 text-brand-500 border border-brand-500/10">
                                                    {doc.product_id}
                                                </span>
                                            )}
                                            {doc.deployment_type && (
                                                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-surface-500/5 text-surface-500 border border-surface-500/10">
                                                    {doc.deployment_type}
                                                </span>
                                            )}
                                        </div>
                                    ) : null}

                                    <div className="flex items-center justify-between pt-3 border-t border-surface-100 dark:border-brand-500/5">
                                        <div className="flex items-center gap-1.5 text-surface-500">
                                            <Calendar className="w-3 h-3" />
                                            <span className="text-[10px] font-medium">{formatDate(doc.last_modified)}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-surface-500">
                                            <HardDrive className="w-3 h-3" />
                                            <span className="text-[10px] font-medium">Local</span>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                ) : (
                    <div className="bg-surface-100 dark:bg-brand-500/[0.02] border border-brand-100 dark:border-brand-500/5 rounded-2xl overflow-hidden shadow-sm">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-brand-50/50 dark:bg-brand-500/[0.02] border-b border-brand-100 dark:border-brand-500/5 text-[10px] font-black tracking-[0.2em] text-brand-400 dark:text-surface-500 uppercase">
                                    <th className="p-4 w-10">
                                        <div
                                            onClick={toggleSelectAll}
                                            className={cn(
                                                "w-5 h-5 rounded-lg border flex items-center justify-center transition-all cursor-pointer",
                                                selectedIds.length > 0 && selectedIds.length === filteredDocuments.length
                                                    ? "bg-brand-500 border-brand-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                                                    : selectedIds.length > 0
                                                        ? "bg-brand-500/50 border-brand-500/50"
                                                        : "bg-surface-100 dark:bg-surface-900 dark:bg-brand-950/20 border-surface-300 dark:border-brand-500/10 hover:border-surface-400 dark:hover:border-white/20"
                                            )}
                                        >
                                            {selectedIds.length > 0 && (
                                                <div className={cn(
                                                    "w-2 h-2 rounded-sm bg-white",
                                                    selectedIds.length < filteredDocuments.length && "w-2 h-0.5"
                                                )} />
                                            )}
                                        </div>
                                    </th>
                                    <th className="p-4">Name</th>
                                    <th className="p-4">Product</th>
                                    <th className="p-4">Deployment</th>
                                    <th className="p-4">Type</th>
                                    <th className="p-4">Size</th>
                                    <th className="p-4">Modified</th>
                                    <th className="p-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-surface-100 dark:divide-white/5">
                                {filteredDocuments.map((doc) => (
                                    <tr
                                        key={doc.id}
                                        onClick={() => setSelectedDocumentId(doc.id)}
                                        className={cn(
                                            "hover:bg-brand-50/30 dark:hover:bg-surface-50/[0.02] transition-colors group cursor-pointer",
                                            selectedIds.includes(doc.id) && "bg-surface-100 dark:bg-brand-500/[0.03]"
                                        )}
                                    >
                                        <td className="p-4 w-10" onClick={(e) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                        }}>
                                            <div
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    e.preventDefault();
                                                    toggleSelection(doc.id);
                                                }}
                                                className={cn(
                                                    "w-5 h-5 rounded-lg border flex items-center justify-center transition-all cursor-pointer",
                                                    selectedIds.includes(doc.id)
                                                        ? "bg-brand-500 border-brand-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                                                        : "bg-surface-100 dark:bg-surface-900 dark:bg-brand-950/20 border-surface-300 dark:border-brand-500/20 group-hover:border-surface-400 dark:group-hover:border-white/40"
                                                )}
                                            >
                                                {selectedIds.includes(doc.id) && (
                                                    <motion.div
                                                        initial={{ scale: 0 }}
                                                        animate={{ scale: 1 }}
                                                        className="w-2 h-2 rounded-sm bg-white"
                                                    />
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    "w-8 h-8 rounded-lg flex items-center justify-center relative",
                                                    doc.doc_type === 'archive'
                                                        ? "bg-purple-100 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400"
                                                        : "bg-brand-100 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400"
                                                )}>
                                                    <FileText className="w-4 h-4" />
                                                    <div className="absolute -bottom-1 -right-1">
                                                        {doc.status === 'processing' && <RefreshCw className="w-2.5 h-2.5 text-brand-500 animate-spin" />}
                                                        {doc.status === 'pending' && <Clock className="w-2.5 h-2.5 text-surface-400" />}
                                                        {doc.status === 'failed' && <AlertCircle className="w-2.5 h-2.5 text-red-500" />}
                                                        {(doc.status === 'completed' || doc.status === 'indexed') && <CheckCircle className="w-2.5 h-2.5 text-emerald-500" />}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-surface-950 dark:text-white max-w-xs truncate" title={doc.name}>{doc.name}</span>
                                                    <span className="text-[10px] text-surface-500 uppercase font-bold tracking-wider">
                                                        {getStatusMessage(doc.status)}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            {doc.product_id ? (
                                                <span className="px-2 py-1 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 text-[9px] font-black uppercase tracking-widest">
                                                    {doc.product_id}
                                                </span>
                                            ) : (
                                                <span className="text-[9px] text-surface-400 uppercase font-bold tracking-widest">—</span>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            {doc.deployment_type ? (
                                                <span className="px-2 py-1 rounded-lg bg-surface-500/10 text-surface-600 dark:text-surface-400 border border-surface-500/20 text-[9px] font-black uppercase tracking-widest">
                                                    {doc.deployment_type}
                                                </span>
                                            ) : (
                                                <span className="text-[9px] text-surface-400 uppercase font-bold tracking-widest">—</span>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <span className={cn(
                                                "text-[10px] font-black uppercase px-2 py-1 rounded border",
                                                doc.doc_type === 'archive'
                                                    ? "bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/20"
                                                    : "bg-surface-100 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-200 dark:border-brand-500/20"
                                            )}>
                                                {doc.doc_type === 'archive' ? 'The Archive' : 'The Vault'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-sm text-surface-500 dark:text-surface-400 font-mono">{formatSize(doc.size)}</td>
                                        <td className="p-4 text-sm text-surface-500 dark:text-surface-400">{formatDate(doc.last_modified)}</td>
                                        <td className="p-4 text-right flex items-center justify-end gap-2">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    e.preventDefault();
                                                    handleRevectorize(doc.id, doc.name);
                                                }}
                                                disabled={revectorizingId === doc.id}
                                                className="p-2 hover:bg-blue-500/20 text-surface-400 hover:text-blue-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                title="Re-vectorize"
                                            >
                                                {revectorizingId === doc.id ? (
                                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <RefreshCw className="w-4 h-4" />
                                                )}
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    e.preventDefault();
                                                    setIdToDelete(doc.id);
                                                }}
                                                className="p-2 hover:bg-red-500/20 text-surface-400 hover:text-red-500 rounded-lg transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )
            }

            {/* Confirmation Modals */}
            <AnimatePresence>
                {(idToDelete || isBulkDeleting) && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-surface-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="bg-surface-100 dark:bg-surface-900 border border-surface-200 dark:border-brand-500/10 rounded-3xl p-8 max-w-md w-full shadow-2xl"
                        >
                            <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-6">
                                <Trash2 className="w-8 h-8 text-red-500" />
                            </div>
                            <h2 className="text-2xl font-black text-surface-950 dark:text-white mb-2">Are you absolutely sure?</h2>
                            <p className="text-surface-600 dark:text-surface-400 mb-8 leading-relaxed">
                                {isBulkDeleting
                                    ? `You are about to permanently delete ${selectedIds.length} documents from the intelligence platform. This action cannot be undone.`
                                    : "This document and all its indexed intelligence will be permanently removed. This action cannot be undone."
                                }
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setIdToDelete(null);
                                        setIsBulkDeleting(false);
                                    }}
                                    className="flex-1 py-4 bg-surface-100 dark:bg-brand-500/5 hover:bg-surface-200 dark:hover:bg-surface-50/10 text-surface-950 dark:text-white rounded-2xl font-bold transition-all border border-surface-200 dark:border-brand-500/10"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => isBulkDeleting ? handleBulkDelete() : idToDelete && handleDelete(idToDelete)}
                                    className="flex-1 py-4 bg-red-500 hover:bg-red-600 text-surface-950 dark:text-white rounded-2xl font-bold shadow-lg shadow-red-500/25 transition-all"
                                >
                                    Delete Now
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Bulk Update Modal */}
            <AnimatePresence>
                {showBulkUpdateModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-surface-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="bg-surface-100 dark:bg-surface-900 border border-surface-200 dark:border-brand-500/10 rounded-3xl p-8 max-w-lg w-full shadow-2xl"
                        >
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-brand-500/10 flex items-center justify-center">
                                        <Settings className="w-6 h-6 text-brand-500" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-surface-950 dark:text-white">Bulk Settings</h2>
                                        <p className="text-surface-500 text-sm font-medium">Update {selectedIds.length} documents</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowBulkUpdateModal(false)}
                                    className="p-2 hover:bg-surface-200 dark:hover:bg-white/5 rounded-xl transition-colors"
                                >
                                    <X className="w-5 h-5 text-surface-500" />
                                </button>
                            </div>

                            <div className="space-y-6 mb-8">
                                <div className="space-y-3">
                                    <label className="text-xs font-black uppercase tracking-wider text-surface-500">Product Alignment</label>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            onClick={() => setBulkUpdateProduct('')}
                                            className={cn(
                                                "px-4 py-2 rounded-xl text-xs font-bold transition-all border",
                                                bulkUpdateProduct === ''
                                                    ? "bg-surface-200 dark:bg-white/10 text-surface-950 dark:text-white border-surface-300 dark:border-white/20"
                                                    : "bg-transparent border-surface-200 dark:border-white/5 text-surface-500 hover:text-surface-950 dark:hover:text-white"
                                            )}
                                        >
                                            No Change
                                        </button>
                                        {availableProducts.map(p => (
                                            <button
                                                key={p}
                                                onClick={() => setBulkUpdateProduct(p)}
                                                className={cn(
                                                    "px-4 py-2 rounded-xl text-xs font-bold transition-all border uppercase",
                                                    bulkUpdateProduct === p
                                                        ? "bg-brand-500 text-white border-brand-500 shadow-lg shadow-brand-500/20"
                                                        : "bg-transparent border-surface-200 dark:border-white/5 text-surface-500 hover:text-brand-500 hover:border-brand-500/30"
                                                )}
                                            >
                                                {p}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-xs font-black uppercase tracking-wider text-surface-500">Deployment Type</label>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            onClick={() => setBulkUpdateDeployment('')}
                                            className={cn(
                                                "px-4 py-2 rounded-xl text-xs font-bold transition-all border",
                                                bulkUpdateDeployment === ''
                                                    ? "bg-surface-200 dark:bg-white/10 text-surface-950 dark:text-white border-surface-300 dark:border-white/20"
                                                    : "bg-transparent border-surface-200 dark:border-white/5 text-surface-500 hover:text-surface-950 dark:hover:text-white"
                                            )}
                                        >
                                            No Change
                                        </button>
                                        {['cloud', 'on-prem', 'both'].map(d => (
                                            <button
                                                key={d}
                                                onClick={() => setBulkUpdateDeployment(d)}
                                                className={cn(
                                                    "px-4 py-2 rounded-xl text-xs font-bold transition-all border uppercase",
                                                    bulkUpdateDeployment === d
                                                        ? "bg-brand-500 text-white border-brand-500 shadow-lg shadow-brand-500/20"
                                                        : "bg-transparent border-surface-200 dark:border-white/5 text-surface-500 hover:text-brand-500 hover:border-brand-500/30"
                                                )}
                                            >
                                                {d}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleBulkUpdate}
                                disabled={isBulkUpdating}
                                className="w-full py-4 bg-brand-500 hover:bg-brand-600 text-white rounded-2xl font-bold shadow-lg shadow-brand-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {isBulkUpdating ? (
                                    <>
                                        <RefreshCw className="w-5 h-5 animate-spin" />
                                        <span>Updating...</span>
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-5 h-5" />
                                        <span>Apply Changes</span>
                                    </>
                                )}
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Document Detail Panel */}
            <AnimatePresence>
                {selectedDocumentId && (
                    <DocumentDetailPanel
                        documentId={selectedDocumentId}
                        onClose={() => setSelectedDocumentId(null)}
                        onUpdate={fetchDocuments}
                    />
                )}
            </AnimatePresence>

            {/* Bulk Actions Toolbar */}
            <AnimatePresence>
                {selectedIds.length > 0 && (
                    <motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        className="fixed bottom-8 left-1/2 -transurface-x-1/2 z-50 px-6 py-4 bg-surface-50/90 dark:bg-surface-900/90 backdrop-blur-xl border border-surface-200 dark:border-brand-500/10 rounded-2xl shadow-2xl flex items-center gap-6"
                    >
                        <div className="flex items-center gap-3 pr-6 border-r border-surface-200 dark:border-brand-500/10">
                            <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-xs font-black shadow-[0_0_15px_rgba(59,130,246,0.5)] text-white">
                                {selectedIds.length}
                            </div>
                            <span className="text-sm font-bold text-surface-950 dark:text-white uppercase tracking-wider">Documents Selected</span>
                        </div>

                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setShowBulkUpdateModal(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-surface-100 dark:bg-brand-500/10 hover:bg-surface-200 dark:hover:bg-brand-500/20 text-surface-950 dark:text-white border border-surface-200 dark:border-brand-500/10 rounded-xl text-sm font-bold transition-all"
                            >
                                <Settings className="w-4 h-4" />
                                <span className="hidden sm:inline">Settings</span>
                            </button>
                            <button
                                onClick={() => setIsBulkDeleting(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-surface-950 dark:text-white rounded-xl text-sm font-bold shadow-lg shadow-red-500/25 transition-all"

                            >
                                <Trash2 className="w-4 h-4" />
                                <span>Delete Selected ({selectedIds.length})</span>
                            </button>

                            <button
                                onClick={() => setSelectedIds([])}
                                className="px-4 py-2 text-surface-500 hover:text-surface-950 dark:text-white dark:hover:text-surface-950 transition-colors font-bold uppercase text-[10px] tracking-widest"
                            >
                                Cancel
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Hidden Multi-Upload Input */}
            <input
                id="multi-upload-input"
                type="file"
                multiple
                className="hidden"
                onChange={handleUpload}
            />
        </div >
    );
};

export default KnowledgeBase;
