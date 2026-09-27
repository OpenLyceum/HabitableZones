import { toFixed } from "scenerystack/dot";
import { StringUtils } from "scenerystack/phetcommon";
/**
 * formatAge.ts
 *
 * Formats a stellar age for display. The SHZ catalog (and therefore every
 * model age) is in **millions of years (Myr)**; ages ≥ 1000 Myr are shown in
 * Gy, smaller ones in My. Mirrors SHZTimeline.as:136-156 / timeline.jsx.
 */
export function formatAgeMyr(ageMyr: number, gigayearsPattern: string, megayearsPattern: string): string {
  if (Math.abs(ageMyr) >= 1000) {
    return StringUtils.fillIn(gigayearsPattern, { value: toFixed(ageMyr / 1000, 1) });
  }
  return StringUtils.fillIn(megayearsPattern, { value: toFixed(ageMyr, Math.abs(ageMyr) < 10 ? 1 : 0) });
}
