import { tableDataSchema, type ToolDefinition } from "@/lib/tools/schema";

type TableDefinition = Extract<ToolDefinition, { primitive: "table" }>;

type CellValue = string | number | null | undefined;

function cellText(value: CellValue): string {
  return value === null || value === undefined ? "—" : String(value);
}

export function TablePrimitive({
  definition,
  data,
}: {
  definition: TableDefinition;
  data: unknown;
}) {
  const schema = tableDataSchema(definition.config);
  const parsed = schema.safeParse(data);

  if (!parsed.success) {
    return (
      <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500">
        This tool&apos;s data couldn&apos;t be read.
      </div>
    );
  }

  const rows = parsed.data.rows as Array<{ id: string } & Record<string, CellValue>>;

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500">
        Nothing here yet.
      </div>
    );
  }

  const { columns } = definition.config;

  return (
    <div className="max-w-full overflow-x-auto rounded-md border border-neutral-200">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {columns.map((column, idx) => (
              <th
                key={column.key}
                className={
                  "border border-neutral-300 bg-neutral-50 px-3 py-2 text-left font-semibold text-neutral-900 " +
                  (idx === 0 ? "sticky left-0 bg-neutral-50 z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]" : "")
                }
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((column, idx) => (
                <td
                  key={column.key}
                  className={
                    "border border-neutral-300 px-3 py-2 text-neutral-900 " +
                    (idx === 0 ? "sticky left-0 bg-white z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]" : "")
                  }
                >
                  {cellText(row[column.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
