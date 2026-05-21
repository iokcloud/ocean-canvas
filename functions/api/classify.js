export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const formData = await request.formData();
    const imageFile = formData.get('image');
    const creatureType = formData.get('type') || 'fish';

    if (!imageFile) {
      return jsonResponse({ error: 'No image provided' }, 400);
    }

    const imageBuffer = await imageFile.arrayBuffer();

    if (!env.AI) {
      const fallback = fallbackClassification(creatureType);
      return jsonResponse({
        type: creatureType,
        similarity: fallback.similarity,
        isMatch: fallback.similarity >= 0.6,
        creativity: 50,
        feedback: fallback.feedback,
        suggestedType: creatureType,
      });
    }

    const classification = await classifyWithAI(env, imageBuffer, creatureType);
    const creativity = await scoreCreativity(env, imageBuffer, creatureType);

    return jsonResponse({
      type: creatureType,
      similarity: classification.similarity,
      isMatch: classification.similarity >= 0.6,
      creativity: creativity.score,
      feedback: classification.feedback,
      suggestedType: classification.suggestedType,
    });
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

async function classifyWithAI(env, imageBuffer, expectedType) {
  try {
    const response = await env.AI.run('@cf/meta/llama-3.2-11b-vision-instruct', {
      image: new Uint8Array(imageBuffer),
      prompt: buildPrompt(expectedType),
      max_tokens: 200,
    });

    const text = response.description || response.response || '';
    return parseAIResponse(text, expectedType);
  } catch (error) {
    console.error('AI classification error:', error);
    return fallbackClassification(expectedType);
  }
}

function buildPrompt(expectedType) {
  const typeDescriptions = {
    fish: 'a fish (any kind: tropical fish, goldfish, cartoon fish, simple fish drawing)',
    jellyfish: 'a jellyfish (with dome/bell shape and tentacles)',
    octopus: 'an octopus (with round head and tentacles)',
    turtle: 'a sea turtle (with shell and flippers)',
    crab: 'a crab (with shell and claws)',
    whale: 'a whale (large marine mammal shape)',
    shark: 'a shark (with streamlined body and fins)',
    seahorse: 'a seahorse (with S-shaped body and curled tail)',
  };

  const description = typeDescriptions[expectedType] || 'a sea creature';

  return `Analyze this drawing and determine if it depicts ${description}. Also consider if it resembles any other sea creature. Respond ONLY in this exact JSON format with no other text: {"similarity": 0.85, "bestMatch": "fish", "feedback": "Good fish shape with visible tail and eye"}`;
}

function parseAIResponse(text, expectedType) {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        similarity: Math.min(1, Math.max(0, parsed.similarity || 0)),
        feedback: parsed.feedback || '',
        suggestedType: parsed.bestMatch || expectedType,
      };
    }
  } catch {}

  return fallbackClassification(expectedType);
}

function fallbackClassification(expectedType) {
  return {
    similarity: 0.7,
    feedback: 'Drawing detected. Keep drawing to improve your score!',
    suggestedType: expectedType,
  };
}

async function scoreCreativity(env, imageBuffer, creatureType) {
  try {
    const response = await env.AI.run('@cf/meta/llama-3.2-11b-vision-instruct', {
      image: new Uint8Array(imageBuffer),
      prompt: `Rate the creativity of this ${creatureType} drawing 0-100. Consider: unique details, color usage, expressiveness. JSON only: {"score": 75, "highlights": "nice colors"}`,
      max_tokens: 100,
    });

    const text = response.description || response.response || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        score: Math.min(100, Math.max(0, parsed.score || 50)),
        highlights: parsed.highlights || '',
      };
    }
  } catch {}

  return { score: 50, highlights: '' };
}
