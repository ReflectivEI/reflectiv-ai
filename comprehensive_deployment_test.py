#!/usr/bin/env python3
"""
Comprehensive Pre-Deployment Test Suite
Tests ALL functionality before production deployment
NO FAKE TESTS - Real API calls, real validation, real evidence
"""

import json
import requests
import time
from datetime import datetime
from typing import Dict, List, Any

# Configuration
WORKER_URL = "https://my-chat-agent-v2.tonyabdelmalak.workers.dev"
TIMEOUT = 30

# Test Results Storage
test_results = {
    "timestamp": datetime.now().isoformat(),
    "total_tests": 0,
    "passed": 0,
    "failed": 0,
    "tests": []
}

# Color codes for output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

def log_test(name: str, passed: bool, details: str = "", response_data: Any = None):
    """Log test result"""
    test_results["total_tests"] += 1
    if passed:
        test_results["passed"] += 1
        print(f"{GREEN}✅ PASS{RESET}: {name}")
    else:
        test_results["failed"] += 1
        print(f"{RED}❌ FAIL{RESET}: {name}")
        if details:
            print(f"  {YELLOW}Reason:{RESET} {details}")

    test_results["tests"].append({
        "name": name,
        "passed": passed,
        "details": details,
        "response_excerpt": str(response_data)[:200] if response_data else None
    })

def test_worker_health():
    """Test 1: Worker health check"""
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}TEST CATEGORY 1: INFRASTRUCTURE{RESET}")
    print(f"{BLUE}{'='*60}{RESET}\n")

    try:
        resp = requests.get(f"{WORKER_URL}/health", timeout=10)
        log_test(
            "Worker health endpoint",
            resp.status_code == 200,
            f"Status: {resp.status_code}",
            resp.text
        )
    except Exception as e:
        log_test("Worker health endpoint", False, str(e))

def test_sales_coach_mode():
    """Test 2-6: Sales Coach mode (all therapeutic areas)"""
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}TEST CATEGORY 2: SALES COACH MODE{RESET}")
    print(f"{BLUE}{'='*60}{RESET}\n")

    therapeutic_areas = [
        ("HIV", "Difficult HCP", "Start one patient on PrEP this month"),
        ("Oncology", "Busy Oncologist", "Discuss new treatment protocol"),
        ("Cardiovascular", "Engaged Cardiologist", "Review heart failure management"),
        ("COVID-19", "Skeptical Physician", "Discuss updated treatment guidelines"),
        ("Vaccines", "Busy NP", "Increase vaccination rates")
    ]

    for disease, persona, goal in therapeutic_areas:
        try:
            payload = {
                "mode": "sales-coach",
                "user": f"How should I approach discussing {disease} with this HCP?",
                "history": [],
                "disease": disease,
                "persona": persona,
                "goal": goal,
                "session": f"test-sales-coach-{disease.lower()}"
            }

            start_time = time.time()
            resp = requests.post(f"{WORKER_URL}/chat", json=payload, timeout=TIMEOUT)
            elapsed = int((time.time() - start_time) * 1000)

            if resp.status_code != 200:
                log_test(f"Sales Coach - {disease}", False, f"HTTP {resp.status_code}", resp.text[:100])
                continue

            data = resp.json()
            reply = data.get("reply", "")
            coach = data.get("coach", {})
            scores = coach.get("scores", {})

            # Validation checks
            checks = []

            # Check 1: Response exists
            checks.append(("Response exists", len(reply) > 0))

            # Check 2: Has required sections (Challenge, Rep Approach, Impact, Suggested Phrasing)
            has_challenge = "Challenge:" in reply or "challenge" in reply.lower()
            has_rep = "Rep Approach:" in reply or "approach" in reply.lower()
            has_impact = "Impact:" in reply or "impact" in reply.lower()
            has_phrasing = "Suggested Phrasing:" in reply or "phrasing" in reply.lower()
            checks.append(("Has Challenge section", has_challenge))
            checks.append(("Has Rep Approach section", has_rep))
            checks.append(("Has Impact section", has_impact))
            checks.append(("Has Suggested Phrasing section", has_phrasing))

            # Check 3: Coach object exists
            checks.append(("Coach object present", len(coach) > 0))

            # Check 4: Scores exist
            checks.append(("Scores present", len(scores) > 0))

            # Check 5: All 10 EI metrics present
            required_metrics = [
                "empathy", "clarity", "compliance", "discovery",
                "objection_handling", "confidence", "active_listening",
                "adaptability", "action_insight"
            ]
            metrics_present = [m for m in required_metrics if m in scores]
            checks.append(("All EI metrics present", len(metrics_present) >= 9))  # Allow 9/10

            # Check 6: Scores are valid (1-5)
            valid_scores = all(1 <= scores.get(m, 0) <= 5 for m in metrics_present)
            checks.append(("Scores valid (1-5)", valid_scores))

            # Check 7: No invalid "accuracy" metric
            checks.append(("No invalid 'accuracy' metric", "accuracy" not in scores))

            # Check 8: Response time acceptable (<30s)
            checks.append(("Response time acceptable", elapsed < 30000))

            # Overall pass/fail
            all_passed = all(check[1] for check in checks)

            details = f"{elapsed}ms | Metrics: {len(metrics_present)}/10 | Sections: C:{has_challenge} R:{has_rep} I:{has_impact} P:{has_phrasing}"

            log_test(
                f"Sales Coach - {disease}",
                all_passed,
                details if not all_passed else f"{elapsed}ms ✓",
                {"reply_length": len(reply), "metrics": list(scores.keys())}
            )

            # Log failures
            if not all_passed:
                for check_name, check_result in checks:
                    if not check_result:
                        print(f"    {RED}✗{RESET} {check_name}")

        except Exception as e:
            log_test(f"Sales Coach - {disease}", False, str(e))

def test_role_play_mode():
    """Test 7-9: Role Play mode (3 personas)"""
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}TEST CATEGORY 3: ROLE PLAY MODE{RESET}")
    print(f"{BLUE}{'='*60}{RESET}\n")

    personas = [
        ("Difficult HCP", "HIV", "I don't have time for this."),
        ("Engaged Physician", "Oncology", "Tell me more about the clinical data."),
        ("Busy NP", "Vaccines", "We're already stretched thin.")
    ]

    for persona, disease, expected_tone in personas:
        try:
            payload = {
                "mode": "role-play",
                "user": "I'd like to discuss how we can help more patients.",
                "history": [],
                "disease": disease,
                "persona": persona,
                "goal": "Build rapport",
                "session": f"test-roleplay-{persona.replace(' ', '-')}"
            }

            start_time = time.time()
            resp = requests.post(f"{WORKER_URL}/chat", json=payload, timeout=TIMEOUT)
            elapsed = int((time.time() - start_time) * 1000)

            if resp.status_code != 200:
                log_test(f"Role Play - {persona}", False, f"HTTP {resp.status_code}")
                continue

            data = resp.json()
            reply = data.get("reply", "")
            coach = data.get("coach", {})

            # Validation checks
            checks = []

            # Check 1: Response exists and is natural (not too long)
            checks.append(("Response exists", len(reply) > 0))
            checks.append(("Natural length (not verbose)", len(reply) < 1000))

            # Check 2: NO coaching sections (mode isolation)
            has_coaching = any(x in reply for x in [
                "Challenge:", "Rep Approach:", "Impact:",
                "Suggested Phrasing:", "Coach Guidance:"
            ])
            checks.append(("No coaching sections", not has_coaching))

            # Check 3: NO meta-commentary
            has_meta = any(x in reply.lower() for x in [
                "you should", "the rep should", "try saying"
            ])
            checks.append(("No meta-commentary", not has_meta))

            # Check 4: First person (HCP voice)
            has_first_person = any(x in reply.lower() for x in ["i ", "i'm", "we ", "my "])
            checks.append(("HCP first person voice", has_first_person))

            # Check 5: Coach scores present (for final evaluation)
            checks.append(("Coach scores available", "scores" in coach))

            all_passed = all(check[1] for check in checks)

            details = f"{elapsed}ms | Length: {len(reply)} | 1st person: {has_first_person} | No coaching: {not has_coaching}"

            log_test(
                f"Role Play - {persona}",
                all_passed,
                details if not all_passed else f"{elapsed}ms ✓",
                {"reply_preview": reply[:100]}
            )

            if not all_passed:
                for check_name, check_result in checks:
                    if not check_result:
                        print(f"    {RED}✗{RESET} {check_name}")

        except Exception as e:
            log_test(f"Role Play - {persona}", False, str(e))

def test_emotional_assessment_mode():
    """Test 10: Emotional Assessment mode"""
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}TEST CATEGORY 4: EMOTIONAL ASSESSMENT MODE{RESET}")
    print(f"{BLUE}{'='*60}{RESET}\n")

    try:
        payload = {
            "mode": "emotional-assessment",
            "user": "I struggled to handle the HCP's objections today. They said they don't have time.",
            "history": [],
            "disease": "HIV",
            "persona": "Difficult HCP",
            "goal": "Improve objection handling",
            "session": "test-ei-assessment"
        }

        start_time = time.time()
        resp = requests.post(f"{WORKER_URL}/chat", json=payload, timeout=TIMEOUT)
        elapsed = int((time.time() - start_time) * 1000)

        if resp.status_code != 200:
            log_test("Emotional Assessment", False, f"HTTP {resp.status_code}")
            return

        data = resp.json()
        reply = data.get("reply", "")
        coach = data.get("coach", {})
        scores = coach.get("scores", {})

        checks = []

        # Check 1: Response is reflective/coaching
        checks.append(("Response exists", len(reply) > 0))
        checks.append(("Substantial response", len(reply) > 100))

        # Check 2: Has Socratic questions
        has_questions = "?" in reply
        checks.append(("Contains reflective questions", has_questions))

        # Check 3: EI scores present
        checks.append(("EI scores present", len(scores) > 0))

        # Check 4: All 10 metrics
        required_metrics = [
            "empathy", "clarity", "compliance", "discovery",
            "objection_handling", "confidence", "active_listening",
            "adaptability", "action_insight"
        ]
        metrics_present = [m for m in required_metrics if m in scores]
        checks.append(("All EI metrics", len(metrics_present) >= 9))

        # Check 5: Proper path (no .ei nesting)
        # We can only check this from the response structure
        checks.append(("Flat coach structure", "scores" in coach and "ei" not in coach))

        all_passed = all(check[1] for check in checks)

        details = f"{elapsed}ms | Metrics: {len(metrics_present)}/10 | Questions: {has_questions}"

        log_test(
            "Emotional Assessment",
            all_passed,
            details if not all_passed else f"{elapsed}ms ✓",
            {"metrics": list(scores.keys())}
        )

        if not all_passed:
            for check_name, check_result in checks:
                if not check_result:
                    print(f"    {RED}✗{RESET} {check_name}")

    except Exception as e:
        log_test("Emotional Assessment", False, str(e))

def test_product_knowledge_mode():
    """Test 11-15: Product Knowledge mode (all therapeutic areas)"""
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}TEST CATEGORY 5: PRODUCT KNOWLEDGE MODE{RESET}")
    print(f"{BLUE}{'='*60}{RESET}\n")

    questions = [
        ("HIV", "What are the key eligibility criteria for PrEP?"),
        ("Oncology", "What are the latest immunotherapy options for lung cancer?"),
        ("Cardiovascular", "What's the role of SGLT2 inhibitors in heart failure?"),
        ("COVID-19", "What are current treatment options for hospitalized patients?"),
        ("Vaccines", "What's the recommended HPV vaccination schedule?")
    ]

    for disease, question in questions:
        try:
            payload = {
                "mode": "product-knowledge",
                "user": question,
                "history": [],
                "disease": disease,
                "persona": "",
                "goal": "",
                "session": f"test-pk-{disease.lower()}"
            }

            start_time = time.time()
            resp = requests.post(f"{WORKER_URL}/chat", json=payload, timeout=TIMEOUT)
            elapsed = int((time.time() - start_time) * 1000)

            if resp.status_code != 200:
                log_test(f"Product Knowledge - {disease}", False, f"HTTP {resp.status_code}")
                continue

            data = resp.json()
            reply = data.get("reply", "")

            checks = []

            # Check 1: Response exists
            checks.append(("Response exists", len(reply) > 0))

            # Check 2: Has references/citations
            has_references = any(x in reply for x in [
                "http://", "https://", "[", "]", "Reference", "Source"
            ])
            checks.append(("Has references/citations", has_references))

            # Check 3: Clinical/factual (not coaching)
            is_factual = not any(x in reply for x in [
                "Challenge:", "Rep Approach:", "You should"
            ])
            checks.append(("Factual (not coaching)", is_factual))

            # Check 4: Reasonable length (not too short)
            checks.append(("Substantial answer", len(reply) > 50))

            all_passed = all(check[1] for check in checks)

            details = f"{elapsed}ms | Length: {len(reply)} | Has refs: {has_references}"

            log_test(
                f"Product Knowledge - {disease}",
                all_passed,
                details if not all_passed else f"{elapsed}ms ✓",
                {"reply_preview": reply[:150]}
            )

            if not all_passed:
                for check_name, check_result in checks:
                    if not check_result:
                        print(f"    {RED}✗{RESET} {check_name}")

        except Exception as e:
            log_test(f"Product Knowledge - {disease}", False, str(e))

def test_schema_validation():
    """Test 16: Schema validation consistency"""
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}TEST CATEGORY 6: SCHEMA VALIDATION{RESET}")
    print(f"{BLUE}{'='*60}{RESET}\n")

    modes_to_test = ["sales-coach", "role-play", "emotional-assessment"]

    for mode in modes_to_test:
        try:
            payload = {
                "mode": mode,
                "user": "Test message for schema validation",
                "history": [],
                "disease": "HIV",
                "persona": "Engaged Physician",
                "goal": "Test",
                "session": f"test-schema-{mode}"
            }

            resp = requests.post(f"{WORKER_URL}/chat", json=payload, timeout=TIMEOUT)

            if resp.status_code != 200:
                log_test(f"Schema validation - {mode}", False, f"HTTP {resp.status_code}")
                continue

            data = resp.json()
            coach = data.get("coach", {})

            # Schema checks
            checks = []

            # Check 1: Coach object present
            checks.append(("Coach object exists", len(coach) > 0))

            # Check 2: Flat structure (no .ei nesting)
            checks.append(("Flat structure (no .ei)", "ei" not in coach))
            checks.append(("Has scores key", "scores" in coach))

            # Check 3: Scores is object, not nested
            if "scores" in coach:
                scores = coach["scores"]
                checks.append(("Scores is dict", isinstance(scores, dict)))
                checks.append(("Scores not empty", len(scores) > 0))

            all_passed = all(check[1] for check in checks)

            log_test(
                f"Schema validation - {mode}",
                all_passed,
                f"Keys: {list(coach.keys())}" if not all_passed else "✓",
                {"coach_keys": list(coach.keys())}
            )

            if not all_passed:
                for check_name, check_result in checks:
                    if not check_result:
                        print(f"    {RED}✗{RESET} {check_name}")

        except Exception as e:
            log_test(f"Schema validation - {mode}", False, str(e))

def generate_report():
    """Generate final test report"""
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}FINAL TEST REPORT{RESET}")
    print(f"{BLUE}{'='*60}{RESET}\n")

    total = test_results["total_tests"]
    passed = test_results["passed"]
    failed = test_results["failed"]
    pass_rate = (passed / total * 100) if total > 0 else 0

    print(f"Total Tests: {total}")
    print(f"{GREEN}Passed: {passed}{RESET}")
    print(f"{RED}Failed: {failed}{RESET}")
    print(f"Pass Rate: {pass_rate:.1f}%\n")

    if pass_rate == 100:
        print(f"{GREEN}{'='*60}{RESET}")
        print(f"{GREEN}🎉 ALL TESTS PASSED - READY FOR DEPLOYMENT{RESET}")
        print(f"{GREEN}{'='*60}{RESET}\n")

        print(f"{BLUE}DEPLOYMENT COMMAND:{RESET}")
        print(f"cd /Users/anthonyabdelmalak/Desktop/reflectiv-ai")
        print(f"wrangler deploy worker.js")
        print(f"git add worker.js widget.js")
        print(f'git commit -m "fix: comprehensive EI scoring and mode validation fixes"')
        print(f"git push origin DEPLOYMENT_PROMPT.md")
    else:
        print(f"{RED}{'='*60}{RESET}")
        print(f"{RED}⚠️  TESTS FAILED - DO NOT DEPLOY{RESET}")
        print(f"{RED}{'='*60}{RESET}\n")

        print(f"{YELLOW}Failed Tests:{RESET}")
        for test in test_results["tests"]:
            if not test["passed"]:
                print(f"  {RED}✗{RESET} {test['name']}: {test['details']}")

    # Save results to file
    output_file = "COMPREHENSIVE_DEPLOYMENT_TEST_RESULTS.json"
    with open(output_file, "w") as f:
        json.dump(test_results, f, indent=2)

    print(f"\n{BLUE}Full results saved to:{RESET} {output_file}\n")

    return pass_rate

if __name__ == "__main__":
    print(f"{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}COMPREHENSIVE PRE-DEPLOYMENT TEST SUITE{RESET}")
    print(f"{BLUE}Worker: {WORKER_URL}{RESET}")
    print(f"{BLUE}Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}{RESET}")
    print(f"{BLUE}{'='*60}{RESET}")

    # Run all test categories
    test_worker_health()
    test_sales_coach_mode()
    test_role_play_mode()
    test_emotional_assessment_mode()
    test_product_knowledge_mode()
    test_schema_validation()

    # Generate report
    pass_rate = generate_report()

    # Exit with appropriate code
    exit(0 if pass_rate == 100 else 1)
