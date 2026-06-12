import pytest
from unittest.mock import MagicMock
import grpc
from app.services.counter_service import execute_borrow_transaction, execute_return_transaction, get_active_loans_list
from app import models
import library_pb2

def test_execute_borrow_transaction_success():
    db = MagicMock()
    request = MagicMock()
    request.member_id = 1
    request.book_id = 1
    context = MagicMock()
    
    mock_book = MagicMock()
    mock_book.id = 1
    mock_book.title = "Dune"
    mock_book.author = "Frank Herbert"
    mock_book.isbn = "9780441172719"
    
    mock_member = MagicMock()
    mock_member.id = 1
    mock_member.name = "John Doe"
    mock_member.email = "john@example.com"

    # 1. Member exists, 2. Book exists, 3. Active loan check is None (Safe to borrow)
    # 4. Book lookup post-commit, 5. Member lookup post-commit
    db.query.return_value.filter.return_value.first.side_effect = [
        mock_member,      # member_exists
        mock_book,        # book_exists
        None,             # active_loan check
        mock_book,        # book response mapping
        mock_member       # member response mapping
    ]
    
    # Atomic inventory subtraction checks out exactly 1 copy safely
    db.query.return_value.filter.return_value.update.return_value = 1
    
    def mock_db_add(obj):
        obj.id = 1
        obj.borrow_date = "2026-01-01"
        obj.due_date = "2026-01-15"
    db.add.side_effect = mock_db_add

    response = execute_borrow_transaction(db, request, context)
    
    db.add.assert_called_once()
    db.commit.assert_called_once()
    assert response.member_id == 1
    assert response.book_id == 1
    assert response.book.title == "Dune"

def test_execute_borrow_transaction_already_borrowed():
    db = MagicMock()
    request = MagicMock()
    request.member_id = 1
    request.book_id = 1
    context = MagicMock()
    context.abort.side_effect = grpc.RpcError()
    
    # Setup condition where active_loan check returns an existing unreturned record
    existing_loan = MagicMock(id=42, member_id=1, book_id=1)
    db.query.return_value.filter.return_value.first.side_effect = [
        MagicMock(id=1),  # member_exists
        MagicMock(id=1),  # book_exists
        existing_loan     # User already holds an unreturned copy!
    ]
    
    with pytest.raises(grpc.RpcError):
        execute_borrow_transaction(db, request, context)
    
    context.abort.assert_called_once_with(
        grpc.StatusCode.ALREADY_EXISTS,
        "Member possesses an unreturned active checkout copy"
    )

def test_execute_borrow_transaction_out_of_stock():
    db = MagicMock()
    request = MagicMock()
    request.member_id = 1
    request.book_id = 1
    context = MagicMock()
    context.abort.side_effect = grpc.RpcError()
    
    db.query.return_value.filter.return_value.first.side_effect = [
        MagicMock(id=1),
        MagicMock(id=1),
        None
    ]
    
    # Atomic decrement yields 0 rows because available_copies was already 0
    db.query.return_value.filter.return_value.update.return_value = 0
    
    with pytest.raises(grpc.RpcError):
        execute_borrow_transaction(db, request, context)
    
    context.abort.assert_called_once_with(
        grpc.StatusCode.FAILED_PRECONDITION,
        "This book catalog item is currently out of stock."
    )

def test_execute_return_transaction_success():
    db = MagicMock()
    request = MagicMock(member_id=1, book_id=1)
    context = MagicMock()
    
    # Active operations update affects exactly 1 active loan record
    db.query.return_value.filter.return_value.update.return_value = 1
    
    # Mock book entity states are well within legal bounds (2 copies out of 5 are available)
    mock_book = MagicMock()
    mock_book.id = 1
    mock_book.available_copies = 2
    mock_book.total_copies = 5
    
    db.query.return_value.filter.return_value.first.return_value = mock_book
    
    response = execute_return_transaction(db, request, context)
    
    db.commit.assert_called_once()
    assert response.message == "Book checked in and processed successfully."

def test_execute_return_transaction_not_borrowed_by_member():
    db = MagicMock()
    request = MagicMock()
    request.member_id = 1
    request.book_id = 1
    context = MagicMock()
    context.abort.side_effect = grpc.RpcError()
    
    # 0 records updated means no unreturned loan matches this member/book pair
    db.query.return_value.filter.return_value.update.return_value = 0
    
    with pytest.raises(grpc.RpcError):
        execute_return_transaction(db, request, context)
    
    context.abort.assert_called_once_with(
        grpc.StatusCode.NOT_FOUND,
        "No matching active loan operational record found for this member and book."
    )

def test_execute_return_transaction_overflow_protection():
    db = MagicMock()
    request = MagicMock()
    request.member_id = 1
    request.book_id = 1
    context = MagicMock()
    context.abort.side_effect = grpc.RpcError()
    
    # Update is successful
    db.query.return_value.filter.return_value.update.return_value = 1
    
    # Catching inventory mismatch: available copies cannot breach total tracked copies
    mock_book = MagicMock()
    mock_book.id = 1
    mock_book.available_copies = 5
    mock_book.total_copies = 5  # This increment would result in 6/5 copies, triggering an error
    
    db.query.return_value.filter.return_value.first.return_value = mock_book
    
    with pytest.raises(grpc.RpcError):
        execute_return_transaction(db, request, context)
    
    context.abort.assert_called_once_with(
        grpc.StatusCode.DATA_LOSS,
        "Database consistency exception: Checked stock values surpass full catalog metrics."
    )

def test_get_active_loans_list():
    db = MagicMock()
    request = MagicMock(member_id=1, page=1, page_size=10)
    context = MagicMock()
    
    query_mock = db.query.return_value.filter.return_value.filter.return_value
    query_mock.count.return_value = 1
    
    mock_op = MagicMock()
    mock_op.id = 1
    mock_op.member_id = 1
    mock_op.book_id = 1
    mock_op.borrow_date = "2026-01-01"
    mock_op.due_date = "2026-01-15"

    mock_book = MagicMock()
    mock_book.id = 1
    mock_book.title = "Dune"
    mock_book.author = "Frank Herbert"
    mock_book.isbn = "9780441172719"
    mock_op.book = mock_book

    mock_member = MagicMock()
    mock_member.id = 1
    mock_member.name = "John Doe"
    mock_member.email = "john@example.com"
    mock_op.member = mock_member
    
    query_mock.offset.return_value.limit.return_value.all.return_value = [mock_op]
    
    response = get_active_loans_list(db, request, context)
    
    assert response.total_records == 1
    assert len(response.loans) == 1
    assert response.loans[0].member_id == 1