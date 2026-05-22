const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

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
      console.error('[classify] env.AI is undefined - add Workers AI binding to Pages project');
      return jsonResponse({
        type: creatureType,
        similarity: 0,
        isMatch: false,
        creativity: 0,
        feedback: '',
        suggestedType: creatureType,
        aiUnavailable: true,
        errorCode: 'AI_BINDING_MISSING',
      });
    }

    console.info('[classify] env.AI available, calling vision model');
    const result = await classifyWithAI(env, imageBuffer, creatureType);

    return jsonResponse({
      type: creatureType,
      similarity: result.similarity,
      isMatch: result.similarity >= 0.6,
      creativity: result.creativity,
      feedback: result.feedback,
      suggestedType: result.suggestedType,
    });
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

const AI_MODEL = '@cf/llava-hf/llava-1.5-7b-hf';

let licenseAgreed = false;

async function ensureLicenseAccepted(env) {
  if (licenseAgreed) return;
  licenseAgreed = true;
}

async function classifyWithAI(env, imageBuffer, expectedType) {
  try {
    const imageArray = [...new Uint8Array(imageBuffer)];
    const response = await env.AI.run(AI_MODEL, {
      image: imageArray,
      prompt: buildPrompt(expectedType),
      max_tokens: 220,
    });

    const text = response.description || response.response || '';
    return parseAIResponse(text, expectedType);
  } catch (error) {
    console.error('AI classification error:', error);
    const fb = fallbackClassification(expectedType);
    return { ...fb, feedback: '[AI error: ' + error.message + '] ' + fb.feedback };
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

  return `You are analyzing a CHILD'S HAND-DRAWN SKETCH on a white background. This is a casual drawing game - the drawings are simple, rough, and cartoon-like. Do NOT compare to realistic or detailed art.

The user was asked to draw: ${description}

SCORING GUIDE (consider this is a SIMPLE SKETCH game):
- Even a crude outline with the right shape counts! Be encouraging.
- Recognizable shape + at least 1 feature (eye, fin, tail, tentacle, etc): similarity 0.6-0.85
- Basic shape that clearly resembles the creature: similarity 0.4-0.6
- Vague shape that could be the creature: similarity 0.25-0.4
- Random scribbles, not the creature: similarity 0.0-0.25
- Give helpful, encouraging feedback about what to add next
- Remember: this is a FUN drawing game, not an art competition

Also identify if it more closely resembles a different sea creature.

Also score CREATIVITY 0-100 for this sketch (strict: minimal scribbles = low).

Respond ONLY in this exact JSON format with no other text before or after:
{"similarity": 0.65, "creativity": 55, "bestMatch": "fish", "feedback": "I can see the fish shape! Try adding an eye and some fins to make it even better."}`;
}

function parseAIResponse(text, expectedType) {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        similarity: Math.min(1, Math.max(0, parsed.similarity || 0)),
        creativity: Math.min(100, Math.max(0, parsed.creativity ?? 50)),
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
    creativity: 0,
    feedback: 'AI error. Please try again.',
    suggestedType: expectedType,
  };
}
