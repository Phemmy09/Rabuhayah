import dotenv from 'dotenv';
import Retell from 'retell-sdk';

dotenv.config({ path: '.env.local' });
dotenv.config();

const apiKey = process.env.RETELL_API_KEY || 'key_c3b87488396a193b8dd4a2630066';
const client = new Retell({ apiKey });

async function auditVoices() {
  const agents = await client.agent.list();
  console.log(`Found ${agents.length} agents in Retell account.\n`);

  for (const a of agents) {
    const fullAgent = await client.agent.retrieve(a.agent_id);
    console.log(`=======================================================`);
    console.log(`Agent: ${fullAgent.agent_name} (${fullAgent.agent_id})`);
    console.log(`Voice ID:              ${fullAgent.voice_id}`);
    console.log(`Voice Model:           ${(fullAgent as any).voice_model || 'default'}`);
    console.log(`Voice Temperature:     ${fullAgent.voice_temperature}`);
    console.log(`Voice Speed:           ${fullAgent.voice_speed}`);
    console.log(`Volume:                ${fullAgent.volume}`);
    console.log(`Responsiveness:        ${fullAgent.responsiveness}`);
    console.log(`Interruption Sens.:    ${fullAgent.interruption_sensitivity}`);
    console.log(`Ambient Sound:         ${fullAgent.ambient_sound}`);
    console.log(`Ambient Sound Vol:     ${fullAgent.ambient_sound_volume}`);
    console.log(`Backchannel:           ${fullAgent.enable_backchannel}`);
    console.log(`Language:              ${fullAgent.language}`);
    console.log(`Webhook URL:           ${fullAgent.webhook_url}`);
    console.log(`Response Engine:       ${JSON.stringify(fullAgent.response_engine)}`);

    if (fullAgent.response_engine && 'llm_id' in fullAgent.response_engine) {
      const llm = await client.llm.retrieve((fullAgent.response_engine as any).llm_id);
      console.log(`LLM Model:             ${llm.model}`);
      console.log(`LLM Begin Message:     ${llm.begin_message}`);
      console.log(`LLM Tools count:       ${llm.general_tools?.length || 0}`);
      console.log(`Inbound Dynamic URL:   ${llm.inbound_dynamic_variables_webhook_url}`);
    }
  }
}

auditVoices().catch(console.error);
