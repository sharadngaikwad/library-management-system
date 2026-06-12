from logger_config import app_logger
import grpc
from app import models
import library_pb2

def get_all_books(db, request, context):
    app_logger.info(
        "Received get_all_books request. Conditional Pagination parameters -> Page: %s, Page Size: %s", 
        request.page, request.page_size
    )
    
    try:
        # 1. Always query the total count first so the frontend knows how many pages exist
        total_records = db.query(models.Book).count()
        
        # 2. Build the base query
        query = db.query(models.Book).order_by(models.Book.id.asc())
        
        # 3. Apply Pagination conditionally if parameters are provided
        if request.page > 0 and request.page_size > 0:
            offset_value = (request.page - 1) * request.page_size
            app_logger.debug("Applying pagination window. Offset: %d, Limit: %d", offset_value, request.page_size)
            query = query.limit(request.page_size).offset(offset_value)
        else:
            app_logger.debug("No valid pagination parameters provided. Fetching full collection.")
        
        books = query.all()
        
        # 4. Map to protobuf structure
        proto_books = []
        for b in books:
            proto_books.append(library_pb2.BookResponse(
                id=b.id,
                title=b.title,
                author=b.author,
                isbn=b.isbn,
                total_copies=b.total_copies,
                available_copies=b.available_copies
            ))
            
        app_logger.info("Successfully fetched %d books out of %d total database records.", len(proto_books), total_records)
            
        return library_pb2.ListBooksResponse(
            books=proto_books,
            total_records=total_records
        )
        
    except Exception as e:
        app_logger.error("Failed to query books catalog: %s", str(e), exc_info=True)
        context.abort(grpc.StatusCode.INTERNAL, "Internal server error occurred while retrieving books catalog.")

def create_new_book(db, request, context):
    app_logger.info("Received create_new_book request. Title: '%s', ISBN: %s", request.title, request.isbn)
    
    try:
        existing = db.query(models.Book).filter(models.Book.isbn == request.isbn).first()
        if existing:
            app_logger.warning("Book creation rejected. ISBN already exists: %s", request.isbn)
            context.abort(grpc.StatusCode.ALREADY_EXISTS, "ISBN record already exists")
        
        book = models.Book(
            title=request.title, 
            author=request.author, 
            isbn=request.isbn, 
            total_copies=request.total_copies, 
            available_copies=request.available_copies
        )
        db.add(book)
        db.commit()
        
        app_logger.info("Successfully cataloged new book. Assigned ID: %s, ISBN: %s", book.id, book.isbn)
        
        return library_pb2.BookResponse(
            id=book.id, 
            title=book.title, 
            author=book.author, 
            isbn=book.isbn, 
            total_copies=book.total_copies, 
            available_copies=book.available_copies
        )
        
    except Exception as e:
        db.rollback()
        app_logger.error("Failed to save new book record for ISBN %s: %s", request.isbn, str(e), exc_info=True)
        raise

def modify_book_record(db, request, context):
    app_logger.info("Received modify_book_record request for Book ID: %s", request.id)
    
    try:
        # 1. Fetch the existing book state from the database
        book = db.query(models.Book).filter(models.Book.id == request.id).first()
        if not book:
            app_logger.warning("Book modification rejected. Book ID not found: %s", request.id)
            context.abort(grpc.StatusCode.NOT_FOUND, "Target book matching ID not found")
        
        # 2. Calculate how many copies are actively borrowed right now
        currently_borrowed = book.total_copies - book.available_copies

        # 3. Guard against reducing total copies below the active loan threshold
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

        # 4. Compute the new available shelf stock dynamically
        new_available_copies = request.total_copies - currently_borrowed

        app_logger.debug(
            "Recalculating inventory for Book ID %s. Prior Available: %d -> New Available: %d (Active Loans: %d)",
            book.id, book.available_copies, new_available_copies, currently_borrowed
        )

        book.title = request.title
        book.author = request.author
        book.isbn = request.isbn
        book.total_copies = request.total_copies
        book.available_copies = new_available_copies
        
        db.commit()
        app_logger.info("Successfully updated inventory ledger for Book ID: %s", book.id)
        
        return library_pb2.BookResponse(
            id=book.id,
            title=book.title,
            author=book.author,
            isbn=book.isbn,
            total_copies=book.total_copies,
            available_copies=book.available_copies
        )
        
    except Exception as e:
        db.rollback()
        app_logger.error("Failed to apply book updates for Book ID %s: %s", request.id, str(e), exc_info=True)
        raise