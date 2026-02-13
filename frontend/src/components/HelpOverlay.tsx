import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { X } from 'lucide-react';
import './HelpOverlay.css';

const HelpOverlay: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    const [content, setContent] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetch('/docs/guides/ui_help_guide.md')
                .then((res) => res.text())
                .then(setContent)
                .catch(() => setContent('Help content could not be loaded.'));
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="help-overlay-backdrop" onClick={onClose}>
            <div className="help-overlay" onClick={(e) => e.stopPropagation()}>
                <button className="help-close" onClick={onClose} aria-label="Close Help">
                    <X size={20} />
                </button>
                <div className="help-content">
                    <ReactMarkdown
                        urlTransform={(url) => {
                            if (url.startsWith('http') || url.startsWith('https') || url.startsWith('/')) {
                                return url;
                            }
                            // Resolve relative imports like "../assets/image.png"
                            // Base path is /docs/guides/ so prepending it works for relative paths
                            return `/docs/guides/${url}`;
                        }}
                    >
                        {content}
                    </ReactMarkdown>
                </div>
            </div>
        </div>
    );
};

export default HelpOverlay;
