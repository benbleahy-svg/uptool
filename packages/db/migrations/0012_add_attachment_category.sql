ALTER TABLE "attachments" ADD COLUMN "category" text DEFAULT 'other' NOT NULL;--> statement-breakpoint
UPDATE "attachments" SET "category" = CASE
  WHEN lower(substring("filename" FROM '\.([^.]+)$')) IN ('pdf', 'dwg', 'dxf') THEN 'drawing'
  WHEN lower(substring("filename" FROM '\.([^.]+)$')) IN ('step', 'stp', 'stl', 'iges', 'igs', 'x_t', 'sldprt', 'sldasm') THEN 'cad'
  WHEN lower(substring("filename" FROM '\.([^.]+)$')) IN ('xlsx', 'xls', 'csv') AND lower("filename") LIKE '%bom%' THEN 'bom'
  ELSE 'other'
END;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_category_check" CHECK ("attachments"."category" IN ('drawing', 'cad', 'bom', 'other'));
