-- Articles — contenu plateforme (blog & success stories), non scopé tenant.

CREATE TABLE "articles" (
  "id"            SERIAL PRIMARY KEY,
  "type"          VARCHAR(20)  NOT NULL DEFAULT 'blog',
  "title"         VARCHAR(200) NOT NULL,
  "slug"          VARCHAR(220) NOT NULL,
  "excerpt"       TEXT,
  "content"       TEXT         NOT NULL,
  "cover_url"     TEXT,
  "category"      VARCHAR(50),
  "author_name"   VARCHAR(100),
  "featured_name" VARCHAR(120),
  "status"        VARCHAR(20)  NOT NULL DEFAULT 'draft',
  "published_at"  TIMESTAMP(3),
  "created_by"    INTEGER,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "articles_slug_key"       ON "articles"("slug");
CREATE INDEX "idx_articles_type_status"       ON "articles"("type", "status");
CREATE INDEX "idx_articles_slug"              ON "articles"("slug");

ALTER TABLE "articles"
  ADD CONSTRAINT "articles_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
