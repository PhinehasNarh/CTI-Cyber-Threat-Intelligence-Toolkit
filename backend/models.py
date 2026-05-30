import datetime
from sqlalchemy import String, Text, DateTime, Integer, Float, Boolean, func, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from database import Base


class FeedArticle(Base):
    """RSS/news feed articles from security blogs and advisories."""
    __tablename__ = "feed_articles"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(500))
    url: Mapped[str] = mapped_column(String(1000), unique=True, index=True)
    source: Mapped[str] = mapped_column(String(100), index=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    published: Mapped[datetime.datetime | None] = mapped_column(DateTime, nullable=True)
    fetched_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, server_default=func.now()
    )
    categories: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    is_starred: Mapped[bool] = mapped_column(Boolean, default=False)
    relevance_score: Mapped[float] = mapped_column(Float, default=50.0)
    attack_tags: Mapped[str | None] = mapped_column(String(200), nullable=True)
    analyst_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    analyst_tags: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # Triage & assignment (#23)
    assignee: Mapped[str | None] = mapped_column(String(100), nullable=True)
    triage_status: Mapped[str] = mapped_column(String(20), default="new")  # new/in_review/resolved/false_positive
    # Multi-tenant (#34)
    workspace_id: Mapped[int] = mapped_column(Integer, default=1, index=True)


class IOC(Base):
    """Indicators of Compromise — hashes, IPs, domains, URLs."""
    __tablename__ = "iocs"

    id: Mapped[int] = mapped_column(primary_key=True)
    ioc_type: Mapped[str] = mapped_column(String(20), index=True)  # hash, ip, domain, url
    value: Mapped[str] = mapped_column(String(1000), unique=True, index=True)
    source: Mapped[str] = mapped_column(String(100))  # malwarebazaar, urlhaus, manual, etc.
    threat_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    malware_family: Mapped[str | None] = mapped_column(String(100), nullable=True)
    confidence: Mapped[int] = mapped_column(Integer, default=50)  # 0-100
    first_seen: Mapped[datetime.datetime] = mapped_column(
        DateTime, server_default=func.now()
    )
    last_seen: Mapped[datetime.datetime] = mapped_column(
        DateTime, server_default=func.now()
    )
    tags: Mapped[str | None] = mapped_column(String(500), nullable=True)
    raw_data: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON blob for enrichment
    # Scoring (#6)
    threat_score: Mapped[float] = mapped_column(Float, default=0.0)
    score_breakdown: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON
    # Dedup merging (#32)
    seen_count: Mapped[int] = mapped_column(Integer, default=1)
    sources: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON array
    attack_tags: Mapped[str | None] = mapped_column(String(200), nullable=True)
    analyst_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    analyst_tags: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # Triage & assignment (#23)
    assignee: Mapped[str | None] = mapped_column(String(100), nullable=True)
    triage_status: Mapped[str] = mapped_column(String(20), default="new")  # new/in_review/resolved/false_positive
    # Multi-tenant (#34)
    workspace_id: Mapped[int] = mapped_column(Integer, default=1, index=True)


class CVE(Base):
    """Tracked CVE vulnerabilities."""
    __tablename__ = "cves"

    id: Mapped[int] = mapped_column(primary_key=True)
    cve_id: Mapped[str] = mapped_column(String(20), unique=True, index=True)  # CVE-2024-XXXX
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    cvss_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    severity: Mapped[str | None] = mapped_column(String(20), nullable=True)  # CRITICAL, HIGH, MEDIUM, LOW
    affected_products: Mapped[str | None] = mapped_column(Text, nullable=True)
    published_date: Mapped[datetime.datetime | None] = mapped_column(DateTime, nullable=True)
    in_cisa_kev: Mapped[bool] = mapped_column(Boolean, default=False)
    has_exploit: Mapped[bool] = mapped_column(Boolean, default=False)
    references: Mapped[str | None] = mapped_column(Text, nullable=True)
    fetched_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, server_default=func.now()
    )


class Watchlist(Base):
    """Analyst-defined asset watchlist — alerts when a matching IOC is ingested."""
    __tablename__ = "watchlist"

    id: Mapped[int] = mapped_column(primary_key=True)
    pattern: Mapped[str] = mapped_column(String(1000), unique=True, index=True)
    label: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, server_default=func.now()
    )
    hit_count: Mapped[int] = mapped_column(Integer, default=0)


class WatchlistHit(Base):
    """Records each time an ingested IOC matched a watchlist entry."""
    __tablename__ = "watchlist_hits"

    id: Mapped[int] = mapped_column(primary_key=True)
    watchlist_id: Mapped[int] = mapped_column(Integer, ForeignKey("watchlist.id", ondelete="CASCADE"), index=True)
    ioc_id: Mapped[int] = mapped_column(Integer, ForeignKey("iocs.id", ondelete="CASCADE"), index=True)
    ioc_value: Mapped[str] = mapped_column(String(1000))
    ioc_type: Mapped[str] = mapped_column(String(20))
    source: Mapped[str] = mapped_column(String(100))
    hit_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now())


class AlertRule(Base):
    """Analyst-defined rule that fires when a new IOC matches its conditions."""
    __tablename__ = "alert_rules"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    conditions: Mapped[str] = mapped_column(Text)          # JSON: {ioc_types, sources, keywords, min_confidence, min_score}
    severity: Mapped[str] = mapped_column(String(20), default="medium")  # critical/high/medium/low
    action: Mapped[str | None] = mapped_column(Text, nullable=True)      # JSON: {webhook_url}
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    hit_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now())


class AlertHit(Base):
    """A single rule firing event."""
    __tablename__ = "alert_hits"

    id: Mapped[int] = mapped_column(primary_key=True)
    rule_id: Mapped[int] = mapped_column(Integer, ForeignKey("alert_rules.id", ondelete="CASCADE"), index=True)
    ioc_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("iocs.id", ondelete="SET NULL"), nullable=True, index=True)
    ioc_value: Mapped[str] = mapped_column(String(1000))
    ioc_type: Mapped[str] = mapped_column(String(20))
    severity: Mapped[str] = mapped_column(String(20))
    notified: Mapped[bool] = mapped_column(Boolean, default=False)
    hit_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now())


class ThreatActor(Base):
    """Known threat actor profile."""
    __tablename__ = "threat_actors"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    aliases: Mapped[str | None] = mapped_column(Text, nullable=True)         # JSON array of strings
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    origin_country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    motivation: Mapped[str | None] = mapped_column(String(200), nullable=True)  # espionage, financial, hacktivism, ...
    first_seen: Mapped[datetime.datetime | None] = mapped_column(DateTime, nullable=True)
    last_seen: Mapped[datetime.datetime | None] = mapped_column(DateTime, nullable=True)
    confidence: Mapped[int] = mapped_column(Integer, default=50)
    attack_tags: Mapped[str | None] = mapped_column(String(500), nullable=True)  # comma-separated ATT&CK IDs
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now())


class Campaign(Base):
    """A named threat campaign grouping related IOCs and articles."""
    __tablename__ = "campaigns"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    start_date: Mapped[datetime.datetime | None] = mapped_column(DateTime, nullable=True)
    end_date: Mapped[datetime.datetime | None] = mapped_column(DateTime, nullable=True)
    confidence: Mapped[int] = mapped_column(Integer, default=50)
    status: Mapped[str] = mapped_column(String(20), default="active")   # active/closed/suspected
    threat_actor: Mapped[str | None] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now())


class CampaignIOC(Base):
    """Junction: Campaign ↔ IOC."""
    __tablename__ = "campaign_iocs"

    campaign_id: Mapped[int] = mapped_column(Integer, ForeignKey("campaigns.id", ondelete="CASCADE"), primary_key=True)
    ioc_id: Mapped[int] = mapped_column(Integer, ForeignKey("iocs.id", ondelete="CASCADE"), primary_key=True)
    added_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now())


class CampaignArticle(Base):
    """Junction: Campaign ↔ FeedArticle."""
    __tablename__ = "campaign_articles"

    campaign_id: Mapped[int] = mapped_column(Integer, ForeignKey("campaigns.id", ondelete="CASCADE"), primary_key=True)
    article_id: Mapped[int] = mapped_column(Integer, ForeignKey("feed_articles.id", ondelete="CASCADE"), primary_key=True)
    added_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now())


class FeedSchedule(Base):
    """Per-feed polling configuration: interval, priority, enabled state (#15)."""
    __tablename__ = "feed_schedules"

    id: Mapped[int] = mapped_column(primary_key=True)
    source_name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    feed_type: Mapped[str] = mapped_column(String(10))            # rss | ioc
    feed_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    interval_minutes: Mapped[int] = mapped_column(Integer, default=30)
    priority: Mapped[int] = mapped_column(Integer, default=5)      # lower = higher priority
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    last_polled: Mapped[datetime.datetime | None] = mapped_column(DateTime, nullable=True)
    last_count: Mapped[int] = mapped_column(Integer, default=0)


class ApiKey(Base):
    """API key for the public REST API and inbound webhook sink (#26, #27)."""
    __tablename__ = "api_keys"

    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    scopes: Mapped[str] = mapped_column(String(200), default="read")  # comma-separated: read, ingest
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    request_count: Mapped[int] = mapped_column(Integer, default=0)
    last_used: Mapped[datetime.datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now())


class WatchedAsset(Base):
    """An IP asset pinned for Shodan InternetDB monitoring (#12)."""
    __tablename__ = "watched_assets"

    id: Mapped[int] = mapped_column(primary_key=True)
    ip: Mapped[str] = mapped_column(String(45), unique=True, index=True)
    label: Mapped[str | None] = mapped_column(String(200), nullable=True)
    last_ports: Mapped[str | None] = mapped_column(Text, nullable=True)   # JSON array of ints
    last_checked: Mapped[datetime.datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now())


class Workspace(Base):
    """A tenant workspace for segregating IOC/article data by team (#34)."""
    __tablename__ = "workspaces"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now())


class RetentionPolicy(Base):
    """Per-entity/source data retention rule (#33). Rows older than max_age_days
    are purged when the policy is active (manually or by the scheduled sweep)."""
    __tablename__ = "retention_policies"

    id: Mapped[int] = mapped_column(primary_key=True)
    entity_type: Mapped[str] = mapped_column(String(20), index=True)   # article | ioc
    source: Mapped[str | None] = mapped_column(String(100), nullable=True)  # None = all sources
    max_age_days: Mapped[int] = mapped_column(Integer, default=90)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    last_run: Mapped[datetime.datetime | None] = mapped_column(DateTime, nullable=True)
    last_purged: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now())


class AuditLog(Base):
    """Append-only record of analyst actions for compliance and decision history (#25)."""
    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(primary_key=True)
    action: Mapped[str] = mapped_column(String(50), index=True)        # create, update, delete, dismiss, ...
    entity_type: Mapped[str] = mapped_column(String(50), index=True)   # actor, campaign, alert_rule, ioc, ...
    entity_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    summary: Mapped[str] = mapped_column(String(500))                  # human-readable description
    actor: Mapped[str] = mapped_column(String(100), default="analyst")
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now(), index=True)
