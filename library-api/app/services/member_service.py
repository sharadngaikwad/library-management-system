import grpc
from app import models
import library_pb2

def get_all_members(db, request, context):
    results = db.query(models.Member).order_by(models.Member.name.asc(), models.Member.id.asc()).all()
    protobuf_list = [
        library_pb2.MemberResponse(
            id=m.id, name=m.name, email=m.email, phone=m.phone or ""
        ) for m in results
    ]
    return library_pb2.ListMembersResponse(members=protobuf_list)

def create_new_member(db, request, context):
    existing = db.query(models.Member).filter(models.Member.email == request.email).first()
    if existing:
        context.abort(grpc.StatusCode.ALREADY_EXISTS, "Email matching member already registered")
        
    member = models.Member(name=request.name, email=request.email, phone=request.phone)
    db.add(member)
    db.commit()
    return library_pb2.MemberResponse(id=member.id, name=member.name, email=member.email, phone=member.phone or "")

def modify_member_record(db, request, context):
    member = db.query(models.Member).filter(models.Member.id == request.id).first()
    if not member:
        context.abort(grpc.StatusCode.NOT_FOUND, "Target member matching ID not found")
    
    if request.email != member.email:
        if db.query(models.Member.id).filter(models.Member.email == request.email).first():
            context.abort(grpc.StatusCode.ALREADY_EXISTS, "Email address already registered to another member")

    if request.phone and request.phone != member.phone:
        if db.query(models.Member.id).filter(models.Member.phone == request.phone).first():
            context.abort(grpc.StatusCode.ALREADY_EXISTS, "Mobile number already assigned to another member")

    member.name = request.name
    member.email = request.email
    member.phone = request.phone
    db.commit()
    return library_pb2.MemberResponse(id=member.id, name=member.name, email=member.email, phone=member.phone or "")