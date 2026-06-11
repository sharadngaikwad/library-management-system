'use client';

import { useEffect, useState } from 'react';
import { getAllMembers, registerMemberAction, updateMemberAction } from './actions';

interface Member {
  id?: number;
  name: string;
  email: string;
  phone: string;
}

export default function MemberManagement() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal Workflow State Tracker Modules
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);

  // Form Input Element Values
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const loadMembers = async () => {
    const data = await getAllMembers();
    setMembers(data as Member[]);
    setLoading(false);
  };

  useEffect(() => {
    loadMembers();
  }, []);

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

    // ==========================================
    // 1. MANDATORY FORM VALUE VALIDATIONS
    // ==========================================
    const cleanName = name.trim();
    const cleanEmail = email.trim();
    const cleanPhone = phone.trim().replace(/[- ]/g, ''); // Strip spacing blocks/dashes

    if (!cleanName) {
      setErrorMessage('The Patron Full Name field is mandatory.');
      return;
    }
    if (!cleanEmail) {
      setErrorMessage('The Email Address field is mandatory.');
      return;
    }
    if (!cleanPhone) {
      setErrorMessage('The Mobile Contact Number is mandatory.');
      return;
    }

    // Email Pattern Structural Regex Verification
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setErrorMessage('Malformed Email Syntax. Please provide a valid address.');
      return;
    }

    // Mobile Number Format Validation (Enforces standard 10-digit layout)
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(cleanPhone)) {
      setErrorMessage('Invalid Mobile Number. Input must be exactly 10 digits long.');
      return;
    }

    // Check for duplicate phone/email locally before hitting the database
    const isDuplicatePhone = members.some(
      m => m.phone.replace(/[- ]/g, '') === cleanPhone && m.id !== editingMember?.id
    );
    if (isDuplicatePhone) {
      setErrorMessage('This Mobile Number is already assigned to a registered member.');
      return;
    }

    // ==========================================
    // 2. DISPATCH MUTATION DATA PAYLOADS
    // ==========================================
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
      setLoading(true);
      await loadMembers(); // Refreshes view and sorts automatically
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while saving the profile details.');
    }
  };

  if (loading && members.length === 0) return <p style={{ color: 'var(--text-dark)' }}>Loading user records...</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, color: 'var(--text-dark)' }}>Registered Patrons ({members.length})</h3>
        <button onClick={openRegisterModal} style={{ 
          padding: '8px 12px', background: 'var(--saffron-primary, #0070f3)', 
          color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' 
        }}>
          + Register Member
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
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
              <tr key={member.id} style={{ borderBottom: '1px solid var(--progress-bg, #eee)' }}>
                {/* 1. Full Name */}
                <td style={{ padding: '12px 10px', fontWeight: 'bold' }}>
                  {member.name}
                </td>
                
                {/* 2. Email Address */}
                <td style={{ padding: '12px 10px' }}>
                  {member.email}
                </td>
                
                {/* 3. Card ID */}
                <td style={{ padding: '12px 10px', color: 'var(--text-muted, #666)', fontFamily: 'monospace' }}>
                  #{member.id}
                </td>
                
                {/* 4. Mobile Number */}
                <td style={{ padding: '12px 10px', color: 'var(--text-dark)' }}>
                  {member.phone || 'N/A'}
                </td>

                {/* Modifiers Operation Hook Row */}
                <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                  <button onClick={() => openEditModal(member)} style={{
                    padding: '6px 12px', background: 'transparent', border: '1px solid var(--saffron-primary, #0070f3)',
                    color: 'var(--saffron-primary, #0070f3)', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px'
                  }}>
                    Modify Profile
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Symmetrical Modal Form Overlay System */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div style={{
            background: 'var(--background, #fff)', color: 'var(--text-dark, #333)',
            padding: '24px', borderRadius: '8px', width: '100%', maxWidth: '450px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px' }}>
              {editingMember ? 'Modify Patron Profile' : 'Register New Library Member'}
            </h3>
            
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>
                  Full Name <span style={{ color: 'var(--warning-red, #d32f2f)' }}>*</span>
                </label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} />
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>
                  Email Address <span style={{ color: 'var(--warning-red, #d32f2f)' }}>*</span>
                </label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} />
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>
                  Mobile Number <span style={{ color: 'var(--warning-red, #d32f2f)' }}>*</span>
                </label>
                <input type="text" placeholder="10 digit contact number" value={phone} onChange={e => setPhone(e.target.value)} style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} />
              </div>

              {errorMessage && (
                <p style={{ color: 'var(--warning-red, #d32f2f)', margin: 0, fontSize: '14px', fontWeight: 'bold' }}>
                  {errorMessage}
                </p>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '8px 14px', background: 'transparent', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="submit" style={{ padding: '8px 14px', background: 'var(--saffron-primary, #0070f3)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
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