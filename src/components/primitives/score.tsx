import { ScoreDataSchema, type ScoreOption, type ToolDefinition } from "@/lib/tools/schema";

type ScoreDefinition = Extract<ToolDefinition, { primitive: "score" }>;

export function ScorePrimitive({
  definition,
  data,
}: {
  definition: ScoreDefinition;
  data: unknown;
}) {
  const parsed = ScoreDataSchema.safeParse(data);

  if (!parsed.success) {
    return (
      <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500">
        This tool&apos;s data couldn&apos;t be read.
      </div>
    );
  }

  const { options } = parsed.data;

  if (options.length === 0) {
    return (
      <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500">
        Nothing here yet.
      </div>
    );
  }

  const { criteria } = definition.config;

  function total(option: ScoreOption) {
    return criteria.reduce(
      (sum, criterion) => sum + (option.scores[criterion.key] ?? 0) * criterion.weight,
      0
    );
  }

  const rows = options
    .map((option) => ({ option, total: total(option) }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="max-w-full overflow-x-auto rounded-md border border-neutral-200">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border border-neutral-300 bg-neutral-50 px-3 py-2 text-left font-semibold text-neutral-900">
              Option
            </th>
            {criteria.map((criterion) => (
              <th
                key={criterion.key}
                className="border border-neutral-300 bg-neutral-50 px-3 py-2 text-left font-semibold text-neutral-900"
              >
                <div>{criterion.label}</div>
                <div className="text-xs font-normal text-neutral-500">
                  weight {criterion.weight}
                </div>
              </th>
            ))}
            <th className="border border-neutral-300 bg-neutral-50 px-3 py-2 text-left font-semibold text-neutral-900">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ option, total: optionTotal }) => (
            <tr key={option.id}>
              <td className="border border-neutral-300 px-3 py-2 text-neutral-900">
                {option.label}
              </td>
              {criteria.map((criterion) => (
                <td
                  key={criterion.key}
                  className="border border-neutral-300 px-3 py-2 text-center text-neutral-900"
                >
                  {option.scores[criterion.key] ?? 0}
                </td>
              ))}
              <td className="border border-neutral-300 px-3 py-2 text-center font-semibold text-neutral-900">
                {optionTotal}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
