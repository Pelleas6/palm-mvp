"use client";
import { useEffect, useMemo, useState } from "react";

const theme = {
  bg: "#FAF7F2", card: "#FFFFFF", border: "#E8E0D0",
  sage: "#7A9E7E", sageLight: "#EFF5F0", sageBorder: "#B5CDB7", sageDark: "#5C7E60",
  gold: "#C9A84C", goldLight: "#FBF6EC", text: "#3A3228", textLight: "#7A6F65",
  error: "#B85C5C", errorLight: "#FDF0F0", errorBorder: "#E8C0C0",
  success: "#5C7E60", successLight: "#EFF5F0", successBorder: "#B5CDB7",
};

const THEMES = [
  { id: "amour",        emoji: "🌹", label: "Amour & Relations",       desc: "Vie sentimentale, liens affectifs, capacité à aimer" },
  { id: "travail",      emoji: "💼", label: "Travail & Carrière",       desc: "Ambitions, talents, réussite professionnelle" },
  { id: "developpement",emoji: "🌱", label: "Développement personnel",  desc: "Évolution intérieure, potentiel, croissance" },
  { id: "finances",     emoji: "💰", label: "Finances & Abondance",     desc: "Rapport à l'argent, ressources, prospérité" },
  { id: "famille",      emoji: "👨‍👩‍👧", label: "Famille & Liens",          desc: "Liens familiaux, ancrage, transmission" },
];

export default function Home() {
  const [leftFile,  setLeftFile]  = useState(null);
  const [rightFile, setRightFile] = useState(null);
  const [prenom,    setPrenom]    = useState("");
  const [nom,       setNom]       = useState("");
  const [email,     setEmail]     = useState("");
  const [dateNaissance, setDateNaissance] = useState("");
  const [themeChoisi,   setThemeChoisi]   = useState("");
  const [leftPreview,   setLeftPreview]   = useState(null);
  const [rightPreview,  setRightPreview]  = useState(null);

  // OTP
  const [otpCode,     setOtpCode]     = useState("");
  const [otpSent,     setOtpSent]     = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpLoading,  setOtpLoading]  = useState(false);
  const [otpError,    setOtpError]    = useState(null);
  const [otpSuccess,  setOtpSuccess]  = useState(null);
  const [emailError,  setEmailError]  = useState(null);

  // Submit
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!leftFile) { setLeftPreview(null); return; }
    const url = URL.createObjectURL(leftFile);
    setLeftPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [leftFile]);

  useEffect(() => {
    if (!rightFile) { setRightPreview(null); return; }
    const url = URL.createObjectURL(rightFile);
    setRightPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [rightFile]);

  useEffect(() => {
    setOtpSent(false); setOtpVerified(false); setOtpCode("");
    setOtpError(null); setOtpSuccess(null);   setEmailError(null);
  }, [email]);

  const canSubmit = useMemo(() => (
    !!leftFile && !!rightFile &&
    prenom.trim().length > 0 && nom.trim().length > 0 &&
    email.trim().length > 0 && dateNaissance.trim().length > 0 &&
    themeChoisi.length > 0 && otpVerified && !loading
  ), [leftFile, rightFile, prenom, nom, email, dateNaissance, themeChoisi, otpVerified, loading]);

  async function safeJson(res) { try { return await res.json(); } catch { return null; } }

  async function handleSendOtp() {
    setEmailError(null); setOtpError(null); setOtpSuccess(null);
    setOtpLoading(true);
    try {
      const res = await fetch("/api/send-otp", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await safeJson(res);
      if (!res.ok) { setEmailError(data?.error || "Erreur lors de l'envoi du code."); return; }
      setOtpSent(true);
      setOtpSuccess("Code envoyé ! Vérifiez votre boîte mail.");
    } catch { setEmailError("Erreur réseau. Réessayez."); }
    finally { setOtpLoading(false); }
  }

  async function handleVerifyOtp() {
    setOtpError(null); setOtpLoading(true);
    try {
      const res = await fetch("/api/verify-otp", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code: otpCode.trim() }),
      });
      const data = await safeJson(res);
      if (!res.ok) { setOtpError(data?.error || "Code incorrect."); return; }
      setOtpVerified(true);
      setOtpSuccess("Email vérifié ✓");
      setOtpError(null);
    } catch { setOtpError("Erreur réseau. Réessayez."); }
    finally { setOtpLoading(false); }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null); setResult(null);
    if (!otpVerified) { setError("Veuillez vérifier votre email avant d'envoyer."); return; }
    try {
      setLoading(true);
      const uploadRes = await fetch("/api/upload", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          left:  { name: leftFile.name,  type: leftFile.type,  size: leftFile.size  },
          right: { name: rightFile.name, type: rightFile.type, size: rightFile.size },
        }),
      });
      const uploadData = await safeJson(uploadRes);
      if (!uploadRes.ok) throw new Error("UPLOAD ERROR\n" + JSON.stringify(uploadData, null, 2));
      const { leftPath, rightPath, leftSignedUrl, rightSignedUrl } = uploadData;
      if (!leftPath || !rightPath || !leftSignedUrl || !rightSignedUrl)
        throw new Error("Réponse upload incomplète : " + JSON.stringify(uploadData, null, 2));
      const [leftPut, rightPut] = await Promise.all([
        fetch(leftSignedUrl,  { method: "PUT", headers: { "Content-Type": leftFile.type  }, body: leftFile  }),
        fetch(rightSignedUrl, { method: "PUT", headers: { "Content-Type": rightFile.type }, body: rightFile }),
      ]);
      if (!leftPut.ok || !rightPut.ok)
        throw new Error("Erreur upload Supabase — left:" + leftPut.status + " right:" + rightPut.status);
      const analyzeRes = await fetch("/api/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leftPath, rightPath, prenom, nom, email, dateNaissance, themeChoisi }),
      });
      const analyzeData = await safeJson(analyzeRes);
      if (!analyzeRes.ok) throw new Error("ANALYZE ERROR\n" + JSON.stringify(analyzeData, null, 2));
      setResult("MAIL_CONFIRMATION");
      setLeftFile(null); setRightFile(null);
    } catch (err) { setError(String(err?.message || err)); }
    finally { setLoading(false); }
  }

  const inputStyle = (hasError) => ({
    width: "100%", padding: "10px 12px", marginTop: 6, borderRadius: 10,
    border: `1.5px solid ${hasError ? theme.error : theme.border}`,
    backgroundColor: hasError ? theme.errorLight : theme.bg,
    color: theme.text, fontSize: 13, outline: "none",
    boxSizing: "border-box", fontFamily: "Georgia, serif", transition: "border-color 0.2s",
  });

  const labelStyle = { fontSize: 11, fontWeight: 700, color: theme.textLight, letterSpacing: "0.05em", textTransform: "uppercase" };

  const seoPages = [
    { label: "Ligne de vie", href: "/" },
    { label: "Ligne de cœur", href: "/ligne-de-coeur" },
    { label: "Ligne de tête", href: "/ligne-de-tete" },
    { label: "Lecture complète", href: "/lecture-complete-des-lignes-de-la-main" },
    { label: "Ligne de vie cassée", href: "/signification-ligne-de-vie-cassee" },
    { label: "Ligne de vie courte", href: "/ligne-de-vie-courte" },
  ];

  return (
    <div style={{ backgroundColor: theme.bg, minHeight: "100vh", fontFamily: "Georgia, serif" }}>
      <style jsx global>{`
        html { scroll-behavior: smooth; }
        @media (max-width: 980px) {
          .heroGrid { grid-template-columns: 1fr !important; gap: 28px !important; }
          .stickyCard { position: static !important; top: auto !important; }
          .navLinks { display: none !important; }
          .navWrap { padding: 0 18px !important; }
          .sectionPad { padding: 40px 18px !important; }
        }
        @media (max-width: 520px) {
          .nameGrid { grid-template-columns: 1fr !important; }
          .footerGrid { grid-template-columns: 1fr !important; gap: 22px !important; }
        }
        .softShadow { box-shadow: 0 8px 40px rgba(0,0,0,0.07); }
        .softShadow2 { box-shadow: 0 6px 24px rgba(0,0,0,0.04); }
        .focusable:focus { outline: 3px solid rgba(201,168,76,0.25); outline-offset: 2px; }
      `}</style>

      {/* NAVBAR */}
      <nav className="navWrap" style={{ position:"sticky", top:0, zIndex:100, backgroundColor:"rgba(250,247,242,0.95)", backdropFilter:"blur(8px)", borderBottom:`1px solid ${theme.border}`, padding:"0 40px", display:"flex", alignItems:"center", justifyContent:"space-between", height:68 }}>
        <a href="/" style={{ display:"flex", alignItems:"center", gap:10, textDecoration:"none" }}>
          <span style={{ fontSize:26 }}>🌿</span>
          <span style={{ fontWeight:700, fontSize:20, color:theme.text, letterSpacing:"0.02em" }}>Ligne de Vie</span>
        </a>
        <div className="navLinks" style={{ display:"flex", alignItems:"center", gap:8 }}>
          <a href="#comment" className="focusable" style={{ fontSize:14, color:theme.textLight, textDecoration:"none", padding:"6px 14px" }}>Comment ça marche</a>
          <a href="#form-card" className="focusable" style={{ fontSize:14, color:theme.textLight, textDecoration:"none", padding:"6px 14px" }}>Thèmes</a>
          <a href="#form-card" className="focusable" style={{ fontSize:14, fontWeight:600, color:"#fff", backgroundColor:theme.sage, textDecoration:"none", padding:"10px 22px", borderRadius:10, marginLeft:8 }}>Commencer mon analyse</a>
        </div>
      </nav>

      {/* HERO */}
      <section className="sectionPad heroGrid" style={{ maxWidth:1100, margin:"0 auto", padding:"64px 40px", display:"grid", gridTemplateColumns:"1fr 1fr", gap:56, alignItems:"start" }}>

        {/* Colonne gauche */}
        <div style={{ minWidth:0, overflowWrap:"break-word" }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:10, fontSize:11, fontWeight:700, color:theme.gold, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:16 }}>
            <span style={{ width:6, height:6, borderRadius:6, backgroundColor:theme.gold, opacity:0.9 }} />
            ✦ Lecture sérieuse · personnalisée · confidentielle
          </div>
          <h1 style={{ fontSize:44, fontWeight:700, color:theme.text, lineHeight:1.2, margin:"0 0 18px" }}>Découvrez ce que votre ligne de vie révèle de vous</h1>
          <p style={{ fontSize:16, color:theme.textLight, lineHeight:1.85, margin:"0 0 20px" }}>Une analyse personnalisée et approfondie de vos deux mains, orientée sur le thème qui vous tient le plus à cœur.</p>
          <p style={{ fontSize:16, color:theme.textLight, lineHeight:1.85, margin:"0 0 20px" }}>Chaque main raconte une histoire différente. La main gauche révèle votre potentiel inné, vos dispositions naturelles et ce que la vie vous a donné à la naissance.</p>
          <p style={{ fontSize:16, color:theme.textLight, lineHeight:1.85, margin:"0 0 20px" }}>La main droite reflète votre vécu, vos choix, les transformations que le temps a façonnées en vous.</p>
          <p style={{ fontSize:16, color:theme.textLight, lineHeight:1.85, margin:"0 0 28px" }}>Lecture rigoureuse et bienveillante — basée uniquement sur ce qui est visible, orientée par le thème que vous choisissez.</p>
          <div style={{ display:"flex", flexWrap:"wrap", gap:10, marginBottom:34 }}>
            {["Analyse personnalisée","Réponse sous 24h","Confidentiel & sécurisé"].map((b) => (
              <span key={b} style={{ fontSize:12, color:theme.sage, border:`1px solid ${theme.sageBorder}`, backgroundColor:theme.sageLight, borderRadius:999, padding:"6px 14px" }}>{b}</span>
            ))}
          </div>

          <div id="comment" style={{ marginTop:10 }}>
            <div style={{ marginBottom:22 }}>
              <div style={{ fontSize:11, letterSpacing:"0.14em", textTransform:"uppercase", color:theme.gold, marginBottom:10 }}>✦ Votre analyse en trois étapes</div>
              <div style={{ fontSize:15, color:theme.textLight, lineHeight:1.7, maxWidth:520 }}>Chaque analyse est réalisée individuellement. Aucune lecture générique.</div>
            </div>
            <div style={{ position:"relative", paddingLeft:36, display:"flex", flexDirection:"column", gap:22 }}>
              <div style={{ position:"absolute", left:14, top:10, bottom:10, width:1, backgroundColor:theme.gold, opacity:0.5 }} />
              {[
                { n:1, title:"Renseignez vos informations",   text:"Votre prénom, votre date de naissance et le thème qui vous guide." },
                { n:2, title:"Ajoutez les photos des deux mains", text:"Paume ouverte, lumière naturelle, lignes nettes." },
                { n:3, title:"Recevez votre lecture par email",   text:"Rapport détaillé transmis sous 24h (hors dimanche). Photos supprimées après traitement." },
              ].map((step) => (
                <div key={step.n} className="softShadow2" style={{ position:"relative", backgroundColor:theme.card, padding:"20px 22px", borderRadius:14, border:`1px solid ${theme.border}` }}>
                  <div style={{ position:"absolute", left:-36, top:22, width:28, height:28, borderRadius:"50%", border:`1.5px solid ${theme.gold}`, backgroundColor:theme.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, color:theme.gold, fontWeight:600 }}>{step.n}</div>
                  <div style={{ fontSize:16, color:theme.text, marginBottom:6 }}>{step.title}</div>
                  <div style={{ fontSize:14, color:theme.textLight, lineHeight:1.7 }}>{step.text}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Colonne droite — Formulaire */}
        <div id="form-card" className="stickyCard softShadow" style={{ backgroundColor:theme.card, borderRadius:16, border:`1px solid ${theme.border}`, padding:"28px 24px", position:"sticky", top:84 }}>
          <div style={{ fontWeight:700, fontSize:16, color:theme.text, marginBottom:4 }}>Commencer mon analyse</div>
          <div style={{ fontSize:12, color:theme.textLight, marginBottom:14 }}>Rapport transmis sous 24h par email (hors dimanche)</div>

          <div style={{ backgroundColor:theme.goldLight, borderRadius:12, padding:"12px 14px", marginBottom:18, border:`1px solid ${theme.border}` }}>
            <div style={{ display:"flex", flexDirection:"column", gap:6, fontSize:12, color:theme.text }}>
              {[{label:"Délai",value:"Sous 24h"},{label:"Confidentialité",value:"Photos supprimées"},{label:"Lecture",value:"Personnalisée"}].map(({label,value}) => (
                <div key={label} style={{ display:"flex", justifyContent:"space-between", gap:14 }}>
                  <span style={{ color:theme.textLight }}>{label}</span>
                  <span style={{ fontWeight:600 }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit}>

            {/* Prénom / Nom */}
            <div className="nameGrid" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
              <div>
                <div style={labelStyle}>Prénom</div>
                <input className="focusable" type="text" value={prenom} placeholder="Marie" style={inputStyle(false)} onChange={(e) => { setPrenom(e.target.value); setError(null); }} />
              </div>
              <div>
                <div style={labelStyle}>Nom</div>
                <input className="focusable" type="text" value={nom} placeholder="Dupont" style={inputStyle(false)} onChange={(e) => { setNom(e.target.value); setError(null); }} />
              </div>
            </div>

            {/* EMAIL + OTP */}
            <div style={{ marginBottom:12 }}>
              <div style={labelStyle}>Email</div>

              <div style={{ display:"flex", gap:8, marginTop:6 }}>
                <input
                  className="focusable" type="email" value={email} placeholder="votre@email.com"
                  disabled={otpVerified}
                  style={{
                    ...inputStyle(!!emailError), marginTop:0, flex:1,
                    opacity: otpVerified ? 0.75 : 1,
                    border: `1.5px solid ${otpVerified ? theme.successBorder : emailError ? theme.error : theme.border}`,
                    backgroundColor: otpVerified ? theme.successLight : emailError ? theme.errorLight : theme.bg,
                  }}
                  onChange={(e) => { setEmail(e.target.value); setError(null); }}
                />
                {!otpVerified && (
                  <button type="button" onClick={handleSendOtp} disabled={!email.trim() || otpLoading}
                    style={{ padding:"0 14px", borderRadius:10, border:"none", backgroundColor: email.trim() && !otpLoading ? theme.sage : theme.border, color: email.trim() && !otpLoading ? "#fff" : theme.textLight, fontSize:12, fontWeight:600, fontFamily:"Georgia, serif", cursor: email.trim() && !otpLoading ? "pointer" : "not-allowed", whiteSpace:"nowrap", transition:"background-color 0.2s" }}>
                    {otpLoading && !otpSent ? "Envoi…" : otpSent ? "Renvoyer" : "Vérifier"}
                  </button>
                )}
                {otpVerified && (
                  <div style={{ display:"flex", alignItems:"center", padding:"0 10px", color:theme.success, fontSize:20, fontWeight:700 }}>✓</div>
                )}
              </div>

              {/* Erreur domaine */}
              {emailError && (
                <div style={{ marginTop:6, padding:"8px 12px", borderRadius:8, backgroundColor:theme.errorLight, border:`1px solid ${theme.errorBorder}`, fontSize:12, color:theme.error, lineHeight:1.5 }}>
                  {emailError}
                </div>
              )}

              {/* Champ code OTP */}
              {otpSent && !otpVerified && (
                <div style={{ marginTop:10 }}>
                  <div style={{ fontSize:11, color:theme.textLight, marginBottom:6 }}>
                    Code envoyé sur <strong>{email}</strong> — valable 10 min
                  </div>
                  <div style={{ display:"flex", gap:8 }}>
                    <input
                      className="focusable" type="text" inputMode="numeric" maxLength={6}
                      value={otpCode} placeholder="_ _ _ _ _ _"
                      style={{ ...inputStyle(!!otpError), marginTop:0, flex:1, letterSpacing:"0.2em", textAlign:"center", fontSize:20, fontWeight:700 }}
                      onChange={(e) => { setOtpCode(e.target.value.replace(/\D/g,"")); setOtpError(null); }}
                    />
                    <button type="button" onClick={handleVerifyOtp} disabled={otpCode.length !== 6 || otpLoading}
                      style={{ padding:"0 14px", borderRadius:10, border:"none", backgroundColor: otpCode.length===6 && !otpLoading ? theme.sage : theme.border, color: otpCode.length===6 && !otpLoading ? "#fff" : theme.textLight, fontSize:12, fontWeight:600, fontFamily:"Georgia, serif", cursor: otpCode.length===6 && !otpLoading ? "pointer" : "not-allowed", transition:"background-color 0.2s" }}>
                      {otpLoading ? "…" : "Confirmer"}
                    </button>
                  </div>
                  {otpError && (
                    <div style={{ marginTop:6, padding:"8px 12px", borderRadius:8, backgroundColor:theme.errorLight, border:`1px solid ${theme.errorBorder}`, fontSize:12, color:theme.error }}>
                      {otpError}
                    </div>
                  )}
                </div>
              )}

              {/* Succès vérifié */}
              {otpVerified && (
                <div style={{ marginTop:6, padding:"8px 12px", borderRadius:8, backgroundColor:theme.successLight, border:`1px solid ${theme.successBorder}`, fontSize:12, color:theme.success }}>
                  Email vérifié ✓
                </div>
              )}
            </div>

            {/* Date de naissance */}
            <div style={{ marginBottom:16 }}>
              <div style={labelStyle}>Date de naissance</div>
              <input className="focusable" type="date" value={dateNaissance} style={inputStyle(false)} onChange={(e) => { setDateNaissance(e.target.value); setError(null); }} />
            </div>

            {/* Thème */}
            <div style={{ marginBottom:16 }}>
              <div style={labelStyle}>Thème de lecture</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:8 }}>
                {THEMES.map((t) => (
                  <div key={t.id} onClick={() => { setThemeChoisi(t.id); setError(null); }}
                    style={{ padding:"10px 12px", borderRadius:12, border:`1.5px solid ${themeChoisi===t.id ? theme.sage : theme.border}`, backgroundColor:themeChoisi===t.id ? theme.sageLight : theme.bg, cursor:"pointer", transition:"all 0.15s" }}>
                    <div style={{ fontSize:18, marginBottom:4 }}>{t.emoji}</div>
                    <div style={{ fontSize:12, fontWeight:700, color:themeChoisi===t.id ? theme.sage : theme.text, lineHeight:1.3 }}>{t.label}</div>
                    <div style={{ fontSize:10, color:theme.textLight, marginTop:3, lineHeight:1.4 }}>{t.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Photos */}
            <div style={{ marginBottom:16 }}>
              <div style={labelStyle}>Photos de vos mains</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop:6 }}>
                {[
                  { side:"left",  label:"Main gauche", file:leftFile,  preview:leftPreview,  setter:setLeftFile  },
                  { side:"right", label:"Main droite", file:rightFile, preview:rightPreview, setter:setRightFile },
                ].map(({ side,label,file,preview,setter }) => (
                  <label key={side} className="focusable" style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:10, borderRadius:12, border:`2px dashed ${file ? theme.sage : theme.border}`, backgroundColor:file ? theme.sageLight : theme.bg, cursor:"pointer", minHeight:92 }}>
                    {preview ? (
                      <img src={preview} alt={label} style={{ maxWidth:"100%", maxHeight:88, borderRadius:8 }} />
                    ) : (
                      <>
                        <span style={{ fontSize:20 }}>🤚</span>
                        <span style={{ fontSize:10, color:theme.textLight, marginTop:4, textAlign:"center" }}>{label}</span>
                        <span style={{ fontSize:10, color:theme.textLight, marginTop:2, textAlign:"center", opacity:0.9 }}>(paume visible)</span>
                      </>
                    )}
                    <input type="file" accept="image/*" style={{ display:"none" }} onChange={(e) => { setter(e.target.files?.[0]||null); setError(null); }} />
                  </label>
                ))}
              </div>
              <div style={{ marginTop:8, fontSize:11, color:theme.textLight, lineHeight:1.5 }}>Conseil : lumière naturelle, pas de flash, main à plat, lignes nettes.</div>
            </div>

            {/* Bouton submit */}
            <button type="submit" disabled={!canSubmit} className="focusable" style={{ width:"100%", padding:"13px 0", borderRadius:12, border:"none", backgroundColor:canSubmit ? theme.sage : theme.border, color:canSubmit ? "#fff" : theme.textLight, fontSize:14, fontWeight:600, fontFamily:"Georgia, serif", cursor:canSubmit ? "pointer" : "not-allowed", letterSpacing:"0.03em", transition:"background-color 0.2s" }}>
              {loading ? "✨ Analyse en cours..." : "✦ Envoyer ma demande"}
            </button>

            {!canSubmit && !loading && (
              <p style={{ textAlign:"center", marginTop:8, fontSize:11, color:theme.textLight }}>
                {!otpVerified && email.trim() ? "Vérifiez votre email pour continuer." : "Remplissez tous les champs + 2 photos pour continuer."}
              </p>
            )}

            <p style={{ textAlign:"center", marginTop:12, fontSize:11, color:theme.textLight, lineHeight:1.5 }}>Données confidentielles. Photos supprimées après analyse.</p>
          </form>
        </div>
      </section>

      {/* ERREUR */}
      {error && (
        <div style={{ maxWidth:760, margin:"24px auto", padding:"0 40px" }}>
          <pre style={{ whiteSpace:"pre-wrap", color:theme.error, fontSize:12, backgroundColor:theme.errorLight, padding:16, borderRadius:10, border:`1px solid ${theme.errorBorder}` }}>{error}</pre>
        </div>
      )}

      {/* RÉSULTAT */}
      {result === "MAIL_CONFIRMATION" && (
        <section style={{ maxWidth:760, margin:"40px auto", padding:"0 40px 60px" }}>
          <div className="softShadow2" style={{ backgroundColor:theme.card, borderRadius:16, border:`1px solid ${theme.border}`, padding:"32px 28px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:18, paddingBottom:14, borderBottom:`1px solid ${theme.border}` }}>
              <div style={{ width:3, height:24, backgroundColor:theme.gold, borderRadius:2 }} />
              <h2 style={{ margin:0, fontSize:18, color:theme.text, fontWeight:700 }}>Demande enregistrée</h2>
            </div>
            <div style={{ fontSize:14, lineHeight:1.85, color:theme.text }}>
              <p style={{ marginTop:0 }}>Merci. Votre demande est en cours d'étude.</p>
              <p>Votre rapport personnalisé vous sera adressé par email sous 24h (hors dimanche).</p>
              <p style={{ marginBottom:0 }}>Pensez à vérifier vos courriers indésirables. Vos photos sont supprimées après traitement.</p>
            </div>
          </div>
        </section>
      )}

      {/* FOOTER */}
      <footer style={{ borderTop:`1px solid ${theme.border}`, backgroundColor:theme.card, padding:"56px 40px 0" }}>
        <div className="footerGrid" style={{ maxWidth:1000, margin:"0 auto", display:"grid", gridTemplateColumns:"2fr 1fr 1fr", gap:48, paddingBottom:48 }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
              <span style={{ fontSize:22 }}>🌿</span>
              <span style={{ fontWeight:700, fontSize:17, color:theme.text }}>Ligne de Vie</span>
            </div>
            <p style={{ fontSize:13, color:theme.textLight, lineHeight:1.7, margin:0, maxWidth:320 }}>Lecture de main personnalisée, orientée par votre thème. Confidentialité, clarté, sérieux.</p>
          </div>
          <div>
            <div style={{ fontWeight:700, fontSize:12, color:theme.text, letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:18 }}>Pages</div>
            {seoPages.map((l) => (<a key={l.label} href={l.href} className="focusable" style={{ fontSize:13, color:theme.textLight, marginBottom:10, textDecoration:"none", display:"block" }}>{l.label}</a>))}
          </div>
          <div>
            <div style={{ fontWeight:700, fontSize:12, color:theme.text, letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:18 }}>Infos</div>
            {[{label:"Comment ça marche",href:"#comment"},{label:"Commencer mon analyse",href:"#form-card"},{label:"Mentions légales",href:"/mentions-legales"},{label:"Confidentialité",href:"/confidentialite"}].map((l) => (
              <a key={l.label} href={l.href} className="focusable" style={{ fontSize:13, color:theme.textLight, marginBottom:10, textDecoration:"none", display:"block" }}>{l.label}</a>
            ))}
          </div>
        </div>
        <div style={{ maxWidth:1000, margin:"0 auto", borderTop:`1px solid ${theme.border}`, padding:"20px 0", display:"flex", justifyContent:"center", alignItems:"center", gap:22, flexWrap:"wrap" }}>
          <span style={{ fontSize:12, color:theme.textLight }}>© 2026 Ligne de Vie</span>
          <span style={{ fontSize:12, color:theme.textLight }}>ma-ligne-de-vie.fr</span>
          <span style={{ fontSize:12, color:theme.textLight }}>Confidentiel · Personnalisé · Sérieux</span>
        </div>
      </footer>
    </div>
  );
}
