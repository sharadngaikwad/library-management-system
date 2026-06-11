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