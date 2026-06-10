export const environment = {
  production: true,
  supabaseUrl: 'https://fbaqlceeijvdwcvdwrnz.supabase.co',
  supabaseKey: 'sb_publishable_ZXmXG5UuL3LdaywgnHqL_g_Ow7kXlGL',
  cashfreeMode: 'sandbox' as 'sandbox' | 'production',
  useEdgeFunctions: false,
  cashfreeApiStyle: 'direct' as 'proxy' | 'vercel' | 'edge' | 'direct',
  cashfreeAppId: 'TEST10980941ba3d9feaf9281b9b0e3814908901',
  cashfreeSecretKey: 'cfsk_ma_test_1415afd4dc2db21cb233f06db7dcd8e7_4831b5c7',
  // Booking Assistant (floating chat agent). When false, nothing new renders anywhere.
  enableBookingAgent: true,
  // Dev: the Angular dev-server proxy (/agent-proxy) forwards to Google Gemini's
  // OpenAI-compatible endpoint and injects the Authorization header from GEMINI_API_KEY
  // (.env). The key never reaches the browser. For production, use a server-side proxy.
  agentApiUrl: '/agent-proxy/chat/completions',
  agentModel: 'gemini-2.5-flash',
};
