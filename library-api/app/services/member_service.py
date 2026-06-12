from logger_config import app_logger
import grpc
from app import models
import library_pb2

def get_all_members(db, request, context):
    app_logger.info("Received get_all_members request. Page: %s, Page Size: %s", request.page, request.page_size)
    
    # 1. Extract and sanitize incoming pagination values (providing safe defaults)
    page = max(1, request.page)
    page_size = request.page_size if request.page_size > 0 else 10
    
    try:
        # 2. Get total records count before slicing for relative sliding UI blocks
        total_records = db.query(models.Member).count()
        
        # 3. Calculate database cursor offset point
        offset_value = (page - 1) * page_size
        
        app_logger.debug("Fetching member records window. Offset: %d, Limit: %d", offset_value, page_size)
        
        # 4. Fetch the paginated subset window from the database
        results = (
            db.query(models.Member)
            .order_by(models.Member.name.asc(), models.Member.id.asc())
            .offset(offset_value)
            .limit(page_size)
            .all()
        )
        
        # 5. Build and map your response collection protobuf array
        protobuf_list = [
            library_pb2.MemberResponse(
                id=m.id, name=m.name, email=m.email, phone=m.phone or ""
            ) for m in results
        ]
        
        app_logger.info("Successfully retrieved %d members out of %d total records", len(protobuf_list), total_records)
        
        # 6. Return response payload containing data slice and total counter tracking marker
        return library_pb2.ListMembersResponse(
            members=protobuf_list,
            total_records=total_records
        )
        
    except Exception as e:
        app_logger.error("Failed to fetch members list: %s", str(e), exc_info=True)
        context.abort(grpc.StatusCode.INTERNAL, "Internal server error occurred while fetching members.")

def create_new_member(db, request, context):
    app_logger.info("Received create_new_member request for email: %s", request.email)
    
    try:
        existing = db.query(models.Member).filter(models.Member.email == request.email).first()
        if existing:
            app_logger.warning("Member creation rejected. Email already exists: %s", request.email)
            context.abort(grpc.StatusCode.ALREADY_EXISTS, "Email matching member already registered")
            
        member = models.Member(name=request.name, email=request.email, phone=request.phone)
        db.add(member)
        db.commit()
        
        app_logger.info("Successfully created new member with ID: %s", member.id)
        return library_pb2.MemberResponse(id=member.id, name=member.name, email=member.email, phone=member.phone or "")
        
    except Exception as e:
        db.rollback()
        app_logger.error("Failed to create member for email %s: %s", request.email, str(e), exc_info=True)
        raise

def modify_member_record(db, request, context):
    app_logger.info("Received modify_member_record request for Member ID: %s", request.id)
    
    try:
        member = db.query(models.Member).filter(models.Member.id == request.id).first()
        if not member:
            app_logger.warning("Member modification failed. Target ID not found: %s", request.id)
            context.abort(grpc.StatusCode.NOT_FOUND, "Target member matching ID not found")
        
        if request.email != member.email:
            if db.query(models.Member.id).filter(models.Member.email == request.email).first():
                app_logger.warning("Member %s modification rejected. Email %s already used by another account", request.id, request.email)
                context.abort(grpc.StatusCode.ALREADY_EXISTS, "Email address already registered to another member")

        if request.phone and request.phone != member.phone:
            if db.query(models.Member.id).filter(models.Member.phone == request.phone).first():
                app_logger.warning("Member %s modification rejected. Phone number already used by another account", request.id)
                context.abort(grpc.StatusCode.ALREADY_EXISTS, "Mobile number already assigned to another member")

        member.name = request.name
        member.email = request.email
        member.phone = request.phone
        db.commit()
        
        app_logger.info("Successfully modified member record for ID: %s", member.id)
        return library_pb2.MemberResponse(id=member.id, name=member.name, email=member.email, phone=member.phone or "")
        
    except Exception as e:
        db.rollback()
        app_logger.error("Failed to modify member record for ID %s: %s", request.id, str(e), exc_info=True)
        raise