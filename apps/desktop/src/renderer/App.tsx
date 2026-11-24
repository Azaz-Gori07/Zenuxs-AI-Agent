import React, { useState, useEffect, useRef } from 'react';
import './styles.css';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AppState {
  messages: Message[];
  isLoading: boolean;
  currentView: 'chat' | 'sessions' | 'tools' | 'mcp';
}

export default function App() {
  const [state, setState] = useState<AppState>({
    messages: [
      {
        id: '1',
        role: 'assistant',
        content: 'Welcome to Zenuxs AI Agent! I\'m here to help you with coding tasks, code reviews, refactors, and more. How can I assist you today?',
        timestamp: new Date(),
      },
    ],
    isLoading: false,
    currentView: 'chat',
  });

  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const chatMessagesRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [state.messages, state.isLoading]);

  // Handle message send
  const handleSendMessage = async () => {
    const input = messageInputRef.current;
    if (!input || state.isLoading) return;

    const content = input.value.trim();
    if (!content) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isLoading: true,
    }));

    input.value = '';

    // Simulate AI response (in real app, this would call the CLI backend)
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `I've received your message: "${content}". In a real deployment, this would connect to the Zenuxs AI Agent backend and process your request using the available tools and MCP servers.`,
        timestamp: new Date(),
      };

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, assistantMessage],
        isLoading: false,
      }));
    }, 1000);
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        handleSendMessage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.isLoading]);

  // Handle new session
  useEffect(() => {
    const handleNewSession = () => {
      setState({
        messages: [
          {
            id: Date.now().toString(),
            role: 'assistant',
            content: 'New session started. How can I help you today?',
            timestamp: new Date(),
          },
        ],
        isLoading: false,
        currentView: state.currentView,
      });
    };

    const { onNewSession } = window.electronAPI;
    if (onNewSession) {
      onNewSession(handleNewSession);
    }
  }, []);

  // Handle view navigation
  const handleViewChange = (view: AppState['currentView']) => {
    setState((prev) => ({ ...prev, currentView: view }));
  };

  return (
    <div className="app">
      <header className="header">
        <div className="logo">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="1" y="1" width="30" height="30" rx="6" stroke="white" strokeWidth="2"/>
            <circle cx="16" cy="16" r="6" fill="white"/>
          </svg>
          <span className="logo-text">Zenuxs</span>
        </div>
        <div className="header-actions">
          <button
            className="icon-button"
            id="newSessionBtn"
            title="New Session (Ctrl+N)"
            onClick={() => window.electronAPI?.newSession?.()}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
          <button className="icon-button" title="Settings">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
        </div>
      </header>

      <div className="main-content">
        <aside className="sidebar">
          <nav className="sidebar-nav">
            <button
              className={`nav-item ${state.currentView === 'chat' ? 'active' : ''}`}
              data-view="chat"
              onClick={() => handleViewChange('chat')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
              Chat
            </button>
            <button
              className={`nav-item ${state.currentView === 'sessions' ? 'active' : ''}`}
              data-view="sessions"
              onClick={() => handleViewChange('sessions')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z"></path>
              </svg>
              Sessions
            </button>
            <button
              className={`nav-item ${state.currentView === 'tools' ? 'active' : ''}`}
              data-view="tools"
              onClick={() => handleViewChange('tools')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
              </svg>
              Tools
            </button>
            <button
              className={`nav-item ${state.currentView === 'mcp' ? 'active' : ''}`}
              data-view="mcp"
              onClick={() => handleViewChange('mcp')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="2" y1="12" x2="22" y2="12"></line>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
              </svg>
              MCP Servers
            </button>
          </nav>

          <div className="sidebar-footer">
            <div className="session-info">
              <div className="session-status online"></div>
              <span className="session-status-text">Connected</span>
            </div>
          </div>
        </aside>

        <main className="chat-container">
          <div className="chat-messages" ref={chatMessagesRef}>
            {state.messages.map((message) => (
              <div key={message.id} className={`message ${message.role}`}>
                <div className="message-content">
                  <div className="message-bubble">{message.content}</div>
                  <div className="message-meta">
                    {message.role === 'user' ? 'You' : 'Zenuxs'} * {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
            {state.isLoading && (
              <div className="message assistant">
                <div className="message-content">
                  <div className="message-bubble">
                    <span className="loading"></span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="chat-input-area">
            <div className="input-wrapper">
              <textarea
                id="messageInput"
                ref={messageInputRef}
                placeholder="Ask Zenuxs anything..."
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
              <button className="send-button" onClick={handleSendMessage}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </button>
            </div>
            <div className="input-hint">Press Enter to send, Shift+Enter for new line</div>
          </div>
        </main>
      </div>
    </div>
  );
}
