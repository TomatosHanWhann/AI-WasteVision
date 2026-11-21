import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";
export const members = sqliteTable("members", {
  id: text("id").primaryKey(),
  suffix: text("suffix").notNull(),
  createdAt: integer("created_at").notNull(),
});
export const sessions = sqliteTable(
  "card_sessions",
  {
    id: text("id").primaryKey(),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id),
    expiresAt: integer("expires_at").notNull(),
  },
  (t) => [index("sessions_expiry").on(t.expiresAt)],
);
export const events = sqliteTable(
  "sorting_events",
  {
    id: text("id").primaryKey(),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id),
    imageDigest: text("image_digest").notNull(),
    material: text("material").notNull(),
    condition: text("condition").notNull(),
    modelVersion: text("model_version").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("member_image_once").on(t.memberId, t.imageDigest),
    index("events_member_date").on(t.memberId, t.createdAt),
  ],
);
export const limits = sqliteTable("request_limits", {
  id: text("id").primaryKey(),
  count: integer("count").notNull(),
  expiresAt: integer("expires_at").notNull(),
});
