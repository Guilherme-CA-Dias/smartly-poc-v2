"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Integration } from "@integration-app/sdk";
import {
  FileIcon,
  FolderIcon,
  ChevronRightIcon,
  Loader2Icon,
  AlertCircle,
} from "lucide-react";
import { useSmartlyFiles, SmartlyItem } from "../hooks/useSmartlyFiles";
import { toast } from "sonner";

interface BreadcrumbItem {
  prefix: string;
  name: string;
}

interface SmartlyFilesPickerProps {
  integration: Integration;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "browse" | "select-folder";
  onSelectFolder?: (prefix: string) => void;
}

export function SmartlyFilesPicker({
  integration,
  open,
  onOpenChange,
  mode = "browse",
  onSelectFolder,
}: SmartlyFilesPickerProps) {
  const connectionId = integration.connection?.id;

  const { files, folders, loading, error, sending, listFiles, sendFiles } =
    useSmartlyFiles(connectionId);

  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [destinationPath, setDestinationPath] = useState("");

  useEffect(() => {
    if (open) {
      setBreadcrumbs([]);
      setSelected(new Set());
      setDestinationPath("");
      listFiles();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep destination path in sync when navigating folders
  useEffect(() => {
    if (mode === "select-folder") {
      const prefix = breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1].prefix : "";
      setDestinationPath(prefix);
    }
  }, [breadcrumbs, mode]);

  const navigateToFolder = (item: SmartlyItem) => {
    setBreadcrumbs((prev) => [...prev, { prefix: item.key, name: item.name }]);
    listFiles(item.key);
  };

  const navigateToBreadcrumb = (index: number) => {
    if (index === -1) {
      setBreadcrumbs([]);
      listFiles();
    } else {
      const target = breadcrumbs[index];
      setBreadcrumbs((prev) => prev.slice(0, index + 1));
      listFiles(target.prefix);
    }
  };

  const toggleSelect = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleSend = async () => {
    try {
      await sendFiles(Array.from(selected));
      toast.success("Files sent", {
        description: `${selected.size} file${selected.size !== 1 ? "s" : ""} sent successfully`,
      });
      onOpenChange(false);
    } catch (err) {
      toast.error("Failed to send files", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {mode === "select-folder" ? "Choose Smartly destination" : "Smartly Files"}
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-[400px] max-h-[400px] overflow-y-auto my-4">
          <div className="space-y-4">
            {/* Breadcrumbs */}
            {breadcrumbs.length > 0 && (
              <div className="flex items-center flex-wrap gap-2 px-4 py-2 text-sm text-gray-500 bg-gray-50 rounded-xl">
                <button
                  onClick={() => navigateToBreadcrumb(-1)}
                  className="hover:text-gray-900 transition-colors"
                >
                  Root
                </button>
                {breadcrumbs.map((crumb, index) => (
                  <div key={crumb.prefix} className="flex items-center gap-2">
                    <ChevronRightIcon className="h-4 w-4 text-gray-400" />
                    <button
                      onClick={() => navigateToBreadcrumb(index)}
                      className={cn(
                        "hover:text-gray-900 transition-colors",
                        index === breadcrumbs.length - 1 && "font-medium text-gray-900"
                      )}
                    >
                      {crumb.name}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-48 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full w-2/5 bg-black rounded-full animate-[loading_1.5s_ease-in-out_infinite]" />
                </div>
                <p className="text-sm text-gray-500 mt-4">Loading files...</p>
              </div>
            )}

            {/* Error */}
            {!loading && error && (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="p-4 bg-red-50 rounded-full mb-4">
                  <AlertCircle className="w-8 h-8 text-red-600" />
                </div>
                <p className="text-sm text-red-600 mb-4">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    listFiles(breadcrumbs[breadcrumbs.length - 1]?.prefix)
                  }
                >
                  Try Again
                </Button>
              </div>
            )}

            {/* Empty */}
            {!loading && !error && folders.length === 0 && files.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12">
                <p className="text-gray-500">No items found</p>
              </div>
            )}

            {/* Items */}
            {!loading && !error && (folders.length > 0 || files.length > 0) && (
              <div className="space-y-1">
                {folders.map((folder) => (
                  <div
                    key={folder.id}
                    className="flex items-center gap-3 py-2 px-4 hover:bg-gray-50 cursor-pointer rounded-xl"
                    onClick={() => navigateToFolder(folder)}
                  >
                    {mode === "browse" && (
                      <Checkbox
                        checked={selected.has(folder.key)}
                        onCheckedChange={() => toggleSelect(folder.key)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <FolderIcon className="h-4 w-4 flex-shrink-0 text-gray-400" />
                      <span className={cn("truncate", mode === "browse" && selected.has(folder.key) && "text-blue-600")}>
                        {folder.name}
                      </span>
                    </div>
                    <ChevronRightIcon className="h-4 w-4 text-gray-400" />
                  </div>
                ))}

                {mode === "browse" && files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 py-2 px-4 hover:bg-gray-50 cursor-pointer rounded-xl"
                    onClick={() => toggleSelect(file.key)}
                  >
                    <Checkbox
                      checked={selected.has(file.key)}
                      onCheckedChange={() => toggleSelect(file.key)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <FileIcon className="h-4 w-4 flex-shrink-0 text-gray-400" />
                      <span className={cn("truncate", selected.has(file.key) && "text-blue-600")}>
                        {file.name}
                      </span>
                    </div>
                    {file.size !== undefined && (
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {(file.size / 1024).toFixed(0)} KB
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="!flex !flex-row !items-center !justify-between">
          {mode === "select-folder" ? (
            <>
              <div className="flex items-center gap-2 flex-1">
                <span className="text-sm text-gray-500 whitespace-nowrap">Path:</span>
                <Input
                  value={destinationPath}
                  onChange={(e) => setDestinationPath(e.target.value)}
                  placeholder="e.g. campaign-assets/summer/"
                  className="h-8 text-sm font-mono"
                />
              </div>
              <div className="flex gap-2 ml-2 flex-shrink-0">
                <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    onSelectFolder?.(destinationPath);
                    onOpenChange(false);
                  }}
                >
                  Upload here
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="text-sm text-gray-600">
                {selected.size} {selected.size === 1 ? "item" : "items"} selected
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
                  Close
                </Button>
                {selected.size > 0 && (
                  <Button onClick={handleSend} disabled={sending}>
                    {sending ? (
                      <>
                        <Loader2Icon className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      "Send"
                    )}
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
