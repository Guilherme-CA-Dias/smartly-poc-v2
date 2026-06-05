"use client";

import { useState, useCallback } from "react";
import { useIntegrationApp } from "@integration-app/react";
import { getAuthHeaders } from "@/app/auth-provider";

const MEMBRANE_FILES_URL = "https://api.getmembrane.com/files";

export interface SmartlyItem {
  key: string;
  name: string;
  isFolder: boolean;
  size?: number;
  lastModified?: string;
}

function parseXml(raw: string): { files: SmartlyItem[]; folders: SmartlyItem[] } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(raw, "text/xml");

  const files: SmartlyItem[] = Array.from(doc.querySelectorAll("Contents")).map((el) => {
    const key = el.querySelector("Key")?.textContent ?? "";
    return {
      key,
      name: key.split("/").filter(Boolean).pop() ?? key,
      isFolder: false,
      size: parseInt(el.querySelector("Size")?.textContent ?? "0"),
      lastModified: el.querySelector("LastModified")?.textContent ?? undefined,
    };
  });

  const folders: SmartlyItem[] = Array.from(
    doc.querySelectorAll("CommonPrefixes > Prefix")
  ).map((el) => {
    const prefix = el.textContent ?? "";
    return {
      key: prefix,
      name: prefix.split("/").filter(Boolean).pop() ?? prefix,
      isFolder: true,
    };
  });

  return { files, folders };
}

function extractXml(output: unknown): string {
  if (typeof output === "string") return output;
  if (output && typeof output === "object") {
    const o = output as Record<string, unknown>;
    if (typeof o.body === "string") return o.body;
    if (typeof o.content === "string") return o.content;
  }
  return "";
}

export function useSmartlyFiles(connectionId: string | undefined) {
  const integrationApp = useIntegrationApp();
  const [files, setFiles] = useState<SmartlyItem[]>([]);
  const [folders, setFolders] = useState<SmartlyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const listFiles = useCallback(
    async (prefix?: string, continuationToken?: string) => {
      if (!connectionId) return;
      setLoading(true);
      setError(null);
      try {
        const result = await integrationApp
          .connection(connectionId)
          .action("list-smartly-files")
          .run({
            ...(prefix && { prefix }),
            delimiter: "/",
            maxKeys: 500,
            ...(continuationToken && { continuationToken }),
          });

        const xml = extractXml((result as { output: unknown }).output);
        const parsed = parseXml(xml);
        setFiles(parsed.files);
        setFolders(parsed.folders);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to list files");
      } finally {
        setLoading(false);
      }
    },
    [connectionId, integrationApp]
  );

  const sendFiles = useCallback(
    async (keys: string[]) => {
      if (!connectionId) return;
      setSending(true);
      try {
        // Fetch integration token once for all uploads
        const tokenRes = await fetch("/api/integration-token", {
          headers: getAuthHeaders(),
        });
        if (!tokenRes.ok) throw new Error("Failed to get integration token");
        const { token } = await tokenRes.json();

        for (const assetPath of keys) {
          // 1. Get binary from Smartly
          const getResult = await integrationApp
            .connection(connectionId)
            .action("get-smartly-files")
            .run({ assetPath });

          const binary =
            (getResult as { output: Record<string, unknown> }).output?.body ??
            (getResult as { output: unknown }).output;

          // 2. Upload to Membrane to get a stable download URL
          const uploadRes = await fetch(MEMBRANE_FILES_URL, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/octet-stream",
            },
            body: binary as BodyInit,
          });
          if (!uploadRes.ok) throw new Error(`Membrane upload failed for ${assetPath}`);
          const { downloadUri } = await uploadRes.json();

          // 3. Send the download URL to the integration
          await integrationApp
            .connection(connectionId)
            .action("send-files")
            .run({ assetPath, downloadUrl: downloadUri });
        }
      } finally {
        setSending(false);
      }
    },
    [connectionId, integrationApp]
  );

  return { files, folders, loading, error, sending, listFiles, sendFiles };
}
