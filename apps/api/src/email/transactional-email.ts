import { fileURLToPath } from 'node:url';

const transactionalEmailLogoPath = fileURLToPath(
  new URL('../../../web/public/slotlyflow-logo-transparent.png', import.meta.url),
);

export const EMAIL_THEME = {
  font: "'Spline Sans', 'Segoe UI', Arial, sans-serif",
  canvas: '#F7F9F8',
  surface: '#FFFFFF',
  brandGreen: '#003B2D',
  lime: '#B7F34A',
  aqua: '#3ce6d0',
  violet: '#8b7cf6',
  coral: '#ff7a66',
  ink: '#111816',
  inkSecondary: '#66736F',
  inkTertiary: '#8B9692',
  border: '#E1E8E4'
} as const;

export type EmailFragmentVariant = 'verify-email' | 'password-reset';

export interface TransactionalEmailOptions {
  heading: string;
  supportingCopy: string;
  ctaLabel: string;
  ctaUrl: string;
  secondaryCopy: string[];
  footerCopy?: string;
  decorativeVariant: EmailFragmentVariant;
}

export function buildTransactionalEmailHtml(options: TransactionalEmailOptions): string {
  const { heading, supportingCopy, ctaLabel, ctaUrl, secondaryCopy, footerCopy, decorativeVariant } = options;

  let headerFragments = '';
  let footerFragments = '';

  if (decorativeVariant === 'verify-email') {
    headerFragments = `
      <td align="right" valign="top" width="48" style="line-height:0;font-size:0;">
        <table border="0" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
          <tr>
            <td width="24" height="24" style="line-height:0;font-size:0;"></td>
            <td width="24" height="24" style="line-height:0;font-size:0;"><img src="cid:fragment-lime" width="24" height="24" alt="" style="display:block;border:0;background-color:${EMAIL_THEME.lime};border-radius:24px 24px 0 0;" /></td>
          </tr>
          <tr>
            <td width="24" height="24" style="line-height:0;font-size:0;"><img src="cid:fragment-coral" width="24" height="24" alt="" style="display:block;border:0;background-color:${EMAIL_THEME.coral};border-radius:50%;" /></td>
            <td width="24" height="24" style="line-height:0;font-size:0;"><img src="cid:fragment-aqua" width="24" height="24" alt="" style="display:block;border:0;background-color:${EMAIL_THEME.brandGreen};" /></td>
          </tr>
        </table>
      </td>`;
    footerFragments = `
      <tr>
        <td align="left" valign="bottom" width="48" style="line-height:0;font-size:0;">
          <table border="0" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
            <tr>
              <td width="24" height="24" style="line-height:0;font-size:0;"><img src="cid:fragment-aqua" width="24" height="24" alt="" style="display:block;border:0;background-color:${EMAIL_THEME.aqua};border-radius:0 100% 0 0;" /></td>
              <td width="24" height="24" style="line-height:0;font-size:0;"><img src="cid:fragment-violet" width="24" height="24" alt="" style="display:block;border:0;background-color:${EMAIL_THEME.violet};border-radius:50%;" /></td>
            </tr>
            <tr>
              <td width="24" height="24" style="line-height:0;font-size:0;"><img src="cid:fragment-lime" width="24" height="24" alt="" style="display:block;border:0;background-color:${EMAIL_THEME.lime};" /></td>
              <td width="24" height="24" style="line-height:0;font-size:0;"><img src="cid:fragment-coral" width="24" height="24" alt="" style="display:block;border:0;background-color:${EMAIL_THEME.coral};border-radius:24px 24px 0 0;" /></td>
            </tr>
          </table>
        </td>
        <td align="right" valign="bottom" style="line-height:0;font-size:0;">
          <table border="0" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
            <tr>
              <td colspan="2" width="48" height="24" style="line-height:0;font-size:0;"><img src="cid:fragment-violet" width="48" height="24" alt="" style="display:block;border:0;background-color:${EMAIL_THEME.violet};border-radius:24px 24px 0 0;" /></td>
            </tr>
            <tr>
              <td width="24" height="24" style="line-height:0;font-size:0;"><img src="cid:fragment-aqua" width="24" height="24" alt="" style="display:block;border:0;background-color:${EMAIL_THEME.aqua};border-radius:50%;" /></td>
              <td width="24" height="24" style="line-height:0;font-size:0;"><img src="cid:fragment-lime" width="24" height="24" alt="" style="display:block;border:0;background-color:${EMAIL_THEME.lime};border-radius:0 100% 0 0;" /></td>
            </tr>
          </table>
        </td>
      </tr>`;
  } else if (decorativeVariant === 'password-reset') {
    headerFragments = `
      <td align="right" valign="top" width="48" style="line-height:0;font-size:0;">
        <table border="0" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
          <tr>
            <td colspan="2" width="48" height="48" style="line-height:0;font-size:0;"><img src="cid:fragment-violet" width="48" height="48" alt="" style="display:block;border:0;background-color:${EMAIL_THEME.violet};border-radius:0 0 0 100%;" /></td>
          </tr>
        </table>
      </td>`;
    footerFragments = `
      <tr>
        <td align="left" valign="bottom" width="48" style="line-height:0;font-size:0;">
          <table border="0" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
            <tr>
              <td width="24" height="24" style="line-height:0;font-size:0;"><img src="cid:fragment-lime" width="24" height="24" alt="" style="display:block;border:0;background-color:${EMAIL_THEME.lime};border-radius:50%;" /></td>
              <td width="24" height="24" style="line-height:0;font-size:0;"></td>
            </tr>
            <tr>
              <td colspan="2" width="48" height="24" style="line-height:0;font-size:0;"><img src="cid:fragment-aqua" width="48" height="24" alt="" style="display:block;border:0;background-color:${EMAIL_THEME.aqua};border-radius:0 0 24px 24px;" /></td>
            </tr>
          </table>
        </td>
        <td align="right" valign="bottom" style="line-height:0;font-size:0;">
          <table border="0" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
            <tr>
              <td width="24" height="24" style="line-height:0;font-size:0;"><img src="cid:fragment-coral" width="24" height="24" alt="" style="display:block;border:0;background-color:${EMAIL_THEME.coral};border-radius:50%;" /></td>
              <td rowspan="2" width="24" height="48" style="line-height:0;font-size:0;"><img src="cid:fragment-aqua" width="24" height="48" alt="" style="display:block;border:0;background-color:${EMAIL_THEME.brandGreen};border-radius:24px 0 0 24px;" /></td>
            </tr>
            <tr>
              <td width="24" height="24" style="line-height:0;font-size:0;"><img src="cid:fragment-lime" width="24" height="24" alt="" style="display:block;border:0;background-color:${EMAIL_THEME.lime};" /></td>
            </tr>
          </table>
        </td>
      </tr>`;
  }

  const secondaryCopyHtml = secondaryCopy
    .map((copy, index) => {
      const margin = index === secondaryCopy.length - 1 ? '0' : '0 0 12px';
      return `<p style="margin:${margin};color:${EMAIL_THEME.inkSecondary};font-size:13px;line-height:1.5">${copy}</p>`;
    })
    .join('');

  return [
    `<!doctype html><html><body style="margin:0;padding:0;background:${EMAIL_THEME.canvas};color:${EMAIL_THEME.ink};font-family:${EMAIL_THEME.font};-webkit-font-smoothing:antialiased">`,
    `<table width="100%" border="0" cellspacing="0" cellpadding="0" style="background:${EMAIL_THEME.canvas};">`,
    `<tr><td align="center" style="padding:40px 24px">`,
    
    `<!-- Main Card -->`,
    `<table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:560px;background:${EMAIL_THEME.surface};border:1px solid ${EMAIL_THEME.border};border-radius:10px;overflow:hidden">`,
    
    `<!-- Header Row (Logo + Top Right Fragment) -->`,
    `<tr>`,
    `<td align="left" valign="top" style="padding:48px 0 0 40px;">`,
    `<img src="cid:slotlyflow-logo" alt="SlotlyFlow" width="164" style="display:block;border:0" />`,
    `</td>`,
    headerFragments,
    `</tr>`,

    `<!-- Content Row -->`,
    `<tr><td colspan="2" style="padding:32px 40px 16px 40px">`,
    `<h1 style="margin:0 0 16px;color:${EMAIL_THEME.brandGreen};font-size:24px;font-weight:600;letter-spacing:-0.03em;line-height:1.2">${heading}</h1>`,
    `<p style="margin:0 0 32px;font-size:15px;line-height:1.6;color:${EMAIL_THEME.ink}">${supportingCopy}</p>`,
    
    `<!-- CTA -->`,
    `<table border="0" cellspacing="0" cellpadding="0" style="margin:0 0 40px">`,
    `<tr><td align="center" style="border-radius:8px;background:${EMAIL_THEME.lime}">`,
    `<a href="${ctaUrl}" style="display:inline-block;padding:14px 24px;color:${EMAIL_THEME.ink};font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;border:1px solid ${EMAIL_THEME.lime}">${ctaLabel}</a>`,
    `</td></tr></table>`,

    secondaryCopyHtml,
    `</td></tr>`,
    
    `<!-- Footer Row (Bottom Fragments) -->`,
    footerFragments,

    `</table>`,

    `<!-- Footer -->`,
    `<table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:560px;">`,
    `<tr>`,
    `<td align="center" style="padding:24px 0 0;">`,
    `<p style="margin:0;color:${EMAIL_THEME.inkTertiary};font-size:12px;text-align:center">${footerCopy || '&copy; SlotlyFlow'}</p>`,
    `</td>`,
    `</tr>`,
    `</table>`,

    `</td></tr></table>`,
    `</body></html>`,
  ].join('');
}

// Reusable standard attachments mapping
export function getTransactionalEmailAttachments() {
  return [
    {
      filename: 'slotlyflow-logo.png',
      path: transactionalEmailLogoPath,
      cid: 'slotlyflow-logo'
    },
    // TODO(Codex): Replace these 1x1 transparent placeholders with actual PNG fragments from the design team (or CDN URLs).
    {
      filename: 'fragment-aqua.png',
      content: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64'),
      cid: 'fragment-aqua'
    },
    {
      filename: 'fragment-lime.png',
      content: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64'),
      cid: 'fragment-lime'
    },
    {
      filename: 'fragment-coral.png',
      content: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64'),
      cid: 'fragment-coral'
    },
    {
      filename: 'fragment-violet.png',
      content: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64'),
      cid: 'fragment-violet'
    }
  ];
}
