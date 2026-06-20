class CallSoundManager {
  private dialingAudio: HTMLAudioElement | null = null;
  private incomingAudio: HTMLAudioElement | null = null;
  private callEndAudio: HTMLAudioElement | null = null;
 
  constructor() {
    if (typeof window !== "undefined") {
      this.dialingAudio = new Audio("/sound/dialing.mp3");
      this.dialingAudio.loop = true;
 
      this.incomingAudio = new Audio("/sound/incoming.mp3");
      this.incomingAudio.loop = true;
 
      this.callEndAudio = new Audio("/sound/callEnd.mp3");
    }
  }
 
  // Jab tum call karo (caller side)
  playDialing() {
    this.stopAll();
    this.dialingAudio?.play().catch(() => {});
  }
 
  // Jab tumhe call aaye (receiver side)
  playIncoming() {
    this.stopAll();
    this.incomingAudio?.play().catch(() => {});
  }
 
  // Jab call cut ho (dono side)
  playCallEnd() {
    this.stopAll();
    this.callEndAudio?.play().catch(() => {});
  }
 
  stopAll() {
    [this.dialingAudio, this.incomingAudio, this.callEndAudio].forEach((audio) => {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    });
  }
}
 
export const callSounds = new CallSoundManager();
 