import { NormalizedCustomer } from '../../types/common.js';
import { RetellDynamicVariables } from '../../types/retell.js';

/**
 * Builds a concise, natural-language context summary for Retell AI Voice Agent.
 * This is fed into {{customer_context}} dynamic variable.
 */
export function buildCustomerContext(customer: NormalizedCustomer): string {
  if (!customer.found) {
    return 'No existing CRM record was found for this caller. Treat them as a new caller.';
  }

  const parts: string[] = [];

  // Name and relationship
  const name = customer.fullName || customer.firstName || 'The caller';
  let relationship = 'an existing customer';
  if (customer.module === 'Leads' || customer.customerType === 'Lead') {
    relationship = 'a prospective lead';
  } else if (customer.customerType === 'Existing Customer') {
    relationship = 'an existing customer';
  } else if (customer.customerType) {
    const article = /^[aeiou]/i.test(customer.customerType) ? 'an' : 'a';
    relationship = `${article} ${customer.customerType.toLowerCase()}`;
  }

  if (customer.company) {
    parts.push(`${name} from ${customer.company} is ${relationship} in our CRM.`);
  } else {
    parts.push(`${name} is ${relationship} in our CRM.`);
  }

  // Lead status if applicable
  if (customer.leadStatus) {
    parts.push(`Current lead status is ${customer.leadStatus}.`);
  }

  // Custom client EV / installation context if available
  const contextDetails: string[] = [];
  if (customer.chargerBrand) {
    contextDetails.push(`charger brand: ${customer.chargerBrand}`);
  }
  if (customer.evModel) {
    contextDetails.push(`EV model: ${customer.evModel}`);
  }
  if (customer.propertyType) {
    contextDetails.push(`property type: ${customer.propertyType}`);
  }
  if (customer.quotedPackage) {
    contextDetails.push(`quoted package: ${customer.quotedPackage}`);
  }

  if (contextDetails.length > 0) {
    parts.push(`Known preferences: ${contextDetails.join(', ')}.`);
  }

  // Historical notes or last call summary
  if (customer.notes && customer.notes.trim()) {
    const cleanNotes = customer.notes.replace(/\s+/g, ' ').trim();
    const truncatedNotes = cleanNotes.length > 180 ? `${cleanNotes.slice(0, 177)}...` : cleanNotes;
    parts.push(`Previous call summary: ${truncatedNotes}`);
  }

  return parts.join(' ');
}

/**
 * Generates the complete Retell-compliant dynamic variables dictionary
 */
export function buildRetellDynamicVariables(
  customer: NormalizedCustomer,
  agentId?: string
): RetellDynamicVariables {
  const customerContext = buildCustomerContext(customer);

  // Derive interest / summary string
  const customerInterest =
    customer.quotedPackage ||
    customer.chargerBrand ||
    (customer.notes ? customer.notes.slice(0, 100) : '') ||
    '';

  const firstName = customer.firstName || 'there';
  const customerName = customer.fullName || (customer.firstName ? `${customer.firstName} ${customer.lastName || ''}`.trim() : '');

  return {
    customer_found: customer.found ? 'true' : 'false',
    customer_name: customerName,
    first_name: firstName,
    last_name: customer.lastName || '',
    customer_phone: customer.phone || '',
    customer_email: customer.email || '',
    company_name: customer.company || '',
    customer_type: customer.customerType || (customer.found ? 'Existing Customer' : 'New Caller'),
    lead_status: customer.leadStatus || '',
    customer_interest: customerInterest,
    customer_context: customerContext,
    crm_module: customer.module || '',
    crm_record_id: customer.id || '',
    charger_brand: customer.chargerBrand || '',
    ev_model: customer.evModel || '',
    property_type: customer.propertyType || '',
    quoted_package: customer.quotedPackage || '',
    agent_id: agentId || '',
  };
}
