'use client';

import { useState, useEffect } from 'react';
import { borrowBookAction, getAllBooks, getAllMembers } from './actions';

interface Book {
  id: number;
  title: string;
  total_copies: number;
  available_copies: number;
}

interface Member {
  id: number;
  name: string;
}

interface CounterOperationsProps {
  onRefresh: () => Promise<void>;
}

export default function CounterOperations({ onRefresh }: CounterOperationsProps) {
  const [memberId, setMemberId] = useState('');
  const [bookId, setBookId] = useState('');
  const [books, setBooks] = useState<Book[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  
  const [loadingData, setLoadingData] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Load lists when the desk initialization completes
  const loadSelectionLists = async () => {
    try {
      setLoadingData(true);
      
      // Request a high maximum size (e.g., 1000) to populate your issue/return selection dropdowns fully
      const dropdownLimit = { page: 1, pageSize: 1000 };

      const [fetchedBooksResponse, fetchedMembersResponse] = await Promise.all([
        getAllBooks(dropdownLimit),
        getAllMembers(dropdownLimit)
      ]);

      // Safely map the paginated layout response structures
      setBooks(((fetchedBooksResponse as any)?.books || []) as Book[]);
      setMembers(((fetchedMembersResponse as any)?.members || []) as Member[]);
    } catch (err: any) {
      setErrorMessage('Failed to pre-populate selection dropdown data.');
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    loadSelectionLists();
  }, []);

  const handleOpenConfirmation = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!memberId) {
      setErrorMessage('Selecting a target library patron member is mandatory.');
      return;
    }

    if (!bookId) {
      setErrorMessage('Selecting an active catalog book item is mandatory.');
      return;
    }

    setShowConfirmModal(true);
  };

  const handleCommitIssue = async () => {
    setShowConfirmModal(false);
    setIsProcessing(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      await borrowBookAction({
        member_id: Number(memberId),
        book_id: Number(bookId)
      });

      setSuccessMessage(`Book successfully issued to Member!`);
      setBookId(''); // Clear selection state for rapid sequential entry processing
      
      // Refresh current operational logs and lookups to sync live stock badges
      await Promise.all([onRefresh(), loadSelectionLists()]);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to process issue operation entry.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Lookups to show clear names in the confirmation overlay
  const selectedMemberName = members.find(m => m.id === Number(memberId))?.name || '';
  const selectedBookTitle = books.find(b => b.id === Number(bookId))?.title || '';

  return (
    <div style={{
      background: 'var(--progress-bg, rgba(0, 0, 0, 0.02))',
      border: '1px solid var(--saffron-border, rgba(244, 196, 48, 0.2))',
      padding: '20px',
      borderRadius: '8px',
      color: 'var(--text-dark)'
    }}>
      <h4 style={{ margin: '0 0 16px 0', color: 'var(--saffron-dark, #E65100)' }}>Issue Book Counter Operation</h4>
      
      <form onSubmit={handleOpenConfirmation} style={{
        display: 'flex',
        gap: '16px',
        alignItems: 'flex-end',
        flexWrap: 'wrap'
      }}>
        
        {/* MEMBER SELECT DROPDOWN */}
        <div style={{ flex: '1 1 250px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>
            Select Active Member <span style={{ color: 'var(--warning-red, #d32f2f)' }}>*</span>
          </label>
          <select
            value={memberId}
            onChange={e => setMemberId(e.target.value)}
            disabled={loadingData || isProcessing}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '4px',
              border: '1px solid var(--saffron-border, #ccc)',
              background: 'var(--background, #fff)',
              color: 'var(--text-dark)',
              cursor: loadingData ? 'not-allowed' : 'default'
            }}
          >
            <option value="">{loadingData ? 'Loading members list...' : '-- Choose Member --'}</option>
            {members.map(member => (
              <option key={member.id} value={member.id}>
                #{member.id} - {member.name}
              </option>
            ))}
          </select>
        </div>

        {/* BOOK SELECT DROPDOWN */}
        <div style={{ flex: '1 1 250px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>
            Select Catalog Book <span style={{ color: 'var(--warning-red, #d32f2f)' }}>*</span>
          </label>
          <select
            value={bookId}
            onChange={e => setBookId(e.target.value)}
            disabled={loadingData || isProcessing}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '4px',
              border: '1px solid var(--saffron-border, #ccc)',
              background: 'var(--background, #fff)',
              color: 'var(--text-dark)',
              cursor: loadingData ? 'not-allowed' : 'default'
            }}
          >
            <option value="">{loadingData ? 'Loading catalog entries...' : '-- Choose Book --'}</option>
            {books.map(book => {
              const outOfStock = book.available_copies <= 0;
              return (
                <option 
                  key={book.id} 
                  value={book.id}
                  disabled={outOfStock}
                  style={{ color: outOfStock ? '#aaa' : 'inherit' }}
                >
                  #{book.id} - {book.title} ({book.available_copies}/{book.total_copies} left) {outOfStock ? '[OUT OF STOCK]' : ''}
                </option>
              );
            })}
          </select>
        </div>

        <button
          type="submit"
          disabled={isProcessing || loadingData}
          style={{
            padding: '10px 20px',
            background: 'var(--saffron-primary, #FF6600)',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: (isProcessing || loadingData) ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
            opacity: (isProcessing || loadingData) ? 0.6 : 1,
            height: '38px'
          }}
        >
          {isProcessing ? 'Verifying...' : 'Issue Book'}
        </button>
      </form>

      {errorMessage && (
        <p style={{ color: 'var(--warning-red, #d32f2f)', margin: '12px 0 0 0', fontWeight: 'bold', fontSize: '14px' }}>
          Error: {errorMessage}
        </p>
      )}

      {successMessage && (
        <p style={{ color: 'var(--success-green, #2e7d32)', margin: '12px 0 0 0', fontWeight: 'bold', fontSize: '14px' }}>
          ✓ {successMessage}
        </p>
      )}

      {/* CONFIRMATION OVERLAY MODAL */}
      {showConfirmModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000
        }}>
          <div style={{
            background: 'var(--background, #fff)',
            color: 'var(--text-dark, #333)',
            padding: '24px',
            borderRadius: '8px',
            width: '100%',
            maxWidth: '420px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            border: '1px solid var(--saffron-border, rgba(244, 196, 48, 0.4))'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '12px', color: 'var(--saffron-dark, #E65100)' }}>
              Confirm Allocation Request
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '14px', lineHeight: '1.5' }}>
              You are about to establish a binding transaction ledger event with the following parameters:
            </p>
            
            <div style={{
              background: 'var(--progress-bg, rgba(0,0,0,0.04))',
              padding: '12px',
              borderRadius: '6px',
              marginBottom: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              fontSize: '14px'
            }}>
              <div><strong>Target Patron:</strong> #{memberId} - {selectedMemberName}</div>
              <div><strong>Allocated Target:</strong> #{bookId} - {selectedBookTitle}</div>
              <div><strong>Default Loan Duration:</strong> 14 business days</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                style={{
                  padding: '8px 14px',
                  background: 'transparent',
                  border: '1px solid var(--saffron-border, #ccc)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  color: 'var(--text-dark)'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCommitIssue}
                style={{
                  padding: '8px 16px',
                  background: 'var(--success-green, #2e7d32)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Confirm &amp; Dispatch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}