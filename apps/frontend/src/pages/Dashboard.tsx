import { useState, useEffect, useCallback } from 'react';
import { fetchKeys, fetchStats, fetchModels, addKey, deleteKey, updateDefaultModel, clearApiKey } from '@/api/client';
import { KeyCard } from '@/components/KeyCard';
import { AddKeyForm } from '@/components/AddKeyForm';
import { DefaultModelSelect } from '@/components/DefaultModelSelect';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Shield, AlertTriangle, Activity } from 'lucide-react';
import type { ApiKeyPublic, KeyStats, ModelRateLimitPublic } from '@gemrouter/common';

interface DashboardProps {
  onLogout: () => void;
}

export function Dashboard({ onLogout }: DashboardProps) {
  const [keys, setKeys] = useState<ApiKeyPublic[]>([]);
  const [stats, setStats] = useState<KeyStats | null>(null);
  const [models, setModels] = useState<ModelRateLimitPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const loadKeys = useCallback(async () => {
    try {
      setLoading(true);
      const [data, statsData, modelsData] = await Promise.all([fetchKeys(), fetchStats(), fetchModels()]);
      setKeys(data);
      setStats(statsData);
      setModels(modelsData);
    } catch (err) {
      if (err instanceof Error && err.message === 'UNAUTHORIZED') {
        clearApiKey();
        onLogout();
      }
    } finally {
      setLoading(false);
    }
  }, [onLogout]);

  useEffect(() => {
    loadKeys();
    const interval = setInterval(loadKeys, 10000);
    return () => clearInterval(interval);
  }, [loadKeys]);

  const handleAdd = async (name: string, key: string) => {
    await addKey(name, key);
    await loadKeys();
  };

  const handleDefaultModelChange = async (model: string) => {
    const statsData = await updateDefaultModel(model);
    setStats(statsData);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteId) return;
    await deleteKey(deleteId);
    setDeleteId(null);
    await loadKeys();
  };

  const liveCount = keys.filter((k) => k.status === 'live').length;
  const deadCount = keys.filter((k) => k.status === 'dead').length;
  const totalUsed = keys.reduce((sum, k) => sum + k.dailyCount, 0);
  const totalTokens = keys.reduce((sum, k) => sum + (k.totalTokens ?? 0), 0);

  return (
    <div className="p-6 overflow-y-auto h-full">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="w-4 h-4 text-green-500" />
                Active Keys
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">{liveCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                Rate Limited
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">{deadCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Requests Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalUsed}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Total Tokens</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalTokens >= 1000 ? `${(totalTokens / 1000).toFixed(1)}K` : totalTokens}</div>
            </CardContent>
          </Card>
        </div>

        {/* Keys Table */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium">API Keys</h2>
            <div className="flex items-center gap-2">
              {stats && (
                <DefaultModelSelect
                  models={models}
                  value={stats.defaultModel}
                  onChange={handleDefaultModelChange}
                />
              )}
              <AddKeyForm onAdd={handleAdd} />
            </div>
          </div>

          {loading && keys.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Loading...</div>
          ) : keys.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-border rounded-lg">
              <p className="text-muted-foreground text-sm">No keys configured</p>
              <p className="text-muted-foreground/60 text-xs mt-1">Add a Gemini API key to get started</p>
            </div>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-card border-b border-border">
                    <th className="text-left text-xs font-medium text-muted-foreground py-2 px-4">Name</th>
                    <th className="text-left text-xs font-medium text-muted-foreground py-2 px-4">Status</th>
                    <th className="text-left text-xs font-medium text-muted-foreground py-2 px-4">Daily</th>
                    <th className="text-left text-xs font-medium text-muted-foreground py-2 px-4">Minute</th>
                    <th className="text-left text-xs font-medium text-muted-foreground py-2 px-4">Tokens</th>
                    <th className="text-left text-xs font-medium text-muted-foreground py-2 px-4">Cooldown</th>
                    <th className="text-right text-xs font-medium text-muted-foreground py-2 px-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map((key) => (
                    <KeyCard
                      key={key.id}
                      apiKey={key}
                      dailyLimit={stats?.dailyLimit ?? 1500}
                      minuteLimit={stats?.minuteLimit ?? 30}
                      onDelete={setDeleteId}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Delete Key</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure? This key will be removed from the router pool permanently.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
