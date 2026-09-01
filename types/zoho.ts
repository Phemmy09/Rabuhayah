/**
 * Zoho CRM API Types and Interfaces (v6 REST API)
 */

export interface ZohoOAuthTokenResponse {
  access_token: string;
  api_domain: string;
  token_type: string;
  expires_in: number;
  error?: string;
  error_description?: string;
}

export interface CachedToken {
  token: string;
  expiresAt: number; // Unix timestamp in ms
}

export interface ZohoBaseRecord {
  id: string;
  Created_Time?: string;
  Modified_Time?: string;
  Created_By?: { id: string; name: string };
  Modified_By?: { id: string; name: string };
  Description?: string;
  [key: string]: unknown;
}

export interface ZohoContactRecord extends ZohoBaseRecord {
  First_Name?: string | null;
  Last_Name: string;
  Full_Name?: string;
  Email?: string | null;
  Phone?: string | null;
  Mobile?: string | null;
  Account_Name?: { id: string; name: string } | null;
  Title?: string | null;
  Department?: string | null;
  Lead_Source?: string | null;
}

export interface ZohoLeadRecord extends ZohoBaseRecord {
  First_Name?: string | null;
  Last_Name: string;
  Full_Name?: string;
  Email?: string | null;
  Phone?: string | null;
  Mobile?: string | null;
  Company?: string | null;
  Lead_Status?: string | null;
  Lead_Source?: string | null;
  Designation?: string | null;
  Industry?: string | null;
}

export interface ZohoSearchResponse<T = ZohoBaseRecord> {
  data?: T[];
  info?: {
    per_page: number;
    count: number;
    page: number;
    more_records: boolean;
  };
  status?: string;
  code?: string;
  message?: string;
}

export interface ZohoActionDetails {
  id?: string;
  Created_Time?: string;
  Modified_Time?: string;
  [key: string]: unknown;
}

export interface ZohoRecordResponseItem {
  code: string;
  details: ZohoActionDetails;
  message: string;
  status: 'success' | 'error';
}

export interface ZohoMutationResponse {
  data: ZohoRecordResponseItem[];
}
