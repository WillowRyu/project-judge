import * as fs from "fs";
import * as path from "path";

function isInside(root: string, target: string): boolean {
  return target === root || target.startsWith(`${root}${path.sep}`);
}

/** Reject user-provided paths that cannot name a file below the workspace. */
export function validateWorkspaceRelativePath(value: string): string {
  const normalized = value.replace(/\\/g, "/");
  if (
    !normalized ||
    normalized.includes("\0") ||
    path.posix.isAbsolute(normalized) ||
    path.win32.isAbsolute(normalized) ||
    normalized.split("/").some((part) => part === "." || part === "..")
  ) {
    throw new Error(`Unsafe workspace-relative path: ${value}`);
  }
  return normalized;
}

/**
 * Read a regular workspace file only after checking its resolved target remains
 * below the workspace's real path. `null` means the requested file is absent.
 */
export function readWorkspaceFileIfExists(
  workspacePath: string,
  relativePath: string,
): string | null {
  const relative = validateWorkspaceRelativePath(relativePath);
  const root = fs.realpathSync(workspacePath);
  const candidate = path.join(root, relative);

  let stat: fs.Stats;
  try {
    stat = fs.lstatSync(candidate);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }

  let resolved: string;
  try {
    resolved = fs.realpathSync(candidate);
  } catch (error) {
    throw new Error(
      `Could not resolve workspace file ${relativePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!isInside(root, resolved)) {
    throw new Error(`Workspace file resolves outside the workspace: ${relativePath}`);
  }
  if (!stat.isFile() && !stat.isSymbolicLink()) {
    throw new Error(`Workspace path must be a regular file: ${relativePath}`);
  }
  if (!fs.statSync(resolved).isFile()) {
    throw new Error(`Workspace path must be a regular file: ${relativePath}`);
  }
  return fs.readFileSync(resolved, "utf-8");
}
