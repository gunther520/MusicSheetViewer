interface ApiRequest {
  method?: string;
  body?: {
    image?: string;
    provider?: string;
    apiKey?: string;
  };
}

interface ApiResponse {
  status: (code: number) => {
    json: (body: any) => void;
  };
}

const VISION_SYSTEM_PROMPT = `You are an expert music notation and sheet music analysis AI.
Detect all musical chord symbols printed above the staves on this sheet music image.
Distinguish chords from lyrics, section headers (Intro, Verse, Chorus, Bridge, Fine, etc.), tempo, solfege, and note heads.
Output strict JSON matching:
{
  "chords": [
    {
      "chord": "string",
      "xPercent": number,
      "yPercent": number,
      "widthPercent": number,
      "heightPercent": number
    }
  ]
}
Return only JSON without markdown fences.`;

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { image, provider = 'openai', apiKey } = req.body || {};

  if (!image) {
    return res.status(400).json({ error: 'Missing image parameter' });
  }

  const effectiveApiKey = apiKey || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY;

  if (!effectiveApiKey) {
    return res.status(400).json({
      error: 'No Vision AI API key provided or configured in environment',
    });
  }

  try {
    if (provider === 'gemini') {
      let base64Data = image;
      let mimeType = 'image/jpeg';

      if (image.startsWith('data:')) {
        const matches = image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
        if (matches) {
          mimeType = matches[1];
          base64Data = matches[2];
        }
      }

      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${effectiveApiKey}`;
      const geminiRes = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: VISION_SYSTEM_PROMPT }] },
          contents: [
            {
              parts: [
                { text: 'Detect all chords printed above staves on this music sheet.' },
                { inlineData: { mimeType, data: base64Data } },
              ],
            },
          ],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
        }),
      });

      if (!geminiRes.ok) {
        const errText = await geminiRes.text();
        return res.status(geminiRes.status).json({ error: errText });
      }

      const geminiData = await geminiRes.json();
      const content = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
      const cleanJson = content.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
      return res.status(200).json(JSON.parse(cleanJson));
    }

    // Default: OpenAI GPT-4o-mini
    const openAiUrl = 'https://api.openai.com/v1/chat/completions';
    const imageUrl = image.startsWith('http') || image.startsWith('data:')
      ? image
      : `data:image/jpeg;base64,${image}`;

    const openAiRes = await fetch(openAiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${effectiveApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: VISION_SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Detect all musical chords printed above staves.' },
              { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
            ],
          },
        ],
        temperature: 0.1,
      }),
    });

    if (!openAiRes.ok) {
      const errText = await openAiRes.text();
      return res.status(openAiRes.status).json({ error: errText });
    }

    const openAiData = await openAiRes.json();
    const content = openAiData.choices?.[0]?.message?.content;
    const cleanJson = content.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
    return res.status(200).json(JSON.parse(cleanJson));
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
