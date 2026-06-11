'use client';

import { useState } from 'react';
import { borrowBookAction } from './actions';

interface CounterOperationsProps {
  onRefresh: () => Promise<void>;
}

export default function CounterOperations({ onRefresh }: CounterOperationsProps) {
  const [memberId, setMemberId] = useState('');
  const [bookId, setBookId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // This must be present to catch the local submission state
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const handleOpenConfirmation = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const cleanMemberId = memberId.trim();
    const cleanBookId = bookId.trim();

    if (!cleanMemberId || isNaN(Number(cleanMemberId)) || Number(cleanMemberId) <= 0) {
      setErrorMessage('A valid, positive Member Card ID is mandatory.');
      return;
    }

    if (!cleanBookId || isNaN(Number(cleanBookId)) || Number(cleanBookId) <= 0) {
      setErrorMessage('A valid, positive Book ID code is mandatory.');
      return;
    }

    // Intercepts submission and shows custom overlay window instead of executing instantly
    setShowConfirmModal(true);
  };

  const handleCommitIssue = async () => {
    setShowConfirmModal(false); // Closes the overlay safely
    setIsProcessing(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      await borrowBookAction({
        member_id: Number(memberId.trim()),
        book_id: Number(bookId.trim())
      });

      setSuccessMessage(`Book ID #${bookId} successfully issued to Member #${memberId}!`);
      setBookId(''); // Clear book ID field for fast sequential item processing
      await onRefresh(); // Triggers the table reload inside CirculationDesk
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to process issue operation entry.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={{
      background: 'var(--progress-bg, rgba(0, 0, 0, 0.02))',
      border: '1px solid var(--saffron-border, rgba(244, 196, 48, 0.2))',
      padding: '20px',
      borderRadius: '8px',
      color: 'var(--text-dark)'
    }}>
      <h4 style={{ margin: '0 0 16px 0', color: 'var(--saffron-dark, #E65100)' }}>Issue Book Profile Manual Entry</h4>
      
      <form onSubmit={handleOpenConfirmation} style={{
        display: 'flex',
        gap: '16px',
        alignItems: 'flex-end',
        flexWrap: 'wrap'
      }}>
        <div style={{ flex: '1 1 200px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>
            Member Card ID <span style={{ color: 'var(--warning-red, #d32f2f)' }}>*</span>
          </label>
          <input
            type="number"
            min="1"
            placeholder="e.g. 14"
            value={memberId}
            onChange={e => setMemberId(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '4px',
              border: '1px solid var(--saffron-border, #ccc)',
              background: 'var(--background, #fff)',
              color: 'var(--text-dark)'
            }}
          />
        </div>

        <div style={{ flex: '1 1 200px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>
            Book Unique ID <span style={{ color: 'var(--warning-red, #d32f2f)' }}>*</span>
          </label>
          <input
            type="number"
            min="1"
            placeholder="e.g. 102"
            value={bookId}
            onChange={e => setBookId(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '4px',
              border: '1px solid var(--saffron-border, #ccc)',
              background: 'var(--background, #fff)',
              color: 'var(--text-dark)'
            }}
          />
        </div>

        <button
          type="submit"
          disabled={isProcessing}
          style={{
            padding: '10px 20px',
            background: 'var(--saffron-primary, #FF6600)',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            opacity: isProcessing ? 0.6 : 1,
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

      {/* MATCHING POPUP OVERLAY LAYOUT FOR ISSUING BOOKS */}
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
            maxWidth: '400px',
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
              <div><strong>Target Patron (Member ID):</strong> #{memberId}</div>
              <div><strong>Allocated Target (Book ID):</strong> #{bookId}</div>
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