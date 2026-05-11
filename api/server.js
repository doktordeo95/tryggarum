const express = require('express');
const { Resend } = require('resend');

const app = express();
const resend = new Resend(process.env.RESEND_API_KEY);

app.use(express.json());

app.post('/api/contact', async (req, res) => {
  const { name, email, subject, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Namn, e-post och meddelande krävs.' });
  }

  if (!email.includes('@')) {
    return res.status(400).json({ error: 'Ange en giltig e-postadress.' });
  }

  try {
    await resend.emails.send({
      from: 'Trygga Rum <kontakt@tryggarum.nu>',
      to: 'charlotte.orwin@tryggarum.nu',
      replyTo: email,
      subject: `Ny kontaktförfrågan: ${subject || 'Inget ämne'}`,
      html: [
        '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">',
        '<h2 style="color:#5c7060;">Ny kontaktförfrågan från tryggarum.nu</h2>',
        `<p><strong>Namn:</strong> ${escapeHtml(name)}</p>`,
        `<p><strong>E-post:</strong> ${escapeHtml(email)}</p>`,
        `<p><strong>Ämne:</strong> ${escapeHtml(subject || '—')}</p>`,
        '<hr style="border:none;border-top:1px solid #e0d8cc;margin:1.5rem 0;">',
        '<p><strong>Meddelande:</strong></p>',
        `<p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>`,
        '</div>'
      ].join('')
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Resend error:', error);
    res.status(500).json({ error: 'Kunde inte skicka meddelandet. Försök igen senare.' });
  }
});

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, function (m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    if (m === '"') return '&quot;';
    if (m === "'") return '&#39;';
    return m;
  });
}

app.listen(4000, () => {
  console.log('Kontakt API listening on port 4000');
});
