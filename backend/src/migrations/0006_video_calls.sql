CREATE TABLE IF NOT EXISTS video_calls(
    id VARCHAR(100) PRIMARY KEY,
    caller_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    caller_name VARCHAR(255),
    recipient_name VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'calling',
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_calls_caller_recipient
    ON video_calls (caller_id, recipient_id);

CREATE INDEX IF NOT EXISTS idx_video_calls_created_at
    ON video_calls (created_at DESC);
