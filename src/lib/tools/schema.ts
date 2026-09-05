import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared enums (TOOLKIT-SPEC.md Sections 3 and 4.1)
// ---------------------------------------------------------------------------

export const STAGES = [
  "sense",
  "discern",
  "decide",
  "align",
  "plan",
  "execute",
  "review",
] as const;
export const StageSchema = z.enum(STAGES);
export type Stage = z.infer<typeof StageSchema>;

export const ENTITY_TYPES = [
  "action",
  "risk",
  "decision",
  "assumption",
  "stakeholder",
  "insight",
  "metric",
  "cost",
] as const;
export const EntityTypeSchema = z.enum(ENTITY_TYPES);
export type EntityType = z.infer<typeof EntityTypeSchema>;

export const PRIMITIVES = [
  "quadrant",
  "buckets",
  "table",
  "tree",
  "flow",
  "score",
  "narrative",
] as const;
export const PrimitiveSchema = z.enum(PRIMITIVES);
export type Primitive = z.infer<typeof PrimitiveSchema>;

// ---------------------------------------------------------------------------
// Item fields — the per-item data entry shape a primitive's items are built from
// ---------------------------------------------------------------------------

export const FIELD_TYPES = ["text", "enum", "number", "date", "person"] as const;
export const FieldTypeSchema = z.enum(FIELD_TYPES);
export type FieldType = z.infer<typeof FieldTypeSchema>;

export const ItemFieldSchema = z.object({
  key: z.string(),
  label: z.string().optional(),
  type: FieldTypeSchema,
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
});
export type ItemField = z.infer<typeof ItemFieldSchema>;

const FieldValueSchema = z.union([z.string(), z.number(), z.null()]);
const FieldValuesSchema = z.record(z.string(), FieldValueSchema);

function itemFieldValuesSchema(itemFields: ItemField[]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of itemFields) {
    const base =
      field.type === "number"
        ? z.number()
        : field.type === "enum"
          ? z.enum(field.options && field.options.length > 0 ? (field.options as [string, ...string[]]) : [""])
          : z.string();
    shape[field.key] = field.required ? base : base.optional().nullable();
  }
  return z.object(shape).catchall(FieldValueSchema);
}

// ---------------------------------------------------------------------------
// Per-primitive config — the static shape a ToolDefinition author declares once
// ---------------------------------------------------------------------------

export const QuadrantConfigSchema = z.object({
  axes: z.object({
    x: z.object({ label: z.string(), low: z.string(), high: z.string() }),
    y: z.object({ label: z.string(), low: z.string(), high: z.string() }),
  }),
  cells: z
    .array(
      z.object({
        key: z.string(),
        label: z.string(),
        prompt: z.string().optional(),
        x: z.enum(["low", "high"]),
        y: z.enum(["low", "high"]),
      })
    )
    .min(1),
  itemFields: z.array(ItemFieldSchema),
});
export type QuadrantConfig = z.infer<typeof QuadrantConfigSchema>;

export const BucketsConfigSchema = z.object({
  categories: z
    .array(z.object({ key: z.string(), label: z.string(), prompt: z.string().optional() }))
    .min(1),
  itemFields: z.array(ItemFieldSchema),
});
export type BucketsConfig = z.infer<typeof BucketsConfigSchema>;

export const TableConfigSchema = z.object({
  columns: z
    .array(
      z.object({
        key: z.string(),
        label: z.string(),
        type: FieldTypeSchema,
        options: z.array(z.string()).optional(),
      })
    )
    .min(1),
});
export type TableConfig = z.infer<typeof TableConfigSchema>;

export const TreeConfigSchema = z.object({
  rootLabel: z.string().optional(),
  nodeFields: z.array(ItemFieldSchema),
});
export type TreeConfig = z.infer<typeof TreeConfigSchema>;

export const FlowConfigSchema = z.object({
  lanes: z.array(z.object({ key: z.string(), label: z.string() })).optional(),
  nodeFields: z.array(ItemFieldSchema),
});
export type FlowConfig = z.infer<typeof FlowConfigSchema>;

export const ScoreConfigSchema = z.object({
  criteria: z
    .array(z.object({ key: z.string(), label: z.string(), weight: z.number().positive() }))
    .min(1),
});
export type ScoreConfig = z.infer<typeof ScoreConfigSchema>;

export const NarrativeConfigSchema = z.object({
  sections: z
    .array(z.object({ key: z.string(), label: z.string(), prompt: z.string().optional() }))
    .min(1),
});
export type NarrativeConfig = z.infer<typeof NarrativeConfigSchema>;

// ---------------------------------------------------------------------------
// ToolDefinition — one config file per tool, discriminated on `primitive`
// ---------------------------------------------------------------------------

const baseToolFields = {
  id: z.string(),
  name: z.string(),
  category: z.string(),
  stages: z.array(StageSchema).min(1),
  emits: z.array(EntityTypeSchema),
  consumes: z.array(EntityTypeSchema),
  blurb: z.string(),
  whenToUse: z.string(),
  churchExample: z.string(),
  estimatedMinutes: z.number().int().positive(),
  facilitationNotes: z.string().optional(),
  starterTemplates: z.array(z.string()).optional(),
};

export const ToolDefinitionSchema = z.discriminatedUnion("primitive", [
  z.object({ ...baseToolFields, primitive: z.literal("quadrant"), config: QuadrantConfigSchema }),
  z.object({ ...baseToolFields, primitive: z.literal("buckets"), config: BucketsConfigSchema }),
  z.object({ ...baseToolFields, primitive: z.literal("table"), config: TableConfigSchema }),
  z.object({ ...baseToolFields, primitive: z.literal("tree"), config: TreeConfigSchema }),
  z.object({ ...baseToolFields, primitive: z.literal("flow"), config: FlowConfigSchema }),
  z.object({ ...baseToolFields, primitive: z.literal("score"), config: ScoreConfigSchema }),
  z.object({ ...baseToolFields, primitive: z.literal("narrative"), config: NarrativeConfigSchema }),
]);
export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;

// ---------------------------------------------------------------------------
// Per-primitive DATA schemas — validates a tool_instance's `data` jsonb against
// the shape its definition's `config` declares. Used by both the primitive
// renderers (to detect malformed data) and API routes (Section 3, non-negotiable 1).
// ---------------------------------------------------------------------------

export const QuadrantItemSchema = z.object({
  id: z.string(),
  cellKey: z.string(),
  values: FieldValuesSchema,
});
export type QuadrantItem = z.infer<typeof QuadrantItemSchema>;
export const QuadrantDataSchema = z.object({ items: z.array(QuadrantItemSchema) });
export type QuadrantData = z.infer<typeof QuadrantDataSchema>;

export function quadrantDataSchema(config: QuadrantConfig) {
  const cellKeys = config.cells.map((c) => c.key) as [string, ...string[]];
  const valuesSchema = itemFieldValuesSchema(config.itemFields);
  return z.object({
    items: z.array(
      z.object({
        id: z.string(),
        cellKey: z.enum(cellKeys),
        values: valuesSchema,
      })
    ),
  });
}

export const BucketsItemSchema = z.object({
  id: z.string(),
  categoryKey: z.string(),
  values: FieldValuesSchema,
});
export type BucketsItem = z.infer<typeof BucketsItemSchema>;
export const BucketsDataSchema = z.object({ items: z.array(BucketsItemSchema) });
export type BucketsData = z.infer<typeof BucketsDataSchema>;

export function bucketsDataSchema(config: BucketsConfig) {
  const categoryKeys = config.categories.map((c) => c.key) as [string, ...string[]];
  const valuesSchema = itemFieldValuesSchema(config.itemFields);
  return z.object({
    items: z.array(
      z.object({
        id: z.string(),
        categoryKey: z.enum(categoryKeys),
        values: valuesSchema,
      })
    ),
  });
}

export const TableRowSchema = z.object({ id: z.string() }).catchall(FieldValueSchema);
export type TableRow = z.infer<typeof TableRowSchema>;
export const TableDataSchema = z.object({ rows: z.array(TableRowSchema) });
export type TableData = z.infer<typeof TableDataSchema>;

export function tableDataSchema(config: TableConfig) {
  const shape: Record<string, z.ZodTypeAny> = { id: z.string() };
  for (const column of config.columns) {
    shape[column.key] = FieldValueSchema.optional().nullable();
  }
  return z.object({ rows: z.array(z.object(shape).catchall(FieldValueSchema)) });
}

export type TreeNode = {
  id: string;
  label: string;
  values: Record<string, string | number | null>;
  children: TreeNode[];
};
export const TreeNodeSchema: z.ZodType<TreeNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    label: z.string(),
    values: FieldValuesSchema,
    children: z.array(TreeNodeSchema),
  })
);
export const TreeDataSchema = z.object({ root: TreeNodeSchema });
export type TreeData = z.infer<typeof TreeDataSchema>;

export function treeDataSchema(_config: TreeConfig) {
  return TreeDataSchema;
}

export const FlowNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  order: z.number(),
  laneKey: z.string().optional(),
  date: z.string().optional(),
  values: FieldValuesSchema,
});
export type FlowNode = z.infer<typeof FlowNodeSchema>;
export const FlowDataSchema = z.object({ nodes: z.array(FlowNodeSchema) });
export type FlowData = z.infer<typeof FlowDataSchema>;

export function flowDataSchema(_config: FlowConfig) {
  return FlowDataSchema;
}

export const ScoreOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  scores: z.record(z.string(), z.number()),
});
export type ScoreOption = z.infer<typeof ScoreOptionSchema>;
export const ScoreDataSchema = z.object({ options: z.array(ScoreOptionSchema) });
export type ScoreData = z.infer<typeof ScoreDataSchema>;

export function scoreDataSchema(_config: ScoreConfig) {
  return ScoreDataSchema;
}

export const NarrativeDataSchema = z.object({ sections: z.record(z.string(), z.string()) });
export type NarrativeData = z.infer<typeof NarrativeDataSchema>;

export function narrativeDataSchema(_config: NarrativeConfig) {
  return NarrativeDataSchema;
}

/** Dispatches a ToolDefinition to the Zod schema its `data` jsonb must satisfy. */
export function dataSchemaFor(definition: ToolDefinition): z.ZodTypeAny {
  switch (definition.primitive) {
    case "quadrant":
      return quadrantDataSchema(definition.config);
    case "buckets":
      return bucketsDataSchema(definition.config);
    case "table":
      return tableDataSchema(definition.config);
    case "tree":
      return treeDataSchema(definition.config);
    case "flow":
      return flowDataSchema(definition.config);
    case "score":
      return scoreDataSchema(definition.config);
    case "narrative":
      return narrativeDataSchema(definition.config);
  }
}
