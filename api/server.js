const express = require('express');
const rateLimit = require('express-rate-limit');
const { Resend } = require('resend');

const app = express();
const resend = new Resend(process.env.RESEND_API_KEY);

app.set('trust proxy', 1);
app.use(express.json({ limit: '20kb' }));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} from ${req.ip} ua="${req.get('user-agent')}"`);
  next();
});

const LIMITS = { name: 80, email: 120, subject: 120, message: 2000 };

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'För många försök. Försök igen om en stund.' }
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.post('/api/contact', contactLimiter, async (req, res) => {
  const { name, email, subject, message, website } = req.body;

  if (website) {
    return res.json({ success: true });
  }

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Namn, e-post och meddelande krävs.' });
  }

  for (const [field, max] of Object.entries(LIMITS)) {
    if (req.body[field] && String(req.body[field]).length > max) {
      return res.status(400).json({ error: `Fältet "${field}" är för långt.` });
    }
  }

  try {
    await resend.emails.send({
      from: 'Trygga Rum <kontakt@tryggarum.nu>',
      to: 'charlotte.orwin@tryggarum.nu',
      replyTo: email,
      subject: `Ny kontaktförfrågan: ${subject || 'Inget ämne'}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#5c7060;">Ny kontaktförfrågan från tryggarum.nu</h2>
          <p><strong>Namn:</strong> ${escapeHtml(name)}</p>
          <p><strong>E-post:</strong> ${escapeHtml(email)}</p>
          <p><strong>Ämne:</strong> ${escapeHtml(subject || '—')}</p>
          <hr style="border:none;border-top:1px solid #e0d8cc;margin:1.5rem 0;">
          <p><strong>Meddelande:</strong></p>
          <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
        </div>
      `
    });

    resend.emails.send({
      from: 'Trygga Rum <kontakt@tryggarum.nu>',
      to: email,
      subject: 'Tack för ditt meddelande',
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;line-height:1.6;color:#2c2c2c;">
          <h2 style="color:#5c7060;font-family:Georgia,serif;font-weight:400;">Tack för ditt meddelande, ${escapeHtml(name)}!</h2>
          <p>Jag har tagit emot din förfrågan och återkommer snarast.</p>
          <p>För referens, här är ditt meddelande:</p>
          <hr style="border:none;border-top:1px solid #e0d8cc;margin:1.2rem 0;">
          <p style="color:#6b6b6b;font-style:italic;">${escapeHtml(message).replace(/\n/g, '<br>')}</p>
          <hr style="border:none;border-top:1px solid #e0d8cc;margin:1.2rem 0;">
          <p style="font-size:0.9rem;color:#6b6b6b;">Varma hälsningar,<br>Charlotte Orwin<br>Trygga Rum – Gestaltterapi</p>
        </div>
      `
    }).catch((err) => console.error('Auto-reply failed:', err));

    res.json({ success: true });
  } catch (error) {
    console.error('Resend error:', error);
    res.status(500).json({ error: 'Kunde inte skicka meddelandet. Försök igen senare.' });
  }
});

app.listen(4000, () => {
  console.log('Kontakt API listening on port 4000');
});
