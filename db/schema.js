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
export const feedback = sqliteTable(
  "analysis_feedback",
  {
    id: text("id").primaryKey(),
    modelVersion: text("model_version").notNull(),
    source: text("source").notNull(),
    imageKey: text("image_key"),
    imageDigest: text("image_digest").notNull(),
    items: text("items").notNull(),
    expectedCount: integer("expected_count").notNull(),
    predictedCount: integer("predicted_count").notNull(),
    userCorrect: integer("user_correct").notNull(),
    status: text("status").notNull().default("pending"),
    reviewedItems: text("reviewed_items"),
    reviewedCount: integer("reviewed_count"),
    deleteKey: text("delete_key").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("feedback_image_version").on(t.imageDigest, t.modelVersion),
    index("feedback_review_status").on(t.status),
  ],
);
