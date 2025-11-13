#!/bin/bash

# Comprehensive formatting and structure test for all mode × disease combinations

BASE_URL="https://my-chat-agent-v2.tonyabdelmalak.workers.dev"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║   FORMATTING & STRUCTURE TEST - All Modes × Disease States     ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

modes=("sales-coach" "role-play" "product-knowledge" "emotional-assessment")
areas=("HIV" "Oncology" "Cardiovascular" "COVID-19" "Vaccines")

echo "Testing chat responses for formatting consistency..."
echo ""

for mode in "${modes[@]}"; do
  echo "═══════════════════════════════════════════════════════════════"
  echo "MODE: $mode"
  echo "═══════════════════════════════════════════════════════════════"

  for area in "${areas[@]}"; do
    echo ""
    echo "─── Testing: $mode + $area ───"

    # Create plan
    plan=$(curl -s -X POST "$BASE_URL/plan" \
      -H "Content-Type: application/json" \
      -d "{\"mode\":\"$mode\",\"disease\":\"$area\",\"persona\":\"Test HCP\",\"goal\":\"Test formatting\"}")

    # Send test message
    response=$(curl -s -X POST "$BASE_URL/chat" \
      -H "Content-Type: application/json" \
      -d "{\"mode\":\"$mode\",\"plan\":$plan,\"messages\":[{\"role\":\"user\",\"content\":\"Tell me about treatment options for my patients.\"}]}")

    reply=$(echo "$response" | jq -r '.reply // "ERROR"')

    if [[ $reply == "ERROR" ]]; then
      echo "❌ FAILED: No response received"
      continue
    fi

    # Check for formatting structure based on mode
    case $mode in
      "sales-coach")
        echo "Checking Sales Coach format (4 sections)..."
        if echo "$reply" | grep -q "Opening:"; then
          echo "  ✅ Has 'Opening:' section"
        else
          echo "  ❌ MISSING 'Opening:' section"
        fi

        if echo "$reply" | grep -q "Discovery Questions:"; then
          echo "  ✅ Has 'Discovery Questions:' section"
        else
          echo "  ❌ MISSING 'Discovery Questions:' section"
        fi

        if echo "$reply" | grep -q "Key Points:"; then
          echo "  ✅ Has 'Key Points:' section"
        else
          echo "  ❌ MISSING 'Key Points:' section"
        fi

        if echo "$reply" | grep -q "Suggested Phrasing:"; then
          echo "  ✅ Has 'Suggested Phrasing:' section"
        else
          echo "  ❌ MISSING 'Suggested Phrasing:' section"
        fi
        ;;

      "role-play")
        echo "Checking Role Play format (first-person HCP voice)..."
        if echo "$reply" | grep -qi "I think\|I would\|I'm\|I consider\|my patients\|my practice"; then
          echo "  ✅ Uses first-person voice"
        else
          echo "  ⚠️  May not be using first-person voice"
        fi
        ;;

      "product-knowledge")
        echo "Checking Product Knowledge format..."
        if [[ ${#reply} -gt 100 ]]; then
          echo "  ✅ Detailed response (${#reply} chars)"
        else
          echo "  ⚠️  Response seems short (${#reply} chars)"
        fi
        ;;

      "emotional-assessment")
        echo "Checking Emotional Assessment format..."
        if [[ ${#reply} -gt 50 ]]; then
          echo "  ✅ Response provided (${#reply} chars)"
        else
          echo "  ⚠️  Response seems short (${#reply} chars)"
        fi
        ;;
    esac

    # Check for citations
    if echo "$reply" | grep -q "\[1\]\|\[2\]\|\[3\]"; then
      echo "  ✅ Contains citation markers"
    else
      echo "  ⚠️  No citation markers found"
    fi

    # Preview response
    echo ""
    echo "  Response preview:"
    echo "  $(echo "$reply" | head -c 200)..."
    echo ""
  done
done

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "TESTING CITATIONS ENDPOINT"
echo "═══════════════════════════════════════════════════════════════"

# Test citations format
for area in "${areas[@]}"; do
  echo ""
  echo "Testing $area citations..."
  facts=$(curl -s -X POST "$BASE_URL/facts" \
    -H "Content-Type: application/json" \
    -d "{\"disease\":\"$area\",\"limit\":2}")

  cite=$(echo "$facts" | jq -r '.facts[0].cites[0] // "NONE"')

  if [[ $cite != "NONE" ]]; then
    echo "  ✅ Sample citation: $cite"

    # Check if it looks like a URL
    if [[ $cite == http* ]]; then
      echo "  ✅ Citation is a URL (linkable)"
    else
      echo "  ⚠️  Citation is plain text: '$cite'"
    fi
  else
    echo "  ❌ No citations found"
  fi
done

echo ""
echo "Test complete!"
