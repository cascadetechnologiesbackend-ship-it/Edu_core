// ─── Inventory Schema ─────────────────────────────────────────────────────────
import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  numeric,
  index,
} from "drizzle-orm/pg-core";
import { schools, users } from "./core";

export const assets = pgTable(
  "assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    assetCode: text("asset_code").notNull(),
    name: text("name").notNull(),
    category: text("category").notNull(), // FURNITURE, ELECTRONICS, LAB_EQUIPMENT, SPORTS
    description: text("description"),
    purchaseDate: timestamp("purchase_date", { withTimezone: true }),
    purchasePrice: numeric("purchase_price", { precision: 12, scale: 2 }),
    currentValue: numeric("current_value", { precision: 12, scale: 2 }),
    location: text("location"), // Room number or lab name
    condition: text("condition").notNull().default("GOOD"),
    qrCodeData: text("qr_code_data"),
    warrantyExpiryDate: timestamp("warranty_expiry_date", {
      withTimezone: true,
    }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    schoolIdx: index("assets_school_idx").on(t.schoolId),
  }),
);

export const assetAssignments = pgTable("asset_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  assetId: uuid("asset_id")
    .notNull()
    .references(() => assets.id, { onDelete: "restrict" }),
  schoolId: uuid("school_id")
    .notNull()
    .references(() => schools.id, { onDelete: "restrict" }),
  assignedToType: text("assigned_to_type").notNull(), // STAFF | ROOM
  assignedToId: uuid("assigned_to_id"), // staff_id or null for room
  roomNumber: text("room_number"),
  assignedById: uuid("assigned_by_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  assignedAt: timestamp("assigned_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  returnedAt: timestamp("returned_at", { withTimezone: true }),
  condition: text("condition"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const inventoryItems = pgTable(
  "inventory_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    category: text("category").notNull(), // STATIONERY, CONSUMABLE, CLEANING
    unit: text("unit").notNull(), // PCS, KG, REAM, BOX
    currentStock: integer("current_stock").notNull().default(0),
    minimumStockLevel: integer("minimum_stock_level").notNull().default(10),
    reorderPoint: integer("reorder_point").notNull().default(20),
    unitPrice: numeric("unit_price", { precision: 10, scale: 2 }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    schoolIdx: index("inventory_items_school_idx").on(t.schoolId),
  }),
);

export const purchaseOrders = pgTable("purchase_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id")
    .notNull()
    .references(() => schools.id, { onDelete: "restrict" }),
  poNumber: text("po_number").notNull(),
  vendorName: text("vendor_name").notNull(),
  orderDate: timestamp("order_date", { withTimezone: true }).notNull(),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }),
  status: text("status").notNull().default("PENDING"),
  createdById: uuid("created_by_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  approvedById: uuid("approved_by_id").references(() => users.id, {
    onDelete: "restrict",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const stockMovements = pgTable(
  "stock_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    inventoryItemId: uuid("inventory_item_id")
      .notNull()
      .references(() => inventoryItems.id, { onDelete: "restrict" }),
    movementType: text("movement_type").notNull(), // IN | OUT | ADJUSTMENT
    quantity: integer("quantity").notNull(),
    unitPrice: numeric("unit_price", { precision: 10, scale: 2 }),
    purchaseOrderId: uuid("purchase_order_id").references(
      () => purchaseOrders.id,
      { onDelete: "restrict" },
    ),
    reason: text("reason"),
    performedById: uuid("performed_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    itemIdx: index("stock_movements_item_idx").on(t.inventoryItemId),
    schoolIdx: index("stock_movements_school_idx").on(t.schoolId),
  }),
);
