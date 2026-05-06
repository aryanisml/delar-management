export const environment = {
  production: true,
  supabaseUrl: 'https://fbaqlceeijvdwcvdwrnz.supabase.co',
  supabaseKey: 'sb_publishable_ZXmXG5UuL3LdaywgnHqL_g_Ow7kXlGL',
  cashfreeMode: 'production' as 'sandbox' | 'production',
  // Vercel sprint: API routes handle Cashfree. Swap cashfreeApiStyle to 'edge' once Supabase secrets are set.
  useEdgeFunctions: false,
  cashfreeApiStyle: 'vercel' as 'proxy' | 'vercel' | 'edge',
  cashfreeAppId: '',
  cashfreeSecretKey: '',
};
