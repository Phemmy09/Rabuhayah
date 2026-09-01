/**
 * Common application types and interfaces
 */

export interface NormalizedCustomer {
  found: boolean;
  module: 'Contacts' | 'Leads' | null;
  id: string | null;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string;
  email: string;
  company: string;
  leadStatus: string | null;
  customerType: string;
  notes?: string;
  // Extended custom properties if present in CRM
  chargerBrand?: string;
  evModel?: string;
  propertyType?: string;
  quotedPackage?: string;
  rawRecord?: Record<string, unknown>;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
}

export interface LogContext {
  requestId?: string;
  callId?: string;
  agentId?: string;
  phone?: string;
  module?: string;
  recordId?: string;
  durationMs?: number;
  [key: string]: unknown;
}
