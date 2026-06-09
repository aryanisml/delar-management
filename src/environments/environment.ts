export const environment = {
  production: false,
  supabaseUrl: 'https://fbaqlceeijvdwcvdwrnz.supabase.co',
  supabaseKey: 'sb_publishable_ZXmXG5UuL3LdaywgnHqL_g_Ow7kXlGL',
  cashfreeMode: 'sandbox' as 'sandbox' | 'production',
  // Local dev: calls Cashfree via Angular dev-server proxy → swap to 'vercel' or 'edge' when ready
  useEdgeFunctions: false,
  cashfreeApiStyle: 'direct' as 'proxy' | 'vercel' | 'edge' | 'direct',
  cashfreeAppId: 'TEST10980941ba3d9feaf9281b9b0e3814908901',
  cashfreeSecretKey: 'cfsk_ma_test_1415afd4dc2db21cb233f06db7dcd8e7_4831b5c7',
  // Booking Assistant (floating chat agent). When false, nothing new renders anywhere.
  enableBookingAgent: true,
  // Server-side LLM proxy endpoint. The Groq key lives ONLY in api/agent-llm.js.
  agentApiUrl: '/api/agent-llm',
};
