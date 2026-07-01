import { toast } from './use-toast';

const API_KEY_STORAGE_KEY = 'groswitch_api_key';

export function getApiKey(): string | null {
  return localStorage.getItem(API_KEY_STORAGE_KEY);
}

export function setApiKey(key: string) {
  localStorage.setItem(API_KEY_STORAGE_KEY, key);
}

export function clearApiKey() {
  localStorage.removeItem(API_KEY_STORAGE_KEY);
}

export function hasApiKey(): boolean {
  return !!getApiKey();
}

// Called wherever a management request comes back 401: clears the stale key,
// surfaces a toast explaining why, and hands control back to the login screen.
export function handleUnauthorized(onLogout: () => void) {
  clearApiKey();
  toast({
    variant: 'destructive',
    title: 'Session expired',
    description: 'Your API key expired or was revoked. Please log in again.',
  });
  onLogout();
}
