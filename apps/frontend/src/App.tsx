import { useState } from 'react';
import { hasApiKey } from './api/client';
import { LoginPage } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Chat } from './pages/Chat';
import { Models } from './pages/Models';

export default function App() {
  const [loggedIn, setLoggedIn] = useState(hasApiKey());
  const [page, setPage] = useState<'dashboard' | 'models' | 'chat'>('dashboard');

  if (!loggedIn) {
    return <LoginPage onLogin={() => setLoggedIn(true)} />;
  }

  return (
    <div className="flex flex-col h-screen">
      <nav className="flex items-center gap-4 px-4 py-2 border-b border-border bg-background">
        <button
          onClick={() => setPage('dashboard')}
          className={`text-sm font-medium ${page === 'dashboard' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Dashboard
        </button>
        <button
          onClick={() => setPage('models')}
          className={`text-sm font-medium ${page === 'models' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Models
        </button>
        <button
          onClick={() => setPage('chat')}
          className={`text-sm font-medium ${page === 'chat' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Chat
        </button>
        <div className="flex-1" />
        <button
          onClick={() => {
            localStorage.removeItem('gemrouter_api_key');
            setLoggedIn(false);
          }}
          className="text-xs text-muted-foreground hover:text-destructive"
        >
          Logout
        </button>
      </nav>
      <div className="flex-1 overflow-hidden">
        {page === 'dashboard' && <Dashboard onLogout={() => setLoggedIn(false)} />}
        {page === 'models' && <Models onLogout={() => setLoggedIn(false)} />}
        {page === 'chat' && <Chat />}
      </div>
    </div>
  );
}
