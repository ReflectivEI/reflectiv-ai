// const WORKER = ''; // Force hardcoded AI logic

// Hardcoded AI logic for deterministic reasoning
function getHardcodedResponse(mode, messages) {
  const lastMsg = messages[messages.length - 1]?.content?.toLowerCase() || '';
  const userQuestion = messages[messages.length - 1]?.content || '';

  if (mode === 'sales-coach') {
    // Rule-based for sales-coach with more keywords
    let challenge = 'Navigating HCP concerns effectively';
    let repApproach = ['• Understand the HCP\'s perspective on patient risk', '• Highlight PrEP efficacy data', '• Address safety concerns with renal monitoring'];
    let impact = 'Improves patient outcomes by enabling timely PrEP initiation';
    let phrasing = '“Based on CDC guidelines, PrEP can reduce HIV risk by over 99% when taken as prescribed.”';

    if (lastMsg.includes('prep') || lastMsg.includes('hiv') || lastMsg.includes('risk')) {
      challenge = 'Addressing HCP questions about PrEP eligibility and safety';
      repApproach = ['• Review CDC PrEP guidelines for high-risk patients', '• Discuss Descovy indications and contraindications', '• Emphasize regular monitoring requirements'];
      impact = 'Ensures safe and effective PrEP access for at-risk patients';
      phrasing = '“For patients with ongoing risk, PrEP offers proven protection with proper monitoring.”';
    } else if (lastMsg.includes('cost') || lastMsg.includes('insurance')) {
      challenge = 'Overcoming barriers to PrEP access and affordability';
      repApproach = ['• Discuss patient assistance programs', '• Highlight long-term cost savings from prevention', '• Provide resources for coverage verification'];
      impact = 'Removes financial obstacles to PrEP adoption';
      phrasing = '“Many patients qualify for assistance programs that make PrEP accessible.”';
    } else if (lastMsg.includes('side effect') || lastMsg.includes('safety')) {
      challenge = 'Addressing HCP concerns about PrEP tolerability';
      repApproach = ['• Review common side effects and management', '• Compare to other preventive measures', '• Emphasize monitoring protocols'];
      impact = 'Builds confidence in PrEP as a safe preventive option';
      phrasing = '“Most side effects are mild and resolve within weeks of starting.”';
    }

    return {
      reply: `Challenge: ${challenge}\n\nRep Approach:\n${repApproach.join('\n')}\n\nImpact: ${impact}\n\nSuggested Phrasing: "${phrasing}"`,
      coach: {
        overall: 85,
        scores: { accuracy: 4, compliance: 4, discovery: 4, clarity: 4, objection_handling: 4, empathy: 4 },
        worked: ['Used facts to address concerns'],
        improve: ['Ask about specific patient scenarios'],
        phrasing: 'Would reviewing a patient case help illustrate the benefits?',
        feedback: 'Strong guidance with clear next steps.',
        context: { rep_question: userQuestion, hcp_reply: `Challenge: ${challenge}...` }
      },
      plan: { id: 'hardcoded-plan' }
    };
  } else if (mode === 'role-play') {
    // HCP responses based on keywords
    if (lastMsg.includes('prescribe') || lastMsg.includes('recommend')) {
      return {
        reply: 'I evaluate each patient individually based on their risk factors and medical history. PrEP can be appropriate for those at substantial risk.',
        coach: null,
        plan: { id: 'hardcoded-plan' }
      };
    }
    return {
      reply: 'In my practice, we prioritize patient safety and evidence-based care. PrEP is an important tool for high-risk individuals.',
      coach: null,
      plan: { id: 'hardcoded-plan' }
    };
  } else if (mode === 'emotional-assessment') {
    // Responses that end with questions
    if (lastMsg.includes('anxious') || lastMsg.includes('worried')) {
      return {
        reply: 'Anxiety about PrEP discussions is common. What specific aspects make you feel anxious?',
        coach: null,
        plan: { id: 'hardcoded-plan' }
      };
    }
    return {
      reply: 'It sounds like you\'re feeling concerned about patient adherence. What emotions come up when discussing PrEP with patients?',
      coach: null,
      plan: { id: 'hardcoded-plan' }
    };
  } else if (mode === 'product-knowledge') {
    // Cite facts based on keywords
    if (lastMsg.includes('descovy')) {
      return {
        reply: 'Descovy (emtricitabine/tenofovir alafenamide) is indicated for PrEP in adults and adolescents weighing at least 35 kg, excluding those at risk from receptive vaginal sex. [HIV-PREP-TAF-002]',
        coach: null,
        plan: { id: 'hardcoded-plan' }
      };
    } else if (lastMsg.includes('safety') || lastMsg.includes('monitoring')) {
      return {
        reply: 'Assess renal function before and during PrEP. Consider eGFR thresholds per label. [HIV-PREP-SAFETY-003]',
        coach: null,
        plan: { id: 'hardcoded-plan' }
      };
    }
    return {
      reply: 'PrEP is recommended for individuals at substantial risk of HIV. Discuss sexual and injection risk factors. [HIV-PREP-ELIG-001]',
      coach: null,
      plan: { id: 'hardcoded-plan' }
    };
  } else if (mode === 'general-knowledge') {
    if (lastMsg.includes('spread') || lastMsg.includes('transmission')) {
      return {
        reply: 'HIV transmission can occur through sexual contact, sharing needles, or from mother to child during pregnancy. PrEP is highly effective at preventing HIV when taken consistently.',
        coach: null,
        plan: { id: 'hardcoded-plan' }
      };
    }
    return {
      reply: 'HIV transmission can occur through sexual contact, sharing needles, or from mother to child during pregnancy. PrEP is highly effective at preventing HIV when taken consistently.',
      coach: null,
      plan: { id: 'hardcoded-plan' }
    };
  }

  // Fallback
  return {
    reply: 'Thank you for your question. Please provide more details for better assistance.',
    coach: null,
    plan: { id: 'hardcoded-plan' }
  };
}

export async function chat({mode, messages, signal}){
  // Always use hardcoded logic
  await new Promise(resolve => setTimeout(resolve, 500));
  return getHardcodedResponse(mode, messages);
}
