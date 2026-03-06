import { describe, expect, it } from "vitest";
import { filterIgnoredFiles, type FileDiff } from "./diff-analyzer";

describe("filterIgnoredFiles generated file patterns", () => {
  it("filters common generated file paths by default-style patterns", () => {
    const files: FileDiff[] = [
      {
        filename: "src/generated/api-client.ts",
        status: "modified",
        additions: 10,
        deletions: 2,
      },
      {
        filename: "src/__generated__/graphql.ts",
        status: "modified",
        additions: 20,
        deletions: 5,
      },
      {
        filename: "src/models/user.generated.ts",
        status: "modified",
        additions: 6,
        deletions: 1,
      },
      {
        filename: "src/app.ts",
        status: "modified",
        additions: 3,
        deletions: 1,
      },
    ];

    const patterns = ["generated/", "__generated__/", ".generated."];
    const filtered = filterIgnoredFiles(files, patterns);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].filename).toBe("src/app.ts");
  });

  it("filters protobuf and language-specific generated artifacts", () => {
    const files: FileDiff[] = [
      {
        filename: "proto/user.pb.go",
        status: "modified",
        additions: 12,
        deletions: 4,
      },
      {
        filename: "lib/src/models/user.g.dart",
        status: "modified",
        additions: 8,
        deletions: 2,
      },
      {
        filename: "lib/src/graphql/user.graphql.dart",
        status: "modified",
        additions: 11,
        deletions: 3,
      },
      {
        filename: "src/ViewModel.Designer.cs",
        status: "modified",
        additions: 9,
        deletions: 3,
      },
      {
        filename: "src/domain/user.ts",
        status: "modified",
        additions: 3,
        deletions: 1,
      },
    ];

    const patterns = [".pb.", ".g.dart", ".graphql.dart", ".designer.cs"];
    const filtered = filterIgnoredFiles(files, patterns);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].filename).toBe("src/domain/user.ts");
  });

  it("supports advanced minimatch patterns (brace expansion)", () => {
    const files: FileDiff[] = [
      {
        filename: "proto/user.pb.go",
        status: "modified",
        additions: 4,
        deletions: 1,
      },
      {
        filename: "lib/src/models/user.g.dart",
        status: "modified",
        additions: 7,
        deletions: 2,
      },
      {
        filename: "src/app.ts",
        status: "modified",
        additions: 2,
        deletions: 1,
      },
    ];

    const patterns = ["**/*.{pb.go,g.dart}"];
    const filtered = filterIgnoredFiles(files, patterns);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].filename).toBe("src/app.ts");
  });
});
