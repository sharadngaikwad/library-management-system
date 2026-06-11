'use client';

import { useEffect, useState } from 'react';
import CounterOperations from './CounterOperations';
import { getActiveLoans, returnBookAction } from './actions';

export default function CirculationDesk() {
  const [loans, setLoans] = useState([]);
  const [searchId, setSearchId] = useState('0');
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [validationError, setValidationError] = useState('');

  const [returnTargetLoan, setReturnTargetLoan] = useState<any | null>(null);

  const refreshLoans = async (targetId: string) => {
    setLoading(true);
    try {
      const list = await getActiveLoans(Number(targetId));
      setLoans(list as any);
    } catch (err) {
      console.error("Failed fetching loan manifests:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshLoans(searchId);
  }, [searchId]);

  // Step 1: Open custom confirmation overlay
  const handleOpenReturnConfirm = (loan: any) => {
    setReturnTargetLoan(loan);
  };

  // Step 2: Dispatch mutation to gRPC network layer on user confirmation
  const handleCommitReturn = async () => {
    if (!returnTargetLoan) return;

    const loanToProcess = returnTargetLoan;
    setReturnTargetLoan(null); // Close modal instantly
    setProcessingId(loanToProcess.id);
    
    try {
      await returnBookAction({
        member_id: loanToProcess.member_id,
        book_id: loanToProcess.book_id
      });
      
      await refreshLoans(searchId); // Pull clean dataset from database
    } catch (err: any) {
      alert(err.message || "An unexpected error occurred during return processing.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleSearchChange = (val: string) => {
    setValidationError('');
    
    if (val.includes('-')) {
      setValidationError('Member identifier parameters cannot be negative.');
      return;
    }

    const cleanId = val.trim() === '' ? '0' : val;
    setSearchId(cleanId);
  };

  return (
    <div>
      {/* This calls refreshLoans securely. 
        Ensure CounterOperations accepts the typed props definition block! 
      */}
      <CounterOperations onRefresh={() => refreshLoans(searchId)} />
      
      <div style={{ marginTop: '30px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          gap: '12px',
          marginBottom: '12px',
          flexWrap: 'wrap'
        }}>
          <h3 style={{ margin: 0, color: 'var(--text-dark)' }}>Active Outstanding Loans</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
            <input 
              type="number" 
              min="0"
              placeholder="Filter by Member ID (0 for all)" 
              value={searchId === '0' ? '' : searchId}
              onChange={e => handleSearchChange(e.target.value)}
              style={{ 
                padding: '8px 12px',
                borderRadius: '4px',
                border: '1px solid var(--saffron-border, #ccc)',
                background: 'var(--background, #fff)',
                color: 'var(--text-dark)',
                outline: 'none'
              }}
            />
            {validationError && (
              <span style={{ color: 'var(--warning-red, #d32f2f)', fontSize: '12px', fontWeight: 'bold' }}>
                {validationError}
              </span>
            )}
          </div>
        </div>
        
        {loading && loans.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>Loading active distributions...</p>
        ) : loans.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No active operations registered.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--text-dark)' }}>
              <thead>
                <tr style={{ 
                  background: 'var(--progress-bg, rgba(0, 0, 0, 0.05))', 
                  borderBottom: '2px solid var(--saffron-border, #ccc)', 
                  textAlign: 'left' 
                }}>
                  <th style={{ padding: '12px 10px' }}>Member</th>
                  <th style={{ padding: '12px 10px' }}>Book Title</th>
                  <th style={{ padding: '12px 10px' }}>Checkout Date</th>
                  <th style={{ padding: '12px 10px' }}>Expected Due Date</th>
                  <th style={{ padding: '12px 10px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loans.map((loan: any) => (
                  <tr key={loan.id} style={{ borderBottom: '1px solid var(--progress-bg, #eee)' }}>
                    <td style={{ padding: '12px 10px', fontWeight: 'bold' }}>
                      {loan.member?.name} 
                      <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                        (Member ID: #{loan.member_id})
                      </span>
                    </td>
                    <td style={{ padding: '12px 10px' }}>
                      {loan.book?.title}
                      <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                        (Book ID: #{loan.book_id})
                      </span>
                    </td>
                    <td style={{ padding: '12px 10px', fontSize: '14px' }}>{loan.borrow_date}</td>
                    <td style={{ padding: '12px 10px', fontSize: '14px' }}>
                      <span style={{ color: 'var(--warning-red)', fontWeight: 'bold' }}>
                        {loan.due_date}
                      </span>
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                      <button 
                        onClick={() => handleOpenReturnConfirm(loan)}
                        disabled={processingId === loan.id}
                        style={{
                          padding: '6px 12px', 
                          background: 'transparent', 
                          border: '1px solid var(--warning-red, #d32f2f)',
                          color: 'var(--warning-red, #d32f2f)', 
                          borderRadius: '4px', 
                          cursor: 'pointer', 
                          fontWeight: 'bold', 
                          fontSize: '13px',
                          opacity: processingId === loan.id ? 0.5 : 1
                        }}
                      >
                        {processingId === loan.id ? 'Processing...' : 'Process Return'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Symmetrical Check-In Return Confirmation Modal Overlay */}
      {returnTargetLoan && (
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
              Confirm Return Processing
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '14px', lineHeight: '1.5' }}>
              You are about to process a physical book check-in and close this outstanding loan allocation:
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
              <div><strong>Returning Patron:</strong> {returnTargetLoan.member?.name} (#{returnTargetLoan.member_id})</div>
              <div><strong>Book Title:</strong> {returnTargetLoan.book?.title} (#{returnTargetLoan.book_id})</div>
              <div><strong>Initial Borrow Date:</strong> {returnTargetLoan.borrow_date}</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setReturnTargetLoan(null)}
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
                onClick={handleCommitReturn}
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
                Confirm Check-In
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}