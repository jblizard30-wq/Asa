import { NarrativeDataSchema, type ToolDefinition } from "@/lib/tools/schema";

type NarrativeDefinition = Extract<ToolDefinition, { primitive: "narrative" }>;

export function NarrativePrimitive({
  definition,
  data,
}: {
  definition: NarrativeDefinition;
  data: unknown;
}) {
  const parsed = NarrativeDataSchema.safeParse(data);

  if (!parsed.success) {
    return (
      <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500">
        This tool&apos;s data couldn&apos;t be read.
      </div>
    );
  }

  const { sections: sectionBodies } = parsed.data;
  const { sections } = definition.config;

  return (
    <div className="max-h-[40rem] divide-y divide-neutral-200 overflow-y-auto rounded-md border border-neutral-200 text-sm">
      {sections.map((section) => {
        const body = sectionBodies[section.key];
        const hasContent = typeof body === "string" && body.trim().length > 0;

        return (
          <div key={section.key} className="p-3">
            <div className="font-semibold text-neutral-900">{section.label}</div>
            {section.prompt && (
              <div className="mt-0.5 text-xs text-neutral-500">{section.prompt}</div>
            )}
            <div className="mt-2">
              {hasContent ? (
                <p className="whitespace-pre-wrap text-neutral-900">{body}</p>
              ) : (
                <p className="italic text-neutral-400">Not written yet.</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
