-- revisi alembic: 433a9f697a02
-- sumber: migrations/versions/433a9f697a02_add_process_monitoring.py
ALTER TABLE hardware_monitor ADD COLUMN active_window VARCHAR(255);
