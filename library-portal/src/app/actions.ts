'use server';

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { serverLogger } from '@/lib/server-logger';

// Target resolution path pointing to the updated neutral service layout directory
const PROTO_PATH = path.join(process.cwd(), '../library-api/proto/library.proto');

let client: any;

try {
  serverLogger.info('Initializing gRPC channel communication parameters...');
  const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true, longs: String, enums: String, defaults: true, oneofs: true
  });
  const libraryProto = (grpc.loadPackageDefinition(packageDefinition) as any).library;
  
  const targetUrl = process.env.BACKEND_RPC_URL || 'localhost:50051';
  client = new libraryProto.LibraryService(targetUrl, grpc.credentials.createInsecure());
  serverLogger.info('gRPC Client successfully attached to channel target: %s', targetUrl);
} catch (initErr) {
  serverLogger.error('Critical failure establishing gRPC proto channel definition definitions:', initErr);
}

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
  serverLogger.info('Server Action [createBookAction] invoked for ISBN: %s', bookData.isbn);
  return new Promise((resolve, reject) => {
    client.CreateBook(bookData, (err: any, response: any) => {
      if (err) {
        serverLogger.error('gRPC CreateBook execution exception occurred:', err);
        reject(new Error(err.details || 'Failed to create book record.'));
      } else {
        serverLogger.info('Successfully cataloged book record. ID: %s', response?.id);
        resolve(response);
      }
    });
  });
}

export async function updateBookAction(bookData: { id: number; title: string; author: string; isbn: string; total_copies: number; available_copies: number }) {
  serverLogger.info('Server Action [updateBookAction] invoked for Book ID: %s', bookData.id);
  return new Promise((resolve, reject) => {
    client.UpdateBook(bookData, (err: any, response: any) => {
      if (err) {
        serverLogger.error(`gRPC UpdateBook failed for Book ID ${bookData.id}:`, err);
        reject(new Error(err.details || 'Failed to update book profile.'));
      } else {
        serverLogger.info('Successfully modified book record metrics for ID: %s', bookData.id);
        resolve(response);
      }
    });
  });
}

export async function registerMemberAction(memberData: { name: string; email: string; phone: string }) {
  serverLogger.info('Server Action [registerMemberAction] invoked for email: %s', memberData.email);
  return new Promise((resolve, reject) => {
    client.CreateMember(memberData, (err: any, response: any) => {
      if (err) {
        serverLogger.error('gRPC CreateMember operation exception occurred:', err);
        reject(new Error(err.details || 'Failed to register member.'));
      } else {
        serverLogger.info('Successfully registered new patron with ID: %s', response?.id);
        resolve(response);
      }
    });
  });
}

export async function updateMemberAction(memberData: { id: number; name: string; email: string; phone: string }) {
  serverLogger.info('Server Action [updateMemberAction] invoked for Patron ID: %s', memberData.id);
  return new Promise((resolve, reject) => {
    client.UpdateMember(memberData, (err: any, response: any) => {
      if (err) {
        serverLogger.error(`gRPC UpdateMember operation failed for ID ${memberData.id}:`, err);
        reject(new Error(err.details || 'Failed to modify patron profile.'));
      } else {
        serverLogger.info('Successfully synchronized layout attributes for ID: %s', memberData.id);
        resolve(response);
      }
    });
  });
}

export async function executeOperation(action: 'borrow' | 'return', memberId: number, bookId: number) {
  serverLogger.info('Server Action [executeOperation] routing action -> Mode: %s, Member: %s, Book: %s', action, memberId, bookId);
  return new Promise((resolve) => {
    const method = action === 'borrow' ? 'BorrowBook' : 'ReturnBook';
    client[method]({ member_id: memberId, book_id: bookId }, (err: any, response: any) => {
      if (err) {
        serverLogger.warn(`gRPC counter operation transaction failure [${method}] on Book ${bookId}:`, err);
        resolve({ success: false, message: err.details || 'Internal pipeline error' });
      } else {
        serverLogger.info('Successfully processed counter ledger update [%%s] for member %s', method, memberId);
        resolve({ success: true, message: response.message || 'Operation recorded successfully!' });
      }
    });
  });
}

export async function getActiveLoans(memberId: number, page: number, pageSize: number) {
  serverLogger.debug('Server Action [getActiveLoans] requested pagination sequence -> Member: %s, Page: %s', memberId, page);
  return new Promise((resolve) => {
    const payload = { 
      member_id: memberId, 
      page: page, 
      page_size: pageSize 
    };

    client.ListActiveLoans(payload, (err: any, response: any) => {
      if (err) {
        serverLogger.error(`Failed to pull active loans index for member ${memberId}:`, err);
        resolve({ loans: [], totalRecords: 0 });
      } else {
        resolve({
          loans: response.loans || [],
          totalRecords: response.total_records || 0
        });
      }
    });
  });
}

export async function getAllBooks(params?: GetBooksParams) {
  const request = {
    page: params?.page || 0,
    page_size: params?.pageSize || 0
  };
  serverLogger.debug('Server Action [getAllBooks] invoking ListBooks gRPC request. Window criteria:', request);

  return new Promise((resolve, reject) => {
    client.ListBooks(request, (err: any, response: any) => {
      if (err) {
        serverLogger.error('gRPC ListBooks channel reading exception:', err);
        return reject(new Error(err.message || 'Failed to fetch catalog.'));
      }
      
      serverLogger.info('Catalog list parsed successfully. Returning %d elements.', response?.books?.length || 0);
      resolve({
        books: response.books || [],
        totalRecords: response.total_records || 0
      });
    });
  });
}

export async function getAllMembers(params: GetMembersParams): Promise<FetchMembersResponse> {
  const request = {
    page: params.page,
    page_size: params.pageSize
  };
  serverLogger.debug('Server Action [getAllMembers] invoking ListMembers gRPC payload context:', request);

  return new Promise((resolve) => {
    client.ListMembers(request, (err: any, response: any) => {
      if (err || !response) {
        serverLogger.error('gRPC ListMembers extraction channel parsing failed:', err);
        resolve({ members: [], totalRecords: 0 });
      } else {
        const structuralCount = response.total_records ?? response.totalRecords ?? 0;
        resolve({
          members: response.members || [],
          totalRecords: structuralCount
        });
      }
    });
  });
}

export async function borrowBookAction(payload: { member_id: number; book_id: number }) {
  serverLogger.info('Server Action [borrowBookAction] execution triggered. Book: %s, Patron: %s', payload.book_id, payload.member_id);
  
  return new Promise((resolve) => {
    client.BorrowBook(payload, (err: any, response: any) => {
      if (err) {
        serverLogger.warn('gRPC BorrowBook verification rejected transactional conditions:', err);
        
        resolve({
          success: false,
          message: err.details || 'Failed to execute borrow checkout request.'
        });
      } else {
        serverLogger.info('Borrow clearance processing complete for confirmation ID: %s', response?.id);
        
        resolve({
          success: true,
          data: response
        });
      }
    });
  });
}

export async function returnBookAction(payload: { member_id: number; book_id: number }) {
  serverLogger.info('Server Action [returnBookAction] execution triggered. Book: %s, Patron: %s', payload.book_id, payload.member_id);
  return new Promise((resolve, reject) => {
    client.ReturnBook(payload, (err: any, response: any) => {
      if (err) {
        serverLogger.warn('gRPC ReturnBook ledger processing failed:', err);
        reject(new Error(err.details || 'Failed to process checkout return.'));
      } else {
        serverLogger.info('Return processing update complete.');
        resolve(response);
      }
    });
  });
}