# Preorder Import Runbook

## Before Import

1. Confirm preorders are closed in TakeApp.
2. Export the final CSV.
3. Save the CSV path.
4. Confirm `C:\Projects\sachi-sips\.env.local` contains `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
5. Apply `supabase/migrations/015_add_preorder_workflow.sql` before running the final import.

## Preview

Load environment variables from `.env.local`, then run:

```powershell
$envFile='C:\Projects\sachi-sips\.env.local'
Get-Content $envFile | ForEach-Object {
  if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
    [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), 'Process')
  }
}
node scripts\import-takeapp-preorders.mjs --csv="C:\path\to\final.csv" --mode=preview
```

Confirm:

- row count matches the CSV.
- grouped order count matches the number of distinct customer orders.
- no unmapped products.
- no malformed times.
- totals reconcile.
- duplicate visible TakeApp numbers are represented as separate orders when customer/created-at data differs.

## Import

Run:

```powershell
node scripts\import-takeapp-preorders.mjs --csv="C:\path\to\final.csv" --mode=import
```

The importer refuses duplicate already-imported preorder keys. If it fails, fix the CSV/mapping issue and rerun preview before importing.

## Smoke Test

1. Open `/preorders`.
2. Confirm full-day grouping by pickup slot.
3. Confirm unreleased preorders do not appear on stations.
4. Confirm released preorders appear 30 minutes before pickup.
5. Mark stations ready.
6. Mark collected from `/preorders`.
7. Confirm receipts/dashboard include the completed preorder with the TakeApp label.
