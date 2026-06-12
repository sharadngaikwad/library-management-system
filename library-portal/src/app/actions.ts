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

interface GetBooksParams {
  page?: number;
  pageSize?: number;
}

interface GetMembersParams {
  page: number;
  pageSize: number;
}

interface FetchMembersResponse {
  members: any[];
  totalRecords: number;
}

export async function createBookAction(bookData: { title: string; author: string; isbn: string; total_copies: number; available_copies: number }) {
  return new Promise((resolve, reject) => {
    client.CreateBook(bookData, (err: any, response: any) => {
      if (err) reject(new Error(err.details || 'Failed to create book record.'));
      else resolve(response);
    });
  });
}

export async function updateBookAction(bookData: { id: number; title: string; author: string; isbn: string; total_copies: number; available_copies: number }) {
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

export async function getAllBooks(params?: GetBooksParams) {
  return new Promise((resolve, reject) => {
    // If no params are passed, they default to 0, matching our backend "return all" logic
    const request = {
      page: params?.page || 0,
      page_size: params?.pageSize || 0
    };

    client.ListBooks(request, (err: any, response: any) => {
      if (err) {
        return reject(new Error(err.message || 'Failed to fetch catalog.'));
      }
      
      // Return both the paginated dataset and the total record block count
      resolve({
        books: response.books || [],
        totalRecords: response.total_records || 0
      });
    });
  });
}

export async function getAllMembers(params: GetMembersParams): Promise<FetchMembersResponse> {
  return new Promise((resolve) => {
    const request = {
      page: params.page,
      page_size: params.pageSize
    };

    // Ensure casing matches your runtime stub compilation convention (e.g., ListMembers vs listMembers)
    client.ListMembers(request, (err: any, response: any) => {
      if (err || !response) {
        resolve({ members: [], totalRecords: 0 });
      } else {
        resolve({
          members: response.members || [],
          // Support both camelCase and snake_case runtime translations cleanly
          totalRecords: response.total_records ?? response.totalRecords ?? 0
        });
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