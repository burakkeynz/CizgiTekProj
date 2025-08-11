import React, { useEffect, useMemo } from "react";
import { useLanguage } from "./LanguageContext";

const COMMON = ["password", "123456", "qwerty", "111111", "admin", "letmein"];

function evaluatePassword(pw) {
  if (!pw || pw.length === 0)
    return { score: 0, checks: {}, cappedByCommon: false };
  const checks = {
    length: pw.length >= 8,
    lowerUpper: /[a-z]/.test(pw) && /[A-Z]/.test(pw),
    number: /\d/.test(pw),
    symbol: /[^A-Za-z0-9]/.test(pw),
  };
  let points = 0;
  Object.values(checks).forEach((ok) => ok && (points += 1));
  const cappedByCommon =
    COMMON.some((c) => pw.toLowerCase().includes(c)) ||
    /^(\d){6,}$/.test(pw) ||
    /^([a-z]){6,}$/i.test(pw);
  let score = points <= 1 ? 1 : points === 2 ? 2 : 3;
  if (cappedByCommon) score = Math.min(score, 1);
  return { score, checks, cappedByCommon };
}

export default function PasswordStrengthMeter({
  value,
  minimum = 2,
  onValidChange,
  compact = false,
  showWhenEmpty = false,
  style, // <-- NEW
}) {
  const { language } = useLanguage();
  const t = (en, tr) => (language === "tr" ? tr : en);

  const hasValue = !!(value && value.length);
  const hidden = !hasValue && !showWhenEmpty;

  const result = useMemo(() => evaluatePassword(value || ""), [value]);
  const { score, checks, cappedByCommon } = result;
  const valid = score >= minimum;

  useEffect(() => {
    onValidChange && onValidChange(valid);
  }, [valid, onValidChange]);

  const COLORS = {
    off: "var(--input-border)",
    weak: "#ea2e49",
    medium: "#f5a623",
    strong: "#24b47e",
  };
  const label = !hasValue
    ? ""
    : score === 1
    ? t("Weak", "Zayıf")
    : score === 2
    ? t("Medium", "Orta")
    : t("Strong", "Güçlü");

  const bars = [0, 1, 2].map((i) => {
    const active =
      hasValue &&
      ((score === 1 && i === 0) ||
        (score === 2 && i < 2) ||
        (score === 3 && i < 3));
    const color =
      score === 1 ? COLORS.weak : score === 2 ? COLORS.medium : COLORS.strong;
    return (
      <div
        key={i}
        style={{
          flex: 1,
          height: 8,
          borderRadius: 6,
          background: active ? color : COLORS.off,
          transition: "background .18s",
        }}
      />
    );
  });

  const hints = [
    { ok: checks.length, text: t("At least 8 characters", "En az 8 karakter") },
    {
      ok: checks.lowerUpper,
      text: t("Upper & lower case", "Büyük ve küçük harf"),
    },
    { ok: checks.number, text: t("A number", "Bir rakam") },
    { ok: checks.symbol, text: t("A symbol", "Bir sembol") },
  ];

  const srOnly = {
    position: "absolute",
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: "hidden",
    clip: "rect(0,0,0,0)",
    whiteSpace: "nowrap",
    border: 0,
  };

  return (
    <div
      style={{
        marginTop: 6,
        display: hidden ? "none" : "block",
        ...(style || {}),
      }}
    >
      <div style={{ display: "flex", gap: 6, marginBottom: hasValue ? 6 : 0 }}>
        {bars}
      </div>

      {hasValue && (
        <div
          aria-live="polite"
          style={{
            fontSize: 13,
            fontWeight: 700,
            color:
              score === 1
                ? COLORS.weak
                : score === 2
                ? COLORS.medium
                : COLORS.strong,
            marginBottom: compact ? 0 : 6,
          }}
        >
          {label}
          {cappedByCommon &&
            (language === "tr"
              ? " — Çok yaygın bir şifre kalıbı, lütfen değiştirin."
              : " — Too common, please change.")}
        </div>
      )}

      {hasValue && !compact && (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: "6px 0 0 0",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 6,
            fontSize: 12.5,
            color: "var(--text-muted)",
          }}
        >
          {hints.map((h, i) => (
            <li
              key={i}
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <span
                aria-hidden
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: h.ok ? "#24b47e" : "var(--input-border)",
                  border: "1px solid var(--input-border)",
                }}
              />
              {h.text}
            </li>
          ))}
        </ul>
      )}

      {hasValue && (
        <span style={srOnly} aria-live="polite">
          {valid
            ? t("Your password is strong.", "Şifreniz güçlü.")
            : t("Your password is not strong!", "Şifreniz güçlü değil!")}
        </span>
      )}
    </div>
  );
}
