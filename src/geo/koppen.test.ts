import { describe, it, expect } from 'vitest';
import { koppenToBiome, KOPPEN_OCEAN_CODE } from './koppen';
import type { TerrainType } from '../types/world';

/** All 30 legend codes from public/geodata/koppen_legend.txt. */
const LEGEND_CODES = Array.from({ length: 30 }, (_, i) => i + 1);

const VALID_BIOMES: ReadonlySet<TerrainType> = new Set<TerrainType>([
  'plains',
  'river_valley',
  'forest',
  'hills',
  'mountains',
  'desert',
  'tundra',
]);

describe('koppenToBiome', () => {
  it('should map every legend code to a valid non-ocean biome', () => {
    for (const code of LEGEND_CODES) {
      const biome = koppenToBiome(code);
      expect(VALID_BIOMES.has(biome)).toBe(true);
      expect(biome).not.toBe('ocean');
    }
  });

  it.each([
    [1, 'forest'], // Af tropical rainforest
    [3, 'forest'], // Aw tropical savannah
    [4, 'desert'], // BWh arid desert hot
    [6, 'plains'], // BSh semi-arid steppe hot → plains
    [8, 'plains'], // Csa Mediterranean
    [10, 'plains'], // Csc Mediterranean
    [14, 'forest'], // Cfa temperate no dry season
    [25, 'forest'], // Dfa cold no dry season hot summer
    [27, 'tundra'], // Dfc cold subarctic sparse
    [28, 'tundra'], // Dfd cold subarctic very cold
    [24, 'tundra'], // Dwd cold subarctic very cold
    [29, 'tundra'], // ET polar tundra
    [30, 'tundra'], // EF polar frost
  ] as Array<[number, TerrainType]>)(
    'should map Köppen code %i to %s',
    (code, expected) => {
      expect(koppenToBiome(code)).toBe(expected);
    },
  );

  it('should fall back to a neutral plains for the ocean/no-data code', () => {
    expect(koppenToBiome(KOPPEN_OCEAN_CODE)).toBe('plains');
  });

  it('should fall back to plains for out-of-range codes', () => {
    expect(koppenToBiome(999)).toBe('plains');
    expect(koppenToBiome(-1)).toBe('plains');
  });

  // Full contract: the exact terrain every legend code (1..30) must map to.
  // tropical/humid-temperate → forest; BWh/BWk → desert; BSh/BSk (steppe) → plains;
  // Cs* (Mediterranean) → plains; E-group + sparse subarctic (Dfc/Dfd/Dwd) → tundra.
  const EXPECTED: Record<number, TerrainType> = {
    1: 'forest', 2: 'forest', 3: 'forest', // A tropical
    4: 'desert', 5: 'desert', 6: 'plains', 7: 'plains', // B arid/steppe
    8: 'plains', 9: 'plains', 10: 'plains', // Cs Mediterranean
    11: 'forest', 12: 'forest', 13: 'forest', // Cw
    14: 'forest', 15: 'forest', 16: 'forest', // Cf
    17: 'forest', 18: 'forest', 19: 'forest', 20: 'forest', // Ds
    21: 'forest', 22: 'forest', 23: 'forest', // Dwa/b/c
    24: 'tundra', // Dwd sparse subarctic
    25: 'forest', 26: 'forest', // Dfa/b
    27: 'tundra', 28: 'tundra', // Dfc/Dfd sparse subarctic
    29: 'tundra', 30: 'tundra', // E polar
  };

  it('should map every legend code to its documented biome group', () => {
    for (const code of LEGEND_CODES) {
      const biome = koppenToBiome(code);
      expect(biome).not.toBe('ocean');
      expect(biome).not.toBeUndefined();
      expect(biome).toBe(EXPECTED[code]);
    }
  });
});
