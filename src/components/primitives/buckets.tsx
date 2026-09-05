import { bucketsDataSchema, type ItemField, type ToolDefinition } from "@/lib/tools/schema";

type BucketsDefinition = Extract<ToolDefinition, { primitive: "buckets" }>;

export function BucketsPrimitive({
  definition,
  data,
}: {
  definition: BucketsDefinition;
  data: unknown;
}) {
  const schema = bucketsDataSchema(definition.config);
  const parsed = schema.safeParse(data);

  if (!parsed.success) {
    return (
      <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500">
        This tool&apos;s data couldn&apos;t be read.
      </div>
    );
  }

  const { items } = parsed.data;
  const { categories, itemFields } = definition.config;

  return (
    <div className="flex flex-wrap gap-3">
      {categories.map((category) => {
        const categoryItems = items.filter((item) => item.categoryKey === category.key);
        return (
          <div
            key={category.key}
            className="flex min-w-[14rem] flex-1 flex-col gap-2 rounded-md border border-neutral-200 p-3"
          >
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                {category.label}
              </div>
              {category.prompt && (
                <div className="mt-0.5 text-xs text-neutral-500">{category.prompt}</div>
              )}
            </div>
            {categoryItems.length === 0 ? (
              <div className="rounded-md bg-neutral-50 px-3 py-2 text-sm text-neutral-500">
                Nothing here yet.
              </div>
            ) : (
              <ol className="flex flex-col gap-2 text-sm">
                {categoryItems.map((item) => (
                  <BucketItemCard
                    key={item.id}
                    values={item.values}
                    itemFields={itemFields}
                  />
                ))}
              </ol>
            )}
          </div>
        );
      })}
    </div>
  );
}

function BucketItemCard({
  values,
  itemFields,
}: {
  values: Record<string, unknown>;
  itemFields: ItemField[];
}) {
  return (
    <li className="rounded-md border border-neutral-200 px-3 py-2 text-neutral-900">
      {itemFields.length === 0 ? (
        <span className="text-neutral-500">No fields configured.</span>
      ) : (
        <dl className="flex flex-col gap-1">
          {itemFields.map((field) => {
            const value = values[field.key];
            const isEmpty = value === null || value === undefined || value === "";
            return (
              <div key={field.key} className="flex items-baseline justify-between gap-3">
                <dt className="text-xs text-neutral-500">{field.label ?? field.key}</dt>
                <dd className="text-right">
                  {isEmpty ? "—" : typeof value === "number" ? value : String(value)}
                </dd>
              </div>
            );
          })}
        </dl>
      )}
    </li>
  );
}
