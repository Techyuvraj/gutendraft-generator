import React from 'react';

const FRAMEWORK_LABELS = {
    gutenberg: 'Gutenberg',
    astra: 'Astra',
    spectra: 'Spectra',
    nexter: 'Nexter',
};

const describe = (item) => {
    if (item.source === 'template') return `${item.template_id || 'Template'} template`;
    if (item.source === 'url') return 'XD link';
    return 'Image upload';
};

const formatDate = (iso) =>
    new Date(iso).toLocaleString(undefined, {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });

/** The signed-in user's saved generations, newest first. */
const HistoryList = ({ items, loading, error, activeId, onOpen, onDelete }) => {
    if (loading) return <p className="api-key-note">Loading your generations…</p>;
    if (error) return <p className="api-key-error">{error}</p>;
    if (!items.length) {
        return <p className="api-key-note">Nothing saved yet. Every block you generate is kept here.</p>;
    }

    return (
        <ul className="history-list">
            {items.map((item) => (
                <li key={item.id} className={`history-item ${item.id === activeId ? 'active' : ''}`}>
                    <button type="button" className="history-open" onClick={() => onOpen(item.id)}>
                        <span className="history-name">{describe(item)}</span>
                        <span className="history-meta mono">
                            {FRAMEWORK_LABELS[item.framework] || item.framework} · {formatDate(item.created_at)}
                        </span>
                    </button>
                    <button
                        type="button"
                        className="history-delete"
                        title="Delete"
                        aria-label="Delete generation"
                        onClick={() => onDelete(item)}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
                    </button>
                </li>
            ))}
        </ul>
    );
};

export default HistoryList;
