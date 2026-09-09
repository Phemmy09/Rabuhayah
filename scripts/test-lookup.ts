import dotenv from 'dotenv';
import { findCustomerByPhone } from '../lib/zoho/customer.js';
import { buildRetellDynamicVariables } from '../lib/context/generator.js';

dotenv.config({ path: '.env.local' });
dotenv.config();

async function testLookup() {
  const phone = '+14245460129';
  console.log(`Checking Zoho CRM for ${phone}...`);
  const customer = await findCustomerByPhone(phone);
  console.log('Customer result:', JSON.stringify(customer, null, 2));

  if (customer) {
    const vars = buildRetellDynamicVariables(customer, 'agent_42eeb5d0bd58551aa744b7b003');
    console.log('\nGenerated Retell Dynamic Variables:');
    console.log(JSON.stringify(vars, null, 2));
  }
}

testLookup().catch(console.error);
