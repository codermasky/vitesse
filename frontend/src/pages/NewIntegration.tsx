import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    Search,
    ArrowLeft,
    CheckCircle,
    Loader2,
    Sparkles,
    Globe,
    ExternalLink, // Added import
    Database,
    Cloud,
    Server,
    Zap,
    Layout
} from 'lucide-react';
import axios from 'axios';
import { apiService } from '../services/api';
import { ProductSelectionStep } from '../components/ProductSelectionStep';

// Interfaces
interface DiscoveryResult {
    api_name: string;
    description: string;
    category: string;
    confidence_score: number;
    base_url?: string;
    auth_type?: string;
    source?: string; // 'google' | 'directory' | 'spec'
    spec_url?: string; // If available
}

interface NewIntegrationProps {
    isEditMode?: boolean;
}

export const NewIntegration: React.FC<NewIntegrationProps> = () => {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState<'search-source' | 'select-dest-product' | 'configure' | 'review'>('search-source');
    const [sourceQuery, setSourceQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [sourceResults, setSourceResults] = useState<DiscoveryResult[]>([]);
    const [selectedSource, setSelectedSource] = useState<DiscoveryResult | null>(null);
    const [selectedDest, setSelectedDest] = useState<DiscoveryResult | null>(null);

    // Product selection state
    const [products, setProducts] = useState<string[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
    const [isLoadingProducts, setIsLoadingProducts] = useState(false);

    const [userIntent, setUserIntent] = useState('');
    const [deploymentTarget, setDeploymentTarget] = useState<'local' | 'eks' | 'ecs'>('local');
    const [isCreating, setIsCreating] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch products on component mount
    useEffect(() => {
        const fetchProducts = async () => {
            setIsLoadingProducts(true);
            try {
                const response = await apiService.getProducts();
                setProducts(response.data || []);
            } catch (error) {
                console.error('Failed to fetch products:', error);
                setError('Failed to load products. Please try again.');
            } finally {
                setIsLoadingProducts(false);
            }
        };
        fetchProducts();
    }, []);

    const searchAPIs = async (query: string, type: 'source' | 'dest') => {
        if (!query.trim()) return;

        setIsSearching(true);
        setError(null);
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:9001/api/v1';
            const response = await axios.get(`${apiUrl}/vitesse/discover`, {
                params: {
                    query: query
                },
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                }
            });

            // Backend returns { status, query, results, total_found, search_time_seconds, metadata }
            const results = response.data.results || [];

            if (type === 'source') {
                setSourceResults(results);
            } else {
                // Destination search removed - now using product selection
            }

            // Log search metadata for debugging
            if (response.data.metadata) {
                console.log('🔍 Search completed:', {
                    query,
                    total: response.data.total_found,
                    time: `${response.data.search_time_seconds?.toFixed(2)}s`,
                    sources: response.data.metadata
                });
            }
        } catch (error: any) {
            console.error('Discovery failed:', error);

            // Provide more specific error messages
            let errorMessage = 'Failed to discover APIs. Please try again.';

            if (error.response?.data?.error) {
                errorMessage = error.response.data.error;
            } else if (error.response?.status === 401) {
                errorMessage = 'Authentication failed. Please log in again.';
            } else if (error.response?.status === 500) {
                errorMessage = 'Server error during search. Please try again or contact support.';
            } else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
                errorMessage = 'Search timed out. Please try a more specific query.';
            } else if (!navigator.onLine) {
                errorMessage = 'No internet connection. Please check your network.';
            }

            setError(errorMessage);
        } finally {
            setIsSearching(false);
        }
    };

    const handleSelectAPI = (result: DiscoveryResult, type: 'source' | 'dest') => {
        if (type === 'source') {
            setSelectedSource(result);
            setCurrentStep('select-dest-product');
        } else {
            setSelectedDest(result);
            setCurrentStep('configure');
        }
    };

    const handleSelectProduct = (product: string) => {
        setSelectedProduct(product);
        // Create a mock DiscoveryResult for the selected product
        setSelectedDest({
            api_name: product,
            description: `Linedata ${product} Product`,
            category: 'linedata-product',
            confidence_score: 1.0,
            source: 'product'
        });
        setCurrentStep('configure');
    };

    const createIntegration = async () => {
        if (!selectedSource || !selectedDest) return;

        setIsCreating(true);
        setError(null);
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:9001/api/v1';

            // Step 1: Create integration from discovery results
            const createPayload = {
                name: `${selectedSource.api_name} → ${selectedDest.api_name}`,
                source_discovery: selectedSource,
                dest_discovery: selectedDest,
                user_intent: userIntent || `Sync data from ${selectedSource.api_name} to ${selectedDest.api_name}`,
                deployment_target: deploymentTarget,
                metadata: {
                    created_from_workflow: true
                }
            };

            const createResponse = await axios.post(`${apiUrl}/vitesse/integrations`, createPayload, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                }
            });

            if (createResponse.data.status !== 'success') {
                throw new Error(createResponse.data.error || 'Failed to create integration');
            }

            const integrationId = createResponse.data.integration_id;
            console.log('Integration created:', integrationId);

            // Step 2: Ingest API specifications
            const ingestPayload = {
                source_spec_url: selectedSource.spec_url,
                dest_spec_url: selectedDest.spec_url
            };

            const ingestResponse = await axios.post(
                `${apiUrl}/vitesse/integrations/${integrationId}/ingest`,
                ingestPayload,
                {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                    }
                }
            );

            if (ingestResponse.data.status !== 'success') {
                throw new Error(ingestResponse.data.error || 'Failed to ingest specifications');
            }

            console.log('Specifications ingested');

            // Redirect to the new value-add workflow page
            setShowSuccess(true);
            setTimeout(() => {
                navigate(`/integrations/${integrationId}/workflow`);
            }, 2500);

        } catch (error) {
            console.error('Creation failed:', error);
            setError(`Failed to create integration: ${error instanceof Error ? error.message : 'Unknown error'}`);
            setIsCreating(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-4xl mx-auto p-6 md:p-8"
        >
            <div className="mb-8">
                <button
                    onClick={() => navigate('/integrations')}
                    className="text-surface-500 hover:text-surface-950 dark:hover:text-white transition-colors flex items-center gap-2 mb-4"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Integrations
                </button>
                <h1 className="text-3xl font-bold text-surface-950 dark:text-white">
                    Create New Integration
                </h1>
                <p className="text-surface-500 dark:text-surface-400 mt-2">
                    Use AI agents to discover, map, and deploy a new integration pipeline.
                </p>
            </div>

            {/* Error Message */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-600 dark:text-red-400"
                    >
                        {error}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Step Content */}
            <AnimatePresence mode="wait">
                {currentStep === 'search-source' && (
                    <SearchStep
                        key="search-source"
                        title="Search for Source API"
                        description="What API do you want to pull data from?"
                        query={sourceQuery}
                        setQuery={setSourceQuery}
                        onSearch={() => searchAPIs(sourceQuery, 'source')}
                        results={sourceResults}
                        isSearching={isSearching}
                        onSelect={(result) => handleSelectAPI(result, 'source')}
                        selectedAPI={selectedSource}
                    />
                )}

                {currentStep === 'select-dest-product' && (
                    <ProductSelectionStep
                        key="select-dest-product"
                        products={products}
                        selectedProduct={selectedProduct}
                        onSelect={handleSelectProduct}
                        isLoading={isLoadingProducts}
                        onBack={() => setCurrentStep('search-source')}
                    />
                )}

                {currentStep === 'configure' && (
                    <ConfigureStep
                        key="configure"
                        userIntent={userIntent}
                        setUserIntent={setUserIntent}
                        deploymentTarget={deploymentTarget}
                        setDeploymentTarget={setDeploymentTarget}
                        onBack={() => setCurrentStep('select-dest-product')}
                        onNext={() => setCurrentStep('review')}
                    />
                )}

                {currentStep === 'review' && (
                    <ReviewStep
                        key="review"
                        source={selectedSource!}
                        dest={selectedDest!}
                        userIntent={userIntent}
                        deploymentTarget={deploymentTarget}
                        onBack={() => setCurrentStep('configure')}
                        onCreate={createIntegration}
                        isCreating={isCreating}
                    />
                )}
            </AnimatePresence>

            {/* Success Overlay */}
            <AnimatePresence>
                {showSuccess && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-surface-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-6"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-white dark:bg-surface-900 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border border-surface-200 dark:border-surface-700"
                        >
                            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                                <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
                            </div>
                            <h3 className="text-2xl font-bold text-surface-950 dark:text-white mb-2">
                                Integration Started!
                            </h3>
                            <p className="text-surface-600 dark:text-surface-400 mb-8">
                                Our agents are now building your integration in the background. You can track progress on the dashboard.
                            </p>
                            <div className="w-full bg-surface-100 dark:bg-surface-800 rounded-full h-1.5 overflow-hidden">
                                <motion.div
                                    className="h-full bg-green-500"
                                    initial={{ width: "0%" }}
                                    animate={{ width: "100%" }}
                                    transition={{ duration: 2 }}
                                />
                            </div>
                            <p className="text-xs text-surface-500 mt-4">
                                Redirecting to setup workflow...
                            </p>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

// Search Step Component
interface SearchStepProps {
    title: string;
    description: string;
    query: string;
    setQuery: (q: string) => void;
    onSearch: () => void;
    results: DiscoveryResult[];
    isSearching: boolean;
    onSelect: (result: DiscoveryResult) => void;
    selectedAPI: DiscoveryResult | null;
    onBack?: () => void;
}

// Autocomplete suggestion type
interface AutocompleteSuggestion {
    name: string;
    category: string;
    description: string;
}

const SearchStep: React.FC<SearchStepProps> = ({
    title,
    description,
    query,
    setQuery,
    onSearch,
    results,
    isSearching,
    onSelect,
    selectedAPI,
    onBack
}) => {
    // Autocomplete state
    const [autocompleteResults, setAutocompleteResults] = useState<AutocompleteSuggestion[]>([]);
    const [showAutocomplete, setShowAutocomplete] = useState(false);
    const [isLoadingAutocomplete, setIsLoadingAutocomplete] = useState(false);
    const autocompleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Debounced autocomplete fetch
    useEffect(() => {
        if (autocompleteTimeoutRef.current) {
            clearTimeout(autocompleteTimeoutRef.current);
        }

        if (!query || query.length < 1) {
            setAutocompleteResults([]);
            setShowAutocomplete(false);
            return;
        }

        // Debounce the autocomplete request
        autocompleteTimeoutRef.current = setTimeout(async () => {
            setIsLoadingAutocomplete(true);
            try {
                const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:9001/api/v1';
                const response = await axios.get(`${apiUrl}/vitesse/discover/autocomplete`, {
                    params: { query, limit: 8 },
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                    }
                });

                if (response.data.suggestions && response.data.suggestions.length > 0) {
                    setAutocompleteResults(response.data.suggestions);
                    setShowAutocomplete(true);
                } else {
                    setAutocompleteResults([]);
                    setShowAutocomplete(false);
                }
            } catch (error) {
                console.error('Autocomplete error:', error);
                setAutocompleteResults([]);
                setShowAutocomplete(false);
            } finally {
                setIsLoadingAutocomplete(false);
            }
        }, 200); // 200ms debounce

        return () => {
            if (autocompleteTimeoutRef.current) {
                clearTimeout(autocompleteTimeoutRef.current);
            }
        };
    }, [query]);

    // Handle suggestion click
    const handleSuggestionClick = (suggestion: AutocompleteSuggestion) => {
        setQuery(suggestion.name);
        setShowAutocomplete(false);
        setAutocompleteResults([]);
    };

    // Close autocomplete when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (inputRef.current && !inputRef.current.contains(event.target as Node)) {
                setShowAutocomplete(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="glass rounded-2xl p-8 border border-surface-200/50 dark:border-surface-800/50"
        >
            <h2 className="text-2xl font-bold text-surface-950 dark:text-white mb-2">
                {title}
            </h2>
            <p className="text-surface-600 dark:text-surface-400 mb-6">
                {description}
            </p>

            {/* Search Input */}
            <div className="relative mb-8" ref={inputRef}>
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => autocompleteResults.length > 0 && setShowAutocomplete(true)}
                    onKeyDown={(e) => e.key === 'Enter' && onSearch()}
                    placeholder="e.g., Shopify, GitHub, Stripe, CoinGecko..."
                    className="w-full pl-12 pr-32 py-4 bg-white dark:bg-surface-800 border border-surface-300 dark:border-surface-700 rounded-xl text-surface-950 dark:text-white placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                />
                <button
                    onClick={onSearch}
                    disabled={!query || isSearching}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2 bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-lg font-semibold hover:shadow-lg hover:shadow-brand-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    {isSearching ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Searching...
                        </>
                    ) : (
                        <>
                            <Sparkles className="w-4 h-4" />
                            Search
                        </>
                    )}
                </button>

                {/* Autocomplete Dropdown */}
                <AnimatePresence>
                    {showAutocomplete && autocompleteResults.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute z-50 w-full mt-2 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-xl overflow-hidden"
                        >
                            <div className="p-2">
                                <p className="text-xs font-semibold text-surface-500 px-3 py-1 uppercase tracking-wide">
                                    Suggestions
                                </p>
                                {autocompleteResults.map((suggestion, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleSuggestionClick(suggestion)}
                                        className="w-full text-left px-3 py-2.5 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg transition-colors flex items-center gap-3"
                                    >
                                        <div className="flex-1">
                                            <span className="font-medium text-surface-950 dark:text-white">
                                                {suggestion.name}
                                            </span>
                                            <span className="text-xs text-surface-500 ml-2">
                                                {suggestion.category}
                                            </span>
                                        </div>
                                        <Sparkles className="w-3 h-3 text-brand-400" />
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Autocomplete Loading */}
                {isLoadingAutocomplete && query && (
                    <div className="absolute right-12 top-1/2 -translate-y-1/2">
                        <Loader2 className="w-4 h-4 animate-spin text-surface-400" />
                    </div>
                )}
            </div>

            {/* Enhanced Loading State with Progress */}
            {isSearching && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-12"
                >
                    <div className="w-20 h-20 mx-auto mb-6 relative">
                        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-brand-500 to-purple-500 opacity-20 animate-pulse" />
                        <div className="absolute inset-2 rounded-full bg-white dark:bg-surface-900 flex items-center justify-center">
                            <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
                        </div>
                    </div>
                    <h3 className="text-lg font-semibold text-surface-950 dark:text-white mb-4">Discovering APIs</h3>

                    {/* Search Progress Steps */}
                    <div className="max-w-md mx-auto space-y-3">
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0 }}
                            className="flex items-center gap-3 p-3 bg-brand-500/10 border border-brand-500/20 rounded-lg"
                        >
                            <div className="w-6 h-6 rounded-full bg-brand-500 flex items-center justify-center flex-shrink-0">
                                <Loader2 className="w-3 h-3 text-white animate-spin" />
                            </div>
                            <span className="text-sm font-medium text-surface-700 dark:text-surface-300">Searching API catalog...</span>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 0.5, x: 0 }}
                            transition={{ delay: 0.3 }}
                            className="flex items-center gap-3 p-3 bg-surface-100 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-700 rounded-lg opacity-50"
                        >
                            <div className="w-6 h-6 rounded-full bg-surface-300 dark:bg-surface-600 flex items-center justify-center flex-shrink-0">
                                <Database className="w-3 h-3 text-surface-500" />
                            </div>
                            <span className="text-sm text-surface-600 dark:text-surface-400">Searching knowledge base...</span>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 0.5, x: 0 }}
                            transition={{ delay: 0.6 }}
                            className="flex items-center gap-3 p-3 bg-surface-100 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-700 rounded-lg opacity-50"
                        >
                            <div className="w-6 h-6 rounded-full bg-surface-300 dark:bg-surface-600 flex items-center justify-center flex-shrink-0">
                                <Sparkles className="w-3 h-3 text-surface-500" />
                            </div>
                            <span className="text-sm text-surface-600 dark:text-surface-400">Consulting AI (if needed)...</span>
                        </motion.div>
                    </div>

                    <p className="text-xs text-surface-500 dark:text-surface-400 mt-6">This usually takes just a few seconds</p>
                </motion.div>
            )}

            {/* No Results State */}
            {!isSearching && results.length === 0 && query && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-12"
                >
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-100 dark:bg-surface-800 flex items-center justify-center">
                        <Search className="w-8 h-8 text-surface-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-surface-950 dark:text-white mb-2">No APIs Found</h3>
                    <p className="text-surface-600 dark:text-surface-400 mb-6">
                        We couldn't find any APIs matching "{query}"
                    </p>
                    <div className="max-w-md mx-auto text-left bg-surface-50 dark:bg-surface-800/50 rounded-xl p-4 border border-surface-200 dark:border-surface-700">
                        <p className="text-sm font-semibold text-surface-700 dark:text-surface-300 mb-2">Try:</p>
                        <ul className="text-sm text-surface-600 dark:text-surface-400 space-y-1">
                            <li>• Using the official API name (e.g., "Stripe", "GitHub")</li>
                            <li>• Searching by category (e.g., "payment", "CRM")</li>
                            <li>• Checking your spelling</li>
                            <li>• Using a more general search term</li>
                        </ul>
                    </div>
                </motion.div>
            )}

            {/* Results Grid */}
            {!isSearching && results.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {results.map((result, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            onClick={() => onSelect(result)}
                            className={`
                                group p-6 rounded-xl border cursor-pointer transition-all
                                ${selectedAPI === result
                                    ? 'bg-brand-500/10 border-brand-500/50 ring-1 ring-brand-500/50'
                                    : 'bg-white dark:bg-surface-900 border-surface-200 dark:border-surface-700 hover:border-brand-500/50 hover:shadow-lg hover:shadow-brand-500/10'
                                }
                            `}
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="p-3 bg-surface-100 dark:bg-surface-800 rounded-lg group-hover:bg-white dark:group-hover:bg-surface-700 transition-colors">
                                    <Globe className="w-6 h-6 text-brand-500" />
                                </div>
                                <div className={`
                                    px-2 py-1 rounded text-xs font-semibold uppercase tracking-wider
                                    ${result.source === 'catalog' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                        result.source === 'knowledge_base' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                            'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'}
                                `}>
                                    {result.source === 'knowledge_base' ? 'KB' : result.source}
                                </div>
                            </div>
                            <h3 className="text-lg font-bold text-surface-950 dark:text-white mb-2 group-hover:text-brand-500 transition-colors">
                                {result.api_name}
                            </h3>
                            <p className="text-sm text-surface-600 dark:text-surface-400 mb-4 line-clamp-2">
                                {result.description}
                            </p>
                            <div className="flex items-center justify-between pt-4 border-t border-surface-200 dark:border-surface-800">
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1 text-xs text-surface-500">
                                        <Database className="w-3 h-3" />
                                        JSON
                                    </div>
                                    <div className="w-1 h-1 bg-surface-300 rounded-full" />
                                    <a
                                        href={result.base_url || result.spec_url || '#'}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="text-xs text-brand-500 hover:text-brand-600 flex items-center gap-1"
                                    >
                                        Docs <ExternalLink className="w-3 h-3" />
                                    </a>
                                </div>
                                <div className="ml-4">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center text-white font-bold">
                                        {Math.round(result.confidence_score * 100)}%
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between mt-8">
                {onBack && (
                    <button
                        onClick={onBack}
                        className="px-6 py-3 text-surface-600 dark:text-surface-400 hover:text-brand-500 transition-colors flex items-center gap-2"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back
                    </button>
                )}
            </div>
        </motion.div>
    );
};

// Configure Step Component
interface ConfigureStepProps {
    userIntent: string;
    setUserIntent: (intent: string) => void;
    deploymentTarget: 'local' | 'eks' | 'ecs';
    setDeploymentTarget: (target: 'local' | 'eks' | 'ecs') => void;
    onBack: () => void;
    onNext: () => void;
}

const ConfigureStep: React.FC<ConfigureStepProps> = ({
    userIntent,
    setUserIntent,
    deploymentTarget,
    setDeploymentTarget,
    onBack,
    onNext
}) => {
    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="glass rounded-2xl p-8 border border-surface-200/50 dark:border-surface-800/50"
        >
            <h2 className="text-2xl font-bold text-surface-950 dark:text-white mb-2">
                Configure Integration
            </h2>
            <p className="text-surface-600 dark:text-surface-400 mb-8">
                Tell our agents how you want this integration to behave.
            </p>

            <div className="space-y-8">
                {/* User Intent */}
                <div>
                    <label className="block text-sm font-semibold text-surface-950 dark:text-white mb-2">
                        Integration Goal (Natural Language)
                    </label>
                    <textarea
                        value={userIntent}
                        onChange={(e) => setUserIntent(e.target.value)}
                        placeholder="e.g., Every hour, fetch new products from Shopify and update our inventory database..."
                        className="w-full p-4 bg-white dark:bg-surface-800 border border-surface-300 dark:border-surface-700 rounded-xl text-surface-950 dark:text-white placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 min-h-[120px]"
                    />
                    <p className="text-xs text-surface-500 mt-2">
                        Our agents will use this to generate the mapping logic.
                    </p>
                </div>

                {/* Deployment Target */}
                <div>
                    <label className="block text-sm font-semibold text-surface-950 dark:text-white mb-4">
                        Deployment Target
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <button
                            onClick={() => setDeploymentTarget('local')}
                            className={`
                                p-4 rounded-xl border text-left transition-all
                                ${deploymentTarget === 'local'
                                    ? 'bg-brand-500/10 border-brand-500 ring-1 ring-brand-500'
                                    : 'bg-white dark:bg-surface-900 border-surface-200 dark:border-surface-700 hover:border-brand-500/50'
                                }
                            `}
                        >
                            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-3">
                                <Server className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                            </div>
                            <h4 className="font-semibold text-surface-950 dark:text-white">Local Docker</h4>
                            <p className="text-xs text-surface-500 mt-1">Deploy to local container runtime</p>
                        </button>

                        <button
                            onClick={() => setDeploymentTarget('eks')}
                            className={`
                                p-4 rounded-xl border text-left transition-all
                                ${deploymentTarget === 'eks'
                                    ? 'bg-brand-500/10 border-brand-500 ring-1 ring-brand-500'
                                    : 'bg-white dark:bg-surface-900 border-surface-200 dark:border-surface-700 hover:border-brand-500/50'
                                }
                            `}
                        >
                            <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mb-3">
                                <Cloud className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                            </div>
                            <h4 className="font-semibold text-surface-950 dark:text-white">AWS EKS</h4>
                            <p className="text-xs text-surface-500 mt-1">Deploy to Elastic Kubernetes Service</p>
                        </button>

                        <button
                            onClick={() => setDeploymentTarget('ecs')}
                            className={`
                                p-4 rounded-xl border text-left transition-all
                                ${deploymentTarget === 'ecs'
                                    ? 'bg-brand-500/10 border-brand-500 ring-1 ring-brand-500'
                                    : 'bg-white dark:bg-surface-900 border-surface-200 dark:border-surface-700 hover:border-brand-500/50'
                                }
                            `}
                        >
                            <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-3">
                                <Layout className="w-6 h-6 text-green-600 dark:text-green-400" />
                            </div>
                            <h4 className="font-semibold text-surface-950 dark:text-white">AWS ECS</h4>
                            <p className="text-xs text-surface-500 mt-1">Deploy to Elastic Container Service</p>
                        </button>
                    </div>
                </div>

                <div className="flex justify-between pt-6">
                    <button
                        onClick={onBack}
                        className="px-6 py-3 text-surface-600 dark:text-surface-400 hover:text-brand-500 transition-colors flex items-center gap-2"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back
                    </button>
                    <button
                        onClick={onNext}
                        className="px-8 py-3 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-semibold transition-all shadow-lg shadow-brand-500/20"
                    >
                        Review & Create
                    </button>
                </div>
            </div>
        </motion.div>
    );
};

// Review Step Component
interface ReviewStepProps {
    source: DiscoveryResult;
    dest: DiscoveryResult;
    userIntent: string;
    deploymentTarget: string;
    onBack: () => void;
    onCreate: () => void;
    isCreating: boolean;
}

const ReviewStep: React.FC<ReviewStepProps> = ({
    source,
    dest,
    userIntent,
    deploymentTarget,
    onBack,
    onCreate,
    isCreating
}) => {
    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="glass rounded-2xl p-8 border border-surface-200/50 dark:border-surface-800/50"
        >
            <h2 className="text-2xl font-bold text-surface-950 dark:text-white mb-6">
                Review & Launch
            </h2>

            <div className="space-y-6">
                <div className="flex items-center gap-4 p-4 bg-surface-50 dark:bg-surface-800/50 rounded-xl border border-surface-200 dark:border-surface-700">
                    <div className="flex-1">
                        <h4 className="text-xs font-semibold text-surface-500 uppercase mb-1">Source</h4>
                        <p className="font-bold text-surface-950 dark:text-white text-lg">{source.api_name}</p>
                    </div>
                    <div className="text-surface-400">
                        <ArrowLeft className="w-6 h-6 rotate-180" />
                    </div>
                    <div className="flex-1 text-right">
                        <h4 className="text-xs font-semibold text-surface-500 uppercase mb-1">Destination</h4>
                        <p className="font-bold text-surface-950 dark:text-white text-lg">{dest.api_name}</p>
                    </div>
                </div>

                <div className="p-4 bg-surface-50 dark:bg-surface-800/50 rounded-xl border border-surface-200 dark:border-surface-700">
                    <h4 className="text-xs font-semibold text-surface-500 uppercase mb-2">Integration Goal</h4>
                    <p className="text-surface-700 dark:text-surface-300 italic">
                        "{userIntent || 'Default sync behavior'}"
                    </p>
                </div>

                <div className="p-4 bg-surface-50 dark:bg-surface-800/50 rounded-xl border border-surface-200 dark:border-surface-700">
                    <h4 className="text-xs font-semibold text-surface-500 uppercase mb-2">Deployment Target</h4>
                    <div className="flex items-center gap-2">
                        <Server className="w-4 h-4 text-brand-500" />
                        <span className="font-medium text-surface-950 dark:text-white capitalize">{deploymentTarget}</span>
                    </div>
                </div>
            </div>

            <div className="flex justify-between pt-8">
                <button
                    onClick={onBack}
                    disabled={isCreating}
                    className="px-6 py-3 text-surface-600 dark:text-surface-400 hover:text-brand-500 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                </button>
                <button
                    onClick={onCreate}
                    disabled={isCreating}
                    className="px-8 py-3 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-brand-500/20 flex items-center gap-2 disabled:opacity-70 disabled:cursor-wait"
                >
                    {isCreating ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Building Agents...
                        </>
                    ) : (
                        <>
                            <Zap className="w-5 h-5" />
                            Launch Integration
                        </>
                    )}
                </button>
            </div>
        </motion.div>
    );
};

export default NewIntegration;
