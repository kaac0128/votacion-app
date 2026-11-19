type Provider = "gemini" | "openrouter";

const FALLBACK_OPENROUTER_FREE = "google/gemini-2.0-flash-exp:free";
const BEATS_PLACEHOLDER = (title: string) =>
  `https://placehold.co/600x800/131316/e2e8f0/png?text=${encodeURIComponent(title)}`;

function buildPrompt(theme: string, category: string, title: string): string {
  return [
    `Estás ayudando a un admin a cargar nominados en una app de votación gamer${theme ? ` sobre "${theme}"` : ""}.`,
    `Categoría: "${category}".`,
    `Nominado: "${title}".`,
    `Escribí UNA descripción breve (máximo 220 caracteres), en español, tono gamer y directo, sin comillas, sin listas, sin saludos. Respondé solo con la descripción.`,
  ].join("\n");
}

// OpenRouter: los modelos gratis rotan, así que se elige el mejor disponible en el momento
async function pickFreeOpenRouterModel(): Promise<string> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return FALLBACK_OPENROUTER_FREE;
    const data = await res.json();
    const free = (data.data ?? [])
      .filter((m: { id?: string; pricing?: { prompt?: string } }) =>
        typeof m.id === "string" &&
        m.id.endsWith(":free") &&
        !m.id.includes("vision") &&
        !m.id.includes("image") &&
        m.pricing?.prompt === "0"
      )
      .map((m: { id: string }) => m.id);
    // preferencia: flash/ligeros que responden bien para textos cortos
    const preferred =
      free.find((id: string) => id.includes("gemini") && id.includes("flash")) ??
      free.find((id: string) => id.includes("deepseek")) ??
      free.find((id: string) => id.includes("llama")) ??
      free[0];
    return preferred ?? FALLBACK_OPENROUTER_FREE;
  } catch {
    return FALLBACK_OPENROUTER_FREE;
  }
}

// Gemini: un solo pedido que devuelve descripción + portada (imagen base64)
async function geminiTextAndCover(key: string, model: string, prompt: string, title: string): Promise<{ description: string; image_url: string | null }> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${prompt}\n\nAdemás, generá una imagen de portada vertical estilo videojuego para "${title}".` }] }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
      }),
      signal: AbortSignal.timeout(45000),
    }
  );
  if (!res.ok) throw new Error(`Gemini respondió ${res.status}`);
  const data = await res.json();
  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> =
    data?.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((p) => p.text ?? "").join("").trim();
  const imgPart = parts.find((p) => p.inlineData);
  if (!text) throw new Error("Gemini devolvió una respuesta vacía");
  return {
    description: text.slice(0, 500),
    image_url: imgPart?.inlineData ? `data:${imgPart.inlineData.mimeType};base64,${imgPart.inlineData.data}` : null,
  };
}

export async function generateAiContent(opts: {
  provider: Provider;
  key: string;
  model?: string | null;
  theme: string;
  category: string;
  title: string;
}): Promise<{ description: string; image_url: string | null }> {
  const prompt = buildPrompt(opts.theme, opts.category, opts.title);

  if (opts.provider === "gemini") {
    // 1er intento: descripción + portada en un solo pedido
    try {
      return await geminiTextAndCover(opts.key, opts.model?.trim() || "gemini-3.5-flash-lite", prompt, opts.title);
    } catch {
      // si el modelo de imagen no está disponible, cae a solo texto
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${opts.model?.trim() || "gemini-3.5-flash-lite"}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": opts.key },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
          signal: AbortSignal.timeout(25000),
        }
      );
      if (!res.ok) throw new Error(`Gemini respondió ${res.status}. Revisá la clave o el modelo.`);
      const data = await res.json();
      const text: string =
        data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
      if (!text.trim()) throw new Error("Gemini devolvió una respuesta vacía");
      return { description: text.trim().slice(0, 500), image_url: null };
    }
  }

  // OpenRouter: texto por chat + portada placeholder con el título (los modelos free no generan imágenes)
  const model = opts.model?.trim() || (await pickFreeOpenRouterModel());
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.key}`,
    },
    body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }] }),
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`OpenRouter respondió ${res.status}. Revisá la clave o el modelo.`);
  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? "";
  if (!text.trim()) throw new Error("OpenRouter devolvió una respuesta vacía");
  return {
    description: text.trim().slice(0, 500),
    image_url: BEATS_PLACEHOLDER(opts.title),
  };
}
