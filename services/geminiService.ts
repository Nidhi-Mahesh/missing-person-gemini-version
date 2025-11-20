import { GoogleGenAI, Type } from "@google/genai";
import { Person } from "../types";

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
 * BATCH SCAN: Checks a crowd scene against MULTIPLE missing persons.
 */
export const scanCrowdForBatch = async (
  missingPeople: Person[],
  crowdSceneBase64: string
): Promise<{ found: boolean; personId?: string; confidence: number; explanation: string; box_2d?: [number, number, number, number] }> => {
  try {
    if (missingPeople.length === 0) {
        return { found: false, confidence: 0, explanation: "No active missing person records to check against." };
    }

    // 1. Construct the Prompt Parts
    // We start with the Crowd Scene
    const promptParts: any[] = [
        { text: "CRITICAL TASK: Analyze this Crowd Scene (Image 1) and check if ANY of the Reference Persons (Images below) are present." },
        { 
            inlineData: {
                mimeType: 'image/jpeg',
                data: cleanBase64(crowdSceneBase64)
            }
        },
        { text: "--- REFERENCE DATABASE BELOW ---" }
    ];

    // 2. Add each Missing Person as a Reference
    missingPeople.forEach((person, index) => {
        promptParts.push({
            text: `REFERENCE PERSON #${index + 1} (ID: ${person.id}):
            - Name: ${person.name}
            - Reported Clothing: "${person.lastSeenClothing}"
            - Biometrics: "${person.description}"
            - Reference Photo:`
        });
        promptParts.push({
            inlineData: {
                mimeType: 'image/jpeg',
                data: cleanBase64(person.imageUrl)
            }
        });
    });

    // 3. Add Final Instruction
    promptParts.push({
        text: `INSTRUCTIONS:
        1. Compare faces in the Crowd Scene against ALL Reference Photos.
        2. Also check if the person matches the "Reported Clothing" description provided for that ID.
        3. If a high-confidence match is found for ANY person, return their ID.
        
        Output JSON Schema:
        - "found": boolean
        - "personId": string (The ID of the matched person. Null if none found).
        - "confidence": number (0-100)
        - "explanation": string (Who was found and why?)
        - "box_2d": number[] (Bounding box [ymin, xmin, ymax, xmax] 0-1000 scale of the person in the Crowd Scene).
        `
    });

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: { parts: promptParts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                found: { type: Type.BOOLEAN },
                personId: { type: Type.STRING, nullable: true },
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
    console.error("Gemini Batch Scan Error:", error);
    return {
      found: false,
      confidence: 0,
      explanation: "Processing error or signal interruption.",
    };
  }
};
