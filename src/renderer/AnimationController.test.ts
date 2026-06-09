import { describe, it, expect } from 'vitest';
import { AnimationController } from './AnimationController';

describe('AnimationController', () => {
  describe('getFlashIntensity', () => {
    it('should return 0 for an unmarked tile', () => {
      const controller = new AnimationController();
      expect(controller.getFlashIntensity(0)).toBe(0);
    });

    it('should return 1.0 immediately after markConquest', () => {
      const controller = new AnimationController();
      controller.markConquest(5);
      expect(controller.getFlashIntensity(5)).toBe(1.0);
    });

    it('should return 1.0 immediately after markSecession', () => {
      const controller = new AnimationController();
      controller.markSecession(3);
      expect(controller.getFlashIntensity(3)).toBe(1.0);
    });
  });

  describe('getFlashType', () => {
    it('should return null for an unmarked tile', () => {
      const controller = new AnimationController();
      expect(controller.getFlashType(0)).toBeNull();
    });

    it('should return "conquest" after markConquest', () => {
      const controller = new AnimationController();
      controller.markConquest(7);
      expect(controller.getFlashType(7)).toBe('conquest');
    });

    it('should return "secession" after markSecession', () => {
      const controller = new AnimationController();
      controller.markSecession(2);
      expect(controller.getFlashType(2)).toBe('secession');
    });
  });

  describe('markConquest', () => {
    it('should set flash intensity to 1.0 immediately after marking', () => {
      const controller = new AnimationController();
      controller.markConquest(10);
      expect(controller.getFlashIntensity(10)).toBe(1.0);
    });
  });

  describe('markSecession', () => {
    it('should set flash type to "secession" after marking', () => {
      const controller = new AnimationController();
      controller.markSecession(4);
      expect(controller.getFlashType(4)).toBe('secession');
    });

    it('should set flash intensity to 1.0 immediately after marking', () => {
      const controller = new AnimationController();
      controller.markSecession(4);
      expect(controller.getFlashIntensity(4)).toBe(1.0);
    });
  });

  describe('tick', () => {
    it('should reduce flash intensity over time for conquest', () => {
      const controller = new AnimationController();
      controller.markConquest(1);
      controller.tick(300); // halfway through 600ms
      expect(controller.getFlashIntensity(1)).toBeCloseTo(0.5);
    });

    it('should reduce flash intensity over time for secession', () => {
      const controller = new AnimationController();
      controller.markSecession(1);
      controller.tick(400); // halfway through 800ms
      expect(controller.getFlashIntensity(1)).toBeCloseTo(0.5);
    });

    it('should remove animation after conquest duration expires (600ms)', () => {
      const controller = new AnimationController();
      controller.markConquest(1);
      controller.tick(600);
      expect(controller.getFlashIntensity(1)).toBe(0);
      expect(controller.getFlashType(1)).toBeNull();
    });

    it('should remove animation after secession duration expires (800ms)', () => {
      const controller = new AnimationController();
      controller.markSecession(1);
      controller.tick(800);
      expect(controller.getFlashIntensity(1)).toBe(0);
      expect(controller.getFlashType(1)).toBeNull();
    });

    it('should remove animation when deltaMs exceeds remaining duration', () => {
      const controller = new AnimationController();
      controller.markConquest(1);
      controller.tick(1000); // well past 600ms
      expect(controller.getFlashIntensity(1)).toBe(0);
    });

    it('should not affect other tiles when ticking', () => {
      const controller = new AnimationController();
      controller.markConquest(1);
      controller.markConquest(2);
      controller.tick(300);
      expect(controller.getFlashIntensity(2)).toBeCloseTo(0.5);
    });
  });

  describe('re-marking a tile', () => {
    it('should reset the timer when markConquest is called again on the same tile', () => {
      const controller = new AnimationController();
      controller.markConquest(1);
      controller.tick(400); // 400ms elapsed, 200ms remaining
      controller.markConquest(1); // re-mark resets to 600ms
      expect(controller.getFlashIntensity(1)).toBe(1.0);
    });

    it('should change type from conquest to secession when re-marked', () => {
      const controller = new AnimationController();
      controller.markConquest(1);
      controller.markSecession(1);
      expect(controller.getFlashType(1)).toBe('secession');
      expect(controller.getFlashIntensity(1)).toBe(1.0);
    });
  });
});

describe('markSeaVoyage', () => {
  it('creates an active voyage with opacity 1.0 immediately', () => {
    const ac = new AnimationController();
    ac.markSeaVoyage(0, 5, true, '#ff0000');
    const voyages = ac.getActiveSeaVoyages();
    expect(voyages).toHaveLength(1);
    expect(voyages[0].opacity).toBeCloseTo(1.0);
    expect(voyages[0].fromIndex).toBe(0);
    expect(voyages[0].toIndex).toBe(5);
    expect(voyages[0].succeeded).toBe(true);
    expect(voyages[0].stateColor).toBe('#ff0000');
  });

  it('fades to 0 after 2000ms tick', () => {
    const ac = new AnimationController();
    ac.markSeaVoyage(0, 5, true, '#ff0000');
    ac.tick(2000);
    expect(ac.getActiveSeaVoyages()).toHaveLength(0);
  });

  it('overwriting same from/to pair resets timer', () => {
    const ac = new AnimationController();
    ac.markSeaVoyage(0, 5, true, '#ff0000');
    ac.tick(1500);
    ac.markSeaVoyage(0, 5, false, '#00ff00');
    const voyages = ac.getActiveSeaVoyages();
    expect(voyages).toHaveLength(1);
    expect(voyages[0].opacity).toBeCloseTo(1.0);
    expect(voyages[0].succeeded).toBe(false);
    expect(voyages[0].stateColor).toBe('#00ff00');
  });

  it('getActiveSeaVoyages returns empty when no voyages', () => {
    const ac = new AnimationController();
    expect(ac.getActiveSeaVoyages()).toHaveLength(0);
  });

  it('tick reduces voyage opacity proportionally', () => {
    const ac = new AnimationController();
    ac.markSeaVoyage(2, 7, false, '#aabbcc');
    ac.tick(1000);
    const voyages = ac.getActiveSeaVoyages();
    expect(voyages).toHaveLength(1);
    expect(voyages[0].opacity).toBeCloseTo(0.5, 1);
  });
});

describe('getFlashingTiles', () => {
  it('returns empty map when no animations active', () => {
    const c = new AnimationController();
    expect(c.getFlashingTiles().size).toBe(0);
  });
  it('returns conquest tile with intensity 1.0 immediately after mark', () => {
    const c = new AnimationController();
    c.markConquest(5);
    const ft = c.getFlashingTiles();
    expect(ft.get(5)?.type).toBe('conquest');
    expect(ft.get(5)?.intensity).toBe(1.0);
  });
  it('returns secession tile with correct type', () => {
    const c = new AnimationController();
    c.markSecession(7);
    expect(c.getFlashingTiles().get(7)?.type).toBe('secession');
  });
  it('intensity decreases after tick', () => {
    const c = new AnimationController();
    c.markConquest(1);
    c.tick(300);
    const intensity = c.getFlashingTiles().get(1)?.intensity ?? 0;
    expect(intensity).toBeCloseTo(0.5);
  });
  it('tile removed from map after full duration', () => {
    const c = new AnimationController();
    c.markConquest(2);
    c.tick(600);
    expect(c.getFlashingTiles().has(2)).toBe(false);
  });
});
