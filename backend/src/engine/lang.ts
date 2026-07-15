import { franc } from "franc";
import { detect, toISO2 } from "tinyld";

// ISO 639-3 (franc) -> ISO 639-1 mapping for common languages.
const ISO3_TO_2: Record<string, string> = {
  eng: "en", hin: "hi", spa: "es", fra: "fr", deu: "de", ita: "it",
  por: "pt", nld: "nl", rus: "ru", jpn: "ja", cmn: "zh", kor: "ko",
  ara: "ar", tur: "tr", pol: "pl", swe: "sv", vie: "vi", tha: "th",
  urd: "ur", ben: "bn", tam: "ta", tel: "te", mar: "mr", guj: "gu",
  pan: "pa", mal: "ml", kan: "kn", ori: "or", asm: "as",
  pes: "fa", heb: "he", ell: "el", ces: "cs", slk: "sk", hun: "hu",
  ron: "ro", bul: "bg", hrv: "hr", srp: "sr", slv: "sl", ukr: "uk",
  cat: "ca", glg: "gl", eus: "eu", cym: "cy", gle: "ga", fin: "fi",
  dan: "da", nob: "nb", nno: "nn", isl: "is", lit: "lt", lav: "lv",
  est: "et", msa: "ms", ind: "id", tgl: "tl", swa: "sw", amh: "am",
  yor: "yo", zul: "zu", xho: "xh", afr: "af", sqi: "sq", mkd: "mk",
  bos: "bs",
};

// Languages we trust franc on without a tinyld second opinion.
// Rare/adjacent codes (e.g. "sco" Scots for English text) fall back to tinyld.
const COMMON_LANGS_2 = new Set([
  "en", "hi", "es", "fr", "de", "it", "pt", "nl", "ru", "ja", "zh", "ko",
  "ar", "tr", "pl", "sv", "vi", "th", "ur", "bn", "ta", "te", "mr", "gu",
  "pa", "ml", "kn", "or", "as", "fa", "he", "el", "cs", "sk", "hu", "ro",
  "bg", "hr", "sr", "sl", "uk", "ca", "gl", "eu", "cy", "ga", "fi", "da",
  "nb", "nn", "is", "lt", "lv", "et", "ms", "id", "tl", "sw", "am", "yo",
  "zu", "xh", "af", "sq", "mk", "bs",
]);

function toISO2Strict(code: string): string | null {
  if (!code || code === "und") return null;
  if (code.length === 2 && /^[a-z]{2}$/.test(code)) return code;
  const mapped = ISO3_TO_2[code] ?? toISO2(code);
  if (mapped && mapped.length === 2 && /^[a-z]{2}$/.test(mapped)) return mapped;
  return null;
}

/**
 * Detect language of combined prompt+response text. Returns ISO 639-1
 * ("en", "hi", ...) or "und" if unknown.
 *
 * Strategy: franc first. If franc's result is a common language, trust it.
 * Otherwise (rare/adjacent code like "sco" for English text), try tinyld.
 * Validate every candidate is a 2-letter code; fall back to "und".
 */
export function detectLanguage(prompt: string, response: string): string {
  const text = `${prompt}\n${response}`;
  if (text.trim().length < 3) return "und";

  // franc: trigram-based, good on longer text.
  let francResult: string | null = null;
  try {
    const franc3 = franc(text, { minLength: 3 });
    francResult = toISO2Strict(franc3);
    if (francResult && COMMON_LANGS_2.has(francResult)) return francResult;
  } catch {
    // fall through to tinyld
  }

  // tinyld: better on short + code-mixed input; second opinion for rare franc codes.
  let tinyldResult: string | null = null;
  try {
    const detected = detect(text);
    tinyldResult = toISO2Strict(detected);
    if (tinyldResult && COMMON_LANGS_2.has(tinyldResult)) return tinyldResult;
  } catch {
    // fall through
  }

  // Last resort: any valid 2-letter code from either detector.
  return francResult ?? tinyldResult ?? "und";
}

// Supported rule-language codes (ISO 639-1 prefix → rule set key).
// Currently English-only MVP.
export const RULE_SUPPORTED_LANGS = new Set(["en"]);

export function isRuleSupported(lang: string): boolean {
  return RULE_SUPPORTED_LANGS.has(lang);
}
