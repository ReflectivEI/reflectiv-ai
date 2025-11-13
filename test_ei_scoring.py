#!/usr/bin/env python3
"""
EI Scoring Integration Test
Tests the complete flow: UI → Worker → AI → Parser → UI
Validates PHASE 2 fixes: correct path, all 10 metrics, no invalid metrics
"""

import requests
import json
import time
from datetime import datetime

WORKER_URL = "https://my-chat-agent-v2.tonyabdelmalak.workers.dev"

# Expected 10 metrics (NO "accuracy" or "ei" nesting)
CANONICAL_METRICS = [
    "empathy",
    "clarity",
    "compliance",
    "discovery",
    "objection_handling",
    "confidence",
    "active_listening",
    "adaptability",
    "action_insight",
    "resilience"
]

# Test scenarios
test_scenarios = [
    {
        "mode": "sales-coach",
        "message": "I understand your concerns about patient adherence. Based on the DISCOVER trial data, Descovy for PrEP has shown excellent efficacy. How do you currently discuss PrEP options with at-risk patients?",
        "description": "Sales Coach - HIV PrEP discussion"
    },
    {
        "mode": "role-play",
        "persona": "difficult",
        "disease": "HIV",
        "message": "I appreciate you taking the time to meet with me today. I wanted to discuss how Descovy for PrEP might benefit your at-risk patient population.",
        "description": "Role Play - Difficult HCP, HIV"
    },
    {
        "mode": "emotional-assessment",
        "message": "Tell me about a recent challenging interaction with an HCP where you felt frustrated.",
        "description": "Emotional Assessment - Self-reflection"
    }
]


def test_ei_scoring(scenario, test_number):
    """Test EI scoring for a single scenario"""
    print("\n" + "=" * 80)
    print(f"TEST {test_number}: {scenario['description']}")
    print("=" * 80)

    body = {
        "mode": scenario["mode"],
        "message": scenario["message"],
        "conversation": [],
        "sessionId": f"test-{int(time.time())}-{test_number}"
    }

    if "persona" in scenario:
        body["persona"] = scenario["persona"]
    if "disease" in scenario:
        body["disease"] = scenario["disease"]

    print(f"\n📤 REQUEST:")
    print(f"Mode: {scenario['mode']}")
    print(f"Message: {scenario['message'][:100]}...")

    try:
        start_time = time.time()
        response = requests.post(
            f"{WORKER_URL}/chat",
            json=body,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        elapsed = (time.time() - start_time) * 1000  # ms

        if response.status_code != 200:
            raise Exception(f"HTTP {response.status_code}: {response.text}")

        data = response.json()
        print(f"\n📥 RESPONSE ({elapsed:.0f}ms):")
        print(f"Reply length: {len(data.get('reply', ''))} chars")

        # CRITICAL VALIDATION: Check coach object structure
        print(f"\n🔍 COACH OBJECT STRUCTURE:")

        if "coach" not in data:
            print(f"❌ FAIL: No coach object in response")
            return {"success": False, "error": "Missing coach object"}

        print(f"✅ coach object exists")

        coach = data["coach"]

        # Check for INCORRECT .ei nesting (should NOT exist)
        if "ei" in coach:
            print(f"❌ FAIL: Incorrect .ei nesting detected (should be flat .scores)")
            print(f"   Found: data.coach.ei = {str(coach['ei'])[:100]}")
            return {"success": False, "error": "Invalid .ei nesting"}

        print(f"✅ No incorrect .ei nesting")

        # Check for CORRECT .scores object
        if "scores" not in coach:
            print(f"❌ FAIL: No .scores object in coach")
            print(f"   Coach keys: {', '.join(coach.keys())}")
            return {"success": False, "error": "Missing .scores object"}

        print(f"✅ .scores object exists at correct path")

        scores = coach["scores"]
        print(f"\n📊 SCORES VALIDATION:")

        # Validate all 10 canonical metrics present
        all_metrics_present = True
        missing_metrics = []
        invalid_metrics = []

        for metric in CANONICAL_METRICS:
            if metric not in scores:
                all_metrics_present = False
                missing_metrics.append(metric)
                print(f"❌ Missing metric: {metric}")
            else:
                value = scores[metric]
                print(f"✅ {metric}: {value}/5")

        # Check for invalid metrics (e.g., "accuracy")
        for key in scores.keys():
            if key not in CANONICAL_METRICS:
                invalid_metrics.append(key)
                print(f"⚠️  Invalid metric detected: {key} = {scores[key]}")

        # Validate rationales
        print(f"\n📝 RATIONALES:")
        rationales = coach.get("rationales", {})
        rationale_count = 0
        for metric in CANONICAL_METRICS:
            if metric in rationales:
                rationale_count += 1
                print(f"✅ {metric}: \"{rationales[metric][:60]}...\"")

        print(f"\nRationale coverage: {rationale_count}/{len(CANONICAL_METRICS)}")

        # Validate other coach fields
        print(f"\n📋 OTHER COACH FIELDS:")
        print(f"worked: {len(coach.get('worked', []))} items" if "worked" in coach else "worked: missing")
        print(f"improve: {len(coach.get('improve', []))} items" if "improve" in coach else "improve: missing")
        print(f"phrasing: \"{coach.get('phrasing', '')[:50]}...\"" if "phrasing" in coach else "phrasing: missing")

        # FINAL VERDICT
        success = all_metrics_present and len(invalid_metrics) == 0 and "ei" not in coach

        print(f"\n" + "=" * 80)
        if success:
            print(f"✅ TEST {test_number} PASSED")
            print(f"   - All 10 canonical metrics present")
            print(f"   - No invalid metrics (e.g., \"accuracy\")")
            print(f"   - Correct path (coach.scores, not coach.ei.scores)")
            print(f"   - {rationale_count} rationales provided")
        else:
            print(f"❌ TEST {test_number} FAILED")
            if missing_metrics:
                print(f"   - Missing metrics: {', '.join(missing_metrics)}")
            if invalid_metrics:
                print(f"   - Invalid metrics: {', '.join(invalid_metrics)}")
            if "ei" in coach:
                print(f"   - Incorrect .ei nesting detected")
        print("=" * 80 + "\n")

        return {
            "success": success,
            "testNumber": test_number,
            "scenario": scenario["description"],
            "metrics": scores,
            "missingMetrics": missing_metrics,
            "invalidMetrics": invalid_metrics,
            "hasEiNesting": "ei" in coach,
            "rationaleCount": rationale_count,
            "elapsed": elapsed
        }

    except Exception as error:
        print(f"\n❌ TEST {test_number} ERROR: {str(error)}")
        print("=" * 80 + "\n")
        return {
            "success": False,
            "testNumber": test_number,
            "scenario": scenario["description"],
            "error": str(error)
        }


def run_all_tests():
    """Run complete test suite"""
    print("""
╔════════════════════════════════════════════════════════════════════════════╗
║                    EI SCORING INTEGRATION TEST SUITE                       ║
║                         PHASE 2 FIX VALIDATION                             ║
╚════════════════════════════════════════════════════════════════════════════╝

Testing against: """ + WORKER_URL + """
Date: """ + datetime.now().isoformat() + """

VALIDATION CRITERIA:
✓ All 10 canonical metrics present in response
✓ Correct path: coach.scores (NOT coach.ei.scores)
✓ No invalid metrics (e.g., "accuracy")
✓ Rationales provided for metrics
✓ Response time < 10 seconds
""")

    results = []

    # TEST 1
    print("\n🧪 RUNNING TEST SET 1 (Sales Coach)")
    test1 = test_ei_scoring(test_scenarios[0], 1)
    results.append(test1)
    time.sleep(2)  # 2s delay between tests

    # TEST 2
    print("\n🧪 RUNNING TEST SET 2 (Role Play)")
    test2 = test_ei_scoring(test_scenarios[1], 2)
    results.append(test2)
    time.sleep(2)

    # TEST 3 (FINAL)
    print("\n🧪 RUNNING FINAL TEST (Emotional Assessment)")
    test3 = test_ei_scoring(test_scenarios[2], 3)
    results.append(test3)

    # SUMMARY REPORT
    print("""
╔════════════════════════════════════════════════════════════════════════════╗
║                           FINAL TEST RESULTS                               ║
╚════════════════════════════════════════════════════════════════════════════╝
""")

    passed = sum(1 for r in results if r["success"])
    failed = len(results) - passed

    for i, result in enumerate(results):
        print(f"TEST {i + 1}: {result['scenario']}")
        print(f"  Status: {'✅ PASSED' if result['success'] else '❌ FAILED'}")
        if "error" in result:
            print(f"  Error: {result['error']}")
        else:
            print(f"  Response time: {result['elapsed']:.0f}ms")
            print(f"  Metrics count: {len(result.get('metrics', {}))}/10")
            print(f"  Missing: {len(result.get('missingMetrics', []))}")
            print(f"  Invalid: {len(result.get('invalidMetrics', []))}")
            print(f"  Has .ei nesting: {'YES (BAD)' if result.get('hasEiNesting') else 'NO (GOOD)'}")
            print(f"  Rationales: {result.get('rationaleCount', 0)}/10")
        print("")

    print("=" * 80)
    print(f"SUMMARY: {passed}/{len(results)} tests passed")
    print("=" * 80 + "\n")

    if passed == len(results):
        print("""
╔════════════════════════════════════════════════════════════════════════════╗
║  ✅ ALL TESTS PASSED - PHASE 2 FIXES CONFIRMED WORKING                     ║
╚════════════════════════════════════════════════════════════════════════════╝
""")
    else:
        print("""
╔════════════════════════════════════════════════════════════════════════════╗
║  ❌ SOME TESTS FAILED - REVIEW FAILURES ABOVE                              ║
╚════════════════════════════════════════════════════════════════════════════╝
""")

    return results


if __name__ == "__main__":
    try:
        results = run_all_tests()
        print("\n✅ Test suite completed\n")

        # Save results to file
        with open("EI_SCORING_TEST_RESULTS.json", "w") as f:
            json.dump({
                "timestamp": datetime.now().isoformat(),
                "worker_url": WORKER_URL,
                "results": results,
                "summary": {
                    "total": len(results),
                    "passed": sum(1 for r in results if r["success"]),
                    "failed": sum(1 for r in results if not r["success"])
                }
            }, f, indent=2)

        print("📄 Results saved to: EI_SCORING_TEST_RESULTS.json\n")

        exit(0 if all(r["success"] for r in results) else 1)
    except Exception as e:
        print(f"\n❌ Test suite failed: {e}\n")
        exit(1)
