import React, { useState } from 'react';
import ImageUpload from './components/ImageUpload';
import Template from './components/BlockPreview';
import ChatInterface from './components/ChatInterface';
import { generateGutenbergBlocks, refineGutenbergBlocks } from './services/ai';
import { parseGutenbergToJSON } from './utils/blockParser';
import { TEMPLATES, getTemplateCode } from './data/templates';

import ApiKeySettings from './components/ApiKeySettings';
import CopyButton from './components/CopyButton';
import { hasApiKey, getProvider, getProviderConfig } from './services/apiKey';

import Sidebar from './components/Sidebar';
import DashboardHeader from './components/DashboardHeader';

function App() {
  const [image, setImage] = useState(null);
  const [inputType, setInputType] = useState('image'); // 'image' | 'url'
  const [xdUrl, setXdUrl] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('preview');
  const [theme, setTheme] = useState('light');
  const [chatMessages, setChatMessages] = useState([]);
  const [isRefining, setIsRefining] = useState(false);
  const [framework, setFramework] = useState('gutenberg');
  const [provider, setProvider] = useState(getProvider);
  const [keyReady, setKeyReady] = useState(() => hasApiKey(getProvider()));

  // The JSON view and its copy action share one parse.
  const blockJson = React.useMemo(
    () => (generatedCode ? JSON.stringify(parseGutenbergToJSON(generatedCode), null, 2) : ''),
    [generatedCode]
  );

  // Initialize theme
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);


  const handleReset = () => {
    setImage(null);
    setXdUrl('');
    setInputType('image');
    setGeneratedCode('');
    setChatMessages([]);
    setError(null);
    setIsLoading(false);
    setActiveTab('preview');
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const handleImageSelect = async (inputData) => {
    // Handle both legacy string (image only) and new object format
    const type = inputData.type || 'image';
    const content = inputData.content || inputData;
    const context = inputData.context || ''; // Get description if available

    setInputType(type);
    if (type === 'image') {
      setImage(content);
      setXdUrl('');
    } else {
      setXdUrl(content);
      setImage(null);
    }

    setIsLoading(true);
    setError(null);
    setGeneratedCode('');
    setChatMessages([]); // Reset chat on new upload

    try {
      const code = await generateGutenbergBlocks(content, framework, type, context, provider);
      setGeneratedCode(code);
      setChatMessages([{ role: 'ai', content: type === 'url' ? 'I analyzed the design from using the URL and your description. How can I refine it?' : 'I rendered the initial blocks based on your design. How can I refine it?' }]);
    } catch (err) {
      setError(err.message || 'Failed to generate blocks. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  const handleTemplateSelect = (templateId) => {
    setIsLoading(true);
    setGeneratedCode('');
    setError(null);
    setChatMessages([]);
    setImage(null); // Clear image if a template is selected
    setXdUrl('');

    // Simulate a brief loading for UX
    setTimeout(() => {
      const code = getTemplateCode(templateId, framework);
      setGeneratedCode(code);
      setChatMessages([{ role: 'ai', content: `I've generated a ${templateId} template for ${framework}. You can now customize it or export it.` }]);
      setIsLoading(false);
    }, 600);
  };

  const handleChatRefinement = async (userPrompt) => {
    // Add user message immediately
    const newHistory = [...chatMessages, { role: 'user', content: userPrompt }];
    setChatMessages(newHistory);
    setIsRefining(true);

    try {
      const updatedCode = await refineGutenbergBlocks(generatedCode, userPrompt, provider);
      setGeneratedCode(updatedCode);
      setChatMessages([...newHistory, { role: 'ai', content: 'Code updated successfully!' }]);
    } catch (err) {
      setChatMessages([...newHistory, { role: 'ai', content: 'Sorry, I failed to update the code. Please try again.' }]);
    } finally {
      setIsRefining(false);
    }
  };

  return (
    <div className="app-layout">
      {/* Sidebar Navigation - upload, framework and templates live here */}
      <Sidebar>
        <div className="sidebar-section">
          <div className="sidebar-section-title">AI Provider</div>
          <ApiKeySettings
            provider={provider}
            onProviderChange={setProvider}
            onKeyChange={setKeyReady}
          />
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-title">Upload Design</div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              Target Framework
            </label>
            <select
              value={framework}
              onChange={(e) => setFramework(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-input)',
                color: 'var(--text-primary)',
                fontSize: '0.95rem',
                outline: 'none'
              }}
            >
              <option value="gutenberg">Gutenberg Core (Default)</option>
              <option value="astra">Astra Theme Optimized</option>
              <option value="spectra">Spectra Blocks (UAGB)</option>
              <option value="nexter">Nexter Blocks (The Plus Addons)</option>
            </select>
          </div>

          {!keyReady && (
            <p className="api-key-required">
              Add a {getProviderConfig(provider).label} API key above to generate from a design.
            </p>
          )}

          <ImageUpload
            onImageSelect={handleImageSelect}
            currentImage={image || xdUrl}
            currentType={inputType}
            compact={!!(image || xdUrl)}
          />
        </div>

        {/* Quick Start Templates */}
        <div className="sidebar-section">
          <div className="sidebar-section-title">Quick Start Templates</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
            {TEMPLATES.map(template => (
              <button
                key={template.id}
                onClick={() => handleTemplateSelect(template.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '0.875rem 0.75rem',
                  background: 'var(--bg-body)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textAlign: 'center'
                }}
                className="template-btn"
              >
                <span style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '0.875rem' }}>{template.name}</span>
                <span style={{ fontSize: '0.7rem', lineHeight: 1.4, color: 'var(--text-secondary)' }}>{template.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Generation status */}
        {(image || xdUrl || generatedCode) && (
          <div className="sidebar-section">
            <div className="sidebar-section-title">Generation Status</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: generatedCode ? 'var(--status-ok)' : 'var(--status-warn)' }}></span>
              <span className="status-value">{generatedCode ? 'Completed' : 'Pending Action'}</span>
            </div>
          </div>
        )}
      </Sidebar>

      {/* Main Content Area */}
      <div className="main-content">
        <DashboardHeader
          theme={theme}
          toggleTheme={toggleTheme}
          onReset={handleReset}
        />

        <main className="dashboard-container">
          {/* Results */}
          <div className="card results-card">
            <div className="card-header" style={{ justifyContent: 'space-between' }}>
              <span>Generated Code</span>
              {generatedCode && (
                <span className="version-badge" style={{
                  fontSize: '0.75rem',
                  background: 'var(--accent-light)',
                  color: 'var(--accent-primary)',
                  padding: '4px 8px',
                  borderRadius: '6px'
                }}>
                  {getProviderConfig(provider).model}
                </span>
              )}
            </div>

            {(!image && !xdUrl && !generatedCode) ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                <div style={{
                  width: 64, height: 64, background: 'var(--bg-body)', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem'
                }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                </div>
                <p>Upload a design to start generating code</p>
              </div>
            ) : (
              <>
                {isLoading ? (
                  <div className="loading-container">
                    <div className="loading-spinner"></div>
                    <p>Analyzing design structure...</p>
                  </div>
                ) : generatedCode ? (
                  <>
                    <div className="tabs">
                      <button
                        className={`tab ${activeTab === 'preview' ? 'active' : ''}`}
                        onClick={() => setActiveTab('preview')}
                      >
                        Live Preview
                      </button>
                      <button
                        className={`tab ${activeTab === 'code' ? 'active' : ''}`}
                        onClick={() => setActiveTab('code')}
                      >
                        Block Markup
                      </button>
                      <button
                        className={`tab ${activeTab === 'json' ? 'active' : ''}`}
                        onClick={() => setActiveTab('json')}
                      >
                        Block JSON
                      </button>
                      <button
                        className={`tab ${activeTab === 'chat' ? 'active' : ''}`}
                        onClick={() => setActiveTab('chat')}
                      >
                        AI Assistant
                      </button>

                      <div className="tab-actions">
                        {activeTab === 'code' && (
                          <CopyButton value={generatedCode} title="Copy block markup" />
                        )}
                        {activeTab === 'json' && (
                          <CopyButton value={blockJson} title="Copy block JSON" />
                        )}
                      </div>
                    </div>

                    <div style={{ padding: '0 0.5rem 0.5rem', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                      {activeTab === 'code' && (
                        <div className="code-viewer-container" style={{ margin: '0.5rem' }}>
                          <textarea
                            className="code-textarea"
                            value={generatedCode}
                            readOnly
                          />
                        </div>
                      )}

                      {activeTab === 'preview' && (
                        <div className="code-viewer-container" style={{ background: 'white', border: 'none', borderRadius: '0', margin: '0.5rem' }}>
                          <div style={{ height: '100%', overflowY: 'auto' }}>
                            <Template code={generatedCode} />
                          </div>
                        </div>
                      )}

                      {activeTab === 'json' && (
                        <div className="code-viewer-container" style={{ margin: '0.5rem' }}>
                          <textarea
                            className="code-textarea"
                            value={blockJson}
                            readOnly
                          />
                        </div>
                      )}

                      {activeTab === 'chat' && (
                        <div className="code-viewer-container" style={{ margin: '0.5rem', background: 'var(--bg-card)' }}>
                          <ChatInterface
                            messages={chatMessages}
                            onSendMessage={handleChatRefinement}
                            isLoading={isRefining}
                          />
                        </div>
                      )}
                    </div>
                  </>
                ) : error ? (
                  <div style={{ padding: '2rem', color: 'var(--status-error)', textAlign: 'center' }}>
                    {error}
                    <button onClick={handleReset} className="btn-primary" style={{ display: 'block', margin: '1rem auto' }}>Try Again</button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
