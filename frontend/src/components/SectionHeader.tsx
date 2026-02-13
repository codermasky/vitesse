import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../services/utils';

interface SectionHeaderProps {
    title: string;
    subtitle?: string;
    icon?: LucideIcon;
    actions?: React.ReactNode;
    variant?: 'standard' | 'premium';
    className?: string;
    iconClassName?: string;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
    title,
    subtitle,
    icon: Icon,
    actions,
    variant = 'standard',
    className,
    iconClassName
}) => {
    if (variant === 'premium') {
        return (
            <div className={cn(
                "p-8 border-b border-brand-100 dark:border-brand-500/5 bg-brand-50/50 dark:bg-brand-500/[0.02]",
                className
            )}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        {Icon && (
                            <div className={cn(
                                "w-12 h-12 rounded-2xl bg-brand-500/10 flex items-center justify-center border border-brand-500/20 shadow-[0_0_15px_rgba(6,182,212,0.15)]",
                                iconClassName
                            )}>
                                <Icon className="w-6 h-6 text-brand-600 dark:text-brand-400" />
                            </div>
                        )}
                        <div>
                            <h3 className="text-2xl font-black text-surface-950 dark:text-white tracking-tighter flex items-center gap-3 whitespace-nowrap">
                                {title}
                            </h3>
                            {subtitle && <p className="text-sm text-surface-500 mt-1">{subtitle}</p>}
                        </div>
                    </div>
                    {actions && (
                        <div className="flex items-center gap-3">
                            {actions}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className={cn("px-8 py-8 border-b border-brand-100 dark:border-brand-500/10 flex items-center justify-between bg-surface-50 dark:bg-surface-900", className)}>
            <div className="flex items-center gap-4">
                {Icon && (
                    <div className={cn(
                        "w-10 h-10 rounded-xl bg-brand-500/10 dark:bg-brand-500/20 flex items-center justify-center border border-brand-200 dark:border-brand-500/30 shadow-sm",
                        iconClassName
                    )}>
                        <Icon className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                    </div>
                )}
                <div>
                    <h3 className="text-xl font-black text-surface-950 dark:text-white tracking-tight whitespace-nowrap">{title}</h3>
                    {subtitle && <p className="text-sm text-surface-500 mt-1">{subtitle}</p>}
                </div>
            </div>
            {actions && (
                <div className="flex items-center gap-3">
                    {actions}
                </div>
            )}
        </div>
    );
};

export default SectionHeader;
