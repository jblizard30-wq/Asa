import { FlowDataSchema, type FlowNode, type ToolDefinition } from "@/lib/tools/schema";

type FlowDefinition = Extract<ToolDefinition, { primitive: "flow" }>;

const UNASSIGNED_LANE_KEY = "__unassigned__";
const UNASSIGNED_LANE_LABEL = "Unassigned";

export function FlowPrimitive({
  definition,
  data,
}: {
  definition: FlowDefinition;
  data: unknown;
}) {
  const parsed = FlowDataSchema.safeParse(data);

  if (!parsed.success) {
    return (
      <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500">
        This tool&apos;s data couldn&apos;t be read.
      </div>
    );
  }

  const { nodes } = parsed.data;

  if (nodes.length === 0) {
    return (
      <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500">
        Nothing here yet.
      </div>
    );
  }

  const sorted = [...nodes].sort((a, b) => a.order - b.order);
  const { lanes } = definition.config;

  if (!lanes || lanes.length === 0) {
    return (
      <ol className="flex flex-col gap-2 text-sm">
        {sorted.map((node, idx) => (
          <FlowNodeRow key={node.id} node={node} index={idx} />
        ))}
      </ol>
    );
  }

  const laneKeys = lanes.map((lane) => lane.key);
  const columns = [
    ...lanes.map((lane) => ({ key: lane.key, label: lane.label })),
    { key: UNASSIGNED_LANE_KEY, label: UNASSIGNED_LANE_LABEL },
  ];

  function nodesForLane(laneKey: string) {
    if (laneKey === UNASSIGNED_LANE_KEY) {
      return sorted.filter((node) => !node.laneKey || !laneKeys.includes(node.laneKey));
    }
    return sorted.filter((node) => node.laneKey === laneKey);
  }

  return (
    <div className="flex gap-3 overflow-x-auto">
      {columns.map((column) => {
        const laneNodes = nodesForLane(column.key);
        return (
          <div
            key={column.key}
            className="flex min-w-[14rem] flex-1 flex-col gap-2 rounded-md border border-neutral-200 p-3"
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {column.label}
            </div>
            {laneNodes.length === 0 ? (
              <div className="rounded-md bg-neutral-50 px-3 py-2 text-sm text-neutral-500">
                Nothing here yet.
              </div>
            ) : (
              <ol className="flex flex-col gap-2 text-sm">
                {laneNodes.map((node, idx) => (
                  <FlowNodeRow key={node.id} node={node} index={idx} />
                ))}
              </ol>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FlowNodeRow({ node, index }: { node: FlowNode; index: number }) {
  return (
    <li className="rounded-md border border-neutral-200 px-3 py-2 text-neutral-900">
      <div className="flex items-baseline justify-between gap-2">
        <span>
          <span className="text-neutral-500">{index + 1}. </span>
          {node.label}
        </span>
        {node.date && <span className="text-xs text-neutral-500">{node.date}</span>}
      </div>
    </li>
  );
}
