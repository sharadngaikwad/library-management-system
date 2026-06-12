import re
from logger_config import app_logger
import grpc
from app import models
import library_pb2

def is_valid_isbn(isbn_str: str) -> bool:
    """
    Validates both ISBN-10 and ISBN-13 structural format and checksums.
    Accepts raw sequences or strings containing hyphens/spaces.
    """
    # 1. Strip hyphens and spaces to isolate the core alphanumeric block
    clean_isbn = re.sub(r'[- ]', '', isbn_str).upper()
    
    # 2. Validate ISBN-10
    if len(clean_isbn) == 10 and re.match(r'^\d{9}[\dX]$', clean_isbn):
        total = 0
        for i in range(9):
            total += int(clean_isbn[i]) * (10 - i)
        last_char = clean_isbn[9]
        total += 10 if last_char == 'X' else int(last_char)
        return total % 11 == 0
        
    # 3. Validate ISBN-13
    if len(clean_isbn) == 13 and re.match(r'^\d{13}$', clean_isbn):
        total = 0
        for i in range(13):
            weight = 1 if i % 2 == 0 else 3
            total += int(clean_isbn[i]) * weight
        return total % 10 == 0

    return False

def get_all_books(db, request, context):
    app_logger.info(
        "Received get_all_books request. Conditional Pagination parameters -> Page: %s, Page Size: %s", 
        request.page, request.page_size
    )
    
    if request.page < 0 or request.page_size < 0:
        app_logger.warning("Invalid pagination parameters passed: Page=%d, PageSize=%d", request.page, request.page_size)
        context.abort(grpc.StatusCode.INVALID_ARGUMENT, "Pagination page indices and size metrics must be positive integers.")
    
    try:
        total_records = db.query(models.Book).count()
        query = db.query(models.Book).order_by(models.Book.id.asc())
        
        if request.page > 0 and request.page_size > 0:
            offset_value = (request.page - 1) * request.page_size
            app_logger.debug("Applying pagination window. Offset: %d, Limit: %d", offset_value, request.page_size)
            query = query.limit(request.page_size).offset(offset_value)
        else:
            app_logger.debug("No valid pagination parameters provided. Fetching full collection.")
        
        books = query.all()
        
        proto_books = []
        for b in books:
            proto_books.append(library_pb2.BookResponse(
                id=b.id, title=b.title, author=b.author, isbn=b.isbn,
                total_copies=b.total_copies, available_copies=b.available_copies
            ))
            
        app_logger.info("Successfully fetched %d books out of %d total database records.", len(proto_books), total_records)
            
        return library_pb2.ListBooksResponse(books=proto_books, total_records=total_records)
        
    except Exception as e:
        app_logger.error("Failed to query books catalog: %s", str(e), exc_info=True)
        context.abort(grpc.StatusCode.INTERNAL, "Internal server error occurred while retrieving books catalog.")

def create_new_book(db, request, context):
    app_logger.info("Received create_new_book request. Title: '%s', ISBN: %s", request.title, request.isbn)
    
    title_clean = request.title.strip() if request.title else ""
    author_clean = request.author.strip() if request.author else ""
    isbn_clean = request.isbn.strip() if request.isbn else ""

    # 1. Structural Field Presence Verification
    if not title_clean or not author_clean or not isbn_clean:
        app_logger.warning("Book creation rejected: Missing mandatory text fields.")
        context.abort(grpc.StatusCode.INVALID_ARGUMENT, "Title, Author, and ISBN elements are mandatory fields.")

    # 2. ISBN Format & Checksum Integrity Validation
    if not is_valid_isbn(isbn_clean):
        app_logger.warning("Book creation rejected. Invalid ISBN checksum or sequence format: '%s'", isbn_clean)
        context.abort(grpc.StatusCode.INVALID_ARGUMENT, "The provided value is not a valid ISBN-10 or ISBN-13 catalog sequence.")

    if request.total_copies < 1:
        app_logger.warning("Book creation rejected: Invalid initial capacity requested (%d).", request.total_copies)
        context.abort(grpc.StatusCode.INVALID_ARGUMENT, "Initial catalog inventory allocations must equal or exceed 1 copy.")

    try:
        # Normalize structural hyphens/spaces away for standard DB lookup tracking stability if preferred, 
        # or preserve raw clean string if matching literal frontend formatting expectations.
        existing = db.query(models.Book).filter(models.Book.isbn == isbn_clean).first()
        if existing:
            app_logger.warning("Book creation rejected. ISBN already exists: %s", isbn_clean)
            context.abort(grpc.StatusCode.ALREADY_EXISTS, f"ISBN record '{isbn_clean}' already exists within this library platform database.")
        
        book = models.Book(
            title=title_clean, author=author_clean, isbn=isbn_clean, 
            total_copies=request.total_copies, available_copies=request.total_copies 
        )
        db.add(book)
        db.commit()
        
        app_logger.info("Successfully cataloged new book. Assigned ID: %s, ISBN: %s", book.id, book.isbn)
        return library_pb2.BookResponse(
            id=book.id, title=book.title, author=book.author, isbn=book.isbn,
            total_copies=book.total_copies, available_copies=book.available_copies
        )
        
    except Exception as e:
        db.rollback()
        app_logger.error("Failed to save new book record for ISBN %s: %s", request.isbn, str(e), exc_info=True)
        raise

def modify_book_record(db, request, context):
    app_logger.info("Received modify_book_record request for Book ID: %s", request.id)
    
    title_clean = request.title.strip() if request.title else ""
    author_clean = request.author.strip() if request.author else ""
    isbn_clean = request.isbn.strip() if request.isbn else ""

    if not title_clean or not author_clean or not isbn_clean:
        app_logger.warning("Book modification rejected for ID %s: Missing string arguments.", request.id)
        context.abort(grpc.StatusCode.INVALID_ARGUMENT, "Updated structural parameters must contain text values.")

    # ISBN Format & Checksum Integrity Validation during modification path
    if not is_valid_isbn(isbn_clean):
        app_logger.warning("Book modification rejected for ID %s. Invalid ISBN format: '%s'", request.id, isbn_clean)
        context.abort(grpc.StatusCode.INVALID_ARGUMENT, "The updated string is not a valid ISBN-10 or ISBN-13 target identifier.")

    if request.total_copies < 0:
        app_logger.warning("Book modification rejected for ID %s: Negative inventory total given.", request.id)
        context.abort(grpc.StatusCode.INVALID_ARGUMENT, "Total collection target allocations cannot drop below 0.")

    try:
        book = db.query(models.Book).filter(models.Book.id == request.id).first()
        if not book:
            app_logger.warning("Book modification rejected. Book ID not found: %s", request.id)
            context.abort(grpc.StatusCode.NOT_FOUND, "Target book matching ID not found")
        
        duplicate_isbn = db.query(models.Book).filter(
            models.Book.isbn == isbn_clean, models.Book.id != request.id
        ).first()
        if duplicate_isbn:
            app_logger.warning("Book modification rejected. Target ISBN %s clashes with record ID %s", isbn_clean, duplicate_isbn.id)
            context.abort(grpc.StatusCode.ALREADY_EXISTS, "Another catalog entry already maps to this ISBN sequence.")

        currently_borrowed = book.total_copies - book.available_copies

        if request.total_copies < currently_borrowed:
            app_logger.warning(
                "Book %s modification rejected. Target total_copies (%d) is lower than active outstanding checkouts (%d).",
                request.id, request.total_copies, currently_borrowed
            )
            context.abort(
                grpc.StatusCode.FAILED_PRECONDITION, 
                f"Cannot reduce total copies to {request.total_copies}. "
                f"There are currently {currently_borrowed} copies checked out by members."
            )

        new_available_copies = request.total_copies - currently_borrowed

        app_logger.debug(
            "Recalculating inventory for Book ID %s. Prior Available: %d -> New Available: %d (Active Loans: %d)",
            book.id, book.available_copies, new_available_copies, currently_borrowed
        )

        book.title = title_clean
        book.author = author_clean
        book.isbn = isbn_clean
        book.total_copies = request.total_copies
        book.available_copies = new_available_copies
        
        db.commit()
        app_logger.info("Successfully updated inventory ledger for Book ID: %s", book.id)
        
        return library_pb2.BookResponse(
            id=book.id, title=book.title, author=book.author, isbn=book.isbn,
            total_copies=book.total_copies, available_copies=book.available_copies
        )
        
    except Exception as e:
        db.rollback()
        app_logger.error("Failed to apply book updates for Book ID %s: %s", request.id, str(e), exc_info=True)
        raise