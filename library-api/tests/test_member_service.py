import pytest
from unittest.mock import MagicMock
import grpc
from app.services.member_service import get_all_members, create_new_member, modify_member_record
from app import models
import library_pb2

def test_get_all_members_success():
    db = MagicMock()
    request = MagicMock(page=1, page_size=10)
    context = MagicMock()
    
    db.query.return_value.count.return_value = 1
    db.query.return_value.order_by.return_value.offset.return_value.limit.return_value.all.return_value = [
        models.Member(id=1, name="John Doe", email="john@example.com", phone="1234567890")
    ]
    
    response = get_all_members(db, request, context)
    
    assert response.total_records == 1
    assert len(response.members) == 1
    assert response.members[0].name == "John Doe"

def test_get_all_members_invalid_pagination():
    db = MagicMock()
    request = MagicMock(page=0, page_size=-5)
    context = MagicMock()
    context.abort.side_effect = grpc.RpcError()
    
    with pytest.raises(grpc.RpcError):
        get_all_members(db, request, context)
    
    context.abort.assert_called_once_with(
        grpc.StatusCode.INVALID_ARGUMENT,
        "Pagination page indices and size windows must be non-negative values."
    )

def test_create_new_member_success():
    db = MagicMock()
    request = MagicMock()
    request.name = "Jane Doe"
    request.email = "jane@example.com"
    request.phone = "0987654321"
    context = MagicMock()
    
    # Email lookup and Phone lookup both return None (No conflicting records exist)
    db.query.return_value.filter.return_value.first.side_effect = [None, None]
    
    def mock_db_add(obj):
        obj.id = 1
    db.add.side_effect = mock_db_add

    response = create_new_member(db, request, context)
    
    db.add.assert_called_once()
    db.commit.assert_called_once()
    assert response.name == "Jane Doe"
    assert response.email == "jane@example.com"

def test_create_new_member_missing_or_whitespace_fields():
    db = MagicMock()
    request = MagicMock()
    request.name = "   "
    request.email = "valid@example.com"
    request.phone = "1234567890"
    context = MagicMock()
    context.abort.side_effect = grpc.RpcError()
    
    with pytest.raises(grpc.RpcError):
        create_new_member(db, request, context)
    
    context.abort.assert_called_once_with(
        grpc.StatusCode.INVALID_ARGUMENT,
        "Patron Name and Email address are mandatory parameters."
    )

def test_create_new_member_invalid_email():
    db = MagicMock()
    request = MagicMock()
    request.name = "Jane Doe"
    request.email = "invalid-email"
    request.phone = "0987654321"
    context = MagicMock()
    context.abort.side_effect = grpc.RpcError()
    
    with pytest.raises(grpc.RpcError):
        create_new_member(db, request, context)
    
    context.abort.assert_called_once_with(
        grpc.StatusCode.INVALID_ARGUMENT,
        "Provided value is not a syntactically valid email format address."
    )

def test_modify_member_record_success():
    db = MagicMock()
    request = MagicMock()
    request.id = 1
    request.name = "John Updated"
    request.email = "john@example.com"
    request.phone = "1112223333"
    context = MagicMock()
    
    mock_member = models.Member(id=1, name="John Doe", email="john@example.com", phone="1234567890")
    
    # db.query().filter().first() fetches member; next checks don't return duplicates
    db.query.return_value.filter.return_value.first.side_effect = [mock_member, None, None]
    
    response = modify_member_record(db, request, context)
    
    db.commit.assert_called_once()
    assert mock_member.name == "John Updated"
    assert mock_member.phone == "1112223333"
    assert response.name == "John Updated"

def test_modify_member_record_duplicate_email():
    db = MagicMock()
    request = MagicMock()
    request.id = 1
    request.name = "John Updated"
    request.email = "taken@example.com"
    request.phone = ""
    context = MagicMock()
    context.abort.side_effect = grpc.RpcError()
    
    mock_member = models.Member(id=1, name="John Doe", email="john@example.com", phone="1234567890")
    
    # db.query().filter().first() fetches member, but the second check (email uniqueness) finds an existing record
    db.query.return_value.filter.return_value.first.side_effect = [mock_member, MagicMock(id=2)]
    
    with pytest.raises(grpc.RpcError):
        modify_member_record(db, request, context)
    
    context.abort.assert_called_once()
    args, _ = context.abort.call_args
    assert args[0] == grpc.StatusCode.ALREADY_EXISTS