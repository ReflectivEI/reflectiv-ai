# LC Integration Tests Summary (With Retry)

**Execution Date:** 2025-11-15T03:11:58.699Z
**HTTP Calls Made:** 20 (all to real Worker endpoint)
**Total Tests:** 20
**Passed:** 20
**Failed (Contract):** 0
**Failed (Infrastructure/429):** 0

## Test Results by Mode

### SALES-COACH
**Status:** 4/4 passed

| Test ID | Persona | Disease | Status | Retries | Details |
|---------|---------|---------|--------|---------|----------|
| SC-01 | hiv_fp_md_timepressed | hiv_im_decile3_prep_lowshare | ✅ PASS | 0 | None |
| SC-02 | hiv_id_md_guideline_strict | hiv_np_decile10_highshare_access | ✅ PASS | 0 | None |
| SC-03 | onco_hemonc_md_costtox | onc_md_decile10_io_adc_pathways | ✅ PASS | 0 | None |
| SC-04 | vax_peds_np_hesitancy | vac_np_decile5_primary_care_capture | ✅ PASS | 0 | None |

### ROLE-PLAY
**Status:** 4/4 passed

| Test ID | Persona | Disease | Status | Retries | Details |
|---------|---------|---------|--------|---------|----------|
| RP-01 | hiv_fp_md_timepressed | hiv_im_decile3_prep_lowshare | ✅ PASS | 0 | None |
| RP-02 | hiv_id_md_guideline_strict | hiv_np_decile10_highshare_access | ✅ PASS | 0 | None |
| RP-03 | onco_hemonc_md_costtox | onc_md_decile10_io_adc_pathways | ✅ PASS | 0 | None |
| RP-04 | vax_peds_np_hesitancy | vac_np_decile5_primary_care_capture | ✅ PASS | 0 | None |

### EMOTIONAL-ASSESSMENT
**Status:** 4/4 passed

| Test ID | Persona | Disease | Status | Retries | Details |
|---------|---------|---------|--------|---------|----------|
| EI-01 | hiv_fp_md_timepressed | hiv_im_decile3_prep_lowshare | ✅ PASS | 1 | None |
| EI-02 | hiv_id_md_guideline_strict | hiv_np_decile10_highshare_access | ✅ PASS | 1 | None |
| EI-03 | onco_hemonc_md_costtox | onc_md_decile10_io_adc_pathways | ✅ PASS | 1 | None |
| EI-04 | vax_peds_np_hesitancy | vac_np_decile5_primary_care_capture | ✅ PASS | 1 | None |

### PRODUCT-KNOWLEDGE
**Status:** 4/4 passed

| Test ID | Persona | Disease | Status | Retries | Details |
|---------|---------|---------|--------|---------|----------|
| PK-01 | hiv_fp_md_timepressed | hiv_im_decile3_prep_lowshare | ✅ PASS | 2 | None |
| PK-02 | hiv_id_md_guideline_strict | hiv_np_decile10_highshare_access | ✅ PASS | 0 | None |
| PK-03 | onco_hemonc_md_costtox | onc_md_decile10_io_adc_pathways | ✅ PASS | 1 | None |
| PK-04 | vax_peds_np_hesitancy | vac_np_decile5_primary_care_capture | ✅ PASS | 1 | None |

### GENERAL-KNOWLEDGE
**Status:** 4/4 passed

| Test ID | Persona | Disease | Status | Retries | Details |
|---------|---------|---------|--------|---------|----------|
| GK-01 | hiv_fp_md_timepressed | hiv_im_decile3_prep_lowshare | ✅ PASS | 1 | None |
| GK-02 | hiv_id_md_guideline_strict | hiv_np_decile10_highshare_access | ✅ PASS | 1 | None |
| GK-03 | onco_hemonc_md_costtox | onc_md_decile10_io_adc_pathways | ✅ PASS | 1 | None |
| GK-04 | vax_peds_np_hesitancy | vac_np_decile5_primary_care_capture | ✅ PASS | 1 | None |


## Failure Analysis


## Rate Limiting Analysis

**Current Rate Limit Config (from worker.js):**
- Base rate: 10 requests per minute (RATELIMIT_RATE)
- Burst capacity: 4 requests (RATELIMIT_BURST)
- Bucket key: `${IP}:chat`
- Retry-After: 2 seconds (default, configurable via RATELIMIT_RETRY_AFTER)


## Conclusion

✅ **NO CONTRACT FAILURES.** All successful responses met their contracts.
✅ **NO INFRASTRUCTURE FAILURES.** All tests completed successfully.
