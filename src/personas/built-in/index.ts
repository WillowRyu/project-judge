export { MELCHIOR_GUIDELINE, MELCHIOR_META } from "./melchior";
export { BALTHASAR_GUIDELINE, BALTHASAR_META } from "./balthasar";
export { CASPER_GUIDELINE, CASPER_META } from "./casper";

import { MELCHIOR_GUIDELINE, MELCHIOR_META } from "./melchior";
import { BALTHASAR_GUIDELINE, BALTHASAR_META } from "./balthasar";
import { CASPER_GUIDELINE, CASPER_META } from "./casper";

export const BUILT_IN_PERSONAS = {
  melchior: {
    ...MELCHIOR_META,
    guideline: MELCHIOR_GUIDELINE,
  },
  balthasar: {
    ...BALTHASAR_META,
    guideline: BALTHASAR_GUIDELINE,
  },
  casper: {
    ...CASPER_META,
    guideline: CASPER_GUIDELINE,
  },
} as const;

export type BuiltInPersonaId = keyof typeof BUILT_IN_PERSONAS;

export function isBuiltInPersona(id: string): id is BuiltInPersonaId {
  return id in BUILT_IN_PERSONAS;
}
