export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }

  const { empresa, tipo, global, scores } = await req.json();

  const prompt = `Eres el Ing. Luis Fernando Londoño, experto en Excelencia Operacional para la industria de la confección con más de 30 años de experiencia y autor del libro "Patrones Velados, Problemas Revelados".

Una empresa acaba de completar el autodiagnóstico:
- Empresa: ${empresa}
- Tipología: ${tipo}
- Puntaje global: ${global} de 5.0
- Ingeniería - Producción: ${scores[0]}
- Calidad: ${scores[1]}
- Costos: ${scores[2]}
- RRHH: ${scores[3]}

Escala: ≥4.0 Consistente, ≥3.0 En desarrollo, <3.0 Crítico

Genera un análisis en español con estas secciones:

1. LECTURA GENERAL (2-3 oraciones sobre el estado global)
2. ÁREA MÁS CRÍTICA (cuál es y qué hacer primero, muy específico para confección)
3. RECOMENDACIONES POR ÁREA (para cada área 2 acciones concretas del sector confección)
4. HOJA DE RUTA (3 meses con acciones concretas)
5. PRÓXIMO PASO (invitar a contactar al Ing. Luis para el plan detallado)

Sé directo, técnico y usa lenguaje del sector confección. Máximo 500 palabras.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  const data = await response.json();
  const text = data.content?.[0]?.text || 'No se pudo generar el análisis.';

  return new Response(JSON.stringify({ analysis: text }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
