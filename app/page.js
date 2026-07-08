"use client";

import { useEffect, useMemo, useState } from "react";

const theme = {
  bg: "#F7F1E8",
  bg2: "#FFFDF8",
  card: "#FFFFFF",
  cardSoft: "rgba(255,255,255,0.82)",
  border: "#E6D8C3",
  borderStrong: "#D3BE98",
  sage: "#55745A",
  sageDark: "#314D36",
  sageLight: "#EEF5EF",
  sageBorder: "#AFC8B3",
  gold: "#B8933D",
  goldDark: "#8F6D22",
  goldLight: "#FFF7E6",
  text: "#30281F",
  textSoft: "#5F5549",
  textLight: "#85796B",
  error: "#B85C5C",
  errorLight: "#FDF0F0",
  errorBorder: "#E8C0C0",
  success: "#4D7B58",
  successLight: "#EFF7F1",
  successBorder: "#B7D3BD",
};

const THEMES = [
  { id: "amour", emoji: "🌹", label: "Amour & Relations", desc: "Vie sentimentale, liens affectifs, capacité à aimer" },
  { id: "travail", emoji: "💼", label: "Travail & Carrière", desc: "Ambitions, talents, réussite professionnelle" },
  { id: "developpement", emoji: "🌱", label: "Développement personnel", desc: "Évolution intérieure, potentiel, croissance" },
  { id: "finances", emoji: "💰", label: "Finances & Abondance", desc: "Rapport à l'argent, ressources, prospérité" },
  { id: "famille", emoji: "👨‍👩‍👧", label: "Famille & Liens", desc: "Liens familiaux, ancrage, transmission" },
];

const trustItems = [
  { value: "24h", label: "rapport transmis par email" },
  { value: "2 mains", label: "lecture croisée gauche / droite" },
  { value: "privé", label: "photos supprimées après traitement" },
];

const seoPages = [
  { label: "Ligne de vie", href: "/" },
  { label: "Ligne de cœur", href: "/ligne-de-coeur" },
  { label: "Ligne de tête", href: "/ligne-de-tete" },
  { label: "Lecture complète", href: "/lecture-complete-des-lignes-de-la-main" },
  { label: "Ligne de vie cassée", href: "/signification-ligne-de-vie-cassee" },
  { label: "Ligne de vie courte", href: "/ligne-de-vie-courte" },
];

export default function Home() {
  const [leftFile, setLeftFile] = useState(null);
  const [rightFile, setRightFile] = useState(null);
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [dateNaissance, setDateNaissance] = useState("");
  const [themeChoisi, setThemeChoisi] = useState("");
  const [leftPreview, setLeftPreview] = useState(null);
  const [rightPreview, setRightPreview] = useState(null);

  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState(null);
  const [otpSuccess, setOtpSuccess] = useState(null);
  const [emailError, setEmailError] = useState(null);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!leftFile) {
      setLeftPreview(null);
      return;
    }
    const url = URL.createObjectURL(leftFile);
    setLeftPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [leftFile]);

  useEffect(() => {
    if (!rightFile) {
      setRightPreview(null);
      return;
    }
    const url = URL.createObjectURL(rightFile);
    setRightPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [rightFile]);

  useEffect(() => {
    setOtpSent(false);
    setOtpVerified(false);
    setOtpCode("");
    setOtpError(null);
    setOtpSuccess(null);
    setEmailError(null);
  }, [email]);

  const canSubmit = useMemo(
    () =>
      !!leftFile &&
      !!rightFile &&
      prenom.trim().length > 0 &&
      nom.trim().length > 0 &&
      email.trim().length > 0 &&
      dateNaissance.trim().length > 0 &&
      themeChoisi.length > 0 &&
      otpVerified &&
      !loading,
    [leftFile, rightFile, prenom, nom, email, dateNaissance, themeChoisi, otpVerified, loading]
  );

  async function safeJson(res) {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }

  async function handleSendOtp() {
    setEmailError(null);
    setOtpError(null);
    setOtpSuccess(null);
    setOtpLoading(true);

    try {
      const res = await fetch("/api/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await safeJson(res);
      if (!res.ok) {
        setEmailError(data?.error || "Erreur lors de l'envoi du code.");
        return;
      }
      setOtpSent(true);
      setOtpSuccess("Code envoyé. Vérifiez votre boîte mail.");
    } catch {
      setEmailError("Erreur réseau. Réessayez.");
    } finally {
      setOtpLoading(false);
    }
  }

  async function handleVerifyOtp() {
    setOtpError(null);
    setOtpLoading(true);

    try {
      const res = await fetch("/api/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code: otpCode.trim() }),
      });
      const data = await safeJson(res);
      if (!res.ok) {
        setOtpError(data?.error || "Code incorrect.");
        return;
      }
      setOtpVerified(true);
      setOtpSuccess("Email vérifié");
      setOtpError(null);
    } catch {
      setOtpError("Erreur réseau. Réessayez.");
    } finally {
      setOtpLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!otpVerified) {
      setError("Veuillez vérifier votre email avant d'envoyer.");
      return;
    }

    try {
      setLoading(true);

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          left: { name: leftFile.name, type: leftFile.type, size: leftFile.size },
          right: { name: rightFile.name, type: rightFile.type, size: rightFile.size },
        }),
      });

      const uploadData = await safeJson(uploadRes);
      if (!uploadRes.ok) throw new Error("UPLOAD ERROR\n" + JSON.stringify(uploadData, null, 2));

      const { leftPath, rightPath, leftSignedUrl, rightSignedUrl } = uploadData;
      if (!leftPath || !rightPath || !leftSignedUrl || !rightSignedUrl) {
        throw new Error("Réponse upload incomplète : " + JSON.stringify(uploadData, null, 2));
      }

      const [leftPut, rightPut] = await Promise.all([
        fetch(leftSignedUrl, { method: "PUT", headers: { "Content-Type": leftFile.type }, body: leftFile }),
        fetch(rightSignedUrl, { method: "PUT", headers: { "Content-Type": rightFile.type }, body: rightFile }),
      ]);

      if (!leftPut.ok || !rightPut.ok) {
        throw new Error("Erreur upload Supabase — left:" + leftPut.status + " right:" + rightPut.status);
      }

      const checkoutRes = await fetch("/api/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prenom, nom, email, dateNaissance, themeChoisi, leftPath, rightPath }),
      });

      const checkoutData = await safeJson(checkoutRes);
      if (!checkoutRes.ok) throw new Error("CHECKOUT ERROR\n" + JSON.stringify(checkoutData, null, 2));

      if (checkoutData.free) {
        setResult("MAIL_CONFIRMATION");
        setLeftFile(null);
        setRightFile(null);
      } else {
        window.location.href = checkoutData.url;
      }
    } catch (err) {
      setError(String(err?.message || err));
      setLoading(false);
    }
  }

  const inputStyle = (hasError) => ({
    width: "100%",
    padding: "13px 14px",
    marginTop: 7,
    borderRadius: 14,
    border: `1px solid ${hasError ? theme.error : theme.border}`,
    backgroundColor: hasError ? theme.errorLight : "#FFFCF6",
    color: theme.text,
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "Georgia, serif",
    transition: "border-color .2s, box-shadow .2s, background-color .2s",
  });

  const labelStyle = {
    fontSize: 11,
    fontWeight: 800,
    color: theme.textLight,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  };

  const pill = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    padding: "8px 13px",
    background: "rgba(255,255,255,0.72)",
    border: `1px solid ${theme.border}`,
    color: theme.textSoft,
    fontSize: 12,
    fontWeight: 600,
  };

  return (
    <div style={{ minHeight: "100vh", fontFamily: "Georgia, serif", color: theme.text, background: `radial-gradient(circle at 12% 8%, rgba(201,168,76,.16), transparent 32%), radial-gradient(circle at 88% 16%, rgba(85,116,90,.16), transparent 30%), linear-gradient(180deg, ${theme.bg2} 0%, ${theme.bg} 52%, #EFE4D5 100%)` }}>
      <style jsx global>{`
        html { scroll-behavior: smooth; }
        body { margin: 0; }
        * { box-sizing: border-box; }
        .focusable:focus { outline: 3px solid rgba(184,147,61,.22); outline-offset: 2px; }
        .premiumShadow { box-shadow: 0 24px 70px rgba(48,40,31,.12); }
        .softShadow { box-shadow: 0 14px 40px rgba(48,40,31,.08); }
        .themeCard:hover, .uploadCard:hover { transform: translateY(-2px); box-shadow: 0 14px 30px rgba(48,40,31,.08); }
        .primaryCta:hover { filter: brightness(.98); transform: translateY(-1px); }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
        @media (max-width: 980px) {
          .heroGrid { grid-template-columns: 1fr !important; gap: 28px !important; padding: 42px 18px !important; }
          .stickyCard { position: static !important; top: auto !important; }
          .navLinks { display: none !important; }
          .navWrap { padding: 0 18px !important; }
          .heroTitle { font-size: 42px !important; }
          .trustGrid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 560px) {
          .heroTitle { font-size: 34px !important; }
          .nameGrid, .themeGrid, .photoGrid, .footerGrid { grid-template-columns: 1fr !important; }
          .heroActions { flex-direction: column !important; align-items: stretch !important; }
          .heroActions a { text-align: center !important; }
        }
      `}</style>

      <nav className="navWrap" style={{ position: "sticky", top: 0, zIndex: 100, height: 72, padding: "0 42px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,253,248,.82)", backdropFilter: "blur(16px)", borderBottom: `1px solid ${theme.border}` }}>
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
          <span style={{ width: 38, height: 38, borderRadius: 14, display: "grid", placeItems: "center", background: `linear-gradient(135deg, ${theme.sageDark}, ${theme.sage})`, color: "#fff", boxShadow: "0 10px 24px rgba(85,116,90,.22)" }}>✦</span>
          <span style={{ fontWeight: 800, fontSize: 20, color: theme.text, letterSpacing: ".01em" }}>Ligne de Vie</span>
        </a>

        <div className="navLinks" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <a href="#comment" className="focusable" style={{ fontSize: 14, color: theme.textSoft, textDecoration: "none", padding: "8px 14px" }}>Comment ça marche</a>
          <a href="#confiance" className="focusable" style={{ fontSize: 14, color: theme.textSoft, textDecoration: "none", padding: "8px 14px" }}>Confidentialité</a>
          <a href="#form-card" className="focusable primaryCta" style={{ fontSize: 14, fontWeight: 800, color: "#fff", background: `linear-gradient(135deg, ${theme.sageDark}, ${theme.sage})`, textDecoration: "none", padding: "12px 22px", borderRadius: 999, marginLeft: 8, boxShadow: "0 12px 28px rgba(85,116,90,.24)", transition: "all .18s" }}>Commencer</a>
        </div>
      </nav>

      <section className="heroGrid" style={{ maxWidth: 1180, margin: "0 auto", padding: "70px 40px 54px", display: "grid", gridTemplateColumns: "1.08fr .92fr", gap: 58, alignItems: "start" }}>
        <div style={{ minWidth: 0, paddingTop: 14 }}>
          <div style={{ ...pill, marginBottom: 22 }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: theme.gold }} />
            Lecture personnalisée · sérieuse · confidentielle
          </div>
          <h1 className="heroTitle" style={{ fontSize: 58, lineHeight: 1.02, letterSpacing: "-0.045em", margin: "0 0 22px", color: theme.text, fontWeight: 800 }}>
            Découvrez ce que votre ligne de vie révèle de vous
          </h1>

          <p style={{ fontSize: 19, lineHeight: 1.8, color: theme.textSoft, margin: "0 0 24px", maxWidth: 640 }}>
            Une analyse personnalisée et approfondie de vos mains, orientée par le thème qui compte pour vous.
          </p>

          <div className="heroActions" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 30 }}>
            <a href="#form-card" className="focusable primaryCta" style={{ display: "inline-block", color: "#fff", background: `linear-gradient(135deg, ${theme.sageDark}, ${theme.sage})`, padding: "15px 24px", borderRadius: 999, textDecoration: "none", fontSize: 15, fontWeight: 800, boxShadow: "0 18px 38px rgba(85,116,90,.25)", transition: "all .18s" }}>
              Commencer mon analyse
            </a>
            <a href="#comment" className="focusable" style={{ display: "inline-block", color: theme.sageDark, background: "rgba(255,255,255,.7)", border: `1px solid ${theme.border}`, padding: "14px 22px", borderRadius: 999, textDecoration: "none", fontSize: 15, fontWeight: 700 }}>
              Voir les étapes
            </a>
          </div>

          <div style={{ display:"flex", flexWrap:"wrap", gap:10, marginBottom:30 }}>
            {["Analyse personnalisée","Réponse sous 24h","Confidentiel & sécurisé"].map((b) => (
              <span key={b} style={{ fontSize:12, color:theme.sage, border:`1px solid ${theme.sageBorder}`, backgroundColor:theme.sageLight, borderRadius:999, padding:"6px 14px" }}>{b}</span>
            ))}
          </div>

          <div className="trustGrid" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, maxWidth: 700, marginBottom: 38 }}>
            {trustItems.map((item) => (
              <div key={item.value} className="softShadow" style={{ background: "rgba(255,255,255,.72)", border: `1px solid ${theme.border}`, borderRadius: 18, padding: "18px 16px" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: theme.sageDark, marginBottom: 5 }}>{item.value}</div>
                <div style={{ fontSize: 12, color: theme.textLight, lineHeight: 1.45 }}>{item.label}</div>
              </div>
            ))}
          </div>

          <div id="comment" style={{ padding: "28px", borderRadius: 26, background: "rgba(255,255,255,.58)", border: `1px solid ${theme.border}`, backdropFilter: "blur(10px)" }}>
            <div style={{ fontSize: 12, letterSpacing: ".12em", textTransform: "uppercase", color: theme.goldDark, fontWeight: 800, marginBottom: 8 }}>Comment ça marche</div>
            <h2 style={{ margin: "0 0 18px", fontSize: 26, lineHeight: 1.2, color: theme.text }}>Une expérience simple, guidée et confidentielle.</h2>

            <div style={{ display: "grid", gap: 14 }}>
              {[
                { n: "01", title: "Choisissez votre angle de lecture", text: "Sélectionnez le thème principal qui guidera l’analyse." },
                { n: "02", title: "Ajoutez vos deux mains", text: "Main gauche et main droite, paumes visibles, lumière naturelle." },
                { n: "03", title: "Recevez votre rapport", text: "Votre lecture personnalisée est transmise par email sous 24h, hors dimanche." },
              ].map((step) => (
                <div key={step.n} style={{ display: "grid", gridTemplateColumns: "48px 1fr", gap: 16, alignItems: "start", padding: "18px", borderRadius: 18, background: "#fff", border: `1px solid ${theme.border}` }}>
                  <div style={{ width: 42, height: 42, borderRadius: 14, display: "grid", placeItems: "center", color: theme.goldDark, background: theme.goldLight, border: `1px solid ${theme.borderStrong}`, fontSize: 13, fontWeight: 800 }}>{step.n}</div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: theme.text, marginBottom: 5 }}>{step.title}</div>
                    <div style={{ fontSize: 14, color: theme.textLight, lineHeight: 1.65 }}>{step.text}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div id="form-card" className="stickyCard premiumShadow" style={{ position: "sticky", top: 92, borderRadius: 30, padding: 8, background: `linear-gradient(145deg, rgba(255,255,255,.88), rgba(255,247,230,.78))`, border: `1px solid ${theme.borderStrong}` }}>
          <div style={{ borderRadius: 24, background: "rgba(255,255,255,.92)", border: `1px solid ${theme.border}`, padding: "28px 24px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 21, color: theme.text, marginBottom: 5 }}>Commencer mon analyse</div>
                <div style={{ fontSize: 13, color: theme.textLight }}>Rapport personnalisé sous 24h</div>
              </div>
              <div style={{ minWidth: 58, height: 58, borderRadius: 20, display: "grid", placeItems: "center", background: `linear-gradient(135deg, ${theme.goldLight}, #fff)`, border: `1px solid ${theme.border}`, color: theme.goldDark, fontSize: 24 }}>✦</div>
            </div>

            <div id="confiance" style={{ background: `linear-gradient(135deg, ${theme.sageLight}, #fff)`, borderRadius: 18, padding: "14px 16px", marginBottom: 20, border: `1px solid ${theme.sageBorder}` }}>
              <div style={{ display: "grid", gap: 8, fontSize: 12, color: theme.text }}>
                {[
                  ["Paiement", "sécurisé"],
                  ["Photos", "supprimées après analyse"],
                  ["Lecture", "personnalisée, non générique"],
                ].map(([label, value]) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                    <span style={{ color: theme.textLight }}>{label}</span>
                    <span style={{ fontWeight: 800, color: theme.sageDark, textAlign: "right" }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="nameGrid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                <div>
                  <div style={labelStyle}>Prénom</div>
                  <input className="focusable" type="text" value={prenom} placeholder="Marie" style={inputStyle(false)} onChange={(e) => { setPrenom(e.target.value); setError(null); }} />
                </div>
                <div>
                  <div style={labelStyle}>Nom</div>
                  <input className="focusable" type="text" value={nom} placeholder="Dupont" style={inputStyle(false)} onChange={(e) => { setNom(e.target.value); setError(null); }} />
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={labelStyle}>Email</div>
                <div style={{ display: "flex", gap: 8, marginTop: 7 }}>
                  <input
                    className="focusable"
                    type="email"
                    value={email}
                    placeholder="votre@email.com"
                    disabled={otpVerified}
                    style={{
                      ...inputStyle(!!emailError),
                      marginTop: 0,
                      flex: 1,
                      opacity: otpVerified ? 0.78 : 1,
                      border: `1px solid ${otpVerified ? theme.successBorder : emailError ? theme.error : theme.border}`,
                      backgroundColor: otpVerified ? theme.successLight : emailError ? theme.errorLight : "#FFFCF6",
                    }}
                    onChange={(e) => { setEmail(e.target.value); setError(null); }}
                  />
                  {!otpVerified && (
                    <button type="button" onClick={handleSendOtp} disabled={!email.trim() || otpLoading}
                      style={{ padding: "0 15px", borderRadius: 14, border: "none", background: email.trim() && !otpLoading ? `linear-gradient(135deg, ${theme.sageDark}, ${theme.sage})` : theme.border, color: email.trim() && !otpLoading ? "#fff" : theme.textLight, fontSize: 12, fontWeight: 800, fontFamily: "Georgia, serif", cursor: email.trim() && !otpLoading ? "pointer" : "not-allowed", whiteSpace: "nowrap" }}>
                      {otpLoading && !otpSent ? "Envoi…" : otpSent ? "Renvoyer" : "Vérifier"}
                    </button>
                  )}
                  {otpVerified && (
                    <div style={{ display: "flex", alignItems: "center", padding: "0 10px", color: theme.success, fontSize: 22, fontWeight: 800 }}>✓</div>
                  )}
                </div>

                {emailError && (
                  <div style={{ marginTop: 7, padding: "9px 12px", borderRadius: 12, backgroundColor: theme.errorLight, border: `1px solid ${theme.errorBorder}`, fontSize: 12, color: theme.error, lineHeight: 1.5 }}>
                    {emailError}
                  </div>
                )}

                {otpSent && !otpVerified && (
                  <div style={{ marginTop: 11 }}>
                    <div style={{ fontSize: 11, color: theme.textLight, marginBottom: 7 }}>
                      Code envoyé sur <strong>{email}</strong> — valable 10 min
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        className="focusable"
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={otpCode}
                        placeholder="_ _ _ _ _ _"
                        style={{ ...inputStyle(!!otpError), marginTop: 0, flex: 1, letterSpacing: ".2em", textAlign: "center", fontSize: 20, fontWeight: 800 }}
                        onChange={(e) => { setOtpCode(e.target.value.replace(/\D/g, "")); setOtpError(null); }}
                      />
                      <button type="button" onClick={handleVerifyOtp} disabled={otpCode.length !== 6 || otpLoading}
                        style={{ padding: "0 15px", borderRadius: 14, border: "none", background: otpCode.length === 6 && !otpLoading ? `linear-gradient(135deg, ${theme.sageDark}, ${theme.sage})` : theme.border, color: otpCode.length === 6 && !otpLoading ? "#fff" : theme.textLight, fontSize: 12, fontWeight: 800, fontFamily: "Georgia, serif", cursor: otpCode.length === 6 && !otpLoading ? "pointer" : "not-allowed" }}>
                        {otpLoading ? "…" : "Confirmer"}
                      </button>
                    </div>
                    {otpError && (
                      <div style={{ marginTop: 7, padding: "9px 12px", borderRadius: 12, backgroundColor: theme.errorLight, border: `1px solid ${theme.errorBorder}`, fontSize: 12, color: theme.error }}>
                        {otpError}
                      </div>
                    )}
                  </div>
                )}

                {otpVerified && (
                  <div style={{ marginTop: 7, padding: "9px 12px", borderRadius: 12, backgroundColor: theme.successLight, border: `1px solid ${theme.successBorder}`, fontSize: 12, color: theme.success, fontWeight: 700 }}>
                    Email vérifié ✓
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={labelStyle}>Date de naissance</div>
                <input className="focusable" type="date" value={dateNaissance} style={inputStyle(false)} onChange={(e) => { setDateNaissance(e.target.value); setError(null); }} />
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={labelStyle}>Thème de lecture</div>
                <div className="themeGrid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginTop: 9 }}>
                  {THEMES.map((t) => (
                    <div key={t.id} className="themeCard" onClick={() => { setThemeChoisi(t.id); setError(null); }}
                      style={{ padding: "12px", borderRadius: 16, border: `1px solid ${themeChoisi === t.id ? theme.sage : theme.border}`, background: themeChoisi === t.id ? `linear-gradient(135deg, ${theme.sageLight}, #fff)` : "#FFFCF6", cursor: "pointer", transition: "all .16s" }}>
                      <div style={{ fontSize: 20, marginBottom: 5 }}>{t.emoji}</div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: themeChoisi === t.id ? theme.sageDark : theme.text, lineHeight: 1.25 }}>{t.label}</div>
                      <div style={{ fontSize: 10, color: theme.textLight, marginTop: 4, lineHeight: 1.4 }}>{t.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 18 }}>
                <div style={labelStyle}>Photos de vos mains</div>
                <div className="photoGrid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 7 }}>
                  {[
                    { side: "left", label: "Main gauche", file: leftFile, preview: leftPreview, setter: setLeftFile },
                    { side: "right", label: "Main droite", file: rightFile, preview: rightPreview, setter: setRightFile },
                  ].map(({ side, label, file, preview, setter }) => (
                    <label key={side} className="focusable uploadCard" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 12, borderRadius: 18, border: `1.5px dashed ${file ? theme.sage : theme.borderStrong}`, background: file ? theme.sageLight : "#FFFCF6", cursor: "pointer", minHeight: 108, transition: "all .16s" }}>
                      {preview ? (
                        <img src={preview} alt={label} style={{ maxWidth: "100%", maxHeight: 96, borderRadius: 12 }} />
                      ) : (
                        <>
                          <span style={{ fontSize: 22 }}>🤚</span>
                          <span style={{ fontSize: 11, color: theme.textSoft, marginTop: 5, textAlign: "center", fontWeight: 800 }}>{label}</span>
                          <span style={{ fontSize: 10, color: theme.textLight, marginTop: 2, textAlign: "center" }}>paume visible</span>
                        </>
                      )}
                      <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { setter(e.target.files?.[0] || null); setError(null); }} />
                    </label>
                  ))}
                </div>
                <div style={{ marginTop: 9, fontSize: 11, color: theme.textLight, lineHeight: 1.5 }}>
                  Conseil : lumière naturelle, main à plat, lignes nettes, photo non floue.
                </div>
              </div>

              <button type="submit" disabled={!canSubmit} className="focusable primaryCta" style={{ width: "100%", padding: "15px 0", borderRadius: 999, border: "none", background: canSubmit ? `linear-gradient(135deg, ${theme.sageDark}, ${theme.sage})` : theme.border, color: canSubmit ? "#fff" : theme.textLight, fontSize: 15, fontWeight: 800, fontFamily: "Georgia, serif", cursor: canSubmit ? "pointer" : "not-allowed", letterSpacing: ".02em", boxShadow: canSubmit ? "0 16px 34px rgba(85,116,90,.24)" : "none", transition: "all .18s" }}>
                {loading ? "Préparation de votre dossier…" : "Envoyer ma demande"}
              </button>

              {loading && (
                <div style={{ marginTop: 16, padding: "16px 18px", borderRadius: 16, backgroundColor: theme.goldLight, border: `1px solid ${theme.border}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: theme.gold, animation: "pulse 1.5s infinite" }} />
                    <span style={{ fontSize: 13, fontWeight: 800, color: theme.text }}>Dossier en préparation</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: theme.textLight, lineHeight: 1.6 }}>
                    Vos informations sont transmises de façon sécurisée.
                  </p>
                </div>
              )}

              {!canSubmit && !loading && (
                <p style={{ textAlign: "center", marginTop: 10, fontSize: 11, color: theme.textLight }}>
                  {!otpVerified && email.trim() ? "Vérifiez votre email pour continuer." : "Complétez les champs et ajoutez vos deux photos."}
                </p>
              )}

              <p style={{ textAlign: "center", marginTop: 13, fontSize: 11, color: theme.textLight, lineHeight: 1.5 }}>
                Données confidentielles. Photos supprimées après analyse.
              </p>
            </form>
          </div>
        </div>
      </section>

      {error && (
        <div style={{ maxWidth: 760, margin: "24px auto", padding: "0 40px" }}>
          <pre style={{ whiteSpace: "pre-wrap", color: theme.error, fontSize: 12, backgroundColor: theme.errorLight, padding: 16, borderRadius: 14, border: `1px solid ${theme.errorBorder}` }}>{error}</pre>
        </div>
      )}

      {result === "MAIL_CONFIRMATION" && (
        <section style={{ maxWidth: 760, margin: "40px auto", padding: "0 40px 60px" }}>
          <div className="softShadow" style={{ backgroundColor: theme.card, borderRadius: 22, border: `1px solid ${theme.border}`, padding: "32px 28px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, paddingBottom: 14, borderBottom: `1px solid ${theme.border}` }}>
              <div style={{ width: 4, height: 28, backgroundColor: theme.gold, borderRadius: 2 }} />
              <h2 style={{ margin: 0, fontSize: 20, color: theme.text, fontWeight: 800 }}>Demande enregistrée</h2>
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.85, color: theme.text }}>
              <p style={{ marginTop: 0 }}>Merci. Votre demande est en cours d'étude.</p>
              <p>Votre rapport personnalisé vous sera adressé par email sous 24h, hors dimanche.</p>
              <p style={{ marginBottom: 0 }}>Pensez à vérifier vos courriers indésirables. Vos photos sont supprimées après traitement.</p>
            </div>
          </div>
        </section>
      )}

      <footer style={{ borderTop: `1px solid ${theme.border}`, background: "rgba(255,255,255,.72)", padding: "56px 40px 0" }}>
        <div className="footerGrid" style={{ maxWidth: 1080, margin: "0 auto", display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 48, paddingBottom: 48 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <span style={{ width: 34, height: 34, borderRadius: 12, display: "grid", placeItems: "center", background: theme.sageLight, color: theme.sageDark }}>✦</span>
              <span style={{ fontWeight: 800, fontSize: 18, color: theme.text }}>Ligne de Vie</span>
            </div>
            <p style={{ fontSize: 13, color: theme.textLight, lineHeight: 1.7, margin: 0, maxWidth: 340 }}>
              Lecture de main personnalisée, orientée par votre thème. Confidentialité, clarté et présentation soignée.
            </p>
          </div>

          <div>
            <div style={{ fontWeight: 800, fontSize: 12, color: theme.text, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 18 }}>Pages</div>
            {seoPages.map((l) => (
              <a key={l.label} href={l.href} className="focusable" style={{ fontSize: 13, color: theme.textLight, marginBottom: 10, textDecoration: "none", display: "block" }}>{l.label}</a>
            ))}
          </div>

          <div>
            <div style={{ fontWeight: 800, fontSize: 12, color: theme.text, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 18 }}>Infos</div>
            {[
              { label: "Comment ça marche", href: "#comment" },
              { label: "Commencer mon analyse", href: "#form-card" },
              { label: "Mentions légales", href: "/mentions-legales" },
              { label: "Confidentialité", href: "/confidentialite" },
            ].map((l) => (
              <a key={l.label} href={l.href} className="focusable" style={{ fontSize: 13, color: theme.textLight, marginBottom: 10, textDecoration: "none", display: "block" }}>{l.label}</a>
            ))}
          </div>
        </div>

        <div style={{ maxWidth: 1080, margin: "0 auto", borderTop: `1px solid ${theme.border}`, padding: "20px 0", display: "flex", justifyContent: "center", alignItems: "center", gap: 22, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: theme.textLight }}>© 2026 Ligne de Vie</span>
          <span style={{ fontSize: 12, color: theme.textLight }}>ma-ligne-de-vie.fr</span>
          <span style={{ fontSize: 12, color: theme.textLight }}>Confidentiel · Personnalisé · Sérieux</span>
        </div>
      </footer>
    </div>
  );
}
