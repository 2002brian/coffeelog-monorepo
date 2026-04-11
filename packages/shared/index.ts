import { z } from "zod";

export const HELLO_SHARED = "Shared package works!";

export const SyncStatusSchema = z.enum([
  "local",
  "synced",
  "pending_update",
  "pending_delete",
]);

export const BeanStatusSchema = z.enum([
  "RESTING",
  "ACTIVE",
  "ARCHIVED",
]);

export const BaseEntitySchema = z
  .object({
    id: z.string().uuid(),
    createdAt: z.number().int().nonnegative(),
    updatedAt: z.number().int().nonnegative(),
    deletedAt: z.number().int().nonnegative().nullable(),
    syncStatus: SyncStatusSchema,
  })
  .strict();

export const BeanSchema = BaseEntitySchema.extend({
  name: z.string().trim().min(1),
  origin: z.string().trim().min(1),
  roastLevel: z.string().trim().min(1),
  process: z.string().trim().min(1),
  notes: z.string().trim().min(1).nullable(),
  totalWeight: z.number().finite().nonnegative(),
  remainingWeight: z.number().finite().nonnegative(),
  status: BeanStatusSchema,
  roastDate: z.string().datetime({ offset: true }),
  peakDate: z.string().datetime({ offset: true }).optional(),
}).strict();

export const EquipmentSchema = BaseEntitySchema.extend({
  name: z.string().trim().min(1),
  type: z.string().trim().min(1),
  brand: z.string().trim().min(1).nullable(),
}).strict();

export const BrewLogSchema = BaseEntitySchema.extend({
  beanId: z.string().uuid(),
  equipmentId: z.string().uuid(),
  grinderId: z.string().uuid().nullable(),
  filterId: z.string().uuid().nullable(),
  dose: z.number().positive(),
  water: z.number().positive(),
  temperature: z.number().positive(),
  brewTime: z.number().int().positive(),
  grindSize: z.string().trim().min(1).nullable(),
  bloomTime: z.number().int().nonnegative().nullable(),
  acidity: z.number().int().min(1).max(5),
  sweetness: z.number().int().min(1).max(5),
  body: z.number().int().min(1).max(5),
  bitterness: z.number().int().min(1).max(5),
  feedback: z.string().trim().min(1).nullable(),
}).strict();

export const BeanInputSchema = z
  .object({
    name: z.string().trim().min(1),
    origin: z.string().trim().min(1),
    roastLevel: z.string().trim().min(1),
    process: z.string().trim().min(1),
    notes: z.string().trim().min(1).nullable().optional(),
    totalWeight: z.number().finite().nonnegative().optional(),
    remainingWeight: z.number().finite().nonnegative().optional(),
    status: BeanStatusSchema.optional(),
    roastDate: z.string().datetime({ offset: true }).optional(),
    peakDate: z.string().datetime({ offset: true }).optional(),
  })
  .strict();

export const EquipmentInputSchema = z
  .object({
    name: z.string().trim().min(1),
    type: z.string().trim().min(1),
    brand: z.string().trim().min(1).nullable().optional(),
  })
  .strict();

export const BrewLogInputSchema = z
  .object({
    beanId: z.string().uuid(),
    equipmentId: z.string().uuid(),
    grinderId: z.string().uuid().nullable().optional(),
    filterId: z.string().uuid().nullable().optional(),
    dose: z.number().positive(),
    water: z.number().positive(),
    temperature: z.number().positive(),
    brewTime: z.number().int().positive(),
    grindSize: z.string().trim().min(1).nullable().optional(),
    bloomTime: z.number().int().nonnegative().nullable().optional(),
    acidity: z.number().int().min(1).max(5),
    sweetness: z.number().int().min(1).max(5),
    body: z.number().int().min(1).max(5),
    bitterness: z.number().int().min(1).max(5),
    feedback: z.string().trim().min(1).nullable().optional(),
  })
  .strict();

export type SyncStatus = z.infer<typeof SyncStatusSchema>;
export type BeanStatus = z.infer<typeof BeanStatusSchema>;
export type BaseEntity = z.infer<typeof BaseEntitySchema>;
export type Bean = z.infer<typeof BeanSchema>;
export type Equipment = z.infer<typeof EquipmentSchema>;
export type BrewLog = z.infer<typeof BrewLogSchema>;
export type BeanInput = z.infer<typeof BeanInputSchema>;
export type EquipmentInput = z.infer<typeof EquipmentInputSchema>;
export type BrewLogInput = z.infer<typeof BrewLogInputSchema>;
