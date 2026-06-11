import sys
import os
import grpc
from concurrent import futures
from grpc_reflection.v1alpha import reflection

# Resolves the 'proto' folder path relative to the root execution context smoothly
proto_path = os.path.abspath(os.path.join(os.path.dirname(__file__), './proto'))
sys.path.append(proto_path)

import library_pb2
import library_pb2_grpc

from app.database import SessionLocal, Base, engine
from app.services import book_service, member_service, counter_service

Base.metadata.create_all(bind=engine)

class LibraryService(library_pb2_grpc.LibraryServiceServicer):
    # --- BOOK DOMAIN MAPS ---
    def ListBooks(self, request, context):
        with SessionLocal() as db: return book_service.get_all_books(db, request, context)
    def CreateBook(self, request, context):
        with SessionLocal() as db: return book_service.create_new_book(db, request, context)
    def UpdateBook(self, request, context):
        with SessionLocal() as db: return book_service.modify_book_record(db, request, context)

    # --- MEMBER DOMAIN MAPS ---
    def ListMembers(self, request, context):
        with SessionLocal() as db: return member_service.get_all_members(db, request, context)
    def CreateMember(self, request, context):
        with SessionLocal() as db: return member_service.create_new_member(db, request, context)
    def UpdateMember(self, request, context):
        with SessionLocal() as db: return member_service.modify_member_record(db, request, context)

    # --- COUNTER TRANSACTION MAPS ---
    def BorrowBook(self, request, context):
        with SessionLocal() as db: return counter_service.execute_borrow_transaction(db, request, context)
    def ReturnBook(self, request, context):
        with SessionLocal() as db: return counter_service.execute_return_transaction(db, request, context)
    def ListActiveLoans(self, request, context):
        with SessionLocal() as db: return counter_service.get_active_loans_list(db, request, context)

def serve():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    library_pb2_grpc.add_LibraryServiceServicer_to_server(LibraryService(), server)
    
    if os.getenv('APP_ENV', 'development') != 'production':
        SERVICE_NAMES = (library_pb2.DESCRIPTOR.services_by_name['LibraryService'].full_name, reflection.SERVICE_NAME)
        reflection.enable_server_reflection(SERVICE_NAMES, server)

    server.add_insecure_port('[::]:50051')
    print("Symmetric modular gRPC system operational and listening on port 50051...")
    server.start()
    server.wait_for_termination()

if __name__ == '__main__':
    serve()