from datetime import date
from logger_config import app_logger
import grpc
from app import models
import library_pb2

def execute_borrow_transaction(db, request, context):
    app_logger.info(
        "Initiating borrow transaction. Member ID: %s, Book ID: %s", 
        request.member_id, request.book_id
    )
    
    # 1. Structural ID Type Validations
    if request.member_id <= 0 or request.book_id <= 0:
        app_logger.warning("Borrow rejected. Invalid numeric identifiers passed: Member ID=%s, Book ID=%s", request.member_id, request.book_id)
        context.abort(grpc.StatusCode.INVALID_ARGUMENT, "Identifiers for Member ID and Book ID must be valid positive integers.")
    
    try:
        # 2. Existence Validation Layer
        member_exists = db.query(models.Member.id).filter(models.Member.id == request.member_id).first()
        book_exists = db.query(models.Book.id).filter(models.Book.id == request.book_id).first()
        
        if not book_exists or not member_exists:
            app_logger.warning(
                "Borrow failed. Entity dependencies missing. Book Exists: %s, Member Exists: %s", 
                bool(book_exists), bool(member_exists)
            )
            context.abort(grpc.StatusCode.NOT_FOUND, "The requested Member or Book record does not exist.")

        # 3. Double-Borrow Prevention Check
        active_loan = db.query(models.Operation.id).filter(
            models.Operation.member_id == request.member_id,
            models.Operation.book_id == request.book_id,
            models.Operation.return_date == None
        ).first()
        
        if active_loan:
            app_logger.warning(
                "Borrow rejected. Member %s already has an active loan for book %s", 
                request.member_id, request.book_id
            )
            context.abort(grpc.StatusCode.ALREADY_EXISTS, "Member possesses an unreturned active checkout copy")

        # 4. ATOMIC DECREMENT ENGINE LAYER (Approach B Strategy)
        app_logger.debug("Attempting atomic stock decrement for Book ID: %s", request.book_id)
        updated_rows = db.query(models.Book).filter(
            models.Book.id == request.book_id,
            models.Book.available_copies >= 1
        ).update(
            {models.Book.available_copies: models.Book.available_copies - 1},
            synchronize_session=False
        )

        if updated_rows == 0:
            app_logger.warning("Borrow rejected. Inventory copies exhausted for Book ID: %s", request.book_id)
            context.abort(grpc.StatusCode.FAILED_PRECONDITION, "This book catalog item is currently out of stock.")

        # Insert historical log record
        op = models.Operation(member_id=request.member_id, book_id=request.book_id)
        db.add(op)
        db.commit()
        
        app_logger.info(
            "Successfully completed borrow transaction. Operation ID: %s, Member ID: %s, Book ID: %s", 
            op.id, request.member_id, request.book_id
        )

        # Hydrate references cleanly back up for mapping serialization
        book = db.query(models.Book).filter(models.Book.id == request.book_id).first()
        member = db.query(models.Member).filter(models.Member.id == request.member_id).first()

        return library_pb2.OperationResponse(
            id=op.id, member_id=op.member_id, book_id=op.book_id,
            borrow_date=str(op.borrow_date), due_date=str(op.due_date),
            book=library_pb2.BookResponse(id=book.id, title=book.title, author=book.author, isbn=book.isbn),
            member=library_pb2.MemberResponse(id=member.id, name=member.name, email=member.email)
        )
        
    except Exception as e:
        db.rollback()
        app_logger.error(
            "Transaction rollback during borrow execution for Member %s, Book %s. Error: %s", 
            request.member_id, request.book_id, str(e), exc_info=True
        )
        raise

def execute_return_transaction(db, request, context):
    app_logger.info(
        "Initiating return transaction. Member ID: %s, Book ID: %s", 
        request.member_id, request.book_id
    )
    
    # 1. Structural ID Type Validations
    if request.member_id <= 0 or request.book_id <= 0:
        app_logger.warning("Return rejected. Invalid numeric identifiers passed: Member ID=%s, Book ID=%s", request.member_id, request.book_id)
        context.abort(grpc.StatusCode.INVALID_ARGUMENT, "Identifiers for Member ID and Book ID must be valid positive integers.")
    
    try:
        # 2. ATOMIC UPDATE LEDGER (Blocks multi-click operations gracefully)
        updated_operations = db.query(models.Operation).filter(
            models.Operation.member_id == request.member_id,
            models.Operation.book_id == request.book_id,
            models.Operation.return_date == None
        ).update(
            {models.Operation.return_date: date.today()},
            synchronize_session=False
        )

        if updated_operations == 0:
            app_logger.warning(
                "Return failed. No active loan record found for Member ID: %s, Book ID: %s", 
                request.member_id, request.book_id
            )
            context.abort(grpc.StatusCode.NOT_FOUND, "No matching active loan operational record found for this member and book.")

        # 3. ATOMIC STOCK INCREMENT & MAXIMUM CAPACITY DATA INTEGRITY GUARD
        # Fetch book properties to safeguard database against illegal surplus stock generation
        book = db.query(models.Book).filter(models.Book.id == request.book_id).first()
        if book and book.available_copies >= book.total_copies:
            app_logger.error(
                "Critical Anomalous Data Discrepancy! Book ID %s available stock (%d) equals or exceeds total registered capacity (%d). Aborting step.",
                book.id, book.available_copies, book.total_copies
            )
            context.abort(grpc.StatusCode.DATA_LOSS, "Database consistency exception: Checked stock values surpass full catalog metrics.")

        app_logger.debug("Incrementing available copies for Book ID: %s", request.book_id)
        db.query(models.Book).filter(models.Book.id == request.book_id).update(
            {models.Book.available_copies: models.Book.available_copies + 1},
            synchronize_session=False
        )

        db.commit()
        app_logger.info(
            "Successfully returned Book ID: %s from Member ID: %s", 
            request.book_id, request.member_id
        )
        
        return library_pb2.ReturnResponse(message="Book checked in and processed successfully.")
        
    except Exception as e:
        db.rollback()
        app_logger.error(
            "Transaction rollback during return execution for Member %s, Book %s. Error: %s", 
            request.member_id, request.book_id, str(e), exc_info=True
        )
        raise

def get_active_loans_list(db, request, context):
    app_logger.info(
        "Fetching active loans list. Requested Member ID Filter: %s, Page: %s, Page Size: %s", 
        request.member_id if request.member_id > 0 else "None", request.page, request.page_size
    )
    
    # 1. Structural Pagination Type Validations
    if request.page < 0 or request.page_size < 0:
        app_logger.warning("Invalid pagination criteria: Page=%s, Page Size=%s", request.page, request.page_size)
        context.abort(grpc.StatusCode.INVALID_ARGUMENT, "Pagination indices and frame boundaries must be non-negative values.")
    
    try:
        # Base filtering parameters layout config mapping
        query = db.query(models.Operation).filter(models.Operation.return_date == None)
        
        if request.member_id > 0:
            query = query.filter(models.Operation.member_id == request.member_id)
            
        # 2. Compute aggregate matches count before slicing the result window
        total_records = query.count()
        
        # 3. Extract, sanitize, and validate incoming pagination inputs
        page = max(1, request.page)
        page_size = request.page_size if request.page_size > 0 else 10
        offset_value = (page - 1) * page_size
        
        app_logger.debug("Executing paginated query window. Offset: %d, Limit: %d", offset_value, page_size)
        
        # 4. Pull sliced record segment window
        results = query.offset(offset_value).limit(page_size).all()
        
        protobuf_list = [
            library_pb2.OperationResponse(
                id=op.id, member_id=op.member_id, book_id=op.book_id,
                borrow_date=str(op.borrow_date), due_date=str(op.due_date),
                book=library_pb2.BookResponse(id=op.book.id, title=op.book.title, author=op.book.author, isbn=op.book.isbn),
                member=library_pb2.MemberResponse(id=op.member.id, name=op.member.name, email=op.member.email)
            ) for op in results
        ]
        
        app_logger.info(
            "Active loans retrieval complete. Returned %d records out of %d total matches.", 
            len(protobuf_list), total_records
        )
        
        return library_pb2.ListLoansResponse(
            loans=protobuf_list,
            total_records=total_records
        )
        
    except Exception as e:
        app_logger.error("Failed to query active loans list: %s", str(e), exc_info=True)
        context.abort(grpc.StatusCode.INTERNAL, "Internal server error occurred while retrieving active loans.")