'use client';

import { useEffect, useState } from 'react';
import { getAllMembers, registerMemberAction, updateMemberAction } from './actions';

interface Member {
  id?: number;
  name: string;
  email: string;
  phone: string;
}

interface FetchMembersResponse {
  members: Member[];
  totalRecords: number;
}

export default function MemberManagement() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  // --- SERVER-SIDE PAGINATION STATES ---
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);

  // Modal Workflow State Tracker Modules
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);

  // Form Input Element Values
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const loadMembers = async () => {
    setLoading(true);
    try {
      const response = (await getAllMembers({
        page: currentPage,
        pageSize: itemsPerPage,
      })) as FetchMembersResponse;

      setMembers(response.members || []);
      setTotalRecords(response.totalRecords || 0);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to sync dataset rows from backend.');
    } finally {
      setLoading(false);
    }
  };

  // Trigger automated data refreshing hook cycles
  useEffect(() => {
    loadMembers();
  }, [currentPage, itemsPerPage]);

  const totalPages = Math.ceil(totalRecords / itemsPerPage) || 1;

  const handlePageSizeChange = (newSize: number) => {
    setItemsPerPage(newSize);
    setCurrentPage(1); // Boundary reset protection
  };

  const openRegisterModal = () => {
    setEditingMember(null);
    setName('');
    setEmail('');
    setPhone('');
    setErrorMessage('');
    setIsModalOpen(true);
  };

  const openEditModal = (member: Member) => {
    setEditingMember(member);
    setName(member.name);
    setEmail(member.email);
    setPhone(member.phone);
    setErrorMessage('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanName = name.trim();
    const cleanEmail = email.trim();
    const cleanPhone = phone.trim().replace(/[- ]/g, '');

    if (!cleanName || !cleanEmail || !cleanPhone) {
      setErrorMessage('All core fields marked with an asterisk are mandatory.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setErrorMessage('Malformed Email Syntax. Please provide a valid address.');
      return;
    }

    const phoneRegex = /^\d{11}$|^\d{10}$/;
    if (!phoneRegex.test(cleanPhone)) {
      setErrorMessage('Invalid Mobile Number. Input must be exactly 10 digits long.');
      return;
    }

    try {
      if (editingMember && editingMember.id) {
        await updateMemberAction({
          id: editingMember.id,
          name: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
        });
      } else {
        await registerMemberAction({
          name: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
        });
      }

      setIsModalOpen(false);
      if (!editingMember) setCurrentPage(1); 
      await loadMembers();
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while saving the profile details.');
    }
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

      if (startPage > 2) {
        pageNumbers.push('...');
      }

      for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(i);
      }

      if (endPage < totalPages - 1) {
        pageNumbers.push('...');
      }

      pageNumbers.push(totalPages);
    }

    return pageNumbers;
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, color: 'var(--text-dark)' }}>
          Registered Patrons ({totalRecords} total members)
        </h3>
        <button onClick={openRegisterModal} style={{ 
          padding: '8px 12px', background: 'var(--saffron-primary, #FF6600)', 
          color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' 
        }}>
          + Register Member
        </button>
      </div>

      {/* Persistent view container preventing DOM drops during server action trips */}
      <div style={{ overflowX: 'auto', minHeight: '240px', position: 'relative' }}>
        {loading && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(1px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10
          }}>
            <p style={{ color: 'var(--text-dark)', fontWeight: 'bold', background: 'var(--progress-bg, #eee)', padding: '8px 16px', borderRadius: '4px' }}>
              Refreshing Record Window...
            </p>
          </div>
        )}

        {members.length === 0 && !loading ? (
          <p style={{ color: 'var(--text-muted, #777)', padding: '40px 20px', textAlign: 'center' }}>
            No member accounts mapped to this parameters slice window.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--text-dark)' }}>
            <thead>
              <tr style={{ 
                background: 'var(--progress-bg, rgba(0, 0, 0, 0.05))', 
                borderBottom: '2px solid var(--saffron-border, #ccc)', 
                textAlign: 'left' 
              }}>
                <th style={{ padding: '12px 10px' }}>Full Name</th>
                <th style={{ padding: '12px 10px' }}>Email Address</th>
                <th style={{ padding: '12px 10px' }}>Card ID</th>
                <th style={{ padding: '12px 10px' }}>Mobile Number</th>
                <th style={{ padding: '12px 10px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} style={{ borderBottom: '1px solid var(--progress-bg, #eee)', opacity: loading ? 0.6 : 1 }}>
                  <td style={{ padding: '12px 10px', fontWeight: 'bold' }}>{member.name}</td>
                  <td style={{ padding: '12px 10px' }}>{member.email}</td>
                  <td style={{ padding: '12px 10px', color: 'var(--text-muted, #666)', fontFamily: 'monospace' }}>#{member.id}</td>
                  <td style={{ padding: '12px 10px' }}>{member.phone || 'N/A'}</td>
                  <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                    <button onClick={() => openEditModal(member)} disabled={loading} style={{
                      padding: '6px 12px', background: 'transparent', border: '1px solid var(--saffron-primary, #FF6600)',
                      color: 'var(--saffron-primary, #FF6600)', borderRadius: '4px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '13px'
                    }}>
                      Modify Profile
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* --- SERVER SIDE PAGINATION CONTROL FOOTER BLOCK --- */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginTop: '20px', 
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        {/* Dropdown Page Size Config Node Selector */}
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

        {/* Persistent Navigation Panel */}
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
                <span 
                  key={`ellipsis-${index}`} 
                  style={{ padding: '6px 8px', color: 'var(--text-muted, #666)', fontSize: '14px' }}
                >
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

      {/* OVERLAY PROFILE MODAL */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div style={{
            background: 'var(--progress-bg, #fff)', 
            color: 'var(--text-dark, #333)',
            padding: '24px', borderRadius: '8px', width: '100%', maxWidth: '450px', 
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            border: '1px solid var(--saffron-border, #ccc)'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px', color: 'var(--text-dark)' }}>
              {editingMember ? 'Modify Patron Profile' : 'Register New Library Member'}
            </h3>
            
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px', color: 'var(--text-dark)' }}>Full Name *</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', padding: '8px', boxSizing: 'border-box', background: 'var(--progress-bg, #fff)', color: 'var(--text-dark)', border: '1px solid var(--saffron-border, #ccc)', borderRadius: '4px' }} />
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px', color: 'var(--text-dark)' }}>Email Address *</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: '8px', boxSizing: 'border-box', background: 'var(--progress-bg, #fff)', color: 'var(--text-dark)', border: '1px solid var(--saffron-border, #ccc)', borderRadius: '4px' }} />
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px', color: 'var(--text-dark)' }}>Mobile Number *</label>
                <input type="text" placeholder="10 digit contact number" value={phone} onChange={e => setPhone(e.target.value)} style={{ width: '100%', padding: '8px', boxSizing: 'border-box', background: 'var(--progress-bg, #fff)', color: 'var(--text-dark)', border: '1px solid var(--saffron-border, #ccc)', borderRadius: '4px' }} />
              </div>

              {errorMessage && <p style={{ color: 'var(--warning-red, #d32f2f)', margin: 0, fontSize: '14px', fontWeight: 'bold' }}>{errorMessage}</p>}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '8px 14px', background: 'transparent', border: '1px solid var(--saffron-border, #ccc)', color: 'var(--text-dark)', borderRadius: '4px', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="submit" style={{ padding: '8px 14px', background: 'var(--saffron-primary, #FF6600)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                  Save Profile Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}