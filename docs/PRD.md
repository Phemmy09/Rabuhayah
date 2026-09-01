# Product Requirements Document (PRD)

## Project: Retell AI ↔️ Zoho CRM Serverless Integration
**Version:** 1.0.0  
**Status:** Approved / In Implementation  
**Target Environment:** Vercel Serverless Functions + TypeScript + Node.js (>=18.0)  
**Primary Integration Partners:** Retell AI (Voice Engine) & Zoho CRM (API v6)  
**Target Markets:** Nigeria (+234), UAE (+971), International (E.164)

---

## 1. Executive Summary & Objective

### 1.1 Problem Statement
Voice AI agents operating in isolation lack customer context. When existing or prospective customers call, standard voice agents treat them generically without knowledge of their names, open deals, support history, or past preferences. Conversely, after calls conclude, call summaries, transcripts, sentiment scores, and customer intents remain trapped in the voice platform instead of syncing to the core CRM.

Using third-party automation tools (Zapier, Make, n8n, Pipedream, Zoho Flow) introduces significant latency (often 1.5s–4.0s), recurring platform costs, vendor lock-in, and fragile multi-hop failure points unacceptable for real-time voice conversations.

### 1.2 Solution Overview
A purpose-built, high-performance, stateless serverless integration hosted on **Vercel Serverless Functions** that creates a bi-directional bridge between **Retell AI** and **Zoho CRM**:
- **Inbound (< 800ms latency):** Inbound caller phone number is normalized, searched across Zoho Contacts and Leads, transformed into concise natural-language context and dynamic variables, and returned to Retell to instantly personalize the AI greeting and conversation.
- **Post-Call:** Call completion and AI analysis webhooks are received, verified, parsed, and mapped into Zoho CRM fields (Call Summary, Sentiment, Outcome, Recording URL, and custom industry properties) with built-in duplicate protection.

---

## 2. System Architecture & High-Level Flow (Single Number + AI Receptionist)

```
                     SINGLE INBOUND NUMBER (e.g. 026591000)
                                        │
                                        ▼
                                   RETELL AI
                                        │
                 POST /api/retell/inbound (x-retell-signature)
                                        │
                                        ▼
                                VERCEL SERVERLESS
                                        │
                   Search Zoho CRM & Build Dynamic Context
                                        │
                                        ▼
                           RETELL AI - MARYAM (Receptionist)
                         "Hi Bolu, welcome back! How can I help?"
                                        │
                 ┌──────────────────────┴──────────────────────┐
                 │          QUALIFIES INTENT & TRANSFERS       │
                 ▼                                             ▼
        SPECIALIST AI AGENTS                        HUMAN DEPARTMENTS
  ┌───────────────────────────────┐               ┌────────────────────────┐
  │ • Customer Support AI (24/7)  │               │ • B2B Sales (Ext 124)  │
  │ • B2C Sales AI (Chargers)     │               │ • Finance (Ext 125)    │
  │ • BARQ Fleet Support AI       │               └────────────────────────┘
  │ • Plug 'n Go Support AI       │
  └───────────────────────────────┘
                 │
                 ▼
             CALL ENDS ──> POST /api/retell/webhook ──> UPDATE ZOHO CRM
```

---

## 3. Single-Number Telephony & Call Routing Plan

All incoming calls arrive through **ONE single public phone number** connected to **Maryam (Receptionist / Router AI)**. Callers are then warm-transferred to specialist AI agents or human departments:

| Destination | Type | Target Agent / Extension | Trigger / Intent |
|---|---|---|---|
| **Customer Support AI** | AI Agent Transfer | `agent_support_001` (24/7) | Technical faults, charging session errors, app billing, refund queries, station status. |
| **B2C Sales AI** | AI Agent Transfer | `agent_sales_002` (Office Hours) | Home charger purchase, installation quotes (5m–20m packages), site survey inquiries. |
| **BARQ Support AI** | AI Agent Transfer | `agent_barq_004` (24/7) | BARQ delivery fleet drivers, OTP verification, 30% cashback, 360 kW DC charging. |
| **Plug 'n Go Support AI** | AI Agent Transfer | `agent_plugngo_005` (24/7) | Tatweer / Plug 'n Go partner stations, tariffs, pre-auth refunds. |
| **Human B2B Sales** | Phone Transfer | Ext 124 / `+971 50 973 2525` | Corporate fleet, malls, hospitals, commercial RFQ, multi-site deployments. |
| **Human Finance** | Phone Transfer | Ext 125 (`finance@catec.ae`) | Invoices, supplier payments, VAT queries, corporate top-up verification. |

---

## 4. Functional Requirements (FR)

### FR-1: Phone Number Normalization Engine
- **Requirement:** The system must normalize raw phone numbers into canonical **E.164** format and generate search variations to ensure maximum match rates in Zoho CRM.
- **Supported Regions:**
  - **Nigeria (+234):** `08012345678`, `2348012345678`, `+2348012345678`, `0801 234 5678` -> `+2348012345678`
  - **UAE (+971):** `0509732525`, `971509732525`, `026591000`, `+971509732525` -> `+971509732525`
  - **International:** Preserve valid E.164 formats (`+14155552671`, `+447911123456`).
- **Search Variations:** Generates E.164, un-prefixed digits, national number, and local leading zero formats to query CRM records entered in non-standard formats.

### FR-2: Zoho OAuth 2.0 Service with In-Memory Caching
- **Requirement:** Seamless token generation and refresh using Zoho OAuth 2.0 `grant_type=refresh_token`.
- **Capabilities:**
  - In-memory token caching across serverless warm executions.
  - Automatic expiration detection (refreshes 5 minutes before expiration).
  - Concurrency lock: Prevents simultaneous duplicate token requests during high traffic spikes.
  - Automatic 401 retry: If Zoho rejects an active token, the client clears the cache, acquires a fresh token, and retries the request once.
  - Multi-Data Center support: Configurable accounts and API domains (US `.com`, EU `.eu`, India `.in`, Australia `.com.au`, Canada `.ca`).
  - Zero leakage: Access tokens, client secrets, and refresh tokens are strictly omitted from client responses and server logs.

### FR-3: CRM Customer Resolution (`findCustomerByPhone`)
- **Requirement:** Look up callers across Zoho CRM modules in a single unified operation.
- **Execution Order:**
  1. Query `Contacts` by normalized phone and variations.
  2. If not found, query `Leads` by normalized phone and variations.
  3. If still not found, search criteria `((Phone:equals:...)or(Mobile:equals:...))`.
- **Output:** Returns a normalized `NormalizedCustomer` object with status `found: true | false`.

### FR-4: Natural Language Context & Dynamic Variables Builder
- **Requirement:** Transform raw CRM records into conversational background context for the AI voice agent.
- **Dynamic Variables Output Schema:**
  - `{{customer_found}}`: `"true"` | `"false"`
  - `{{first_name}}`: Caller first name (e.g. `"Bolu"`)
  - `{{last_name}}`: Caller last name (e.g. `"Adeyemi"`)
  - `{{customer_name}}`: Full name (e.g. `"Bolu Adeyemi"`)
  - `{{customer_phone}}`: E.164 phone number
  - `{{customer_email}}`: Email address
  - `{{company_name}}`: Organization name
  - `{{customer_type}}`: `"Existing Customer"` | `"Lead"` | `"New Caller"`
  - `{{lead_status}}`: Status if lead (e.g. `"Qualified"`)
  - `{{customer_interest}}`: Primary interest / package
  - `{{customer_context}}`: Concise natural-language paragraph summarizing CRM context
  - `{{charger_brand}}`, `{{ev_model}}`, `{{property_type}}`, `{{quoted_package}}`: Custom industry fields

### FR-5: Inbound Webhook Endpoint (`POST /api/retell/inbound`)
- **Requirement:** Accept inbound webhook from Retell AI when a phone call arrives.
- **SLA:** Total execution time < 800ms.
- **Security:** Verifies `x-retell-signature` using Retell SDK or HMAC-SHA256.
- **Resilience / Fallback:** If Zoho CRM is slow, unavailable, or times out, the endpoint catches the error and immediately returns a valid fallback response (`customer_found: "false"`, `crm_lookup_status: "unavailable"`) so the voice call connects without delay or dropping.

### FR-6: Post-Call Webhook Endpoint (`POST /api/retell/webhook`)
- **Requirement:** Receive Retell call lifecycle events (`call_analyzed`, `call_ended`).
- **Processing:**
  - Extracts call ID, agent ID, transcript, recording URL, duration, AI summary, user sentiment, call outcome, call intent, and custom extraction parameters.
  - Matches the caller against existing Contacts or Leads in Zoho CRM.
  - Updates the corresponding record using configurable field mappings.

### FR-7: Duplicate-Protected Lead Generation
- **Requirement:** When an unknown caller completes a conversation and provides contact information, create a Lead in Zoho CRM without creating duplicates.
- **Logic:**
  1. Searches Zoho CRM by phone.
  2. If email was collected, searches Zoho CRM by email.
  3. If match exists: Updates existing record with call summary and recording URL.
  4. If no match: Creates a new Lead record tagged with `Lead_Source: "AI Voice Agent"`.

### FR-8: Configurable Field Mapping Layer (`lib/zoho/field-mapping.ts`)
- **Requirement:** Decouple application logic from Zoho CRM custom field API names.
- **Configurability:** Allows administrators to map standard properties to their organization's custom Zoho API field names (e.g. `Last_Call_Summary`, `Customer_Sentiment`, `AI_Call_Recording_URL`, `Charger_Brand`, etc.).

### FR-9: System Health & Diagnostic Endpoints
- **`GET /api/health`**: Returns system operational status, environment, configuration validation, and token cache status.
- **`GET /api/zoho/test`**: Diagnostic endpoint to verify Zoho OAuth connectivity and execute live phone search tests (protected in production).
- **`POST /api/retell/test`**: Simulation endpoint to test the full inbound flow (phone normalization -> Zoho lookup -> dynamic variables) without making live calls.

---

## 5. Non-Functional Requirements (NFR)

| ID | Category | Requirement | Validation Method |
|---|---|---|---|
| **NFR-1** | **Performance** | Inbound webhook response duration must not exceed 800ms under standard network conditions. | Automated unit/integration tests with timeout budgets. |
| **NFR-2** | **Security** | All inbound requests must verify HMAC signatures. Secrets must never be committed to Git or output in logs. | Signature test suite and automated secret masking. |
| **NFR-3** | **Availability** | Serverless functions must handle cold starts gracefully and degrade gracefully on external API outages. | Fallback response tests on mocked Zoho failures. |
| **NFR-4** | **Statelessness** | Vercel functions must remain completely stateless with zero external database dependencies for v1. | Architectural review & zero database dependencies. |
| **NFR-5** | **Privacy & PII** | Phone numbers in application logs must be masked (e.g. `+234801****678`). | Structured logging unit tests. |

---

## 6. Data Contracts & Payload Specifications

### 6.1 Retell Inbound Request Payload (`POST /api/retell/inbound`)
```json
{
  "event": "call_inbound",
  "call_inbound": {
    "agent_id": "agent_receptionist_000",
    "agent_version": 1,
    "from_number": "+2348012345678",
    "to_number": "+2348098765432"
  }
}
```

### 6.2 Retell Inbound Response Payload (Known Contact)
```json
{
  "call_inbound": {
    "agent_id": "agent_receptionist_000",
    "dynamic_variables": {
      "customer_found": "true",
      "customer_name": "Bolu Adeyemi",
      "first_name": "Bolu",
      "last_name": "Adeyemi",
      "customer_phone": "+2348012345678",
      "customer_email": "bolu@example.com",
      "company_name": "Tech Solutions Ltd",
      "customer_type": "Existing Customer",
      "lead_status": "",
      "customer_interest": "Schneider EV Charger",
      "customer_context": "Bolu Adeyemi from Tech Solutions Ltd is an existing customer in our CRM. Known preferences: charger brand: Schneider, EV model: Tesla Model Y, property type: Villa.",
      "crm_module": "Contacts",
      "crm_record_id": "1000123456789",
      "charger_brand": "Schneider",
      "ev_model": "Tesla Model Y",
      "property_type": "Villa",
      "quoted_package": "15m Cable Run"
    }
  }
}
```

### 6.3 Retell Inbound Response Payload (Unknown Caller)
```json
{
  "call_inbound": {
    "agent_id": "agent_receptionist_000",
    "dynamic_variables": {
      "customer_found": "false",
      "customer_name": "",
      "first_name": "",
      "last_name": "",
      "customer_phone": "+2348012345678",
      "customer_email": "",
      "company_name": "",
      "customer_type": "New Caller",
      "lead_status": "",
      "customer_interest": "",
      "customer_context": "No existing CRM record was found for this caller. Treat them as a new caller.",
      "crm_module": "",
      "crm_record_id": ""
    }
  }
}
```

### 6.4 Retell Post-Call Analysis Webhook (`POST /api/retell/webhook`)
```json
{
  "event": "call_analyzed",
  "call": {
    "call_id": "call_987654321_abc",
    "agent_id": "agent_b2c_sales_002",
    "from_number": "+971509732525",
    "to_number": "+97126591002",
    "duration_ms": 115000,
    "recording_url": "https://recordings.retellai.com/call_987654321_abc.mp3",
    "call_analysis": {
      "call_summary": "Customer inquired about installing a 22kW Schneider charger for their Mercedes EQS in an Abu Dhabi villa. Advised 15m cable package range (AED 1,550). Customer requested site survey booking.",
      "user_sentiment": "Positive",
      "call_successful": true,
      "call_outcome": "Site Survey Requested",
      "call_intent": "Home Charger Installation",
      "custom_analysis_data": {
        "caller_name": "Tariq Mansoor",
        "email": "tariq.mansoor@example.ae",
        "charger_brand": "Schneider",
        "ev_make_model": "Mercedes EQS",
        "property_type": "Villa",
        "quoted_package": "15m Cable Run (AED 1,550)"
      }
    }
  }
}
```

---

## 7. Business Logic & Guardrails

1. **Zero Hallucination Policy:** Voice agents never fabricate pricing, timelines, or partner policies. Information not present in the CRM or KB is flagged for human callback.
2. **Financial Data Security:** Voice agents strictly refuse to collect credit card numbers, CVVs, PINs, or banking OTPs over the phone.
3. **Internal System Anonymity:** Internal platform names (Zoho, Gallabox, Zuper, AMPECO, OCPP, CRM) are never mentioned to callers.
4. **Brand Isolation:** CATEC and SHABIK services, BARQ delivery operations, and Plug 'n Go partner tariffs remain strictly isolated across their dedicated lines and KBs.
5. **No URLs Aloud:** Links, forms, and locations are delivered via WhatsApp / SMS to the caller's confirmed phone number.

---

## 8. Quality Assurance & Verification Plan

### 8.1 Automated Test Suite
- `tests/phone.test.ts`: Complete coverage of Nigerian (+234), UAE (+971), and International formats.
- `tests/context.test.ts`: Dynamic variables and natural language context generator across all caller permutations.
- `tests/zoho.test.ts`: OAuth token lifecycle, cache persistence, Contacts search, Leads fallback, and API error resilience.
- `tests/retell.test.ts`: HMAC signature verification, inbound webhook response schemas, and post-call CRM sync logic.

### 8.2 Deployment Acceptance Criteria
- [x] TypeScript build passes with zero type errors (`npm run build`).
- [x] All unit and integration test suites pass (`npm test`).
- [x] Environment validation verifies all critical credentials on boot.
- [x] Health check endpoint (`/api/health`) returns status `ok`.
- [x] Live diagnostic endpoint (`/api/zoho/test`) confirms token generation and record retrieval.
