import { describe, it, expect, vi } from 'vitest';
import { applyLabels, clearLabels } from './labels';
import type { GitHubClient } from './client';
import type { VotingSummary } from '../personas/persona.interface';
const summary = {passed:true} as VotingSummary;
function client(addError?:number, removeError?:number) {
  const addLabels = vi.fn(async()=>{if(addError)throw Object.assign(new Error('add failed'),{status:addError});});
  const removeLabel = vi.fn(async()=>{if(removeError)throw Object.assign(new Error('remove failed'),{status:removeError});});
  return {c:{owner:'a',repo:'b',octokit:{rest:{issues:{addLabels,removeLabel}}}} as unknown as GitHubClient,addLabels,removeLabel};
}
describe('label publishing',()=>{
  it('propagates permission failure instead of reporting success',async()=>{const {c}=client(403);await expect(applyLabels(c,1,summary)).rejects.toThrow('add failed');});
  it('propagates inability to remove an obsolete verdict',async()=>{const {c}=client(undefined,403);await expect(applyLabels(c,1,summary)).rejects.toThrow('remove failed');});
  it('ignores only missing labels during cleanup',async()=>{const {c,removeLabel}=client(undefined,404);await expect(clearLabels(c,1)).resolves.toBeUndefined();expect(removeLabel).toHaveBeenCalledTimes(2);});
});
