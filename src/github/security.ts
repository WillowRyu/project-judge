import * as github from '@actions/github';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfig } from '../config/loader';
import type { GitHubClient } from './client';

/** Validate the trigger before reading policy or spending provider credits. */
export async function authorizeReviewEvent(
  client: GitHubClient,
  context: Pick<typeof github.context, 'eventName' | 'payload'> = github.context,
): Promise<string | undefined> {
  const { payload, eventName } = context;
  if (eventName === 'issue_comment') {
    const comment = payload.comment;
    if (!payload.issue?.pull_request || !/^\/magi-review\s*$/.test(comment?.body?.trim() ?? '')) return 'not_review_command';
    const username = comment?.user?.login;
    if (!username) return 'unauthorized_comment';
    const { data } = await client.octokit.rest.repos.getCollaboratorPermissionLevel({ owner: client.owner, repo: client.repo, username });
    return ['admin', 'maintain', 'write'].includes(data.permission) ? undefined : 'unauthorized_comment';
  }
  if (eventName !== 'pull_request') return 'unsupported_event';
  const pr = payload.pull_request;
  if (!pr) return 'not_pull_request';
  if (pr.head?.repo?.full_name !== pr.base?.repo?.full_name) return 'fork_pull_request';
  return undefined;
}

function safeRelativePath(value: string): string {
  const normalized = value.replace(/\\/g, '/');
  if (!normalized || path.posix.isAbsolute(normalized) || /^[a-z]:/i.test(normalized) || normalized.includes('\0') || normalized.split('/').some(part => part === '..' || part === '.')) {
    throw new Error(`Unsafe repository-relative policy path: ${value}`);
  }
  return normalized;
}

/**
 * Materialize only policy files from the immutable PR base commit. This never
 * opens the checkout, so PR symlinks and PR changes cannot affect trusted policy.
 */
export async function prepareTrustedWorkspace(client: GitHubClient, baseSha: string, configPath = ''): Promise<{ workspacePath: string; cleanup: () => void }> {
  if (!baseSha) throw new Error('Missing trusted PR base commit');
  if (configPath) safeRelativePath(configPath);
  const workspacePath = fs.mkdtempSync(path.join(tmpdir(), 'magi-policy-'));
  const cleanup = () => fs.rmSync(workspacePath, { recursive: true, force: true });
  const fetched = new Set<string>();
  const fetchFile = async (requestedPath: string): Promise<boolean> => {
    const relativePath = safeRelativePath(requestedPath);
    if (fetched.has(relativePath)) return true;
    let data;
    try {
      ({ data } = await client.octokit.rest.repos.getContent({ owner: client.owner, repo: client.repo, path: relativePath, ref: baseSha }));
    } catch (error) {
      if ((error as { status?: number }).status === 404) return false;
      throw error;
    }
    if (Array.isArray(data) || data.type !== 'file' || 'target' in data || !('encoding' in data) || data.encoding !== 'base64') {
      throw new Error(`Policy must be a regular file: ${relativePath}`);
    }
    if (data.size > 1024 * 1024) throw new Error(`Policy file exceeds 1 MiB: ${relativePath}`);
    const contents = Buffer.from(data.content, 'base64');
    if (contents.length > 1024 * 1024 || (data.size > 0 && contents.length === 0)) throw new Error(`Policy file could not be read completely: ${relativePath}`);
    const target = path.join(workspacePath, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents);
    fetched.add(relativePath);
    return true;
  };
  const fetchFirst = async (candidates: string[]) => {
    for (const candidate of candidates) if (await fetchFile(candidate)) return true;
    return false;
  };
  try {
    const found = await fetchFirst(configPath ? [configPath] : ['.github/magi.yml', '.github/magi.yaml', '.magi.yml', '.magi.yaml']);
    if (configPath && !found) throw new Error(`Configuration file not found at PR base: ${configPath}`);
    const config = await loadConfig(workspacePath, configPath || undefined);
    const roots = ['.github/magi', '.magi', 'docs/magi'];
    await fetchFirst(roots.flatMap(root => [`${root}/common.md`, `${root}/COMMON.md`]));
    const personas = config.personas?.length ? config.personas : [{id:'melchior'}, {id:'balthasar'}, {id:'casper'}];
    for (const persona of personas) {
      const explicit = 'guideline_file' in persona ? persona.guideline_file : undefined;
      if (explicit) {
        if (!await fetchFile(explicit)) throw new Error(`Guideline file not found at PR base: ${explicit}`);
      } else {
        const names = [...new Set([persona.id, persona.id.toUpperCase(), persona.id.toLowerCase()])];
        await fetchFirst(roots.flatMap(root => names.map(name => `${root}/${name}.md`)));
      }
    }
    return { workspacePath, cleanup };
  } catch (error) {
    cleanup();
    throw error;
  }
}
