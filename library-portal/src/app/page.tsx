'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import CirculationDesk from './CirculationDesk';
import BookManagement from './BookManagement';
import MemberManagement from './MemberManagement';

export default function Home() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const currentTab = searchParams.get('tab') || 'desk';
  
  const setTab = (tabName: string) => {
    router.push(`/?tab=${tabName}`);
  };

  const navItemStyle = (tab: string) => ({
    padding: '10px 20px',
    cursor: 'pointer',
    background: currentTab === tab ? 'var(--saffron-primary, #FF6600)' : 'transparent',
    color: currentTab === tab ? '#fff' : 'var(--text-dark, #333)',
    border: 'none',
    borderRadius: '4px',
    fontWeight: 'bold' as const,
    transition: 'all 0.2s ease-in-out'
  });

  return (
    <main style={{ 
      maxWidth: '1000px', 
      margin: '20px auto', 
      fontFamily: 'sans-serif', 
      padding: '0 20px',
      color: 'var(--text-dark)'
    }}>
      
      {/* Top Adaptive Navigation Bar */}
      <nav style={{ 
        display: 'flex', 
        gap: '10px', 
        background: 'var(--progress-bg, rgba(0,0,0,0.05))', 
        padding: '8px', 
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
          <h2 style={{ marginBottom: '16px', color: 'var(--text-dark)' }}>Circulation Desk Counter</h2>
          <CirculationDesk />
        </div>
      )}

      {currentTab === 'books' && (
        <div>
          <h2 style={{ marginBottom: '16px', color: 'var(--text-dark)' }}>Book Inventory Administration</h2>
          <BookManagement />
        </div>
      )}

      {currentTab === 'members' && (
        <div>
          <h2 style={{ marginBottom: '16px', color: 'var(--text-dark)' }}>Member Registry Administration</h2>
          <MemberManagement />
        </div>
      )}

    </main>
  );
}