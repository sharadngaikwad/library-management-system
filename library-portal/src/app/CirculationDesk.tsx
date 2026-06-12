'use client';

import { useEffect, useState } from 'react';
import CounterOperations from './CounterOperations';
import { getActiveLoans, returnBookAction } from './actions';

interface FetchLoansResponse {
  loans: any[];
  totalRecords: number;
}

export default function CirculationDesk() {
  const [loans, setLoans] = useState<any[]>([]);
  const [searchId, setSearchId] = useState('0');
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [validationError, setValidationError] = useState('');

  // --- SERVER-SIDE PAGINATION STATES ---
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);

  const [returnTargetLoan, setReturnTargetLoan] = useState<any | null>(null);

  const refreshLoans = async (targetId: string, pageNum = currentPage) => {
    setLoading(true);
    try {
      const response = (await getActiveLoans(
        Number(targetId),
        pageNum,
        itemsPerPage
      )) as FetchLoansResponse;

      setLoans(response.loans || []);
      setTotalRecords(response.totalRecords || 0);
    } catch (err) {
      console.error("Failed fetching loan manifests:", err);
    } finally {
      setLoading(false);
    }
  };

  // Trigger automated data refreshing hook cycles on dependency changes
  useEffect(() => {
    refreshLoans(searchId, currentPage);
  }, [searchId, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(totalRecords / itemsPerPage) || 1;

  const handlePageSizeChange = (newSize: number) => {
    setItemsPerPage(newSize);
    setCurrentPage(1); // Reset boundary window safely
  };

  const handleOpenReturnConfirm = (loan: any) => {
    setReturnTargetLoan(loan);
  };

  const handleCommitReturn = async () => {
    if (!returnTargetLoan) return;

    const loanToProcess = returnTargetLoan;
    setReturnTargetLoan(null); 
    setProcessingId(loanToProcess.id);
    
    try {
      await returnBookAction({
        member_id: loanToProcess.member_id,
        book_id: loanToProcess.book_id
      });
      
      // Refresh current page dataset parameters
      await refreshLoans(searchId); 
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
    setCurrentPage(1); // Reset to page 1 on search change
  };

  // --- SLIDING WINDOW PAGINATION LOGIC ---
  const getPaginationPageNumbers = () => {
    const pageNumbers: (number | string)[] = [];
    const maxVisibleNeighbors = 1; 

    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
    } else {
      pageNumbers.push(1);

      const startPage = Math.max(2, currentPage - maxVisibleNeighbors);
      const endPage = Math.min(totalPages - 1, currentPage + maxVisibleNeighbors);

      if (startPage > 2) pageNumbers.push('...');

      for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(i);
      }

      if (endPage < totalPages - 1) pageNumbers.push('...');

      pageNumbers.push(totalPages);
    }

    return pageNumbers;
  };

  return (
    <div>
      <CounterOperations onRefresh={() => refreshLoans(searchId, 1)} />
      
      <div style={{ marginTop: '30px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          gap: '12px',
          marginBottom: '12px',
          flexWrap: 'wrap'
        }}>
          <h3 style={{ margin: 0, color: 'var(--text-dark)' }}>
            Active Outstanding Loans ({totalRecords} items matched)
          </h3>
          
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
        
        {/* Isolated loading viewport to prevent drop out flickering effects */}
        <div style={{ overflowX: 'auto', minHeight: '240px', position: 'relative' }}>
          {loading && (
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(1px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10
            }}>
              <p style={{ color: 'var(--text-dark)', fontWeight: 'bold', background: 'var(--progress-bg, #eee)', padding: '8px 16px', borderRadius: '4px' }}>
                Fetching Row Matrices...
              </p>
            </div>
          )}

          {loans.length === 0 && !loading ? (
            <p style={{ color: 'var(--text-muted)', padding: '40px 0', textAlign: 'center' }}>No active operations registered.</p>
          ) : (
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
                  <tr key={loan.id} style={{ borderBottom: '1px solid var(--progress-bg, #eee)', opacity: loading ? 0.5 : 1 }}>
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
                        disabled={processingId === loan.id || loading}
                        style={{
                          padding: '6px 12px', 
                          background: 'transparent', 
                          border: '1px solid var(--warning-red, #d32f2f)',
                          color: 'var(--warning-red, #d32f2f)', 
                          borderRadius: '4px', 
                          cursor: (processingId === loan.id || loading) ? 'not-allowed' : 'pointer', 
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
          )}
        </div>
      </div>

      {/* --- REUSABLE CONTROL PANEL FOOTER --- */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginTop: '20px', 
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-dark)' }}>
          <span>Show rows per page:</span>
          <select 
            value={itemsPerPage} 
            onChange={e => handlePageSizeChange(Number(e.target.value))}
            style={{
              padding: '6px 8px',
              borderRadius: '4px',
              border: '1px solid var(--saffron-border, #ccc)',
              background: 'var(--progress-bg, #fff)',
              color: 'var(--text-dark)',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button 
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            style={{ 
              padding: '6px 12px', 
              borderRadius: '4px', 
              border: '1px solid var(--saffron-border, #ccc)', 
              background: 'var(--progress-bg, #fff)',
              color: 'var(--text-dark)',
              cursor: (currentPage === 1) ? 'not-allowed' : 'pointer', 
              opacity: (currentPage === 1) ? 0.4 : 1 
            }}
          >
            « Prev
          </button>
          
          {getPaginationPageNumbers().map((page, index) => {
            if (page === '...') {
              return (
                <span key={`ellipsis-${index}`} style={{ padding: '6px 8px', color: 'var(--text-muted)', fontSize: '14px' }}>
                  ...
                </span>
              );
            }

            const isCurrent = currentPage === page;
            return (
              <button
                key={`page-${page}`}
                onClick={() => setCurrentPage(page as number)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '4px',
                  border: '1px solid var(--saffron-primary, #FF6600)',
                  background: isCurrent ? 'var(--saffron-primary, #FF6600)' : 'var(--progress-bg, #fff)',
                  color: isCurrent ? '#fff' : 'var(--text-dark)',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                {page}
              </button>
            );
          })}

          <button 
            disabled={currentPage === totalPages || totalRecords === 0}
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            style={{ 
              padding: '6px 12px', 
              borderRadius: '4px', 
              border: '1px solid var(--saffron-border, #ccc)', 
              background: 'var(--progress-bg, #fff)',
              color: 'var(--text-dark)',
              cursor: (currentPage === totalPages || totalRecords === 0) ? 'not-allowed' : 'pointer', 
              opacity: (currentPage === totalPages || totalRecords === 0) ? 0.4 : 1 
            }}
          >
            Next »
          </button>
        </div>
      </div>

      {/* OVERLAY RETURN CONFIRMATION MODAL */}
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