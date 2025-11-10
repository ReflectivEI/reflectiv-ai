// Simple test worker to debug PROVIDER_KEY issue
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    
    if (url.pathname === "/test-groq") {
      // Test actual Groq API call
      try {
        const key = env.PROVIDER_KEY || "";
        const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "authorization": `Bearer ${key}`
          },
          body: JSON.stringify({
            model: "llama-3.1-70b-versatile",
            messages: [{role: "user", content: "Say OK"}],
            max_tokens: 5
          })
        });
        
        const result = await resp.json();
        return new Response(JSON.stringify({
          ok: resp.ok,
          status: resp.status,
          result: result
        }), {
          headers: { "content-type": "application/json" }
        });
      } catch (e) {
        return new Response(JSON.stringify({
          error: e.message,
          stack: e.stack
        }), {
          status: 500,
          headers: { "content-type": "application/json" }
        });
      }
    }
    
    const key = env.PROVIDER_KEY || "";
    return new Response(JSON.stringify({
      hasKey: !!key,
      keyLength: key.length,
      keyType: typeof key,
      hasNewlines: key.includes("\n"),
      hasSpaces: key.includes(" "),
      firstChars: key.substring(0, 10),
      lastChars: key.substring(key.length - 5)
    }), {
      headers: { "content-type": "application/json" }
    });
  }
};
