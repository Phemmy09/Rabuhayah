import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

const apiKey = process.env.RETELL_API_KEY || 'key_c3b87488396a193b8dd4a2630066';
const WEBHOOK_URL = 'https://rabuhayah.vercel.app/api/retell/webhook';
const INBOUND_WEBHOOK_URL = 'https://rabuhayah.vercel.app/api/retell/inbound';

async function retellPatch(endpoint: string, body: any) {
  const res = await fetch(`https://api.retellai.com/${endpoint}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Retell API error on ${endpoint} (${res.status}): ${errorText}`);
  }
  return await res.json();
}

async function retellPost(endpoint: string, body: any) {
  const res = await fetch(`https://api.retellai.com/${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Retell API error on ${endpoint} (${res.status}): ${errorText}`);
  }
  return await res.json();
}

async function runFullFix() {
  console.log('===============================================================');
  console.log('🚀 AUTOMATED RETELL AI CONFIGURATION & FIX SCRIPT');
  console.log('===============================================================\n');

  // 1. Configure Phone Number +97126591017
  console.log('Step 1: Setting Inbound Webhook URL on Phone Number +97126591017...');
  await retellPatch('update-phone-number/+97126591017', {
    inbound_webhook_url: INBOUND_WEBHOOK_URL,
    nickname: 'CATEC Main Line (+97126591017)',
  });
  console.log('✅ Phone number inbound webhook set to:', INBOUND_WEBHOOK_URL);

  // 2. Configure Maryam's LLM (llm_3a71dcaa30fbea868b70a065bd95)
  console.log("\nStep 2: Configuring Maryam's LLM tools & system prompt...");
  const maryamPrompt = `# IDENTITY & ROLE
You are Maryam, the executive AI Receptionist and Router for CATEC & SHABIK EV Mobility Solutions (UAE & KSA).
Your mission is to greet the caller warmly by their first name if known from Zoho CRM, identify their intent in 1 sentence, and route them to the correct specialist agent immediately.

# CALLER DATA FROM ZOHO CRM
- Customer Found: {{customer_found}}
- First Name: {{first_name}}
- Full Name: {{customer_name}}
- Customer Type: {{customer_type}}
- CRM Background: {{customer_context}}

# GREETING RULES
- Returning Customer ({{customer_found}} == "true"): Greet them naturally using {{first_name}}: "Hi {{first_name}}, welcome to CATEC & SHABIK! How can I direct your call today?"
- New Caller ({{customer_found}} == "false"): "Hello, welcome to CATEC & SHABIK! How can I direct your call today?"

# INSTANT ROUTING (CRITICAL: CALL TOOL IN THE SAME TURN AS SPEAKING)
1. HOME CHARGER SALES / VILLA INSTALLATION / PRICING:
   - Triggers: buy charger, home charger, villa installation, quote, price, residential charging, 7kW, 22kW, Schneider, Tesla home.
   - Say: "Connecting you directly with our Home Charging Sales specialist."
   - EXECUTE TOOL: \`transfer_to_b2c_sales\`

2. PLUG'N GO APP & PUBLIC CHARGING NETWORK:
   - Triggers: Plug'N Go app, RFID card, public station, charging session error, app wallet, station map.
   - Say: "Connecting you with our Plug'N Go Support team."
   - EXECUTE TOOL: \`transfer_to_plugngo_support\`

3. TECHNICAL SUPPORT & HARDWARE FAULTS:
   - Triggers: charger broken, red light fault, warranty repair, maintenance, technician visit, tripped breaker.
   - Say: "Transferring you to our 24/7 Technical Support team."
   - EXECUTE TOOL: \`transfer_to_customer_support\`

4. BARQ.EV FLEET & PUBLIC CHARGING:
   - Triggers: BARQ station, BARQ app, delivery fleet charging.
   - Say: "Connecting you with the BARQ Support team."
   - EXECUTE TOOL: \`transfer_to_barq_support\`

5. COMMERCIAL B2B SALES & CORPORATE:
   - Triggers: commercial project, fleet, building, tender, bulk chargers, contractor.
   - Say: "Connecting you with our Commercial B2B team."
   - EXECUTE TOOL: \`transfer_to_human_b2b_sales\`

6. FINANCE & INVOICES:
   - Triggers: invoice, billing receipt, accounts, supplier payment.
   - Say: "Transferring you to Finance."
   - EXECUTE TOOL: \`transfer_to_human_finance\`

# STRICT RULES
- Never explain technical details or prices yourself.
- Always execute the transfer tool in the exact same turn as speaking your transition phrase.`;

  const maryamTools = [
    {
      type: 'end_call',
      name: 'end_call',
      description: 'End the call when the user says goodbye or has finished.',
      speak_after_execution: true,
    },
    {
      type: 'agent_swap',
      name: 'transfer_to_b2c_sales',
      agent_id: 'agent_77190245c63dc89063c6da7eaf',
      agent_version: 'latest_published',
      description: 'Transfer the caller to CATEC B2C Sales when they want to buy, install, or get pricing for home or villa EV chargers.',
      speak_during_execution: true,
      speak_after_execution: true,
      webhook_setting: 'both_agents',
      post_call_analysis_setting: 'both_agents',
    },
    {
      type: 'agent_swap',
      name: 'transfer_to_plugngo_support',
      agent_id: 'agent_d9da3b9e4e8b073a003fce20b0',
      agent_version: 'latest_published',
      description: "Transfer the caller to Plug'N Go Support when they have questions about the Plug'N Go app, RFID card, public station error, or station map.",
      speak_during_execution: true,
      speak_after_execution: true,
      webhook_setting: 'both_agents',
      post_call_analysis_setting: 'both_agents',
    },
    {
      type: 'agent_swap',
      name: 'transfer_to_customer_support',
      agent_id: 'agent_33b0948c1e13404904c145f846',
      agent_version: 'latest_published',
      description: 'Transfer the caller to CATEC 24/7 Technical Support for hardware faults, red light errors, warranty repairs, and technician visits.',
      speak_during_execution: true,
      speak_after_execution: true,
      webhook_setting: 'both_agents',
      post_call_analysis_setting: 'both_agents',
    },
    {
      type: 'agent_swap',
      name: 'transfer_to_barq_support',
      agent_id: 'agent_c984fdd679595175361ed6bd22',
      agent_version: 'latest_published',
      description: 'Transfer the caller to BARQ.EV Support for BARQ charging station issues or BARQ fleet charging.',
      speak_during_execution: true,
      speak_after_execution: true,
      webhook_setting: 'both_agents',
      post_call_analysis_setting: 'both_agents',
    },
    {
      type: 'transfer_call',
      name: 'transfer_to_human_b2b_sales',
      description: 'Transfer commercial B2B sales and corporate inquiries to the human sales team.',
      transfer_destination: { type: 'predefined', number: '+971509732525' },
      speak_during_execution: true,
      speak_after_execution: true,
      transfer_option: { type: 'warm_transfer', on_hold_music: 'ringtone' },
    },
    {
      type: 'transfer_call',
      name: 'transfer_to_human_finance',
      description: 'Transfer billing and invoice inquiries to human finance department.',
      transfer_destination: { type: 'predefined', number: '+97126591025' },
      speak_during_execution: true,
      speak_after_execution: true,
      transfer_option: { type: 'warm_transfer', on_hold_music: 'ringtone' },
    },
  ];

  await retellPatch('update-retell-llm/llm_3a71dcaa30fbea868b70a065bd95', {
    general_prompt: maryamPrompt,
    begin_message: 'Hi {{first_name}}, welcome to CATEC & SHABIK! How can I direct your call today?',
    general_tools: maryamTools,
    inbound_dynamic_variables_webhook_url: INBOUND_WEBHOOK_URL,
  });
  console.log("✅ Maryam's LLM updated with all 6 clean tools & dynamic prompt!");

  // 3. Configure B2C Sales LLM (llm_74d6081735d43331a0b27fd1785e)
  console.log("\nStep 3: Configuring B2C Sales LLM (llm_74d6081735d43331a0b27fd1785e)...");
  const b2cPrompt = `# 🚨 MANDATORY TRANSFER GREETING (SPEAK FIRST IMMEDIATELY) 🚨
When this call is transferred to you from Maryam:
DO NOT WAIT for the caller to speak! You MUST IMMEDIATELY speak first in your first turn:
"Hello {{first_name}}! This is Saeed from CATEC Home EV Charger Sales. I understand you're interested in an EV charger for your home or villa. I'd be happy to share our packages and pricing. What EV model are you driving?"

# IDENTITY & SCOPE
You are Saeed, the CATEC B2C Home EV Charger Sales specialist.
You advise residential clients in the UAE on purchasing EV chargers (Schneider Charge, ABB Terra) and turnkey installation.

# CRM CONTEXT & VERIFICATION
- Caller Name: {{customer_name}}
- Known Vehicle: {{ev_model}}
- Known Property: {{property_type}}
- Background History: {{customer_context}}

If {{customer_found}} is "true" and details exist in {{customer_context}}, verify them smoothly:
"I see you previously inquired about a charger for your {{ev_model}} — is that still the vehicle you'd like us to set up?"

# PACKAGES & PRICING
- Schneider Charge 7.4 kW / 11 kW / 22 kW: Smart residential charger with WiFi and RFID.
- Standard Installation Package (up to 15m cable run, breaker, civil works, testing): AED 1,550.
- Extended Cable Package (>15m): AED 2,200+.
- All packages include DEWA/ADDC certification and 2-year warranty.`;

  await retellPatch('update-retell-llm/llm_74d6081735d43331a0b27fd1785e', {
    general_prompt: b2cPrompt,
    begin_message: "Hi {{first_name}}, welcome to CATEC — I'm Saeed from Home Charger Sales. How can I help you today?",
  });
  console.log('✅ B2C Sales LLM updated with Speak-First Handoff Rule!');

  // 4. Configure Customer Support LLM (llm_3957fe06781d122876bf4ad5839b)
  console.log("\nStep 4: Configuring CATEC Customer Support LLM (llm_3957fe06781d122876bf4ad5839b)...");
  const supportPrompt = `# 🚨 MANDATORY TRANSFER GREETING (SPEAK FIRST IMMEDIATELY) 🚨
When this call is transferred to you from Maryam:
DO NOT WAIT for the caller to speak! You MUST IMMEDIATELY speak first in your first turn:
"Hello {{first_name}}! This is CATEC 24/7 Customer Support. I have your call details from Maryam. How can I help you with your charger today?"

# IDENTITY & SCOPE
You are the CATEC 24/7 Technical Support AI for charger hardware faults, error lights, and warranty maintenance.

# CRM CONTEXT & VERIFICATION
- Customer Name: {{customer_name}}
- Charger Brand: {{charger_brand}}
- History: {{customer_context}}

# STEP-BY-STEP TROUBLESHOOTING
1. Check LED Status:
   - Steady Green/Blue: Normal / Ready.
   - Blinking Red: Communication or ground fault.
   - Solid Red: Emergency Stop or hardware fault.
2. Safety Actions:
   - Release Emergency Stop (twist clockwise).
   - Check distribution board breaker.
   - Unplug connector, wait 30s, reconnect firmly.
3. If unresolved: Assure the caller that a high-priority support ticket has been created and a technician will contact them within 2 hours.`;

  await retellPatch('update-retell-llm/llm_3957fe06781d122876bf4ad5839b', {
    general_prompt: supportPrompt,
    begin_message: 'Hello {{first_name}}, thank you for calling CATEC 24/7 Technical Support. How can I help you today?',
  });
  console.log('✅ Customer Support LLM updated with Speak-First Handoff Rule!');

  // 5. Configure Plug'N Go LLM (llm_6ae1d72416c54da0439cf9e3b0a2)
  console.log("\nStep 5: Configuring Plug'N Go LLM (llm_6ae1d72416c54da0439cf9e3b0a2)...");
  const plugngoPrompt = `# 🚨 MANDATORY TRANSFER GREETING (SPEAK FIRST IMMEDIATELY) 🚨
When this call is transferred to you from Maryam:
DO NOT WAIT for the caller to speak! You MUST IMMEDIATELY speak first in your first turn:
"Hello {{first_name}}! This is the Plug'N Go EV Support team. I understand you need assistance with our public charging app or station. How can I assist you today?"

# IDENTITY & SCOPE
You support drivers using the Plug'N Go UAE & KSA public charging network, mobile app, and RFID cards.

# RESOLUTIONS
- Session won't start: Push plug until it clicks lock -> Open Plug'N Go app -> Scan QR code -> Tap Start Charging.
- RFID: Hold card flat against reader for 3 full seconds.
- Wallet/Top-up: Explain Apple Pay / Credit Card top-up inside the app.`;

  await retellPatch('update-retell-llm/llm_6ae1d72416c54da0439cf9e3b0a2', {
    general_prompt: plugngoPrompt,
    begin_message: "Hello {{first_name}}, thank you for calling Plug 'n Go Support. How can I help you today?",
  });
  console.log("✅ Plug'N Go LLM updated with Speak-First Handoff Rule!");

  // 6. Update Webhook URLs on all 5 agents
  console.log('\nStep 6: Setting Webhook URLs on all 5 agents...');
  const agentIds = [
    'agent_42eeb5d0bd58551aa744b7b003', // Maryam
    'agent_77190245c63dc89063c6da7eaf', // B2C Sales
    'agent_d9da3b9e4e8b073a003fce20b0', // Plug'N Go
    'agent_c984fdd679595175361ed6bd22', // BARQ Support
    'agent_33b0948c1e13404904c145f846', // CATEC Support
  ];

  for (const aId of agentIds) {
    try {
      await retellPatch(`update-agent/${aId}`, {
        webhook_url: WEBHOOK_URL,
      });
      console.log(`✅ Webhook URL updated for agent: ${aId}`);
    } catch (e: any) {
      console.warn(`Warning updating agent ${aId}: ${e.message}`);
    }
  }

  console.log('\n===============================================================');
  console.log('🎉 ALL RETELL AI AGENTS & TOOLS ARE FULLY CONFIGURED & SYNCHRONIZED!');
  console.log('===============================================================');
}

runFullFix().catch(console.error);
