'use client';

import { useState } from 'react';
import { executeOperation } from './actions';

export default function CounterOperations({ onRefresh }: { onRefresh: () => void }) {
  const [memberId, setMemberId] = useState('');
  const [bookId, setBookId] = useState('');
  const [status, setStatus] = useState({ error: false, message: '' });

  const runAction = async (type: 'borrow' | 'return') => {
    setStatus({ error: false, message: '' });
    if (!memberId || !bookId) {
      setStatus({ error: true, message: 'Member ID and Book ID are strictly required.' });
      return;
    }
    
    const res = await executeOperation(type, Number(memberId), Number(bookId)) as any;
    setStatus({ error: !res.success, message: res.message });
    if (res.success) {
      setBookId(''); // Clear book input field on success for rapid desk entries
      onRefresh();
    }
  };

  return (
    <div style={{ background: '#f9f9f9', padding: '20px', borderRadius: '6px', border: '1px solid #eee' }}>
      <h4 style={{ marginTop: 0, marginBottom: '12px', color: '#333' }}>Circulation Desk Action</h4>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
        <input 
          type="number" 
          placeholder="Enter Member ID" 
          value={memberId} 
          onChange={e => setMemberId(e.target.value)} 
          style={{ padding: '8px', width: '100%' }} 
        />
        <input 
          type="number" 
          placeholder="Enter Book ID" 
          value={bookId} 
          onChange={e => setBookId(e.target.value)} 
          style={{ padding: '8px', width: '100%' }} 
        />
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button 
          onClick={() => runAction('borrow')} 
          style={{ padding: '10px 16px', background: '#0070f3', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Issue Book
        </button>
        <button 
          onClick={() => runAction('return')} 
          style={{ padding: '10px 16px', background: '#333', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Process Return
        </button>
      </div>
      {status.message && (
        <p style={{ color: status.error ? '#d32f2f' : '#2e7d32', marginTop: '12px', marginBottom: 0, fontSize: '14px', fontWeight: 'bold' }}>
          {status.message}
        </p>
      )}
    </div>
  );
}