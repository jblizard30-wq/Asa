import { TreeDataSchema, type ToolDefinition, type TreeNode } from "@/lib/tools/schema";

type TreeDefinition = Extract<ToolDefinition, { primitive: "tree" }>;

const INDENT_REM_PER_DEPTH = 1.25;

export function TreePrimitive({
  definition,
  data,
}: {
  definition: TreeDefinition;
  data: unknown;
}) {
  const parsed = TreeDataSchema.safeParse(data);

  if (!parsed.success) {
    return (
      <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500">
        This tool&apos;s data couldn&apos;t be read.
      </div>
    );
  }

  const { root } = parsed.data;
  const isEmpty = root.label.trim().length === 0 && root.children.length === 0;

  if (isEmpty) {
    return (
      <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500">
        Nothing here yet.
      </div>
    );
  }

  return (
    <div className="max-h-[32rem] overflow-y-auto rounded-md border border-neutral-200 p-3 text-sm">
      {definition.config.rootLabel && (
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {definition.config.rootLabel}
        </div>
      )}
      <TreeNodeRow node={root} depth={0} />
    </div>
  );
}

function TreeNodeRow({ node, depth }: { node: TreeNode; depth: number }) {
  const hasLabel = node.label.trim().length > 0;

  return (
    <div>
      <div
        className="border-l border-neutral-200 py-1 pl-3 text-neutral-900"
        style={{ marginLeft: `${depth * INDENT_REM_PER_DEPTH}rem` }}
      >
        {hasLabel ? node.label : <span className="italic text-neutral-400">Untitled</span>}
      </div>
      {node.children.map((child) => (
        <TreeNodeRow key={child.id} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}
