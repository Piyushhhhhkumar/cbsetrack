
import { GoogleGenAI } from "@google/genai";
import { Subject } from './types';

// Always use named parameter for apiKey and obtain it from process.env.API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getCoachAdvice = async (subjects: Subject[], stats: any) => {
  const model = 'gemini-3-flash-preview';
  
  // Prepare a brief summary of progress
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
    // Use the correct generateContent parameters and access .text property
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
