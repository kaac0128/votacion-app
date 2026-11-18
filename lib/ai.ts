type Provider = "gemini" | "openrouter";

function buildPrompt(theme: string, category: string, title: string): string {
  return [
    `Estás ayudando a un admin a cargar nominados en una app de votación gamer${theme ? ` sobre "${theme}"` : ""}.`,
    `Categoría: "${category}".`,
    `Nominado: "${title}".`,
    `Escribí UNA descripción breve (máximo 220 caracteres), en español, tono gamer y directo, sin comillas, sin listas, sin saludos. Respondé solo con la descripción.`,
  ].join("\n");
}

export async function generateAiDescription(opts: {
  provider: Provider;
  key: string;
  model?: string | null;
  theme: string;
  category: string;
  title: string;
}): Promise<string> {
  const prompt = buildPrompt(opts.theme, opts.category, opts.title);

  if (opts.provider === "gemini") {
    const model = opts.model?.trim() || "gemini-flash-latest";
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": opts.key },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) throw new Error(`Gemini respondió ${res.status}. Revisá la clave o el modelo.`);
    const data = await res.json();
    const text: string =
      data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
    if (!text.trim()) throw new Error("Gemini devolvió una respuesta vacía");
    return text.trim().slice(0, 500);
  }

  const model = opts.model?.trim() || "google/gemini-2.5-flash";
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.key}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`OpenRouter respondió ${res.status}. Revisá la clave o el modelo.`);
  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? "";
  if (!text.trim()) throw new Error("OpenRouter devolvió una respuesta vacía");
  return text.trim().slice(0, 500);
}
