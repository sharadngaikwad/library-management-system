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

interface FetchBooksResponse {
  books: Book[];
  totalRecords: number;
}

export default function BookManagement() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  
  // --- SERVER-SIDE PAGINATION STATES ---
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10); 
  const [totalRecords, setTotalRecords] = useState(0);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [isbn, setIsbn] = useState('');
  const [totalCopies, setTotalCopies] = useState(1);
  const [availableCopies, setAvailableCopies] = useState(1);
  
  // Isolated error tracking states
  const [errorMessage, setErrorMessage] = useState('');
  const [modalErrorMessage, setModalErrorMessage] = useState('');
  const [modalSuccessMessage, setModalSuccessMessage] = useState('');

  const loadBooks = async () => {
    setLoading(true);
    try {
      const response = (await getAllBooks({ 
        page: currentPage, 
        pageSize: itemsPerPage 
      })) as FetchBooksResponse;

      setBooks(response.books || []);
      setTotalRecords(response.totalRecords || 0);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to sync dataset rows from backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBooks();
  }, [currentPage, itemsPerPage]);

  const totalPages = Math.ceil(totalRecords / itemsPerPage);

  const handlePageSizeChange = (newSize: number) => {
    setItemsPerPage(newSize);
    setCurrentPage(1); 
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalErrorMessage(''); // Clear previous popup modal errors
    setModalSuccessMessage('');

    const cleanTitle = title.trim();
    const cleanAuthor = author.trim();
    const cleanIsbn = isbn.trim().replace(/[- ]/g, '');

    if (!cleanTitle || !cleanAuthor || !cleanIsbn) {
      setModalErrorMessage('All core fields marked with an asterisk are mandatory.');
      return;
    }

    if (totalCopies < 0 || isNaN(totalCopies)) {
      setModalErrorMessage('Total inventory assets cannot be negative.');
      return;
    }

    try {
      let response: any;
      if (editingBook && editingBook.id) {
        response = await updateBookAction({
          id: editingBook.id,
          title: cleanTitle,
          author: cleanAuthor,
          isbn: cleanIsbn, 
          total_copies: totalCopies,
          available_copies: availableCopies 
        });
      } else {
        response = await createBookAction({
          title: cleanTitle,
          author: cleanAuthor,
          isbn: cleanIsbn, 
          total_copies: totalCopies,
          available_copies: totalCopies 
        });
      }

      // Check if the server action caught a backend error and returned it as a payload
      if (response && response.success === false) {
        setModalErrorMessage(response.message || 'An error occurred while saving the profile.');
        return;
      }

      // Display success inside the modal instead of closing it
      setModalSuccessMessage(editingBook ? 'Book successfully updated!' : 'Book successfully cataloged!');
      if (!editingBook) setCurrentPage(1); 
      await loadBooks();
    } catch (err: any) {
      // Directs the server action error straight into the pop-up modal view wrapper
      setModalErrorMessage(err.message || 'An error occurred while saving the profile.');
    }
  };

  const openAddModal = () => {
    setEditingBook(null);
    setTitle('');
    setAuthor('');
    setIsbn('');
    setTotalCopies(1);
    setAvailableCopies(1); 
    setModalErrorMessage(''); // Reset modal message explicitly
    setModalSuccessMessage('');
    setIsModalOpen(true);
  };

  const openEditModal = (book: Book) => {
    setEditingBook(book);
    setTitle(book.title);
    setAuthor(book.author);
    setIsbn(book.isbn);
    setTotalCopies(book.total_copies);
    setAvailableCopies(book.available_copies); 
    setModalErrorMessage(''); // Reset modal message explicitly
    setModalSuccessMessage('');
    setIsModalOpen(true);
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
      for (let i = startPage; i <= endPage; i++) pageNumbers.push(i);
      if (endPage < totalPages - 1) pageNumbers.push('...');
      pageNumbers.push(totalPages);
    }

    return pageNumbers;
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, color: 'var(--text-dark)' }}>
          Catalog Collection ({totalRecords} total books)
        </h3>
        <button onClick={openAddModal} style={{ 
          padding: '8px 12px', background: 'var(--saffron-primary, #FF6600)', 
          color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' 
        }}>
          + Add New Book
        </button>
      </div>

      {/* Main layout background/fetching context error notification layer */}
      {errorMessage && (
        <div style={{ color: 'var(--warning-red, #d32f2f)', padding: '10px 0', fontWeight: 'bold' }}>
          {errorMessage}
        </div>
      )}

      <div style={{ overflowX: 'auto', minHeight: '200px', position: 'relative' }}>
        {loading ? (
          <p style={{ color: 'var(--text-dark)', padding: '20px' }}>Loading catalog window view entries...</p>
        ) : books.length === 0 ? (
          <p style={{ color: 'var(--text-muted, #777)', padding: '20px', textAlign: 'center' }}>No catalog profiles mapped to this parameters slice window.</p>
        ) : (
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
            <option value={5} style={{ background: 'var(--progress-bg, #fff)', color: 'var(--text-dark)' }}>5</option>
            <option value={10} style={{ background: 'var(--progress-bg, #fff)', color: 'var(--text-dark)' }}>10</option>
            <option value={25} style={{ background: 'var(--progress-bg, #fff)', color: 'var(--text-dark)' }}>25</option>
            <option value={50} style={{ background: 'var(--progress-bg, #fff)', color: 'var(--text-dark)' }}>50</option>
          </select>
        </div>

        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button 
              disabled={currentPage === 1 || loading}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              style={{ 
                padding: '6px 12px', 
                borderRadius: '4px', 
                border: '1px solid var(--saffron-border, #ccc)', 
                background: 'var(--progress-bg, #fff)',
                color: 'var(--text-dark)',
                cursor: (currentPage === 1 || loading) ? 'not-allowed' : 'pointer', 
                opacity: (currentPage === 1 || loading) ? 0.4 : 1 
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
                  disabled={loading}
                  onClick={() => setCurrentPage(page as number)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '4px',
                    border: '1px solid var(--saffron-primary, #FF6600)',
                    background: isCurrent ? 'var(--saffron-primary, #FF6600)' : 'var(--progress-bg, #fff)',
                    color: isCurrent ? '#fff' : 'var(--text-dark)',
                    fontWeight: 'bold',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.7 : 1
                  }}
                >
                  {page}
                </button>
              );
            })}

            <button 
              disabled={currentPage === totalPages || loading}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              style={{ 
                padding: '6px 12px', 
                borderRadius: '4px', 
                border: '1px solid var(--saffron-border, #ccc)', 
                background: 'var(--progress-bg, #fff)',
                color: 'var(--text-dark)',
                cursor: (currentPage === totalPages || loading) ? 'not-allowed' : 'pointer', 
                opacity: (currentPage === totalPages || loading) ? 0.4 : 1 
              }}
            >
              Next »
            </button>
          </div>
        )}
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
              {editingBook ? 'Modify Book Profile' : 'Catalog New Inventory'}
            </h3>
            
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px', color: 'var(--text-dark)' }}>Book Title *</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} style={{ width: '100%', padding: '8px', boxSizing: 'border-box', background: 'var(--progress-bg, #fff)', color: 'var(--text-dark)', border: '1px solid var(--saffron-border, #ccc)', borderRadius: '4px' }} />
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px', color: 'var(--text-dark)' }}>Author Name *</label>
                <input type="text" value={author} onChange={e => setAuthor(e.target.value)} style={{ width: '100%', padding: '8px', boxSizing: 'border-box', background: 'var(--progress-bg, #fff)', color: 'var(--text-dark)', border: '1px solid var(--saffron-border, #ccc)', borderRadius: '4px' }} />
              </div>
              
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-dark)' }}>ISBN Identification *</label>
                  {!editingBook && (
                    <button
                      type="button"
                      onClick={() => {
                        // Generate a mathematically valid random ISBN-13
                        let prefix = '978';
                        for (let i = 0; i < 9; i++) prefix += Math.floor(Math.random() * 10);
                        let sum = 0;
                        for (let i = 0; i < 12; i++) sum += parseInt(prefix[i]) * (i % 2 === 0 ? 1 : 3);
                        const checkDigit = (10 - (sum % 10)) % 10;
                        
                        setIsbn(prefix + checkDigit);
                        setModalErrorMessage(''); // Clear out any previous errors
                      }}
                      style={{ fontSize: '11px', padding: '2px 8px', background: 'var(--progress-bg, #eee)', border: '1px solid var(--saffron-border, #ccc)', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-dark)' }}
                    >
                      Generate Valid ISBN For Test
                    </button>
                  )}
                </div>
                <input type="text" value={isbn} onChange={e => setIsbn(e.target.value)} disabled={!!editingBook} style={{ width: '100%', padding: '8px', boxSizing: 'border-box', background: editingBook ? 'rgba(0,0,0,0.1)' : 'var(--progress-bg, #fff)', color: 'var(--text-dark)', border: '1px solid var(--saffron-border, #ccc)', borderRadius: '4px', cursor: editingBook ? 'not-allowed' : 'text' }} />
              </div>
              
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px', color: 'var(--text-dark)' }}>Total Owned Copies</label>
                  <input 
                    type="number" 
                    min="0" 
                    value={totalCopies} 
                    onChange={e => {
                      const val = Number(e.target.value);
                      setTotalCopies(val);
                      if (!editingBook) {
                        setAvailableCopies(val);
                      }
                    }} 
                    style={{ width: '100%', padding: '8px', boxSizing: 'border-box', background: 'var(--progress-bg, #fff)', color: 'var(--text-dark)', border: '1px solid var(--saffron-border, #ccc)', borderRadius: '4px' }} 
                  />
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px', color: 'var(--text-muted)' }}>
                    Available Stock
                  </label>
                  <input 
                    type="number" 
                    disabled={true} 
                    value={availableCopies} 
                    style={{ 
                      width: '100%', 
                      padding: '8px', 
                      boxSizing: 'border-box', 
                      background: 'rgba(0,0,0,0.08)', 
                      color: 'var(--text-muted)', 
                      border: '1px solid var(--saffron-border, #ccc)', 
                      borderRadius: '4px',
                      cursor: 'not-allowed' 
                    }} 
                  />
                </div>
              </div>

              {/* Isolated Popup Error View Field block rendered contextually */}
              {modalErrorMessage && (
                <p style={{ color: 'var(--warning-red, #d32f2f)', margin: 0, fontSize: '14px', fontWeight: 'bold' }}>
                  {modalErrorMessage}
                </p>
              )}

              {modalSuccessMessage && (
                <p style={{ color: 'var(--success-green, #2e7d32)', margin: 0, fontSize: '14px', fontWeight: 'bold' }}>
                  ✓ {modalSuccessMessage}
                </p>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '8px 14px', background: 'transparent', border: '1px solid var(--saffron-border, #ccc)', color: 'var(--text-dark)', borderRadius: '4px', cursor: 'pointer' }}>
                  {modalSuccessMessage ? 'Close' : 'Cancel'}
                </button>
                {!modalSuccessMessage && (
                  <button type="submit" style={{ padding: '8px 14px', background: 'var(--saffron-primary, #FF6600)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                    Save Profile Changes
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}