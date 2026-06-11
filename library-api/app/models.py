from sqlalchemy import Column, Integer, String, ForeignKey, Date
from sqlalchemy.orm import relationship
from datetime import date, timedelta
from .database import Base

class Book(Base):
    __tablename__ = "books"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    author = Column(String, nullable=False)
    isbn = Column(String, unique=True, nullable=False)
    available_copies = Column(Integer, default=1)

class Member(Base):
    __tablename__ = "members"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    phone = Column(String)

class Operation(Base):
    __tablename__ = "operations"
    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("members.id", ondelete="RESTRICT"))
    book_id = Column(Integer, ForeignKey("books.id", ondelete="RESTRICT"))
    borrow_date = Column(Date, default=date.today)
    return_date = Column(Date, nullable=True)
    due_date = Column(Date, default=lambda: date.today() + timedelta(days=14))

    book = relationship("Book")
    member = relationship("Member")