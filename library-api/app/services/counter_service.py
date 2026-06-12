from datetime import date
import grpc
from app import models
import library_pb2

def execute_borrow_transaction(db, request, context):
    # Existence Validation Layer
    member_exists = db.query(models.Member.id).filter(models.Member.id == request.member_id).first()
    book_exists = db.query(models.Book.id).filter(models.Book.id == request.book_id).first()
    if not book_exists or not member_exists:
        context.abort(grpc.StatusCode.NOT_FOUND, "Entity dependencies not found")

    # Double-Borrow Prevention Check
    active_loan = db.query(models.Operation.id).filter(
        models.Operation.member_id == request.member_id,
        models.Operation.book_id == request.book_id,
        models.Operation.return_date == None
    ).first()
    if active_loan:
        context.abort(grpc.StatusCode.ALREADY_EXISTS, "Member possesses an unreturned active checkout copy")

    # ATOMIC DECREMENT ENGINE LAYER (Approach B Strategy)
    updated_rows = db.query(models.Book).filter(
        models.Book.id == request.book_id,
        models.Book.available_copies >= 1
    ).update(
        {models.Book.available_copies: models.Book.available_copies - 1},
        synchronize_session=False
    )

    if updated_rows == 0:
        context.abort(grpc.StatusCode.FAILED_PRECONDITION, "Inventory copies exhausted for checkout")

    # Insert historical log record
    op = models.Operation(member_id=request.member_id, book_id=request.book_id)
    db.add(op)
    db.commit()

    # Hydrate references cleanly back up for mapping serialization
    book = db.query(models.Book).filter(models.Book.id == request.book_id).first()
    member = db.query(models.Member).filter(models.Member.id == request.member_id).first()

    return library_pb2.OperationResponse(
        id=op.id, member_id=op.member_id, book_id=op.book_id,
        borrow_date=str(op.borrow_date), due_date=str(op.due_date),
        book=library_pb2.BookResponse(id=book.id, title=book.title, author=book.author, isbn=book.isbn),
        member=library_pb2.MemberResponse(id=member.id, name=member.name, email=member.email)
    )

def execute_return_transaction(db, request, context):
    # ATOMIC UPDATE LEDGER (Blocks multi-click operations gracefully)
    updated_operations = db.query(models.Operation).filter(
        models.Operation.member_id == request.member_id,
        models.Operation.book_id == request.book_id,
        models.Operation.return_date == None
    ).update(
        {models.Operation.return_date: date.today()},
        synchronize_session=False
    )

    if updated_operations == 0:
        context.abort(grpc.StatusCode.NOT_FOUND, "No matching active loan operational record found")

    # ATOMIC STOCK INCREMENT
    db.query(models.Book).filter(models.Book.id == request.book_id).update(
        {models.Book.available_copies: models.Book.available_copies + 1},
        synchronize_session=False
    )

    db.commit()
    return library_pb2.ReturnResponse(message="Book checked in and processed successfully.")

def get_active_loans_list(db, request, context):
    # Base filtering parameters layout config mapping
    query = db.query(models.Operation).filter(models.Operation.return_date == None)
    
    if request.member_id > 0:
        query = query.filter(models.Operation.member_id == request.member_id)
        
    # 1. Compute aggregate matches count before slicing the result window
    total_records = query.count()
    
    # 2. Extract, sanitize, and validate incoming pagination inputs
    page = max(1, request.page)
    page_size = request.page_size if request.page_size > 0 else 10
    offset_value = (page - 1) * page_size
    
    # 3. Pull sliced record segment window
    results = query.offset(offset_value).limit(page_size).all()
    
    protobuf_list = [
        library_pb2.OperationResponse(
            id=op.id, member_id=op.member_id, book_id=op.book_id,
            borrow_date=str(op.borrow_date), due_date=str(op.due_date),
            book=library_pb2.BookResponse(id=op.book.id, title=op.book.title, author=op.book.author, isbn=op.book.isbn),
            member=library_pb2.MemberResponse(id=op.member.id, name=op.member.name, email=op.member.email)
        ) for op in results
    ]
    
    # 4. Return both the data array slice and overall count tracker
    return library_pb2.ListLoansResponse(
        loans=protobuf_list,
        total_records=total_records
    )