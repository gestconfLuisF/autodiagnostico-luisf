const https = require('https');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(200).json({ status: 'API funcionando' });

  try {
    const { empresa, tipo, global, scores } = req.body;

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

Máximo 500 palabras.`;

    const body = JSON.stringify({
      model: 'claude-opus-4-7',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    });

    const result = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(body)
        }
      };

      const request = https.request(options, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => resolve(JSON.parse(data)));
      });

      request.on('error', reject);
      request.write(body);
      request.end();
    });

    const text = result.content?.[0]?.text || 'No se pudo obtener respuesta.';
    // Guardar en Google Sheets
try {
  await new Promise((resolve, reject) => {
    const sheetsUrl = 'https://script.google.com/macros/s/AKfycbxCCJnXdNjOPuNHYoAMioLcFAMTnErvloIefl8AdRk7Vm3-BfbR-r-2bq0C39Rkmlmnig/exec';
    const sheetsData = JSON.stringify({
      empresa: empresa,
      responsable: req.body.responsable||'',
      cargo: req.body.cargo||'',
      email: req.body.email||'',
      whatsapp: req.body.whatsapp||'',
      tipo: tipo,
      global: global,
      scores: scores,
      respuestas: req.body.respuestas||[]
    });
    const sheetsOptions = {
      hostname: 'script.google.com',
      path: '/macros/s/AKfycbxCCJnXdNjOPuNHYoAMioLcFAMTnErvloIefl8AdRk7Vm3-BfbR-r-2bq0C39Rkmlmnig/exec',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(sheetsData)
      }
    };
    const sheetsReq = https.request(sheetsOptions, (res) => {
      res.on('data', () => {});
      res.on('end', resolve);
    });
    sheetsReq.on('error', reject);
    sheetsReq.write(sheetsData);
    sheetsReq.end();
  });
} catch(sheetsError) {
  console.log('Error guardando en Sheets:', sheetsError.message);
}

return res.status(200).json({ analysis: text });

  } catch (error) {
    return res.status(500).json({ analysis: 'Error: ' + error.message });
  }
};
