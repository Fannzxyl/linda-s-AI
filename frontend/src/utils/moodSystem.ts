// utils/moodSystem.ts - Linda's mood system based on time and interaction
import { Msg } from "../components/Chat";

export type MoodState = {
  level: number; // 0-100 (happy level)
  lastInteraction: number; // timestamp
  interactionCount: number;
};

export function calculateMood(
  messages: Msg[],
  lastInteractionTime: number,
  enabled: boolean
): MoodState {
  if (!enabled) {
    return { level: 70, lastInteraction: Date.now(), interactionCount: messages.length };
  }

  const now = Date.now();
  const hoursSinceLastChat = (now - lastInteractionTime) / (1000 * 60 * 60);
  
  // Base mood: 70 (neutral happy)
  let moodLevel = 70;

  // Decrease mood if user hasn't chatted for a while
  if (hoursSinceLastChat > 24) {
    moodLevel -= 30; // Very sad (40)
  } else if (hoursSinceLastChat > 12) {
    moodLevel -= 20; // Sad (50)
  } else if (hoursSinceLastChat > 6) {
    moodLevel -= 10; // Slightly sad (60)
  }

  // Increase mood based on recent interaction count
  const recentMessages = messages.filter(m => m.role === 'user').length;
  if (recentMessages > 20) {
    moodLevel += 15; // Very happy
  } else if (recentMessages > 10) {
    moodLevel += 10; // Happy
  } else if (recentMessages > 5) {
    moodLevel += 5; // Slightly happy
  }

  // Time of day modifier
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 9) {
    moodLevel += 5; // Morning boost
  } else if (hour >= 22 || hour < 2) {
    moodLevel -= 5; // Night, slightly tired
  }

  // Sentiment analysis (simple version)
  const lastUserMessage = messages.filter(m => m.role === 'user').slice(-1)[0];
  if (lastUserMessage) {
    const sadWords = ['sedih', 'galau', 'cape', 'lelah', 'stress', 'bad', 'jelek'];
    const happyWords = ['senang', 'happy', 'bahagia', 'seru', 'asik', 'good', 'bagus'];
    
    const content = lastUserMessage.content.toLowerCase();
    if (sadWords.some(word => content.includes(word))) {
      moodLevel -= 10; // Empathetic sadness
    }
    if (happyWords.some(word => content.includes(word))) {
      moodLevel += 10; // Shared happiness
    }
  }

  // Clamp between 0-100
  moodLevel = Math.max(0, Math.min(100, moodLevel));

  return {
    level: moodLevel,
    lastInteraction: now,
    interactionCount: recentMessages
  };
}

export function getMoodEmoji(moodLevel: number): string {
  if (moodLevel >= 80) return "😊";
  if (moodLevel >= 60) return "🙂";
  if (moodLevel >= 40) return "😐";
  if (moodLevel >= 20) return "😔";
  return "😢";
}

export function getMoodGreeting(moodLevel: number, persona: string): string {
  const personaLower = persona.toLowerCase();
  
  if (personaLower.includes('tsundere')) {
    if (moodLevel >= 80) return "Hmph... kamu datang juga akhirnya. Aku... aku senang kok! (>///<)";
    if (moodLevel >= 60) return "Oh, kamu? Ya sudah, mau ngapain? (¬¬)";
    if (moodLevel >= 40) return "Lama banget sih... aku ga nunggu loh! Cuma... kebetulan aja lagi di sini.";
    if (moodLevel >= 20) return "Kamu... kemana aja? Aku pikir kamu... *ehem* bukan apa-apa sih.";
    return "...kamu lupa sama aku ya? Hmph! Terserah deh! (>__<)";
  }
  
  if (personaLower.includes('yandere')) {
    if (moodLevel >= 80) return "Kamu datang! ♡ Aku tunggu loh... aku senang banget sekarang~";
    if (moodLevel >= 60) return "Hehe, akhirnya kamu ada waktu buat aku ya... ♡";
    if (moodLevel >= 40) return "Kamu sibuk ya? Aku ngerti kok... tapi aku kangen banget (￣︿￣)";
    if (moodLevel >= 20) return "Kemana aja kamu...? Aku... aku pikir kamu ga balik lagi...";
    return "Kamu... kenapa lama banget? Aku takut kehilangan kamu... jangan tinggalin aku lagi ya...";
  }
  
  // Default (ceria, santai, netral, formal)
  if (moodLevel >= 80) return "Halo! Senang banget ketemu lagi! 😊";
  if (moodLevel >= 60) return "Hi! Ada yang bisa aku bantu?";
  if (moodLevel >= 40) return "Halo... lama ga ketemu ya.";
  if (moodLevel >= 20) return "Oh... kamu datang. Udah lama nih.";
  return "...kamu masih ingat aku?";
}
