'use server';

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';

// Target resolution path pointing to the updated neutral service layout directory
const PROTO_PATH = path.join(process.cwd(), '../library-api/proto/library.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true, longs: String, enums: String, defaults: true, oneofs: true
});
const libraryProto = (grpc.loadPackageDefinition(packageDefinition) as any).library;
const client = new libraryProto.LibraryService(
  process.env.BACKEND_RPC_URL || 'localhost:50051',
  grpc.credentials.createInsecure()
);

export async function createBookAction(bookData: { title: string; author: string; isbn: string; available_copies: number }) {
  return new Promise((resolve, reject) => {
    client.CreateBook(bookData, (err: any, response: any) => {
      if (err) reject(new Error(err.details || 'Failed to create book record.'));
      else resolve(response);
    });
  });
}

export async function updateBookAction(bookData: { id: number; title: string; author: string; isbn: string; available_copies: number }) {
  return new Promise((resolve, reject) => {
    client.UpdateBook(bookData, (err: any, response: any) => {
      if (err) reject(new Error(err.details || 'Failed to update book profile.'));
      else resolve(response);
    });
  });
}

export async function registerMemberAction(memberData: { name: string; email: string; phone: string }) {
  return new Promise((resolve, reject) => {
    client.CreateMember(memberData, (err: any, response: any) => {
      if (err) reject(new Error(err.details || 'Failed to register member.'));
      else resolve(response);
    });
  });
}

export async function updateMemberAction(memberData: { id: number; name: string; email: string; phone: string }) {
  return new Promise((resolve, reject) => {
    client.UpdateMember(memberData, (err: any, response: any) => {
      if (err) reject(new Error(err.details || 'Failed to modify patron profile.'));
      else resolve(response);
    });
  });
}

export async function executeOperation(action: 'borrow' | 'return', memberId: number, bookId: number) {
  return new Promise((resolve) => {
    const method = action === 'borrow' ? 'BorrowBook' : 'ReturnBook';
    client[method]({ member_id: memberId, book_id: bookId }, (err: any, response: any) => {
      if (err) {
        resolve({ success: false, message: err.details || 'Internal pipeline error' });
      } else {
        resolve({ success: true, message: response.message || 'Operation recorded successfully!' });
      }
    });
  });
}

export async function getActiveLoans(memberId: number) {
  return new Promise((resolve) => {
    client.ListActiveLoans({ member_id: memberId }, (err: any, response: any) => {
      if (err || !response.loans) {
        resolve([]);
      } else {
        resolve(response.loans);
      }
    });
  });
}

export async function getAllBooks() {
  return new Promise((resolve) => {
    // EmptyRequest payload {} matches your .proto definition
    client.ListBooks({}, (err: any, response: any) => {
      if (err || !response.books) {
        resolve([]);
      } else {
        resolve(response.books);
      }
    });
  });
}

export async function getAllMembers() {
  return new Promise((resolve) => {
    // EmptyRequest payload {} matches your .proto definition
    client.ListMembers({}, (err: any, response: any) => {
      if (err || !response.members) {
        resolve([]);
      } else {
        resolve(response.members);
      }
    });
  });
}

export async function borrowBookAction(payload: { member_id: number; book_id: number }) {
  return new Promise((resolve, reject) => {
    // Calls the rpc BorrowBook definition in library.proto symmetrically
    client.BorrowBook(payload, (err: any, response: any) => {
      if (err) reject(new Error(err.details || 'Failed to execute borrow checkout request.'));
      else resolve(response);
    });
  });
}

export async function returnBookAction(payload: { member_id: number; book_id: number }) {
  return new Promise((resolve, reject) => {
    // Calls the rpc ReturnBook definition in library.proto
    client.ReturnBook(payload, (err: any, response: any) => {
      if (err) reject(new Error(err.details || 'Failed to process checkout return.'));
      else resolve(response);
    });
  });
}