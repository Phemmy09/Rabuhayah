/**
 * Configurable Zoho CRM Field Mapping Layer
 * 
 * Maps application / Retell AI data points to Zoho CRM API field names.
 * Modify these mappings to match the exact API names defined in your Zoho CRM Setup -> Customization -> Modules and Fields.
 */

export const ZOHO_FIELD_MAP = {
  // Standard fields
  firstName: 'First_Name',
  lastName: 'Last_Name',
  email: 'Email',
  phone: 'Phone',
  mobile: 'Mobile',
  company: 'Company',
  leadStatus: 'Lead_Status',
  leadSource: 'Lead_Source',
  description: 'Description',

  // Call Intelligence & Analysis fields
  lastCallSummary: 'Last_Call_Summary',
  callOutcome: 'Call_Outcome',
  sentiment: 'Customer_Sentiment',
  callIntent: 'Call_Intent',
  recordingUrl: 'AI_Call_Recording_URL',
  conversationId: 'AI_Conversation_ID',
  callDuration: 'Call_Duration_Seconds',
  lastCallDate: 'Last_Call_Date',

  // Client Voice Agent Specific Fields (CATEC / EV Installation / Support)
  chargerBrand: 'Charger_Brand',
  evModel: 'EV_Make_Model',
  propertyType: 'Property_Type',
  quotedPackage: 'Quoted_Package',
  cableRun: 'Cable_Run_Meters',
  areaLocation: 'Emirate_Area',
} as const;

export type ZohoFieldMap = typeof ZOHO_FIELD_MAP;

/**
 * Builds a payload for updating/creating a Zoho record using mapped fields
 */
export function buildZohoPayload(
  fields: Partial<{
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    mobile: string;
    company: string;
    leadStatus: string;
    leadSource: string;
    description: string;
    lastCallSummary: string;
    callOutcome: string;
    sentiment: string;
    callIntent: string;
    recordingUrl: string;
    conversationId: string;
    callDuration: number;
    lastCallDate: string;
    chargerBrand: string;
    evModel: string;
    propertyType: string;
    quotedPackage: string;
    cableRun: string;
    areaLocation: string;
    [key: string]: unknown;
  }>,
  includeCustomFields = true
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }

    const zohoKey = (ZOHO_FIELD_MAP as Record<string, string>)[key] || key;

    // Check if custom field or standard field
    if (includeCustomFields || isStandardZohoField(key)) {
      payload[zohoKey] = value;
    }
  }

  return payload;
}

function isStandardZohoField(key: string): boolean {
  return ['firstName', 'lastName', 'email', 'phone', 'mobile', 'company', 'leadStatus', 'leadSource', 'description'].includes(key);
}
