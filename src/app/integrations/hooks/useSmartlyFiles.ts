"use client";

import { useState, useCallback } from "react";
import { useIntegrationApp } from "@integration-app/react";

export interface SmartlyItem {
  id: string;
  key: string;
  name: string;
  isFolder: boolean;
  size?: number;
  lastModified?: string;
}

interface ParsedPage {
  files: SmartlyItem[];
  folders: SmartlyItem[];
  isTruncated: boolean;
  nextContinuationToken: string | undefined;
}

function parseXml(raw: string): ParsedPage {
  const parser = new DOMParser();
  const doc = parser.parseFromString(raw, "text/xml");

  const files: SmartlyItem[] = Array.from(doc.querySelectorAll("Contents")).map((el) => {
    const key = el.querySelector("Key")?.textContent ?? "";
    return {
      id: el.querySelector("Id")?.textContent ?? key,
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
      id: prefix,
      key: prefix,
      name: prefix.split("/").filter(Boolean).pop() ?? prefix,
      isFolder: true,
    };
  });

  const isTruncated =
    doc.querySelector("IsTruncated")?.textContent?.toLowerCase() === "true";
  const nextContinuationToken =
    doc.querySelector("NextContinuationToken")?.textContent ?? undefined;

  return { files, folders, isTruncated, nextContinuationToken };
}

function extractXml(output: unknown): string {
  if (typeof output === "string") return output;
  if (output && typeof output === "object") {
    const o = output as Record<string, unknown>;
    if (typeof o.body === "string") return o.body;
    if (typeof o.content === "string") return o.content;
    if (o.response && typeof o.response === "object") {
      const r = o.response as Record<string, unknown>;
      if (typeof r.data === "string") return r.data;
    }
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
    async (prefix?: string) => {
      if (!connectionId) return;
      setLoading(true);
      setError(null);
      try {
        const allFiles: SmartlyItem[] = [];
        const allFolders: SmartlyItem[] = [];
        let token: string | undefined;

        do {
          const result = await integrationApp
            .connection(connectionId)
            .action("list-smartly-files")
            .run({
              ...(prefix && { prefix }),
              delimiter: "/",
              maxKeys: "500",
              ...(token && { continuationToken: token }),
            });

          const xml = extractXml((result as { output: unknown }).output);
          const page = parseXml(xml);

          allFiles.push(...page.files);
          allFolders.push(...page.folders);
          token = page.isTruncated ? page.nextContinuationToken : undefined;
        } while (token);

        setFiles(Array.from(new Map(allFiles.map((f) => [f.id, f])).values()));
        setFolders(Array.from(new Map(allFolders.map((f) => [f.id, f])).values()));
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
        for (const assetPath of keys) {
          await integrationApp
            .connection(connectionId)
            .action("send-files")
            .run({ assetPath });
        }
      } finally {
        setSending(false);
      }
    },
    [connectionId, integrationApp]
  );

  return { files, folders, loading, error, sending, listFiles, sendFiles };
}
