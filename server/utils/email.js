import nodemailer from 'nodemailer';

let transporter;
function getTransporter() {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 465);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

export function emailConfigured() {
  return !!(process.env.SMTP_USER && process.env.SMTP_PASS);
}

// Sends the passwordless sign-in email through our own SMTP (bypasses Firebase's
// capped, spam-flagged sender). `link` is a ready-to-tap Firebase email-link URL.
export async function sendSignInEmail(to, link) {
  const from = `"One More Shot" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`;
  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0a0e1a">
    <div style="text-align:center;font-size:28px;font-weight:800;margin-bottom:4px">🏆 One More Shot</div>
    <div style="text-align:center;color:#667;margin-bottom:24px">World Cup 2026 Knockout Pool</div>
    <p>Tap the button to sign in and make your bracket picks:</p>
    <div style="text-align:center;margin:28px 0">
      <a href="${link}" style="background:#2dd4bf;color:#04241f;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:10px;display:inline-block">Sign in to One More Shot</a>
    </div>
    <p style="color:#667;font-size:13px">Or paste this link into your browser:</p>
    <p style="word-break:break-all;font-size:12px;color:#889">${link}</p>
    <p style="color:#889;font-size:12px;margin-top:24px">If you didn't request this, you can ignore this email.</p>
  </div>`;
  await getTransporter().sendMail({
    from,
    to,
    subject: '⚽ Your One More Shot sign-in link',
    text: `Sign in to One More Shot:\n\n${link}\n\nIf you didn't request this, ignore this email.`,
    html,
  });
}
