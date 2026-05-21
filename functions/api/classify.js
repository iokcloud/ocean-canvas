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
      console.error('[classify] env.AI is undefined - AI binding not configured');
      const fallback = fallbackClassification(creatureType);
      return jsonResponse({
        type: creatureType,
        similarity: fallback.similarity,
        isMatch: fallback.similarity >= 0.6,
        creativity: 50,
        feedback: '[No AI binding] ' + fallback.feedback,
        suggestedType: creatureType,
      });
    }

    console.info('[classify] env.AI available, calling vision model');
    const classification = await classifyWithAI(env, imageBuffer, creatureType);
    const creativity = await scoreCreativity(env, imageBuffer, creatureType, true);

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

let licenseAgreed = false;

async function ensureLicenseAccepted(env) {
  if (licenseAgreed) return;
  try {
    const res = await env.AI.run('@cf/meta/llama-3.2-11b-vision-instruct', {
      messages: [{ role: 'user', content: 'agree' }],
      max_tokens: 1,
    });
    licenseAgreed = true;
    console.info('[classify] License accepted for llama-3.2-11b-vision');
  } catch (e) {
    console.warn('[classify] License accept error (may already be accepted):', e.message);
    licenseAgreed = true;
  }
}

async function classifyWithAI(env, imageBuffer, expectedType) {
  try {
    await ensureLicenseAccepted(env);
    const response = await env.AI.run('@cf/meta/llama-3.2-11b-vision-instruct', {
      image: new Uint8Array(imageBuffer),
      prompt: buildPrompt(expectedType),
      max_tokens: 200,
    });

    const text = response.description || response.response || '';
    return parseAIResponse(text, expectedType);
  } catch (error) {
    console.error('AI classification error:', error);
    return { ...fallbackClassification(expectedType), feedback: '[AI error: ' + error.message + '] ' + fallbackClassification(expectedType).feedback };
  }
}

function buildPrompt(expectedType) {
  const typeDescriptions = {
    fish: 'a fish (look for: body shape, tail/fins, eye, scales pattern. ANY drawing effort counts - even simple stick-figure fish or crude shapes)',
    jellyfish: 'a jellyfish (look for: dome/bell on top, dangling tentacles below. Even simple dome+lines counts)',
    octopus: 'an octopus (look for: round head, tentacles extending down. Even a circle with wavy lines counts)',
    turtle: 'a sea turtle (look for: oval shell, head, flippers. Even a simple oval with legs counts)',
    crab: 'a crab (look for: body shell, claws on sides, legs. Even a circle with pincers counts)',
    whale: 'a whale (look for: large rounded body, tail fin, possibly water spout. Even a big blob with tail counts)',
    shark: 'a shark (look for: streamlined body, dorsal fin, tail. Even a triangle-ish shape with fin counts)',
    seahorse: 'a seahorse (look for: S-curved body, curled tail, snout. Even an S-shape counts)',
  };

  const description = typeDescriptions[expectedType] || 'a sea creature of some kind';

  return `You are analyzing a hand-drawn sketch on a white background. This is a casual drawing game - be ENCOURAGING and GENEROUS with similarity scores.

The user was asked to draw: ${description}

IMPORTANT SCORING GUIDE:
- If you can recognize the intended creature even partially: similarity 0.7-0.95
- If it has 1-2 recognizable features (like a fin, eye, tentacle): similarity 0.5-0.7
- If it's just a rough shape that could be the creature: similarity 0.3-0.5
- If it looks nothing like the creature: similarity 0.1-0.3
- Give specific feedback about what features you see and what could be improved

Also identify if it more closely resembles a different sea creature.

Respond ONLY in this exact JSON format with no other text before or after:
{"similarity": 0.85, "bestMatch": "fish", "feedback": "Good fish shape! I can see the body and tail. Try adding an eye and fins for more detail."}`;
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

async function scoreCreativity(env, imageBuffer, creatureType, licenseAccepted = false) {
  try {
    if (!licenseAccepted) await ensureLicenseAccepted(env);
    const response = await env.AI.run('@cf/meta/llama-3.2-11b-vision-instruct', {
      image: new Uint8Array(imageBuffer),
      prompt: `You are scoring the CREATIVITY of this hand-drawn ${creatureType} sketch on a white background.

SCORING GUIDE (be generous - this is a casual drawing game):
- 80-100: Outstanding! Has unique creative touches, multiple colors, expressive style, or surprising details
- 60-79: Creative! Has some nice details, good use of color, or personality beyond the basics
- 40-59: Solid effort! Has recognizable features and some thought put into it
- 20-39: Basic but valid. A simple attempt with minimal detail
- 0-19: Very minimal effort or nearly blank

Consider: color variety, unique details, expressiveness, composition, effort visible.

Respond ONLY with JSON, no other text:
{"score": 65, "highlights": "nice use of neon colors and a creative eye design"}`,
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
