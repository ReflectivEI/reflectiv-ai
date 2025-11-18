// api/coach-metrics.js - Vercel Serverless Function for Analytics
// Handles analytics events from the chat widget

export default async function handler(req, res) {
  // CORS
  const corsOrigins = process.env.CORS_ORIGINS || "";
  const allowed = corsOrigins.split(",").map(s => s.trim()).filter(Boolean);
  const origin = req.headers.origin || "";
  const isAllowed = allowed.length === 0 || allowed.includes(origin);

  // Only set CORS headers if origin is allowed (can't use * with credentials)
  if (isAllowed && origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Requested-With, Authorization");
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body;
    
    // Validate required fields
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: "bad_request", message: "Invalid request body" });
    }

    // Log analytics event (in production, this would store to a database)
    console.log('[Analytics Event]', {
      timestamp: new Date().toISOString(),
      event: body.event || 'unknown',
      mode: body.mode,
      session: body.session,
      data: body.data
    });

    // Return success
    res.status(200).json({ 
      success: true,
      message: "Analytics event recorded",
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    console.error('[Analytics Error]', e);
    res.status(500).json({ 
      error: "internal_error", 
      message: "Failed to process analytics event" 
    });
  }
}
