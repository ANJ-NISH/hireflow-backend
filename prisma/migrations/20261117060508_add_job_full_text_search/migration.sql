-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "search_vector" tsvector;

-- CreateIndex
CREATE INDEX "jobs_search_vector_idx" ON "jobs" USING GIN ("search_vector");

-- Makes tech terms searchable in the forms people actually type. Used when building the
-- stored vectors AND when parsing the search text, so both sides always agree.
--   "Node.js"  -> "Node Nodejs"  (matches "node", "nodejs" and "node.js")
--   "C++"      -> "cpp"          "C#" -> "csharp"
--   "ASP.NET"  -> "ASP dotnet"   ".NET" -> "dotnet"
CREATE OR REPLACE FUNCTION search_normalize(input text) RETURNS text AS $$
  SELECT regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(coalesce(input, ''), '(\w+)\.js\y', '\1 \1js', 'gi'),
        'c\+\+', 'cpp', 'gi'),
      'c#', 'csharp', 'gi'),
    '\.net\y', ' dotnet', 'gi');
$$ LANGUAGE sql IMMUTABLE;

-- Rebuilds a job's search vector. Weights: A = title, B = skills and company, C = description.
CREATE OR REPLACE FUNCTION jobs_search_vector_update() RETURNS trigger AS $$
DECLARE
  company_name text;
BEGIN
  SELECT name INTO company_name FROM companies WHERE id = NEW."companyId";

  NEW.search_vector :=
    setweight(to_tsvector('english', search_normalize(NEW.title)), 'A') ||
    setweight(to_tsvector('english', search_normalize(array_to_string(NEW.skills, ' '))), 'B') ||
    setweight(to_tsvector('english', search_normalize(company_name)), 'B') ||
    setweight(to_tsvector('english', search_normalize(NEW.description)), 'C');

  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- Fires on insert, and on updates that actually touch a searchable column
CREATE TRIGGER jobs_search_vector_trigger
  BEFORE INSERT OR UPDATE OF title, description, skills, "companyId" ON jobs
  FOR EACH ROW EXECUTE FUNCTION jobs_search_vector_update();

-- When a company is renamed, rebuild the vectors of its jobs
CREATE OR REPLACE FUNCTION companies_name_changed() RETURNS trigger AS $$
BEGIN
  -- Touching "title" fires the jobs trigger above, which re-reads the new company name
  UPDATE jobs SET title = title WHERE "companyId" = NEW.id;
  RETURN NULL;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER companies_name_trigger
  AFTER UPDATE OF name ON companies
  FOR EACH ROW
  WHEN (OLD.name IS DISTINCT FROM NEW.name)
  EXECUTE FUNCTION companies_name_changed();

-- Backfill: touching "title" runs the trigger for every existing job
UPDATE jobs SET title = title;
