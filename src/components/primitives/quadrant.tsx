import type { z } from "zod";
import { quadrantDataSchema, type ItemField, type ToolDefinition } from "@/lib/tools/schema";

type QuadrantDefinition = Extract<ToolDefinition, { primitive: "quadrant" }>;
type QuadrantCell = QuadrantDefinition["config"]["cells"][number];
type QuadrantParsedData = z.infer<ReturnType<typeof quadrantDataSchema>>;
type QuadrantParsedItem = QuadrantParsedData["items"][number];

const ROW_ORDER = ["high", "low"] as const;
const COL_ORDER = ["low", "high"] as const;

export function QuadrantPrimitive({
  definition,
  data,
}: {
  definition: QuadrantDefinition;
  data: unknown;
}) {
  const parsed = quadrantDataSchema(definition.config).safeParse(data);

  if (!parsed.success) {
    return (
      <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500">
        This tool&apos;s data couldn&apos;t be read.
      </div>
    );
  }

  const { items } = parsed.data;
  const { axes, cells, itemFields } = definition.config;

  if (cells.length === 0) {
    return (
      <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500">
        Nothing here yet.
      </div>
    );
  }

  return (
    <div className="text-sm">
      <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-neutral-500">
        <div>
          <span className="font-semibold text-neutral-700">{axes.x.label}:</span>{" "}
          {axes.x.low} &rarr; {axes.x.high}
        </div>
        <div>
          <span className="font-semibold text-neutral-700">{axes.y.label}:</span>{" "}
          {axes.y.low} &rarr; {axes.y.high}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {ROW_ORDER.flatMap((y) =>
          COL_ORDER.map((x) => (
            <div key={`${x}-${y}`} className="flex flex-col gap-3">
              {cells
                .filter((cell) => cell.x === x && cell.y === y)
                .map((cell) => (
                  <QuadrantCellPanel
                    key={cell.key}
                    cell={cell}
                    itemFields={itemFields}
                    items={items.filter((item) => item.cellKey === cell.key)}
                  />
                ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function QuadrantCellPanel({
  cell,
  itemFields,
  items,
}: {
  cell: QuadrantCell;
  itemFields: ItemField[];
  items: QuadrantParsedItem[];
}) {
  return (
    <div className="flex min-h-[8rem] flex-col gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-3">
      <div>
        <div className="font-semibold text-neutral-900">{cell.label}</div>
        {cell.prompt && <div className="text-xs text-neutral-500">{cell.prompt}</div>}
      </div>
      {items.length === 0 ? (
        <div className="text-xs text-neutral-400">Nothing here yet.</div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <QuadrantItemCard key={item.id} item={item} itemFields={itemFields} />
          ))}
        </div>
      )}
    </div>
  );
}

function displayValue(value: unknown): string | null {
  if (typeof value === "string") return value.trim().length > 0 ? value : null;
  if (typeof value === "number") return String(value);
  return null;
}

function QuadrantItemCard({
  item,
  itemFields,
}: {
  item: QuadrantParsedItem;
  itemFields: ItemField[];
}) {
  const values = item.values as Record<string, unknown>;
  const fields = itemFields.length > 0 ? itemFields : fallbackFields(values);

  const rendered = fields
    .map((field) => ({ field, display: displayValue(values[field.key]) }))
    .filter((entry) => entry.display !== null);

  return (
    <div className="min-w-[10rem] max-w-full rounded-md border border-neutral-200 bg-white px-2 py-1.5">
      {rendered.length === 0 ? (
        <div className="text-xs italic text-neutral-400">{item.id}</div>
      ) : (
        rendered.map(({ field, display }) => (
          <div key={field.key} className="text-xs">
            <span className="font-medium text-neutral-700">{field.label ?? field.key}:</span>{" "}
            <span className="text-neutral-900">{display}</span>
          </div>
        ))
      )}
    </div>
  );
}

function fallbackFields(values: Record<string, unknown>): ItemField[] {
  return Object.keys(values).map((key) => ({ key, type: "text" as const }));
}
