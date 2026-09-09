import dotenv from 'dotenv';
import Retell from 'retell-sdk';

dotenv.config({ path: '.env.local' });
dotenv.config();

const apiKey = process.env.RETELL_API_KEY || 'key_c3b87488396a193b8dd4a2630066';
const client = new Retell({ apiKey });

async function inspectRetell() {
  console.log('====================================================');
  console.log('RETELL AI LIVE CONFIGURATION AUDIT (via Retell SDK)');
  console.log('====================================================');

  // 1. Phone numbers
  console.log('\n--- 1. PHONE NUMBERS AUDIT ---');
  const phones = await client.phoneNumber.list();
  console.log(JSON.stringify(phones, null, 2));

  // 2. Agents list
  console.log('\n--- 2. AGENTS AUDIT ---');
  const agents = await client.agent.list();

  if (Array.isArray(agents)) {
    for (const a of agents) {
      console.log(`\n=== AGENT: ${a.agent_name || 'Unnamed'} (${a.agent_id}) ===`);
      console.log(`- Webhook URL: ${a.webhook_url || 'NONE (MISSING!)'}`);
      console.log(`- Response Engine:`, JSON.stringify(a.response_engine));

      // If Retell LLM, inspect LLM details
      if (a.response_engine && 'llm_id' in a.response_engine && a.response_engine.llm_id) {
        try {
          const llmData = await client.llm.retrieve(a.response_engine.llm_id);
          console.log(`- LLM Model: ${llmData.model || 'default'}`);
          console.log(`- LLM General Prompt preview: ${llmData.general_prompt?.slice(0, 200)}...`);
          console.log(`- LLM Begin Message: ${llmData.begin_message}`);
          console.log(`- LLM Tools:`, JSON.stringify(llmData.general_tools, null, 2));
          console.log(`- Inbound Dynamic Variables Webhook: ${llmData.inbound_dynamic_variables_webhook_url}`);
        } catch (e: any) {
          console.log(`Could not get LLM details: ${e.message}`);
        }
      }
    }
  } else {
    console.log('Agents response:', agents);
  }
}

inspectRetell().catch(console.error);

