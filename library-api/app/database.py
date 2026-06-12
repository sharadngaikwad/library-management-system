import os
import sys
import time
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from logger_config import app_logger

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@db:5432/library")

engine = None
max_retries = 5
retry_delay_seconds = 2

app_logger.info("Initializing database engine connection pool...")

for attempt in range(1, max_retries + 1):
    try:
        # create_engine only instantiates the configuration dialect mapper
        temp_engine = create_engine(DATABASE_URL)
        
        # Real connection test: explicitly verify the database is up and accessible
        with temp_engine.connect() as connection:
            pass 
            
        engine = temp_engine
        app_logger.info("Successfully established connection to the database on attempt %d/%d.", attempt, max_retries)
        break
    except Exception as e:
        app_logger.warning(
            "Database connection attempt %d/%d failed. Retrying in %d seconds... Error: %s",
            attempt, max_retries, retry_delay_seconds, str(e)
        )
        time.sleep(retry_delay_seconds)

if not engine:
    app_logger.critical("Could not connect to the database after %d attempts. Shutting down application.", max_retries)
    sys.exit(1)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    app_logger.debug("Opening a new scoped database SessionLocal instance.")
    db = SessionLocal()
    try:
        yield db
    finally:
        app_logger.debug("Closing active database SessionLocal instance cleanly.")
        db.close()