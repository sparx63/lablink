import type { CompetitionDetails, VerificationEngine } from "./types";

export type CompetitionVerifyInput = Pick<
  CompetitionDetails,
  "name" | "organiser" | "date" | "website"
>;

export interface CompetitionVerifyResult {
  verificationStatus: CompetitionDetails["verificationStatus"];
  verificationNotes: string;
  verificationEngine: VerificationEngine;
  verificationConfidence: number;
  verificationSources: string[];
  verificationLevel: string;
  aiPriorityReason: string;
}

function heuristicVerify(input: CompetitionVerifyInput): CompetitionVerifyResult {
  const hasWebsite = !!input.website?.trim();
  const looksOfficial =
    hasWebsite &&
    /^(https?:\/\/)/i.test(input.website!) &&
    !/example\.(com|edu|org)/i.test(input.website!);

  if (looksOfficial) {
    return {
      verificationStatus: "VERIFIED",
      verificationNotes:
        "Heuristic engine: public URL looks legitimate; staff should still spot-check organiser and dates.",
      verificationEngine: "HEURISTIC",
      verificationConfidence: 0.62,
      verificationSources: [input.website!],
      verificationLevel: "Campus / regional (heuristic)",
      aiPriorityReason:
        "Medium-High — competition fields complete with website; heuristic verification only (no GEMINI_API_KEY).",
    };
  }
  if (hasWebsite) {
    return {
      verificationStatus: "VERIFIED",
      verificationNotes:
        "Heuristic engine: organiser/website provided — demo/example URL accepted for staff review.",
      verificationEngine: "HEURISTIC",
      verificationConfidence: 0.48,
      verificationSources: [input.website!],
      verificationLevel: "Unconfirmed (heuristic)",
      aiPriorityReason:
        "Medium — competition fields complete; website supplied; heuristic engine only — staff must confirm evidence.",
    };
  }
  return {
    verificationStatus: "UNABLE_TO_VERIFY",
    verificationNotes: "Unable to verify online — no website supplied for heuristic lookup.",
    verificationEngine: "HEURISTIC",
    verificationConfidence: 0.15,
    verificationSources: [],
    verificationLevel: "Unable to verify online",
    aiPriorityReason:
      "Needs information — competition exists in form only; online verification inconclusive (heuristic).",
  };
}

async function geminiVerify(input: CompetitionVerifyInput): Promise<CompetitionVerifyResult> {
  const key = process.env.GEMINI_API_KEY!;
  const prompt = `You verify whether a student competition is a real public event.
Return STRICT JSON only (no markdown) with keys:
exists (boolean), confidence (0-1 number), level (string e.g. International/National/Regional/Campus/Unknown),
sources (string array of URLs or citation titles), notes (short string), unableToVerifyOnline (boolean).

Competition name: ${input.name}
Organiser: ${input.organiser}
Date: ${input.date}
Website: ${input.website || "(none)"}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1 },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
  const data = await res.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  const cleaned = text.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(cleaned) as {
    exists?: boolean;
    confidence?: number;
    level?: string;
    sources?: string[];
    notes?: string;
    unableToVerifyOnline?: boolean;
  };

  const unable = !!parsed.unableToVerifyOnline || parsed.exists === false;
  const confidence = Math.max(0, Math.min(1, Number(parsed.confidence ?? 0.4)));
  const sources = Array.isArray(parsed.sources) ? parsed.sources.filter(Boolean) : [];
  if (input.website && !sources.includes(input.website)) sources.unshift(input.website);

  if (unable || confidence < 0.35) {
    return {
      verificationStatus: "UNABLE_TO_VERIFY",
      verificationNotes: parsed.notes || "Unable to verify online via Gemini.",
      verificationEngine: "GEMINI",
      verificationConfidence: confidence,
      verificationSources: sources,
      verificationLevel: parsed.level || "Unable to verify online",
      aiPriorityReason:
        "Needs information — Gemini could not confirm a matching public competition; request supporting proof.",
    };
  }

  return {
    verificationStatus: "VERIFIED",
    verificationNotes: parsed.notes || "Gemini structured verification found matching public signals.",
    verificationEngine: "GEMINI",
    verificationConfidence: confidence,
    verificationSources: sources,
    verificationLevel: parsed.level || "Confirmed",
    aiPriorityReason: `High — Gemini verified competition (confidence ${Math.round(confidence * 100)}%, level ${
      parsed.level || "n/a"
    }). Staff retain final approval.`,
  };
}

/** Prefer Gemini when GEMINI_API_KEY is set; otherwise labelled heuristic fallback. */
export async function verifyCompetition(input: CompetitionVerifyInput): Promise<CompetitionVerifyResult> {
  if (process.env.GEMINI_API_KEY) {
    try {
      return await geminiVerify(input);
    } catch (err) {
      const fallback = heuristicVerify(input);
      return {
        ...fallback,
        verificationNotes: `${fallback.verificationNotes} (Gemini call failed: ${(err as Error).message})`,
      };
    }
  }
  return heuristicVerify(input);
}
