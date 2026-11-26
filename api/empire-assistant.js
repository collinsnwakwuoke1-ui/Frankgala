const SUPABASE_URL = process.env.SUPABASE_URL || "https://bwgrvtrhnmllovafduyn.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_6TnYFMOfZ1g3euFs-Wv5Zw_P81Gi6Fa";

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token || token.length > 5000) return res.status(401).json({ error: "Sign in to Empire Control first." });

  try {
    const authResponse = await fetch(SUPABASE_URL + "/auth/v1/user", {
      headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + token }
    });
    if (!authResponse.ok) return res.status(401).json({ error: "Your admin session has expired. Sign in again." });
    const user = await authResponse.json();
    const isAdmin = user.email && user.email.toLowerCase() === "collinsnwakwuoke1@gmail.com";
    const hasRole = user.app_metadata && user.app_metadata.role === "empire_admin";
    if (!isAdmin && !hasRole) return res.status(403).json({ error: "Administrator access required." });

    const apiKey = process.env.AI_PROVIDER_API_KEY;
    if (!apiKey) return res.status(503).json({ error: "AI is not configured yet. Add AI_PROVIDER_API_KEY to the Vercel project environment variables, then redeploy." });

    const body = req.body && typeof req.body === "object" ? req.body : {};
    const section = typeof body.section === "string" ? body.section.slice(0, 80) : "Empire Control";
    const incoming = Array.isArray(body.messages) ? body.messages.slice(-16) : [];
    const messages = incoming.map(function (m) {
      return {
        role: m && m.role === "assistant" ? "assistant" : "user",
        content: typeof (m && m.content) === "string" ? m.content.slice(0, 3000) : ""
      };
    }).filter(function (m) { return m.content.trim(); });
    if (!messages.length) return res.status(400).json({ error: "Enter a question first." });

    const base = (process.env.AI_PROVIDER_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
    const model = process.env.AI_MODEL || "gpt-4.1-mini";
    const aiResponse = await fetch(base + "/chat/completions", {
      method: "POST",
      headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_tokens: 900,
        messages: [
          {
            role: "system",
            content: "You are the Empire Control assistant for Frank Gala Empire. Help the authenticated administrator operate the website CMS, improve content and UX, and troubleshoot safely. Current dashboard section: " + section + ". Be precise, concise, and clearly state when a task requires a manual action. You cannot see or modify the database or website directly and must never claim to have saved, published, uploaded, or changed anything. Never ask for passwords, API keys, or secret tokens. For edits or publication, provide instructions and require the administrator to perform and confirm the action in the UI."
          }
        ].concat(messages)
      })
    });
    const result = await aiResponse.json().catch(function () { return {}; });
    if (!aiResponse.ok) {
      const detail = result.error && result.error.message;
      return res.status(502).json({ error: detail || "The AI provider returned an error. Check the configured model and provider." });
    }
    const answer = result.choices && result.choices[0] && result.choices[0].message && result.choices[0].message.content;
    if (typeof answer !== "string" || !answer.trim()) return res.status(502).json({ error: "The AI provider returned an empty answer." });
    return res.status(200).json({ answer: answer.slice(0, 8000) });
  } catch (error) {
    return res.status(500).json({ error: "The assistant could not connect. Try again." });
  }
};
