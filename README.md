# Retell AI ↔️ Zoho CRM Serverless Integration

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Vercel Serverless](https://img.shields.io/badge/Vercel-Serverless%20Functions-black.svg)](https://vercel.com/)
[![Retell AI](https://img.shields.io/badge/Retell%20AI-Voice%20Engine-purple.svg)](https://retellai.com/)
[![Zoho CRM](https://img.shields.io/badge/Zoho%20CRM-v6%20REST%20API-orange.svg)](https://www.zoho.com/crm/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

A production-ready, ultra-low-latency serverless integration connecting **Retell AI voice agents** directly to **Zoho CRM** using TypeScript and Vercel Serverless Functions.

> **Zero Third-Party Automation Middleware**: Completely standalone. No Zapier, Make, n8n, Pipedream, or Zoho Flow required.

---

## Table of Contents

1. [Architecture & Flow](#1-architecture--flow)
2. [Project Structure](#2-project-structure)
3. [Prerequisites & Accounts](#3-prerequisites--accounts)
4. [Step-by-Step Zoho OAuth 2.0 Setup](#4-step-by-step-zoho-oauth-20-setup)
5. [Configuring Retell AI Webhooks](#5-configuring-retell-ai-webhooks)
6. [Environment Variables](#6-environment-variables)
7. [Local Development & Testing](#7-local-development--testing)
8. [Automated Test Suite](#8-automated-test-suite)
9. [Diagnostic Endpoints](#9-diagnostic-endpoints)
10. [Customizing Zoho CRM Field Mappings](#10-customizing-zoho-crm-field-mappings)
11. [Vercel Deployment](#11-vercel-deployment)
12. [Troubleshooting Guide](#12-troubleshooting-guide)

---

## 1. Architecture & Flow

```
                      INBOUND PHONE CALL
                               │
                               ▼
                           RETELL AI
                               │
            POST /api/retell/inbound (Signature verified)
                               │
                               ▼
                       VERCEL SERVERLESS
                               │
               Normalize Phone (E.164 / +234 / +971)
                               │
                               ▼
                           ZOHO CRM
                               │
            1. Search Contacts ──> (Not found) ──> 2. Search Leads
                               │
                               ▼
                    Customer Context & History
                               │
                               ▼
                       VERCEL SERVERLESS
                               │
                Return Dynamic Variables (JSON)
                               │
                               ▼
                           RETELL AI
                               │
                               ▼
                   PERSONALIZED VOICE CALL
              (Greets by name, references history)
                               │
                               ▼
                           CALL ENDS
                               │
               POST /api/retell/webhook (call_analyzed)
                               │
                               ▼
                       VERCEL SERVERLESS
                               │
                 Check Duplicates & Map Fields
                               │
                               ▼
                     ZOHO CRM UPDATE/CREATE
               (Summary, Sentiment, Recording URL)
```

---

## 2. Project Structure

```
retell-zoho-integration/
├── api/
│   ├── health.ts                 # GET  /api/health (Service status & config check)
│   ├── retell/
│   │   ├── inbound.ts            # POST /api/retell/inbound (Inbound dynamic variables)
│   │   ├── webhook.ts            # POST /api/retell/webhook (Post-call analysis sync)
│   │   └── test.ts               # POST /api/retell/test (Simulation test endpoint)
│   └── zoho/
│       └── test.ts               # GET  /api/zoho/test (OAuth diagnostic & phone test)
│
├── lib/
│   ├── config.ts                 # Centralized, type-safe configuration
│   ├── context/
│   │   └── generator.ts          # Natural language context builder for Retell agent
│   ├── errors/
│   │   └── AppError.ts           # Typed error hierarchy & operational status codes
│   ├── logging/
│   │   └── logger.ts             # Structured JSON logger with secret & PII masking
│   ├── phone/
│   │   └── normalize.ts          # Phone normalizer (Nigeria +234, UAE +971, E.164)
│   ├── retell/
│   │   ├── client.ts             # Retell SDK client
│   │   └── verification.ts       # Retell webhook signature verification (SDK + HMAC)
│   ├── security/
│   │   └── signatures.ts         # Constant-time comparison & HMAC utilities
│   └── zoho/
│       ├── auth.ts               # Zoho OAuth 2.0 token manager with in-memory caching
│       ├── client.ts             # Zoho CRM API v6 HTTP client with 401 retry
│       ├── contacts.ts           # Contact CRUD & phone search
│       ├── customer.ts           # Unified customer resolver (Contacts -> Leads)
│       ├── field-mapping.ts      # Configurable CRM custom field mapping
│       └── leads.ts              # Lead CRUD & duplicate-safe creation
│
├── types/
│   ├── common.ts                 # NormalizedCustomer, ApiResponse, LogContext
│   ├── retell.ts                 # Webhook request/response schemas & analysis types
│   └── zoho.ts                   # Zoho API v6 record models & OAuth token types
│
├── docs/
│   └── retell-agent-prompt.md    # Production voice agent system prompt & greeting guidance
│
├── tests/
│   ├── context.test.ts           # Tests for natural language context builder
│   ├── phone.test.ts             # Tests for Nigerian, UAE & international normalization
│   ├── retell.test.ts            # Tests for webhook signatures & inbound format
│   └── zoho.test.ts              # Tests for token refresh, search, & customer resolution
│
├── .env.example                  # Environment variable reference template
├── .gitignore                    # Git ignore file protecting .env and build files
├── package.json                  # Dependencies and scripts
├── tsconfig.json                 # Strict TypeScript configuration
├── vercel.json                   # Vercel serverless configuration
└── README.md                     # Complete documentation
```

---

## 3. Prerequisites & Accounts

1. **Retell AI Account**: Active account at [beta.retellai.com](https://beta.retellai.com).
2. **Zoho CRM Account**: Standard, Professional, or Enterprise account with API access.
3. **Vercel Account**: [vercel.com](https://vercel.com) for hosting serverless functions.
4. **Node.js**: v18.0.0 or higher.

---

## 4. Step-by-Step Zoho OAuth 2.0 Setup

Zoho CRM uses OAuth 2.0. Follow these steps to obtain your **Client ID**, **Client Secret**, and permanent **Refresh Token**:

### Step 1: Open Zoho API Console
1. Navigate to the [Zoho Developer Console](https://api-console.zoho.com/).
2. Log in using your Zoho administrator credentials.

### Step 2: Create a Server-based Application
1. Click **Add Client** and select **Server-based Applications**.
2. Fill in the details:
   - **Client Name**: `Retell AI Voice Integration`
   - **Homepage URL**: `https://your-project.vercel.app` (or `http://localhost:3000` for testing)
   - **Authorized Redirect URIs**: `https://your-project.vercel.app/oauth/callback` (or `https://api-console.zoho.com`)
3. Click **Create**.
4. Copy your **Client ID** and **Client Secret**.

### Step 3: Generate a Permanent Refresh Token
1. In the Zoho API Console, select your newly created client.
2. Click the **Generate Code** tab (or **Self-Client**).
3. Under **Scope**, enter the required Zoho CRM scopes:
   ```text
   ZohoCRM.modules.ALL,ZohoCRM.settings.ALL
   ```
4. Set **Time Duration** to `10 minutes` and **Scope Description** to `Retell AI Integration Token`.
5. Click **Create**. Copy the generated grant code (e.g. `1000.xxxx.yyyy`).

### Step 4: Exchange Grant Code for Refresh Token
Run the following cURL request in your terminal within 10 minutes (replace with your values and regional Zoho accounts domain):

```bash
curl https://accounts.zoho.com/oauth/v2/token \
  -X POST \
  -d "grant_type=authorization_code" \
  -d "client_id=YOUR_ZOHO_CLIENT_ID" \
  -d "client_secret=YOUR_ZOHO_CLIENT_SECRET" \
  -d "redirect_uri=https://your-project.vercel.app/oauth/callback" \
  -d "code=YOUR_GRANT_CODE"
```

The response will return:
```json
{
  "access_token": "1000.xxxx",
  "refresh_token": "1000.yyyy.zzzz",
  "api_domain": "https://www.zohoapis.com",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

Save the `refresh_token` in your `.env` file as `ZOHO_REFRESH_TOKEN`. This token does not expire unless revoked.

---

## 5. Configuring Retell AI Webhooks

### 1. Inbound Webhook (Dynamic Personalization)
1. Go to your [Retell Dashboard](https://beta.retellai.com/) -> **Phone Numbers**.
2. Select your inbound phone number.
3. In the **Inbound Webhook URL** field, set:
   ```text
   https://your-project.vercel.app/api/retell/inbound
   ```
4. Save the phone number configuration.

### 2. Post-Call Webhook (Call Analysis & CRM Sync)
1. In Retell Dashboard -> **Agent Settings** -> Select your Agent.
2. Under **Webhook Settings** -> **Webhook URL**, set:
   ```text
   https://your-project.vercel.app/api/retell/webhook
   ```
3. Copy your **Retell API Key** from Settings -> API Keys and set it as `RETELL_API_KEY` in Vercel.

---

## 6. Environment Variables

Create `.env.local` for local development by copying `.env.example`:

```bash
cp .env.example .env.local
```

| Variable | Description | Example |
|---|---|---|
| `RETELL_API_KEY` | Retell AI API Key for signature verification | `key_xxxxxx` |
| `RETELL_WEBHOOK_SECRET` | Optional webhook secret (falls back to API Key) | `secret_xxxxxx` |
| `ZOHO_CLIENT_ID` | Zoho OAuth 2.0 Client ID | `1000.xxxxxx` |
| `ZOHO_CLIENT_SECRET` | Zoho OAuth 2.0 Client Secret | `xxxxxx` |
| `ZOHO_REFRESH_TOKEN` | Zoho OAuth 2.0 Permanent Refresh Token | `1000.xxxxxx.yyyyyy` |
| `ZOHO_ACCOUNTS_URL` | Regional Zoho Accounts Domain | `https://accounts.zoho.com` |
| `ZOHO_API_DOMAIN` | Regional Zoho CRM API Domain | `https://www.zohoapis.com` |
| `APP_ENV` | Environment name | `development` / `production` |
| `DEFAULT_PHONE_COUNTRY` | Default country code for phone normalization | `NG` (Nigeria) or `AE` (UAE) |
| `CREATE_LEADS_FOR_UNKNOWN_CALLERS` | Auto-create new Lead if caller is not in CRM | `true` |
| `LEAD_SOURCE` | Default Lead Source value in Zoho | `"AI Voice Agent"` |
| `DIAGNOSTIC_API_KEY` | Secret key for `/api/zoho/test` in production | `my_secret_key` |

---

## 7. Local Development & Testing

### Install Dependencies
```bash
npm install
```

### Start Development Server
```bash
npm run dev
```
Your serverless functions will be available at `http://localhost:3000/api/...`.

---

## 8. Automated Test Suite

Run the comprehensive unit and integration test suite:

```bash
npm test
```

For watch mode during development:
```bash
npm run test:watch
```

The test suite covers:
- **Phone Normalization** (`tests/phone.test.ts`): Nigerian local (`080...`), UAE local (`050...`, `02...`), international E.164 (`+1...`, `+44...`), and malformed inputs.
- **Context Generator** (`tests/context.test.ts`): CRM context summarization and Retell dynamic variables schema.
- **Zoho CRM Service** (`tests/zoho.test.ts`): OAuth token caching, automatic expiration refresh, Contacts-first lookup, and Leads fallback.
- **Retell Webhooks** (`tests/retell.test.ts`): HMAC-SHA256 signature verification, inbound dynamic variable payload delivery, and post-call sync.

---

## 9. Diagnostic Endpoints

### 1. Health Check
```bash
curl http://localhost:3000/api/health
```

### 2. Live Zoho Diagnostic Test
Test your Zoho OAuth credentials and live customer search:
```bash
# Check OAuth connectivity
curl "http://localhost:3000/api/zoho/test"

# Test searching for a live phone number in Zoho
curl "http://localhost:3000/api/zoho/test?phone=+2348012345678"
```

### 3. Retell Inbound Simulation
Simulate how Retell calls the inbound endpoint without making a phone call:
```bash
curl -X POST http://localhost:3000/api/retell/test \
  -H "Content-Type: application/json" \
  -d '{
    "event": "call_inbound",
    "call_inbound": {
      "from_number": "+2348012345678",
      "agent_id": "test-agent-01"
    }
  }'
```

---

## 10. Customizing Zoho CRM Field Mappings

All CRM field mappings are defined in [`lib/zoho/field-mapping.ts`](lib/zoho/field-mapping.ts).

If your Zoho CRM instance uses custom field API names (e.g. `AI_Summary` instead of `Last_Call_Summary`), simply update `ZOHO_FIELD_MAP`:

```typescript
export const ZOHO_FIELD_MAP = {
  // Map application fields to your Zoho API field names
  lastCallSummary: 'Last_Call_Summary', // or 'AI_Summary'
  callOutcome: 'Call_Outcome',
  sentiment: 'Customer_Sentiment',
  callIntent: 'Call_Intent',
  recordingUrl: 'AI_Call_Recording_URL',
  conversationId: 'AI_Conversation_ID',
  chargerBrand: 'Charger_Brand',
  evModel: 'EV_Make_Model',
  propertyType: 'Property_Type',
  quotedPackage: 'Quoted_Package',
};
```

---

## 11. Vercel Deployment

### Deploy via Vercel CLI
```bash
# Login to Vercel
npx vercel login

# Deploy to preview
npx vercel

# Deploy to production
npx vercel --prod
```

### Deploy via GitHub
1. Push your repository to GitHub.
2. Import the repository into the [Vercel Dashboard](https://vercel.com/new).
3. In **Settings -> Environment Variables**, add the production values from your `.env` file.
4. Click **Deploy**.

---

## 12. Troubleshooting Guide

| Issue | Cause | Solution |
|---|---|---|
| `invalid_client` / `401 Unauthorized` during Zoho Refresh | Wrong `ZOHO_CLIENT_ID` or `ZOHO_CLIENT_SECRET` | Verify your Client ID and Secret in Zoho API Console. Ensure no trailing spaces in `.env`. |
| `invalid_code` / `invalid_grant` during OAuth exchange | Grant code expired (valid for 10 min) or already used | Generate a fresh code in Zoho Developer Console and exchange immediately. |
| `INVALID_DATA` / `400 Bad Request` updating Zoho | Field API name does not exist in Zoho CRM | Check Zoho CRM -> Setup -> Customization -> Modules and Fields -> Check API Names, then update `lib/zoho/field-mapping.ts`. |
| `401 Invalid Retell webhook signature` | Mismatched `RETELL_API_KEY` | Ensure `RETELL_API_KEY` matches the key with Webhook Badge enabled in Retell Dashboard. |
| Call proceeds as "New Caller" for known number | Phone formatted differently in CRM | The integration searches standard E.164, local `080...`, and bare digits. Ensure phone field in CRM contains digits matching the caller. |
| Zoho API Rate Limit (`TOO_MANY_REQUESTS`) | Zoho CRM daily API limit reached | In-memory token caching prevents unnecessary auth calls. For high volumes, increase Zoho CRM API license limit. |

---

## License

MIT License. Built for production serverless deployment.
