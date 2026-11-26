import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

import { handleVerificationRequest } from './handler.ts'

Deno.serve((request) =>
  handleVerificationRequest(request, {
    async prepare(token) {
      const url = Deno.env.get('SUPABASE_URL')
      const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      if (!url || !key || !Deno.env.get('RESEND_API_KEY') || !Deno.env.get('RESEND_FROM_EMAIL'))
        return null
      const client = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
      const { data, error } = await client.rpc('crm_prepare_quote_verification', {
        access_token: token,
      })
      return error ? null : data
    },
    async send(recipient, code) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: Deno.env.get('RESEND_FROM_EMAIL'),
          to: [recipient],
          subject: 'Código para aceptar el presupuesto',
          text: `Tu código de verificación es ${code}. Caduca en 10 minutos. Si no lo has solicitado, ignora este correo.`,
        }),
        signal: AbortSignal.timeout(10000),
      })
      return response.ok
    },
  }),
)
