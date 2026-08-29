import { describe, it, expect } from 'vitest';
import { en } from '../../src/i18n/en';
import { hi } from '../../src/i18n/hi';
import {
  getTranslations,
  resolveTithiName,
  resolvePakshaName,
  resolveNakshatraName,
  resolveYogaName,
  resolveKaranaName,
  resolveMasaName,
  resolveChandraMasaName,
} from '../../src/i18n/resolver';

const languages = [
  { code: 'en' as const, pack: en, label: 'English' },
  { code: 'hi' as const, pack: hi, label: 'Hindi' },
];

describe('i18n translation completeness', () => {
  for (const { pack, label } of languages) {
    describe(label, () => {
      it('has 14 tithi names (per paksha)', () => {
        expect(pack.tithiNames).toHaveLength(14);
      });

      it('has 27 nakshatra names', () => {
        expect(pack.nakshatraNames).toHaveLength(27);
      });

      it('has 27 yoga names', () => {
        expect(pack.yogaNames).toHaveLength(27);
      });

      it('has 7 movable karana names', () => {
        expect(pack.karanaNames.movable).toHaveLength(7);
      });

      it('has 4 fixed karana names', () => {
        expect(pack.karanaNames.fixed).toHaveLength(4);
      });

      it('has 7 vara names', () => {
        expect(pack.varaNames).toHaveLength(7);
      });

      it('has 12 masa names', () => {
        expect(pack.masaNames).toHaveLength(12);
      });

      it('has 12 chandra masa names', () => {
        expect(pack.chandraMasaNames).toHaveLength(12);
      });

      it('has 7 choghadiya names', () => {
        expect(pack.choghadiyaNames).toHaveLength(7);
      });

      it('has 8 gowri names', () => {
        expect(pack.gowriNames).toHaveLength(8);
      });

      it('has 30 do ghati names', () => {
        expect(pack.doGhatiNames).toHaveLength(30);
        for (const name of pack.doGhatiNames) {
          expect(name.length).toBeGreaterThan(0);
        }
      });

      it('has 7 graha names (Chaldean order)', () => {
        expect(pack.grahaNames).toHaveLength(7);
      });

      it('has 10 special yoga names', () => {
        expect(Object.keys(pack.specialYogaNames)).toHaveLength(10);
      });

      it('has all major festival names', () => {
        const festivalCount = Object.keys(pack.festivalNames).length;
        expect(festivalCount).toBeGreaterThanOrEqual(23);
      });

      it('has every festival name non-empty', () => {
        for (const v of Object.values(pack.festivalNames)) {
          expect(v.length).toBeGreaterThan(0);
        }
      });

      it('no translation is empty string', () => {
        for (const name of pack.tithiNames) expect(name.length).toBeGreaterThan(0);
        for (const name of pack.nakshatraNames) expect(name.length).toBeGreaterThan(0);
        for (const name of pack.yogaNames) expect(name.length).toBeGreaterThan(0);
        for (const name of pack.karanaNames.movable) expect(name.length).toBeGreaterThan(0);
        for (const name of pack.karanaNames.fixed) expect(name.length).toBeGreaterThan(0);
      });
    });
  }
});

describe('i18n parity across language packs', () => {
  it('en and hi have identical festivalNames key sets', () => {
    const enKeys = Object.keys(en.festivalNames).sort();
    const hiKeys = Object.keys(hi.festivalNames).sort();
    expect(hiKeys).toEqual(enKeys);
  });
});

describe('getTranslations', () => {
  it('returns English for "en"', () => {
    expect(getTranslations('en')).toBe(en);
  });

  it('returns Hindi for "hi"', () => {
    expect(getTranslations('hi')).toBe(hi);
  });
});

describe('resolveTithiName', () => {
  for (const { code, label } of languages) {
    it(`${label}: resolves all 30 tithi names`, () => {
      for (let i = 0; i < 30; i++) {
        const name = resolveTithiName(i, code);
        expect(name.length).toBeGreaterThan(0);
      }
    });
  }

  it('Shukla Pratipada (index 0) in English', () => {
    expect(resolveTithiName(0, 'en')).toContain('Pratipada');
  });

  it('Purnima (index 14) in English', () => {
    const name = resolveTithiName(14, 'en');
    expect(name).toContain('Purnima');
  });

  it('Amavasya (index 29) in English', () => {
    const name = resolveTithiName(29, 'en');
    expect(name).toContain('Amavasya');
  });
});

describe('resolveNakshatraName', () => {
  for (const { code, label } of languages) {
    it(`${label}: resolves all 27 nakshatra names`, () => {
      for (let i = 0; i < 27; i++) {
        const name = resolveNakshatraName(i, code);
        expect(name.length).toBeGreaterThan(0);
      }
    });
  }

  it('Ashwini (index 0) in English', () => {
    expect(resolveNakshatraName(0, 'en')).toBe('Ashwini');
  });

  it('Revati (index 26) in English', () => {
    expect(resolveNakshatraName(26, 'en')).toBe('Revati');
  });
});

describe('resolveYogaName', () => {
  for (const { code, label } of languages) {
    it(`${label}: resolves all 27 yoga names`, () => {
      for (let i = 0; i < 27; i++) {
        const name = resolveYogaName(i, code);
        expect(name.length).toBeGreaterThan(0);
      }
    });
  }
});

describe('resolveKaranaName', () => {
  for (const { code, label } of languages) {
    it(`${label}: resolves all 60 karana names`, () => {
      for (let i = 0; i < 60; i++) {
        const name = resolveKaranaName(i, code);
        expect(name.length).toBeGreaterThan(0);
      }
    });
  }

  it('Kimstughna (index 0) in English', () => {
    expect(resolveKaranaName(0, 'en')).toBe('Kimstughna');
  });

  it('Bava (index 1) in English', () => {
    expect(resolveKaranaName(1, 'en')).toBe('Bava');
  });
});

describe('resolvePakshaName', () => {
  it('Shukla paksha (index < 15) in English', () => {
    expect(resolvePakshaName(0, 'en')).toBe('Shukla');
  });

  it('Krishna paksha (index >= 15) in English', () => {
    expect(resolvePakshaName(15, 'en')).toBe('Krishna');
  });

  it('Krishna paksha in Hindi', () => {
    expect(resolvePakshaName(15, 'hi')).toBe('कृष्ण');
  });
});

describe('resolveMasaName', () => {
  for (const { code, label } of languages) {
    it(`${label}: resolves all 12 masa names`, () => {
      for (let i = 0; i < 12; i++) {
        const name = resolveMasaName(i, code);
        expect(name.length).toBeGreaterThan(0);
      }
    });
  }
});

describe('resolveChandraMasaName', () => {
  for (const { code, label } of languages) {
    it(`${label}: resolves all 12 chandra masa names`, () => {
      for (let i = 0; i < 12; i++) {
        const name = resolveChandraMasaName(i, code, false);
        expect(name.length).toBeGreaterThan(0);
      }
    });
  }
});
