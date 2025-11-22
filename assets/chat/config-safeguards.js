/**
 * PHASE 2 SAFEGUARDS: Real-Config Enforcement
 * This module prevents fake testing by validating all mode/persona/disease data against real config
 * 
 * CRITICAL RULES:
 * - No imaginary modes, personas, or disease states allowed
 * - All test data MUST come from real repository files
 * - Validation runs automatically on every request
 */

/* ===== Real Configuration References ===== */

// Real mode keys (from widget.js LC_TO_INTERNAL)
const VALID_MODES = [
  "sales-coach",
  "role-play",
  "emotional-assessment",
  "product-knowledge",
  "general-knowledge"
];

// Real personas (from persona.json)
const VALID_PERSONAS = [
  "difficult",
  "engaged",
  "indifferent"
];

// Real disease states (from scenarios.merged.json - sample of real IDs)
// These are actual disease scenario IDs from the repo
const VALID_DISEASES = [
  "hiv_im_decile3_prep_lowshare",
  "hiv_np_decile10_highshare_access",
  "hiv_pa_decile9_treat_switch_slowdown",
  "hiv_np_decile5_cab_growth",
  "hiv_im_decile4_prep_apretude_gap",
  "hiv_np_decile9_prep_ops_cap",
  "hiv_pa_decile7_treat_switch_day",
  "onc_md_decile10_io_adc_pathways"
  // Add more from scenarios.merged.json as needed
];

/* ===== Validation Functions ===== */

/**
 * validateMode - Reject any mode not in real LC_TO_INTERNAL
 * @param {string} mode - Mode to validate
 * @throws {Error} if mode invalid
 * @returns {string} - validated mode key
 */
function validateMode(mode) {
  if (!mode || typeof mode !== "string") {
    throw new Error("MODE_INVALID: Mode must be a non-empty string");
  }
  
  const normalized = String(mode).trim();
  
  if (!VALID_MODES.includes(normalized)) {
    throw new Error(
      `MODE_NOT_FOUND: "${normalized}" is not a valid mode. Valid modes: ${VALID_MODES.join(", ")}`
    );
  }
  
  return normalized;
}

/**
 * validatePersona - Reject any persona not in real persona.json
 * @param {string|null} persona - Persona key to validate (null allowed)
 * @throws {Error} if persona invalid
 * @returns {string|null} - validated persona or null
 */
function validatePersona(persona) {
  if (persona === null || persona === undefined) {
    return null; // Optional
  }
  
  if (typeof persona !== "string") {
    throw new Error("PERSONA_INVALID: Persona must be a string or null");
  }
  
  const normalized = String(persona).trim().toLowerCase();
  
  if (!VALID_PERSONAS.includes(normalized)) {
    throw new Error(
      `PERSONA_NOT_FOUND: "${persona}" is not a valid persona. Valid personas: ${VALID_PERSONAS.join(", ")}`
    );
  }
  
  return normalized;
}

/**
 * validateDisease - Reject any disease not in real scenarios.merged.json
 * @param {string|null} disease - Disease ID to validate (null allowed)
 * @throws {Error} if disease invalid
 * @returns {string|null} - validated disease or null
 */
function validateDisease(disease) {
  if (disease === null || disease === undefined) {
    return null; // Optional
  }
  
  if (typeof disease !== "string") {
    throw new Error("DISEASE_INVALID: Disease must be a string or null");
  }
  
  const normalized = String(disease).trim().toLowerCase();
  
  // Check against known diseases
  const isValidDisease = VALID_DISEASES.some(d => 
    d.toLowerCase() === normalized
  );
  
  if (!isValidDisease) {
    throw new Error(
      `DISEASE_NOT_FOUND: "${disease}" is not a valid disease state. ` +
      `Load disease IDs from scenarios.merged.json. Sample valid: ${VALID_DISEASES.slice(0, 3).join(", ")}...`
    );
  }
  
  return normalized;
}

/**
 * validateRequestPayload - Validate entire request against real config
 * @param {object} payload - Request payload
 * @throws {Error} if validation fails
 * @returns {object} - validated payload
 */
function validateRequestPayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("PAYLOAD_INVALID: Payload must be an object");
  }
  
  const validated = { ...payload };
  
  // MANDATORY: mode
  try {
    validated.mode = validateMode(payload.mode);
  } catch (e) {
    throw new Error(`MODE_VALIDATION_FAILED: ${e.message}`);
  }
  
  // OPTIONAL: persona
  try {
    validated.persona = validatePersona(payload.persona);
  } catch (e) {
    throw new Error(`PERSONA_VALIDATION_FAILED: ${e.message}`);
  }
  
  // OPTIONAL: disease
  try {
    validated.disease = validateDisease(payload.disease);
  } catch (e) {
    throw new Error(`DISEASE_VALIDATION_FAILED: ${e.message}`);
  }
  
  // MANDATORY: messages array
  if (!Array.isArray(payload.messages) || payload.messages.length === 0) {
    throw new Error("PAYLOAD_INVALID: Messages must be a non-empty array");
  }
  
  validated.messages = payload.messages;
  
  return validated;
}

/**
 * isValidModeEnum - Check if value is valid mode (boolean, no throw)
 */
function isValidModeEnum(mode) {
  return VALID_MODES.includes(String(mode || "").trim());
}

/**
 * isValidPersonaEnum - Check if value is valid persona (boolean, no throw)
 */
function isValidPersonaEnum(persona) {
  return persona === null || VALID_PERSONAS.includes(String(persona || "").trim().toLowerCase());
}

/**
 * isValidDiseaseEnum - Check if value is valid disease (boolean, no throw)
 */
function isValidDiseaseEnum(disease) {
  if (disease === null || disease === undefined) return true;
  const normalized = String(disease).trim().toLowerCase();
  return VALID_DISEASES.some(d => d.toLowerCase() === normalized);
}

/* ===== Export for use in tests and workers ===== */

// CommonJS exports (for Node.js/Worker environments)
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    VALID_MODES,
    VALID_PERSONAS,
    VALID_DISEASES,
    validateMode,
    validatePersona,
    validateDisease,
    validateRequestPayload,
    isValidModeEnum,
    isValidPersonaEnum,
    isValidDiseaseEnum
  };
}

// ES6 exports (for browser environments)
if (typeof window !== "undefined") {
  window.ConfigSafeguards = {
    VALID_MODES,
    VALID_PERSONAS,
    VALID_DISEASES,
    validateMode,
    validatePersona,
    validateDisease,
    validateRequestPayload,
    isValidModeEnum,
    isValidPersonaEnum,
    isValidDiseaseEnum
  };
}
