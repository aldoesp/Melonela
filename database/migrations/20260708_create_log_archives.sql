CREATE TABLE IF NOT EXISTS log_archives (
    id SERIAL PRIMARY KEY,

    host_name VARCHAR(100) NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    week INTEGER NOT NULL,
    day INTEGER NOT NULL,

    process_name VARCHAR(100) NOT NULL,
    source_type VARCHAR(80),

    date_start TIMESTAMP WITH TIME ZONE NOT NULL,
    date_end TIMESTAMP WITH TIME ZONE NOT NULL,

    file_path TEXT NOT NULL,
    compression VARCHAR(20) NOT NULL DEFAULT 'zstd',

    log_count INTEGER DEFAULT 0,
    size_bytes BIGINT DEFAULT 0,
    checksum VARCHAR(128),

    archive_status VARCHAR(30) NOT NULL DEFAULT 'available',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_log_archives_lookup
ON log_archives(host_name, process_name, year, month, day);

CREATE INDEX IF NOT EXISTS idx_log_archives_date_range
ON log_archives(date_start, date_end);

CREATE INDEX IF NOT EXISTS idx_log_archives_status
ON log_archives(archive_status);

CREATE INDEX IF NOT EXISTS idx_log_archives_host_process_date
ON log_archives(host_name, process_name, date_start, date_end);
