"use client";

import { Integration } from "@integration-app/sdk";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FolderOpen, Zap } from "lucide-react";
import { DocumentPicker } from "@/app/integrations/components/document-picker";
import { SyncHistoryModal } from "@/app/integrations/components/sync-history-modal";
import { FlowInstancesModal } from "@/app/integrations/components/flow-instances-modal";
import { SmartlyFilesPicker } from "@/app/integrations/components/smartly-files-picker";
import { getAuthHeaders } from "@/app/auth-provider";
import Image from "next/image";
import { useIntegrationApp } from "@integration-app/react";
import { Icons } from "@/components/ui/icons";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useSyncNotifications } from "@/contexts/sync-notifications-context";

interface IntegrationListItemProps {
  integration: Integration;
  onRefresh: () => Promise<void>;
}

export function IntegrationListItem({
  integration,
  onRefresh,
}: IntegrationListItemProps) {
  const integrationApp = useIntegrationApp();
  const router = useRouter();
  const { triggerRefresh } = useSyncNotifications();
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isFlowsOpen, setIsFlowsOpen] = useState(false);
  const [isSmartlyOpen, setIsSmartlyOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const handleConnect = async () => {
    try {
      setIsConnecting(true);

      const connection = await integrationApp
        .integration(integration.key)
        .openNewConnection();

      if (!connection?.id) {
        throw new Error("Connection was not successful");
      }

      setIsConnecting(false);
    } catch (error) {
      setIsConnecting(false);

      toast.error("Failed to connect", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const handleDisconnect = async () => {
    if (!integration.connection?.id) {
      return;
    }

    try {
      setIsDisconnecting(true);
      await fetch(`/api/integrations/${integration.connection.id}/sync`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      await integrationApp.connection(integration.connection.id).archive();

      await onRefresh();
    } catch (error) {
      toast.error("Failed to disconnect", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleSync = async (selectedDocumentIds: string[]) => {
    if (!integration.connection?.id) {
      return;
    }

    try {
      const response = await fetch(
        `/api/integrations/${integration.connection.id}/sync`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            integrationId: integration.id,
            integrationKey: integration.key,
            integrationName: integration.name,
            integrationLogo: integration.logoUri,
            documentIds:
              selectedDocumentIds.length > 0 ? selectedDocumentIds : undefined,
          }),
        }
      );

      setIsPickerOpen(false);

      if (!response.ok) {
        throw new Error("Failed to sync documents");
      }

      toast.success("Sync started", {
        description: `Syncing ${selectedDocumentIds.length > 0 ? selectedDocumentIds.length : "all"
          } documents`,
      });

      // Trigger sync notifications to refresh
      triggerRefresh();

      await onRefresh();

      // Redirect to documents page after successful sync
      router.push("/documents");
    } catch (error) {
      toast.error("Failed to sync", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const isDisconnected = integration.connection?.disconnected;

  return (
    <>
      {isPickerOpen && (
        <DocumentPicker
          integration={integration}
          onDone={handleSync}
          onClose={() => setIsPickerOpen(false)}
          open={isPickerOpen}
          onOpenChange={setIsPickerOpen}
        />
      )}

      <SyncHistoryModal
        integrationId={integration.connection?.id || ""}
        integrationName={integration.name}
        open={isHistoryOpen}
        onOpenChange={setIsHistoryOpen}
      />

      <SmartlyFilesPicker
        integration={integration}
        open={isSmartlyOpen}
        onOpenChange={setIsSmartlyOpen}
      />

      <FlowInstancesModal
        connectionId={integration.connection?.id || ""}
        integrationKey={integration.key}
        integrationName={integration.name}
        open={isFlowsOpen}
        onOpenChange={setIsFlowsOpen}
      />

      <div
        className={cn(
          "flex items-center justify-between p-4 pl-0 bg-white border-b"
        )}
      >
        <div className="flex items-center gap-4">
          {integration.logoUri ? (
            <Image
              width={40}
              height={40}
              src={integration.logoUri}
              alt={`${integration.name} logo`}
              className="w-10 h-10 rounded-xl"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
              {integration.name[0]}
            </div>
          )}

          <div className="flex gap-2 items-center">
            <h3 className="font-medium">{integration.name}</h3>
            {isDisconnected && (
              <p className="text-sm font-bold text-red-500 ">Disconnected</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {integration.connection ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSmartlyOpen(true)}
                disabled={!integration.connection?.id}
              >
                <FolderOpen className="w-4 h-4 mr-2" />
                Smartly Files
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFlowsOpen(true)}
                disabled={!integration.connection?.id}
              >
                <Zap className="w-4 h-4 mr-2" />
                Flows
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsHistoryOpen(true)}
                disabled={!integration.connection?.id}
              >
                <Icons.history className="w-4 h-4 mr-2" />
                History
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPickerOpen(true)}
              >
                <FolderOpen className="w-4 h-4 mr-2" />
                Select Files
              </Button>
              {isDisconnected ? (
                <Button
                  variant="ghost"
                  onClick={() => handleConnect()}
                  size="sm"
                  disabled={isConnecting}
                >
                  <span className="font-bold">Reconnect</span>
                  {isConnecting && (
                    <Icons.spinner className="ml-2 h-4 w-4 animate-spin" />
                  )}
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  onClick={handleDisconnect}
                  size="sm"
                  disabled={isDisconnecting}
                >
                  <span className="text-red-500">Disconnect</span>
                  {isDisconnecting && (
                    <Icons.spinner className="ml-2 h-4 w-4 animate-spin" />
                  )}
                </Button>
              )}
            </>
          ) : (
            <Button
              onClick={() => handleConnect()}
              variant="default"
              size="sm"
              disabled={isConnecting}
            >
              Connect{" "}
              {isConnecting && (
                <Icons.spinner className="ml-2 h-4 w-4 animate-spin" />
              )}
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
