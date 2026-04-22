import os
import json
import re
import uuid6
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import FastAPI, Query, Request, Response
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, String, Float, Integer, DateTime, Index, desc, asc
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./insighta.db")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Profile(Base):
    __tablename__ = "profiles"
    id = Column(String, primary_key=True, default=lambda: str(uuid6.uuid7()))
    name = Column(String, unique=True, index=True, nullable=False)
    gender = Column(String, index=True)
    gender_probability = Column(Float)
    age = Column(Integer, index=True)
    age_group = Column(String, index=True)
    country_id = Column(String(2), index=True)
    country_name = Column(String)
    country_probability = Column(Float)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

Index('ix_query_optimization', Profile.gender, Profile.age, Profile.country_id)

Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def parse_natural_query(q: str):
    q = q.lower().strip()
    filters = {}

    if re.search(r'\bmales?\b', q):
        filters['gender'] = 'male'
    elif re.search(r'\bfemales?\b', q):
        filters['gender'] = 'female'

    for group in ['child', 'teenager', 'adult', 'senior']:
        if group in q: filters['age_group'] = group

    if 'young' in q:
        filters['min_age'] = 16
        filters['max_age'] = 24

    above_match = re.search(r'(?:above|older than|over|greater than)\s+(\d+)', q)
    if above_match: filters['min_age'] = int(above_match.group(1)) + 1

    under_match = re.search(r'(?:under|younger than|below|less than)\s+(\d+)', q)
    if under_match: filters['max_age'] = int(under_match.group(1)) - 1

    countries = {"nigeria": "NG", "kenya": "KE", "angola": "AO", "ghana": "GH", "benin": "BJ"}
    for name, cid in countries.items():
        if name in q:
            filters['country_id'] = cid
            break

    return filters

@app.on_event("startup")
async def seed_db():
    db = SessionLocal()
    try:
        if db.query(Profile).count() == 0:
            if os.path.exists("profiles.json"):
                with open("profiles.json", "r") as f:
                    data = json.load(f)

                if isinstance(data, dict):
                    data = data.get("data", data.get("records", []))

                if isinstance(data, list) and len(data) > 0:
                    valid_data = [item for item in data if isinstance(item, dict)]
                    db.bulk_insert_mappings(Profile, valid_data)
                    db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()

@app.get("/api/profiles")
async def get_profiles(
        gender: Optional[str] = None,
        age_group: Optional[str] = None,
        country_id: Optional[str] = None,
        min_age: Optional[int] = None,
        max_age: Optional[int] = None,
        min_gender_probability: Optional[float] = None,
        min_country_probability: Optional[float] = None,
        sort_by: str = "created_at",
        order: str = "desc",
        page: int = Query(1, ge=1),
        limit: int = Query(10, ge=1, le=50)
):
    db = SessionLocal()
    query = db.query(Profile)

    if gender: query = query.filter(Profile.gender == gender.lower())
    if age_group: query = query.filter(Profile.age_group == age_group.lower())
    if country_id: query = query.filter(Profile.country_id == country_id.upper())
    if min_age is not None: query = query.filter(Profile.age >= min_age)
    if max_age is not None: query = query.filter(Profile.age <= max_age)
    if min_gender_probability: query = query.filter(Profile.gender_probability >= min_gender_probability)
    if min_country_probability: query = query.filter(Profile.country_probability >= min_country_probability)

    sort_column = getattr(Profile, sort_by, Profile.created_at)
    query = query.order_by(desc(sort_column) if order == "desc" else asc(sort_column))

    total = query.count()
    results = query.offset((page - 1) * limit).limit(limit).all()
    db.close()

    return {
        "status": "success",
        "page": page,
        "limit": limit,
        "total": total,
        "data": results
    }

@app.get("/api/profiles/search")
async def search_profiles(q: str = Query(...), page: int = 1, limit: int = 10):
    if not q or not q.strip():
        return JSONResponse(status_code=400, content={"status": "error", "message": "Missing or empty parameter"})

    filters = parse_natural_query(q)
    if not filters:
        return JSONResponse(status_code=200, content={"status": "error", "message": "Unable to interpret query"})

    return await get_profiles(**filters, page=page, limit=limit)