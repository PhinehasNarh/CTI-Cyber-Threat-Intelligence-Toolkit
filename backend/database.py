from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from config import get_settings

settings = get_settings()

engine = create_async_engine(settings.database_url, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def _migrate(conn):
    """Add new columns to existing tables without dropping data."""
    new_columns = [
        ("iocs", "threat_score", "REAL DEFAULT 0.0 NOT NULL"),
        ("iocs", "score_breakdown", "TEXT"),
        ("iocs", "seen_count", "INTEGER DEFAULT 1 NOT NULL"),
        ("iocs", "sources", "TEXT"),
        ("iocs", "attack_tags", "TEXT"),
        ("feed_articles", "attack_tags", "TEXT"),
        ("feed_articles", "analyst_notes", "TEXT"),
        ("feed_articles", "analyst_tags", "TEXT"),
        ("iocs", "analyst_notes", "TEXT"),
        ("iocs", "analyst_tags", "TEXT"),
        ("iocs", "assignee", "TEXT"),
        ("iocs", "triage_status", "TEXT DEFAULT 'new' NOT NULL"),
        ("feed_articles", "assignee", "TEXT"),
        ("feed_articles", "triage_status", "TEXT DEFAULT 'new' NOT NULL"),
        ("iocs", "workspace_id", "INTEGER DEFAULT 1 NOT NULL"),
        ("feed_articles", "workspace_id", "INTEGER DEFAULT 1 NOT NULL"),
    ]
    for table, col, definition in new_columns:
        try:
            await conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {definition}"))
        except Exception:
            pass  # column already exists


async def _init_fts(conn):
    """Create FTS5 virtual table and sync triggers for IOC full-text search."""
    await conn.execute(text("""
        CREATE VIRTUAL TABLE IF NOT EXISTS iocs_fts USING fts5(
            value, threat_type, malware_family, tags,
            content=iocs, content_rowid=id
        )
    """))
    await conn.execute(text("""
        CREATE TRIGGER IF NOT EXISTS iocs_fts_ai AFTER INSERT ON iocs BEGIN
            INSERT INTO iocs_fts(rowid, value, threat_type, malware_family, tags)
            VALUES (new.id, new.value, new.threat_type, new.malware_family, new.tags);
        END
    """))
    await conn.execute(text("""
        CREATE TRIGGER IF NOT EXISTS iocs_fts_ad AFTER DELETE ON iocs BEGIN
            INSERT INTO iocs_fts(iocs_fts, rowid, value, threat_type, malware_family, tags)
            VALUES ('delete', old.id, old.value, old.threat_type, old.malware_family, old.tags);
        END
    """))
    await conn.execute(text("""
        CREATE TRIGGER IF NOT EXISTS iocs_fts_au AFTER UPDATE ON iocs BEGIN
            INSERT INTO iocs_fts(iocs_fts, rowid, value, threat_type, malware_family, tags)
            VALUES ('delete', old.id, old.value, old.threat_type, old.malware_family, old.tags);
            INSERT INTO iocs_fts(rowid, value, threat_type, malware_family, tags)
            VALUES (new.id, new.value, new.threat_type, new.malware_family, new.tags);
        END
    """))
    # Populate index for any rows that existed before FTS was set up
    await conn.execute(text("INSERT INTO iocs_fts(iocs_fts) VALUES ('rebuild')"))


async def _seed_default_workspace(conn):
    """Ensure the Default workspace (id=1) exists so legacy data has a home (#34)."""
    await conn.execute(text(
        "INSERT OR IGNORE INTO workspaces (id, name, slug, description) "
        "VALUES (1, 'Default', 'default', 'Default workspace, holds all feed-ingested data')"
    ))


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await _migrate(conn)
        await _init_fts(conn)
        await _seed_default_workspace(conn)


async def get_db():
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
