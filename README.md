# Content Import App

A Next.js application that imports content from third-party integrations (Google Drive, Dropbox, Box, etc.) into a knowledge base using [Membrane](https://getmembrane.com) (powered by Integration.app).

---

## How it works

### 1. Customer setup (Overview page)

On first load, the app generates a random customer ID stored in localStorage. This ID is used to generate a signed JWT that authenticates the current user with Membrane.

Before connecting any integration, the user must enter their **Internal API credentials** on the overview page:

| Field | Purpose |
|---|---|
| `AWS_ACCESS_KEY_ID` | S3 access key |
| `AWS_SECRET_ACCESS_KEY` | S3 secret key |
| `AWS_REGION` | S3 region |
| `ENDPOINT_URL` | Your internal API base URL |
| `LIBRARY_ID` | Target library for imported content |

These credentials are stored in localStorage and passed to the Membrane SDK on initialization, so Membrane can authenticate requests it makes to your internal API on the user's behalf.

---

### 2. Connecting an integration (Integrations page)

The Integrations page lists all available integrations. Users can:

- **Connect** an integration via OAuth or client credentials
- **Browse** all available integrations via the pre-built Membrane embedded UI (`integrationApp.open()`)
- **Manage flow instances** — enable or disable individual flows per integration via the Flows dialog
- **View sync history** for each connected integration

---

### 3. Selecting and syncing documents

Once an integration is connected, clicking **Select Files** opens a document picker that fetches the folder/file tree from the integration. The user selects which documents to sync and clicks **Sync**.

This triggers two parallel background operations:

**a) Document metadata sync**

A sync record is created in MongoDB with status `in_progress`. A background job (`syncDocuments`) then:
1. Fetches each selected document (and its children if it's a folder) via the Membrane SDK
2. Saves all document metadata to MongoDB via bulk upsert
3. Updates the sync record to `completed` (or `failed` after 3 retries with exponential backoff)

**b) Flow runs**

For each selected document, a `download-content-item` flow run is triggered via the Membrane API:

```
POST /flows/download-content-item/run?layer=connection&integrationKey={key}
{ "input": { "documentId": "..." } }
```

One request per document, all fired in parallel. This tells Membrane to download the actual file content and deliver it to your internal API.

---

### 4. Webhook events

Membrane calls your app's webhooks when content changes:

- **`/api/webhooks/on-create`** — new document detected, triggers a `download-content-item` flow run
- **`/api/webhooks/on-update`** — document updated, re-triggers the download flow
- **`/api/webhooks/on-delete`** — document deleted, removes it from MongoDB
- **`/api/webhooks/on-download-complete`** — Membrane has finished downloading; the app extracts text and stores the result in S3

---

## Architecture

```
Browser (localStorage: customerId, credentials)
  │
  ├── x-auth-id / x-customer-name / x-credentials headers
  │
Next.js API routes
  ├── Generate JWT (workspace key + secret)
  ├── IntegrationAppClient({ token, credentials })  ← credentials injected here
  └── MongoDB (sync records, document metadata)
        │
        └── S3 (extracted text content)
```

---

## Prerequisites

- Node.js 18+
- Membrane workspace credentials (Workspace Key and Secret) — [get them here](https://console.integration.app/settings/workspace)
- MongoDB connection string
- AWS S3 credentials

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env-sample .env
```

Fill in `.env`:

```env
# Membrane / Integration.app
INTEGRATION_APP_WORKSPACE_KEY=
INTEGRATION_APP_WORKSPACE_SECRET=

# MongoDB
MONGODB_URI=

# AWS S3
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-2
AWS_BUCKET_NAME=

# Internal API (can also be set per-user via the Overview page UI)
ENDPOINT_URL=
LIBRARY_ID=
```

### 3. Add the scenario to your workspace

This app relies on predefined flows and actions. Navigate to the [Continuously Import Content to My App scenario](https://integration.app/scenarios/continuously-import-content-to-my-app) and click **Add to App**.

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## MongoDB via Docker

```bash
docker-compose up
```

```env
MONGODB_URI=mongodb://admin:password123@localhost:27017/knowledge
```

---

## License

MIT
