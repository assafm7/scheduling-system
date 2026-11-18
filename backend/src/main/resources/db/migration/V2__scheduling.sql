CREATE TABLE scheduling
(
    id          UUID          NOT NULL PRIMARY KEY,
    name        VARCHAR(100)  NOT NULL,
    description VARCHAR(500),
    task_key    VARCHAR(50)   NOT NULL,
    parameters  TEXT          NOT NULL DEFAULT '{}',
    schedule    TEXT          NOT NULL,
    enabled     BOOLEAN       NOT NULL DEFAULT TRUE,
    version     BIGINT        NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ   NOT NULL,
    updated_at  TIMESTAMPTZ   NOT NULL
);

CREATE INDEX idx_scheduling_created_at ON scheduling (created_at DESC);
