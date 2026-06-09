type AnimationType = 'conquest' | 'secession';

interface AnimationState {
  type: AnimationType;
  remaining: number;
  total: number;
}

interface SeaVoyageAnimation {
  fromIndex: number;
  toIndex: number;
  succeeded: boolean;
  stateColor: string;
  remaining: number;  // ms
  total: number;      // 2000
}

export class AnimationController {
  private animations = new Map<number, AnimationState>();
  private seaVoyages = new Map<string, SeaVoyageAnimation>();

  markConquest(tileIndex: number): void {
    this.animations.set(tileIndex, { type: 'conquest', remaining: 600, total: 600 });
  }

  markSecession(tileIndex: number): void {
    this.animations.set(tileIndex, { type: 'secession', remaining: 800, total: 800 });
  }

  tick(deltaMs: number): void {
    for (const [idx, anim] of this.animations) {
      anim.remaining -= deltaMs;
      if (anim.remaining <= 0) this.animations.delete(idx);
    }
    for (const [key, v] of this.seaVoyages) {
      v.remaining -= deltaMs;
      if (v.remaining <= 0) this.seaVoyages.delete(key);
    }
  }

  markSeaVoyage(fromIndex: number, toIndex: number, succeeded: boolean, stateColor: string): void {
    const key = `${fromIndex}_${toIndex}`;
    this.seaVoyages.set(key, { fromIndex, toIndex, succeeded, stateColor, remaining: 2000, total: 2000 });
  }

  getActiveSeaVoyages(): ReadonlyArray<{ fromIndex: number; toIndex: number; succeeded: boolean; stateColor: string; opacity: number }> {
    const result: Array<{ fromIndex: number; toIndex: number; succeeded: boolean; stateColor: string; opacity: number }> = [];
    for (const v of this.seaVoyages.values()) {
      result.push({
        fromIndex: v.fromIndex,
        toIndex: v.toIndex,
        succeeded: v.succeeded,
        stateColor: v.stateColor,
        opacity: v.remaining / v.total,
      });
    }
    return result;
  }

  getFlashIntensity(tileIndex: number): number {
    const a = this.animations.get(tileIndex);
    if (!a) return 0;
    return a.remaining / a.total;
  }

  getFlashType(tileIndex: number): AnimationType | null {
    return this.animations.get(tileIndex)?.type ?? null;
  }

  getFlashingTiles(): ReadonlyMap<number, { type: AnimationType; intensity: number }> {
    const result = new Map<number, { type: AnimationType; intensity: number }>();
    for (const [idx, anim] of this.animations) {
      result.set(idx, { type: anim.type, intensity: anim.remaining / anim.total });
    }
    return result;
  }
}
