import pytest
import os
import sys

# Ensure the root directory is on the Python path so gRPC generated modules (library_pb2) can be found
root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../'))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)
    
app_dir = os.path.join(root_dir, 'app')
if app_dir not in sys.path:
    sys.path.insert(0, app_dir)

# 1. Force a dummy environment variable before the main app loads
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base  # Adjust this import path to match where your SQLAlchemy 'Base' lives

@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    """
    Creates an isolated, empty in-memory SQLite database structure 
    for the duration of the testing session.
    """
    # Create an engine pointing to RAM instead of a physical network host
    engine = create_engine(
        "sqlite:///:memory:", 
        connect_args={"check_same_thread": False}
    )
    
    # Bind the engine to your SQLAlchemy models to build the tables
    Base.metadata.create_all(bind=engine)
    
    yield
    
    # Clean up completely after tests finish running
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def db_session():
    """
    Provides a clean, wrapped database session for every individual test function,
    rolling back transactions automatically so tests don't pollute each other.
    """
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()