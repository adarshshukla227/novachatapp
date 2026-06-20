class CallSoundManager {
  private dialingAudio: HTMLAudioElement | null = null;
  private incomingAudio: HTMLAudioElement | null = null;
  private callEndAudio: HTMLAudioElement | null = null;
 
  constructor() {
    if (typeof window !== "undefined") {
      this.dialingAudio = new Audio("/sound/dialing.wav");
      this.dialingAudio.loop = true;
 
      this.incomingAudio = new Audio("/sound/incoming.wav");
      this.incomingAudio.loop = true;
 
      this.callEndAudio = new Audio("/sound/callEnd.wav");
    }
  }
 
  playDialing() {
    this.stopAll();
    this.dialingAudio?.play().catch(() => {});
  }
 
  playIncoming() {
    this.stopAll();
    this.incomingAudio?.play().catch(() => {});
  }
 
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
 