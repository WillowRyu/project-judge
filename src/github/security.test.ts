import { describe, expect, it, vi } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { authorizeReviewEvent, prepareTrustedWorkspace } from './security';
import type { GitHubClient } from './client';

function client(permission = 'read', files: Record<string, string | object> = {}) {
  const getCollaboratorPermissionLevel = vi.fn(async () => ({ data: { permission } }));
  const getContent = vi.fn(async ({ path, ref }: {path: string; ref: string}) => {
    expect(ref).toBe('trusted-base-sha');
    if (!(path in files)) throw Object.assign(new Error('Not found'), {status:404});
    const value = files[path];
    return {data: typeof value === 'string' ? {type:'file', encoding:'base64', content:Buffer.from(value).toString('base64'), size:Buffer.byteLength(value)} : value};
  });
  return {client:{owner:'owner', repo:'repo', octokit:{rest:{repos:{getContent,getCollaboratorPermissionLevel}}}} as unknown as GitHubClient, getContent, getCollaboratorPermissionLevel};
}
const comment = {eventName:'issue_comment', payload:{issue:{number:42,pull_request:{}},comment:{body:'/magi-review',user:{login:'contributor'}}}};

describe('review trigger trust', () => {
  it('denies a commenter without repository write permission', async () => {
    const c=client();
    expect(await authorizeReviewEvent(c.client, comment)).toBe('unauthorized_comment');
  });
  it('allows a maintainer command after a server-side permission check', async () => {
    const c=client('write');
    expect(await authorizeReviewEvent(c.client, comment)).toBeUndefined();
    expect(c.getCollaboratorPermissionLevel).toHaveBeenCalledWith({owner:'owner',repo:'repo',username:'contributor'});
  });
  it('does not treat quoted or incidental command text as a trigger', async () => {
    const c=client('write');
    expect(await authorizeReviewEvent(c.client,{...comment,payload:{...comment.payload,comment:{...comment.payload.comment,body:'Please do not /magi-review'}}})).toBe('not_review_command');
    expect(c.getCollaboratorPermissionLevel).not.toHaveBeenCalled();
  });
  it('skips fork pull_request events which cannot access provider secrets', async () => {
    const c=client();
    expect(await authorizeReviewEvent(c.client,{eventName:'pull_request',payload:{pull_request:{head:{repo:{full_name:'fork/repo'}},base:{repo:{full_name:'owner/repo'}}}}})).toBe('fork_pull_request');
  });
});

describe('trusted policy snapshot', () => {
  it('reads policy only from the base commit and removes temporary files afterwards', async () => {
    const c=client('write',{'.github/magi.yml':'provider:\n  type: openai\n','.github/magi/common.md':'Trusted team guidelines'});
    const snapshot=await prepareTrustedWorkspace(c.client,'trusted-base-sha');
    expect(readFileSync(`${snapshot.workspacePath}/.github/magi/common.md`,'utf8')).toBe('Trusted team guidelines');
    snapshot.cleanup();
    expect(existsSync(snapshot.workspacePath)).toBe(false);
  });
  it('fetches configured guideline files from the same trusted commit', async () => {
    const c=client('write',{'.magi.yml':'personas:\n  - id: security\n    guideline_file: policies/security.md\nvoting:\n  required_approvals: 1\n','policies/security.md':'Use security checklist'});
    const snapshot=await prepareTrustedWorkspace(c.client,'trusted-base-sha');
    try { expect(readFileSync(`${snapshot.workspacePath}/policies/security.md`,'utf8')).toBe('Use security checklist'); } finally {snapshot.cleanup();}
  });
  it('rejects a policy symlink instead of reading its target', async () => {
    const c=client('write',{'.github/magi.yml':{type:'symlink',target:'/outside/sentinel'}});
    await expect(prepareTrustedWorkspace(c.client,'trusted-base-sha')).rejects.toThrow(/regular file/i);
  });
  it('rejects traversal before asking GitHub for an explicit config', async () => {
    const c=client();
    await expect(prepareTrustedWorkspace(c.client,'trusted-base-sha','../outside.yml')).rejects.toThrow(/relative|outside|unsafe/i);
    expect(c.getContent).not.toHaveBeenCalled();
  });
  it('does not silently replace a missing explicit config with defaults', async () => {
    const c=client();
    await expect(prepareTrustedWorkspace(c.client,'trusted-base-sha','config/missing.yml')).rejects.toThrow(/not found|missing/i);
  });
});
