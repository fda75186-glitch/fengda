-- Additive only: existing accounts, posts and media remain intact.
CREATE TABLE image_generations (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL, -- same account:<UUID> namespace as existing media/posts
  prompt TEXT NOT NULL,
  ratio TEXT NOT NULL,
  style TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  media_id TEXT NOT NULL DEFAULT '',
  mime TEXT NOT NULL DEFAULT '',
  error_code TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX image_generations_owner_time ON image_generations(owner,created_at DESC);
