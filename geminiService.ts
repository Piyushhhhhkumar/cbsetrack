
import { GoogleGenAI } from "@google/genai";
import { Subject } from './types.ts';

// Defensive check for process.env
const getApiKey = () => {
  try {
    return process.env.API_KEY || '';
  } catch (e) {
    return '';
  }
};

const apiKey = getApiKey();
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({ apiKey });
} else {
  console.warn("Gemini API: No API_KEY found in process.env. AI features will be disabled.");
}

export const getCoachAdvice = async (subjects: Subject[], stats: any) => {
  if (!ai) {
    return "Keep pushing! Every small step counts towards your Board success. Focus on one chapter today!";
  }

  const model = 'gemini-3-flash-preview';
  
  const progressSummary = subjects.map(s => {
    const total = s.chapters.length;
    const mastered = s.chapters.filter(c => c.status === 'Mastered').length;
    const inProgress = s.chapters.filter(c => c.status === 'In Progress').length;
    return `${s.name}: ${mastered}/${total} Mastered, ${inProgress} In Progress`;
  }).join('\n');

  const prompt = `
    You are an AI study coach for a Class 10 CBSE student. 
    Current progress:
    ${progressSummary}
    User Stats: XP ${stats.xp}, Streak ${stats.streak}.

    Provide a short, motivating, and highly specific piece of advice for the student.
    Mention at least one subject they are doing well in or need to focus on based on the data.
    Keep the tone friendly, student-focused, and stress-free (Class 10 level).
    If they have low progress in hard subjects like Maths or Science, suggest a simple next step.
    Maximum 3 sentences.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        temperature: 0.7,
        topP: 0.95,
      }
    });
    return response.text;
  } catch (error) {
    console.error("Coach API Error:", error);
    return "Keep pushing! Every small step counts towards your Board success. Focus on one chapter today!";
  }
};
