// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const sessions=sqliteTable('sessions',{hash:text('hash').primaryKey(),createdAt:integer('created_at').notNull(),ipHash:text('ip_hash').notNull()});
export const posts=sqliteTable('posts',{id:text('id').primaryKey(),owner:text('owner').notNull(),author:text('author').notNull(),title:text('title').notNull(),content:text('content').notNull(),category:text('category').notNull(),target:text('target').notNull(),location:text('location').notNull(),images:text('images').notNull(),createdAt:integer('created_at').notNull()});
export const comments=sqliteTable('comments',{id:text('id').primaryKey(),postId:text('post_id').notNull(),owner:text('owner').notNull(),author:text('author').notNull(),content:text('content').notNull(),createdAt:integer('created_at').notNull()});
export const likes=sqliteTable('likes',{id:text('id').primaryKey(),postId:text('post_id').notNull(),owner:text('owner').notNull(),createdAt:integer('created_at').notNull()});
export const images=sqliteTable('images',{id:text('id').primaryKey(),owner:text('owner').notNull(),mime:text('mime').notNull(),bytes:integer('bytes').notNull(),createdAt:integer('created_at').notNull()});
export const events=sqliteTable('events',{id:integer('id').primaryKey({autoIncrement:true}),owner:text('owner').notNull(),createdAt:integer('created_at').notNull()});
