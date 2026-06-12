from logger_config import app_logger
import sys
import os
import grpc
from concurrent import futures
from grpc_reflection.v1alpha import reflection

# Resolves the 'proto' folder path relative to the root execution context smoothly
proto_path = os.path.abspath(os.path.join(os.path.dirname(__file__), './proto'))
sys.path.append(proto_path)
app_logger.info("Configured system search path for protobuf modules: %s", proto_path)

try:
    import library_pb2
    import library_pb2_grpc
    app_logger.debug("Successfully imported generated gRPC protobuf artifacts.")
except Exception as e:
    app_logger.critical("Failed to import protobuf dependencies. Checking path configurations. Error: %s", str(e), exc_info=True)
    sys.exit(1)

from app.database import SessionLocal, Base, engine
from app.services import book_service, member_service, counter_service

try:
    app_logger.info("Initializing engine schema metadata definitions...")
    Base.metadata.create_all(bind=engine)
    app_logger.info("Database schema state verified and sync successfully completed.")
except Exception as e:
    app_logger.critical("Database initialization failed during bootstrapping: %s", str(e), exc_info=True)
    sys.exit(1)


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
    max_workers = 10
    app_logger.info("Initializing gRPC Server Engine with a ThreadPool max_workers capacity of %d.", max_workers)
    
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=max_workers))
    library_pb2_grpc.add_LibraryServiceServicer_to_server(LibraryService(), server)
    
    env_state = os.getenv('APP_ENV', 'development')
    if env_state != 'production':
        app_logger.info("App Environment is configured as '%s'. Activating gRPC Server Reflection.", env_state)
        SERVICE_NAMES = (library_pb2.DESCRIPTOR.services_by_name['LibraryService'].full_name, reflection.SERVICE_NAME)
        reflection.enable_server_reflection(SERVICE_NAMES, server)
    else:
        app_logger.info("App Environment is running in production mode. Server Reflection remains disabled.")

    bind_address = '[::]:50051'
    try:
        server.add_insecure_port(bind_address)
        app_logger.info("Symmetric modular gRPC system operational and listening on target channel %s", bind_address)
        server.start()
    except Exception as e:
        app_logger.critical("Failed to bind gRPC server on address %s: %s", bind_address, str(e), exc_info=True)
        sys.exit(1)
        
    try:
        server.wait_for_termination()
    except KeyboardInterrupt:
        app_logger.info("SIGINT/KeyboardInterrupt detected. Intercepting teardown signal.")
    finally:
        app_logger.info("Shutting down gRPC engine cleanly...")
        server.stop(grace=5)
        app_logger.info("gRPC server terminated safely.")


if __name__ == '__main__':
    serve()