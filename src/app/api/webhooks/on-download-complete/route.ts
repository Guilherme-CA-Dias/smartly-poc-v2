import { z } from "zod";
import connectDB from "@/lib/mongodb";

import { DocumentModel } from "@/models/document";
import { NextResponse } from "next/server";
import { inngest } from "@/inngest/client";
import { DownloadState } from "@/types/download";

const SMARTLY_FILESTORE = "https://app.smartly.io/filestore/public";

async function pushToSmartly(
  downloadURI: string,
  title: string,
  destinationPrefix: string,
  libraryId: string,
  apiToken: string
): Promise<void> {
  const binaryRes = await fetch(downloadURI);
  if (!binaryRes.ok) throw new Error(`Failed to fetch binary: ${binaryRes.status}`);
  const binary = await binaryRes.arrayBuffer();

  const prefix = destinationPrefix.replace(/\/$/, "");
  const objectKey = prefix ? `${prefix}/${title}` : title;
  const url = `${SMARTLY_FILESTORE}/${libraryId}/${objectKey}`;

  const putRes = await fetch(url, {
    method: "PUT",
    headers: { "x-api-token": apiToken, "Content-Type": "application/octet-stream" },
    body: binary,
  });

  if (!putRes.ok) {
    const msg = await putRes.text();
    throw new Error(`Smartly PUT failed (${putRes.status}): ${msg}`);
  }
}

const onDownloadCompleteWebhookPayloadSchema = z.object({
  downloadURI: z
    .union([
      z.string().url().min(1),
      z
        .string()
        .length(0)
        .transform(() => undefined),
    ])
    .optional(),
  documentId: z.string(),
  text: z.string().optional(),
  connectionId: z.string(),
});

/**
 * This endpoint is called when a download flow for a document is complete
 *
 * - We want to update the document with new content if provided
 * - When new resourceURI is provided, we want to download the file into our own storage
 *   and update the document with the new downloadURI
 */

export async function POST(request: Request) {
  try {
    const rawPayload = await request.json();

    const validationResult =
      onDownloadCompleteWebhookPayloadSchema.safeParse(rawPayload);

    if (!validationResult.success) {
      console.error("Invalid webhook payload:", validationResult.error);
      return NextResponse.json(
        {
          error: "Invalid webhook payload",
          details: validationResult.error.format(),
        },
        { status: 400 }
      );
    }

    const payload = validationResult.data;
    const { downloadURI, documentId, text, connectionId } = payload;

    await connectDB();

    const document = await DocumentModel.findOne({
      connectionId,
      id: documentId,
    });

    if (!document) {
      console.error(`Document with id ${documentId} not found`);
      return NextResponse.json({ success: true }, { status: 200 });
    }

    if (text) {
      await DocumentModel.findOneAndUpdate(
        { connectionId, id: documentId },
        {
          $set: {
            lastSyncedAt: new Date().toISOString(),
            downloadState: DownloadState.DONE,
            content: text,
          },
        },
        { new: true }
      );
    } else if (downloadURI) {
      await inngest.send({
        name: "document/download-and-extract-text-from-file",
        data: {
          downloadURI,
          documentId,
          connectionId,
          title: document.title,
          currentStorageKey: document.storageKey,
        },
      });

      if (document.smartlyUpload) {
        const { destinationPrefix, libraryId, apiToken } = document.smartlyUpload;
        pushToSmartly(downloadURI, document.title, destinationPrefix, libraryId, apiToken)
          .catch((err) => console.error(`Smartly upload failed for ${documentId}:`, err));
      }
    } else {
      await DocumentModel.findOneAndUpdate(
        { connectionId, id: documentId },
        {
          $set: {
            downloadState: DownloadState.DONE,
          },
        }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Failed to process webhook:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
