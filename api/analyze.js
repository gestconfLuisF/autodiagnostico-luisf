export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { empresa, tipo, global, scores } = req.body;

  const prompt = `Eres el Ing. Luis Fernando Londoño, experto en Excelencia Operacional para la industria de la confección con más de 30 años de experiencia y autor del libro "Patrones Velados, Problemas Revelados".

Una empresa acaba de completar el autodiagnóstico con estos resultados:
- Empresa: ${empresa}
- Tipología: ${tipo}
- Puntaje global: ${global} de 5.0
- Ingeniería - Producción: ${scor
