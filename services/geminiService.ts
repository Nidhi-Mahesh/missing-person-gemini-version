import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const MODEL_NAME = 'gemini-2.5-flash';

// Helper to clean base64 string
const cleanBase64 = (b64: string) => b64.replace(/^data:image\/\w+;base64,/, "");

/**
 * Generates a description of a person based on their image.
 */
export const analyzePersonImage = async (base64Image: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanBase64(base64Image)
            }
          },
          {
            text: "Describe the physical appearance of the person in this image for a missing person report. Focus on distinct features like hair color, clothing, age approximation, and glasses/accessories. Keep it under 50 words."
          }
        ]
      }
    });
    return response.text || "No description generated.";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "Could not analyze image. Please enter details manually.";
  }
};

/**
 * Compares a missing person's photo with a crowd frame/image.
 */
export const scanCrowdForMatch = async (
  targetPersonBase64: string,
  crowdSceneBase64: string
): Promise<{ found: boolean; confidence: number; explanation: string }> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanBase64(targetPersonBase64)
            }
          },
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanBase64(crowdSceneBase64)
            }
          },
          {
            text: `You are a forensic search AI. 
            Image 1 is the TARGET missing person. 
            Image 2 is a CROWD SCENE or surveillance frame.
            
            Task: Determine if the person in Image 1 is present in Image 2.
            
            Return a JSON object with:
            - "found": boolean
            - "confidence": number (0 to 100)
            - "explanation": string (Brief reasoning).
            `
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                found: { type: Type.BOOLEAN },
                confidence: { type: Type.NUMBER },
                explanation: { type: Type.STRING }
            },
            required: ["found", "confidence", "explanation"]
        }
      }
    });

    const resultText = response.text;
    if (!resultText) throw new Error("Empty response from AI");

    const result = JSON.parse(resultText);
    return result;

  } catch (error) {
    console.error("Gemini Scan Error:", error);
    return {
      found: false,
      confidence: 0,
      explanation: "Error processing the scan request. Please try a clearer image."
    };
  }
};