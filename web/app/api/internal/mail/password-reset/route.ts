import { Resend } from 'resend';
import { buildPasswordResetEmailHtml } from '@/lib/email-templates';

export async function POST(request: Request) {
  const secret = request.headers.get('x-internal-mail-secret');
  if (!secret || secret !== process.env.INTERNAL_MAIL_SECRET) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { toEmail, name, resetUrl } = body as Record<string, unknown>;

  if (!toEmail || typeof toEmail !== 'string') {
    return Response.json({ error: 'Missing required field: toEmail' }, { status: 400 });
  }
  if (!name || typeof name !== 'string') {
    return Response.json({ error: 'Missing required field: name' }, { status: 400 });
  }
  if (!resetUrl || typeof resetUrl !== 'string') {
    return Response.json({ error: 'Missing required field: resetUrl' }, { status: 400 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: process.env.MAIL_FROM || 'onboarding@resend.dev',
    to: toEmail,
    subject: 'Reset your Clossette password',
    html: buildPasswordResetEmailHtml(name, resetUrl),
  });

  if (error) {
    console.error('Resend error:', error);
    return Response.json({ error: 'Failed to send email' }, { status: 502 });
  }

  return Response.json({ success: true, id: data?.id }, { status: 200 });
}
