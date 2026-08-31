import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ORIGIN = "https://glycovisionai-app.netlify.app";
const PROJECT_URL = Deno.env.get("SUPABASE_URL") || "";
const GEMINI_KEY =
  Deno.env.get("GEMINI_API_KEY") ||
  Deno.env.get("GOOGLE_GEMINI_API_KEY") ||
  "";

function getAdminKey() {
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (service) return service;

  try {
    const secrets = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    return secrets.default || "";
  } catch {
    return "";
  }
}

const ADMIN_KEY = getAdminKey();

const CORS = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

function json(req: Request, body: unknown, status = 200) {
  const origin = req.headers.get("Origin");
  const allowed =
    origin === ORIGIN ||
    origin === "http://localhost:5173" ||
    origin === "http://localhost:3000";

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS,
      "Access-Control-Allow-Origin": allowed ? origin || ORIGIN : ORIGIN,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function fail(
  req: Request,
  error: string,
  message: string,
  extra: Record<string, unknown> = {},
) {
  return json(req, {
    ok: false,
    error,
    message,
    ...extra,
  });
}

async function adminFetch(path: string, init: RequestInit = {}) {
  return fetch(`${PROJECT_URL}${path}`, {
    ...init,
    headers: {
      apikey: ADMIN_KEY,
      Authorization: `Bearer ${ADMIN_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

async function refund(
  userId: string,
  scanId: string,
  reason: string,
) {
  try {
    const response = await adminFetch(
      "/rest/v1/rpc/release_scan_reservation_admin",
      {
        method: "POST",
        body: JSON.stringify({
          p_user_id: userId,
          p_scan_id: scanId,
          p_reason: reason.slice(0, 200),
        }),
      },
    );

    return response.ok;
  } catch {
    return false;
  }
}

function base64(bytes: Uint8Array) {
  let result = "";

  for (let i = 0; i < bytes.length; i += 0x8000) {
    result += String.fromCharCode(
      ...bytes.subarray(i, Math.min(i + 0x8000, bytes.length)),
    );
  }

  return btoa(result);
}

function parseJson(text: string) {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {}

  const match = cleaned.match(/\{[\s\S]*\}/);

  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {}
  }

  throw new Error("invalid_ai_json");
}

function num(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function normalize(data: any) {
  if (data?.is_food === false) {
    throw new Error("not_food");
  }

  const foods = (
    Array.isArray(data?.detected_foods)
      ? data.detected_foods
      : []
  )
    .map((food: any) => ({
      name: String(food?.name ?? food?.food ?? "").trim(),
      portion: String(
        food?.portion ?? food?.serving ?? "Estimated serving",
      ).trim(),
      estimated_sugar_g: num(
        food?.estimated_sugar_g ??
          food?.sugar_g ??
          food?.sugar,
      ),
    }))
    .filter((food: any) => food.name)
    .slice(0, 8);

  const summary = String(
    data?.nutrition_summary ?? data?.summary ?? "",
  )
    .trim()
    .slice(0, 2000);

  if (!foods.length || !summary) {
    throw new Error("incomplete_analysis");
  }

  const insights = (
    Array.isArray(data?.health_insights)
      ? data.health_insights
      : []
  )
    .map((value: unknown) => String(value).trim())
    .filter(Boolean)
    .slice(0, 4);

  return {
    detected_foods: foods,
    nutrition_summary: summary,

    sugar_breakdown: Array.isArray(data?.sugar_breakdown)
      ? data.sugar_breakdown.slice(0, 8)
      : [],

    health_insights: insights.length
      ? insights
      : [
          "Nutrition values are estimates based on the visible food and serving information.",
          "For packaged foods, compare these estimates with the nutrition label when available.",
        ],

    confidence_score: Math.min(
      100,
      num(data?.confidence_score),
    ),

    calories: num(data?.calories),
    carbohydrates: num(
      data?.carbohydrates ?? data?.carbs,
    ),
    protein: num(data?.protein),
    fat: num(data?.fat),
    fiber: num(data?.fiber),
    sugar: num(data?.sugar),
  };
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    is_food: {
      type: "boolean",
    },

    detected_foods: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: {
            type: "string",
          },
          portion: {
            type: "string",
          },
          estimated_sugar_g: {
            type: "number",
          },
        },
        required: [
          "name",
          "portion",
          "estimated_sugar_g",
        ],
      },
    },

    nutrition_summary: {
      type: "string",
    },

    sugar_breakdown: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: {
            type: "string",
          },
          sugar_g: {
            type: "number",
          },
        },
        required: [
          "name",
          "sugar_g",
        ],
      },
    },

    health_insights: {
      type: "array",
      items: {
        type: "string",
      },
    },

    confidence_score: {
      type: "number",
    },

    calories: {
      type: "number",
    },

    carbohydrates: {
      type: "number",
    },

    protein: {
      type: "number",
    },

    fat: {
      type: "number",
    },

    fiber: {
      type: "number",
    },

    sugar: {
      type: "number",
    },
  },

  required: [
    "is_food",
    "detected_foods",
    "nutrition_summary",
    "health_insights",
    "confidence_score",
    "calories",
    "carbohydrates",
    "protein",
    "fat",
    "fiber",
    "sugar",
  ],
};

async function askGemini(
  prompt: string,
  mimeType: string,
  imageBase64: string,
) {
  const controller = new AbortController();

  const timer = setTimeout(() => {
    controller.abort();
  }, 30000);

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent",
      {
        method: "POST",

        signal: controller.signal,

        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_KEY,
        },

        body: JSON.stringify({
          contents: [
            {
              role: "user",

              parts: [
                {
                  text: prompt,
                },

                {
                  inlineData: {
                    mimeType,
                    data: imageBase64,
                  },
                },
              ],
            },
          ],

          generationConfig: {
            maxOutputTokens: 1800,

            responseMimeType: "application/json",

            responseSchema: RESPONSE_SCHEMA,

            thinkingConfig: {
              thinkingLevel: "low",
            },
          },
        }),
      },
    );

    const raw = await response.text();

    console.log(
      "gemini_status",
      response.status,
      raw.length,
    );

    if (!response.ok) {
      console.error(
        "gemini_error",
        response.status,
        raw.slice(0, 2000),
      );

      if (
        response.status === 401 ||
        response.status === 403
      ) {
        throw new Error("gemini_auth_error");
      }

      if (response.status === 404) {
        throw new Error("gemini_model_not_found");
      }

      if (response.status === 429) {
        throw new Error("gemini_rate_limited");
      }

      if (response.status === 400) {
        throw new Error("gemini_bad_request");
      }

      throw new Error(
        `gemini_request_${response.status}`,
      );
    }

    const payload = JSON.parse(raw);

    const candidate =
      payload?.candidates?.[0];

    const finishReason =
      candidate?.finishReason;

    const text =
      candidate?.content?.parts
        ?.map((part: any) => part?.text || "")
        .join("")
        .trim() || "";

    if (!text) {
      if (finishReason === "SAFETY") {
        throw new Error("ai_safety_block");
      }

      throw new Error("empty_ai_response");
    }

    return parseJson(text);
  } catch (error) {
    if (
      error instanceof DOMException &&
      error.name === "AbortError"
    ) {
      throw new Error("analysis_timeout");
    }

    throw error;
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: CORS,
    });
  }

  if (req.method !== "POST") {
    return fail(
      req,
      "method_not_allowed",
      "Only POST requests are supported.",
    );
  }

  if (
    !PROJECT_URL ||
    !ADMIN_KEY ||
    !GEMINI_KEY
  ) {
    return fail(
      req,
      "server_configuration_error",
      "Meal analysis is temporarily unavailable because the AI service is not configured.",
    );
  }

  let userId: string | null = null;
  let scanId: string | null = null;

  try {
    const authorization =
      req.headers.get("Authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return fail(
        req,
        "not_authenticated",
        "Please sign in before scanning.",
      );
    }

    const userResponse = await fetch(
      `${PROJECT_URL}/auth/v1/user`,
      {
        headers: {
          apikey: ADMIN_KEY,
          Authorization: authorization,
        },
      },
    );

    if (!userResponse.ok) {
      return fail(
        req,
        "not_authenticated",
        "Your session has expired. Please sign in again.",
      );
    }

    userId =
      (await userResponse.json())?.id ||
      null;

    if (!userId) {
      return fail(
        req,
        "not_authenticated",
        "Please sign in before scanning.",
      );
    }

    const body = await req.json();

    const imagePath = String(
      body?.image_path ??
        body?.imagePath ??
        "",
    );

    const userRequest =
      body?.user_request == null
        ? "Normal meal analysis."
        : String(body.user_request).slice(
            0,
            500,
          );

    if (
      !imagePath ||
      !imagePath.startsWith(`${userId}/`) ||
      imagePath.includes("..")
    ) {
      return fail(
        req,
        "invalid_image_path",
        "The selected image could not be processed.",
      );
    }

    const imageResponse =
      await adminFetch(
        `/storage/v1/object/meal-images/${imagePath}`,
      );

    if (!imageResponse.ok) {
      throw new Error(
        `image_download_failed_${imageResponse.status}`,
      );
    }

    const bytes = new Uint8Array(
      await imageResponse.arrayBuffer(),
    );

    if (!bytes.length) {
      throw new Error("empty_image");
    }

    if (bytes.length > 10 * 1024 * 1024) {
      throw new Error("image_too_large");
    }

    const mimeType = (
      imageResponse.headers.get(
        "content-type",
      ) || "image/jpeg"
    )
      .split(";")[0]
      .toLowerCase();

    if (
      ![
        "image/jpeg",
        "image/png",
        "image/webp",
      ].includes(mimeType)
    ) {
      throw new Error(
        "unsupported_image_type",
      );
    }

    const reservationResponse =
      await adminFetch(
        "/rest/v1/rpc/start_meal_scan_admin",
        {
          method: "POST",

          body: JSON.stringify({
            p_user_id: userId,
            p_image_path: imagePath,
            p_user_request: userRequest,
          }),
        },
      );

    if (!reservationResponse.ok) {
      const text =
        await reservationResponse.text();

      if (
        text.includes("scan_limit_reached")
      ) {
        return fail(
          req,
          "scan_limit_reached",
          "You have no scans remaining.",
        );
      }

      if (
        text.includes("scan_rate_limited")
      ) {
        return fail(
          req,
          "scan_rate_limited",
          "Please wait a moment before scanning again.",
        );
      }

      throw new Error(
        "scan_reservation_failed",
      );
    }

    const reservation =
      await reservationResponse.json();

    scanId =
      reservation?.scan_id || null;

    if (!scanId) {
      throw new Error(
        "scan_reservation_failed",
      );
    }

    const prompt = `
You are GlycoVision, a food and nutrition vision assistant.

Analyze ONLY the supplied image.

Determine whether it contains food or a food product.

If it is NOT food:
- set is_food to false
- keep the result concise

If it IS food:
- identify the visible foods
- estimate portions
- estimate calories
- estimate carbohydrates
- estimate protein
- estimate fat
- estimate fiber
- estimate total sugar
- estimate sugar for each detected food
- provide a concise nutrition summary
- provide at least two useful health insights

For packaged foods, read visible nutrition-label information when possible.

Never claim that estimates are exact.

Do not diagnose diseases or medical conditions.

Return ONLY JSON matching the supplied response schema.

User request:
${userRequest}
`;

    let candidate: any;

    try {
      candidate = await askGemini(
        prompt,
        mimeType,
        base64(bytes),
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      console.error(
        "gemini_attempt_failed",
        message,
      );

      throw error;
    }

    const analysis =
      normalize(candidate);

    const update =
      await adminFetch(
        `/rest/v1/meal_scans?id=eq.${encodeURIComponent(
          scanId,
        )}&user_id=eq.${encodeURIComponent(
          userId,
        )}&status=eq.processing&billing_status=eq.reserved`,
        {
          method: "PATCH",

          headers: {
            Prefer: "return=minimal",
          },

          body: JSON.stringify({
            status: "completed",
            billing_status: "charged",
            ...analysis,
            completed_at:
              new Date().toISOString(),
            error_message: null,
          }),
        },
      );

    if (!update.ok) {
      console.error(
        "scan_complete_update_failed",
        await update.text(),
      );

      throw new Error(
        "scan_complete_update_failed",
      );
    }

    return json(req, {
      ok: true,

      scan_id: scanId,

      remaining:
        reservation?.remaining ?? null,

      scan: {
        id: scanId,
        user_id: userId,
        image_path: imagePath,
        user_request: userRequest,
        status: "completed",
        billing_status: "charged",
        ...analysis,
        completed_at:
          new Date().toISOString(),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "analysis_failed";

    console.error(
      "analyze_meal_failed",
      message,
    );

    const refunded =
      scanId && userId
        ? await refund(
            userId,
            scanId,
            message,
          )
        : true;

    if (message === "not_food") {
      return fail(
        req,
        "not_food",
        "This image does not appear to contain a meal or food product. Your scan was not deducted.",
        { refunded: true },
      );
    }

    if (
      message === "gemini_auth_error"
    ) {
      return fail(
        req,
        "ai_configuration_error",
        "Gemini rejected the API key. Please check the Gemini API key in Supabase Edge Function secrets.",
        { refunded },
      );
    }

    if (
      message === "gemini_model_not_found"
    ) {
      return fail(
        req,
        "gemini_model_not_found",
        "Gemini 3.7 Flash is not available to the configured API key. Please check that the Gemini API key belongs to the correct Google AI Studio project.",
        { refunded },
      );
    }

    if (
      message === "gemini_rate_limited"
    ) {
      return fail(
        req,
        "ai_rate_limited",
        "Gemini is temporarily busy. Please try again shortly. Your scan was not deducted.",
        { refunded },
      );
    }

    if (
      message === "analysis_timeout"
    ) {
      return fail(
        req,
        "analysis_timeout",
        "The AI service took too long to respond. Your scan was not deducted. Please try again.",
        { refunded },
      );
    }

    if (
      message === "ai_safety_block"
    ) {
      return fail(
        req,
        "ai_safety_block",
        "Gemini could not process this image. Your scan was not deducted. Please use a clear meal photo.",
        { refunded },
      );
    }

    if (
      message === "empty_ai_response" ||
      message === "invalid_ai_json" ||
      message === "incomplete_analysis"
    ) {
      return fail(
        req,
        "analysis_invalid_response",
        "Gemini returned an incomplete result. Your scan was not deducted. Please try again.",
        { refunded },
      );
    }

    if (
      message === "gemini_bad_request"
    ) {
      return fail(
        req,
        "gemini_bad_request",
        "Gemini rejected this image request. Your scan was not deducted. Please try a clear JPG, PNG, or WebP image.",
        { refunded },
      );
    }

    if (
      message === "image_too_large"
    ) {
      return fail(
        req,
        "image_too_large",
        "Please choose an image smaller than 10 MB.",
        { refunded: true },
      );
    }

    if (
      message === "unsupported_image_type"
    ) {
      return fail(
        req,
        "unsupported_image_type",
        "Please use a JPG, PNG, or WebP image.",
        { refunded: true },
      );
    }

    if (
      message.startsWith(
        "image_download_failed_",
      )
    ) {
      return fail(
        req,
        "image_download_failed",
        "The uploaded image could not be read from storage. Please upload the image again.",
        { refunded: true },
      );
    }

    return fail(
      req,
      "analysis_failed",
      "We couldn't analyze this image. Your scan was not deducted. Please try again.",
      { refunded },
    );
  }
});
