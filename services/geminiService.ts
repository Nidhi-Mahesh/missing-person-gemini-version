import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const MODEL_NAME = 'gemini-2.5-flash';

// Helper to clean base64 string
const cleanBase64 = (b64: string) => b64.replace(/^data:image\/\w+;base64,/, "");

/**
 * Generates a description of a person based on their image.
 * IMPORTANT: Specifically ignores clothing to prevent bias from old photos.
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
            text: "Analyze the physical biometric features of this person for a missing person report. Describe ONLY: Hair color/style, eye color, facial structure, distinct facial marks, and physical build. DO NOT describe their clothing, as the photo may be old. Keep it under 40 words."
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
 * Enhanced to use the reported clothing description instead of the photo's clothes.
 */
export const scanCrowdForMatch = async (
  targetPersonBase64: string,
  crowdSceneBase64: string,
  reportedClothing: string
): Promise<{ found: boolean; confidence: number; explanation: string; box_2d?: [number, number, number, number] }> => {
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
            text: `Perform Forensic Person Re-Identification.
            
            TARGET DEFINITION:
            1. FACE/BIOMETRICS: Use the person in Image 1.
            2. ATTIRE: The person is reported to be wearing: "${reportedClothing}".
            
            SEARCH TASK (Image 2):
            Scan Image 2 for a person matching the FACE from Image 1 AND the ATTIRE described above. 
            
            CRITICAL: 
            - Ignore the clothes shown in Image 1. Only use Image 1 for facial features.
            - Match against the "${reportedClothing}" description for the body.
            
            Output JSON:
            - "found": boolean (true if confidence > 75%)
            - "confidence": number (0-100)
            - "explanation": string (Explain the match based on Face + Reported Clothing).
            - "box_2d": number[] (Bounding box [ymin, xmin, ymax, xmax] 0-1000 scale. Null if not found).
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
                explanation: { type: Type.STRING },
                box_2d: { 
                  type: Type.ARRAY, 
                  items: { type: Type.NUMBER },
                  description: "Bounding box [ymin, xmin, ymax, xmax] on 0-1000 scale",
                  nullable: true
                }
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
      explanation: "Signal interference. Unable to process biometric data.",
    };
  }
};
