import grpc
from concurrent import futures
import sys
import os
from datetime import date
import grpc_tools.protoc

# Dynamic generation of proto definitions to ensure runtime correctness
import proto
proto_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../proto'))
sys.path.append(proto_path)

grpc_tools.protoc.main((
    '',
    f'-I{proto_path}',
    f'--python_out={proto_path}',
    f'--grpc_python_out={proto_path}',
    os.path.join(proto_path, 'library.proto')
))

import library_pb2
import library_pb2_grpc
from app.database import SessionLocal, Base, engine
from app import models

Base.metadata.create_all(bind=engine)

class LibraryService(library_pb2_grpc.LibraryServiceServicer):

    def CreateBook(self, request, context):
        db = SessionLocal()
        existing = db.query(models.Book).filter(models.Book.isbn == request.isbn).first()
        if existing:
            context.abort(grpc.StatusCode.ALREADY_EXISTS, "ISBN record already exists")
        
        book = models.Book(title=request.title, author=request.author, isbn=request.isbn, available_copies=request.available_copies)
        db.add(book)
        db.commit()
        return library_pb2.BookResponse(id=book.id, title=book.title, author=book.author, isbn=book.isbn, available_copies=book.available_copies)

    def UpdateBook(self, request, context):
        db = SessionLocal()
        book = db.query(models.Book).filter(models.Book.id == request.id).first()
        if not book:
            context.abort(grpc.StatusCode.NOT_FOUND, "Target book matching ID not found")
        
        book.title = request.title
        book.author = request.author
        book.isbn = request.isbn
        book.available_copies = request.available_copies
        db.commit()
        return library_pb2.BookResponse(id=book.id, title=book.title, author=book.author, isbn=book.isbn, available_copies=book.available_copies)

    def CreateMember(self, request, context):
        db = SessionLocal()
        existing = db.query(models.Member).filter(models.Member.email == request.email).first()
        if existing:
            context.abort(grpc.StatusCode.ALREADY_EXISTS, "Email matching member already registered")
            
        member = models.Member(name=request.name, email=request.email, phone=request.phone)
        db.add(member)
        db.commit()
        return library_pb2.MemberResponse(id=member.id, name=member.name, email=member.email, phone=member.phone)

    def BorrowBook(self, request, context):
        db = SessionLocal()
        book = db.query(models.Book).filter(models.Book.id == request.book_id).first()
        member = db.query(models.Member).filter(models.Member.id == request.member_id).first()

        if not book or not member:
            context.abort(grpc.StatusCode.NOT_FOUND, "Entity dependencies not found")
        if book.available_copies < 1:
            context.abort(grpc.StatusCode.FAILED_PRECONDITION, "Inventory copies exhausted for checkout")

        active_loan = db.query(models.Operation).filter(
            models.Operation.member_id == request.member_id,
            models.Operation.book_id == request.book_id,
            models.Operation.return_date == None
        ).first()
        if active_loan:
            context.abort(grpc.StatusCode.ALREADY_EXISTS, "Member possesses an unreturned active checkout copy")

        book.available_copies -= 1
        op = models.Operation(member_id=request.member_id, book_id=request.book_id)
        db.add(op)
        db.commit()

        return library_pb2.OperationResponse(
            id=op.id, member_id=op.member_id, book_id=op.book_id,
            borrow_date=str(op.borrow_date), due_date=str(op.due_date),
            book=library_pb2.BookResponse(id=book.id, title=book.title, author=book.author, isbn=book.isbn),
            member=library_pb2.MemberResponse(id=member.id, name=member.name, email=member.email)
        )

    def ReturnBook(self, request, context):
        db = SessionLocal()
        op = db.query(models.Operation).filter(
            models.Operation.member_id == request.member_id,
            models.Operation.book_id == request.book_id,
            models.Operation.return_date == None
        ).first()

        if not op:
            context.abort(grpc.StatusCode.NOT_FOUND, "No matching active loan operational record found")

        op.return_date = date.today()
        book = db.query(models.Book).filter(models.Book.id == request.book_id).first()
        if book:
            book.available_copies += 1
        db.commit()
        return library_pb2.ReturnResponse(message="Book checked in and processed successfully.")

    def ListActiveLoans(self, request, context):
        db = SessionLocal()
        query = db.query(models.Operation).filter(models.Operation.return_date == None)
        if request.member_id > 0:
            query = query.filter(models.Operation.member_id == request.member_id)
        
        results = query.all()
        protobuf_list = []
        for op in results:
            protobuf_list.append(library_pb2.OperationResponse(
                id=op.id, member_id=op.member_id, book_id=op.book_id,
                borrow_date=str(op.borrow_date), due_date=str(op.due_date),
                book=library_pb2.BookResponse(id=op.book.id, title=op.book.title, author=op.book.author, isbn=op.book.isbn),
                member=library_pb2.MemberResponse(id=op.member.id, name=op.member.name, email=op.member.email)
            ))
        return library_pb2.ListLoansResponse(loans=protobuf_list)

def serve():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    library_pb2_grpc.add_library_ServiceServicer_to_server(LibraryService(), server)
    server.add_insecure_port('[::]:50051')
    print("gRPC service initialized on port 50051...")
    server.start()
    server.wait_for_termination()

if __name__ == '__main__':
    serve()