import { BRAND } from '@/lib/brand';

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

interface EmailTemplateOptions {
  title: string;
  greeting: string;
  bodyText: string;
  actionUrl: string;
  actionText: string;
  footnote?: string;
}

function buildEmailHtml(options: EmailTemplateOptions): string {
  const { title, greeting, bodyText, actionUrl, actionText, footnote } = options;
  const footnoteBlock = footnote
    ? `<p style="margin:24px 0 0;font-size:13px;color:#78716c;">${escapeHtml(footnote)}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#fdf8f6;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="560" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
          <!-- Header -->
          <tr>
            <td style="background:#7a2e3a;padding:32px 40px;text-align:center;">
              <span style="font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">${BRAND.name}</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 16px;font-size:16px;color:#292524;font-weight:600;">${greeting}</p>
              <p style="margin:0 0 32px;font-size:15px;line-height:1.6;color:#57534e;">${escapeHtml(bodyText)}</p>
              <!-- CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:10px;background:#7a2e3a;">
                    <a href="${actionUrl}"
                       style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">
                      ${escapeHtml(actionText)}
                    </a>
                  </td>
                </tr>
              </table>
              ${footnoteBlock}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#fdf8f6;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#a8a29e;">
                &copy; 2026 ${BRAND.name}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildPasswordResetEmailHtml(name: string, resetUrl: string): string {
  return buildEmailHtml({
    title: `Reset your ${BRAND.name} password`,
    greeting: `Hi ${escapeHtml(name)},`,
    bodyText: 'We received a request to reset your password. Click the button below to choose a new one.',
    actionUrl: resetUrl,
    actionText: 'Reset Password',
    footnote: 'This link expires in 1 hour. If you did not request a password reset, you can safely ignore this email.',
  });
}

export function buildVerificationEmailHtml(name: string, verifyUrl: string): string {
  return buildEmailHtml({
    title: `Verify your ${BRAND.name} account`,
    greeting: `Hi ${escapeHtml(name)},`,
    bodyText: `Thanks for joining ${BRAND.name}! Please verify your email address to complete your registration.`,
    actionUrl: verifyUrl,
    actionText: 'Verify Email Address',
  });
}
