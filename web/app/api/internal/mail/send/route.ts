import { Resend } from 'resend';
import { buildPasswordResetEmailHtml, buildVerificationEmailHtml } from '@/lib/email-templates';
import { BRAND } from '@/lib/brand';

type MailType = 'verification' | 'password-reset';

const SUBJECT_MAP: Record<MailType, string> = {
  verification: `Verify your ${BRAND.name} account`,
  'password-reset': `Reset your ${BRAND.name} password`,
};

const TEMPLATE_MAP: Record<MailType, (name: string, actionUrl: string) => string> = {
  verification: buildVerificationEmailHtml,
  'password-reset': buildPasswordResetEmailHtml,
};

const VALID_TYPES = new Set<string>(Object.keys(SUBJECT_MAP));

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

  const { type, toEmail, name, actionUrl } = body as Record<string, unknown>;

  if (!type || typeof type !== 'string' || !VALID_TYPES.has(type)) {
    return Response.json(
      { error: `Invalid or missing type. Must be one of: ${[...VALID_TYPES].join(', ')}` },
      { status: 400 },
    );
  }
  if (!toEmail || typeof toEmail !== 'string') {
    return Response.json({ error: 'Missing required field: toEmail' }, { status: 400 });
  }
  if (!name || typeof name !== 'string') {
    return Response.json({ error: 'Missing required field: name' }, { status: 400 });
  }
  if (!actionUrl || typeof actionUrl !== 'string') {
    return Response.json({ error: 'Missing required field: actionUrl' }, { status: 400 });
  }

  const mailType = type as MailType;
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: process.env.MAIL_FROM || BRAND.mailFrom,
    to: toEmail,
    subject: SUBJECT_MAP[mailType],
    html: TEMPLATE_MAP[mailType](name, actionUrl),
  });

  if (error) {
    console.error(`Resend error [${mailType}]:`, error);
    return Response.json({ error: 'Failed to send email' }, { status: 502 });
  }

  return Response.json({ success: true, id: data?.id }, { status: 200 });
}
