import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { data: balance, error: balanceError } = await userClient.rpc("get_scan_balance");
    if (balanceError) throw balanceError;
    if (!balance || Number(balance.remaining) <= 0) return json({ error: "SCAN_LIMIT_REACHED" }, 402);

    const { image_path, user_request } = await req.json();
    if (!image_path || !image_path.startsWith(`${user.id}/`)) return json({ error: "Invalid image path" }, 400);

    const { data: file, error: downloadError } = await admin.storage.from("meal-images").download(image_path);
    if (downloadError || !file) throw downloadError || new Error("Image unavailable");
    if (file.size > 10 * 1024 * 1024) return json({ error: "Image too large" }, 413);
    const mime = file.type || "image/jpeg";
    if (!mime.startsWith("image/")) return json({ error: "Only image files are supported" }, 415);
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    const base64 = btoa(binary);

    const model = Deno.env.get("GEMINI_MODEL") || "gemini-3.7-flash";
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return json({ error: "AI service is not configured" }, 503);
    const prompt = `You are GlycoVision AI, a meal-intelligence assistant. Analyze the meal photo conservatively. Estimate foods and portions, sugar, calories, carbohydrates, protein, fat, and fiber. Do not diagnose disease or make medical claims. Return ONLY valid JSON matching this schema: {"detected_foods":[{"name":string,"portion":string,"estimated_sugar_g":number}],"nutrition_summary":string,"sugar_breakdown":[{"food":string,"sugar_g":number}],"health_insights":[string],"confidence_score":number,"calories":number,"carbohydrates":number,"protein":number,"fat":number,"fiber":number,"sugar":number}. Confidence is 0-100. Use numbers, not strings. User request: ${String(user_request || "No additional request")}`;
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }, { inline_data: { mime_type: mime, data: base64 } }] }], generationConfig: { responseMimeType: "application/json" } })
    });
    if (!response.ok) return json({ error: "AI analysis failed" }, 502);
    const gemini = await response.json();
    const text = gemini?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "";
    let parsed: any;
    try { parsed = JSON.parse(text); } catch { return json({ error: "AI returned an invalid analysis" }, 502); }

    const row = { user_id: user.id, image_path, user_request: user_request || null, status: "completed", detected_foods: parsed.detected_foods || [], nutrition_summary: parsed.nutrition_summary || "", sugar_breakdown: parsed.sugar_breakdown || [], health_insights: parsed.health_insights || [], confidence_score: Number(parsed.confidence_score || 0), calories: Number(parsed.calories || 0), carbohydrates: Number(parsed.carbohydrates || 0), protein: Number(parsed.protein || 0), fat: Number(parsed.fat || 0), fiber: Number(parsed.fiber || 0), sugar: Number(parsed.sugar || 0), completed_at: new Date().toISOString() };
    const { data: scan, error: insertError } = await admin.from("meal_scans").insert(row).select("*").single();
    if (insertError) throw insertError;

    const { error: usageError } = await admin.rpc("consume_successful_scan_admin", { p_user_id: user.id, p_scan_id: scan.id });
    if (usageError) throw usageError;
    await admin.from("security_logs").insert({ user_id: user.id, event_type: "meal_scan_completed", metadata: { scan_id: scan.id } });
    return json({ scan });
  } catch (e) {
    console.error("analyze-meal error", e instanceof Error ? e.message : "unknown");
    return json({ error: "Unable to complete meal analysis" }, 500);
  }
});
