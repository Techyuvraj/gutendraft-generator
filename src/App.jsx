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
import AuthScreen from './components/AuthScreen';
import HistoryList from './components/HistoryList';
import ConfirmDialog from './components/ConfirmDialog';
import { supabase } from './services/supabase';
import {
  saveGeneration, updateGeneration, listGenerations, loadGeneration, deleteGeneration,
} from './services/history';

function Workspace({ user, onSignOut }) {
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
  // The chosen model lives in storage (read through getProviderConfig); this
  // only re-renders the model badge when the user switches it.
  const [, setModelVersion] = useState(0);

  // The saved row the workspace is showing, so refinements update it in place.
  const [currentId, setCurrentId] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // The JSON view and its copy action share one parse.
  const blockJson = React.useMemo(
    () => (generatedCode ? JSON.stringify(parseGutenbergToJSON(generatedCode), null, 2) : ''),
    [generatedCode]
  );

  const refreshHistory = React.useCallback(async () => {
    try {
      const page = await listGenerations(0);
      setHistory(page.items);
      setHistoryHasMore(page.hasMore);
      setHistoryError('');
    } catch (err) {
      setHistoryError(err.message || 'Could not load your saved generations.');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  React.useEffect(() => { refreshHistory(); }, [refreshHistory]);

  /* The offset is simply how many rows are showing: new saves are prepended
     and deletes removed both here and in the table, so the two stay aligned.
     The id filter is a guard against a row appearing twice regardless. */
  const loadMoreHistory = async () => {
    setHistoryLoadingMore(true);
    try {
      const page = await listGenerations(history.length);
      setHistory(prev => {
        const seen = new Set(prev.map(h => h.id));
        return [...prev, ...page.items.filter(h => !seen.has(h.id))];
      });
      setHistoryHasMore(page.hasMore);
    } catch (err) {
      setSaveError(`Could not load more: ${err.message}`);
    } finally {
      setHistoryLoadingMore(false);
    }
  };

  /* Saving never blocks the result: the user already has their markup, so a
     failed save is reported beside the history rather than as an error. */
  const persistNew = async (record) => {
    try {
      const row = await saveGeneration(user.id, record);
      setCurrentId(row.id);
      setHistory(prev => [row, ...prev]);
      setSaveError('');
    } catch (err) {
      console.error('Save failed', err);
      setSaveError(`Not saved: ${err.message || 'database unavailable'}`);
    }
  };

  const persistUpdate = async (code, chat) => {
    if (!currentId) return;
    try {
      await updateGeneration(currentId, { code, chat });
      // Keep the sidebar thumbnail in step with the refined layout.
      setHistory(prev => prev.map(h => (h.id === currentId ? { ...h, code } : h)));
      setSaveError('');
    } catch (err) {
      console.error('Update failed', err);
      setSaveError(`Latest change not saved: ${err.message || 'database unavailable'}`);
    }
  };

  const handleOpenGeneration = async (id) => {
    setIsLoading(true);
    setError(null);
    try {
      const row = await loadGeneration(id);
      setCurrentId(row.id);
      setFramework(row.framework);
      setInputType(row.source === 'url' ? 'url' : 'image');
      setImage(row.source === 'image' ? row.imageUrl : null);
      setXdUrl(row.source === 'url' ? row.xd_url || '' : '');
      setGeneratedCode(row.code);
      setChatMessages(Array.isArray(row.chat) ? row.chat : []);
      setActiveTab('preview');
    } catch (err) {
      setError(err.message || 'Could not open that generation.');
    } finally {
      setIsLoading(false);
    }
  };

  // The trash button only asks; the dialog's confirm does the delete.
  const handleDeleteGeneration = (item) => setPendingDelete(item);

  const confirmDelete = async () => {
    const item = pendingDelete;
    if (!item) return;
    setDeleting(true);
    try {
      await deleteGeneration(item);
      setHistory(prev => prev.filter(h => h.id !== item.id));
      if (item.id === currentId) setCurrentId(null);
    } catch (err) {
      setSaveError(`Could not delete: ${err.message}`);
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  };

  // Initialize theme
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);


  const handleReset = () => {
    setCurrentId(null);
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
    setCurrentId(null);

    try {
      const code = await generateGutenbergBlocks(content, framework, type, context, provider);
      const chat = [{ role: 'ai', content: type === 'url' ? 'I analyzed the design from using the URL and your description. How can I refine it?' : 'I rendered the initial blocks based on your design. How can I refine it?' }];
      setGeneratedCode(code);
      setChatMessages(chat);
      persistNew({
        source: type,
        framework,
        provider,
        model: getProviderConfig(provider).model,
        image: type === 'image' ? content : null,
        xdUrl: type === 'url' ? content : null,
        context,
        code,
        chat,
      });
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
    setCurrentId(null);

    // Simulate a brief loading for UX
    setTimeout(() => {
      const code = getTemplateCode(templateId, framework);
      const chat = [{ role: 'ai', content: `I've generated a ${templateId} template for ${framework}. You can now customize it or export it.` }];
      setGeneratedCode(code);
      setChatMessages(chat);
      setIsLoading(false);
      // Templates are not saved to My Generations: they are the same
      // built-in layouts for everyone, not the user's own work.
    }, 600);
  };

  const handleChatRefinement = async (userPrompt) => {
    // Add user message immediately
    const newHistory = [...chatMessages, { role: 'user', content: userPrompt }];
    setChatMessages(newHistory);
    setIsRefining(true);

    try {
      const updatedCode = await refineGutenbergBlocks(generatedCode, userPrompt, provider);
      const chat = [...newHistory, { role: 'ai', content: 'Code updated successfully!' }];
      setGeneratedCode(updatedCode);
      setChatMessages(chat);
      persistUpdate(updatedCode, chat);
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
            onModelChange={() => setModelVersion(v => v + 1)}
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
            isLoading={isLoading}
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

        {/* Saved work for the signed-in user */}
        <div className="sidebar-section">
          <div className="sidebar-section-title">My Generations</div>
          {saveError && <p className="api-key-error" style={{ marginBottom: '0.75rem' }}>{saveError}</p>}
          <HistoryList
            items={history}
            loading={historyLoading}
            error={historyError}
            activeId={currentId}
            onOpen={handleOpenGeneration}
            onDelete={handleDeleteGeneration}
            hasMore={historyHasMore}
            loadingMore={historyLoadingMore}
            onLoadMore={loadMoreHistory}
          />
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
          userEmail={user.email}
          onSignOut={onSignOut}
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

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this generation?"
        message="The saved layout, its design image and its chat history will be removed from your account. This cannot be undone."
        confirmLabel="Delete"
        danger
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}

/**
 * Auth gate: nothing in the workspace renders, and nothing is saved, until
 * there is a signed-in user. The session persists across reloads.
 */
function App() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(Boolean(supabase));
  const [recovering, setRecovering] = useState(false);

  React.useEffect(() => {
    if (!supabase) return undefined;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecking(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      setSession(next);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (checking) {
    return (
      <div className="auth-page">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (!session || recovering) {
    return <AuthScreen recovery={recovering} onRecovered={() => setRecovering(false)} />;
  }

  // Keyed by user so switching accounts starts from a clean workspace.
  return (
    <Workspace
      key={session.user.id}
      user={session.user}
      onSignOut={() => supabase.auth.signOut()}
    />
  );
}

export default App
