import { IntegrationAppClient } from "@integration-app/sdk";
import type { AuthCredentials } from "@/lib/auth";

const SMARTLY_FILESTORE = "https://app.smartly.io/filestore/public";

interface UploadConfig {
  connectionId: string;
  token: string;
  credentials?: AuthCredentials;
  documentIds: string[];
  destinationPrefix: string;
  libraryId: string;
  apiToken: string;
}

interface DownloadActionOutput {
  downloadUri?: string;
  fileName?: string;
  contentType?: string;
  mimeType?: string;
  contentLength?: string;
  exportLinks?: Record<string, string>;
}

export async function uploadDocsToSmartly(config: UploadConfig): Promise<void> {
  const { connectionId, token, credentials, documentIds, destinationPrefix, libraryId, apiToken } = config;
  const integrationApp = new IntegrationAppClient({ token, credentials });

  const prefix = destinationPrefix.replace(/\/$/, "");

  for (const documentId of documentIds) {
    try {
      const result = await integrationApp
        .connection(connectionId)
        .action("download-content-item")
        .run({ id: documentId }) as { output: DownloadActionOutput };

      const { downloadUri, fileName, contentType, exportLinks } = result.output;

      const fetchUrl = downloadUri ?? (exportLinks ? Object.values(exportLinks)[0] : undefined);

      if (!fetchUrl) {
        console.warn(`No download URL in action output for document ${documentId}`);
        continue;
      }

      const binaryRes = await fetch(fetchUrl);
      if (!binaryRes.ok) throw new Error(`Failed to fetch binary: ${binaryRes.status}`);
      const body = await binaryRes.arrayBuffer();

      const baseName = fileName ?? documentId;
      const ts = Math.floor(Date.now() / 1000);
      const dot = baseName.lastIndexOf(".");
      const name = dot === -1
        ? `${baseName}_${ts}`
        : `${baseName.slice(0, dot)}_${ts}${baseName.slice(dot)}`;
      const objectKey = prefix ? `${prefix}/${name}` : name;

      const putRes = await fetch(`${SMARTLY_FILESTORE}/${libraryId}/${objectKey}`, {
        method: "PUT",
        headers: {
          "x-api-token": apiToken,
          "Content-Type": contentType ?? "application/octet-stream",
        },
        body,
      });

      if (!putRes.ok) {
        const msg = await putRes.text();
        throw new Error(`Smartly PUT failed for "${name}": ${putRes.status} ${msg}`);
      }

      console.log(`Uploaded "${name}" → ${objectKey}`);
    } catch (err) {
      console.error(`Failed to upload document ${documentId} to Smartly:`, err);
    }
  }
}
