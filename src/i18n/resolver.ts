import { en } from './en';
import { sa } from './sa';
import { hi } from './hi';
import type { PanchangTranslations } from './types';
import type { Language } from '../types/options';

const TRANSLATIONS: Record<Language, PanchangTranslations> = { en, sa, hi };

export function getTranslations(lang: Language): PanchangTranslations {
  return TRANSLATIONS[lang] ?? en;
}

export function resolveTithiName(index: number, lang: Language): string {
  const t = getTranslations(lang);
  if (index === 14) return t.misc.purnima;
  if (index === 29) return t.misc.amavasya;
  const paksha = index < 15 ? t.pakshaNames.shukla : t.pakshaNames.krishna;
  const nameIndex = index < 15 ? index : index - 15;
  return `${paksha} ${t.tithiNames[nameIndex]!}`;
}

export function resolveNakshatraName(index: number, lang: Language): string {
  return getTranslations(lang).nakshatraNames[index]!;
}

export function resolveYogaName(index: number, lang: Language): string {
  return getTranslations(lang).yogaNames[index]!;
}

export function resolveKaranaName(index: number, lang: Language): string {
  const t = getTranslations(lang);
  if (index === 0) return t.karanaNames.fixed[0]!; // Kimstughna
  if (index >= 57) return t.karanaNames.fixed[index - 56]!; // Shakuni=1, Chatushpada=2, Naga=3
  return t.karanaNames.movable[(index - 1) % 7]!;
}

export function resolveMasaName(index: number, lang: Language): string {
  return getTranslations(lang).masaNames[index]!;
}

export function resolveChandraMasaName(index: number, lang: Language, adhika = false): string {
  const t = getTranslations(lang);
  const name = t.chandraMasaNames[index]!;
  return adhika ? `${t.misc.adhika} ${name}` : name;
}
