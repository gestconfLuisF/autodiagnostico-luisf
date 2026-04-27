const https = require('https');

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

// Convierte Markdown a texto plano limpio para el correo
function mdToPlain(text) {
  return text
    .replace(/#{1,3} /g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/^- /gm, '• ')
    .replace(/---/g, '─────────────────────')
    .trim();
}

function semLabel(v) {
  const n = parseFloat(v);
  if (n >= 4) return { emoji: '🟢', label: 'Consistente' };
  if (n >= 3) return { emoji: '🟡', label: 'En desarrollo' };
  return { emoji: '🔴', label: 'Critico' };
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
    const prompt = `Eres el Ing. Luis Fernando Londono, experto en Excelencia Operacional para la industria de la confeccion con mas de 30 anos de experiencia y autor del libro "Patrones Velados, Problemas Revelados".
Una empresa completo el autodiagnostico:
- Empresa: ${empresa}
- Tipologia: ${tipo}
- Puntaje global: ${global} de 5.0
- Ingenieria - Produccion: ${scores[0]}
- Calidad: ${scores[1]}
- Costos: ${scores[2]}
- RRHH: ${scores[3]}
Escala: mayor o igual a 4.0 Consistente, mayor o igual a 3.0 En desarrollo, menor a 3.0 Critico
Genera un analisis en espanol con estas secciones:
1. LECTURA GENERAL (2-3 oraciones)
2. AREA MAS CRITICA (especifico para confeccion)
3. RECOMENDACIONES POR AREA (2 acciones concretas por area)
4. HOJA DE RUTA 3 MESES
5. PROXIMO PASO (invitar a contactar al Ing. Luis Fernando Londono)
Maximo 900 palabras. Es OBLIGATORIO completar las 5 secciones sin cortar ninguna. No uses markdown, escribe en texto plano con numeracion y viñetas simples.`;

    const aiBody = JSON.stringify({
      model: 'claude-opus-4-7',
      max_tokens: 2500,
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
    const analysisPlain = mdToPlain(analysisText);

    // ── 2. CONSTRUIR CORREO ─────────────────────────────────────────────────
    const areaNames = ['Ingenieria - Produccion', 'Calidad', 'Costos', 'RRHH'];
    const globalSem = semLabel(global);

    // Tabla semaforo resumen
    const semaforoRows = scores.map((sc, i) => {
      const s = semLabel(sc);
      return `<tr style="border-bottom:1px solid #eee;">
        <td style="padding:10px 12px;font-size:14px;">${areaNames[i]}</td>
        <td style="padding:10px 12px;text-align:center;font-size:20px;">${s.emoji}</td>
        <td style="padding:10px 12px;text-align:center;font-weight:700;font-size:16px;">${sc}</td>
        <td style="padding:10px 12px;font-size:13px;color:#666;">${s.label}</td>
      </tr>`;
    }).join('');

    // Tabla 100 respuestas
    const tablasHTML = (() => {
      if (!respuestas || !respuestas.length) return '<p>No se recibieron respuestas.</p>';
      let html = '';
      let areaActual = '';
      respuestas.forEach((r, i) => {
        if (r.area !== areaActual) {
          if (areaActual) html += '</table><br>';
          areaActual = r.area;
          html += '<h3 style="color:#1D9E75;border-bottom:2px solid #1D9E75;padding-bottom:4px;margin-top:20px;">' + r.area + '</h3>';
          html += '<table style="width:100%;border-collapse:collapse;font-size:13px;">'
            + '<tr style="background:#1D9E75;color:white;">'
            + '<th style="padding:8px;text-align:left;width:55%;">Pregunta</th>'
            + '<th style="padding:8px;text-align:center;width:15%;">Pilar</th>'
            + '<th style="padding:8px;text-align:center;width:10%;">Resp.</th>'
            + '<th style="padding:8px;text-align:center;width:20%;">Puntaje</th>'
            + '</tr>';
        }
        const bg = i % 2 === 0 ? '#f9f9f7' : '#ffffff';
        html += '<tr style="background:' + bg + ';">'
          + '<td style="padding:7px 8px;border-bottom:1px solid #eee;">' + r.pregunta + '</td>'
          + '<td style="padding:7px 8px;border-bottom:1px solid #eee;text-align:center;color:#666;">' + r.pilar + '</td>'
          + '<td style="padding:7px 8px;border-bottom:1px solid #eee;text-align:center;font-weight:700;">' + r.respuesta + '</td>'
          + '<td style="padding:7px 8px;border-bottom:1px solid #eee;text-align:center;">' + r.puntaje + '</td>'
          + '</tr>';
      });
      html += '</table>';
      return html;
    })();

    const emailHTML = '<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:820px;margin:0 auto;color:#1a1a1a;">'

      // Header
      + '<div style="background:#1D9E75;padding:24px;border-radius:8px 8px 0 0;">'
      + '<h1 style="color:white;margin:0;font-size:22px;">Nuevo Autodiagnostico Completado</h1>'
      + '<p style="color:#E1F5EE;margin:6px 0 0;font-size:14px;">GESTCONF - Maestria en Confeccion</p>'
      + '</div>'

      + '<div style="background:#f9f9f7;padding:24px;border:1px solid #e5e5e5;">'

      // Datos participante
      + '<h2 style="color:#1D9E75;margin-top:0;">Datos del participante</h2>'
      + '<table style="width:100%;border-collapse:collapse;">'
      + '<tr><td style="padding:7px 10px;border-bottom:1px solid #eee;color:#666;width:30%;">Empresa</td><td style="padding:7px 10px;border-bottom:1px solid #eee;font-weight:700;">' + empresa + '</td></tr>'
      + '<tr><td style="padding:7px 10px;border-bottom:1px solid #eee;color:#666;">Responsable</td><td style="padding:7px 10px;border-bottom:1px solid #eee;">' + responsable + '</td></tr>'
      + '<tr><td style="padding:7px 10px;border-bottom:1px solid #eee;color:#666;">Cargo</td><td style="padding:7px 10px;border-bottom:1px solid #eee;">' + cargo + '</td></tr>'
      + '<tr><td style="padding:7px 10px;border-bottom:1px solid #eee;color:#666;">Correo</td><td style="padding:7px 10px;border-bottom:1px solid #eee;"><a href="mailto:' + email + '">' + email + '</a></td></tr>'
      + '<tr><td style="padding:7px 10px;border-bottom:1px solid #eee;color:#666;">WhatsApp</td><td style="padding:7px 10px;border-bottom:1px solid #eee;">' + whatsapp + '</td></tr>'
      + '<tr><td style="padding:7px 10px;color:#666;">Tipologia</td><td style="padding:7px 10px;">' + tipo + '</td></tr>'
      + '</table>'

      // Semaforo resumen
      + '<h2 style="color:#1D9E75;margin-top:28px;">Resumen de resultados</h2>'
      + '<table style="width:100%;border-collapse:collapse;border:1px solid #e5e5e5;border-radius:8px;overflow:hidden;">'
      + '<tr style="background:#1D9E75;color:white;">'
      + '<th style="padding:10px 12px;text-align:left;">Area</th>'
      + '<th style="padding:10px 12px;text-align:center;">Semaforo</th>'
      + '<th style="padding:10px 12px;text-align:center;">Puntaje</th>'
      + '<th style="padding:10px 12px;text-align:left;">Estado</th>'
      + '</tr>'
      + '<tr style="background:#E1F5EE;border-bottom:1px solid #eee;">'
      + '<td style="padding:10px 12px;font-weight:700;">GLOBAL</td>'
      + '<td style="padding:10px 12px;text-align:center;font-size:22px;">' + globalSem.emoji + '</td>'
      + '<td style="padding:10px 12px;text-align:center;font-weight:700;font-size:20px;">' + global + '</td>'
      + '<td style="padding:10px 12px;font-weight:600;">' + globalSem.label + '</td>'
      + '</tr>'
      + semaforoRows
      + '</table>'

      // Análisis IA en texto plano
      + '<h2 style="color:#1D9E75;margin-top:28px;">Analisis IA generado</h2>'
      + '<div style="background:white;padding:16px;border-radius:8px;border:1px solid #e5e5e5;font-size:14px;line-height:1.8;white-space:pre-wrap;">' + analysisPlain + '</div>'

      // 100 respuestas
      + '<h2 style="color:#1D9E75;margin-top:28px;">Respuestas a las 100 preguntas</h2>'
      + '<p style="font-size:12px;color:#888;">A = No se hace (0 pts) &nbsp;|&nbsp; B = Se hace parcialmente (3 pts) &nbsp;|&nbsp; C = Se hace bien, se mide y se usa (5 pts) &nbsp;|&nbsp; D = No aplica</p>'
      + tablasHTML

      + '</div>'

      // Footer
      + '<div style="background:#1a1a1a;padding:16px;border-radius:0 0 8px 8px;text-align:center;">'
      + '<p style="color:#888;font-size:12px;margin:0;">GESTCONF &nbsp;·&nbsp; Ing. Luis Fernando Londono &nbsp;·&nbsp; gerencia@luisf.co</p>'
      + '</div>'

      + '</body></html>';

    const emailPayload = JSON.stringify({
      from: 'Autodiagnostico GESTCONF <autodiagnostico@luisf.co>',
      to: ['gerencia@luisf.co'],
      subject: 'Nuevo diagnostico: ' + empresa + ' - Puntaje global ' + global,
      html: emailHTML
    });

    try {
      const resendResult = await httpsPost(
        'api.resend.com',
        '/emails',
        {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + process.env.RESEND_API_KEY
        },
        emailPayload
      );
      console.log('Resend resultado:', JSON.stringify(resendResult));
    } catch(emailErr) {
      console.error('Error Resend:', emailErr.message);
    }

    // ── 3. RESPONDER AL FRONTEND ────────────────────────────────────────────
    return res.status(200).json({ analysis: analysisText });

  } catch (error) {
    return res.status(500).json({ analysis: 'Error: ' + error.message });
  }
};
