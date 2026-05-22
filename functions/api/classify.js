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

const AI_MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';

let licenseAgreed = false;

async function ensureLicenseAccepted(env) {
  if (licenseAgreed) return;
  for (let i = 0; i < 3; i++) {
    try {
      await env.AI.run(AI_MODEL, { prompt: 'agree', max_tokens: 1 });
      licenseAgreed = true;
      return;
    } catch (e) {
      if (i === 2) { licenseAgreed = true; return; }
      await new Promise(r => setTimeout(r, 500));
    }
  }
}

async function aiRunWithRetry(env, input, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await env.AI.run(AI_MODEL, input);
    } catch (e) {
      if (i === retries) throw e;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

async function classifyWithAI(env, imageBuffer, expectedType) {
  try {
    await ensureLicenseAccepted(env);
    const response = await aiRunWithRetry(env, {
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
    fish: 'a fish facing right (body + tail/fins; NOT random scribbles or overlapping loops)',
    jellyfish: 'a jellyfish (dome/bell + tentacles; NOT random lines)',
    octopus: 'an octopus (head + multiple tentacles; NOT tangled scribbles)',
    turtle: 'a sea turtle (shell + head + flippers)',
    crab: 'a crab (body + claws)',
    whale: 'a whale (large body + tail; NOT abstract loops)',
    shark: 'a shark (streamlined body + dorsal fin + tail)',
    seahorse: 'a seahorse (S-curved body + snout + curled tail)',
  };

  const description = typeDescriptions[expectedType] || 'a sea creature of some kind';

  return `You are analyzing a CHILD'S HAND-DRAWN SKETCH on a white background. This is a casual drawing game - the drawings are simple, rough, and cartoon-like. Do NOT compare to realistic or detailed art.

The user was asked to draw: ${description}

SCORING GUIDE — be HONEST and STRICT about whether it looks like the creature:
- Clear recognizable creature with key features (body, tail, fins, etc): similarity 0.65-0.9
- Rough but clearly the right animal shape: similarity 0.45-0.64
- Vague / might be the creature with effort: similarity 0.25-0.44
- Random scribbles, overlapping loops, tangled lines, NOT the animal: similarity 0.0-0.24
- Do NOT give high scores to meaningless doodles
- Give short helpful feedback (what to add: tail, eye, fins...)

Also identify if it more closely resembles a different sea creature.

Respond ONLY in this exact JSON format with no other text before or after:
{"similarity": 0.65, "bestMatch": "fish", "feedback": "I can see the fish shape! Try adding an eye and some fins to make it even better."}`;
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
    similarity: 0,
    feedback: 'AI error. Please try again.',
    suggestedType: expectedType,
  };
}

async function scoreCreativity(env, imageBuffer, creatureType) {
  try {
    const response = await aiRunWithRetry(env, {
      image: new Uint8Array(imageBuffer),
      prompt: `You are scoring the CREATIVITY of this hand-drawn ${creatureType} sketch on a white background. Be STRICT and accurate.

SCORING GUIDE:
- 80-100: Exceptional! Multiple colors, unique creative touches, expressive style, surprising details, good composition
- 60-79: Creative! Has nice details, good use of color, personality beyond basics, some original elements
- 40-59: Solid effort. Has recognizable features and some thought, but limited creativity or detail
- 20-39: Basic. Simple attempt with minimal detail, single color, little effort visible
- 0-19: Very minimal effort, nearly blank, or just random lines

Consider: color variety, unique details, expressiveness, composition, effort visible.
Do NOT give high scores for minimal or lazy drawings.

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

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
