import datetime
from sqlalchemy import String, Text, DateTime, Integer, Float, Boolean, func
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
    categories: Mapped[str | None] = mapped_column(String(500), nullable=True)  # comma-separated tags
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    is_starred: Mapped[bool] = mapped_column(Boolean, default=False)
    relevance_score: Mapped[float] = mapped_column(Float, default=50.0)


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
