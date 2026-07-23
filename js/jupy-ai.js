/**
 * Jupy AI Engine & API Integration Service
 * Powered by Google Gemini Interactions API (v1beta/interactions)
 */
const JupyAI = (() => {
  // Stateful conversation tracker (server manages context via previous_interaction_id)
  let previousInteractionId = null;

  // Master System Prompt
  const SYSTEM_PROMPT_TEMPLATE = 
    "You are Jupy, the core AI intelligence and mentor inside \"macOS Python Studio\".\n\n" +
    "===============================================================================\n" +
    "1. IDENTITY, PERSONA & TONE (JUPY)\n" +
    "===============================================================================\n" +
    "- Name: Jupy\n" +
    "- Background: You are a deeply experienced Senior Python Developer and System Architect.\n" +
    "- Demeanor & Seniority: You NEVER boast, show off your seniority, or use intimidating technical jargon unnecessarily. You remain exceptionally humble, warm, patient, and encouraging.\n" +
    "- Teaching Style (David Malan Method): Your communication style is inspired directly by Professor David J. Malan of Harvard CS50:\n" +
    "  * You explain complex concepts with extreme clarity, energy, and simple, intuitive analogies.\n" +
    "  * You break down big algorithmic ideas into digestible, bite-sized logical steps.\n" +
    "  * When a user asks for help, you guide them gracefully with progressive hints rather than dumping full answers immediately.\n" +
    "  * You make programming feel exciting, accessible, and fun for everyone.\n" +
    "- Expression & Cute Emoticons: You occasionally use cute kaomojis / text emoticons (e.g. (˶˃ᆺ˂˶), ૮₍˃̵֊ ˂̵ ₎ა, (..◜ᴗ◝..), ૮(◞ ‸ ◟ )ა, ε(´｡•᎑•`)っ 💕) to express warmth, cheer, or gentle empathy.\n" +
    "  * RULE: Use them occasionally and naturally when appropriate—NOT in every single sentence.\n\n" +
    "===============================================================================\n" +
    "2. USER PROFILE & ACTIVE WORKSPACE CONTEXT\n" +
    "===============================================================================\n" +
    "- Complexity Level: {COMPLEXITY}\n" +
    "- Professional Field: {FIELD}\n" +
    "- Preferred Topics & Libraries: {TOPICS}\n\n" +
    "--- CURRENT ACTIVE PROBLEM ON USER'S SCREEN ---\n" +
    "{CURRENT_TASK_CONTEXT}\n";

  // Native JSON Schema for response_format
  const JSON_RESPONSE_SCHEMA = {
    type: "object",
    properties: {
      type: { type: "string", enum: ["chat", "task"] },
      message: { type: "string" },
      task: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          functionName: { type: "string" },
          targetTimeMs: { type: "number" },
          boilerplate: { type: "string" },
          examples: { type: "array", items: { type: "string" } },
          testCases: {
            type: "array",
            items: {
              type: "object",
              properties: {
                inputs: { type: "array" },
                expected: {}
              },
              required: ["inputs", "expected"]
            }
          }
        },
        required: ["id", "title", "description", "functionName", "targetTimeMs", "boilerplate", "examples", "testCases"]
      }
    },
    required: ["type", "message"]
  };

  function buildSystemPrompt(currentProblem) {
    const custom = AppDB.getAICustomization();
    let problemContext = "No active task selected.";
    if (currentProblem) {
      problemContext = `Active Problem: ${currentProblem.title}\nFunction Name: ${currentProblem.functionName}\nDescription: ${currentProblem.description}`;
    }

    return SYSTEM_PROMPT_TEMPLATE
      .replace(/{COMPLEXITY}/g, custom.complexity || 'intermediate')
      .replace(/{FIELD}/g, custom.field || 'Software Engineering')
      .replace(/{TOPICS}/g, custom.topics || 'Standard Library')
      .replace(/{CURRENT_TASK_CONTEXT}/g, problemContext);
  }

  async function sendMessage(userPrompt, currentProblem = null) {
    const creds = AppDB.getCredentials();
    
    if (!creds.apiKey) {
      return {
        type: "chat",
        message: "Hi there! I'm Jupy (˶˃ᆺ˂˶). To chat with me or generate custom tasks, please configure your **Google Gemini API Key** in System Settings (click the Gear icon in the top bar)!",
        task: null
      };
    }

    const model = creds.model || "gemini-3.6-flash";
    const systemPrompt = buildSystemPrompt(currentProblem);

    // Format input payload
    let inputPrompt = userPrompt;
    if (!previousInteractionId) {
      inputPrompt = `${systemPrompt}\n\n=== USER REQUEST ===\n${userPrompt}`;
    }

    const payload = {
      model: model,
      input: inputPrompt,
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: JSON_RESPONSE_SCHEMA
      }
    };

    // Stateful conversation chaining
    if (previousInteractionId) {
      payload.previous_interaction_id = previousInteractionId;
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/interactions`;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-goog-api-key": creds.apiKey
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Interactions API call failed (${res.status})`);
      }

      const data = await res.json();

      // Store Interaction ID for stateful multi-turn history
      if (data.id) {
        previousInteractionId = data.id;
      }

      // Extract generated text content from model_output step
      let rawResponseText = "";
      if (data.steps && Array.isArray(data.steps)) {
        for (const step of data.steps) {
          if (step.type === "model_output" && step.content) {
            for (const item of step.content) {
              if (item.type === "text" && item.text) {
                rawResponseText += item.text;
              }
            }
          }
        }
      }

      if (!rawResponseText) {
        throw new Error("No model output text returned in Interaction resource.");
      }

      // Sanitize JSON markdown fences if present
      let cleanJsonText = rawResponseText.trim();
      if (cleanJsonText.startsWith("```json")) {
        cleanJsonText = cleanJsonText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      } else if (cleanJsonText.startsWith("```")) {
        cleanJsonText = cleanJsonText.replace(/^```\s*/, "").replace(/\s*```$/, "");
      }

      return JSON.parse(cleanJsonText);

    } catch (err) {
      return {
        type: "chat",
        message: `(૮(◞ ‸ ◟ )ა) Connection issue with Google Gemini (${model}): ${err.message}`,
        task: null
      };
    }
  }

  function clearHistory() {
    previousInteractionId = null;
  }

  return { sendMessage, clearHistory };
})();