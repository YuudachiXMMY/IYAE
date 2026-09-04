-- Add MATERIALIZED status to model_generation_tasks lifecycle
ALTER TABLE model_generation_tasks
  MODIFY COLUMN status ENUM('PENDING','RUNNING','READY','FAILED','MATERIALIZED') NOT NULL DEFAULT 'PENDING';
