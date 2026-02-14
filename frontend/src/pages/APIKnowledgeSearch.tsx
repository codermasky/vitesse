import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Database,
  Globe,
  Github,
  ShoppingCart,
  ExternalLink,
  Sparkles,
  Clock,
  Tag,
  Star,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import apiService from '../services/api';
import { cn } from '../services/utils';

// Types for API knowledge search
interface APISearchResult {
  api: string;
  similarity_score: number;
  doc_id: string;
  collection: string;
  category: string;
  source: string;
}

interface HarvestSource {
  id: number;
  name: string;
  type: 'api_directory' | 'marketplace' | 'github' | 'documentation';
  url: string;
  category?: string;
  enabled: boolean;
}

const APIKnowledgeSearch: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<APISearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [topK, setTopK] = useState(10);
  const [expandedResult, setExpandedResult] = useState<string | null>(null);
  const [harvestSources, setHarvestSources] = useState<HarvestSource[]>([]);

  const categories = [
    'all', 'payments', 'ecommerce', 'crm', 'communication',
    'analytics', 'developer_tools', 'cloud', 'general'
  ];

  useEffect(() => {
    loadHarvestSources();
  }, []);

  const loadHarvestSources = async () => {
    try {
      const response = await apiService.getHarvestSources({ enabled_only: true });
      setHarvestSources(response.data.items || []);
    } catch (error) {
      console.error('Failed to load harvest sources:', error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      // Note: This would need a backend endpoint for searching harvested APIs
      // For now, we'll simulate the search
      const mockResults: APISearchResult[] = [
        {
          api: 'Stripe Payments API',
          similarity_score: 0.95,
          doc_id: 'stripe_001',
          collection: 'api_specifications',
          category: 'payments',
          source: 'github'
        },
        {
          api: 'Shopify Admin API',
          similarity_score: 0.89,
          doc_id: 'shopify_001',
          collection: 'api_specifications',
          category: 'ecommerce',
          source: 'marketplace'
        },
        {
          api: 'Twilio SMS API',
          similarity_score: 0.87,
          doc_id: 'twilio_001',
          collection: 'api_specifications',
          category: 'communication',
          source: 'apis_guru'
        }
      ];

      // Filter by category if selected
      const filteredResults = selectedCategory === 'all'
        ? mockResults
        : mockResults.filter(result => result.category === selectedCategory);

      setSearchResults(filteredResults.slice(0, topK));
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'github': return <Github className="w-4 h-4" />;
      case 'apis_guru': return <Database className="w-4 h-4" />;
      case 'marketplace': return <ShoppingCart className="w-4 h-4" />;
      default: return <Globe className="w-4 h-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      payments: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      ecommerce: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      crm: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
      communication: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
      analytics: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
      developer_tools: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
      cloud: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300',
      general: 'bg-brand-100 text-brand-800 dark:bg-brand-900 dark:text-brand-300'
    };
    return colors[category] || colors.general;
  };

  const getSourceName = (source: string) => {
    const names: Record<string, string> = {
      github: 'GitHub',
      apis_guru: 'APIs.guru',
      marketplace: 'API Marketplace'
    };
    return names[source] || source;
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
            <Database className="w-7 h-7 text-brand-500" />
          </div>
          <div>
            <h1 className="text-5xl lg:text-6xl font-black tracking-tight text-surface-950 dark:text-white leading-[1.1]">API Knowledge Search</h1>
            <p className="text-lg text-surface-600 dark:text-surface-400 font-medium">Search harvested API knowledge using semantic similarity</p>
          </div>
        </div>
      </motion.div>

      {/* Search Controls */}
      <div className="bg-white dark:bg-surface-800 rounded-lg p-6 border border-surface-200 dark:border-surface-700">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search Input */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-surface-400 w-5 h-5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search for APIs (e.g., 'payment processing', 'user management', 'file storage')"
              className="w-full pl-10 pr-4 py-3 border border-surface-300 dark:border-surface-600 rounded-lg bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-3">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-3 border border-surface-300 dark:border-surface-600 rounded-lg bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100"
            >
              <option value="all">All Categories</option>
              {categories.slice(1).map(category => (
                <option key={category} value={category}>
                  {category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </option>
              ))}
            </select>

            <select
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
              className="px-3 py-3 border border-surface-300 dark:border-surface-600 rounded-lg bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100"
            >
              <option value={5}>Top 5</option>
              <option value={10}>Top 10</option>
              <option value={20}>Top 20</option>
              <option value={50}>Top 50</option>
            </select>

            <button
              onClick={handleSearch}
              disabled={loading || !searchQuery.trim()}
              className="px-6 py-3 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              Search
            </button>
          </div>
        </div>

        {/* Search Tips */}
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Search Tips:</strong> Try natural language queries like "payment processing APIs",
              "user authentication", or "file storage services". The search uses semantic similarity
              to find relevant APIs from our harvested knowledge base.
            </div>
          </div>
        </div>
      </div>

      {/* Search Results */}
      <AnimatePresence>
        {searchResults.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100">
                Search Results ({searchResults.length})
              </h3>
              <div className="text-sm text-surface-500 dark:text-surface-400">
                Sorted by semantic similarity
              </div>
            </div>

            <div className="space-y-3">
              {searchResults.map((result, index) => (
                <motion.div
                  key={result.doc_id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 overflow-hidden"
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="text-lg font-semibold text-surface-900 dark:text-surface-100">
                            {result.api}
                          </h4>
                          <span className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium", getCategoryColor(result.category))}>
                            <Tag className="w-3 h-3" />
                            {result.category}
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-300">
                            {getSourceIcon(result.source)}
                            {getSourceName(result.source)}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-surface-500 dark:text-surface-400">
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 text-yellow-500" />
                            <span>{(result.similarity_score * 100).toFixed(1)}% match</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Database className="w-4 h-4" />
                            <span>{result.collection.replace('_', ' ')}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>Doc ID: {result.doc_id}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => setExpandedResult(expandedResult === result.doc_id ? null : result.doc_id)}
                        className="p-1 hover:bg-surface-100 dark:hover:bg-surface-700 rounded"
                      >
                        {expandedResult === result.doc_id ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    {/* Expanded Details */}
                    <AnimatePresence>
                      {expandedResult === result.doc_id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="mt-4 pt-4 border-t border-surface-200 dark:border-surface-700"
                        >
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <h5 className="font-medium text-surface-900 dark:text-surface-100 mb-2">
                                API Details
                              </h5>
                              <div className="space-y-1 text-sm text-surface-600 dark:text-surface-400">
                                <div><strong>Category:</strong> {result.category}</div>
                                <div><strong>Source:</strong> {getSourceName(result.source)}</div>
                                <div><strong>Collection:</strong> {result.collection}</div>
                                <div><strong>Document ID:</strong> {result.doc_id}</div>
                              </div>
                            </div>

                            <div>
                              <h5 className="font-medium text-surface-900 dark:text-surface-100 mb-2">
                                Actions
                              </h5>
                              <div className="space-y-2">
                                <button className="w-full px-3 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors flex items-center justify-center gap-2 text-sm">
                                  <ExternalLink className="w-4 h-4" />
                                  View API Details
                                </button>
                                <button className="w-full px-3 py-2 bg-surface-100 dark:bg-surface-700 text-surface-900 dark:text-surface-100 rounded-lg hover:bg-surface-200 dark:hover:bg-surface-600 transition-colors text-sm">
                                  Create Integration
                                </button>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty State */}
      {!loading && searchResults.length === 0 && searchQuery && (
        <div className="text-center py-12">
          <Database className="w-12 h-12 text-surface-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-surface-900 dark:text-surface-100 mb-2">
            No APIs found
          </h3>
          <p className="text-surface-500 dark:text-surface-400 mb-4">
            Try adjusting your search query or category filter. The knowledge base
            is continuously updated with new API discoveries.
          </p>
          <div className="text-sm text-surface-400 dark:text-surface-500">
            {harvestSources.length > 0 && (
              <div>Currently harvesting from {harvestSources.length} sources</div>
            )}
          </div>
        </div>
      )}

      {/* Initial State */}
      {!searchQuery && searchResults.length === 0 && (
        <div className="text-center py-12">
          <Search className="w-12 h-12 text-surface-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-surface-900 dark:text-surface-100 mb-2">
            Search Harvested API Knowledge
          </h3>
          <p className="text-surface-500 dark:text-surface-400">
            Enter a natural language query to find relevant APIs from our knowledge base.
            The search uses semantic similarity to match your intent with discovered APIs.
          </p>
        </div>
      )}
    </div>
  );
};

export default APIKnowledgeSearch;