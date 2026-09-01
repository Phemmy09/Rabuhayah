/**
 * Retell AI Webhook and Dynamic Variables Types
 */

export interface RetellInboundCallPayload {
  agent_id?: string;
  agent_version?: number;
  from_number: string;
  to_number: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface RetellInboundWebhookRequest {
  event: 'call_inbound';
  call_inbound: RetellInboundCallPayload;
}

export interface RetellDynamicVariables {
  customer_found: 'true' | 'false';
  customer_name: string;
  first_name: string;
  last_name: string;
  customer_phone: string;
  customer_email: string;
  company_name: string;
  customer_type: string;
  lead_status: string;
  customer_interest: string;
  customer_context: string;
  crm_module?: 'Contacts' | 'Leads' | '';
  crm_record_id?: string;
  // Client specific voice variables
  charger_brand?: string;
  ev_model?: string;
  property_type?: string;
  quoted_package?: string;
  [key: string]: string | undefined;
}

export interface RetellInboundWebhookResponse {
  call_inbound: {
    agent_id?: string;
    dynamic_variables: RetellDynamicVariables;
  };
}

export interface RetellUtterance {
  role: 'agent' | 'user' | 'system';
  content: string;
  words?: Array<{ word: string; start: number; end: number }>;
}

export interface RetellCallAnalysis {
  call_summary?: string;
  user_sentiment?: 'Positive' | 'Neutral' | 'Negative' | string;
  call_successful?: boolean;
  in_voicemail?: boolean;
  custom_analysis_data?: Record<string, unknown>;
  call_outcome?: string;
  call_intent?: string;
  charger_brand?: string;
  ev_make_model?: string;
  property_type?: string;
  cable_run_m?: string;
  quoted_package?: string;
}

export interface RetellCallObject {
  call_id: string;
  agent_id: string;
  call_type?: 'inbound_phone_call' | 'outbound_phone_call' | 'web_call';
  call_status?: 'registered' | 'ongoing' | 'ended' | 'error';
  start_timestamp?: number;
  end_timestamp?: number;
  duration_ms?: number;
  from_number?: string;
  to_number?: string;
  transcript?: string;
  transcript_object?: RetellUtterance[];
  recording_url?: string;
  public_log_url?: string;
  disconnection_reason?: string;
  call_analysis?: RetellCallAnalysis;
  dynamic_variables?: Record<string, string>;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface RetellPostCallWebhookRequest {
  event: 'call_started' | 'call_ended' | 'call_analyzed';
  call: RetellCallObject;
}
