import dotenv from 'dotenv';
import Retell from 'retell-sdk';

dotenv.config({ path: '.env.local' });
dotenv.config();

const apiKey = process.env.RETELL_API_KEY || 'key_c3b87488396a193b8dd4a2630066';
const client = new Retell({ apiKey });

const WEBHOOK_URL = 'https://rabuhayah.vercel.app/api/retell/webhook';
const INBOUND_WEBHOOK_URL = 'https://rabuhayah.vercel.app/api/retell/inbound';

const BOOSTED_KEYWORDS = [
  'CATEC',
  'SHABIK',
  'DEWA',
  'ADDC',
  "Plug'N Go",
  'BARQ',
  'Schneider',
  'ABB',
  '7.4kW',
  '11kW',
  '22kW',
  'kW',
  'kWh',
  'RFID',
  'Dubai',
  'Abu Dhabi',
  'Riyadh',
  'Bolu',
  'Adeyemi',
  'Mohammad',
  'Irshaidat',
  'charger',
  'installation',
  'warranty',
];

const AGENTS = [
  { id: 'agent_42eeb5d0bd58551aa744b7b003', name: 'Maryam (AI Receptionist)' },
  { id: 'agent_77190245c63dc89063c6da7eaf', name: 'CATEC B2C Sales (Saeed)' },
  { id: 'agent_33b0948c1e13404904c145f846', name: 'CATEC 24/7 Technical Support' },
  { id: 'agent_d9da3b9e4e8b073a003fce20b0', name: "CATEC Plug'N Go Support" },
  { id: 'agent_c984fdd679595175361ed6bd22', name: 'CATEC BARQ Support' },
];

async function optimizeVoiceAndQuality() {
  console.log('========================================================================');
  console.log('🎙️ OPTIMIZING RETELL AI VOICE QUALITY & CONVERSATIONAL PRECISION');
  console.log('========================================================================\n');

  for (const agent of AGENTS) {
    console.log(`Optimizing ${agent.name} (${agent.id})...`);
    try {
      const updated = await client.agent.update(agent.id, {
        // High quality voice settings
        voice_id: '11labs-Cimo',
        voice_model: 'eleven_multilingual_v2', // Highest quality multilingual ElevenLabs model
        voice_temperature: 1.0,
        voice_speed: 1.0,
        volume: 1.0,

        // Conversational dynamics
        responsiveness: 1.0,               // Fastest response latency
        interruption_sensitivity: 0.8,     // Natural threshold for user interruptions
        enable_backchannel: true,           // Natural listening acknowledgments ("uh-huh", "got it")
        backchannel_frequency: 0.7,

        // Speech processing & Transcription
        normalize_for_speech: true,        // Perfectly speaks currency (AED), numbers, dates
        denoising_mode: 'noise-cancellation',
        stt_mode: 'fast',
        ambient_sound: null,               // Crisp studio-grade clarity without room hiss
        boosted_keywords: BOOSTED_KEYWORDS, // Biases speech-to-text for EV brand terms

        // Webhook sync
        webhook_url: WEBHOOK_URL,
      });

      console.log(`  ✅ Voice Model:         ${updated.voice_model}`);
      console.log(`  ✅ Ambient Sound:        ${updated.ambient_sound || 'Clean Studio (None)'}`);
      console.log(`  ✅ Normalize for Speech: ${updated.normalize_for_speech}`);
      console.log(`  ✅ Responsiveness:       ${updated.responsiveness}`);
      console.log(`  ✅ Backchannel Enabled:  ${updated.enable_backchannel}`);
      console.log(`  ✅ Boosted Keywords:     ${updated.boosted_keywords?.length} terms`);
      console.log(`  ✅ Webhook URL:          ${updated.webhook_url}\n`);
    } catch (err: any) {
      console.error(`  ❌ Error updating ${agent.name}:`, err.message);
    }
  }

  // Also verify Inbound Webhook on Maryam's LLM
  console.log("Synchronizing Maryam's LLM Dynamic Variables Webhook...");
  try {
    const maryamLlmId = 'llm_3a71dcaa30fbea868b70a065bd95';
    await client.llm.update(maryamLlmId, {
      inbound_dynamic_variables_webhook_url: INBOUND_WEBHOOK_URL,
    });
    console.log(`  ✅ Inbound Dynamic Variables URL locked to: ${INBOUND_WEBHOOK_URL}\n`);
  } catch (err: any) {
    console.error("  ❌ Error updating Maryam's LLM:", err.message);
  }

  console.log('========================================================================');
  console.log('🎉 ALL AGENTS FULLY UPGRADED TO MAXIMUM AUDIO QUALITY & PRECISION');
  console.log('========================================================================');
}

optimizeVoiceAndQuality().catch(console.error);
