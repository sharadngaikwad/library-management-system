import grpc
from app import models
import library_pb2

def get_all_books(db, request, context):
    results = db.query(models.Book).order_by(
        models.Book.title.asc(), 
        models.Book.author.asc(), 
        models.Book.id.asc()
    ).all()
    
    protobuf_list = [
        library_pb2.BookResponse(
            id=b.id, 
            title=b.title, 
            author=b.author, 
            isbn=b.isbn, 
            total_copies=b.total_copies, 
            available_copies=b.available_copies
        ) for b in results
    ]
    return library_pb2.ListBooksResponse(books=protobuf_list)

def create_new_book(db, request, context):
    existing = db.query(models.Book).filter(models.Book.isbn == request.isbn).first()
    if existing:
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
    return library_pb2.BookResponse(
        id=book.id, 
        title=book.title, 
        author=book.author, 
        isbn=book.isbn, 
        total_copies=book.total_copies, 
        available_copies=book.available_copies
    )

def modify_book_record(db, request, context):
    # 1. Fetch the existing book state from the database
    book = db.query(models.Book).filter(models.Book.id == request.id).first()
    if not book:
        context.abort(grpc.StatusCode.NOT_FOUND, "Target book matching ID not found")
    
    # 2. Calculate how many copies are actively borrowed right now
    currently_borrowed = book.total_copies - book.available_copies

    # 3. Guard against reducing total copies below the active loan threshold
    if request.total_copies < currently_borrowed:
        context.abort(
            grpc.StatusCode.FAILED_PRECONDITION, 
            f"Cannot reduce total copies to {request.total_copies}. "
            f"There are currently {currently_borrowed} copies checked out by members."
        )

    # 4. Compute the new available shelf stock dynamically
    new_available_copies = request.total_copies - currently_borrowed

    book.title = request.title
    book.author = request.author
    book.isbn = request.isbn
    book.total_copies = request.total_copies
    book.available_copies = new_available_copies
    
    db.commit()
    
    return library_pb2.BookResponse(
        id=book.id,
        title=book.title,
        author=book.author,
        isbn=book.isbn,
        total_copies=book.total_copies,
        available_copies=book.available_copies
    )