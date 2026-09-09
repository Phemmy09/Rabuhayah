import dotenv from 'dotenv';
import Retell from 'retell-sdk';
import { buildRetellDynamicVariables } from '../lib/context/generator.js';
import { findCustomerByPhone } from '../lib/zoho/customer.js';

dotenv.config({ path: '.env.local' });
dotenv.config();

const apiKey = process.env.RETELL_API_KEY || 'key_c3b87488396a193b8dd4a2630066';
const client = new Retell({ apiKey });

const FROM_NUMBER = '+97126591017';
const TO_NUMBER = '+14245460129';
const AGENT_ID = 'agent_42eeb5d0bd58551aa744b7b003'; // Maryam Receptionist

async function makeCall() {
  console.log('====================================================');
  console.log(`📞 INITIATING OUTBOUND CALL TO: ${TO_NUMBER}`);
  console.log(`📡 FROM TRUNK / NUMBER: ${FROM_NUMBER}`);
  console.log('====================================================\n');

  // 1. Check Zoho CRM for this phone number
  console.log(`Searching Zoho CRM for ${TO_NUMBER}...`);
  let dynamicVariables: Record<string, string> = {
    customer_found: 'false',
    customer_name: 'Valued Customer',
    first_name: 'there',
    last_name: '',
    customer_phone: TO_NUMBER,
    customer_email: '',
    company_name: '',
    customer_type: 'Unknown',
    lead_status: '',
    customer_interest: '',
    customer_context: 'No previous CRM record found for this caller.',
  };

  try {
    const customer = await findCustomerByPhone(TO_NUMBER);
    if (customer && customer.found) {
      console.log(`✅ Customer found in Zoho CRM (${customer.module}): ${customer.fullName}`);
      const vars = buildRetellDynamicVariables(customer, AGENT_ID);
      dynamicVariables = vars as unknown as Record<string, string>;
    } else {
      console.log('ℹ️ No existing CRM record found in Zoho for this phone number. Using fallback dynamic variables.');
    }
  } catch (err: any) {
    console.warn('⚠️ Zoho CRM lookup failed or timed out:', err.message);
  }

  console.log('\nDynamic variables for call:');
  console.log(JSON.stringify(dynamicVariables, null, 2));

  // 2. Dispatch outbound call via Retell SDK
  console.log('\nDispatching call via Retell AI...');
  try {
    const callResponse = await client.call.createPhoneCall({
      from_number: FROM_NUMBER,
      to_number: TO_NUMBER,
      override_agent_id: AGENT_ID,
      retell_llm_dynamic_variables: dynamicVariables,
    });

    console.log('\n====================================================');
    console.log('🎉 CALL SUCCESSFULLY DISPATCHED!');
    console.log('====================================================');
    console.log(`Call ID:     ${callResponse.call_id}`);
    console.log(`Agent ID:    ${callResponse.agent_id}`);
    console.log(`Call Status: ${callResponse.call_status}`);
    console.log(`Call Type:   ${callResponse.call_type}`);
    console.log(`Start Time:  ${callResponse.start_timestamp ? new Date(callResponse.start_timestamp).toISOString() : 'Pending'}`);
    console.log('====================================================\n');

    return callResponse;
  } catch (error: any) {
    console.error('\n❌ FAILED TO DISPATCH OUTBOUND CALL:');
    if (error.status) console.error(`HTTP Status: ${error.status}`);
    if (error.message) console.error(`Message: ${error.message}`);
    if (error.error) console.error(`Details:`, error.error);
    throw error;
  }
}

makeCall().catch((e) => {
  console.error('Execution aborted:', e.message);
  process.exit(1);
});
