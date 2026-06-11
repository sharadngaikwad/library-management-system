'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import CounterOperations from './CounterOperations';
import BookManagement from './BookManagement';
import MemberManagement from './MemberManagement';
import { getActiveLoans } from './actions';

export default function Home() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Read current tab from URL parameter, fallback to 'desk'
  const currentTab = searchParams.get('tab') || 'desk';
  
  const [loans, setLoans] = useState([]);
  const [searchId, setSearchId] = useState('0');

  const refreshLoans = async () => {
    const list = await getActiveLoans(Number(searchId));
    setLoans(list as any);
  };

  useEffect(() => {
    if (currentTab === 'desk') {
      refreshLoans();
    }
  }, [searchId, currentTab]);

  const setTab = (tabName: string) => {
    router.push(`/?tab=${tabName}`);
  };

  // Shared structural styles for clean presentation
  const navItemStyle = (tab: string) => ({
    padding: '10px 20px',
    cursor: 'pointer',
    background: currentTab === tab ? '#0070f3' : 'transparent',
    color: currentTab === tab ? '#fff' : '#333',
    border: 'none',
    borderRadius: '4px',
    fontWeight: 'bold' as const,
    transition: 'all 0.2s'
  });

  return (
    <main style={{ maxWidth: '900px', margin: '20px auto', fontFamily: 'sans-serif', padding: '0 20px' }}>
      
      {/* Top Navigation Bar */}
      <nav style={{ 
        display: 'flex', 
        gap: '10px', 
        background: '#f0f0f0', 
        padding: '10px', 
        borderRadius: '6px', 
        marginBottom: '24px' 
      }}>
        <button onClick={() => setTab('desk')} style={navItemStyle('desk')}>Circulation Desk</button>
        <button onClick={() => setTab('books')} style={navItemStyle('books')}>Manage Books</button>
        <button onClick={() => setTab('members')} style={navItemStyle('members')}>Manage Members</button>
      </nav>

      {/* View Router */}
      {currentTab === 'desk' && (
        <div>
          <h2>Circulation Desk</h2>
          <CounterOperations onRefresh={refreshLoans} />
          
          <div style={{ marginTop: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3>Active Outstanding Loans</h3>
              <input 
                type="number" 
                placeholder="Filter by Member ID (0 for all)" 
                onChange={e => setSearchId(e.target.value || '0')} 
                style={{ padding: '6px' }}
              />
            </div>
            
            {loans.length === 0 ? <p>No active operations registered.</p> : (
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                <thead>
                  <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ccc', textAlign: 'left' }}>
                    <th style={{ padding: '8px' }}>Member</th>
                    <th style={{ padding: '8px' }}>Book Title</th>
                    <th style={{ padding: '8px' }}>Checkout Date</th>
                    <th style={{ padding: '8px' }}>Expected Due Date</th>
                  </tr>
                </thead>
                <tbody>
                  {loans.map((loan: any) => (
                    <tr key={loan.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '8px' }}>{loan.member?.name} (ID: {loan.member_id})</td>
                      <td style={{ padding: '8px' }}>{loan.book?.title}</td>
                      <td style={{ padding: '8px' }}>{loan.borrow_date}</td>
                      <td style={{ padding: '8px' }}>{loan.due_date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {currentTab === 'books' && (
        <div>
          <h2>Book Inventory Administration</h2>
          <BookManagement />
        </div>
      )}

      {currentTab === 'members' && (
        <div>
          <h2>Member Registry Administration</h2>
          <MemberManagement />
        </div>
      )}

    </main>
  );
}