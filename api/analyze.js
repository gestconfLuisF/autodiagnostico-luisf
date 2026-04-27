const https = require('https');

// Función auxiliar para hacer peticiones HTTPS
function httpsPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      path,
      method: 'POST',
      headers: { ...headers, 'Content-Length': Buffer.byteLength(body) }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { resolve(data); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(200).json({ status: 'API funcionando' });

  try {
    const { empresa, responsable, cargo, email, whatsapp, tipo, global, scores, respuestas } = req.body;

    // ── 1. GENERAR ANÁLISIS IA ──────────────────────────────────────────────
    const prompt = `Eres el Ing. Luis Fernando Londoño, experto en Excelencia Operacional para la industria de la confección con más de 30 años de experiencia y autor del libro "Patrones Velados, Problemas Revelados".
Una empresa completó el autodiagnóstico:
- Empresa: ${empresa}
- Tipología: ${tipo}
- Puntaje global: ${global} de 5.0
- Ingeniería - Producción: ${scores[0]}
- Calidad: ${scores[1]}
- Costos: ${scores[2]}
- RRHH: ${scores[3]}
Escala: mayor o igual a 4.0 Consistente, mayor o igual a 3.0 En desarrollo, menor a 3.0 Crítico
Genera un análisis en español con estas secciones:
1. LECTURA GENERAL (2-3 oraciones)
2. ÁREA MÁS CRÍTICA (específico para confección)
3. RECOMENDACIONES POR ÁREA (2 acciones concretas por área)
4. HOJA DE RUTA 3 MESES
5. PRÓXIMO PASO (invitar a contactar al Ing. Luis Fernando Londoño)
Máximo 900 palabras. Asegúrate de completar todas las secciones sin cortar ninguna.`;

    const aiBody = JSON.stringify({
      model: 'claude-opus-4-7',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    });

    const aiResult = await httpsPost(
      'api.anthropic.com',
      '/v1/messages',
      {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      aiBody
    );

    const analysisText = aiResult.content?.[0]?.text || 'No se pudo obtener respuesta.';

    // ── 2. ENVIAR CORREO CON RESEND ─────────────────────────────────────────
    // Construir tabla HTML de las 100 respuestas
    const tablasHTML = (() => {
      if (!respuestas || !respuestas.length) return '<p>No se recibieron respuestas.</p>';
      let html = '';
      let areaActual = '', pilarActual = '';
      respuestas.forEach((r, i) => {
        if (r.area !== areaActual) {
          if (areaActual) html += '</table><br>';
          areaActual = r.area;
          pilarActual = '';
          html += `<h2 style="color:#1D9E75;border-bottom:2px solid #1D9E75;padding-bottom:4px;">${r.area}</h2>`;
          html += `<table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
            <tr style="background:#1D9E75;color:white;">
              <th style="padding:8px;text-align:left;width:50%;">Pregunta</th>
              <th style="padding:8px;text-align:center;width:15%;">Pilar</th>
              <th style="padding:8px;text-align:center;width:15%;">Respuesta</th>
              <th style="padding:8px;text-align:center;width:20%;">Puntaje</th>
            </tr>`;
        }
        const bg = i % 2 === 0 ? '#f9f9f7' : '#ffffff';
        html += `<tr style="background:${bg};">
          <td style="padding:7px 8px;border-bottom:1px solid #eee;font-size:13px;">${r.pregunta}</td>
          <td style="padding:7px 8px;border-bottom:1px solid #eee;text-align:center;font-size:12px;color:#666;">${r.pilar}</td>
          <td style="padding:7px 8px;border-bottom:1px solid #eee;text-align:center;font-weight:700;">${r.respuesta}</td>
          <td style="padding:7px 8px;border-bottom:1px solid #eee;text-align:center;">${r.puntaje}</td>
        </tr>`;
      });
      html += '</table>';
      return html;
    })();

    const scoreLabels = ['Ingeniería - Producción','Calidad','Costos','RRHH'];
    const resumenScores = scores.map((sc, i) => `<tr>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;">${scoreLabels[i]}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:center;font-weight:700;">${sc}</td>
    </tr>`).join('');

    const emailHTML = `
<!DOCTYPE html><html lang="es"><body style="font-family:Arial,sans-serif;max-width:800px;margin:0 auto;color:#1a1a1a;">
<div style="background:#1D9E75;padding:24px;border-radius:8px 8px 0 0;">
  <h1 style="color:white;margin:0;font-size:22px;">Nuevo Autodiagnóstico Completado</h1>
  <p style="color:#E1F5EE;margin:4px 0 0;">GESTCONF · Maestría en Confección</p>
</div>
<div style="background:#f9f9f7;padding:20px;border:1px solid #e5e5e5;">

  <h2 style="color:#1D9E75;">Datos del participante</h2>
  <table style="width:100%;border-collapse:collapse;">
    <tr><td style="padding:6px 10px;border-bottom:1px solid #eee;width:35%;color:#666;">Empresa</td><td style="padding:6px 10px;border-bottom:1px solid #eee;font-weight:600;">${empresa}</td></tr>
    <tr><td style="padding:6px 10px;border-bottom:1px solid #eee;color:#666;">Responsable</td><td style="padding:6px 10px;border-bottom:1px solid #eee;">${responsable}</td></tr>
    <tr><td style="padding:6px 10px;border-bottom:1px solid #eee;color:#666;">Cargo</td><td style="padding:6px 10px;border-bottom:1px solid #eee;">${cargo}</td></tr>
    <tr><td style="padding:6px 10px;border-bottom:1px solid #eee;color:#666;">Correo</td><td style="padding:6px 10px;border-bottom:1px solid #eee;"><a href="mailto:${email}">${email}</a></td></tr>
    <tr><td style="padding:6px 10px;border-bottom:1px solid #eee;color:#666;">WhatsApp</td><td style="padding:6px 10px;border-bottom:1px solid #eee;"><a href="https://wa.me/${whatsapp}">${whatsapp}</a></td></tr>
    <tr><td style="padding:6px 10px;color:#666;">Tipología</td><td style="padding:6px 10px;">${tipo}</td></tr>
  </table>

  <h2 style="color:#1D9E75;margin-top:24px;">Puntajes por área</h2>
  <table style="width:100%;border-collapse:collapse;">
    <tr style="background:#1D9E75;color:white;">
      <th style="padding:8px 10px;text-align:left;">Área</th>
      <th style="padding:8px 10px;text-align:center;">Puntaje (sobre 5.0)</th>
    </tr>
    <tr style="background:#E1F5EE;"><td style="padding:6px 10px;font-weight:700;">GLOBAL</td><td style="padding:6px 10px;text-align:center;font-weight:700;font-size:18px;">${global}</td></tr>
    ${resumenScores}
  </table>

  <h2 style="color:#1D9E75;margin-top:24px;">Análisis IA generado</h2>
  <div style="background:white;padding:16px;border-radius:8px;border:1px solid #e5e5e5;white-space:pre-wrap;font-size:14px;line-height:1.7;">${analysisText}</div>

  <h2 style="color:#1D9E75;margin-top:24px;">Respuestas a las 100 preguntas</h2>
  <p style="font-size:12px;color:#888;">A=No se hace (0pts) · B=Se hace parcialmente (3pts) · C=Se hace bien, se mide y se usa (5pts) · D=No aplica</p>
  ${tablasHTML}

</div>
<div style="background:#1a1a1a;padding:16px;border-radius:0 0 8px 8px;text-align:center;">
  <p style="color:#888;font-size:12px;margin:0;">GESTCONF · Ing. Luis Fernando Londoño · gerencia@luisf.co</p>
</div>
</body></html>`;

    const emailBody = JSON.stringify({
      from: 'Autodiagnostico GESTCONF <autodiagnostico@luisf.co>',
      to: ['gerencia@luisf.co'],
      subject: `Nuevo diagnóstico: ${empresa} — Puntaje global ${global}`,
      html: emailHTML
    });

    // Llamada a Resend (no bloqueamos la respuesta si falla)
    httpsPost(
      'api.resend.com',
      '/emails',
      {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
      },
      emailBody
    ).catch(err => console.error('Error enviando correo:', err));

    // ── 3. RESPONDER AL FRONTEND ────────────────────────────────────────────
    return res.status(200).json({ analysis: analysisText });

  } catch (error) {
    return res.status(500).json({ analysis: 'Error: ' + error.message });
  }
};
