/**
 * Cloudflare Worker — ReflectivAI Gateway (r10.1)
 * Endpoints: POST /facts, POST /plan, POST /chat, GET/HEAD /health, GET /version, GET /debug/ei
 * Inlined: FACTS_DB, FSM, PLAN_SCHEMA, COACH_SCHEMA, extractCoach()
 *
 * KV namespaces (optional):
 *  - SESS : per-session state (last replies, FSM state)
 *
 * Required VARS:
 *  - PROVIDER_URL    e.g., "https://api.groq.com/openai/v1/chat/completions"
 *  - PROVIDER_MODEL  e.g., "llama-3.1-8b-instant"
 *  - PROVIDER_KEY    bearer key for provider (primary key)
 *  - PROVIDER_KEY_2  optional second key for rotation
 *  - PROVIDER_KEY_3  optional third key for rotation
 *  - PROVIDER_KEYS   optional comma/semicolon separated list of provider keys for round-robin / hashed rotation
 *    Selection strategy: stable hash on session id => key index (avoids per-request randomness & keeps stickiness)
 *    Fallback order: explicit rotation pool > individual keys. If no keys present → 500 config error.
 *  - CORS_ORIGINS    comma-separated allowlist of allowed origins
 *                    REQUIRED VALUES (must include):
 *                      https://reflectivei.github.io/reflectiv-ai
 *                      https://tonyabdelmalak.github.io
 *                      https://tonyabdelmalak.com
 *                      https://www.tonyabdelmalak.com
 *                    Example: "https://reflectivei.github.io/reflectiv-ai,https://tonyabdelmalak.github.io,https://tonyabdelmalak.com,https://www.tonyabdelmalak.com"
 *                    If not set, allows all origins (not recommended for production)
 *  - REQUIRE_FACTS   "true" to require at least one fact in plan
 *  - MAX_OUTPUT_TOKENS optional hard cap (string int)
 */

export default {
  async fetch(req, env) {
    const reqId = req.headers.get("x-req-id") || cryptoRandomId();
    try {
      const url = new URL(req.url);

      // One-time environment validation log
      if (!globalThis.__CFG_LOGGED__) {
        const keyPool = getProviderKeyPool(env);
        const allowed = String(env.CORS_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
        console.log({ event: "startup_config", key_pool_size: keyPool.length, cors_allowlist_size: allowed.length, rotation_strategy: (env.PROVIDER_ROTATION_STRATEGY || 'session') });
        globalThis.__CFG_LOGGED__ = true;
      }

      // CORS preflight
      if (req.method === "OPTIONS") {
        const h = cors(env, req);
        h["x-req-id"] = reqId;
        return new Response(null, { status: 204, headers: h });
      }

      // Health check - supports both GET and HEAD for frontend health checks
      if (url.pathname === "/health" && (req.method === "GET" || req.method === "HEAD")) {
        const deep = url.searchParams.get("deep");
        if (req.method === "HEAD" && !deep) {
          return new Response(null, { status: 200, headers: cors(env, req) });
        }
        if (deep === "1" || deep === "true") {
          const keyPool = getProviderKeyPool(env);
          let provider = { ok: false, status: 0 };
          try {
            const key = selectProviderKey(env, "healthcheck");
            if (key) {
              const r = await fetch((env.PROVIDER_URL || "https://api.groq.com/openai/v1/chat/completions").replace(/\/chat\/completions$/, "/models"), {
                headers: { "authorization": `Bearer ${key}` }, method: "GET"
              });
              provider = { ok: r.ok, status: r.status };
            }
          } catch (e) {
            console.error("health_check_provider_probe_error:", e);
            provider = { ok: false, error: String(e?.message || e) };
          }
          return json({ ok: true, time: Date.now(), key_pool: keyPool.length, provider }, 200, env, req, { "x-req-id": reqId });
        }
        return new Response("ok", { status: 200, headers: { ...cors(env, req), "x-req-id": reqId } });
      }

      // Version endpoint
      if (url.pathname === "/version" && req.method === "GET") {
        return json({ version: "r10.1" }, 200, env, req, { "x-req-id": reqId });
      }

      // Debug EI endpoint - returns basic info about the worker
      if (url.pathname === "/debug/ei" && req.method === "GET") {
        return json({ worker: "ReflectivAI Gateway", version: "r10.1", endpoints: ["/health", "/version", "/debug/ei", "/facts", "/plan", "/chat"], timestamp: new Date().toISOString() }, 200, env, req, { "x-req-id": reqId });
      }

      if (url.pathname === "/facts" && req.method === "POST") return postFacts(req, env);
      if (url.pathname === "/plan" && req.method === "POST") return postPlan(req, env);
      if (url.pathname === "/chat" && req.method === "POST") {
        const ip = req.headers.get("CF-Connecting-IP") || "0.0.0.0";
        const gate = rateLimit(`${ip}:chat`, env);
        if (!gate.ok) {
          const retry = Number(env.RATELIMIT_RETRY_AFTER || 2);
          return json({
            error: {
              type: "rate_limited",
              code: "RATE_LIMIT_EXCEEDED",
              message: "Rate limit exceeded, please retry later",
              source: "worker"
            },
            retry_after_sec: retry
          }, 429, env, req, {
            "Retry-After": String(retry),
            "X-RateLimit-Limit": String(gate.limit),
            "X-RateLimit-Remaining": String(gate.remaining),
            "x-req-id": reqId
          });
        }
        return postChat(req, env);
      }
      if (url.pathname === "/coach-metrics" && req.method === "POST") return postCoachMetrics(req, env);

      return json({ error: "not_found" }, 404, env, req, { "x-req-id": reqId });
    } catch (e) {
      // Log the error for debugging but don't expose details to client
      console.error("Top-level error:", e);
      return json({
        error: { type: "server_error", code: "INTERNAL_ERROR", message: "Internal server error" }
      }, 500, env, req, { "x-req-id": reqId });
    }
  }
};

/* ------------------------- Inlined Knowledge & Rules ------------------------ */

// Comprehensive facts database for all therapeutic areas: HIV, Oncology, Cardiovascular, COVID-19, Vaccines
// Each fact provides AI with clinically accurate, label-aligned reference material for dynamic response generation
const FACTS_DB = [
  // HIV Facts (10 facts)
  { id: "HIV-PREP-ELIG-001", ta: "HIV", topic: "PrEP Eligibility", text: "PrEP is recommended for individuals at substantial risk of HIV acquisition, including those with sexual partners of unknown HIV status, inconsistent condom use, or recent STI diagnoses.", cites: [{ text: "CDC PrEP Guidelines 2024", url: "https://www.cdc.gov/hiv/risk/prep/index.html" }] },
  { id: "HIV-PREP-TAF-002", ta: "HIV", topic: "Descovy for PrEP", text: "Descovy (emtricitabine/tenofovir alafenamide) is indicated for HIV PrEP in at-risk adults and adolescents weighing ≥35 kg, excluding individuals assigned female at birth at risk from receptive vaginal sex.", cites: [{ text: "FDA Label - Descovy PrEP", url: "https://www.accessdata.fda.gov/drugsatfda_docs/label/2021/208215s023lbl.pdf" }, { text: "DISCOVER Trial", url: "https://www.nejm.org/doi/full/10.1056/NEJMoa1917257" }] },
  { id: "HIV-PREP-SAFETY-003", ta: "HIV", topic: "Renal Safety Monitoring", text: "Assess renal function (eGFR, CrCl) and urinalysis before PrEP initiation and monitor every 3-6 months during treatment. Consider dose adjustment or discontinuation if eGFR <50 mL/min.", cites: [{ text: "FDA Label - Descovy", url: "https://www.accessdata.fda.gov/drugsatfda_docs/label/2021/208215s023lbl.pdf" }, { text: "CDC PrEP Guidelines 2024", url: "https://www.cdc.gov/hiv/risk/prep/index.html" }] },
  { id: "HIV-PREP-APRETUDE-004", ta: "HIV", topic: "Apretude (CAB-LA)", text: "Apretude (cabotegravir long-acting injectable) is indicated for PrEP in at-risk adults and adolescents weighing ≥35 kg, administered as 600 mg IM every 2 months after oral lead-in or initial injections.", cites: [{ text: "FDA Label - Apretude", url: "https://www.accessdata.fda.gov/drugsatfda_docs/label/2021/215499s000lbl.pdf" }, { text: "HPTN 083/084 Trials", url: "https://www.nejm.org/doi/full/10.1056/NEJMoa2101016" }] },
  { id: "HIV-TREAT-BIKTARVY-005", ta: "HIV", topic: "Biktarvy for Treatment", text: "Biktarvy (bictegravir/emtricitabine/tenofovir alafenamide) is a complete once-daily single-tablet regimen for treatment-naïve or virologically suppressed adults, demonstrating high barrier to resistance and favorable safety profile.", cites: [{ text: "FDA Label - Biktarvy", url: "https://www.accessdata.fda.gov/drugsatfda_docs/label/2022/210251s028lbl.pdf" }, { text: "Study 1489/1490", url: "https://www.thelancet.com/journals/lancet/article/PIIS0140-6736(18)30356-3/fulltext" }] },
  { id: "HIV-TREAT-CAB-006", ta: "HIV", topic: "Cabenuva Long-Acting", text: "Cabenuva (cabotegravir/rilpivirine long-acting) is a complete monthly or every-2-month injectable regimen for virologically suppressed adults with no current or prior resistance to either component, requiring adherence and injection site management.", cites: [{ text: "FDA Label - Cabenuva", url: "https://www.accessdata.fda.gov/drugsatfda_docs/label/2021/212888s000lbl.pdf" }, { text: "ATLAS/FLAIR Trials", url: "https://www.nejm.org/doi/full/10.1056/NEJMoa1904398" }] },
  { id: "HIV-TREAT-RESISTANCE-007", ta: "HIV", topic: "Resistance Testing", text: "Genotypic resistance testing is recommended before initiating or modifying ART to guide regimen selection, particularly for integrase strand transfer inhibitor (INSTI) resistance mutations.", cites: [{ text: "DHHS Guidelines 2024", url: "https://clinicalinfo.hiv.gov/en/guidelines/hiv-clinical-guidelines-adult-and-adolescent-arv/what-start-antiretroviral-naive-patients" }, { text: "IAS-USA Recommendations", url: "https://jamanetwork.com/journals/jama/fullarticle/2799864" }] },
  { id: "HIV-ADHERENCE-008", ta: "HIV", topic: "Adherence and Viral Suppression", text: "Sustained viral suppression (HIV RNA <50 copies/mL) requires >95% adherence to ART. Long-acting regimens may improve adherence for patients facing daily pill burden challenges.", cites: [{ text: "DHHS Guidelines 2024", url: "https://clinicalinfo.hiv.gov/en/guidelines/hiv-clinical-guidelines-adult-and-adolescent-arv/adherence-antiretroviral-therapy" }, { text: "Clinical Adherence Studies", url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3722218/" }] },
  { id: "HIV-PREP-LAB-009", ta: "HIV", topic: "PrEP Laboratory Monitoring", text: "Before PrEP initiation, confirm negative HIV test, assess HBV status, and perform STI screening. Repeat HIV testing every 3 months and STI screening every 6-12 months during PrEP use.", cites: [{ text: "CDC PrEP Guidelines 2024", url: "https://www.cdc.gov/hiv/risk/prep/index.html" }, { text: "USPSTF Recommendations", url: "https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/prevention-of-human-immunodeficiency-virus-hiv-infection-pre-exposure-prophylaxis" }] },
  { id: "HIV-PREP-ADHERENCE-010", ta: "HIV", topic: "PrEP Adherence Strategies", text: "Daily oral PrEP requires 4-7 doses per week for protective efficacy. Event-driven (on-demand) dosing may be appropriate for cisgender men who have sex with men with predictable sexual activity.", cites: [{ text: "IPERGAY Study", url: "https://www.nejm.org/doi/full/10.1056/NEJMoa1506273" }, { text: "CDC PrEP Guidelines 2024", url: "https://www.cdc.gov/hiv/risk/prep/index.html" }] },

  // Oncology Facts (10 facts)
  { id: "ONC-IO-CHECKPOINT-001", ta: "Oncology", topic: "Immune Checkpoint Inhibitors", text: "Immune checkpoint inhibitors (anti-PD-1, anti-PD-L1, anti-CTLA-4) enhance T-cell mediated anti-tumor immunity and have transformed treatment across multiple solid tumor types, with efficacy often correlating with PD-L1 expression and tumor mutational burden.", cites: [{ text: "NCCN Guidelines - Multiple Tumor Types", url: "https://www.nccn.org/guidelines/category_1" }, { text: "FDA Labels", url: "https://www.fda.gov/drugs/resources-information-approved-drugs" }] },
  { id: "ONC-IO-TOXICITY-002", ta: "Oncology", topic: "Immune-Related Adverse Events", text: "Immune-related adverse events (irAEs) can affect any organ system, most commonly skin, GI, endocrine, and hepatic. Early recognition and corticosteroid management are critical; severe (Grade 3-4) irAEs require treatment interruption and specialist consultation.", cites: [{ text: "ASCO irAE Management Guidelines", url: "https://ascopubs.org/doi/full/10.1200/JCO.17.00577" }, { text: "NCCN IO Toxicity Management", url: "https://www.nccn.org/professionals/physician_gls/pdf/immunotherapy.pdf" }] },
  { id: "ONC-ADC-MECHANISMS-003", ta: "Oncology", topic: "Antibody-Drug Conjugates", text: "Antibody-drug conjugates (ADCs) combine targeted monoclonal antibodies with cytotoxic payloads, delivering chemotherapy selectively to tumor cells expressing specific antigens (e.g., HER2, Trop-2, NECTIN-4).", cites: [{ text: "FDA Labels - ADCs", url: "https://www.fda.gov/drugs/resources-information-approved-drugs" }, { text: "NCCN Guidelines", url: "https://www.nccn.org/guidelines/category_1" }] },
  { id: "ONC-ADC-TOXICITY-004", ta: "Oncology", topic: "ADC Adverse Event Management", text: "ADC-associated toxicities include neutropenia, peripheral neuropathy, ocular toxicity, and interstitial lung disease (ILD). Prophylactic growth factor support, dose modifications, and ophthalmologic monitoring may be required.", cites: [{ text: "FDA Labels - ADCs", url: "https://www.fda.gov/drugs/resources-information-approved-drugs" }, { text: "Clinical Practice Guidelines", url: "https://www.nccn.org/guidelines/category_1" }] },
  { id: "ONC-BIOMARKER-PD-L1-005", ta: "Oncology", topic: "PD-L1 Testing", text: "PD-L1 immunohistochemistry (IHC) expression levels guide patient selection for certain IO therapies. Tumor Proportion Score (TPS) ≥50% or Combined Positive Score (CPS) thresholds vary by indication and agent.", cites: [{ text: "NCCN NSCLC Guidelines", url: "https://www.nccn.org/professionals/physician_gls/pdf/nscl.pdf" }, { text: "FDA Companion Diagnostic Approvals", url: "https://www.fda.gov/medical-devices/in-vitro-diagnostics/list-cleared-or-approved-companion-diagnostic-devices-in-vitro-and-imaging-tools" }] },
  { id: "ONC-BIOMARKER-TMB-006", ta: "Oncology", topic: "Tumor Mutational Burden", text: "Tumor mutational burden (TMB-High, ≥10 mutations/megabase) is an FDA-approved biomarker for pembrolizumab monotherapy in advanced solid tumors after prior treatment, indicating potential for enhanced IO response.", cites: [{ text: "FDA Label - Pembrolizumab", url: "https://www.accessdata.fda.gov/drugsatfda_docs/label/2020/125514s096lbl.pdf" }, { text: "KEYNOTE-158 Trial", url: "https://www.nejm.org/doi/full/10.1056/NEJMoa2005653" }] },
  { id: "ONC-ORAL-ONCOLYTIC-007", ta: "Oncology", topic: "Oral Oncolytic Adherence", text: "Oral oncolytics require patient education on dosing schedules, drug-drug interactions, food effects, and toxicity self-monitoring. Specialty pharmacy support and early refill coordination reduce treatment interruptions.", cites: [{ text: "ASCO/ONS Oral Chemotherapy Standards", url: "https://ascopubs.org/doi/full/10.1200/JOP.2016.016303" }, { text: "NCCN Patient Education", url: "https://www.nccn.org/patients" }] },
  { id: "ONC-ORAL-TOXICITY-008", ta: "Oncology", topic: "Oral TKI Toxicity Management", text: "Tyrosine kinase inhibitors (TKIs) commonly cause diarrhea, rash, hypertension, and hand-foot syndrome. Dose modifications and supportive care (antidiarrheals, topical steroids, antihypertensives) maintain treatment continuity.", cites: [{ text: "NCCN Guidelines - Supportive Care", url: "https://www.nccn.org/professionals/physician_gls/pdf/palliative.pdf" }, { text: "FDA Labels", url: "https://www.fda.gov/drugs/resources-information-approved-drugs" }] },
  { id: "ONC-PATHWAY-INTEGRATION-009", ta: "Oncology", topic: "Clinical Pathway Integration", text: "Evidence-based clinical pathways standardize treatment selection per NCCN categories of evidence and preference, optimizing outcomes while managing cost and toxicity. Pathway adherence requires EHR integration and multidisciplinary tumor board alignment.", cites: [{ text: "ASCO Quality Oncology Practice Initiative", url: "https://www.asco.org/practice-policy/quality-improvement/quality-programs/quality-oncology-practice-initiative" }, { text: "NCCN Clinical Pathways", url: "https://www.nccn.org/guidelines/nccn-evidence-blocks" }] },
  { id: "ONC-SURVIVORSHIP-010", ta: "Oncology", topic: "Survivorship Care Planning", text: "Survivorship care plans document treatment history, potential late effects, surveillance schedules, and transition to primary care. Addressing long-term toxicities (neuropathy, cardiotoxicity, secondary malignancies) is essential.", cites: [{ text: "ASCO Survivorship Guidelines", url: "https://www.asco.org/practice-policy/cancer-care-initiatives/prevention-survivorship" }, { text: "NCCN Survivorship Guidelines", url: "https://www.nccn.org/professionals/physician_gls/pdf/survivorship.pdf" }] },

  // Cardiovascular Facts (10 facts)
  { id: "CV-GDMT-HFREF-001", ta: "Cardiovascular", topic: "HFrEF Guideline-Directed Medical Therapy", text: "Guideline-directed medical therapy (GDMT) for HFrEF includes four pillars: ACE-I/ARB/ARNI, beta-blockers, MRAs, and SGLT2 inhibitors, each providing mortality and hospitalization benefits with additive effects.", cites: [{ text: "ACC/AHA Heart Failure Guidelines 2022", url: "https://www.ahajournals.org/doi/10.1161/CIR.0000000000001063" }, { text: "ESC HF Guidelines 2021", url: "https://academic.oup.com/eurheartj/article/42/36/3599/6358045" }] },
  { id: "CV-ARNI-ENTRESTO-002", ta: "Cardiovascular", topic: "Sacubitril/Valsartan (Entresto)", text: "Sacubitril/valsartan (ARNI) is superior to enalapril in reducing cardiovascular death and HF hospitalization in HFrEF patients (NYHA Class II-IV, EF ≤40%). Requires 36-hour ACE-I washout to avoid angioedema.", cites: [{ text: "PARADIGM-HF Trial", url: "https://www.nejm.org/doi/full/10.1056/NEJMoa1409077" }, { text: "FDA Label - Entresto", url: "https://www.accessdata.fda.gov/drugsatfda_docs/label/2021/207620s019lbl.pdf" }] },
  { id: "CV-SGLT2-HF-003", ta: "Cardiovascular", topic: "SGLT2 Inhibitors in Heart Failure", text: "SGLT2 inhibitors (dapagliflozin, empagliflozin) reduce HF hospitalization and cardiovascular death in HFrEF and HFpEF, independent of diabetes status. Benefits include diuresis, improved renal outcomes, and metabolic effects.", cites: [{ text: "DAPA-HF Trial", url: "https://www.nejm.org/doi/full/10.1056/NEJMoa1911303" }, { text: "EMPEROR-Reduced", url: "https://www.nejm.org/doi/full/10.1056/NEJMoa2022190" }, { text: "ACC/AHA Guidelines", url: "https://www.ahajournals.org/doi/10.1161/CIR.0000000000001063" }] },
  { id: "CV-SGLT2-CKD-004", ta: "Cardiovascular", topic: "SGLT2i in Chronic Kidney Disease", text: "SGLT2 inhibitors slow CKD progression (eGFR decline, ESKD, CV/renal death) in patients with and without diabetes, including CKD Stage 3-4 (eGFR ≥20 mL/min). Initiation safe despite transient eGFR dip.", cites: [{ text: "DAPA-CKD Trial", url: "https://www.nejm.org/doi/full/10.1056/NEJMoa2024816" }, { text: "EMPA-KIDNEY", url: "https://www.nejm.org/doi/full/10.1056/NEJMoa2204233" }, { text: "KDIGO 2022 Guidelines", url: "https://kdigo.org/guidelines/diabetes-ckd/" }] },
  { id: "CV-SGLT2-SAFETY-005", ta: "Cardiovascular", topic: "SGLT2i Safety and Sick Day Rules", text: "SGLT2 inhibitors carry risks of euglycemic DKA (rare), genital mycotic infections, and volume depletion. Educate patients on sick day rules: withhold during acute illness, dehydration, or fasting to prevent DKA.", cites: [{ text: "FDA Safety Communications", url: "https://www.fda.gov/drugs/drug-safety-and-availability/fda-drug-safety-communication-fda-warns-rare-occurrences-serious-infection-genital-area-sglt2" }, { text: "Endocrine Society Guidelines", url: "https://www.endocrine.org/clinical-practice-guidelines" }] },
  { id: "CV-MRA-SPIRONOLACTONE-006", ta: "Cardiovascular", topic: "Mineralocorticoid Receptor Antagonists", text: "Spironolactone and eplerenone reduce mortality in HFrEF (NYHA Class II-IV) when added to ACE-I and beta-blockers. Monitor potassium and renal function; avoid if K+ >5.0 mEq/L or CrCl <30 mL/min.", cites: [{ text: "RALES Trial", url: "https://www.nejm.org/doi/full/10.1056/NEJM199909023411001" }, { text: "EMPHASIS-HF", url: "https://www.nejm.org/doi/full/10.1056/NEJMoa1009492" }, { text: "ACC/AHA Guidelines", url: "https://www.ahajournals.org/doi/10.1161/CIR.0000000000001063" }] },
  { id: "CV-BETA-BLOCKER-007", ta: "Cardiovascular", topic: "Beta-Blockers in HFrEF", text: "Evidence-based beta-blockers (carvedilol, metoprolol succinate, bisoprolol) reduce mortality and hospitalization in stable HFrEF. Initiate at low dose and titrate to target or maximum tolerated dose over weeks.", cites: [{ text: "MERIT-HF Trial", url: "https://www.thelancet.com/journals/lancet/article/PIIS0140-6736(99)04440-2/fulltext" }, { text: "COPERNICUS Trial", url: "https://www.nejm.org/doi/full/10.1056/NEJM200105313442201" }, { text: "ACC/AHA Guidelines", url: "https://www.ahajournals.org/doi/10.1161/CIR.0000000000001063" }] },
  { id: "CV-POST-MI-TRANSITION-008", ta: "Cardiovascular", topic: "Post-MI Discharge GDMT", text: "Post-MI patients with reduced EF should receive GDMT before discharge, including ARNI (if EF ≤40%), beta-blockers, SGLT2i, and statins. Early initiation (within 48-72 hours) improves adherence and outcomes.", cites: [{ text: "ACC/AHA STEMI Guidelines", url: "https://www.ahajournals.org/doi/10.1161/CIR.0000000000000525" }, { text: "ESC Acute MI Guidelines", url: "https://academic.oup.com/eurheartj/article/39/2/119/4095042" }] },
  { id: "CV-TITRATION-CALENDAR-009", ta: "Cardiovascular", topic: "GDMT Titration Protocols", text: "Structured titration protocols with defined follow-up intervals (2-4 weeks) optimize GDMT dosing. Nurse-led HF clinics and remote monitoring support safe up-titration while managing hypotension, bradycardia, and renal function.", cites: [{ text: "ACC/AHA HF Performance Measures", url: "https://www.ahajournals.org/doi/10.1161/HCQ.0000000000000079" }, { text: "HF Society Clinical Practice", url: "https://www.hfsa.org/heart-failure-guidelines" }] },
  { id: "CV-READMISSION-PREVENTION-010", ta: "Cardiovascular", topic: "HF Readmission Reduction Strategies", text: "Transitional care interventions (7-day follow-up, medication reconciliation, patient education, telemonitoring) reduce 30-day HF readmissions. Pharmacy support for copay assistance and prior authorization streamlines GDMT access.", cites: [{ text: "ACC/AHA Quality Measures", url: "https://www.ahajournals.org/doi/10.1161/HCQ.0000000000000079" }, { text: "CMS Hospital Readmissions Program", url: "https://www.cms.gov/medicare/payment/prospective-payment-systems/acute-inpatient-pps/hospital-readmissions-reduction-program-hrrp" }] },

  // COVID-19 Facts (10 facts)
  { id: "COVID-PAXLOVID-INDICATIONS-001", ta: "COVID-19", topic: "Paxlovid Indications and Efficacy", text: "Nirmatrelvir/ritonavir (Paxlovid) is authorized for treatment of mild-to-moderate COVID-19 in high-risk adults and pediatric patients (≥12 years, ≥40 kg) within 5 days of symptom onset, reducing hospitalization/death by ~89% when started early.", cites: [{ text: "FDA EUA - Paxlovid", url: "https://www.fda.gov/emergency-preparedness-and-response/mcm-legal-regulatory-and-policy-framework/paxlovid" }, { text: "EPIC-HR Trial", url: "https://www.nejm.org/doi/full/10.1056/NEJMoa2118542" }, { text: "NIH COVID-19 Treatment Guidelines", url: "https://www.covid19treatmentguidelines.nih.gov/" }] },
  { id: "COVID-PAXLOVID-DDI-002", ta: "COVID-19", topic: "Paxlovid Drug-Drug Interactions", text: "Ritonavir is a strong CYP3A4 inhibitor, causing significant drug-drug interactions with statins, immunosuppressants, anticoagulants, and calcium channel blockers. Review medication list and consider dose adjustments or temporary holds during 5-day course.", cites: [{ text: "FDA EUA - Paxlovid DDI Table", url: "https://www.fda.gov/media/155050/download" }, { text: "Liverpool COVID-19 Drug Interactions", url: "https://www.covid19-druginteractions.org/" }] },
  { id: "COVID-PAXLOVID-REBOUND-003", ta: "COVID-19", topic: "COVID-19 Rebound Phenomenon", text: "Viral and symptom rebound (2-8 days post-treatment) occurs in ~5-10% of Paxlovid-treated patients. Patients should be counseled to isolate if symptoms return and seek re-evaluation; no evidence supports extended or repeat courses.", cites: [{ text: "CDC COVID-19 Clinical Guidance", url: "https://www.cdc.gov/coronavirus/2019-ncov/hcp/clinical-guidance-management-patients.html" }, { text: "NIH Treatment Guidelines", url: "https://www.covid19treatmentguidelines.nih.gov/" }] },
  { id: "COVID-REMDESIVIR-OUTPATIENT-004", ta: "COVID-19", topic: "Remdesivir Outpatient Infusion", text: "Remdesivir 3-day IV course (200 mg day 1, 100 mg days 2-3) is authorized for non-hospitalized high-risk COVID-19 patients within 7 days of symptom onset, reducing hospitalization by 87% in PINETREE trial. Requires infusion capacity.", cites: [{ text: "FDA EUA - Remdesivir", url: "https://www.fda.gov/emergency-preparedness-and-response/mcm-legal-regulatory-and-policy-framework/remdesivir-veklury" }, { text: "PINETREE Trial", url: "https://www.nejm.org/doi/full/10.1056/NEJMoa2116846" }, { text: "NIH Guidelines", url: "https://www.covid19treatmentguidelines.nih.gov/" }] },
  { id: "COVID-HIGH-RISK-CRITERIA-005", ta: "COVID-19", topic: "High-Risk Patient Criteria", text: "High-risk criteria for severe COVID-19 include age ≥65, immunosuppression, obesity (BMI ≥35), chronic lung disease, diabetes, cardiovascular disease, chronic kidney disease, and pregnancy. These patients benefit most from early antiviral treatment.", cites: [{ text: "NIH COVID-19 Treatment Guidelines", url: "https://www.covid19treatmentguidelines.nih.gov/overview/clinical-spectrum/" }, { text: "CDC High-Risk Populations", url: "https://www.cdc.gov/coronavirus/2019-ncov/need-extra-precautions/people-with-medical-conditions.html" }] },
  { id: "COVID-MOLNUPIRAVIR-006", ta: "COVID-19", topic: "Molnupiravir Alternative Therapy", text: "Molnupiravir is authorized for high-risk adults when Paxlovid and remdesivir are not accessible or clinically appropriate. Efficacy (30% hospitalization reduction) is lower than Paxlovid; avoid in pregnancy due to genotoxicity concerns.", cites: [{ text: "FDA EUA - Molnupiravir", url: "https://www.fda.gov/emergency-preparedness-and-response/mcm-legal-regulatory-and-policy-framework/lagevrio-molnupiravir" }, { text: "MOVe-OUT Trial", url: "https://www.nejm.org/doi/full/10.1056/NEJMoa2116044" }, { text: "NIH Guidelines", url: "https://www.covid19treatmentguidelines.nih.gov/" }] },
  { id: "COVID-INITIATION-TIMING-007", ta: "COVID-19", topic: "Early Treatment Initiation", text: "Antiviral efficacy decreases significantly after 5 days of symptoms. Clinical workflows should enable same-day or next-day evaluation, testing, and treatment initiation for high-risk patients to maximize benefit.", cites: [{ text: "NIH Treatment Guidelines", url: "https://www.covid19treatmentguidelines.nih.gov/" }, { text: "CDC Clinical Guidance", url: "https://www.cdc.gov/coronavirus/2019-ncov/hcp/clinical-guidance-management-patients.html" }] },
  { id: "COVID-HOME-INFUSION-008", ta: "COVID-19", topic: "Hospital-at-Home and Infusion Access", text: "Home infusion services enable remdesivir administration for patients with transport barriers or post-discharge needs. Coordination with home health vendors and discharge planning optimizes access and reduces readmissions.", cites: [{ text: "CMS Hospital-at-Home Waiver", url: "https://www.cms.gov/files/document/covid-hospitals-without-walls-fact-sheet.pdf" }, { text: "Infusion Nursing Standards", url: "https://www.ins1.org/" }] },
  { id: "COVID-IMMUNOCOMPROMISED-009", ta: "COVID-19", topic: "Immunocompromised Patient Considerations", text: "Immunocompromised patients (transplant, chemotherapy, HIV with low CD4) may have prolonged viral replication and benefit from extended antiviral courses. Infectious disease consultation is recommended for complex cases.", cites: [{ text: "NIH Guidelines - Special Populations", url: "https://www.covid19treatmentguidelines.nih.gov/special-populations/immunocompromised/" }, { text: "IDSA COVID-19 Guidelines", url: "https://www.idsociety.org/practice-guideline/covid-19-guideline-treatment-and-management/" }] },
  { id: "COVID-MONOCLONAL-ANTIBODIES-010", ta: "COVID-19", topic: "Monoclonal Antibody Considerations", text: "Bebtelovimab and other monoclonal antibodies have limited activity against current Omicron subvariants. Verify current CDC and NIH guidance on authorized mAbs based on regional variant surveillance before prescribing.", cites: [{ text: "NIH COVID-19 Treatment Guidelines", url: "https://www.covid19treatmentguidelines.nih.gov/therapies/anti-sars-cov-2-antibody-products/" }, { text: "CDC Variant Surveillance", url: "https://covid.cdc.gov/covid-data-tracker/#variant-proportions" }] },

  // Vaccines Facts (10 facts)
  { id: "VAC-FLU-RECOMMENDATIONS-001", ta: "Vaccines", topic: "Annual Influenza Vaccination", text: "Annual influenza vaccination is recommended for all persons ≥6 months of age. Inactivated influenza vaccine (IIV) and recombinant influenza vaccine (RIV) are preferred over live attenuated vaccine (LAIV) for most populations.", cites: [{ text: "CDC ACIP Influenza Recommendations 2024-2025", url: "https://www.cdc.gov/flu/prevent/vaccinations.htm" }, { text: "MMWR", url: "https://www.cdc.gov/mmwr/volumes/72/rr/rr7202a1.htm" }] },
  { id: "VAC-FLU-HIGH-DOSE-002", ta: "Vaccines", topic: "Enhanced Flu Vaccines for Older Adults", text: "Adults ≥65 years should receive high-dose inactivated (Fluzone High-Dose), recombinant (Flublok), or adjuvanted (Fluad) influenza vaccines, which provide superior immunogenicity and efficacy compared to standard-dose vaccines.", cites: [{ text: "CDC ACIP Recommendations", url: "https://www.cdc.gov/flu/prevent/vaccinations.htm" }, { text: "FDA Approvals - Enhanced Flu Vaccines", url: "https://www.fda.gov/vaccines-blood-biologics/vaccines/influenza-virus-vaccine" }] },
  { id: "VAC-FLU-TIMING-003", ta: "Vaccines", topic: "Optimal Timing for Flu Vaccination", text: "Influenza vaccination should ideally occur by end of October, but vaccination throughout the influenza season (into January or later) is beneficial. Early vaccination (July-August) may result in waning immunity before season peak.", cites: [{ text: "CDC ACIP Influenza Recommendations", url: "https://www.cdc.gov/flu/prevent/vaccinations.htm" }, { text: "MMWR", url: "https://www.cdc.gov/mmwr/volumes/72/rr/rr7202a1.htm" }] },
  { id: "VAC-PNEUMOCOCCAL-ADULTS-004", ta: "Vaccines", topic: "Pneumococcal Vaccination for Adults", text: "Adults ≥65 years should receive pneumococcal vaccination with PCV15 or PCV20. If PCV15 is used, follow with PPSV23 ≥1 year later. Adults 19-64 with chronic conditions or immunocompromising conditions also require pneumococcal vaccination.", cites: [{ text: "CDC ACIP Pneumococcal Recommendations", url: "https://www.cdc.gov/vaccines/vpd/pneumo/hcp/recommendations.html" }, { text: "MMWR 2022", url: "https://www.cdc.gov/mmwr/volumes/71/wr/mm7104a1.htm" }] },
  { id: "VAC-RSV-OLDER-ADULTS-005", ta: "Vaccines", topic: "RSV Vaccination for Older Adults", text: "A single dose of RSV vaccine (RSVPreF3 or RSVpreF) is recommended for adults ≥60 years using shared clinical decision-making, particularly for those with chronic cardiopulmonary disease or residing in long-term care facilities.", cites: [{ text: "CDC ACIP RSV Recommendations 2023", url: "https://www.cdc.gov/vaccines/vpd/rsv/hcp/older-adults.html" }, { text: "FDA Approvals - RSV Vaccines", url: "https://www.fda.gov/vaccines-blood-biologics/vaccines/respiratory-syncytial-virus-rsv" }] },
  { id: "VAC-SHINGLES-SHINGRIX-006", ta: "Vaccines", topic: "Shingles Vaccination (Shingrix)", text: "Recombinant zoster vaccine (RZV, Shingrix) is recommended for adults ≥50 years as a 2-dose series (0, 2-6 months), providing >90% efficacy against shingles and postherpetic neuralgia. Preferred over live zoster vaccine (ZVL).", cites: [{ text: "CDC ACIP Herpes Zoster Recommendations", url: "https://www.cdc.gov/vaccines/vpd/shingles/hcp/shingrix/recommendations.html" }, { text: "Shingrix Efficacy Trials", url: "https://www.nejm.org/doi/full/10.1056/NEJMoa1501184" }] },
  { id: "VAC-VIS-DOCUMENTATION-007", ta: "Vaccines", topic: "Vaccine Information Statements (VIS)", text: "Federal law requires providing current VIS documents before administering ACIP-recommended vaccines and documenting VIS edition date, vaccine administration date, manufacturer, lot number, and administrator in the patient record.", cites: [{ text: "CDC VIS Requirements", url: "https://www.cdc.gov/vaccines/hcp/vis/about/required-use.html" }, { text: "National Childhood Vaccine Injury Act", url: "https://www.hrsa.gov/vaccine-compensation/index.html" }] },
  { id: "VAC-STANDING-ORDERS-008", ta: "Vaccines", topic: "Standing Orders for Vaccination", text: "Standing orders allow nurses and pharmacists to assess and vaccinate patients without individual physician orders, increasing vaccination rates. Protocols must comply with state scope-of-practice laws and include contraindication screening.", cites: [{ text: "CDC Standing Orders Best Practices", url: "https://www.cdc.gov/vaccines/hcp/admin/standing-orders.html" }, { text: "AMA Policy on Standing Orders", url: "https://www.ama-assn.org/delivering-care/public-health/standing-orders-immunizations" }] },
  { id: "VAC-IMMUNOCOMPROMISED-009", ta: "Vaccines", topic: "Vaccination in Immunocompromised Patients", text: "Immunocompromised patients (transplant, HIV, chemotherapy, immunosuppressive therapy) should receive inactivated vaccines per accelerated schedules and higher doses where indicated (e.g., double-dose hepatitis B). Live vaccines are generally contraindicated.", cites: [{ text: "CDC ACIP Immunocompromised Recommendations", url: "https://www.cdc.gov/vaccines/hcp/acip-recs/general-recs/immunocompetence.html" }, { text: "IDSA Vaccination Guidelines", url: "https://www.idsociety.org/practice-guideline/immunocompromised-host/" }] },
  { id: "VAC-RECALL-SYSTEMS-010", ta: "Vaccines", topic: "Reminder-Recall Systems", text: "EHR-integrated reminder-recall systems using SMS, phone calls, or patient portals improve vaccination coverage. Automated reminders 1-2 weeks before due dates and missed-dose outreach increase completion rates for multi-dose series.", cites: [{ text: "CDC Community Guide - Vaccination", url: "https://www.thecommunityguide.org/pages/task-force-finding-and-rationale-statements.html" }, { text: "AHRQ Health IT Tools", url: "https://www.ahrq.gov/health-it/tools/index.html" }] }
];

// Finite State Machines per mode (5 modes total)
// CAPS INCREASED TO PREVENT CUTOFF - Sales Sim needs room for 4-section format
const FSM = {
  "sales-coach": {
    states: { START: { capSentences: 30, next: "COACH" }, COACH: { capSentences: 30, next: "COACH" } },
    start: "START"
  },
  "sales-simulation": {
    states: { START: { capSentences: 30, next: "COACH" }, COACH: { capSentences: 30, next: "COACH" } },
    start: "START"
  },
  "role-play": {
    states: { START: { capSentences: 12, next: "HCP" }, HCP: { capSentences: 12, next: "HCP" } },
    start: "START"
  },
  "emotional-assessment": {
    states: { START: { capSentences: 20, next: "EI" }, EI: { capSentences: 20, next: "EI" } },
    start: "START"
  },
  "product-knowledge": {
    states: { START: { capSentences: 20, next: "PK" }, PK: { capSentences: 20, next: "PK" } },
    start: "START"
  },
  "general-knowledge": {
    states: { START: { capSentences: 20, next: "GENERAL" }, GENERAL: { capSentences: 20, next: "GENERAL" } },
    start: "START"
  }
};

// JSON Schemas (basic) - Reserved for future JSON schema validation implementation
// These schemas define the expected structure for plan and coach objects
// TODO: Implement JSON schema validation using these schemas
// eslint-disable-next-line no-unused-vars
const PLAN_SCHEMA = {
  type: "object",
  required: ["mode", "disease", "persona", "goal", "facts"],
  properties: {
    mode: { type: "string" },
    disease: { type: "string" },
    persona: { type: "string" },
    goal: { type: "string" },
    facts: {
      type: "array",
      minItems: 1,
      items: {
        type: "object", required: ["id", "text"], properties: {
          id: { type: "string" }, text: { type: "string" }, cites: { type: "array", items: { type: "string" } }
        }
      }
    }
  }
};

// eslint-disable-next-line no-unused-vars
const COACH_SCHEMA = {
  type: "object",
  required: ["scores"],
  properties: {
    overall: { type: "number" },
    score: { type: "number" },
    scores: { type: "object" },
    subscores: { type: "object" },
    worked: { type: "array" },
    improve: { type: "array" },
    phrasing: { type: "string" },
    feedback: { type: "string" },
    context: { type: "object" }
  }
};

/* ------------------------------ Helpers ------------------------------------ */

/**
 * CORS configuration and header builder.
 *
 * IMPORTANT: CORS_ORIGINS must include https://reflectivei.github.io for GitHub Pages deployment.
 *
 * When an origin is allowed, we echo it back in Access-Control-Allow-Origin.
 * When an origin is denied, we log a warning and return "null" to block the request.
 */
function cors(env, req) {
  const reqOrigin = req.headers.get("Origin") || "";
  const allowed = String(env.CORS_ORIGINS || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  // If no allowlist is configured, allow any origin
  // If allowlist exists, check if request origin is in the list
  const isAllowed = allowed.length === 0 || allowed.includes(reqOrigin);

  // Log CORS denials for diagnostics
  if (!isAllowed && reqOrigin) {
    console.warn("CORS deny", { origin: reqOrigin, allowedList: allowed });
  }

  // Determine the Access-Control-Allow-Origin value
  let allowOrigin;
  if (isAllowed && reqOrigin) {
    // Specific origin is allowed and present - echo it back
    allowOrigin = reqOrigin;
  } else if (isAllowed && !reqOrigin) {
    // Allowed but no origin header (e.g., same-origin or non-browser request)
    allowOrigin = "*";
  } else {
    // Not allowed
    allowOrigin = "null";
  }

  const headers = {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "content-type,authorization,x-req-id",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };

  // Only set credentials header when we have a specific origin
  // Cannot use credentials with wildcard origin (*)
  if (allowOrigin !== "*" && allowOrigin !== "null") {
    headers["Access-Control-Allow-Credentials"] = "true";
  }

  return headers;
}

// eslint-disable-next-line no-unused-vars
function ok(body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json", ...headers }
  });
}

function json(body, status, env, req, extraHeaders = {}) {
  const rid = req && typeof req.headers?.get === 'function' ? req.headers.get('x-req-id') : null;
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...cors(env, req), ...(rid ? { "x-req-id": rid } : {}), ...extraHeaders }
  });
}

async function readJson(req) {
  const txt = await req.text();
  if (!txt || txt.trim() === "") {
    return { _parseError: "empty_body" };
  }
  try {
    return JSON.parse(txt);
  } catch {
    return { _parseError: "invalid_json", _rawText: txt.slice(0, 100) };
  }
}

function capSentences(text, n) {
  const parts = String(text || "").replace(/\s+/g, " ").match(/[^.!?]+[.!?]?/g) || [];
  return parts.slice(0, n).join(" ").trim();
}

// ───────────────────── Provider Key Rotation Utilities ──────────────────────
function getProviderKeyPool(env) {
  const pool = [];
  // Comma / semicolon separated list
  if (env.PROVIDER_KEYS) {
    pool.push(
      ...String(env.PROVIDER_KEYS)
        .split(/[;,]/)
        .map(s => s.trim())
        .filter(Boolean)
    );
  }
  // Individual enumerated keys: PROVIDER_KEY, PROVIDER_KEY_2, PROVIDER_KEY_3
  const providerKeyCandidates = ['PROVIDER_KEY', 'PROVIDER_KEY_2', 'PROVIDER_KEY_3'];
  providerKeyCandidates.forEach(k => { 
    if (env[k]) {
      const val = String(env[k]).trim();
      if (val && !pool.includes(val)) pool.push(val);
    }
  });
  // GROQ naming schemes (legacy)
  const groqCandidates = [
    'GROQ_KEY_1', 'GROQ_KEY_2', 'GROQ_KEY_3', 'GROQ_KEY_4', 'GROQ_KEY_5',
    'GROQ_API_KEY', 'GROQ_API_KEY_2', 'GROQ_API_KEY_3', 'GROQ_API_KEY_4', 'GROQ_API_KEY_5'
  ];
  groqCandidates.forEach(k => { 
    if (env[k]) {
      const val = String(env[k]).trim();
      if (val && !pool.includes(val)) pool.push(val);
    }
  });
  return pool.filter(Boolean);
}

function hashString(str) {
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h >>> 0) * 0x01000193;
  }
  return h >>> 0;
}

function selectProviderKey(env, session) {
  const pool = getProviderKeyPool(env);
  if (!pool.length) return null;
  const sid = String(session || "anon");
  const idx = hashString(sid) % pool.length;
  return pool[idx];
}

function sanitizeLLM(s) {
  return String(s || "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/<pre[\s\S]*?<\/pre>/gi, "")
    .replace(/^\s*#{1,6}\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractCoach(raw) {
  const s = String(raw || "");
  const open = s.indexOf("<coach>");
  if (open < 0) return { coach: null, clean: sanitizeLLM(s) };
  const head = s.slice(0, open);
  const tail = s.slice(open + 7);
  const close = tail.indexOf("</coach>");
  const body = close >= 0 ? tail.slice(0, close) : tail;
  const start = body.indexOf("{");
  if (start < 0) return { coach: null, clean: sanitizeLLM(head) };
  let depth = 0, end = -1;
  for (let i = start; i < body.length; i++) {
    const ch = body[i];
    if (ch === "{") depth++;
    if (ch === "}") depth--;
    if (depth === 0) { end = i; break; }
  }
  if (end < 0) return { coach: null, clean: sanitizeLLM(head) };
  let coach = null;
  try {
    coach = JSON.parse(body.slice(start, end + 1));
  } catch {
    // Invalid JSON in coach block - leave coach as null
  }
  const after = close >= 0 ? tail.slice(close + 8) : "";
  return { coach, clean: sanitizeLLM((head + " " + after).trim()) };
}

async function providerChat(env, messages, { maxTokens = 900, temperature = 0.2, session = "anon" } = {}) {
  {
    const key = selectProviderKey(env, session);
    if (!key) throw new Error("NO_PROVIDER_KEY");

    const finalMax = Math.min(maxTokens, parseInt(env.MAX_TOKENS || "900", 10));

    const body = JSON.stringify({
      model: env.PROVIDER_MODEL,
      temperature,
      max_tokens: finalMax,
      messages
    });

    const r = await fetch(env.PROVIDER_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${key}`,
        "user-agent": "ReflectivAI-Worker/1.0",
        "accept": "application/json",
        "accept-encoding": "gzip, deflate"
      },
      body,
      // Add fetch options to help with Cloudflare Worker connectivity
      cf: {
        cacheTtl: 0,
        cacheEverything: false
      }
    });

    const text = await r.text();

    if (!r.ok) {
      console.error({
        event: "provider_error",
        status: r.status,
        body: text.slice(0, 500),
        session
      });
      throw new Error("provider_error_" + r.status);
    }

    let j;
    try {
      j = JSON.parse(text);
    } catch {
      console.error({ event: "provider_json_parse_error", text: text.slice(0, 200) });
      throw new Error("provider_invalid_json");
    }

    const content = j?.choices?.[0]?.message?.content || j?.content;
    if (!content) {
      console.error({ event: "provider_empty_content", json: j });
      throw new Error("provider_empty_content");
    }

    return content;
  }
}

function deterministicScore({ reply, usedFactIds = [] }) {
  const len = (reply || "").split(/\s+/).filter(Boolean).length;
  const base = Math.max(40, Math.min(92, 100 - Math.abs(len - 110) * 0.35));
  const factBonus = Math.min(8, usedFactIds.length * 3);
  return Math.round(base + factBonus);
}

async function seqGet(env, session) {
  if (!env.SESS) return { lastNorm: "", fsm: {} };
  const k = `state:${session}`;
  const v = await env.SESS.get(k, "json");
  return v || { lastNorm: "", fsm: {} };
}
async function seqPut(env, session, state) {
  if (!env.SESS) return;
  await env.SESS.put(`state:${session}`, JSON.stringify(state), { expirationTtl: 60 * 60 * 12 });
}
const norm = s => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();

/* ------------------------------ /facts ------------------------------------- */
async function postFacts(req, env) {
  try {
    const { disease, topic, limit = 6 } = await readJson(req);
    const out = FACTS_DB.filter(f => {
      const dOk = !disease || f.ta?.toLowerCase() === String(disease).toLowerCase();
      const tOk = !topic || f.topic?.toLowerCase().includes(String(topic).toLowerCase());
      return dOk && tOk;
    }).slice(0, limit);
    return json({ facts: out }, 200, env, req);
  } catch (e) {
    console.error("postFacts error:", e);
    return json({ error: "server_error", message: "Failed to fetch facts" }, 500, env, req);
  }
}

/* ------------------------------ /plan -------------------------------------- */
async function postPlan(req, env) {
  try {
    const body = await readJson(req);
    const { mode = "sales-coach", disease = "", persona = "", goal = "", topic = "" } = body || {};

    const factsRes = FACTS_DB.filter(f => {
      const dOk = !disease || f.ta?.toLowerCase() === String(disease).toLowerCase();
      const tOk = !topic || f.topic?.toLowerCase().includes(String(topic).toLowerCase());
      return dOk && tOk;
    });
    const facts = factsRes.slice(0, 8);
    if (env.REQUIRE_FACTS === "true" && facts.length === 0)
      return json({ error: "no_facts_for_request" }, 422, env, req);

    const plan = {
      planId: cryptoRandomId(),
      mode, disease, persona, goal,
      facts: facts.map(f => ({ id: f.id, text: f.text, cites: f.cites || [] })),
      fsm: FSM[mode] || FSM["sales-coach"]
    };

    const valid = Array.isArray(plan.facts) && plan.facts.length > 0 && typeof plan.mode === "string";
    if (!valid) return json({ error: "invalid_plan" }, 422, env, req);

    return json(plan, 200, env, req);
  } catch (e) {
    console.error("postPlan error:", e);
    return json({ error: "server_error", message: "Failed to create plan" }, 500, env, req);
  }
}

/* ------------------------------ Validators --------------------------------- */

/**
 * validateModeResponse - Enforce mode-specific guardrails and clean responses
 * @param {string} mode - Current mode (sales-coach, role-play, emotional-assessment, product-knowledge)
 * @param {string} reply - AI response text
 * @param {object} coach - Coach metadata object
 * @returns {object} - { reply: cleanedReply, warnings: [...], violations: [...] }
 */
function validateModeResponse(mode, reply, coach) {
  let cleaned = reply;
  const warnings = [];
  const violations = [];

  // ROLE-PLAY: Enforce HCP-only voice, NO coaching language
  if (mode === "role-play") {
    // AGGRESSIVE CLEANUP: Remove any coaching patterns that leaked through
    // These patterns indicate mode drift and must be stripped
    const coachingPatterns = [
      /Challenge:/i,
      /Rep Approach:/i,
      /Impact:/i,
      /Suggested Phrasing:/i,
      /Coach Guidance:/i,
      /Next-Move Planner:/i,
      /Risk Flags:/i,
      /Sales Coach/i,
      /<coach>[\s\S]*?<\/coach>/gi
    ];

    // First pass: detect violations
    for (const pattern of coachingPatterns) {
      if (pattern.test(cleaned)) {
        violations.push(`coaching_leak_detected: ${pattern.source}`);
        // Strip from match point onward (truncate at first coaching pattern)
        cleaned = cleaned.split(pattern)[0].trim();
      }
    }

    // Second pass: aggressive pattern removal for any remaining fragments
    cleaned = cleaned
      .replace(/Challenge:/gi, '')
      .replace(/Rep Approach:/gi, '')
      .replace(/Impact:/gi, '')
      .replace(/Suggested Phrasing:/gi, '')
      .replace(/Coach Guidance:/gi, '')
      .replace(/Next-Move Planner:/gi, '')
      .replace(/Risk Flags:/gi, '')
      .replace(/Sales Coach/gi, '')
      .replace(/<coach>[\s\S]*?<\/coach>/gi, '');

    // Remove meta-coaching phrases that indicate drift
    const metaPatterns = [
      /\bYou should have\b/gi,
      /\bThe rep should\b/gi,
      /\bThe rep\b/gi,
      /\bYour approach\b/gi,
      /\bYour response\b/gi,
      /\bThis demonstrates\b/gi,
      /\bThis shows\b/gi
    ];

    for (const pattern of metaPatterns) {
      if (pattern.test(cleaned)) {
        violations.push(`meta_coaching_detected: ${pattern.source}`);
        // Remove these phrases
        cleaned = cleaned.replace(pattern, '');
      }
    }

    // Remove JSON fragments that indicate scoring leaked through
    cleaned = cleaned
      .replace(/"scores"\s*:\s*\{[\s\S]*?\}/gi, '')
      .replace(/"rubric_version"\s*:\s*"[^"]*"/gi, '')
      .replace(/"worked"\s*:\s*\[[\s\S]*?\]/gi, '')
      .replace(/"improve"\s*:\s*\[[\s\S]*?\]/gi, '');

    // Clean up any malformed text from aggressive removal
    cleaned = cleaned
      .replace(/\n{3,}/g, '\n\n')  // Max 2 consecutive newlines
      .replace(/^\s+|\s+$/g, '')   // Trim whitespace
      .replace(/\s{2,}/g, ' ')     // Collapse multiple spaces
      .trim();

    // Ensure HCP stays in first person (this is GOOD behavior)
    if (/\b(we evaluate|from my perspective|I think|I prioritize)/i.test(cleaned)) {
      warnings.push("hcp_first_person_detected_ok");
    }

    // If after all cleanup, response is too short or empty, flag it
    if (cleaned.length < 10) {
      violations.push("role_play_response_too_short_after_cleanup");
    }
  }

  // SALES-COACH: Strict contract enforcement
  if (mode === "sales-coach") {
    // Detect HCP voice (indicates mode drift to role-play)
    const hcpVoicePatterns = [
      /^I'm a (busy|difficult|engaged)/i,
      /^From my clinic's perspective/i,
      /^We don't have time for/i,
      /^I've got a few minutes/i,
      /^I assess (risk|patients)/i,
      /^We evaluate/i,
      /^My practice/i,
      /^In my experience/i
    ];
    for (const pattern of hcpVoicePatterns) {
      if (pattern.test(cleaned)) {
        violations.push(`hcp_voice_in_sales_coach: ${pattern.source}`);
        // This is a critical error - sales coach should NEVER speak as HCP
      }
    }
    
    // Strictly enforce 4 headers in order
    const headers = ["Challenge:", "Rep Approach:", "Impact:", "Suggested Phrasing:"];
    let lastIdx = -1;
    for (const h of headers) {
      const idx = cleaned.indexOf(h);
      if (idx < 0 || idx < lastIdx) {
        violations.push(`missing_or_misordered_header:${h}`);
      }
      lastIdx = idx;
    }
    
    // Rep Approach: exactly 3 bullets
    const repMatch = cleaned.match(/Rep Approach:[\s\S]*?(\n|\r|\r\n)([•-].+?)(\n|\r|\r\n)([•-].+?)(\n|\r|\r\n)([•-].+?)(?=\n|\r|\r\n|Impact:)/);
    if (!repMatch) violations.push("rep_approach_wrong_bullet_count");
    
    // <coach> block - check the passed coach object instead of looking for <coach> in cleaned text
    // (cleaned text has <coach> block already extracted and removed)
    if (!coach || typeof coach !== 'object') {
      violations.push("missing_coach_block");
    } else {
      const requiredMetrics = ["empathy","clarity","compliance","discovery","objection_handling","confidence","active_listening","adaptability","action_insight","resilience"];
      for (const k of requiredMetrics) {
        if (!coach.scores || typeof coach.scores[k] !== "number" || coach.scores[k] < 1 || coach.scores[k] > 5) {
          violations.push(`missing_or_invalid_metric:${k}`);
        }
      }
      const requiredKeys = ["scores","rationales","worked","improve","feedback","rubric_version"];
      for (const k of requiredKeys) {
        if (!(k in coach)) {
          violations.push(`missing_coach_key:${k}`);
        }
      }
    }
  }

  // PRODUCT-KNOWLEDGE: Flexible validation (citations encouraged but not required)
  if (mode === "product-knowledge") {
    // Warn if no citations (but don't fail validation)
    const citationMatch = cleaned.match(/\[\d+\]/);
    if (!citationMatch) {
      warnings.push("no_inline_citations_provided");
    } else {
      // If citations exist, validate References section
      const refMatch = cleaned.match(/References:\s*([\s\S]+)/);
      if (!refMatch) {
        warnings.push("has_citations_but_missing_references_section");
      } else {
        const refs = refMatch[1].split(/\n|\r|\r\n/).filter(l => /^\d+\. /.test(l));
        if (refs.length === 0) warnings.push("references_section_has_no_numbered_entries");
        for (let i = 0; i < refs.length; i++) {
          if (!cleaned.includes(`[${i + 1}]`)) warnings.push(`reference_${i + 1}_cited_but_not_used_inline`);
          if (!refs[i].match(/https?:\/\//)) warnings.push(`reference_${i + 1}_missing_url`);
        }
      }
    }
    // No sales-coach headings or <coach> blocks (this is a violation)
    if (/Challenge:|Rep Approach:|Impact:|Suggested Phrasing:|<coach>/i.test(cleaned)) {
      violations.push("sales_coach_headings_or_coach_block_present");
    }
  }

  // EMOTIONAL-ASSESSMENT: Verify Socratic questions
  if (mode === "emotional-assessment") {
    const questionCount = (cleaned.match(/\?/g) || []).length;
    if (questionCount === 0) {
      warnings.push("no_socratic_questions_detected");
    } else if (questionCount >= 2) {
      warnings.push(`socratic_questions_present: ${questionCount}`);
    }
  }

  // GENERAL-KNOWLEDGE: No strict validation - allow any format
  // This mode is for general assistant queries and should be flexible
  if (mode === "general-knowledge") {
    // No violations for general-knowledge - it's a flexible general-purpose assistant
    // Just ensure no sales-coach or product-knowledge specific formatting leaked in
    if (/Challenge:|Rep Approach:|Impact:|Suggested Phrasing:/i.test(cleaned)) {
      warnings.push("sales_coach_headings_detected_in_general_mode");
    }
  }

  return { reply: cleaned, warnings, violations };
}

/**
 * validateCoachSchema - Ensure _coach object has required fields per mode
 */
function validateCoachSchema(coach, mode) {
  const requiredFields = {
    "sales-coach": ["scores", "worked", "improve", "feedback"],
    "emotional-assessment": ["scores"],
    "product-knowledge": [],
    "role-play": ["scores"]
  };

  const required = requiredFields[mode] || [];
  const missing = required.filter(key => !(coach && key in coach));

  return { valid: missing.length === 0, missing };
}

/* ------------------------------ Alora Site Assistant ----------------------- */
async function handleAloraChat(body, env, req) {
  // Alora payload: { role: 'alora', site: 'reflectivai', persona, site_context, message }
  const message = body.message || "";
  const siteContext = body.site_context || "";
  const persona = body.persona || "You are Alora, a friendly and professional site assistant for ReflectivAI.";

  // Build concise system prompt for Alora
  const systemPrompt = `${persona}

You answer questions about ReflectivAI's platform, features, emotional intelligence framework, simulations, analytics, pricing, and integrations.

RESPONSE RULES:
- Keep answers SHORT (2-4 sentences max)
- Be friendly, conversational, and helpful
- DO NOT use coaching format (no "Challenge:", "Rep Approach:", etc.)
- DO NOT use numbered lists or bullet points unless absolutely necessary
- Focus on direct, clear answers
- If you don't know something from the context, suggest they request a demo or contact the team

SITE CONTEXT:
${siteContext.slice(0, 12000)}`;

  try {
    const key = selectProviderKey(env, "alora-" + cryptoRandomId());
    if (!key) throw new Error("NO_PROVIDER_KEY");

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: message }
    ];

    const payload = {
      model: env.PROVIDER_MODEL || "llama-3.1-8b-instant",
      messages,
      temperature: 0.7,
      max_tokens: 200, // Keep Alora responses short
      stream: false
    };

    const providerResp = await fetch(env.PROVIDER_URL || "https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!providerResp.ok) {
      const errText = await providerResp.text();
      console.error("alora_provider_error", { status: providerResp.status, error: errText });
      throw new Error(`Provider error: ${providerResp.status}`);
    }

    const data = await providerResp.json();
    const reply = data.choices?.[0]?.message?.content || "I'm having trouble responding right now. Please try again or contact our team.";

    return json({ reply: reply.trim() }, 200, env, req);
  } catch (e) {
    console.error("alora_chat_error", { message: e.message, stack: e.stack });
    return json({
      error: "alora_error",
      message: "Unable to process request",
      reply: "I'm having trouble right now. You can still explore the Coach, view Platform modules, or request a demo."
    }, 500, env, req);
  }
}

/* ------------------------------ /chat -------------------------------------- */
/**
 * POST /chat - Main chat endpoint
 * 
 * REQUEST CONTRACT (aligned with widget.js and Phase 3 tests):
 * 
 * Required fields:
 * - mode: string                       // One of: "sales-coach", "role-play", "product-knowledge", "emotional-assessment", "general-knowledge"
 *                                      // Also accepts "sales-simulation" (normalized to "sales-coach")
 *                                      // If missing or empty, defaults to "sales-coach"
 * - messages: Array<{role, content}>  // Must have at least one message with role="user" and non-empty content
 * 
 * Optional fields (all are truly optional - worker provides defaults):
 * - disease: string                    // Therapeutic area context (e.g., "HIV", "Oncology")
 * - persona: string                    // HCP profile (e.g., "Infectious Disease Specialist")
 * - goal: string                       // Conversation goal
 * - scenarioId: string                 // Scenario identifier
 * - eiContext: string                  // EI framework content (for emotional-assessment mode; falls back to hardcoded CASEL)
 * - plan: object                       // Pre-generated plan
 * - planId: string                     // Plan identifier
 * - session: string                    // Session identifier for state tracking
 * - threadId: string                   // Thread identifier for conversation continuity
 * 
 * VALIDATION RULES:
 * 1. messages array must not be empty
 * 2. At least one message must have role="user"
 * 3. User message content must not be empty/whitespace after trim
 * 4. mode is normalized (sales-simulation → sales-coach) and defaults to "sales-coach" if missing
 * 5. All other fields are optional and worker provides sensible defaults
 * 
 * RESPONSE STATUS CODES:
 * - 200: Success with { reply, coach, plan, _meta }
 * - 400: Bad request (malformed JSON, empty messages array, no user message, empty user content)
 * - 429: Rate limit exceeded
 * - 502: Provider unavailable or network error (valid request, but provider failed)
 * 
 * IMPORTANT: Missing optional fields like persona, disease, goal should NOT return 400.
 * They may affect behavior (e.g., EI mode wiring, prompt context) but are not validation errors.
 */
async function postChat(req, env) {
  const reqStart = Date.now();
  const reqId = req.headers.get("x-req-id") || cryptoRandomId();

  try {
    // Defensive check: ensure at least one provider key is configured
    const keyPool = getProviderKeyPool(env);
    if (!keyPool.length) {
      console.error("chat_error", { req_id: reqId, step: "config_check", message: "NO_PROVIDER_KEYS" });
      return json({
        error: { type: "server_error", code: "NO_PROVIDER_KEYS", message: "No provider API keys configured" }
      }, 500, env, req);
    }

    const body = await readJson(req);

    // Check for JSON parse errors
    if (body._parseError) {
      console.error("chat_error", { req_id: reqId, step: "json_parse", error: body._parseError, raw: body._rawText });
      return json({
        error: {
          type: "bad_request",
          code: body._parseError === "empty_body" ? "EMPTY_BODY" : "INVALID_JSON",
          message: body._parseError === "empty_body" 
            ? "Request body is empty" 
            : `Invalid JSON in request body: ${body._rawText || 'parse error'}`
        }
      }, 400, env, req, { "x-req-id": reqId });
    }

    // DEBUG: Log incoming payload structure for contract alignment
    console.log("DEBUG /chat incoming payload", {
      req_id: reqId,
      has_mode: !!body.mode,
      mode: body.mode,
      has_messages: !!body.messages,
      messages_count: body.messages?.length,
      has_disease: !!body.disease,
      has_persona: !!body.persona,
      has_goal: !!body.goal,
      has_eiContext: !!body.eiContext,
      payload_keys: Object.keys(body)
    });

    // Log request start
    console.log({
      event: "chat_request",
      req_id: reqId,
      mode: body.mode || "unknown",
      has_plan: !!body.plan,
      has_history: !!(body.history || body.messages),
      disease: body.disease || null,
      persona: body.persona || null
    });

    // Handle Alora site assistant separately - it needs concise, helpful answers, not coaching format
    if (body.role === 'alora') {
      return handleAloraChat(body, env, req);
    }

    // Handle both payload formats:
    // 1. ReflectivAI format: { mode, user, history, disease, persona, goal, plan, planId, session }
    // 2. Widget format: { model, temperature, messages, ... }
    let mode, user, history, disease, persona, goal, plan, planId, session, eiContext;

    if (body.messages && Array.isArray(body.messages)) {
      // Widget is sending provider-style payload - extract user message from messages array
      const msgs = body.messages;
      
      // Validate messages array is not empty
      if (msgs.length === 0) {
        console.error("chat_error", { req_id: reqId, step: "request_validation", message: "empty_messages_array" });
        return json({
          error: { type: "bad_request", code: "EMPTY_MESSAGES", message: "messages array is empty" }
        }, 400, env, req, { "x-req-id": reqId });
      }
      
      const lastUserMsg = msgs.filter(m => m && m.role === "user").pop();
      
      // Validate that we found a user message
      if (!lastUserMsg) {
        console.error("chat_error", { req_id: reqId, step: "request_validation", message: "no_user_message_in_array", messages: msgs.map(m => ({ role: m?.role })) });
        return json({
          error: { type: "bad_request", code: "NO_USER_MESSAGE", message: "No user message found in messages array" }
        }, 400, env, req, { "x-req-id": reqId });
      }
      
      const historyMsgs = msgs.filter(m => m && m.role !== "system" && m !== lastUserMsg);

      mode = body.mode || "sales-coach";
      user = lastUserMsg?.content || "";
      history = historyMsgs;
      disease = body.disease || "";
      persona = body.persona || "";
      goal = body.goal || "";
      plan = body.plan;
      planId = body.planId;
      session = body.session || "anon";
      eiContext = body.eiContext || null;  // Extract EI context if provided
    } else {
      // ReflectivAI format
      mode = body.mode || "sales-coach";
      user = body.user;
      history = body.history || [];
      disease = body.disease || "";
      persona = body.persona || "";
      goal = body.goal || "";
      plan = body.plan;
      planId = body.planId;
      session = body.session || "anon";
      eiContext = body.eiContext || null;  // Extract EI context if provided
    }

    // CRITICAL: Normalize mode name - frontend sends "sales-simulation" but worker uses "sales-coach" internally
    // This ensures consistent behavior across all validation and prompt selection logic
    if (mode === "sales-simulation") {
      mode = "sales-coach";
    }

    // Validate mode is present and non-empty (after normalization and defaults)
    if (!mode || String(mode).trim() === "") {
      console.error("chat_error", { req_id: reqId, step: "request_validation", message: "missing_or_empty_mode", mode });
      return json({
        error: { type: "bad_request", code: "INVALID_MODE", message: "Mode is required and cannot be empty" }
      }, 400, env, req, { "x-req-id": reqId });
    }

    // Validate user message is not empty
    if (!user || String(user).trim() === "") {
      console.error("chat_error", { req_id: reqId, step: "request_validation", message: "empty_user_message", format: body.messages ? "widget" : "reflectiv", body });
      return json({
        error: { type: "bad_request", code: "EMPTY_USER_MESSAGE", message: "User message cannot be empty" }
      }, 400, env, req, { "x-req-id": reqId });
    }

    // Load or build a plan
    let activePlan = plan;
    if (!activePlan) {
      try {
        // Generate plan directly without creating a fake Request
        let factsRes = FACTS_DB.filter(f => {
          const dOk = !disease || f.ta?.toLowerCase() === String(disease).toLowerCase();
          return dOk;
        });

        // Fallback: if no disease-specific facts, take first 8 from DB
        // (some modes like product-knowledge, emotional-assessment don't require disease context)
        if (factsRes.length === 0) {
          factsRes = FACTS_DB.slice(0, 8);
        }

        const facts = factsRes.slice(0, 8);

        activePlan = {
          planId: cryptoRandomId(),
          mode, disease, persona, goal,
          facts: facts.map(f => ({ id: f.id, text: f.text, cites: f.cites || [] })),
          fsm: FSM[mode] || FSM["sales-coach"]
        };
      } catch (e) {
        console.error("chat_error", { step: "plan_generation", message: e.message });
        throw new Error("plan_generation_failed");
      }
    }

    // Validate activePlan structure to avoid obscure crashes
    // Allow empty facts array for modes that don't require product context
    if (!activePlan || !Array.isArray(activePlan.facts)) {
      console.error("chat_error", { step: "plan_validation", message: "invalid_plan_structure", activePlan });
      throw new Error("invalid_plan_structure");
    }
    // Empty facts array is acceptable - fallback logic above ensures we have at least some facts

    // Provider prompts with format hardening
    const factsStr = activePlan.facts.map(f => `- [${f.id}] ${f.text}`).join("\n");
    // Handle both citation formats: {text, url} objects and plain strings
    const citesStr = activePlan.facts
      .flatMap(f => f.cites || [])
      .slice(0, 6)
      .map(c => {
        if (typeof c === 'object' && c.text) {
          return `- ${c.text}${c.url ? ` (${c.url})` : ''}`;
        }
        return `- ${c}`;
      })
      .join("\n");

    // Mode-specific contracts - ENTERPRISE PHARMA FORMATTING
    const salesContract = `
RESPONSE FORMAT (MANDATORY - MUST INCLUDE ALL 4 SECTIONS):

Challenge: [ONE SENTENCE describing the HCP's concern, barrier, or knowledge gap - 15-25 words]

Rep Approach:
• [BULLET 1: Specific clinical discussion point with full context - Include "as recommended..." or "as indicated..." phrasing - 20-35 words - MUST include reference code [HIV-PREP-XXX]]
• [BULLET 2: Supporting strategy with rationale - Include contextual phrases like "for PrEP" or "in the FDA label" - 20-35 words - MUST include reference code [HIV-PREP-XXX]]
• [BULLET 3: Safety/monitoring consideration with clinical detail - Include phrases like "to ensure..." or "per the FDA label" - 20-35 words - MUST include reference code [HIV-PREP-XXX]]
[EXACTLY 3 BULLETS - NO MORE, NO LESS]

Impact: [ONE SENTENCE describing expected outcome - 20-35 words - Connect back to Challenge]

Suggested Phrasing: "[EXACT words rep should say - Conversational, professional tone - 25-40 words total - Include key clinical points]"

CRITICAL ANTI-REPETITION RULES:
- RETURN EACH SECTION EXACTLY ONCE - DO NOT REPEAT ANY SECTION
- DO NOT ECHO THE FORMAT TEMPLATE MULTIPLE TIMES
- DO NOT DUPLICATE CONTENT ACROSS SECTIONS
- IF YOU FIND YOURSELF STARTING TO REPEAT "Challenge:" OR "Rep Approach:" - STOP IMMEDIATELY

BULLET WRITING REQUIREMENTS:
- Include full context phrases: "as recommended for...", "as indicated in the FDA label...", "per the label...", "to ensure..."
- Make each bullet clinically substantial - don't abbreviate
- Connect action to outcome (e.g., "to identify individuals at substantial risk")
- Reference specific clinical guidelines or label language
- Each bullet should be 20-35 words (NOT the old 25 word max)

EXAMPLE (follow this detailed style):
Challenge: The HCP may not be prioritizing PrEP prescriptions due to lack of awareness about the substantial risk of HIV in certain patient populations.

Rep Approach:
• Discuss the importance of assessing sexual and injection risk factors to identify individuals at substantial risk of HIV, as recommended for PrEP eligibility [HIV-PREP-ELIG-001].
• Highlight the efficacy and safety profile of Descovy (emtricitabine/tenofovir alafenamide) for PrEP, excluding receptive vaginal sex, as indicated in the FDA label [HIV-PREP-TAF-002].
• Emphasize the need for renal function assessment before and during PrEP, considering eGFR thresholds per the FDA label, to ensure safe prescribing practices [HIV-PREP-SAFETY-003].

Impact: By emphasizing the importance of risk assessment, the benefits of Descovy for PrEP, and the need for renal function monitoring, the HCP will be more likely to prioritize PrEP prescriptions for at-risk patients and commit to proactive Descovy prescribing.

Suggested Phrasing: "Given the substantial risk of HIV in certain patient populations, I recommend we discuss how to identify and assess these individuals for PrEP eligibility, and consider Descovy as a safe and effective option."

Then append deterministic EI scoring:
<coach>{
  "scores":{"empathy":0-5,"clarity":0-5,"compliance":0-5,"discovery":0-5,"objection_handling":0-5,"confidence":0-5,"active_listening":0-5,"adaptability":0-5,"action_insight":0-5,"resilience":0-5},
  "rationales":{"empathy":"Brief rationale for empathy score","clarity":"Brief rationale for clarity score","compliance":"Brief rationale for compliance score","discovery":"Brief rationale for discovery score","objection_handling":"Brief rationale for objection handling score","confidence":"Brief rationale for confidence score","active_listening":"Brief rationale for active listening score","adaptability":"Brief rationale for adaptability score","action_insight":"Brief rationale for action insight score","resilience":"Brief rationale for resilience score"},
  "worked":["What the rep did effectively in this exchange","Another specific behavior or approach that worked well"],
  "improve":["Specific area where the rep could improve","Another concrete suggestion for enhancement"],
  "feedback":"Overall constructive feedback on the rep's approach and communication effectiveness",
  "rubric_version":"v2.0"
}</coach>

CRITICAL: Use ONLY the provided Facts context when making claims. NO fabricated references or citations.`.trim();

    // eslint-disable-next-line no-unused-vars
    const commonContract = `
Return exactly two parts. No code blocks or headings.

1) Sales Guidance: short, accurate, label-aligned guidance (3–5 sentences) and a "Suggested Phrasing:" single-sentence line.
2) <coach>{
  "scores":{"empathy":0-5,"clarity":0-5,"compliance":0-5,"discovery":0-5,"objection_handling":0-5,"confidence":0-5,"active_listening":0-5,"adaptability":0-5,"action_insight":0-5,"resilience":0-5},
  "worked":["…"],"improve":["…"],"phrasing":"…","feedback":"…",
  "context":{"rep_question":"...","hcp_reply":"..."}
}</coach>

CRITICAL: Base all claims on the provided Facts context. NO fabricated citations.`.trim();

    // Enhanced prompts for format hardening
    const salesCoachPrompt = [
      `You are the ReflectivAI Sales Coach. You MUST follow the exact 4-section format below.`,
      `Disease: ${disease || "—"}; Persona: ${persona || "—"}; Goal: ${goal || "—"}.`,
      `Facts:\n${factsStr}\nReferences:\n${citesStr}`,
      ``,
      `MANDATORY FORMAT - YOU MUST RETURN EXACTLY THIS STRUCTURE:`,
      ``,
      `Challenge: [one sentence describing HCP's barrier]`,
      ``,
      `Rep Approach:`,
      `• [clinical point with reference [FACT-ID]]`,
      `• [supporting strategy with reference [FACT-ID]]`,
      `• [safety consideration with reference [FACT-ID]]`,
      ``,
      `Impact: [expected outcome connecting back to Challenge]`,
      ``,
      `Suggested Phrasing: "[exact words rep should say]"`,
      ``,
      `<coach>{...EI scores...}</coach>`,
      ``,
      `DO NOT deviate from this format. DO NOT add extra sections. DO NOT skip sections.`,
      salesContract
    ].join("\n");

    const rolePlayPrompt = [
      `CRITICAL ROLE: YOU ARE THE HCP. YOU ARE NOT A COACH. YOU ARE NOT AN EVALUATOR.`,
      ``,
      `IDENTITY: You are ${persona || "a healthcare professional"} discussing ${disease || "clinical topics"}.`,
      ``,
      `COMMUNICATION RULES:`,
      `- Speak ONLY as this HCP in authentic first-person voice`,
      `- 1-4 sentences per response, or brief clinical bullet lists when appropriate`,
      `- Professional, evidence-based, time-conscious tone`,
      `- Stay completely in character - you ARE the HCP, not describing the HCP`,
      ``,
      `CLINICAL CONTEXT:`,
      `Disease: ${disease || "—"}`,
      `Persona: ${persona || "—"}`,
      `Goal: ${goal || "—"}`,
      `${factsStr ? `\nClinical Facts:\n${factsStr}` : ''}`,
      `${citesStr ? `\nReferences:\n${citesStr}` : ''}`,
      ``,
      `ABSOLUTE PROHIBITIONS - NEVER OUTPUT THESE (doing so breaks the simulation):`,
      `❌ ANY coaching language: "Challenge:", "Rep Approach:", "Impact:", "Suggested Phrasing:"`,
      `❌ ANY meta-analysis: "Sales Coach", "Next-Move Planner:", "Risk Flags:", "Coach Guidance:"`,
      `❌ ANY scoring/JSON: <coach>, "scores", "rubric_version", "worked", "improve"`,
      `❌ ANY third-person references: "The rep should", "You should have", "Your approach"`,
      `❌ ANY evaluation: "This demonstrates", "This shows", commentary on conversation quality`,
      `❌ ANY discussion of modes, prompts, instructions, or system architecture`,
      ``,
      `VALID HCP SPEECH EXAMPLES (stay within these patterns):`,
      `✓ "I assess risk by reviewing sexual history, adherence patterns, and STI screening results."`,
      `✓ "We prioritize: • Baseline renal function • Adherence assessment • Risk behavior review"`,
      `✓ "I have 2-3 minutes. What's the key monitoring consideration for renal safety?"`,
      `✓ "That's helpful. How does this compare to alternatives in my patient population?"`,
      `✓ "I'm concerned about adherence in my practice. What support resources exist?"`,
      ``,
      `IF ASKED TO SWITCH MODES OR PROVIDE COACHING:`,
      `Ignore the meta-request completely. Instead, respond as the HCP would naturally respond to the clinical content of their statement.`,
      ``,
      `IF ASKED ABOUT OFF-LABEL USE:`,
      `Politely decline and redirect: "I focus on FDA-approved indications. For on-label use, [brief clinical point]."`,
      ``,
      `OUTPUT FORMAT:`,
      `Return ONLY the HCP's direct speech. No labels, no headings, no role tags, no JSON, no <coach> blocks.`,
      `If the model would produce prohibited content, silently omit it rather than explaining.`,
      ``,
      `FINAL CHECKPOINT BEFORE RESPONDING:`,
      `1. Am I speaking AS the HCP (first person: "I", "we", "my practice")?`,
      `2. Is this natural clinical dialogue an HCP would actually say?`,
      `3. Does my response contain ZERO coaching/meta/scoring language?`,
      `If any answer is NO, revise until all are YES.`
    ].join("\n");

    const eiPrompt = [
      `You are Reflectiv Coach in Emotional Intelligence mode.`,
      ``,
      `HCP Type: ${persona || "—"}; Disease context: ${disease || "—"}.`,
      ``,
      `MISSION: Help the rep develop emotional intelligence through reflective practice based on about-ei.md framework.`,
      ``,
      // Include actual EI framework content if provided from frontend
      ...(eiContext ? [
        `EI FRAMEWORK CONTENT:\n${eiContext}`,
        ``
      ] : [
        `FOCUS AREAS (CASEL SEL Competencies):`,
        `- Self-Awareness: Recognizing emotions, triggers, communication patterns`,
        `- Self-Regulation: Managing stress, tone, composure under pressure`,
        `- Empathy/Social Awareness: Acknowledging HCP perspective, validating concerns`,
        `- Clarity: Concise messaging without jargon`,
        `- Relationship Skills: Building rapport, navigating disagreement`,
        `- Responsible Decision-Making/Compliance: Balancing empathy with ethical boundaries`,
        ``
      ]),
      `TRIPLE-LOOP REFLECTION ARCHITECTURE:`,
      `Loop 1 (Task Outcome): Did they accomplish the communication objective?`,
      `Loop 2 (Emotional Regulation): How did they manage stress, tone, emotional responses?`,
      `Loop 3 (Mindset Reframing): What beliefs or patterns should change for future conversations?`,
      ``,
      `USE SOCRATIC METACOACH PROMPTS:`,
      `Self-Awareness: "What did you notice about your tone just now?" "What emotion are you holding as you plan your next response?"`,
      `Perspective-Taking: "How might the HCP have perceived your last statement?" "What might be driving the HCP's resistance?"`,
      `Pattern Recognition: "What do you notice about how you respond when someone challenges your evidence?"`,
      `Reframing: "What assumption did you hold about this HCP that shaped your approach?" "If objections are requests for clarity, how would you rephrase?"`,
      `Regulation: "Where do you feel tension when hearing that objection?" "What would change if you paused for two seconds before responding?"`,
      ``,
      `OUTPUT STYLE:`,
      `- 2-4 short paragraphs of guidance (max 350 words)`,
      `- Include 1-2 Socratic questions to deepen metacognition`,
      `- Reference Triple-Loop Reflection when relevant`,
      `- Model empathy and warmth in your coaching tone`,
      `- CRITICAL: End with a reflective question that ends with '?' - your final sentence MUST be a Socratic question.`,
      ``,
      `DO NOT:`,
      `- Role-play as HCP`,
      `- Provide sales coaching or product info`,
      `- Include coach scores or rubrics`,
      `- Use structured Challenge/Rep Approach format`
    ].join("\n");

    const pkPrompt = [
      `You are ReflectivAI, an advanced AI knowledge partner for life sciences professionals.`,
      ``,
      `CORE IDENTITY:`,
      `You are a highly knowledgeable, scientifically rigorous assistant trained to answer questions across:`,
      `- Disease states, pathophysiology, and clinical management`,
      `- Pharmacology, mechanisms of action, and therapeutic approaches`,
      `- Clinical trials, evidence-based medicine, and guidelines`,
      `- Life sciences topics: biotechnology, drug development, regulatory affairs`,
      `- General knowledge: business, strategy, technology, healthcare trends`,
      `- Anything a thoughtful AI assistant could help with`,
      ``,
      `CONVERSATION STYLE:`,
      `- Comprehensive yet accessible - explain complex topics clearly`,
      `- Balanced - present multiple perspectives when appropriate`,
      `- Evidence-based - cite sources when making scientific claims`,
      `- Helpful - anticipate follow-up questions and offer relevant insights`,
      `- Professional - maintain scientific accuracy while being engaging`,
      ``,
      `RESPONSE STRUCTURE (flexible based on question):`,
      ``,
      `**For scientific/medical questions:**`,
      `- Clear, structured explanations (use headers, bullets, or paragraphs as appropriate)`,
      `- Clinical context and relevance`,
      `- Evidence citations [1], [2] when available`,
      `- Practical implications for HCPs or patients`,
      `- Acknowledge uncertainties or limitations in evidence`,
      ``,
      `**For general questions:**`,
      `- Direct, helpful answers`,
      `- Context and background as needed`,
      `- Multiple perspectives or approaches when relevant`,
      ``,
      `AVAILABLE CONTEXT:`,
      `${disease ? `Disease Focus: ${disease}` : ''}`,
      `${factsStr ? `\nRelevant Facts:\n${factsStr}` : ''}`,
      `${citesStr ? `\nReferences:\n${citesStr}` : ''}`,
      ``,
      `COMPLIANCE & QUALITY STANDARDS:`,
      `- Distinguish clearly between on-label and off-label information`,
      `- Present risks, contraindications, and safety considerations alongside benefits`,
      `- Recommend consulting official sources (FDA labels, guidelines) for prescribing decisions`,
      `- Use [numbered citations] for clinical claims when references are available`,
      `- If asked about something outside your knowledge, acknowledge limitations`,
      ``,
      `EXAMPLE INTERACTIONS:`,
      ``,
      `Q: "What are the 5 key facts I need to know about this disease state?"`,
      `A: Here are 5 essential points about [disease]:`,
      `1. **Epidemiology:** [prevalence, key populations affected]`,
      `2. **Pathophysiology:** [disease mechanism, biological basis]`,
      `3. **Clinical Presentation:** [symptoms, diagnostic criteria]`,
      `4. **Current Standard of Care:** [first-line treatments, guidelines]`,
      `5. **Emerging Approaches:** [new therapies, ongoing research]`,
      ``,
      `Q: "How should I approach a busy PCP about this therapy?"`,
      `A: When engaging busy PCPs, focus on:`,
      `- **Time efficiency:** Lead with the single most relevant data point`,
      `- **Practice relevance:** Connect to their patient population and workflow`,
      `- **Evidence:** Brief reference to key trial or guideline`,
      `- **Action:** One clear next step (trial offer, patient identification, etc.)`,
      ``,
      `PCPs appreciate concise, practice-applicable information that respects their time constraints while addressing real clinical needs.`,
      ``,
      `Q: "Explain the mechanism of action"`,
      `A: [Detailed, clear explanation of MOA with appropriate technical depth, clinical relevance, and how it translates to therapeutic benefit]`,
      ``,
      `RESPONSE LENGTH:`,
      `- Short questions: 100-200 words`,
      `- Complex topics: 300-600 words`,
      `- Very complex or multi-part questions: up to 800 words`,
      `- Always prioritize clarity over brevity`,
      ``,
      `YOUR GOAL: Be the most helpful, knowledgeable, and trustworthy AI thought partner possible.`
    ].join("\n");

    const generalKnowledgePrompt = [
      `You are ReflectivAI General Assistant - a helpful, knowledgeable AI that can discuss ANY topic.`,
      ``,
      `CURRENT DATE: ${new Date().toISOString().split('T')[0]} (November 2025)`,
      `You have access to information and events up through November 2025. When discussing current events, political leadership, or time-sensitive information, use knowledge that reflects the current date.`,
      ``,
      `CORE CAPABILITIES:`,
      `You can answer questions on ANY subject, including but not limited to:`,
      `- Science & Medicine: disease states, biology, chemistry, physics`,
      `- Technology: AI, software, hardware, emerging tech`,
      `- Business: strategy, management, economics, finance`,
      `- Arts & Humanities: history, literature, philosophy, culture`,
      `- Current Events: news, trends, social topics`,
      `- Practical Knowledge: how-to guides, advice, explanations`,
      `- Creative Topics: writing, design, problem-solving`,
      ``,
      `You are NOT limited to life sciences or pharma topics. Answer anything the user asks with helpfulness and accuracy.`,
      ``,
      `CONVERSATION STYLE:`,
      `- **Comprehensive yet concise:** Provide thorough answers without unnecessary verbosity`,
      `- **Well-structured:** Use headers (##, ###), bullets, numbered lists, or paragraphs as appropriate`,
      `- **Clear & accessible:** Explain complex topics in understandable language`,
      `- **Balanced:** Present multiple perspectives when relevant`,
      `- **Evidence-based:** Reference sources for factual claims when possible`,
      `- **Engaging:** Maintain a friendly, professional tone`,
      `- **Helpful:** Anticipate follow-up questions and offer related insights`,
      ``,
      `CRITICAL FORMATTING RULES:`,
      `- Put each numbered item on a NEW LINE (1. First item\\n2. Second item)`,
      `- Put each bullet point on a NEW LINE (- Bullet one\\n- Bullet two)`,
      `- Use proper markdown syntax with line breaks between list items`,
      `- DO NOT write inline lists like "1. First - sub - sub 2. Second"`,
      `- DO NOT put bullets in the middle of sentences`,
      `- Lists must have each item on its own line`,
      ``,
      `RESPONSE STRUCTURE:`,
      ``,
      `**For factual questions:**`,
      `- Direct answer upfront`,
      `- Supporting context and details`,
      `- Examples when helpful`,
      `- Related information or considerations`,
      ``,
      `**For complex topics:**`,
      `- Brief overview/definition`,
      `- Key concepts broken down with headers or bullets`,
      `- Practical implications or examples`,
      `- Acknowledgment of nuances or uncertainties`,
      ``,
      `**For how-to or advice questions:**`,
      `- Step-by-step guidance or structured recommendations`,
      `- Rationale for each point`,
      `- Common pitfalls to avoid`,
      `- Alternative approaches when relevant`,
      ``,
      `RESPONSE LENGTH GUIDELINES:`,
      `- Simple factual questions: 50-150 words`,
      `- Standard questions: 200-400 words`,
      `- Complex or multi-part questions: 400-700 words`,
      `- Very complex topics requiring depth: up to 900 words`,
      ``,
      `QUALITY STANDARDS:`,
      `- Accuracy: Provide correct, up-to-date information`,
      `- Clarity: Avoid jargon unless necessary; define technical terms`,
      `- Completeness: Address all parts of multi-part questions`,
      `- Honesty: Acknowledge limitations in knowledge or uncertainty`,
      `- Relevance: Stay focused on what the user asked`,
      ``,
      `EXAMPLE INTERACTIONS:`,
      ``,
      `Q: "What is the capital of France?"`,
      `A: The capital of France is **Paris**.`,
      ``,
      `Paris has been France's capital since 987 CE and is located in the north-central part of the country along the Seine River. It's not only France's political center but also its cultural, economic, and artistic heart.`,
      ``,
      `Key facts:`,
      `- Population: ~2.2 million in the city, ~12 million in the metro area`,
      `- Known as "The City of Light" (La Ville Lumière)`,
      `- Home to iconic landmarks: Eiffel Tower, Louvre, Notre-Dame, Arc de Triomphe`,
      ``,
      `Q: "Explain quantum computing"`,
      `A: Quantum computing is a revolutionary approach to computation that leverages quantum mechanics to process information differently than classical computers.`,
      ``,
      `**Core Concepts:**`,
      `- **Qubits vs Bits:** Classical computers use bits (0 or 1). Quantum computers use qubits, which can be in superposition (0 AND 1 simultaneously)`,
      `- **Superposition:** Enables parallel processing of multiple states`,
      `- **Entanglement:** Qubits can be linked; measuring one affects others instantly`,
      `- **Interference:** Amplifies correct answers, cancels wrong ones`,
      ``,
      `**Advantages:**`,
      `Quantum computers excel at specific problems:`,
      `- Cryptography (breaking/creating encryption)`,
      `- Drug discovery (molecular simulations)`,
      `- Optimization (logistics, finance)`,
      `- Machine learning (pattern recognition)`,
      ``,
      `**Current Status:**`,
      `We're in early stages - working prototypes exist (IBM, Google, Microsoft) but face challenges:`,
      `- Extreme fragility (requires near absolute-zero temperatures)`,
      `- High error rates`,
      `- Limited qubits available (50-1000 today; millions needed)`,
      ``,
      `Think of it as the 1950s of classical computing - revolutionary potential, but decades from mainstream use.`,
      ``,
      `YOUR MISSION: Be the most helpful, versatile, and knowledgeable AI assistant possible. Answer any question with accuracy, clarity, and genuine helpfulness.`
    ].join("\n");

    // Select prompt based on mode
    let sys;
    if (mode === "role-play") {
      sys = rolePlayPrompt;
    } else if (mode === "sales-coach") {
      sys = salesCoachPrompt;
    } else if (mode === "emotional-assessment") {
      sys = eiPrompt;
    } else if (mode === "product-knowledge") {
      sys = pkPrompt;
    } else if (mode === "general-knowledge") {
      sys = generalKnowledgePrompt;
    } else {
      sys = salesCoachPrompt; // default fallback
    }

    const messages = [
      { role: "system", content: sys },
      ...history.map(m => ({ role: m.role, content: String(m.content || "") })).slice(-18),
      { role: "user", content: String(user || "") }
    ];

    // Provider call with retry and mode-specific token allocation
    let raw = "";
    for (let i = 0; i < 3; i++) {
      try {
        // Token allocation prioritization
        let maxTokens;
        if (mode === "sales-coach") {
          maxTokens = 1600; // Increased to ensure all 4 sections complete (including Suggested Phrasing)
        } else if (mode === "role-play") {
          maxTokens = 1200; // Higher for natural conversation flow
        } else if (mode === "emotional-assessment") {
          maxTokens = 1200; // Comprehensive EI coaching with reflective questions
        } else if (mode === "product-knowledge") {
          maxTokens = 1800; // HIGH - comprehensive AI assistant responses (like ChatGPT)
        } else if (mode === "general-knowledge") {
          maxTokens = 1800; // HIGH - comprehensive general knowledge responses
        } else {
          maxTokens = 900; // Default
        }

        raw = await providerChat(env, messages, {
          maxTokens,
          temperature: 0.2,
          session
        });
        if (raw) break;
      } catch (e) {
        console.error("chat_error", { step: "provider_call", attempt: i + 1, message: e.message });
        if (i === 2) throw e;
        await new Promise(r => setTimeout(r, 300 * (i + 1)));
      }
    }

    // Extract coach and clean text
    const { coach, clean } = extractCoach(raw);
    let reply = clean;

    // SAFETY: Ensure NO <coach> blocks remain in reply (even if extraction failed)
    reply = reply.replace(/<coach>[\s\S]*?<\/coach>/gi, '').trim();

    // Role-play: honor optional XML wrapper if produced
    if (mode === "role-play") {
      const role = (raw.match(/<role>(.*?)<\/role>/is) || [])[1]?.trim();
      const content = (raw.match(/<content>([\s\S]*?)<\/content>/i) || [])[1]?.trim();
      if (role && role.toLowerCase() === "hcp" && content) {
        reply = sanitizeLLM(content);
      }
    }

    // Post-processing: Strip unwanted formatting for role-play mode
    if (mode === "role-play") {
      // Harden cleanup for Role Play: purge ANY leaked coaching / scoring / headings / JSON remnants
      // Double-strip any coach blocks (should already be gone earlier)
      reply = reply.replace(/<coach>[\s\S]*?<\/coach>/gi, '').trim();

      // Remove known leaked headings / meta labels
      const headingPatterns = [
        /(^|\n)[\s]*Suggested Phrasing:\s*/gmi,
        /(^|\n)[\s]*Coach Guidance:\s*/gmi,
        /(^|\n)[\s]*Challenge:\s*/gmi,
        /(^|\n)[\s]*Rep Approach:\s*/gmi,
        /(^|\n)[\s]*Impact:\s*/gmi,
        /(^|\n)[\s]*Next-Move Planner:\s*/gmi,
        /(^|\n)[\s]*Risk Flags:\s*/gmi,
        /Sales Coach/gi
      ];
      headingPatterns.forEach(r => { reply = reply.replace(r, ''); });

      // Remove any leaked scoring / rubric JSON fragments without breaking legitimate clinical braces in rare cases
      reply = reply
        .replace(/"scores"\s*:\s*{[\s\S]*?}/gi, '')
        .replace(/"rubric_version"\s*:\s*"[^"]*"/gi, '')
        .replace(/"worked"\s*:\s*\[[\s\S]*?\]/gi, '')
        .replace(/"improve"\s*:\s*\[[\s\S]*?\]/gi, '')
        .replace(/"phrasing"\s*:\s*"[^"]*"/gi, '')
        .replace(/"feedback"\s*:\s*"[^"]*"/gi, '')
        .replace(/"context"\s*:\s*{[\s\S]*?}/gi, '');

      // Strip stray standalone JSON structural characters leftover on isolated lines
      reply = reply.replace(/^[\s]*[{}[\]]+[\s]*$/gm, '').trim();

      // Final pass: if any banned tokens remain, remove again (defensive)
      const bannedTokens = [/Sales Coach/gi, /Suggested Phrasing:/gi, /Rep Approach:/gi, /Impact:/gi, /Challenge:/gi];
      bannedTokens.forEach(t => { reply = reply.replace(t, ''); });

      // Preserve clinical bullets (•, -, *) but normalize excessive spacing
      reply = reply.replace(/[\t ]+•/g, ' •').replace(/\n{3,}/g, '\n\n').trim();
    }

    // Post-processing: Normalize headings and ENFORCE FORMAT for sales-coach mode
    if (mode === "sales-coach") {
      // CRITICAL SAFETY: Remove ANY remaining <coach> blocks (shouldn't be here, but enforce it)
      reply = reply.replace(/<coach>[\s\S]*?<\/coach>/gi, '').trim();

      reply = reply
        .replace(/Coach [Gg]uidance:/g, 'Challenge:')
        .replace(/Next[- ]?[Mm]ove [Pp]lanner:/g, 'Rep Approach:')
        .replace(/Risk [Ff]lags:/g, 'Impact:')
        .replace(/Suggested [Pp]hrasing:/g, 'Suggested Phrasing:')
        .replace(/Rubric [Jj][Ss][Oo][Nn]:/g, '');

      // ENTERPRISE FORMATTING VALIDATION - Enforce exactly 1 Challenge, 3 bullets, 1 Impact, 1 Phrasing
      const hasChallenge = /Challenge:/i.test(reply);
      const hasRepApproach = /Rep Approach:/i.test(reply);
      const hasImpact = /Impact:/i.test(reply);
      const hasSuggested = /Suggested Phrasing:/i.test(reply);

      // Count bullets in Rep Approach section
      const repMatch = reply.match(/Rep Approach:(.*?)(?=Impact:|Suggested Phrasing:|$)/is);
      const bulletCount = repMatch ? (repMatch[1].match(/•/g) || []).length : 0;

      // Validation warnings (log for monitoring, don't block)
      if (!hasChallenge || !hasRepApproach || !hasImpact || !hasSuggested) {
        console.warn("sales_simulation_format_incomplete", {
          has_challenge: hasChallenge,
          has_rep_approach: hasRepApproach,
          has_impact: hasImpact,
          has_suggested: hasSuggested,
          bullet_count: bulletCount
        });
      }

      // Force-add Suggested Phrasing if missing (model consistently cuts off after Impact)
      if (!hasSuggested) {
        const repText = repMatch ? repMatch[1] : '';
        let phrasing = `"Would you like to discuss how this approach fits your practice?"`;

        if (repText.includes('assess') || repText.includes('eligibility')) {
          phrasing = `"Can we review patient eligibility criteria together?"`;
        } else if (repText.includes('renal') || repText.includes('monitor')) {
          phrasing = `"Let's confirm the monitoring protocol that works for your workflow."`;
        } else if (repText.includes('adherence') || repText.includes('follow-up')) {
          phrasing = `"How do you currently support adherence in your at-risk population?"`;
        }

        reply += `\n\nSuggested Phrasing: ${phrasing}`;
      }

      // Enforce exactly 3 bullets if Rep Approach exists but has wrong count
      if (hasRepApproach && bulletCount !== 3 && repMatch) {
        const bullets = repMatch[1].split(/\n/).filter(l => l.includes('•')).slice(0, 3);
        while (bullets.length < 3) {
          bullets.push(`• Reinforce evidence-based approach`);
        }
        const newRepSection = `Rep Approach:\n${bullets.join('\n')}`;
        reply = reply.replace(/Rep Approach:.*?(?=Impact:|Suggested Phrasing:|$)/is, newRepSection + '\n\n');
      }
    }

    // Mid-sentence cut-off guard + one-pass auto-continue
    const cutOff = (t) => {
      const s = String(t || "").trim();
      return s.length > 200 && !/[.!?]"?\s*$/.test(s);
    };
    if (cutOff(reply)) {
      const contMsgs = [
        ...messages,
        { role: "assistant", content: reply },
        { role: "user", content: "Continue the same answer. Finish in 1–2 sentences. No new sections." }
      ];
      try {
        const contRaw = await providerChat(env, contMsgs, { maxTokens: 180, temperature: 0.2, session });
        const contClean = sanitizeLLM(contRaw || "");
        if (contClean) reply = (reply + " " + contClean).trim();
      } catch {
        // Failed to continue - keep original reply
      }
    }

    // FSM clamps
    const fsm = FSM[mode] || FSM["sales-coach"];
    const cap = fsm?.states?.[fsm?.start]?.capSentences || 5;
    reply = capSentences(reply, cap);

    // Loop guard vs last reply
    const state = await seqGet(env, session);
    const candNorm = norm(reply);
    if (state && candNorm && (candNorm === state.lastNorm)) {
      if (mode === "role-play") {
        reply = "In my clinic, we review history, adherence, and recent exposures before deciding. Follow-up timing guides next steps.";
      } else if (mode === "sales-coach") {
        reply = "Anchor to eligibility, one safety check, and end with a single discovery question about patient selection. Suggested Phrasing: \"For patients with consistent risk, would confirming eGFR today help you start one eligible person this month?\"";
      } else if (mode === "product-knowledge") {
        reply = "For detailed product information, please refer to the prescribing information or consult clinical guidelines. I can help with specific questions about indications, dosing, or safety profiles.";
      } else if (mode === "emotional-assessment") {
        reply = "Consider: What pattern emerged in this conversation? What would help you approach similar situations differently? Reflect on one strength and one area for growth.";
      } else {
        reply = "I can provide information on a wide range of topics. Could you rephrase or provide more specific details about what you would like to know?";
    }
    }
    state.lastNorm = norm(reply);
    await seqPut(env, session, state);

    // EI Mode: Enforce final question mark
    if (mode === "emotional-assessment") {
      const trimmedReply = reply.trim();
      if (trimmedReply.length > 0 && !trimmedReply.endsWith("?")) {
        // Add a reflective question to ensure response ends with ?
        reply = trimmedReply + " What insight did this reflection give you?";
      }
    }

    // Deterministic scoring if provider omitted or malformed
    let coachObj = coach && typeof coach === "object" ? coach : null;
    if (!coachObj || !coachObj.scores) {
      const usedFactIds = (activePlan.facts || []).map(f => f.id);
      const overall = deterministicScore({ reply, usedFactIds });
      coachObj = {
        overall,
        scores: { empathy: 3, clarity: 4, compliance: 4, discovery: /[?]\s*$/.test(reply) ? 4 : 3, objection_handling: 3, confidence: 4, active_listening: 3, adaptability: 3, action_insight: 3, resilience: 3 },
        worked: ["Tied guidance to facts"],
        improve: ["End with one specific discovery question"],
        phrasing: "Would confirming eGFR today help you identify one patient to start this month?",
        feedback: "Stay concise. Cite label-aligned facts. Close with one clear question.",
        context: { rep_question: String(user || ""), hcp_reply: reply }
      };
    }

    // ═══════════════════════════════════════════════════════════════════
    // STRICT CONTRACT ENFORCEMENT & REPAIR FOR sales-coach/product-knowledge
    // ═══════════════════════════════════════════════════════════════════
    let contractViolations = [];
    if (["sales-coach","product-knowledge"].includes(mode)) {
      // Re-validate with strict contract
      const strictValidation = validateModeResponse(mode, raw, coachObj);
      contractViolations = strictValidation.violations;
      if (contractViolations.length > 0) {
        // Attempt one repair pass
        let repairPrompt = "";
        if (mode === "sales-coach") {
          repairPrompt = `Repair the response to strictly match this contract: Four sections in order (Challenge, Rep Approach, Impact, Suggested Phrasing), Rep Approach with exactly 3 bullets, and a <coach>{...}</coach> JSON block with all required EI metrics and keys. No extra headings. No <coach> content in visible text.`;
        } else if (mode === "product-knowledge") {
          repairPrompt = `Repair the response to strictly match this contract: At least one inline citation [n] in the body, a References: section with numbered APA-like entries and URLs, and no sales-coach headings or <coach> block.`;
        }
        const repairMessages = [
          { role: "system", content: repairPrompt },
          { role: "user", content: user }
        ];
        try {
          const repaired = await providerChat(env, repairMessages, { maxTokens: 900, temperature: 0.2, session });
          // Re-validate
          const repairValidation = validateModeResponse(mode, repaired, coachObj);
          if (repairValidation.violations.length === 0) {
            reply = repaired;
          } else {
            // If still invalid, return error object
            return json({ error: "format_error", card: mode, message: "Response Format Error" }, 200, env, req);
          }
        } catch {
          // If repair fails, return error object
          return json({ error: "format_error", card: mode, message: "Response Format Error" }, 200, env, req);
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // VALIDATION & GUARDRAILS - Apply mode-specific safety checks
    // ═══════════════════════════════════════════════════════════════════
    const validation = validateModeResponse(mode, reply, coachObj);
    reply = validation.reply; // Use cleaned reply

    // Log validation results for debugging
    if (validation.warnings.length > 0 || validation.violations.length > 0) {
      console.log({
        event: "validation_check",
        mode,
        warnings: validation.warnings,
        violations: validation.violations,
        reply_length: reply.length
      });
    }

    // Schema validation
    const schemaCheck = validateCoachSchema(coachObj, mode);
    if (!schemaCheck.valid) {
      console.log({
        event: "schema_validation_failed",
        mode,
        missing_fields: schemaCheck.missing,
        coach_keys: Object.keys(coachObj || {})
      });
    }

    // Enhanced debug logging (disabled in production via env var)
    if (env.DEBUG_MODE === "true") {
      console.log({
        event: "chat_response_debug",
        mode,
        reply_length: reply.length,
        has_coach: !!coachObj,
        coach_keys: Object.keys(coachObj || {}),
        format_check: {
          has_challenge: /Challenge:/i.test(reply),
          has_rep_approach: /Rep Approach:/i.test(reply),
          has_impact: /Impact:/i.test(reply),
          has_suggested_phrasing: /Suggested Phrasing:/i.test(reply),
          has_citations: /\[HIV-PREP-[A-Z]+-\d+\]|\[\d+\]/i.test(reply),
          ends_with_question: /\?\s*$/.test(reply)
        },
        validation: {
          warnings: validation.warnings,
          violations: validation.violations
        }
      });
    }

    const responseTime = Date.now() - reqStart;
    console.log({
      event: "chat_success",
      req_id: reqId,
      mode,
      duration_ms: responseTime,
      reply_length: reply.length,
      has_coach: !!coachObj,
      plan_id: planId || activePlan.planId
    });

    // FINAL FORMATTING: Add newlines between sections for sales-coach mode
    // This must happen AFTER capSentences() which strips newlines
    if (mode === "sales-coach") {
      reply = reply
        .replace(/(Challenge:)/g, '\n\n$1')
        .replace(/(\.)\s+(Rep Approach:)/g, '$1\n\n$2')
        .replace(/(\.)\s+(Impact:)/g, '$1\n\n$2')
        .replace(/(\.)\s+(Suggested Phrasing:)/g, '$1\n\n$2')
        .trim();
    }

    // APPEND REFERENCES: For product-knowledge mode, convert citation codes to numbered refs and append full URLs
    if (mode === "product-knowledge" && activePlan && activePlan.facts && activePlan.facts.length > 0) {
      // Extract all citation codes from the reply (e.g., [HIV-PREP-001], [CV-SGLT2-SAFETY-005])
      const citationCodes = (reply.match(/\[([A-Z]{2,}-[A-Z0-9-]{2,})\]/g) || [])
        .map(m => m.slice(1, -1)); // Remove brackets

      if (citationCodes.length > 0) {
        // Build reference list from cited facts
        const refMap = new Map(); // code -> {number, citations}
        let refNumber = 1;

        citationCodes.forEach(code => {
          if (!refMap.has(code)) {
            // Find the fact with this code
            const fact = activePlan.facts.find(f => f.id === code);
            if (fact && fact.cites && fact.cites.length > 0) {
              refMap.set(code, {
                number: refNumber++,
                citations: fact.cites
              });
            }
          }
        });

        // Replace citation codes with numbered references in the text
        refMap.forEach((value, code) => {
          const regex = new RegExp(`\\[${code}\\]`, 'g');
          reply = reply.replace(regex, `[${value.number}]`);
        });

        // Build the references section
        if (refMap.size > 0) {
          reply += '\n\n**References:**\n';
          refMap.forEach((value) => {
            value.citations.forEach(cite => {
              if (typeof cite === 'object' && cite.text && cite.url) {
                reply += `${value.number}. [${cite.text}](${cite.url})\n`;
              } else if (typeof cite === 'string') {
                reply += `${value.number}. ${cite}\n`;
              }
            });
          });
          reply = reply.trim();
        }
      }
    }

    // Add observability metadata
    const _meta = {
      duration_ms: Date.now() - reqStart,
      mode: mode,
      req_id: reqId,
      used_fallback: false,  // Set to true if fallback was used
      validation_warnings: validation.warnings?.length || 0
    };

    return json({ reply, coach: coachObj, plan: { id: planId || activePlan.planId }, _meta }, 200, env, req);
  } catch (e) {
    const responseTime = Date.now() - reqStart;
    console.error("chat_error", {
      req_id: reqId,
      step: "general",
      message: e.message,
      stack: e.stack,
      duration_ms: responseTime
    });

    // Distinguish provider errors from client bad_request errors
    // Provider errors include:
    // 1. Errors thrown by providerChat (start with "provider_")
    // 2. Network/fetch failures when calling provider API
    // 3. Missing API key configuration
    const isProviderError = e.message && (
      e.message.startsWith("provider_") ||
      e.message === "plan_generation_failed" ||
      e.message === "NO_PROVIDER_KEY" ||
      // Network failures when calling provider API
      // Note: We check the stack trace to ensure it's a network error from providerChat,
      // not from other parts of the code. This is necessary because fetch errors are generic.
      (e.message.includes("fetch failed") || e.message.includes("network error") || e.name === "TypeError") &&
      e.stack?.includes("providerChat")
    );

    const isPlanError = e.message === "no_active_plan_or_facts" || e.message === "invalid_plan_structure" || e.message === "no_facts_for_mode";

    if (isProviderError) {
      // Check if it's a provider rate limit (429)
      const isProvider429 = e.message === "provider_error_429";
      if (isProvider429) {
        // Propagate provider 429 as our own 429 with clear indication
        return json({
          error: {
            type: "rate_limited",
            code: "PROVIDER_RATE_LIMIT",
            message: "External API rate limit exceeded",
            source: "provider"
          },
          retry_after_sec: 60
        }, 429, env, req, { "Retry-After": "60" });
      }
      
      // Other provider errors return 502 Bad Gateway
      return json({
        error: {
          type: "provider_error",
          code: "PROVIDER_UNAVAILABLE",
          message: "External provider failed or is unavailable"
        }
      }, 502, env, req);
    } else if (isPlanError) {
      // Plan validation errors return 400 Bad Request (not 422 - that confuses retry logic)
      // eslint-disable-next-line no-undef
      const diseaseVal = typeof disease !== 'undefined' ? disease : "unknown";
      // eslint-disable-next-line no-undef
      const modeVal = typeof mode !== 'undefined' ? mode : "unknown";
      // eslint-disable-next-line no-undef
      const personaVal = typeof persona !== 'undefined' ? persona : "unknown";
      return json({
        error: {
          type: "bad_request",
          code: e.message === "no_facts_for_mode" ? "NO_FACTS_FOR_MODE" : "INVALID_PLAN",
          message: e.message === "no_facts_for_mode"
            ? `No facts available for disease "${diseaseVal}" in mode "${modeVal}". Please select a scenario or provide disease context.`
            : "Unable to generate or validate plan with provided parameters",
          details: { mode: modeVal, disease: diseaseVal, persona: personaVal, error: e.message }
        }
      }, 400, env, req);
    } else {
      // Other errors are treated as bad_request
      return json({
        error: {
          type: "bad_request",
          code: "REQUEST_FAILED",
          message: "Chat request failed"
        }
      }, 400, env, req);
    }
  }
}

/* -------------------------- /coach-metrics --------------------------------- */
async function postCoachMetrics(req, env) {
  try {
    const body = await readJson(req);

    // Log the metrics (in production, you could store these in KV or send to analytics)
    console.log("coach_metrics", {
      ts: body.ts || Date.now(),
      schema: body.schema || "coach-v2",
      mode: body.mode,
      scenarioId: body.scenarioId,
      turn: body.turn,
      overall: body.overall,
      scores: body.scores
    });

    // Return success
    return json({
      ok: true,
      message: "Metrics recorded",
      timestamp: Date.now()
    }, 200, env, req);
  } catch (e) {
    console.error("postCoachMetrics error:", e);
    return json({ error: "server_error", message: "Failed to record metrics" }, 500, env, req);
  }
}

function cryptoRandomId() {
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  return [...a].map(x => x.toString(16).padStart(2, "0")).join("");
}

/* -------------------------- Rate limiting --------------------------- */
const _buckets = new Map();
function rateLimit(key, env) {
  const rate = Number(env.RATELIMIT_RATE || 10);
  const burst = Number(env.RATELIMIT_BURST || 4);
  const now = Date.now();
  const b = _buckets.get(key) || { tokens: burst, ts: now };
  const elapsed = (now - b.ts) / 60000; // per minute
  b.tokens = Math.min(burst, b.tokens + elapsed * rate);
  b.ts = now;
  if (b.tokens < 1) { _buckets.set(key, b); return { ok: false, limit: rate, remaining: 0 }; }
  b.tokens -= 1; _buckets.set(key, b);
  return { ok: true, limit: rate, remaining: Math.max(0, Math.floor(b.tokens)) };
}
