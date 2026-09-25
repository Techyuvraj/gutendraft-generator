import React, { useState, useRef } from 'react';

const ImageUpload = ({ onImageSelect, compact, currentImage, currentType = 'image', isLoading = false }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [activeTab, setActiveTab] = useState('upload'); // 'upload' | 'url'
    const [urlInput, setUrlInput] = useState('');
    const [urlDescription, setUrlDescription] = useState('');
    // A dropped image waits here until the user adds any requirements and
    // presses Generate, instead of generating the moment it lands.
    const [pendingImage, setPendingImage] = useState(null);
    const [requirements, setRequirements] = useState('');
    const fileInputRef = useRef(null);

    const previewImage = pendingImage || (currentType === 'image' ? currentImage : null);

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    };

    const handleFileSelect = (e) => {
        if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
        }
    };

    const handleFile = (file) => {
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                setPendingImage(e.target.result);
            };
            reader.readAsDataURL(file);
        } else {
            alert('Please upload an image file.');
        }
    };

    const handleUrlSubmit = () => {
        if (!urlInput.trim()) {
            alert('Please enter a valid URL');
            return;
        }
        onImageSelect({ type: 'url', content: urlInput, context: urlDescription });
    };

    const handleImageGenerate = () => {
        if (!previewImage) return;
        onImageSelect({ type: 'image', content: previewImage, context: requirements.trim() });
        setPendingImage(null);
    };

    return (
        <div className="image-upload-container">
            {!compact && (
                <div style={{ display: 'flex', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                    <button
                        onClick={() => setActiveTab('upload')}
                        style={{
                            padding: '0.5rem 1rem',
                            border: 'none',
                            background: 'transparent',
                            color: activeTab === 'upload' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                            fontWeight: 500,
                            cursor: 'pointer',
                            borderBottom: activeTab === 'upload' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                            transition: 'all 0.2s'
                        }}
                    >
                        Upload Image
                    </button>
                    <button
                        onClick={() => setActiveTab('url')}
                        style={{
                            padding: '0.5rem 1rem',
                            border: 'none',
                            background: 'transparent',
                            color: activeTab === 'url' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                            fontWeight: 500,
                            cursor: 'pointer',
                            borderBottom: activeTab === 'url' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                            transition: 'all 0.2s'
                        }}
                    >
                        XD Link
                    </button>
                </div>
            )}

            {activeTab === 'upload' ? (
                <>
                <div
                    className={`upload-zone ${isDragging ? 'dragging' : ''}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current.click()}
                    style={{
                        padding: compact ? '2rem 1rem' : '3rem 1.5rem',
                        textAlign: 'center',
                        cursor: 'pointer',
                        background: isDragging ? 'var(--dropzone-bg-active)' : 'var(--dropzone-bg)',
                        border: '2px dashed ' + (isDragging ? 'var(--accent-primary)' : 'var(--dropzone-border)'),
                        borderRadius: '12px',
                        transition: 'all 0.3s ease',
                        position: 'relative',
                        overflow: 'hidden'
                    }}
                >
                    <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        accept="image/*"
                        onChange={handleFileSelect}
                    />

                    {previewImage ? (
                        <div style={{ position: 'relative' }}>
                            <img
                                src={previewImage}
                                alt="Uploaded Design"
                                style={{
                                    maxWidth: '100%',
                                    maxHeight: '300px',
                                    borderRadius: '8px',
                                    boxShadow: 'var(--shadow-card)'
                                }}
                            />
                            <div style={{
                                marginTop: '1rem',
                                color: 'var(--text-secondary)',
                                fontSize: '0.875rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem'
                            }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                <span>Click to replace</span>
                            </div>
                        </div>
                    ) : (
                        <div style={{ pointerEvents: 'none' }}>
                            <div style={{
                                marginBottom: '1rem',
                                color: 'var(--accent-primary)',
                                display: 'flex',
                                justifyContent: 'center'
                            }}>
                                <svg
                                    width="40"
                                    height="40"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="17 8 12 3 7 8"></polyline>
                                    <line x1="12" y1="3" x2="12" y2="15"></line>
                                </svg>
                            </div>

                            <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 600 }}>
                                Drag & drop your design
                            </h3>
                            <p style={{ margin: '0 0 1rem 0', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                or click to browse
                            </p>

                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                {['PNG', 'JPG', 'WebP'].map(tag => (
                                    <span key={tag} className="format-tag">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {previewImage && (
                    <div className="upload-requirements">
                        <label htmlFor="design-requirements">
                            Specific requirements (optional)
                        </label>
                        <textarea
                            id="design-requirements"
                            placeholder="e.g. Use a cover block for the hero, 3 equal columns for the features, keep buttons left-aligned..."
                            value={requirements}
                            onChange={(e) => setRequirements(e.target.value)}
                        />
                        <button
                            type="button"
                            onClick={handleImageGenerate}
                            className="btn-primary"
                            disabled={isLoading}
                        >
                            {isLoading ? 'Generating…' : pendingImage ? 'Generate Blocks' : 'Regenerate'}
                        </button>
                    </div>
                )}
                </>
            ) : (
                <div style={{ padding: '1.5rem', background: 'var(--dropzone-bg)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <label style={{ display: 'block', marginBottom: '0.75rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        Adobe XD / Figma Preview URL
                    </label>
                    <input
                        type="url"
                        className="url-input"
                        placeholder="https://xd.adobe.com/view/..."
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            outline: 'none',
                            marginBottom: '1rem',
                            background: 'var(--bg-input)',
                            color: 'var(--text-primary)'
                        }}
                    />

                    <label style={{ display: 'block', marginBottom: '0.75rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        Short Description / Context (Optional)
                    </label>
                    <textarea
                        placeholder="e.g. Hero section with a dark background, two buttons, and a large heading..."
                        value={urlDescription}
                        onChange={(e) => setUrlDescription(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            outline: 'none',
                            marginBottom: '1rem',
                            minHeight: '80px',
                            fontFamily: 'inherit',
                            background: 'var(--bg-input)',
                            color: 'var(--text-primary)'
                        }}
                    />

                    <button
                        onClick={handleUrlSubmit}
                        className="btn-primary"
                        style={{ width: '100%' }}
                    >
                        Load & Generate
                    </button>
                </div>
            )}
        </div>
    );
};

export default ImageUpload;
