import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    Search,
    Sparkles,
    ArrowRight,
    ArrowLeft,
    CheckCircle,
    ExternalLink,
    Zap,
    Shield,
    Loader2
} from 'lucide-react';
import { cn } from '../services/utils';
import axios from 'axios';

interface DiscoveryResult {
    api_name: string;
    description: string;
    documentation_url: string;
    spec_url?: string;
    base_url?: string;
    confidence_score: number;
    source: string;
    tags: string[];
}

type WizardStep = 'search-source' | 'search-dest' | 'configure' | 'review';

export const NewIntegration: React.FC = () => {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState<WizardStep>('search-source');

    // Search state
    const [sourceQuery, setSourceQuery] = useState('');
    const [destQuery, setDestQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [sourceResults, setSourceResults] = useState<DiscoveryResult[]>([]);
    const [destResults, setDestResults] = useState<DiscoveryResult[]>([]);

    // Selection state
    const [selectedSource, setSelectedSource] = useState<DiscoveryResult | null>(null);
    const [selectedDest, setSelectedDest] = useState<DiscoveryResult | null>(null);

    // Configuration state
    const [userIntent, setUserIntent] = useState('');
    const [deploymentTarget, setDeploymentTarget] = useState<'local' | 'eks' | 'ecs'>('local');

    // Creation state
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState('');

    const searchAPIs = async (query: string, type: 'source' | 'dest') => {
        try {
            setIsSearching(true);
            setError('');
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:9001/api/v1';

            const response = await axios.get(`${apiUrl}/vitesse/discover`, {
                params: { query, limit: 5 },
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                }
            });

            if (type === 'source') {
                setSourceResults(response.data.results || []);
            } else {
                setDestResults(response.data.results || []);
            }
        } catch (err) {
            console.error('API discovery failed:', err);
            setError('Failed to discover APIs. Please try again.');
        } finally {
            setIsSearching(false);
        }
    };

    const handleSelectAPI = (result: DiscoveryResult, type: 'source' | 'dest') => {
        if (type === 'source') {
            setSelectedSource(result);
            setCurrentStep('search-dest');
        } else {
            setSelectedDest(result);
            setCurrentStep('configure');
        }
    };

    const createIntegration = async () => {
        if (!selectedSource || !selectedDest) return;

        try {
            setIsCreating(true);
            setError('');
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:9001/api/v1';

            await axios.post(`${apiUrl}/vitesse/integrations`, {
                source_api_url: selectedSource.base_url || selectedSource.documentation_url,
                source_api_name: selectedSource.api_name,
                source_spec_url: selectedSource.spec_url || '',
                dest_api_url: selectedDest.base_url || selectedDest.documentation_url,
                dest_api_name: selectedDest.api_name,
                dest_spec_url: selectedDest.spec_url || '',
                user_intent: userIntent,
                deployment_target: deploymentTarget,
            }, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                    'Content-Type': 'application/json'
                }
            });

            // Navigate back to integrations page
            navigate('/integrations');
        } catch (err: any) {
            const errorMsg = err.response?.data?.detail || err.message || 'Failed to create integration';
            setError(errorMsg);
            console.error('Integration creation error:', err);
        } finally {
            setIsCreating(false);
        }
    };

    const stepProgress = {
        'search-source': 25,
        'search-dest': 50,
        'configure': 75,
        'review': 100,
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-surface-50 via-white to-brand-50/30 dark:from-surface-950 dark:via-surface-900 dark:to-surface-950">
            <div className="max-w-5xl mx-auto px-6 py-12">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <button
                        onClick={() => navigate('/integrations')}
                        className="flex items-center gap-2 text-surface-600 dark:text-surface-400 hover:text-brand-500 transition-colors mb-4"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Integrations
                    </button>

                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-3 bg-gradient-to-br from-brand-500 to-brand-600 rounded-xl">
                            <Sparkles className="w-6 h-6 text-white" />
                        </div>
                        <h1 className="text-3xl font-bold text-surface-950 dark:text-white">
                            Create New Integration
                        </h1>
                    </div>
                    <p className="text-surface-600 dark:text-surface-400">
                        Search for APIs and let our agents build the integration for you
                    </p>
                </motion.div>

                {/* Progress Bar */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mb-8"
                >
                    <div className="h-2 bg-surface-200 dark:bg-surface-800 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-gradient-to-r from-brand-500 to-brand-600"
                            initial={{ width: 0 }}
                            animate={{ width: `${stepProgress[currentStep]}%` }}
                            transition={{ duration: 0.3 }}
                        />
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-surface-500">
                        <span className={cn(currentStep === 'search-source' && 'text-brand-500 font-semibold')}>
                            Source API
                        </span>
                        <span className={cn(currentStep === 'search-dest' && 'text-brand-500 font-semibold')}>
                            Destination API
                        </span>
                        <span className={cn(currentStep === 'configure' && 'text-brand-500 font-semibold')}>
                            Configure
                        </span>
                        <span className={cn(currentStep === 'review' && 'text-brand-500 font-semibold')}>
                            Review
                        </span>
                    </div>
                </motion.div>

                {/* Error Display */}
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

                    {currentStep === 'search-dest' && (
                        <SearchStep
                            key="search-dest"
                            title="Search for Destination API"
                            description="Where do you want to send the data?"
                            query={destQuery}
                            setQuery={setDestQuery}
                            onSearch={() => searchAPIs(destQuery, 'dest')}
                            results={destResults}
                            isSearching={isSearching}
                            onSelect={(result) => handleSelectAPI(result, 'dest')}
                            selectedAPI={selectedDest}
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
                            onBack={() => setCurrentStep('search-dest')}
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
            </div>
        </div>
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
            <div className="relative mb-8">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
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
            </div>

            {/* Results */}
            {results.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300 mb-3">
                        Found {results.length} API{results.length !== 1 ? 's' : ''}
                    </h3>
                    {results.map((result, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            onClick={() => onSelect(result)}
                            className={cn(
                                "p-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-lg",
                                selectedAPI?.api_name === result.api_name
                                    ? "border-brand-500 bg-brand-50 dark:bg-brand-950/20"
                                    : "border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 hover:border-brand-300"
                            )}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className="font-semibold text-surface-950 dark:text-white">
                                            {result.api_name}
                                        </h4>
                                        <span className={cn(
                                            "px-2 py-0.5 rounded text-xs font-medium",
                                            result.source === 'catalog'
                                                ? "bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400"
                                                : "bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400"
                                        )}>
                                            {result.source === 'catalog' ? 'Official' : 'AI Found'}
                                        </span>
                                    </div>
                                    <p className="text-sm text-surface-600 dark:text-surface-400 mb-2">
                                        {result.description}
                                    </p>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {result.tags.slice(0, 3).map((tag, i) => (
                                            <span
                                                key={i}
                                                className="px-2 py-0.5 bg-surface-100 dark:bg-surface-700 rounded text-xs text-surface-600 dark:text-surface-300"
                                            >
                                                {tag}
                                            </span>
                                        ))}
                                        <a
                                            href={result.documentation_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="text-xs text-brand-500 hover:text-brand-600 flex items-center gap-1"
                                        >
                                            Docs <ExternalLink className="w-3 h-3" />
                                        </a>
                                    </div>
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
            <p className="text-surface-600 dark:text-surface-400 mb-6">
                Tell us what you want to achieve with this integration
            </p>

            {/* User Intent */}
            <div className="mb-6">
                <label className="block text-sm font-semibold text-surface-700 dark:text-surface-300 mb-2">
                    What do you want to sync?
                </label>
                <textarea
                    value={userIntent}
                    onChange={(e) => setUserIntent(e.target.value)}
                    placeholder="e.g., Sync new orders from Shopify to my inventory system every hour"
                    rows={4}
                    className="w-full px-4 py-3 bg-white dark:bg-surface-800 border border-surface-300 dark:border-surface-700 rounded-xl text-surface-950 dark:text-white placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all resize-none"
                />
            </div>

            {/* Deployment Target */}
            <div className="mb-8">
                <label className="block text-sm font-semibold text-surface-700 dark:text-surface-300 mb-3">
                    Deployment Target
                </label>
                <div className="grid grid-cols-3 gap-3">
                    {(['local', 'eks', 'ecs'] as const).map((target) => (
                        <button
                            key={target}
                            onClick={() => setDeploymentTarget(target)}
                            className={cn(
                                "p-4 rounded-xl border-2 transition-all text-left",
                                deploymentTarget === target
                                    ? "border-brand-500 bg-brand-50 dark:bg-brand-950/20"
                                    : "border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 hover:border-brand-300"
                            )}
                        >
                            <div className="font-semibold text-surface-950 dark:text-white uppercase text-sm">
                                {target}
                            </div>
                            <div className="text-xs text-surface-500 mt-1">
                                {target === 'local' && 'Docker on VPS'}
                                {target === 'eks' && 'AWS EKS'}
                                {target === 'ecs' && 'AWS ECS'}
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between">
                <button
                    onClick={onBack}
                    className="px-6 py-3 text-surface-600 dark:text-surface-400 hover:text-brand-500 transition-colors flex items-center gap-2"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                </button>
                <button
                    onClick={onNext}
                    disabled={!userIntent}
                    className="px-8 py-3 bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-brand-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    Continue
                    <ArrowRight className="w-4 h-4" />
                </button>
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
            <h2 className="text-2xl font-bold text-surface-950 dark:text-white mb-2">
                Review & Create
            </h2>
            <p className="text-surface-600 dark:text-surface-400 mb-6">
                Our agents will now build, test, and deploy your integration
            </p>

            {/* Integration Flow Visualization */}
            <div className="mb-8 p-6 bg-gradient-to-br from-brand-50 to-purple-50 dark:from-brand-950/20 dark:to-purple-950/20 rounded-xl border border-brand-200 dark:border-brand-800">
                <div className="flex items-center justify-between">
                    <div className="flex-1">
                        <div className="text-xs font-semibold text-brand-600 dark:text-brand-400 mb-1">SOURCE</div>
                        <div className="font-bold text-surface-950 dark:text-white">{source.api_name}</div>
                    </div>
                    <div className="px-4">
                        <ArrowRight className="w-6 h-6 text-brand-500" />
                    </div>
                    <div className="flex-1 text-right">
                        <div className="text-xs font-semibold text-brand-600 dark:text-brand-400 mb-1">DESTINATION</div>
                        <div className="font-bold text-surface-950 dark:text-white">{dest.api_name}</div>
                    </div>
                </div>
            </div>

            {/* Details */}
            <div className="space-y-4 mb-8">
                <div>
                    <div className="text-sm font-semibold text-surface-700 dark:text-surface-300 mb-1">
                        Integration Goal
                    </div>
                    <div className="p-3 bg-surface-100 dark:bg-surface-800 rounded-lg text-surface-950 dark:text-white">
                        {userIntent}
                    </div>
                </div>
                <div>
                    <div className="text-sm font-semibold text-surface-700 dark:text-surface-300 mb-1">
                        Deployment
                    </div>
                    <div className="p-3 bg-surface-100 dark:bg-surface-800 rounded-lg text-surface-950 dark:text-white uppercase">
                        {deploymentTarget}
                    </div>
                </div>
            </div>

            {/* What Happens Next */}
            <div className="mb-8 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-3">
                    <Zap className="w-5 h-5 text-blue-500 mt-0.5" />
                    <div>
                        <div className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                            Autonomous Build Process
                        </div>
                        <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                            <li>• Ingestor Agent: Fetch and parse API specifications</li>
                            <li>• Mapper Agent: Generate intelligent field mappings</li>
                            <li>• Guardian Agent: Test endpoints and validate data flow</li>
                            <li>• Deployer Agent: Build and deploy containerized integration</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between">
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
                    className="px-8 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-green-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    {isCreating ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Creating Integration...
                        </>
                    ) : (
                        <>
                            <CheckCircle className="w-5 h-5" />
                            Create Integration
                        </>
                    )}
                </button>
            </div>
        </motion.div>
    );
};
