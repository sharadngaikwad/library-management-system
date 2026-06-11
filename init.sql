-- init.sql

CREATE TABLE IF NOT EXISTS books (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255) NOT NULL,
    isbn VARCHAR(50) UNIQUE NOT NULL,
    available_copies INT NOT NULL DEFAULT 1 CHECK (available_copies >= 0)
);

CREATE TABLE IF NOT EXISTS members (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS operations (
    id SERIAL PRIMARY KEY,
    member_id INT REFERENCES members(id) ON DELETE RESTRICT,
    book_id INT REFERENCES books(id) ON DELETE RESTRICT,
    borrow_date DATE NOT NULL DEFAULT CURRENT_DATE,
    return_date DATE,
    due_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '14 days')
);

CREATE INDEX idx_operations_member ON operations(member_id);
CREATE INDEX idx_operations_active_book ON operations(book_id) WHERE return_date IS NULL;

-- ============================================================================
-- DATA SEEDING: 20 MEMEBERS
-- ============================================================================
INSERT INTO members (id, name, email, phone) VALUES
(1, 'Aarav Sharma', 'aarav.sharma@email.com', '9876543210'),
(2, 'Diya Patel', 'diya.patel@email.com', '9812345678'),
(3, 'James Smith', 'james.smith@email.com', '555-0101'),
(4, 'Emma Johnson', 'emma.johnson@email.com', '555-0102'),
(5, 'Vihaan Gupta', 'vihaan.gupta@email.com', '9765432109'),
(6, 'Ananya Iyer', 'ananya.iyer@email.com', '9654321098'),
(7, 'Liam Brown', 'liam.brown@email.com', '555-0103'),
(8, 'Olivia Jones', 'olivia.jones@email.com', '555-0104'),
(9, 'Kabir Verma', 'kabir.verma@email.com', '9543210987'),
(10, 'Meera Reddy', 'meera.reddy@email.com', '9432109876'),
(11, 'Noah Miller', 'noah.miller@email.com', '555-0105'),
(12, 'Ava Davis', 'ava.davis@email.com', '555-0106'),
(13, 'Rohan Joshi', 'rohan.joshi@email.com', '9321098765'),
(14, 'Sana Khan', 'sana.khan@email.com', '9210987654'),
(15, 'Lucas Rodriguez', 'lucas.rod@email.com', '555-0107'),
(16, 'Sophia Martinez', 'sophia.mtz@email.com', '555-0108'),
(17, 'Arjun Nair', 'arjun.nair@email.com', '9109876543'),
(18, 'Isha Choudhury', 'isha.choud@email.com', '9019876542'),
(19, 'Mason Wilson', 'mason.wilson@email.com', '555-0109'),
(20, 'Isabella Anderson', 'isabella.and@email.com', '555-0110')
ON CONFLICT (email) DO NOTHING;

-- Adjust sequence value to prevent auto-increment conflicts later
SELECT setval('members_id_seq', COALESCE((SELECT MAX(id) FROM members), 1));

-- ============================================================================
-- DATA SEEDING: 100 BOOKS
-- ============================================================================
INSERT INTO books (id, title, author, isbn, available_copies) VALUES
(1, 'To Kill a Mockingbird', 'Harper Lee', '9780061120084', 3),
(2, '1984', 'George Orwell', '9780451524935', 4),
(3, 'The Great Gatsby', 'F. Scott Fitzgerald', '9780743273565', 2),
(4, 'The Catcher in the Rye', 'J.D. Salinger', '9780316769174', 3),
(5, 'The Hobbit', 'J.R.R. Tolkien', '9780547928227', 5),
(6, 'Fahrenheit 451', 'Ray Bradbury', '9781451673319', 3),
(7, 'Animal Farm', 'George Orwell', '9780451526342', 2),
(8, 'Brave New World', 'Aldous Huxley', '9780060850524', 4),
(9, 'The Grapes of Wrath', 'John Steinbeck', '9780143039433', 2),
(10, 'One Hundred Years of Solitude', 'Gabriel Garcia Marquez', '9780060883287', 3),
(11, 'Lord of the Flies', 'William Golding', '9780399501487', 3),
(12, 'The Odyssey', 'Homer', '9780140268867', 2),
(13, 'The Illusion of Time', 'Albert Einstein', '9783110563456', 1),
(14, 'The Stranger', 'Albert Camus', '9780679720201', 3),
(15, 'The Catch-22', 'Joseph Heller', '9781451626650', 2),
(16, 'The Sun Also Rises', 'Ernest Hemingway', '9780684801469', 2),
(17, 'The Trial', 'Franz Kafka', '9780805209990', 3),
(18, 'Crime and Punishment', 'Fyodor Dostoevsky', '9780140449136', 3),
(19, 'The Brothers Karamazov', 'Fyodor Dostoevsky', '9780374528379', 2),
(20, 'Pride and Prejudice', 'Jane Austen', '9780141439518', 4),
(21, 'Wuthering Heights', 'Emily Bronte', '9780141439556', 2),
(22, 'Jane Eyre', 'Charlotte Bronte', '9780141441146', 3),
(23, 'Moby-Dick', 'Herman Melville', '9780142437247', 2),
(24, 'The Scarlet Letter', 'Nathaniel Hawthorne', '9780142437261', 2),
(25, 'Great Expectations', 'Charles Dickens', '9780141439563', 3),
(26, 'A Tale of Two Cities', 'Charles Dickens', '9780141439600', 3),
(27, 'Gulliver''s Travels', 'Jonathan Swift', '9780141439495', 2),
(28, 'Frankenstein', 'Mary Shelley', '9780141439471', 4),
(29, 'Dracula', 'Bram Stoker', '9780141439846', 3),
(30, 'The Picture of Dorian Gray', 'Oscar Wilde', '9780141439570', 3),
(31, 'The Metamorphosis', 'Franz Kafka', '9781613824108', 4),
(32, 'The Divine Comedy', 'Dante Alighieri', '9780140448955', 2),
(33, 'Paradise Lost', 'John Milton', '9780140424393', 1),
(34, 'The Iliad', 'Homer', '9780140275360', 2),
(35, 'Don Quixote', 'Miguel de Cervantes', '9780060934347', 2),
(36, 'Ulysses', 'James Joyce', '9780679722762', 1),
(37, 'The Sound and the Fury', 'William Faulkner', '9780679732242', 2),
(38, 'As I Lay Dying', 'William Faulkner', '9780679732259', 2),
(39, 'The Old Man and the Sea', 'Ernest Hemingway', '9780684801223', 3),
(40, 'For Whom the Bell Tolls', 'Ernest Hemingway', '9780684803357', 2),
(41, 'Lolita', 'Vladimir Nabokov', '9780679723165', 2),
(42, 'The Count of Monte Cristo', 'Alexandre Dumas', '9780140449266', 3),
(43, 'The Three Musketeers', 'Alexandre Dumas', '9780140440256', 2),
(44, 'Les Misérables', 'Victor Hugo', '9780451419439', 2),
(45, 'The Hunchback of Notre-Dame', 'Victor Hugo', '9780140443530', 2),
(46, 'Madame Bovary', 'Gustave Flaubert', '9780140449129', 2),
(47, 'The Age of Innocence', 'Edith Wharton', '9780140187311', 2),
(48, 'The House of Mirth', 'Edith Wharton', '9780140187298', 1),
(49, 'Sister Carrie', 'Theodore Dreiser', '9780451530547', 1),
(50, 'The Jungle', 'Upton Sinclair', '9780451528452', 2),
(51, 'The Awakening', 'Kate Chopin', '9780451524485', 2),
(52, 'The Yellow Wallpaper', 'Charlotte Perkins Gilman', '9781594744495', 3),
(53, 'Heart of Darkness', 'Joseph Conrad', '9780451531391', 3),
(54, 'Lord Jim', 'Joseph Conrad', '9780451531230', 1),
(55, 'Invisible Man', 'Ralph Ellison', '9780679732761', 2),
(56, 'Native Son', 'Richard Wright', '9780060837563', 2),
(57, 'Go Tell It on the Mountain', 'James Baldwin', '9780345806543', 2),
(58, 'Giovanni''s Room', 'James Baldwin', '9780345806567', 2),
(59, 'Beloved', 'Toni Morrison', '9781400033416', 3),
(60, 'Song of Solomon', 'Toni Morrison', '9781400033423', 2),
(61, 'Sula', 'Toni Morrison', '9781400033430', 2),
(62, 'The Color Purple', 'Alice Walker', '9780156028356', 3),
(63, 'Midnight''s Children', 'Salman Rushdie', '9780812976533', 2),
(64, 'The Satanic Verses', 'Salman Rushdie', '9780812976540', 1),
(65, 'Things Fall Apart', 'Chinua Achebe', '9780385474542', 4),
(66, 'No Longer at Ease', 'Chinua Achebe', '9780385519175', 2),
(67, 'Arrow of God', 'Chinua Achebe', '9780385014809', 1),
(68, 'A Grain of Wheat', 'Ngũgĩ wa Thiong''o', '9780143106760', 2),
(69, 'Petals of Blood', 'Ngũgĩ wa Thiong''o', '9780143106487', 1),
(70, 'The God of Small Things', 'Arundhati Roy', '9780812979657', 3),
(71, 'The White Tiger', 'Aravind Adiga', '9781416562603', 3),
(72, 'Interpreter of Maladies', 'Jhumpa Lahiri', '9780395927205', 4),
(73, 'The Namesake', 'Jhumpa Lahiri', '9780618485222', 3),
(74, 'A Fine Balance', 'Rohinton Mistry', '9781400030651', 2),
(75, 'Midnight in Peking', 'Paul French', '9780143121008', 2),
(76, 'The Shadow of the Wind', 'Carlos Ruiz Zafón', '9780143126393', 3),
(77, 'The Alchemist', 'Paulo Coelho', '9780061122415', 5),
(78, 'Veronika Decides to Die', 'Paulo Coelho', '9780061166938', 2),
(79, 'The Da Vinci Code', 'Dan Brown', '9780307474278', 4),
(80, 'Angels & Demons', 'Dan Brown', '9780307474209', 3),
(81, 'Life of Pi', 'Yann Martel', '9780156027328', 3),
(82, 'The Book Thief', 'Markus Zusak', '9780375842207', 4),
(83, 'The Kite Runner', 'Khaled Hosseini', '9781594631931', 4),
(84, 'A Thousand Splendid Suns', 'Khaled Hosseini', '9781594631948', 3),
(85, 'The Road', 'Cormac McCarthy', '9780307387899', 3),
(86, 'No Country for Old Men', 'Cormac McCarthy', '9780375703867', 2),
(87, 'Blood Meridian', 'Cormac McCarthy', '9780679736707', 2),
(88, 'A Game of Thrones', 'George R.R. Martin', '9780553593716', 5),
(89, 'A Clash of Kings', 'George R.R. Martin', '9780553579901', 4),
(90, 'A Storm of Swords', 'George R.R. Martin', '9780553573428', 4),
(91, 'Neuromancer', 'William Gibson', '9780441569595', 3),
(92, 'Snow Crash', 'Neal Stephenson', '9780553380958', 2),
(93, 'Dune', 'Frank Herbert', '9780441172719', 5),
(94, 'Foundation', 'Isaac Asimov', '9780553293357', 4),
(95, 'I, Robot', 'Isaac Asimov', '9780553382563', 3),
(96, 'Starship Troopers', 'Robert A. Heinlein', '9780441783588', 2),
(97, 'The Left Hand of Darkness', 'Ursula K. Le Guin', '9780441478125', 3),
(98, 'The Dispossessed', 'Ursula K. Le Guin', '9780061054884', 2),
(99, 'American Gods', 'Neil Gaiman', '9780312688103', 3),
(100, 'Good Omens', 'Terry Pratchett & Neil Gaiman', '9780060853969', 3)
ON CONFLICT (isbn) DO NOTHING;

-- Adjust sequence value to prevent auto-increment conflicts later
SELECT setval('books_id_seq', COALESCE((SELECT MAX(id) FROM books), 1));