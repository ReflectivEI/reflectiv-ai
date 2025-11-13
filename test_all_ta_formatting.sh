#!/bin/bash
echo "Testing Sales Coach formatting across all 5 therapeutic areas..."
echo "================================================================"

for ta in "HIV" "Oncology" "Cardiovascular" "COVID-19" "Vaccines"; do
  echo ""
  echo "--- $ta ---"
  response=$(curl -s -X POST "https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat" \
    -H "Content-Type: application/json" \
    -d "{\"mode\":\"sales-coach\",\"disease\":\"$ta\",\"messages\":[{\"role\":\"user\",\"content\":\"Test\"}]}")
  
  reply=$(echo "$response" | jq -r '.reply')
  lines=$(echo "$reply" | wc -l | tr -d ' ')
  
  has_challenge=$(echo "$reply" | grep -c "^Challenge:" || echo 0)
  has_rep=$(echo "$reply" | grep -c "^Rep Approach:" || echo 0)
  has_impact=$(echo "$reply" | grep -c "^Impact:" || echo 0)
  has_suggested=$(echo "$reply" | grep -c "^Suggested Phrasing:" || echo 0)
  
  echo "Lines: $lines"
  echo "Sections found: Challenge=$has_challenge RepApproach=$has_rep Impact=$has_impact SuggestedPhrasing=$has_suggested"
  
  if [[ $lines -ge 4 && $has_challenge -eq 1 && $has_rep -eq 1 && $has_impact -eq 1 && $has_suggested -eq 1 ]]; then
    echo "✅ PASS - Proper formatting"
  else
    echo "❌ FAIL - Missing newlines or sections"
  fi
done

echo ""
echo "================================================================"
echo "Test complete"
