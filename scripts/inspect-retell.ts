import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

const apiKey = process.env.RETELL_API_KEY || 'key_c3b87488396a193b8dd4a2630066';

async function inspectRetell() {
  console.log('====================================================');
  console.log('RETELL AI LIVE CONFIGURATION AUDIT');
  console.log('====================================================');

  // 1. Phone numbers
  console.log('\n--- 1. PHONE NUMBERS AUDIT ---');
  const phoneRes = await fetch('https://api.retellai.com/list-phone-numbers', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const phones = await phoneRes.json();
  console.log(JSON.stringify(phones, null, 2));

  // 2. Agents list
  console.log('\n--- 2. AGENTS AUDIT ---');
  const agentsRes = await fetch('https://api.retellai.com/list-agents', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const agents = await agentsRes.json();

  if (Array.isArray(agents)) {
    for (const a of agents) {
      console.log(`\n=== AGENT: ${a.agent_name || 'Unnamed'} (${a.agent_id}) ===`);
      console.log(`- Webhook URL: ${a.webhook_url || 'NONE (MISSING!)'}`);
      console.log(`- Inbound Dynamic Variables Webhook URL: ${a.inbound_dynamic_variables_webhook_url || 'NONE'}`);
      console.log(`- Begin Message: ${a.begin_message || 'NONE'}`);
      console.log(`- Response Engine:`, JSON.stringify(a.response_engine));

      // If Retell LLM, inspect LLM details
      if (a.response_engine?.llm_id) {
        try {
          const llmRes = await fetch(`https://api.retellai.com/get-retell-llm/${a.response_engine.llm_id}`, {
            headers: { Authorization: `Bearer ${apiKey}` },
          });
          const llmData = await llmRes.json();
          console.log(`- LLM Model: ${llmData.model}`);
          console.log(`- LLM General Prompt preview: ${llmData.general_prompt?.slice(0, 200)}...`);
          console.log(`- LLM Begin Message: ${llmData.begin_message}`);
          console.log(`- LLM Tools:`, JSON.stringify(llmData.tools, null, 2));
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
