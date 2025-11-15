# LC Integration Tests Summary

**Execution Date:** 2025-11-15T02:33:54.655Z
**HTTP Calls Made:** 20 (all to real Worker endpoint)
**Total Tests:** 20
**Passed:** 18
**Failed:** 2
**Errors:** 0

## Test Results by Mode

### SALES-COACH
**Status:** 4/4 passed

| Test ID | Persona | Disease | Status | Issues |
|---------|---------|---------|--------|--------|
| SC-01 | hiv_fp_md_timepressed | hiv_im_decile3_prep_lowshare | ✅ PASS | None |
| SC-02 | hiv_id_md_guideline_strict | hiv_np_decile10_highshare_access | ✅ PASS | None |
| SC-03 | onco_hemonc_md_costtox | onc_md_decile10_io_adc_pathways | ✅ PASS | None |
| SC-04 | vax_peds_np_hesitancy | vac_np_decile5_primary_care_capture | ✅ PASS | None |

### ROLE-PLAY
**Status:** 4/4 passed

| Test ID | Persona | Disease | Status | Issues |
|---------|---------|---------|--------|--------|
| RP-01 | hiv_fp_md_timepressed | hiv_im_decile3_prep_lowshare | ✅ PASS | None |
| RP-02 | hiv_id_md_guideline_strict | hiv_np_decile10_highshare_access | ✅ PASS | None |
| RP-03 | onco_hemonc_md_costtox | onc_md_decile10_io_adc_pathways | ✅ PASS | None |
| RP-04 | vax_peds_np_hesitancy | vac_np_decile5_primary_care_capture | ✅ PASS | None |

### EMOTIONAL-ASSESSMENT
**Status:** 3/4 passed

| Test ID | Persona | Disease | Status | Issues |
|---------|---------|---------|--------|--------|
| EI-01 | hiv_fp_md_timepressed | hiv_im_decile3_prep_lowshare | ❌ FAIL | HTTP 429: rate_limited |
| EI-02 | hiv_id_md_guideline_strict | hiv_np_decile10_highshare_access | ✅ PASS | None |
| EI-03 | onco_hemonc_md_costtox | onc_md_decile10_io_adc_pathways | ✅ PASS | None |
| EI-04 | vax_peds_np_hesitancy | vac_np_decile5_primary_care_capture | ✅ PASS | None |

### PRODUCT-KNOWLEDGE
**Status:** 4/4 passed

| Test ID | Persona | Disease | Status | Issues |
|---------|---------|---------|--------|--------|
| PK-01 | hiv_fp_md_timepressed | hiv_im_decile3_prep_lowshare | ✅ PASS | None |
| PK-02 | hiv_id_md_guideline_strict | hiv_np_decile10_highshare_access | ✅ PASS | None |
| PK-03 | onco_hemonc_md_costtox | onc_md_decile10_io_adc_pathways | ✅ PASS | None |
| PK-04 | vax_peds_np_hesitancy | vac_np_decile5_primary_care_capture | ✅ PASS | None |

### GENERAL-KNOWLEDGE
**Status:** 3/4 passed

| Test ID | Persona | Disease | Status | Issues |
|---------|---------|---------|--------|--------|
| GK-01 | hiv_fp_md_timepressed | hiv_im_decile3_prep_lowshare | ✅ PASS | None |
| GK-02 | hiv_id_md_guideline_strict | hiv_np_decile10_highshare_access | ✅ PASS | None |
| GK-03 | onco_hemonc_md_costtox | onc_md_decile10_io_adc_pathways | ✅ PASS | None |
| GK-04 | vax_peds_np_hesitancy | vac_np_decile5_primary_care_capture | ❌ FAIL | HTTP 429: rate_limited |


## Detailed Violations by Mode

### EMOTIONAL-ASSESSMENT Violations

**EI-01** (hiv_fp_md_timepressed / hiv_im_decile3_prep_lowshare):
- HTTP 429: rate_limited

### GENERAL-KNOWLEDGE Violations

**GK-04** (vax_peds_np_hesitancy / vac_np_decile5_primary_care_capture):
- HTTP 429: rate_limited


## Analysis & Suspected Root Causes

### EMOTIONAL-ASSESSMENT
**Failures:** 1/4 tests

**Common Issues:**
- HTTP 429: rate_limited (1x)

**Suspected Root Cause:**
- Check worker.js lines 1166-1205: eiPrompt format
- Verify EI framework context is being injected
- Validate Socratic questions generation

### GENERAL-KNOWLEDGE
**Failures:** 1/4 tests

**Common Issues:**
- HTTP 429: rate_limited (1x)

**Suspected Root Cause:**
- Check worker.js lines 1285+: generalKnowledgePrompt format
- Verify response is not using structured formats


## Conclusion

⚠️ **2 TESTS FAILED.** See violations above for required fixes.
