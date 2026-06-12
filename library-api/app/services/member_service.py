import re
from logger_config import app_logger
import grpc
from app import models
import library_pb2

# Basic robust regex pattern for email format validation
EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")

def get_all_members(db, request, context):
    app_logger.info("Received get_all_members request. Page: %s, Page Size: %s", request.page, request.page_size)
    
    # Validation: Verify pagination criteria are non-negative values
    if request.page < 0 or request.page_size < 0:
        app_logger.warning("Invalid pagination criteria: Page=%s, Page Size=%s", request.page, request.page_size)
        context.abort(grpc.StatusCode.INVALID_ARGUMENT, "Pagination page indices and size windows must be non-negative values.")

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
    
    # 1. Structural Sanitation and Empty Attribute Guards
    name_clean = request.name.strip() if request.name else ""
    email_clean = request.email.strip().lower() if request.email else ""
    phone_clean = request.phone.strip() if request.phone else ""

    if not name_clean or not email_clean:
        app_logger.warning("Member creation rejected: Missing mandatory parameter fields.")
        context.abort(grpc.StatusCode.INVALID_ARGUMENT, "Patron Name and Email address are mandatory parameters.")

    # 2. Regex Syntax Logic Validation
    if not EMAIL_REGEX.match(email_clean):
        app_logger.warning("Member creation rejected. Invalid email format structure: %s", email_clean)
        context.abort(grpc.StatusCode.INVALID_ARGUMENT, "Provided value is not a syntactically valid email format address.")

    try:
        # 3. Unique Controllable Constraints Mapping Check (Email Lookup)
        existing_email = db.query(models.Member).filter(models.Member.email == email_clean).first()
        if existing_email:
            app_logger.warning("Member creation rejected. Email already exists: %s", email_clean)
            context.abort(grpc.StatusCode.ALREADY_EXISTS, "This email matching user is already registered on this platform.")
            
        # 4. Unique Controllable Constraints Mapping Check (Phone Lookup)
        if phone_clean:
            existing_phone = db.query(models.Member).filter(models.Member.phone == phone_clean).first()
            if existing_phone:
                app_logger.warning("Member creation rejected. Phone number already exists: %s", phone_clean)
                context.abort(grpc.StatusCode.ALREADY_EXISTS, "This phone number is already assigned to another active patron member.")

        member = models.Member(name=name_clean, email=email_clean, phone=phone_clean or None)
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
    
    # 1. Type Boundary & Structural Logic Verification
    if request.id <= 0:
        app_logger.warning("Member modification failed. Invalid numeric structural ID passed: %s", request.id)
        context.abort(grpc.StatusCode.INVALID_ARGUMENT, "Target member lookup identifier must be a positive integer.")

    name_clean = request.name.strip() if request.name else ""
    email_clean = request.email.strip().lower() if request.email else ""
    phone_clean = request.phone.strip() if request.phone else ""

    if not name_clean or not email_clean:
        app_logger.warning("Member modification rejected for ID %s: Missing structural arguments.", request.id)
        context.abort(grpc.StatusCode.INVALID_ARGUMENT, "Patron record updates require a valid Name and Email string.")

    if not EMAIL_REGEX.match(email_clean):
        app_logger.warning("Member modification rejected for ID %s. Invalid email syntax string: %s", request.id, email_clean)
        context.abort(grpc.StatusCode.INVALID_ARGUMENT, "The updated string is not a valid email address.")

    try:
        # 2. Fetch the target row record from the database
        member = db.query(models.Member).filter(models.Member.id == request.id).first()
        if not member:
            app_logger.warning("Member modification failed. Target ID not found: %s", request.id)
            context.abort(grpc.StatusCode.NOT_FOUND, "Target member record matching this database identifier was not found.")
        
        # 3. Cross-record Uniqueness Check: Email clash with an alternate row?
        if email_clean != member.email:
            if db.query(models.Member.id).filter(models.Member.email == email_clean, models.Member.id != request.id).first():
                app_logger.warning("Member %s modification rejected. Email %s already used by another account", request.id, email_clean)
                context.abort(grpc.StatusCode.ALREADY_EXISTS, "This updated email address is already assigned to another member platform account.")

        # 4. Cross-record Uniqueness Check: Phone clash with an alternate row?
        if phone_clean and phone_clean != member.phone:
            if db.query(models.Member.id).filter(models.Member.phone == phone_clean, models.Member.id != request.id).first():
                app_logger.warning("Member %s modification rejected. Phone number %s already used by another account", request.id, phone_clean)
                context.abort(grpc.StatusCode.ALREADY_EXISTS, "This updated mobile phone number is already registered to another patron.")

        member.name = name_clean
        member.email = email_clean
        member.phone = phone_clean or None
        db.commit()
        
        app_logger.info("Successfully modified member record for ID: %s", member.id)
        return library_pb2.MemberResponse(id=member.id, name=member.name, email=member.email, phone=member.phone or "")
        
    except Exception as e:
        db.rollback()
        app_logger.error("Failed to modify member record for ID %s: %s", request.id, str(e), exc_info=True)
        raise