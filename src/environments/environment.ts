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
  // Both dev and prod call /api/agent-llm. Dev: proxy.conf.js forwards it to Gemini.
  // Prod: the Vercel function api/agent-llm.js forwards it to Gemini. GEMINI_API_KEY is
  // injected server-side in both (set it in Vercel env vars) — never in the browser bundle.
  agentApiUrl: '/api/agent-llm',
  agentModel: 'gemini-2.5-flash',
};
