@echo off
echo Starting Migration Wrapper... > fix.log
node scripts/fix_db_schema.js >> fix.log 2>&1
echo Done. >> fix.log
type fix.log
