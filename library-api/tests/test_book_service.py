import pytest
from unittest.mock import MagicMock
import grpc
from app.services.book_service import is_valid_isbn, get_all_books, create_new_book, modify_book_record
from app import models
import library_pb2

def test_is_valid_isbn():
    # Valid ISBN entries (Correct lengths and matching checksum equations)
    assert is_valid_isbn("0061120081") is True        # Clean ISBN-10
    assert is_valid_isbn("0-316-76917-7") is True     # Hyphenated ISBN-10
    assert is_valid_isbn("080442957X") is True        # Alphanumeric check 'X'
    assert is_valid_isbn("9780451524935") is True     # Clean ISBN-13
    assert is_valid_isbn("978-0-14-143951-8") is True  # Hyphenated ISBN-13

    # Invalid structural or check-digit anomalies (Should return False)
    assert is_valid_isbn("9780141439519") is False    # Invalid ISBN-13 Checksum
    assert is_valid_isbn("0061120085") is False       # Invalid ISBN-10 Checksum
    assert is_valid_isbn("invalid-text") is False     # Plaintext garbage sequence
    assert is_valid_isbn("") is False                 # Empty input sequence

def test_get_all_books_success():
    db = MagicMock()
    request = MagicMock(page=1, page_size=10)
    context = MagicMock()
    
    query_mock = db.query.return_value
    query_mock.count.return_value = 1
    query_mock.order_by.return_value.limit.return_value.offset.return_value.all.return_value = [
        models.Book(id=1, title="1984", author="George Orwell", isbn="9780451524935", total_copies=3, available_copies=3)
    ]
    
    response = get_all_books(db, request, context)
    assert response.total_records == 1
    assert len(response.books) == 1
    assert response.books[0].title == "1984"

def test_get_all_books_invalid_pagination():
    db = MagicMock()
    request = MagicMock(page=-1, page_size=-1)
    context = MagicMock()
    
    get_all_books(db, request, context)
    context.abort.assert_called_once_with(
        grpc.StatusCode.INVALID_ARGUMENT,
        "Pagination page indices and size metrics must be positive integers."
    )

def test_create_new_book_success():
    db = MagicMock()
    request = MagicMock(title="Dune", author="Frank Herbert", isbn="9780441172719", total_copies=5)
    context = MagicMock()
    
    db.query.return_value.filter.return_value.first.return_value = None
    
    response = create_new_book(db, request, context)
    
    db.add.assert_called_once()
    db.commit.assert_called_once()
    assert response.title == "Dune"
    assert response.total_copies == 5
    assert response.available_copies == 5

def test_create_new_book_missing_fields():
    db = MagicMock()
    request = MagicMock()
    request.title = ""
    request.author = ""
    request.isbn = ""
    request.total_copies = 5
    context = MagicMock()
    context.abort.side_effect = grpc.RpcError()
    
    with pytest.raises(grpc.RpcError):
        create_new_book(db, request, context)
        
    context.abort.assert_called_once_with(
        grpc.StatusCode.INVALID_ARGUMENT,
        "Title, Author, and ISBN elements are mandatory fields."
    )

def test_create_new_book_invalid_isbn_checksum():
    db = MagicMock()
    request = MagicMock()
    request.title = "Dune"
    request.author = "Frank Herbert"
    request.isbn = "978-0141439519"
    request.total_copies = 5
    context = MagicMock()
    context.abort.side_effect = grpc.RpcError()
    
    with pytest.raises(grpc.RpcError):
        create_new_book(db, request, context)
        
    context.abort.assert_called_once_with(
        grpc.StatusCode.INVALID_ARGUMENT,
        "The provided value is not a valid ISBN-10 or ISBN-13 catalog sequence."
    )

def test_modify_book_record_success():
    db = MagicMock()
    request = MagicMock(id=1, title="Dune Revised", author="Frank Herbert", isbn="9780441172719", total_copies=10)
    context = MagicMock()
    
    mock_book = models.Book(id=1, title="Dune", author="Frank Herbert", isbn="9780441172719", total_copies=5, available_copies=3)
    
    query_mock = db.query.return_value
    filter_mock = query_mock.filter.return_value
    filter_mock.first.side_effect = [mock_book, None]
    
    response = modify_book_record(db, request, context)
    
    db.commit.assert_called_once()
    assert mock_book.title == "Dune Revised"
    assert mock_book.total_copies == 10
    # Calculations check: 5 total - 3 available = 2 active loans outstanding. 10 target - 2 = 8 available shelf assets.
    assert mock_book.available_copies == 8
    assert response.available_copies == 8

def test_modify_book_record_invalid_isbn_checksum():
    db = MagicMock()
    request = MagicMock()
    request.id = 1
    request.title = "Dune Revised"
    request.author = "Frank Herbert"
    request.isbn = "bad-format-isbn"
    request.total_copies = 10
    context = MagicMock()
    context.abort.side_effect = grpc.RpcError()
    
    with pytest.raises(grpc.RpcError):
        modify_book_record(db, request, context)
        
    context.abort.assert_called_once_with(
        grpc.StatusCode.INVALID_ARGUMENT,
        "The updated string is not a valid ISBN-10 or ISBN-13 target identifier."
    )

def test_modify_book_record_reduce_copies_error():
    db = MagicMock()
    request = MagicMock(id=1, title="Dune", author="Frank Herbert", isbn="9780441172719", total_copies=1)
    context = MagicMock()
    
    # Configuration setup: 5 total, 2 available -> 3 active outstanding checkouts deployed
    mock_book = models.Book(id=1, title="Dune", author="Frank Herbert", isbn="9780441172719", total_copies=5, available_copies=2)
    
    query_mock = db.query.return_value
    filter_mock = query_mock.filter.return_value
    filter_mock.first.side_effect = [mock_book, None]
    
    modify_book_record(db, request, context)
    
    context.abort.assert_called_once()
    args, _ = context.abort.call_args
    assert args[0] == grpc.StatusCode.FAILED_PRECONDITION
    assert "Cannot reduce total copies to 1" in args[1]