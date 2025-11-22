export type SoundKey = 'dialup' | 'youve_got_mail' | 'new_im' | 'welcome' | 'goodbye' | 'buddy_in' | 'buddy_out' | 'im';

export class SoundService {
  private static sounds: Partial<Record<SoundKey, HTMLAudioElement>> = {};
  private static initialized = false;
  private static playedThisSession: Set<SoundKey> = new Set();

  static init() {
    if (this.initialized) return;
    
    // Map available audio files (served from public/audio)
    const soundMap: Record<SoundKey, string> = {
      dialup: '/audio/dialup.mp3',
      youve_got_mail: '/audio/You\'ve Got Mail.mp3',
      new_im: '/audio/IM.mp3',
      welcome: '/audio/Welcome.mp3',
      goodbye: '/audio/Goodbye.mp3',
      buddy_in: '/audio/BuddyIn.mp3',
      buddy_out: '/audio/BuddyOut.mp3',
      im: '/audio/IM.mp3',
    };

    // Create audio elements (will fail gracefully if files don't exist)
    Object.entries(soundMap).forEach(([key, path]) => {
      try {
        const audio = new Audio(path);
        audio.preload = 'auto';
        this.sounds[key as SoundKey] = audio;
      } catch (error) {
        console.warn(`Failed to load sound: ${key}`, error);
      }
    });

    this.initialized = true;
  }

  static play(key: SoundKey, forceReplay = false) {
    if (!this.initialized) {
      this.init();
    }

    const audio = this.sounds[key];
    if (!audio) {
      console.warn(`Sound not found: ${key}`);
      return;
    }

    // For certain sounds, don't replay in same session unless forced
    if (!forceReplay && this.playedThisSession.has(key)) {
      return;
    }

    try {
      audio.currentTime = 0;
      audio.play().catch((error) => {
        // Ignore autoplay errors; user interaction may be required
        console.debug(`Could not play sound ${key}:`, error);
      });
      this.playedThisSession.add(key);
    } catch (error) {
      console.warn(`Error playing sound ${key}:`, error);
    }
  }

  static resetSession() {
    this.playedThisSession.clear();
  }

  // Get the audio element for a sound (for listening to events)
  static getAudio(key: SoundKey): HTMLAudioElement | undefined {
    if (!this.initialized) {
      this.init();
    }
    return this.sounds[key];
  }

  // Play a sound and return a promise that resolves when it finishes
  static playAndWait(key: SoundKey, forceReplay = false): Promise<void> {
    return new Promise((resolve) => {
      if (!this.initialized) {
        this.init();
      }

      const audio = this.sounds[key];
      if (!audio) {
        console.warn(`Sound not found: ${key}`);
        resolve();
        return;
      }

      // For certain sounds, don't replay in same session unless forced
      if (!forceReplay && this.playedThisSession.has(key)) {
        resolve();
        return;
      }

      try {
        audio.currentTime = 0;
        
        // Listen for when the sound finishes
        const onEnded = () => {
          audio.removeEventListener('ended', onEnded);
          resolve();
        };
        audio.addEventListener('ended', onEnded);
        
        audio.play().catch((error) => {
          // Ignore autoplay errors; user interaction may be required
          console.debug(`Could not play sound ${key}:`, error);
          audio.removeEventListener('ended', onEnded);
          resolve(); // Resolve anyway so we don't hang
        });
        this.playedThisSession.add(key);
      } catch (error) {
        console.warn(`Error playing sound ${key}:`, error);
        resolve();
      }
    });
  }
}

