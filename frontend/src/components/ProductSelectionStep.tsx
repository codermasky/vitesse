import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Building2, Loader2, CheckCircle2 } from 'lucide-react';

interface ProductSelectionStepProps {
    products: string[];
    selectedProduct: string | null;
    onSelect: (product: string) => void;
    isLoading: boolean;
    onBack: () => void;
}

const PRODUCT_INFO: Record<string, { description: string; icon: string }> = {
    'Capitalstream': {
        description: 'Treasury and cash management platform for financial institutions',
        icon: '💰'
    },
    'Ekip': {
        description: 'Portfolio management and investment operations platform',
        icon: '📊'
    },
    'Longview': {
        description: 'Regulatory reporting and compliance solution',
        icon: '📋'
    }
};

export const ProductSelectionStep: React.FC<ProductSelectionStepProps> = ({
    products,
    selectedProduct,
    onSelect,
    isLoading,
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
                Select Destination Product
            </h2>
            <p className="text-surface-600 dark:text-surface-400 mb-8">
                Choose the Linedata product you want to integrate with
            </p>

            {/* Loading State */}
            {isLoading && (
                <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="w-12 h-12 text-brand-500 animate-spin mb-4" />
                    <p className="text-surface-500 dark:text-surface-400">Loading products...</p>
                </div>
            )}

            {/* Products Grid */}
            {!isLoading && products.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {products.map((product, idx) => {
                        const info = PRODUCT_INFO[product] || {
                            description: `Linedata ${product} Product`,
                            icon: '🏢'
                        };
                        const isSelected = selectedProduct === product;

                        return (
                            <motion.div
                                key={product}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.1 }}
                                onClick={() => onSelect(product)}
                                className={`
                                    group relative p-6 rounded-xl border-2 cursor-pointer transition-all
                                    ${isSelected
                                        ? 'bg-brand-500/10 border-brand-500 ring-2 ring-brand-500/50 shadow-lg shadow-brand-500/20'
                                        : 'bg-white dark:bg-surface-900 border-surface-200 dark:border-surface-700 hover:border-brand-500/50 hover:shadow-lg hover:shadow-brand-500/10'
                                    }
                                `}
                            >
                                {/* Selection Indicator */}
                                {isSelected && (
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        className="absolute top-4 right-4"
                                    >
                                        <div className="w-8 h-8 bg-brand-500 rounded-full flex items-center justify-center">
                                            <CheckCircle2 className="w-5 h-5 text-white" />
                                        </div>
                                    </motion.div>
                                )}

                                {/* Product Icon */}
                                <div className="mb-4">
                                    <div className={`
                                        w-16 h-16 rounded-xl flex items-center justify-center text-3xl
                                        ${isSelected
                                            ? 'bg-brand-500/20'
                                            : 'bg-surface-100 dark:bg-surface-800 group-hover:bg-brand-500/10'
                                        }
                                        transition-colors
                                    `}>
                                        {info.icon}
                                    </div>
                                </div>

                                {/* Product Name */}
                                <h3 className={`
                                    text-xl font-bold mb-2 transition-colors
                                    ${isSelected
                                        ? 'text-brand-600 dark:text-brand-400'
                                        : 'text-surface-950 dark:text-white group-hover:text-brand-500'
                                    }
                                `}>
                                    {product}
                                </h3>

                                {/* Product Description */}
                                <p className="text-sm text-surface-600 dark:text-surface-400 line-clamp-2">
                                    {info.description}
                                </p>

                                {/* Linedata Badge */}
                                <div className="mt-4 pt-4 border-t border-surface-200 dark:border-surface-800">
                                    <div className="flex items-center gap-2">
                                        <Building2 className="w-4 h-4 text-surface-400" />
                                        <span className="text-xs text-surface-500 font-medium">
                                            Linedata Product
                                        </span>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}

            {/* Empty State */}
            {!isLoading && products.length === 0 && (
                <div className="text-center py-12">
                    <Building2 className="w-16 h-16 text-surface-300 dark:text-surface-700 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-surface-950 dark:text-white mb-2">
                        No Products Configured
                    </h3>
                    <p className="text-surface-500 dark:text-surface-400 mb-4">
                        Please configure products in Settings → Products
                    </p>
                </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between mt-8">
                <button
                    onClick={onBack}
                    className="px-6 py-3 text-surface-600 dark:text-surface-400 hover:text-brand-500 transition-colors flex items-center gap-2"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                </button>
            </div>
        </motion.div>
    );
};
