DROP TABLE IF EXISTS credentials;
CREATE TABLE IF NOT EXISTS credentials (
    id INTEGER PRIMARY KEY DEFAULT 1,
    openid TEXT,
    refresh_token TEXT,
    access_token TEXT,
    expired_at INTEGER,
    musicid TEXT,
    musickey TEXT,
    unionid TEXT,
    str_musicid TEXT,
    refresh_key TEXT,
    encrypt_uin TEXT,
    login_type INTEGER DEFAULT 2,
    musickey_createtime INTEGER,
    key_expires_in INTEGER DEFAULT 259200,
    updated_at INTEGER,
    CHECK (id = 1)
);
INSERT OR IGNORE INTO credentials (id) VALUES (1);
