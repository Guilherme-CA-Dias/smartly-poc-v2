"use client";

import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { getAuthHeaders } from "@/app/auth-provider";
import { useIntegrationApp } from "@integration-app/react";
import { AlertCircle, RefreshCw, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface FlowInstance {
  id: string;
  name: string;
  key: string;
  enabled: boolean;
  description?: string;
}

interface FlowInstancesModalProps {
  connectionId: string;
  integrationKey: string;
  integrationName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-blue-600" : "bg-gray-200"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200",
          checked ? "translate-x-4" : "translate-x-0"
        )}
      />
    </button>
  );
}

export function FlowInstancesModal({
  connectionId,
  integrationKey,
  integrationName,
  open,
  onOpenChange,
}: FlowInstancesModalProps) {
  const integrationApp = useIntegrationApp();
  const [flows, setFlows] = useState<FlowInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchFlows = useCallback(async () => {
    if (!connectionId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/integrations/${connectionId}/flow-instances?integrationKey=${integrationKey}`,
        { headers: getAuthHeaders() }
      );
      if (!response.ok) throw new Error("Failed to fetch flows");
      const data = await response.json();
      setFlows(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load flows");
    } finally {
      setLoading(false);
    }
  }, [connectionId, integrationKey]);

  useEffect(() => {
    if (open) fetchFlows();
  }, [open, fetchFlows]);

  const handleToggle = async (flow: FlowInstance) => {
    setTogglingId(flow.id);
    try {
      await integrationApp.flowInstance(flow.id).patch({ enabled: !flow.enabled });
      setFlows((prev) =>
        prev.map((f) => (f.id === flow.id ? { ...f, enabled: !f.enabled } : f))
      );
      toast.success(`Flow ${!flow.enabled ? "enabled" : "disabled"}`, {
        description: flow.name,
      });
    } catch (err) {
      toast.error("Failed to update flow", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 bg-purple-50 rounded-xl">
              <Zap className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="font-semibold">Flow Instances</div>
              <div className="text-sm font-normal text-gray-600">{integrationName}</div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="p-4 bg-purple-50 rounded-full mb-4">
                <Icons.spinner className="w-8 h-8 animate-spin text-purple-600" />
              </div>
              <p className="text-sm text-gray-500">Loading flow instances...</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="p-4 bg-red-50 rounded-full mb-4">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">Failed to load flows</h3>
              <p className="text-sm text-red-600 mb-4">{error}</p>
              <Button variant="outline" onClick={fetchFlows} className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                Try Again
              </Button>
            </div>
          )}

          {!loading && !error && flows.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="p-4 bg-gray-50 rounded-full mb-4">
                <Zap className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">No flow instances</h3>
              <p className="text-sm text-gray-500 text-center max-w-sm">
                No flow instances found for this integration.
              </p>
            </div>
          )}

          {!loading && !error && flows.length > 0 && (
            <div className="space-y-2">
              {flows.map((flow) => (
                <div
                  key={flow.id}
                  className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{flow.name}</p>
                    {flow.description && (
                      <p className="text-xs text-gray-500 truncate mt-0.5">{flow.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                    <span className="text-xs text-gray-500">
                      {flow.enabled ? "Enabled" : "Disabled"}
                    </span>
                    {togglingId === flow.id ? (
                      <Icons.spinner className="w-5 h-5 animate-spin text-gray-400" />
                    ) : (
                      <Toggle
                        checked={flow.enabled}
                        onChange={() => handleToggle(flow)}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center pt-6 border-t border-gray-200">
          <div className="text-sm text-gray-500">
            {flows.length > 0 && `${flows.length} flow${flows.length !== 1 ? "s" : ""}`}
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
