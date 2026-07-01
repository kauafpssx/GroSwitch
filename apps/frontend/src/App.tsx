import { useState } from 'react';
import { hasApiKey, clearApiKey } from '@/shared/lib/auth';
import { LoginPage } from '@/features/auth/Login';
import { Dashboard } from '@/features/keys/Dashboard';
import { Chat } from '@/features/chat/Chat';
import { Models } from '@/features/models/Models';
import { Eclipse } from 'lucide-react';

export default function App() {
  const [loggedIn, setLoggedIn] = useState(hasApiKey());
  const [page, setPage] = useState<'dashboard' | 'models' | 'chat'>('dashboard');

  const handleLogout = () => setLoggedIn(false);

  if (!loggedIn) {
    return <LoginPage onLogin={() => setLoggedIn(true)} />;
  }

  return (
    <div className="flex flex-col h-screen">
      <nav className="flex items-center gap-4 px-4 py-2 border-b border-border bg-background">
        <span className="flex items-center gap-1.5 text-sm font-semibold mr-2">
          <Eclipse className="w-4 h-4" />
          GroSwitch
        </span>
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
            clearApiKey();
            handleLogout();
          }}
          className="text-xs text-muted-foreground hover:text-destructive"
        >
          Logout
        </button>
      </nav>
      <div className="flex-1 overflow-hidden">
        {page === 'dashboard' && <Dashboard onLogout={handleLogout} />}
        {page === 'models' && <Models onLogout={handleLogout} />}
        {page === 'chat' && <Chat />}
      </div>
    </div>
  );
}
