import { describe, expect, it, vi } from "vitest";
import {
  getPullRequestFiles,
  legacyGetPullRequestFiles,
  type GitHubClient,
} from "./client";

interface PullFileStub {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
}

function createClient(options: {
  allFiles: PullFileStub[];
  firstPageFiles?: PullFileStub[];
}): {
  client: GitHubClient;
  listFiles: ReturnType<typeof vi.fn>;
  paginate: ReturnType<typeof vi.fn>;
} {
  const listFiles = vi.fn().mockResolvedValue({
    data: options.firstPageFiles ?? options.allFiles,
  });
  const paginate = vi.fn().mockResolvedValue(options.allFiles);

  const client: GitHubClient = {
    octokit: {
      rest: {
        pulls: {
          listFiles,
        },
      },
      paginate,
    } as unknown as GitHubClient["octokit"],
    owner: "owner",
    repo: "repo",
  };

  return { client, listFiles, paginate };
}

describe("getPullRequestFiles", () => {
  it("collects all files when the PR has 110 changed files", async () => {
    const files: PullFileStub[] = Array.from({ length: 110 }, (_, i) => ({
      filename: `src/file-${i + 1}.ts`,
      status: "modified",
      additions: 1,
      deletions: 0,
      patch: "@@ -1 +1 @@\n-old\n+new",
    }));

    const { client, listFiles, paginate } = createClient({
      allFiles: files,
      firstPageFiles: files.slice(0, 100),
    });
    const result = await getPullRequestFiles(client, 42);

    expect(paginate).toHaveBeenCalledOnce();
    expect(paginate).toHaveBeenCalledWith(
      listFiles,
      expect.objectContaining({
        owner: "owner",
        repo: "repo",
        pull_number: 42,
        per_page: 100,
      }),
    );
    expect(listFiles).not.toHaveBeenCalled();
    expect(result).toHaveLength(110);
    expect(result[109].filename).toBe("src/file-110.ts");
  });

  it("maps GitHub file statuses into FileDiff status values", async () => {
    const { client } = createClient({
      allFiles: [
        { filename: "added.ts", status: "added", additions: 2, deletions: 0 },
        {
          filename: "removed.ts",
          status: "removed",
          additions: 0,
          deletions: 3,
        },
        {
          filename: "renamed.ts",
          status: "renamed",
          additions: 1,
          deletions: 1,
        },
        {
          filename: "modified.ts",
          status: "changed",
          additions: 1,
          deletions: 1,
        },
      ],
    });

    const result = await getPullRequestFiles(client, 7);

    expect(result.map((file) => file.status)).toEqual([
      "added",
      "removed",
      "renamed",
      "modified",
    ]);
  });
});

describe("legacyGetPullRequestFiles", () => {
  it("drops files beyond the first page when the PR has 110 changed files", async () => {
    const allFiles: PullFileStub[] = Array.from({ length: 110 }, (_, i) => ({
      filename: `src/file-${i + 1}.ts`,
      status: "modified",
      additions: 1,
      deletions: 0,
      patch: "@@ -1 +1 @@\n-old\n+new",
    }));

    const { client, listFiles, paginate } = createClient({
      allFiles,
      firstPageFiles: allFiles.slice(0, 100),
    });

    const result = await legacyGetPullRequestFiles(client, 42);

    expect(listFiles).toHaveBeenCalledOnce();
    expect(paginate).not.toHaveBeenCalled();
    expect(result).toHaveLength(100);
    expect(result[99].filename).toBe("src/file-100.ts");
  });
});
