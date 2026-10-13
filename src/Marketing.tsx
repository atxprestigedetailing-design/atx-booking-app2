import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

type CouponLite = { code: string; discountPercent: number; label: string };

type MkClient = {
  key: string; name: string; email: string; phone: string;
  completedCount: number; upcomingCount: number; totalCount: number;
  lastServiceDate: string; isMaintenance: boolean; eventOnly: boolean;
  emailOk: boolean; emailReason: string; smsOk: boolean; smsReason: string;
  lastContactedAt: string;
};

type MkLogEntry = {
  timestamp: string; campaignId: string; campaignName: string; channel: string; status: string;
  clientKey: string; name: string; email: string; phone: string; detail: string; preview: string;
};

type Draft = {
  campaignName: string; subject: string; preheader: string; kicker: string; headline: string; body: string;
  couponCode: string; couponNote: string; ctaLabel: string; ctaUrl: string;
  smsMessage: string; smsMentionCoupon: boolean; smsIncludeLink: boolean;
};

type SendResult = { key: string; name?: string; channel: string; status: string; detail: string };

type Props = {
  scriptUrl: string;
  googleClientId: string;
  coupons: CouponLite[];
  credential: string;
  onCredential: (credential: string) => void;
};

const BOOKING_URL = "https://book.atxprestigedetailing.com";
const BATCH_SIZE = 10;
const DRAFT_KEY = "atx_marketing_draft_v1";

// ─── Presets ─────────────────────────────────────────────────────────────────

const PRESETS: { id: string; label: string; draft: Draft }[] = [
  {
    id: "seasonal", label: "Seasonal promo",
    draft: {
      campaignName: "Seasonal promo", subject: "A little something for your ride, {{firstName}}",
      preheader: "Save on your next detail — auto or boat.", kicker: "Seasonal Special",
      headline: "Give your ride a fresh start.",
      body: "Hi {{firstName}},\n\nBook any detail this month and save with the code below — auto or boat, mobile or drop-off.\n\nGrab a time that works for you and we'll take care of the rest.",
      couponCode: "", couponNote: "One use per client", ctaLabel: "Book My Detail", ctaUrl: BOOKING_URL,
      smsMessage: "Hi {{firstName}}! ATX Prestige Detailing has a seasonal special on your next detail.",
      smsMentionCoupon: true, smsIncludeLink: true,
    },
  },
  {
    id: "winback", label: "We miss you",
    draft: {
      campaignName: "We miss you", subject: "It's been a while, {{firstName}}",
      preheader: "Your next detail is a couple of taps away.", kicker: "We Miss You",
      headline: "Time for a fresh detail?",
      body: "Hi {{firstName}},\n\nIt's been a little while since your last visit and we'd love to see you again.\n\nEvery job is backed by our 100% Satisfaction Guarantee — if anything isn't up to your standards, we'll make it right.",
      couponCode: "", couponNote: "", ctaLabel: "Book Now", ctaUrl: BOOKING_URL,
      smsMessage: "Hi {{firstName}}, it's been a while! Ready for a fresh detail? We'd love to see you again.",
      smsMentionCoupon: true, smsIncludeLink: true,
    },
  },
  {
    id: "maintenance", label: "Maintenance plan",
    draft: {
      campaignName: "Maintenance plan", subject: "Keep it looking new, {{firstName}}",
      preheader: "Recurring 2-hour details, bi-weekly or monthly.", kicker: "Maintenance Plans",
      headline: "Stay clean all year.",
      body: "Hi {{firstName}},\n\nOur maintenance plans keep your vehicle in top condition with a recurring 2-hour detail — choose bi-weekly or monthly, and we come to you.\n\nSet it up once and we'll handle the schedule.",
      couponCode: "", couponNote: "", ctaLabel: "Start a Plan", ctaUrl: BOOKING_URL,
      smsMessage: "Hi {{firstName}}! Keep your ride spotless with an ATX Prestige maintenance plan — recurring details, bi-weekly or monthly.",
      smsMentionCoupon: false, smsIncludeLink: true,
    },
  },
  {
    id: "blank", label: "Start from scratch",
    draft: {
      campaignName: "", subject: "", preheader: "", kicker: "", headline: "", body: "",
      couponCode: "", couponNote: "", ctaLabel: "Book Now", ctaUrl: BOOKING_URL,
      smsMessage: "", smsMentionCoupon: false, smsIncludeLink: true,
    },
  },
];

// ─── Rendering helpers (preview and send use the SAME html) ──────────────────

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] || "there";
}

function subst(text: string, first: string, unsubscribeUrl = "#"): string {
  return text.replace(/\{\{firstName\}\}/g, () => first).replace(/\{\{unsubscribeUrl\}\}/g, () => unsubscribeUrl);
}

function buildEmailHtml(d: Draft, coupon?: CouponLite): string {
  const paragraphs = d.body.trim().split(/\n{2,}/).filter(Boolean)
    .map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#4a463b;">${esc(p).replace(/\n/g, "<br>")}</p>`).join("");

  const couponBlock = coupon ? `
<tr><td style="padding:4px 30px 24px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1.5px dashed #c9a453;border-radius:12px;background:#fbf6e9;">
    <tr><td align="center" style="padding:18px 20px;">
      <div style="font-size:28px;font-weight:800;color:#161510;font-family:Arial,Helvetica,sans-serif;">${esc(String(coupon.discountPercent))}% OFF</div>
      <div style="margin-top:8px;display:inline-block;font-family:'Courier New',monospace;font-size:15px;font-weight:700;letter-spacing:.06em;color:#161510;background:#ffffff;border:1px solid #e3d6ac;border-radius:7px;padding:6px 14px;">${esc(coupon.code)}</div>
      ${d.couponNote.trim() ? `<div style="margin-top:9px;font-size:12px;color:#8a7f61;font-family:Arial,Helvetica,sans-serif;">${esc(d.couponNote.trim())}</div>` : ""}
    </td></tr>
  </table>
</td></tr>` : "";

  const cta = d.ctaLabel.trim() && d.ctaUrl.trim() ? `
<tr><td align="center" style="padding:2px 30px 30px;">
  <a href="${esc(d.ctaUrl.trim())}" style="display:inline-block;background:#161510;color:#ffffff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;padding:13px 30px;border-radius:9px;">${esc(d.ctaLabel.trim())}</a>
</td></tr>` : "";

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(d.subject)}</title></head>
<body style="margin:0;padding:0;background:#efece4;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(d.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#efece4;"><tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#26241f;">
<tr><td style="background:#0f0e0c;padding:26px 30px;">
  <div style="font-size:19px;font-weight:800;color:#ffffff;font-family:Arial,Helvetica,sans-serif;">ATX Prestige Detailing</div>
  <div style="font-size:11.5px;color:#c9a453;margin-top:4px;letter-spacing:.03em;font-family:Arial,Helvetica,sans-serif;">Defined by Detail &middot; Driven by Standards</div>
</td></tr>
<tr><td style="padding:34px 30px 8px;">
  ${d.kicker.trim() ? `<div style="font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#a9812f;font-family:Arial,Helvetica,sans-serif;">${esc(d.kicker.trim())}</div>` : ""}
  ${d.headline.trim() ? `<h1 style="font-size:26px;line-height:1.2;margin:10px 0 16px;color:#161510;font-family:Arial,Helvetica,sans-serif;">${esc(d.headline.trim())}</h1>` : ""}
  ${paragraphs}
</td></tr>${couponBlock}${cta}
<tr><td style="border-top:1px solid #ece7d8;padding:20px 30px 26px;text-align:center;">
  <div style="font-size:11.5px;color:#8a8371;line-height:1.7;font-family:Arial,Helvetica,sans-serif;">ATX Prestige Detailing &middot; Lago Vista, TX<br>Serving Lago Vista, Cedar Park &amp; Leander<br><a href="{{unsubscribeUrl}}" style="color:#8a8371;">Unsubscribe</a> from promotional emails</div>
</td></tr>
</table></td></tr></table></body></html>`;
}

function buildEmailPlain(d: Draft, coupon?: CouponLite): string {
  const lines: string[] = [];
  if (d.headline.trim()) lines.push(d.headline.trim(), "");
  lines.push(d.body.trim(), "");
  if (coupon) lines.push(`${coupon.discountPercent}% OFF — use code ${coupon.code}${d.couponNote.trim() ? ` (${d.couponNote.trim()})` : ""}`, "");
  if (d.ctaLabel.trim() && d.ctaUrl.trim()) lines.push(`${d.ctaLabel.trim()}: ${d.ctaUrl.trim()}`, "");
  lines.push("ATX Prestige Detailing · Lago Vista, TX", "Unsubscribe: {{unsubscribeUrl}}");
  return lines.join("\n");
}

function composeSms(d: Draft, coupon?: CouponLite): string {
  let t = d.smsMessage.trim();
  if (coupon && d.smsMentionCoupon) t += ` Use code ${coupon.code} for ${coupon.discountPercent}% off.`;
  if (d.smsIncludeLink && d.ctaUrl.trim()) t += ` Book: ${d.ctaUrl.trim().replace(/^https?:\/\//, "")}`;
  if (!/\bstop\b/i.test(t)) t += "\nReply STOP to opt out.";
  return t.trim();
}

const GSM_BASIC = /^[A-Za-z0-9 \r\n@£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ!"#¤%&'()*+,\-./:;<=>?¡ÄÖÑÜ§¿äöñüà]*$/;

function smsInfo(text: string): { chars: number; segments: number; unicode: boolean } {
  const plain = GSM_BASIC.test(text.replace(/[\^{}\\[\]~|€]/g, ""));
  if (plain) {
    const extended = (text.match(/[\^{}\\[\]~|€]/g) || []).length;
    const chars = text.length + extended;
    return { chars, segments: chars <= 160 ? 1 : Math.ceil(chars / 153), unicode: false };
  }
  const chars = text.length;
  return { chars, segments: chars <= 70 ? 1 : Math.ceil(chars / 67), unicode: true };
}

function daysSince(dateStr: string): number {
  if (!dateStr) return Infinity;
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y) return Infinity;
  return Math.floor((Date.now() - new Date(y, m - 1, d).getTime()) / 86400000);
}

function tokenValid(cred: string): boolean {
  try {
    const exp = JSON.parse(atob(cred.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).exp;
    return typeof exp === "number" && exp * 1000 - 60000 > Date.now();
  } catch { return false; }
}

function fmtWhen(ts: string): string {
  const d = new Date(ts);
  return isNaN(d.getTime()) ? ts : d.toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function fmtDay(ts: string): string {
  const d = new Date(ts);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString([], { month: "short", day: "numeric" });
}

// ─── Segments ────────────────────────────────────────────────────────────────

const SEGMENTS: { id: string; label: string; match: (c: MkClient) => boolean }[] = [
  { id: "all", label: "All clients", match: (c) => !c.eventOnly },
  { id: "everyone", label: "Everyone incl. event signups", match: () => true },
  { id: "returning", label: "Returning (2+ visits)", match: (c) => !c.eventOnly && c.completedCount >= 2 },
  { id: "oneTime", label: "One-time (1 visit)", match: (c) => !c.eventOnly && c.completedCount === 1 },
  { id: "maintenance", label: "Active maintenance plan", match: (c) => c.isMaintenance },
  { id: "lapsed", label: "Lapsed (60+ days)", match: (c) => !c.eventOnly && c.completedCount > 0 && c.upcomingCount === 0 && daysSince(c.lastServiceDate) >= 60 },
  { id: "new", label: "Booked, not serviced yet", match: (c) => !c.eventOnly && c.completedCount === 0 && c.upcomingCount > 0 },
  { id: "textOk", label: "Opted in to texts", match: (c) => c.smsOk },
  { id: "event", label: "LVISD event signups", match: (c) => c.eventOnly },
];

// ─── Styles ──────────────────────────────────────────────────────────────────

const card: CSSProperties = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 16 };
const labelStyle: CSSProperties = { fontSize: "0.74rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)", marginBottom: 6 };
const inputStyle: CSSProperties = { width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.06)", color: "#f1f5f9", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "9px 12px", fontSize: "0.9rem", outline: "none", fontFamily: "inherit" };
const mutedText: CSSProperties = { color: "rgba(255,255,255,0.45)", fontSize: "0.8rem" };
const primaryBtn: CSSProperties = { background: "linear-gradient(135deg, #0ea5e9, #0369a1)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 700, fontSize: "0.9rem", cursor: "pointer" };
const ghostBtn: CSSProperties = { background: "rgba(255,255,255,0.07)", color: "#e8eaf0", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 10, padding: "9px 14px", fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" };

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      style={{ background: active ? "rgba(14,165,233,0.2)" : "rgba(255,255,255,0.05)", color: active ? "#7dd3fc" : "rgba(255,255,255,0.65)", border: `1px solid ${active ? "rgba(14,165,233,0.6)" : "rgba(255,255,255,0.12)"}`, borderRadius: 999, padding: "5px 12px", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}>
      {children}
    </button>
  );
}

function Badge({ tone, children }: { tone: "good" | "bad" | "muted" | "warn"; children: ReactNode }) {
  const map = { good: ["rgba(16,185,129,0.15)", "#34d399"], bad: ["rgba(239,68,68,0.15)", "#f87171"], muted: ["rgba(255,255,255,0.06)", "rgba(255,255,255,0.45)"], warn: ["rgba(251,191,36,0.15)", "#fbbf24"] } as const;
  return <span style={{ background: map[tone][0], color: map[tone][1], borderRadius: 999, padding: "2px 8px", fontSize: "0.7rem", fontWeight: 700, whiteSpace: "nowrap" }}>{children}</span>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <div style={labelStyle}>{label}{hint && <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, marginLeft: 6, opacity: 0.8 }}>{hint}</span>}</div>
      {children}
    </label>
  );
}

// ─── Google re-verification (token is needed for every marketing request) ────

function GoogleVerify({ clientId, onCredential }: { clientId: string; onCredential: (c: string) => void }) {
  const holder = useRef<HTMLDivElement>(null);
  const latest = useRef(onCredential);
  useEffect(() => { latest.current = onCredential; });
  useEffect(() => {
    let tries = 0;
    const timer = window.setInterval(() => {
      tries++;
      if (window.google?.accounts?.id && holder.current) {
        window.clearInterval(timer);
        window.google.accounts.id.initialize({
          client_id: clientId, itp_support: true,
          callback: (r: { credential: string }) => latest.current(r.credential),
        });
        holder.current.innerHTML = "";
        window.google.accounts.id.renderButton(holder.current, { theme: "filled_black", size: "large", text: "signin_with", shape: "pill" });
      } else if (tries > 40) window.clearInterval(timer);
    }, 250);
    return () => window.clearInterval(timer);
  }, [clientId]);
  return <div ref={holder} style={{ minHeight: 44 }} />;
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function MarketingDashboard({ scriptUrl, googleClientId, coupons, credential, onCredential }: Props) {
  const [view, setView] = useState<"compose" | "history">("compose");
  const [clients, setClients] = useState<MkClient[] | null>(null);
  const [meta, setMeta] = useState<{ emailQuota: number | null; marketingNumber: boolean; optOuts: number }>({ emailQuota: null, marketingNumber: false, optOuts: 0 });
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(false);
  const [audienceTried, setAudienceTried] = useState(false);
  const [logTried, setLogTried] = useState(false);
  const [authIssue, setAuthIssue] = useState("");

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [segment, setSegment] = useState("all");
  const [search, setSearch] = useState("");
  const [useEmail, setUseEmail] = useState(true);
  const [useSms, setUseSms] = useState(false);
  const [previewKey, setPreviewKey] = useState("");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [presetId, setPresetId] = useState("seasonal");

  const [draft, setDraft] = useState<Draft>(() => {
    try { const raw = localStorage.getItem(DRAFT_KEY); if (raw) return { ...PRESETS[0].draft, ...JSON.parse(raw) }; } catch { /* no saved draft */ }
    return PRESETS[0].draft;
  });
  useEffect(() => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* storage unavailable */ } }, [draft]);
  const setField = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const [testPhone, setTestPhone] = useState(() => { try { return localStorage.getItem("atx_marketing_testphone") || ""; } catch { return ""; } });
  const [testMsg, setTestMsg] = useState<string[]>([]);
  const [testing, setTesting] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [ackShared, setAckShared] = useState(false);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<SendResult[] | null>(null);
  const [sendError, setSendError] = useState("");

  const [log, setLog] = useState<MkLogEntry[] | null>(null);
  const [logLoading, setLogLoading] = useState(false);
  const [openCampaign, setOpenCampaign] = useState("");
  const [historySearch, setHistorySearch] = useState("");

  const authed = tokenValid(credential);

  const api = useCallback(async (action: string, extra: Record<string, unknown> = {}) => {
    const res = await fetch(scriptUrl, { method: "POST", body: JSON.stringify({ action, idToken: credential, ...extra }) });
    const data = await res.json();
    if (data.authError) setAuthIssue(data.error || "Please verify with Google again.");
    return data;
  }, [scriptUrl, credential]);

  const loadAudience = useCallback(async () => {
    setAudienceTried(true); setLoading(true); setLoadError("");
    try {
      const d = await api("getMarketingAudience");
      if (d.success) {
        setClients(d.clients as MkClient[]);
        setMeta({ emailQuota: typeof d.emailQuotaRemaining === "number" ? d.emailQuotaRemaining : null, marketingNumber: !!d.marketingNumberConfigured, optOuts: d.optOutCount || 0 });
        setAuthIssue("");
      } else if (!d.authError) setLoadError(d.error || "Couldn't load clients.");
    } catch { setLoadError("Couldn't reach the server (the response wasn't what the app expected). Try again in a moment."); }
    finally { setLoading(false); }
  }, [api]);

  const loadLog = useCallback(async () => {
    setLogTried(true); setLogLoading(true);
    try {
      const d = await api("getMarketingLog");
      if (d.success) setLog(d.entries as MkLogEntry[]);
    } catch { /* surfaced by empty state */ }
    finally { setLogLoading(false); }
  }, [api]);

  // A new sign-in token means earlier failures may now succeed — allow a fresh attempt.
  useEffect(() => { setAudienceTried(false); setLogTried(false); }, [credential]);
  // Auto-load once per attempt; a failure must not retrigger this (Refresh / Try again do).
  useEffect(() => { if (authed && !audienceTried && !loading) void loadAudience(); }, [authed, audienceTried, loading, loadAudience]);
  useEffect(() => { if (authed && view === "history" && !logTried && !logLoading) void loadLog(); }, [authed, view, logTried, logLoading, loadLog]);
  const reloadAll = () => { setClients(null); setLog(null); setAudienceTried(false); setLogTried(false); };

  const coupon = useMemo(() => coupons.find((c) => c.code === draft.couponCode), [coupons, draft.couponCode]);
  const emailHtml = useMemo(() => buildEmailHtml(draft, coupon), [draft, coupon]);
  const emailPlain = useMemo(() => buildEmailPlain(draft, coupon), [draft, coupon]);
  const smsTemplate = useMemo(() => composeSms(draft, coupon), [draft, coupon]);

  const seg = SEGMENTS.find((s) => s.id === segment) || SEGMENTS[0];
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (clients || []).filter((c) => seg.match(c) && (!q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.phone.includes(q)));
  }, [clients, seg, search]);
  const segCounts = useMemo(() => Object.fromEntries(SEGMENTS.map((s) => [s.id, (clients || []).filter(s.match).length])), [clients]);

  const selectedClients = useMemo(() => (clients || []).filter((c) => selected.has(c.key)), [clients, selected]);
  const emailTargets = useEmail ? selectedClients.filter((c) => c.emailOk) : [];
  const smsTargets = useSms ? selectedClients.filter((c) => c.smsOk) : [];
  const targetKeys = useMemo(() => selectedClients.filter((c) => (useEmail && c.emailOk) || (useSms && c.smsOk)).map((c) => c.key), [selectedClients, useEmail, useSms]);

  const previewClient = (clients || []).find((c) => c.key === previewKey) || selectedClients[0] || (clients || [])[0];
  const previewFirst = previewClient ? firstNameOf(previewClient.name) : "Alex";
  const previewHtml = useMemo(() => subst(emailHtml.replace(/\{\{firstName\}\}/g, () => esc(previewFirst)), previewFirst), [emailHtml, previewFirst]);
  const previewSubject = subst(draft.subject, previewFirst);
  const previewSms = subst(smsTemplate, previewFirst);
  const info = smsInfo(previewSms);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeH, setIframeH] = useState(620);
  const fitIframe = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (doc?.body) setIframeH(Math.max(420, doc.documentElement.scrollHeight));
  }, []);
  useEffect(() => { const t = window.setTimeout(fitIframe, 120); return () => window.clearTimeout(t); }, [previewHtml, device, fitIframe]);

  function toggle(key: string) {
    setSelected((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  }
  const allShownSelected = shown.length > 0 && shown.every((c) => selected.has(c.key));
  function toggleShown() {
    setSelected((s) => { const n = new Set(s); if (allShownSelected) shown.forEach((c) => n.delete(c.key)); else shown.forEach((c) => n.add(c.key)); return n; });
  }

  function applyPreset(id: string) {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    if (draft.body.trim() && !window.confirm("Replace the current copy with this template?")) return;
    setPresetId(id);
    setDraft({ ...p.draft });
  }

  async function sendTest() {
    setTesting(true); setTestMsg([]);
    try { localStorage.setItem("atx_marketing_testphone", testPhone); } catch { /* storage unavailable */ }
    const channels = [...(useEmail ? ["email"] : []), ...(useSms ? ["sms"] : [])];
    try {
      const d = await api("sendMarketingTest", { channels, email: { subject: draft.subject, html: emailHtml, plain: emailPlain }, sms: smsTemplate, testPhone, sampleName: previewClient?.name || "Alex", baseUrl: scriptUrl });
      if (d.success) setTestMsg([d.email ? `Email: ${d.email}` : "", d.sms ? `Text: ${d.sms}` : ""].filter(Boolean));
      else setTestMsg([d.error || "Test failed."]);
    } catch { setTestMsg(["Network error — test not sent."]); }
    finally { setTesting(false); }
  }

  const needsAck = useSms && !meta.marketingNumber && smsTargets.length > 0;
  const quotaShort = useEmail && meta.emailQuota !== null && emailTargets.length > meta.emailQuota;
  const problems: string[] = [];
  if (!useEmail && !useSms) problems.push("Turn on Email, Text, or both.");
  if (useEmail && !draft.subject.trim()) problems.push("Add an email subject.");
  if (useEmail && !draft.body.trim()) problems.push("Add email body copy.");
  if (useSms && !draft.smsMessage.trim()) problems.push("Add the text message copy.");
  if (!draft.campaignName.trim()) problems.push("Give the campaign a name (it's how it shows in History).");
  if (targetKeys.length === 0) problems.push("No selected client can receive this message — check selection and channels.");
  const canReview = authed && problems.length === 0 && !sending;
  const confirmReady = confirmText.trim().toUpperCase() === "SEND" && (!needsAck || ackShared);

  async function runSend() {
    setSending(true); setSendError(""); setResults(null);
    const campaignId = `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const channels = [...(useEmail ? ["email"] : []), ...(useSms ? ["sms"] : [])];
    const all: SendResult[] = [];
    setProgress({ done: 0, total: targetKeys.length });
    try {
      for (let i = 0; i < targetKeys.length; i += BATCH_SIZE) {
        const chunk = targetKeys.slice(i, i + BATCH_SIZE);
        const d = await api("sendMarketingBatch", { campaignId, campaignName: draft.campaignName.trim(), channels, email: { subject: draft.subject, html: emailHtml, plain: emailPlain }, sms: smsTemplate, recipients: chunk, baseUrl: scriptUrl });
        if (!d.success) { setSendError(d.error || "A batch failed — stopped. Check History to see what already went out."); break; }
        all.push(...(d.results as SendResult[]));
        setProgress({ done: Math.min(i + BATCH_SIZE, targetKeys.length), total: targetKeys.length });
      }
    } catch { setSendError("Network error — stopped. Check History to see what already went out."); }
    setResults(all); setSending(false); setConfirmOpen(false); setConfirmText(""); setAckShared(false);
    reloadAll();
  }

  // ── History grouping ──
  const campaigns = useMemo(() => {
    const map = new Map<string, { id: string; name: string; first: string; last: string; entries: MkLogEntry[]; emailSent: number; smsSent: number; failed: number; preview: string }>();
    (log || []).forEach((e) => {
      let c = map.get(e.campaignId);
      if (!c) { c = { id: e.campaignId, name: e.campaignName, first: e.timestamp, last: e.timestamp, entries: [], emailSent: 0, smsSent: 0, failed: 0, preview: e.preview }; map.set(e.campaignId, c); }
      c.entries.push(e);
      if (e.timestamp < c.first) c.first = e.timestamp;
      if (e.timestamp > c.last) c.last = e.timestamp;
      if (e.status === "sent" && e.channel === "email") c.emailSent++;
      else if (e.status === "sent" && e.channel === "sms") c.smsSent++;
      else c.failed++;
    });
    return [...map.values()].sort((a, b) => (a.last < b.last ? 1 : -1));
  }, [log]);
  const hq = historySearch.trim().toLowerCase();
  const historyMatches = hq ? (log || []).filter((e) => [e.name, e.email, e.phone, e.campaignName].some((v) => v.toLowerCase().includes(hq))) : [];

  // ─────────────────────────────────────────────────────────────────────────

  const gate = !authed ? (
    <div style={{ ...card, maxWidth: 520, margin: "10px auto", textAlign: "center" }}>
      <div style={{ fontWeight: 800, color: "#f1f5f9", fontSize: "1.05rem", marginBottom: 6 }}>Verify it's you to use Marketing</div>
      <div style={{ ...mutedText, lineHeight: 1.6, marginBottom: 14 }}>
        Sending mass emails and texts is locked to your Google account on the server, not just in the app. Sign in with <strong style={{ color: "#cbd5e1" }}>atxprestigedetailing@gmail.com</strong> — it lasts about an hour.
      </div>
      <div style={{ display: "flex", justifyContent: "center" }}><GoogleVerify clientId={googleClientId} onCredential={onCredential} /></div>
      {authIssue && <div style={{ marginTop: 12, fontSize: "0.82rem", color: "#f87171" }}>{authIssue}</div>}
    </div>
  ) : null;

  const th: CSSProperties = { textAlign: "left", padding: "8px 10px", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "rgba(255,255,255,0.4)", fontWeight: 700, whiteSpace: "nowrap" };
  const td: CSSProperties = { padding: "8px 10px", fontSize: "0.82rem", color: "#e2e8f0", borderTop: "1px solid rgba(255,255,255,0.06)", verticalAlign: "top" };

  return (
    <div style={{ textAlign: "left" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <Chip active={view === "compose"} onClick={() => setView("compose")}>Compose &amp; send</Chip>
          <Chip active={view === "history"} onClick={() => setView("history")}>History</Chip>
        </div>
        {authed && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {clients && <span style={mutedText}>{clients.length} clients · Gmail sends left today: {meta.emailQuota ?? "not tracked"} · {meta.optOuts} unsubscribed</span>}
            <button type="button" style={ghostBtn} onClick={reloadAll}>Refresh</button>
          </div>
        )}
      </div>

      {gate}
      {authed && authIssue && <div style={{ ...card, marginBottom: 14, color: "#f87171", fontSize: "0.85rem" }}>{authIssue}</div>}
      {authed && loadError && <div style={{ ...card, marginBottom: 14, color: "#f87171", fontSize: "0.85rem" }}>{loadError}</div>}

      {authed && view === "compose" && (
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 380px), 1fr))", alignItems: "start" }}>
          {/* ── LEFT: audience + message ── */}
          <div style={{ display: "grid", gap: 16, minWidth: 0, gridTemplateColumns: "minmax(0, 1fr)" }}>
            <div style={card}>
              <div style={{ fontWeight: 800, color: "#f1f5f9", marginBottom: 10 }}>1 · Channels</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Chip active={useEmail} onClick={() => setUseEmail((v) => !v)}>{useEmail ? "✓ " : ""}Email</Chip>
                <Chip active={useSms} onClick={() => setUseSms((v) => !v)}>{useSms ? "✓ " : ""}Text message</Chip>
              </div>
              {useEmail && (
                <div style={{ ...mutedText, marginTop: 10, lineHeight: 1.55 }}>
                  Emails send from your Gmail, which caps daily sends (about 100 on a free Gmail account). If it runs out mid-send, the rest are skipped and shown in the results.
                </div>
              )}
              {useSms && (
                <div style={{ ...mutedText, marginTop: 10, lineHeight: 1.55 }}>
                  Texts only go to clients who checked the marketing-text box themselves when booking — everyone else is skipped automatically.
                </div>
              )}
            </div>

            <div style={card}>
              <div style={{ fontWeight: 800, color: "#f1f5f9", marginBottom: 10 }}>2 · Audience</div>
              {loading && !clients && <div style={mutedText}>Loading clients…</div>}
              {!loading && !clients && loadError && (
                <div>
                  <div style={{ fontSize: "0.85rem", color: "#f87171", lineHeight: 1.5, marginBottom: 10 }}>{loadError}</div>
                  <button type="button" style={ghostBtn} onClick={reloadAll}>Try again</button>
                </div>
              )}
              {clients && (
                <>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                    {SEGMENTS.map((s) => <Chip key={s.id} active={segment === s.id} onClick={() => setSegment(s.id)}>{s.label} ({segCounts[s.id]})</Chip>)}
                  </div>
                  {segCounts.event > 0 && (
                    <div style={{ ...mutedText, marginBottom: 10, lineHeight: 1.5 }}>
                      "All clients" leaves out the {segCounts.event} LVISD event signups (free-wash teachers) so they aren't promoted to by accident. Pick "Everyone" to include them.
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                    <input style={{ ...inputStyle, flex: 1, minWidth: 160 }} placeholder="Search name, email or phone" value={search} onChange={(e) => setSearch(e.target.value)} />
                    <button type="button" style={ghostBtn} onClick={toggleShown}>{allShownSelected ? "Deselect shown" : `Select shown (${shown.length})`}</button>
                    <button type="button" style={ghostBtn} onClick={() => setSelected(new Set())} disabled={selected.size === 0}>Clear</button>
                  </div>
                  <div style={{ maxHeight: 340, overflow: "auto", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
                      <thead style={{ position: "sticky", top: 0, background: "#0e131c" }}>
                        <tr><th style={th}></th><th style={th}>Client</th><th style={th}>History</th><th style={th}>Can receive</th><th style={th}>Last sent</th></tr>
                      </thead>
                      <tbody>
                        {shown.length === 0 && <tr><td style={td} colSpan={5}><span style={mutedText}>No clients match.</span></td></tr>}
                        {shown.map((c) => (
                          <tr key={c.key} style={{ background: selected.has(c.key) ? "rgba(14,165,233,0.08)" : "transparent" }}>
                            <td style={td}><input type="checkbox" aria-label={`Select ${c.name}`} checked={selected.has(c.key)} onChange={() => toggle(c.key)} style={{ accentColor: "#0ea5e9" }} /></td>
                            <td style={td}><div style={{ fontWeight: 700 }}>{c.name}</div><div style={mutedText}>{c.email || "no email"} · {c.phone || "no phone"}</div></td>
                            <td style={td}><div>{c.completedCount} visit{c.completedCount === 1 ? "" : "s"}{c.isMaintenance ? " · plan" : ""}</div><div style={mutedText}>{c.lastServiceDate ? `last ${fmtDay(c.lastServiceDate + "T12:00:00")}` : "none yet"}</div></td>
                            <td style={td}>
                              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                {c.emailOk ? <Badge tone="good">Email</Badge> : <Badge tone="muted">{c.emailReason}</Badge>}
                                {c.smsOk ? <Badge tone="good">Text</Badge> : <Badge tone="muted">{c.smsReason}</Badge>}
                                {c.eventOnly && <Badge tone="warn">Event</Badge>}
                              </div>
                            </td>
                            <td style={td}>{c.lastContactedAt ? fmtDay(c.lastContactedAt) : <span style={mutedText}>never</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ ...mutedText, marginTop: 10, lineHeight: 1.6 }}>
                    <strong style={{ color: "#e2e8f0" }}>{selected.size}</strong> selected
                    {useEmail && <> · <strong style={{ color: "#e2e8f0" }}>{emailTargets.length}</strong> will get the email</>}
                    {useSms && <> · <strong style={{ color: "#e2e8f0" }}>{smsTargets.length}</strong> will get the text</>}
                    {selected.size > 0 && (useEmail || useSms) && (
                      <> · {selectedClients.length - targetKeys.length} can't receive on the chosen channel(s)</>
                    )}
                  </div>
                </>
              )}
            </div>

            <div style={card}>
              <div style={{ fontWeight: 800, color: "#f1f5f9", marginBottom: 10 }}>3 · Message</div>
              <div style={{ display: "grid", gap: 12 }}>
                <Field label="Start from a template">
                  <select style={inputStyle} value={presetId} onChange={(e) => applyPreset(e.target.value)}>
                    {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </Field>
                <Field label="Campaign name" hint="(internal — shows in History)">
                  <input style={inputStyle} value={draft.campaignName} onChange={(e) => setField("campaignName", e.target.value)} />
                </Field>
                <Field label="Coupon" hint="(manage codes in the Coupons tab)">
                  <select style={inputStyle} value={draft.couponCode} onChange={(e) => setField("couponCode", e.target.value)}>
                    <option value="">No coupon</option>
                    {coupons.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.discountPercent}% off</option>)}
                  </select>
                </Field>
                <div style={{ ...mutedText, lineHeight: 1.5 }}>Use <code>{"{{firstName}}"}</code> anywhere to insert the client's first name.</div>

                {useEmail && (
                  <div style={{ display: "grid", gap: 12, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 12 }}>
                    <div style={{ fontWeight: 700, color: "#7dd3fc", fontSize: "0.85rem" }}>Email</div>
                    <Field label="Subject"><input style={inputStyle} value={draft.subject} onChange={(e) => setField("subject", e.target.value)} /></Field>
                    <Field label="Preview text" hint="(grey text next to the subject in the inbox)"><input style={inputStyle} value={draft.preheader} onChange={(e) => setField("preheader", e.target.value)} /></Field>
                    <Field label="Small label above headline"><input style={inputStyle} value={draft.kicker} onChange={(e) => setField("kicker", e.target.value)} /></Field>
                    <Field label="Headline"><input style={inputStyle} value={draft.headline} onChange={(e) => setField("headline", e.target.value)} /></Field>
                    <Field label="Body" hint="(blank line = new paragraph)"><textarea style={{ ...inputStyle, minHeight: 150, resize: "vertical" }} value={draft.body} onChange={(e) => setField("body", e.target.value)} /></Field>
                    {coupon && <Field label="Coupon fine print" hint="(optional)"><input style={inputStyle} value={draft.couponNote} onChange={(e) => setField("couponNote", e.target.value)} placeholder="e.g. Valid through Oct 31 · one use per client" /></Field>}
                    <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
                      <Field label="Button text"><input style={inputStyle} value={draft.ctaLabel} onChange={(e) => setField("ctaLabel", e.target.value)} /></Field>
                      <Field label="Button link"><input style={inputStyle} value={draft.ctaUrl} onChange={(e) => setField("ctaUrl", e.target.value)} /></Field>
                    </div>
                  </div>
                )}

                {useSms && (
                  <div style={{ display: "grid", gap: 10, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 12 }}>
                    <div style={{ fontWeight: 700, color: "#7dd3fc", fontSize: "0.85rem" }}>Text message</div>
                    <Field label="Message"><textarea style={{ ...inputStyle, minHeight: 90, resize: "vertical" }} value={draft.smsMessage} onChange={(e) => setField("smsMessage", e.target.value)} /></Field>
                    <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "0.82rem", color: "#cbd5e1" }}>
                      <input type="checkbox" checked={draft.smsMentionCoupon} onChange={(e) => setField("smsMentionCoupon", e.target.checked)} style={{ accentColor: "#0ea5e9" }} disabled={!coupon} />
                      Add the coupon code to the text {!coupon && <span style={mutedText}>(pick a coupon first)</span>}
                    </label>
                    <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "0.82rem", color: "#cbd5e1" }}>
                      <input type="checkbox" checked={draft.smsIncludeLink} onChange={(e) => setField("smsIncludeLink", e.target.checked)} style={{ accentColor: "#0ea5e9" }} />
                      Add the booking link
                    </label>
                    <div style={mutedText}>"Reply STOP to opt out." is always added — it's required.</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── RIGHT: preview + send ── */}
          <div style={{ display: "grid", gap: 16, minWidth: 0, gridTemplateColumns: "minmax(0, 1fr)" }}>
            <div style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontWeight: 800, color: "#f1f5f9" }}>Exactly what they'll see</div>
                {clients && (
                  <select aria-label="Preview as" style={{ ...inputStyle, width: "auto", padding: "6px 10px", fontSize: "0.8rem" }} value={previewClient?.key || ""} onChange={(e) => setPreviewKey(e.target.value)}>
                    {(selectedClients.length ? selectedClients : clients).map((c) => <option key={c.key} value={c.key}>Preview as {c.name}</option>)}
                  </select>
                )}
              </div>

              {useEmail && (
                <>
                  <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, padding: "10px 12px", marginBottom: 10 }}>
                    <div style={{ ...mutedText, fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>Inbox</div>
                    <div style={{ fontWeight: 700, color: "#f1f5f9", fontSize: "0.88rem", marginTop: 2 }}>ATX Prestige Detailing</div>
                    <div style={{ color: "#e2e8f0", fontSize: "0.85rem", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{previewSubject || <span style={mutedText}>(no subject)</span>}</div>
                    <div style={{ ...mutedText, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{draft.preheader}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                    <Chip active={device === "desktop"} onClick={() => setDevice("desktop")}>Desktop</Chip>
                    <Chip active={device === "mobile"} onClick={() => setDevice("mobile")}>Phone</Chip>
                  </div>
                  <div style={{ background: "#e9e6dd", borderRadius: 10, padding: device === "mobile" ? "10px 0" : 0, display: "flex", justifyContent: "center", overflow: "hidden" }}>
                    <iframe ref={iframeRef} title="Email preview" sandbox="allow-same-origin" srcDoc={previewHtml} onLoad={fitIframe}
                      style={{ width: device === "mobile" ? 375 : "100%", maxWidth: "100%", height: iframeH, border: "none", background: "#efece4", display: "block" }} />
                  </div>
                </>
              )}

              {useSms && (
                <div style={{ marginTop: useEmail ? 16 : 0 }}>
                  <div style={{ ...labelStyle, marginTop: 4 }}>Text message</div>
                  <div style={{ maxWidth: 320, margin: "0 auto", background: "#000", borderRadius: 26, padding: "14px 12px 18px", border: "1px solid rgba(255,255,255,0.15)" }}>
                    <div style={{ textAlign: "center", color: "rgba(255,255,255,0.55)", fontSize: "0.7rem", marginBottom: 10 }}>ATX Prestige Detailing<br />Text Message</div>
                    <div style={{ background: "#262629", color: "#fff", borderRadius: "18px 18px 18px 4px", padding: "10px 13px", fontSize: "0.88rem", lineHeight: 1.4, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{previewSms}</div>
                  </div>
                  <div style={{ ...mutedText, textAlign: "center", marginTop: 8 }}>
                    {info.chars} characters · {info.segments} message segment{info.segments === 1 ? "" : "s"} per client
                    {info.unicode && <span style={{ color: "#fbbf24" }}> · contains emoji/special characters (costs more)</span>}
                  </div>
                </div>
              )}
              {!useEmail && !useSms && <div style={mutedText}>Turn on a channel to see the preview.</div>}
            </div>

            <div style={card}>
              <div style={{ fontWeight: 800, color: "#f1f5f9", marginBottom: 10 }}>4 · Test &amp; send</div>
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                  {useSms && <div style={{ flex: 1, minWidth: 150 }}><Field label="Your phone for a test text"><input style={inputStyle} value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="(555) 555-5555" inputMode="tel" /></Field></div>}
                  <button type="button" style={ghostBtn} disabled={testing || (!useEmail && !useSms)} onClick={() => void sendTest()}>
                    {testing ? "Sending test…" : `Send test${useEmail ? " to atxprestigedetailing@gmail.com" : ""}`}
                  </button>
                </div>
                {testMsg.map((m, i) => <div key={i} style={{ fontSize: "0.82rem", color: "#7dd3fc" }}>{m}</div>)}

                {problems.length > 0 && (
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: "0.8rem", color: "#fbbf24", lineHeight: 1.6 }}>{problems.map((p) => <li key={p}>{p}</li>)}</ul>
                )}
                {quotaShort && <div style={{ fontSize: "0.8rem", color: "#fbbf24" }}>Gmail will only allow {meta.emailQuota ?? 0} more emails today — the rest of the list would be skipped. Send in two days, or fewer recipients.</div>}

                <button type="button" style={{ ...primaryBtn, opacity: canReview ? 1 : 0.4, cursor: canReview ? "pointer" : "not-allowed" }} disabled={!canReview} onClick={() => setConfirmOpen(true)}>
                  Review &amp; send to {targetKeys.length} client{targetKeys.length === 1 ? "" : "s"}
                </button>
              </div>

              {results && (
                <div style={{ marginTop: 14, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 12 }}>
                  <div style={{ fontWeight: 700, color: "#f1f5f9", marginBottom: 6 }}>Send finished</div>
                  <div style={{ fontSize: "0.85rem", color: "#e2e8f0", lineHeight: 1.7 }}>
                    <div>✓ {results.filter((r) => r.status === "sent" && r.channel === "email").length} emails sent · {results.filter((r) => r.status === "sent" && r.channel === "sms").length} texts sent</div>
                    {results.some((r) => r.status === "failed" || r.status === "blocked") && (
                      <div style={{ color: "#f87171" }}>✕ Problems: {results.filter((r) => r.status === "failed" || r.status === "blocked").map((r) => `${r.name || r.key} (${r.channel}: ${r.detail})`).join("; ")}</div>
                    )}
                    {results.some((r) => r.status === "skipped") && (
                      <div style={mutedText}>Skipped: {results.filter((r) => r.status === "skipped").map((r) => `${r.name || r.key} (${r.channel}: ${r.detail})`).join("; ")}</div>
                    )}
                  </div>
                  <button type="button" style={{ ...ghostBtn, marginTop: 10 }} onClick={() => setView("history")}>See it in History</button>
                </div>
              )}
              {sendError && <div style={{ marginTop: 12, fontSize: "0.85rem", color: "#f87171" }}>{sendError}</div>}
            </div>
          </div>
        </div>
      )}

      {authed && view === "history" && (
        <div style={{ display: "grid", gap: 14 }}>
          {logLoading && <div style={mutedText}>Loading history…</div>}
          {log && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
                {[["Campaigns", campaigns.length], ["Emails sent", log.filter((e) => e.status === "sent" && e.channel === "email").length], ["Texts sent", log.filter((e) => e.status === "sent" && e.channel === "sms").length], ["Unsubscribed", meta.optOuts]].map(([label, n]) => (
                  <div key={String(label)} style={{ ...card, padding: 12 }}><div style={mutedText}>{label}</div><div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#7dd3fc" }}>{n}</div></div>
                ))}
              </div>
              <input style={inputStyle} placeholder="Find a client — see every message they've been sent" value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} />

              {hq ? (
                <div style={{ ...card, padding: 0, overflow: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
                    <thead><tr><th style={th}>When</th><th style={th}>Client</th><th style={th}>Campaign</th><th style={th}>Channel</th><th style={th}>Status</th></tr></thead>
                    <tbody>
                      {historyMatches.length === 0 && <tr><td style={td} colSpan={5}><span style={mutedText}>Nothing sent to anyone matching "{historySearch}".</span></td></tr>}
                      {historyMatches.map((e, i) => (
                        <tr key={i}><td style={td}>{fmtWhen(e.timestamp)}</td><td style={td}>{e.name}<div style={mutedText}>{e.channel === "email" ? e.email : e.phone}</div></td><td style={td}>{e.campaignName}</td><td style={td}>{e.channel === "sms" ? "Text" : "Email"}</td>
                          <td style={td}><Badge tone={e.status === "sent" ? "good" : "bad"}>{e.status}</Badge>{e.detail && <div style={mutedText}>{e.detail}</div>}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <>
                  {campaigns.length === 0 && <div style={{ ...card, textAlign: "center", color: "rgba(255,255,255,0.45)" }}>No campaigns sent yet. Once you send one, who got it and when shows up here.</div>}
                  {campaigns.map((c) => (
                    <div key={c.id} style={card}>
                      <button type="button" onClick={() => setOpenCampaign(openCampaign === c.id ? "" : c.id)} style={{ all: "unset", cursor: "pointer", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", width: "100%" }}>
                        <div>
                          <div style={{ fontWeight: 800, color: "#f1f5f9" }}>{c.name}</div>
                          <div style={mutedText}>{fmtWhen(c.first)}{c.preview ? ` · "${c.preview}"` : ""}</div>
                        </div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                          {c.emailSent > 0 && <Badge tone="good">{c.emailSent} email{c.emailSent === 1 ? "" : "s"}</Badge>}
                          {c.smsSent > 0 && <Badge tone="good">{c.smsSent} text{c.smsSent === 1 ? "" : "s"}</Badge>}
                          {c.failed > 0 && <Badge tone="bad">{c.failed} problem{c.failed === 1 ? "" : "s"}</Badge>}
                          <span style={mutedText}>{openCampaign === c.id ? "Hide ▲" : "Who ▼"}</span>
                        </div>
                      </button>
                      {openCampaign === c.id && (
                        <div style={{ marginTop: 12, overflow: "auto", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10 }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
                            <thead><tr><th style={th}>When</th><th style={th}>Client</th><th style={th}>Channel</th><th style={th}>Sent to</th><th style={th}>Status</th></tr></thead>
                            <tbody>
                              {c.entries.map((e, i) => (
                                <tr key={i}><td style={td}>{fmtWhen(e.timestamp)}</td><td style={td}>{e.name}</td><td style={td}>{e.channel === "sms" ? "Text" : "Email"}</td><td style={td}>{e.channel === "sms" ? e.phone : e.email}</td>
                                  <td style={td}><Badge tone={e.status === "sent" ? "good" : "bad"}>{e.status}</Badge>{e.detail && <div style={mutedText}>{e.detail}</div>}</td></tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Confirm modal ── */}
      {confirmOpen && (
        <div role="dialog" aria-modal="true" aria-label="Confirm send" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#0e131c", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 16, padding: 22, width: "100%", maxWidth: 460, maxHeight: "90vh", overflow: "auto" }}>
            <div style={{ fontWeight: 800, color: "#f1f5f9", fontSize: "1.1rem", marginBottom: 10 }}>Send "{draft.campaignName}"?</div>
            <div style={{ fontSize: "0.88rem", color: "#e2e8f0", lineHeight: 1.7 }}>
              {useEmail && <div>Emails: <strong>{emailTargets.length}</strong></div>}
              {useSms && <div>Texts: <strong>{smsTargets.length}</strong></div>}
              <div style={mutedText}>This can't be undone. Every send is recorded in History.</div>
            </div>
            {needsAck && (
              <label style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 14, padding: 10, background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.35)", borderRadius: 10, fontSize: "0.8rem", color: "#fde68a", lineHeight: 1.5 }}>
                <input type="checkbox" checked={ackShared} onChange={(e) => setAckShared(e.target.checked)} style={{ marginTop: 3, accentColor: "#fbbf24" }} />
                <span>Texts will send from your main number, the same one used for appointment confirmations and reminders. A client who replies STOP will stop getting those too. (A second Twilio number for marketing avoids this.) I understand.</span>
              </label>
            )}
            {sending ? (
              <div style={{ marginTop: 16 }}>
                <div style={{ height: 8, background: "rgba(255,255,255,0.1)", borderRadius: 4, overflow: "hidden" }}><div style={{ height: "100%", width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`, background: "#0ea5e9", transition: "width .3s" }} /></div>
                <div style={{ ...mutedText, marginTop: 8 }}>Sending… {progress.done} of {progress.total} clients. Keep this window open.</div>
              </div>
            ) : (
              <>
                <div style={{ marginTop: 16 }}>
                  <Field label='Type SEND to confirm'><input style={inputStyle} value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoFocus /></Field>
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
                  <button type="button" style={ghostBtn} onClick={() => { setConfirmOpen(false); setConfirmText(""); setAckShared(false); }}>Cancel</button>
                  <button type="button" style={{ ...primaryBtn, opacity: confirmReady ? 1 : 0.4, cursor: confirmReady ? "pointer" : "not-allowed" }} disabled={!confirmReady} onClick={() => void runSend()}>Send now</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
