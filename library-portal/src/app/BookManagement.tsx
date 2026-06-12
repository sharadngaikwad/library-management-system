'use client';

import { useEffect, useState } from 'react';
import { getAllBooks, createBookAction, updateBookAction } from './actions';

interface Book {
  id?: number;
  title: string;
  author: string;
  isbn: string;
  total_copies: number;
  available_copies: number;
}

export default function BookManagement() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [isbn, setIsbn] = useState('');
  const [totalCopies, setTotalCopies] = useState(1);
  const [availableCopies, setAvailableCopies] = useState(1);
  const [errorMessage, setErrorMessage] = useState('');

  const loadBooks = async () => {
    const data = await getAllBooks();
    setBooks(data as Book[]);
    setLoading(false);
  };

  useEffect(() => {
    loadBooks();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanTitle = title.trim();
    const cleanAuthor = author.trim();
    const cleanIsbn = isbn.trim().replace(/[- ]/g, '');

    if (!cleanTitle || !cleanAuthor || !cleanIsbn) {
      setErrorMessage('All core fields marked with an asterisk are mandatory.');
      return;
    }

    if (totalCopies < 0 || isNaN(totalCopies)) {
      setErrorMessage('Total inventory assets cannot be negative.');
      return;
    }

    try {
      if (editingBook && editingBook.id) {
        // While editing, we pass the total copies. The backend handles the rest.
        await updateBookAction({
          id: editingBook.id,
          title: cleanTitle,
          author: cleanAuthor,
          isbn: cleanIsbn, 
          total_copies: totalCopies,
          available_copies: availableCopies // Stays consistent with what was loaded
        });
      } else {
        // While creating, available_copies is guaranteed to match total_copies
        await createBookAction({
          title: cleanTitle,
          author: cleanAuthor,
          isbn: cleanIsbn, 
          total_copies: totalCopies,
          available_copies: totalCopies 
        });
      }

      setIsModalOpen(false);
      setLoading(true);
      await loadBooks();
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while saving the profile.');
    }
  };

  const openAddModal = () => {
    setEditingBook(null);
    setTitle('');
    setAuthor('');
    setIsbn('');
    setTotalCopies(1);
    setAvailableCopies(1); // Default matches total
    setErrorMessage('');
    setIsModalOpen(true);
  };

  const openEditModal = (book: Book) => {
    setEditingBook(book);
    setTitle(book.title);
    setAuthor(book.author);
    setIsbn(book.isbn);
    setTotalCopies(book.total_copies);
    setAvailableCopies(book.available_copies); // Lock in current system stock
    setErrorMessage('');
    setIsModalOpen(true);
  };

  if (loading && books.length === 0) return <p style={{ color: 'var(--text-dark)' }}>Loading catalog data...</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, color: 'var(--text-dark)' }}>Catalog Collection ({books.length})</h3>
        <button onClick={openAddModal} style={{ 
          padding: '8px 12px', background: 'var(--saffron-primary, #FF6600)', 
          color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' 
        }}>
          + Add New Book
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--text-dark)' }}>
          <thead>
            <tr style={{ background: 'var(--progress-bg, rgba(0, 0, 0, 0.05))', borderBottom: '2px solid var(--saffron-border, #ccc)', textAlign: 'left' }}>
              <th style={{ padding: '12px 10px' }}>Title</th>
              <th style={{ padding: '12px 10px' }}>ISBN</th>
              <th style={{ padding: '12px 10px' }}>Book ID</th>
              <th style={{ padding: '12px 10px' }}>Stock Inventory Status</th>
              <th style={{ padding: '12px 10px', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {books.map((book) => (
              <tr key={book.id} style={{ borderBottom: '1px solid var(--progress-bg, #eee)' }}>
                <td style={{ padding: '12px 10px' }}>
                  <div style={{ fontWeight: 'bold' }}>{book.title}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted, #666)' }}>by {book.author}</div>
                </td>
                <td style={{ padding: '12px 10px', fontFamily: 'monospace', fontSize: '14px' }}>{book.isbn}</td>
                <td style={{ padding: '12px 10px', color: 'var(--text-muted, #666)' }}>#{book.id}</td>
                <td style={{ padding: '12px 10px' }}>
                  <span style={{ 
                    background: book.available_copies > 0 ? 'var(--success-border, rgba(46, 125, 50, 0.15))' : 'var(--warning-border, rgba(211, 47, 47, 0.15))',
                    color: book.available_copies > 0 ? 'var(--success-green, #2e7d32)' : 'var(--warning-red, #d32f2f)',
                    padding: '6px 10px', borderRadius: '4px', fontSize: '13px', fontWeight: 'bold', display: 'inline-block'
                  }}>
                    {book.available_copies} / {book.total_copies} available
                  </span>
                </td>
                <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                  <button onClick={() => openEditModal(book)} style={{
                    padding: '6px 12px', background: 'transparent', border: '1px solid var(--saffron-primary, #FF6600)',
                    color: 'var(--saffron-primary, #FF6600)', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px'
                  }}>
                    Modify Profile
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div style={{
            background: '#fff', color: 'var(--text-dark, #333)',
            padding: '24px', borderRadius: '8px', width: '100%', maxWidth: '450px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px' }}>{editingBook ? 'Modify Book Profile' : 'Catalog New Inventory'}</h3>
            
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Book Title *</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} />
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Author Name *</label>
                <input type="text" value={author} onChange={e => setAuthor(e.target.value)} style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} />
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>ISBN Identification *</label>
                <input type="text" value={isbn} onChange={e => setIsbn(e.target.value)} disabled={!!editingBook} style={{ width: '100%', padding: '8px', boxSizing: 'border-box', background: editingBook ? '#eee' : 'inherit', cursor: editingBook ? 'not-allowed' : 'text' }} />
              </div>
              
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Total Owned Copies</label>
                  <input 
                    type="number" 
                    min="0" 
                    value={totalCopies} 
                    onChange={e => {
                      const val = Number(e.target.value);
                      setTotalCopies(val);
                      // Automatic Sync: While adding a new record, live available copies matches total copies
                      if (!editingBook) {
                        setAvailableCopies(val);
                      }
                    }} 
                    style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} 
                  />
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px', color: '#666' }}>
                    Available Stock
                  </label>
                  <input 
                    type="number" 
                    disabled={true} // ALWAYS disabled per instructions to prevent user manipulation mismatch
                    value={availableCopies} 
                    style={{ 
                      width: '100%', 
                      padding: '8px', 
                      boxSizing: 'border-box', 
                      background: '#f5f5f5', 
                      color: '#777', 
                      border: '1px solid #ddd', 
                      cursor: 'not-allowed' 
                    }} 
                  />
                </div>
              </div>

              {errorMessage && <p style={{ color: 'var(--warning-red, #d32f2f)', margin: 0, fontSize: '14px', fontWeight: 'bold' }}>{errorMessage}</p>}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '8px 14px', background: 'transparent', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' }}>
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