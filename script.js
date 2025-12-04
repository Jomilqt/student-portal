// IndexedDB setup
const DB_NAME = 'SIS_DB';
const DB_VERSION = 1;
let db;

// Data storage
let users = [];
let students = [];
let currentUser = null;

// Function to calculate average grade
function calculateAverageGrade(grades) {
    if (grades.length === 0) return 'No grades';
    const gradeMap = { 'A': 95.9, 'B': 85.9, 'C': 75.9, 'D': 65.9, 'F': 55.9 };
    let total = 0;
    let count = 0;
    grades.forEach(g => {
        const num = gradeMap[g.grade.toUpperCase()];
        if (num !== undefined) {
            total += num;
            count++;
        }
    });
    if (count === 0) return 'No grades';
    const avg = total / count;
    const status = avg >= 74.5 ? 'Pass' : 'Fail';
    return `${avg.toFixed(1)} (${status})`;
}

// DOM Elements
const authTabs = document.getElementById('authTabs');
const mainApp = document.getElementById('mainApp');
const mainNav = document.getElementById('mainNav');
const userInfo = document.getElementById('userInfo');
const loggedInUser = document.getElementById('loggedInUser');

// Initialize IndexedDB
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('users')) {
                db.createObjectStore('users', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('students')) {
                db.createObjectStore('students', { keyPath: 'id' });
            }
        };
    });
}

// Load data from IndexedDB
async function loadData() {
    if (!db) await initDB();

    // Load users
    const userTransaction = db.transaction(['users'], 'readonly');
    const userStore = userTransaction.objectStore('users');
    const userRequest = userStore.getAll();
    userRequest.onsuccess = () => {
        users = userRequest.result;
    };

    // Load students
    const studentTransaction = db.transaction(['students'], 'readonly');
    const studentStore = studentTransaction.objectStore('students');
    const studentRequest = studentStore.getAll();
    studentRequest.onsuccess = () => {
        students = studentRequest.result;
    };

    // Wait for both transactions
    await new Promise((resolve) => {
        let count = 0;
        const checkDone = () => {
            count++;
            if (count === 2) resolve();
        };
        userTransaction.oncomplete = checkDone;
        studentTransaction.oncomplete = checkDone;
    });
}

// Save data to IndexedDB
async function saveUsers() {
    if (!db) await initDB();
    const transaction = db.transaction(['users'], 'readwrite');
    const store = transaction.objectStore('users');
    store.clear(); // Clear existing
    users.forEach(user => store.put(user));
    return new Promise((resolve) => {
        transaction.oncomplete = resolve;
    });
}

async function saveStudents() {
    if (!db) await initDB();
    const transaction = db.transaction(['students'], 'readwrite');
    const store = transaction.objectStore('students');
    store.clear(); // Clear existing
    students.forEach(student => store.put(student));
    return new Promise((resolve) => {
        transaction.oncomplete = resolve;
    });
}

// Initialize the application
document.addEventListener('DOMContentLoaded', async function() {
    await loadData();
    initializeAuthTabs();
    initializeMainTabs();
    checkLoginStatus();
    loadStudentsList();
});

// Authentication Tab Switching
function initializeAuthTabs() {
    const authTabBtns = document.querySelectorAll('.auth-tab-btn');
    const authContents = document.querySelectorAll('.auth-content');

    authTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            authTabBtns.forEach(b => b.classList.remove('active'));
            authContents.forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(btn.dataset.authTab).classList.add('active');
        });
    });
}

// Main Tab Switching
function initializeMainTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));

            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });
}

// Form Handlers
document.getElementById('login-form').addEventListener('submit', handleLogin);
document.getElementById('signup-form').addEventListener('submit', handleSignup);
document.getElementById('enrollment-form').addEventListener('submit', handleEnrollment);
document.getElementById('grade-form').addEventListener('submit', handleGradeSubmit);
document.getElementById('attendance-form').addEventListener('submit', handleAttendanceSubmit);

// Login Handler
function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    const user = users.find(u => u.username === username && u.password === password);
    
    if (user) {
        currentUser = user;
        localStorage.setItem('sis_currentUser', JSON.stringify(user));
        showMainApp();
        showNotification('Login successful!', 'success');
    } else {
        showNotification('Invalid username or password', 'error');
    }
}

// Signup Handler
async function handleSignup(e) {
    e.preventDefault();
    const username = document.getElementById('signup-username').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const role = document.getElementById('user-role').value;

    if (password !== confirmPassword) {
        showNotification('Passwords do not match', 'error');
        return;
    }

    if (users.some(u => u.username === username)) {
        showNotification('Username already exists', 'error');
        return;
    }

    const newUser = {
        id: Date.now(),
        username,
        email,
        password,
        role,
        createdAt: new Date().toISOString()
    };

    users.push(newUser);
    await saveUsers();

    showNotification('Account created successfully! Please log in.', 'success');
    document.querySelector('[data-auth-tab="login"]').click();
    document.getElementById('signup-form').reset();
}

// Enrollment Handler
async function handleEnrollment(e) {
    e.preventDefault();
    const name = document.getElementById('student-name').value;
    const id = document.getElementById('student-id').value;
    const email = document.getElementById('student-email').value;
    const course = document.getElementById('course').value;
    const date = document.getElementById('enrollment-date').value;
    const profilePicFile = document.getElementById('student-profile-pic').files[0];

    if (students.some(s => s.id === id)) {
        showNotification('Student ID already exists', 'error');
        return;
    }

    let profilePic = null;
    if (profilePicFile) {
        profilePic = await readFileAsDataURL(profilePicFile);
    }

    const newStudent = {
        id,
        name,
        email,
        course,
        enrollmentDate: date,
        grades: [],
        attendance: [],
        profilePic
    };

    students.push(newStudent);
    await saveStudents();

    loadStudentsList();
    document.getElementById('enrollment-form').reset();
    showNotification('Student enrolled successfully!', 'success');
}

// Utility function to read file as data URL
function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Grade Handler
async function handleGradeSubmit(e) {
    e.preventDefault();
    const studentId = document.getElementById('grade-student-id').value;
    const subject = document.getElementById('subject').value;
    const grade = document.getElementById('grade').value;
    const semester = document.getElementById('semester').value;

    const student = students.find(s => s.id === studentId);
    if (!student) {
        showNotification('Student not found', 'error');
        return;
    }

    student.grades.push({
        subject,
        grade,
        semester,
        date: new Date().toISOString()
    });

    await saveStudents();
    document.getElementById('grade-form').reset();
    showNotification('Grade added successfully!', 'success');
}

// Attendance Handler
async function handleAttendanceSubmit(e) {
    e.preventDefault();
    const studentId = document.getElementById('att-student-id').value;
    const date = document.getElementById('date').value;
    const status = document.getElementById('status').value;
    const notes = document.getElementById('attendance-notes').value;

    const student = students.find(s => s.id === studentId);
    if (!student) {
        showNotification('Student not found', 'error');
        return;
    }

    student.attendance.push({
        date,
        status,
        notes,
        recordedAt: new Date().toISOString()
    });

    await saveStudents();
    document.getElementById('attendance-form').reset();
    showNotification('Attendance recorded successfully!', 'success');
}



// Report Generation
function generateReport(type) {
    const output = document.getElementById('report-output');
    let reportContent = '';

    switch(type) {
        case 'students':
            reportContent = generateStudentReport();
            break;
        case 'grades':
            reportContent = generateGradeReport();
            break;
        case 'attendance':
            reportContent = generateAttendanceReport();
            break;
        case 'enrollment':
            reportContent = generateEnrollmentReport();
            break;
        default:
            reportContent = '<p>Select a report type</p>';
    }

    output.innerHTML = reportContent;
}

function generateStudentReport() {
    return `
        <h3>Student List Report</h3>
        <p>Total Students: ${students.length}</p>
        <div class="report-details">
            ${students.map(student => `
                <div class="report-item">
                    <strong>${student.name}</strong> (${student.id}) - ${student.course}
                </div>
            `).join('')}
        </div>
    `;
}

function generateGradeReport() {
    let report = `
        <h3>Grade Report</h3>
        <p>Total Grade Records: ${students.reduce((acc, student) => acc + student.grades.length, 0)}</p>
    `;
    students.forEach(student => {
        if (student.grades.length > 0) {
            report += `
                <div class="student-grades">
                    <h4>${student.name} (${student.id}) - ${student.course}</h4>
                    <ul>
            `;
            student.grades.forEach((grade, index) => {
                report += `
                        <li>
                            <strong>Subject:</strong> ${grade.subject} | 
                            <strong>Grade:</strong> ${grade.grade} | 
                            <strong>Semester:</strong> ${grade.semester} | 
                            <strong>Date:</strong> ${new Date(grade.date).toLocaleDateString()} 
                            <button onclick="deleteGrade('${student.id}', ${index})" style="margin-left: 10px; background: #dc3545; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">Delete</strong>
                        </li>
                `;
            });
            report += `
                    </ul>
                </div>
            `;
        }
    });
    if (students.every(student => student.grades.length === 0)) {
        report += '<p>No grade records found.</p>';
    }
    return report;
}

function generateAttendanceReport() {
    const totalRecords = students.reduce((acc, student) => acc + student.attendance.length, 0);
    let report = `<h3>Individual Student Attendance Records</h3>
        <p>Total Attendance Records: ${totalRecords}</p>
        <button id="toggleAttendanceDetails" class="report-btn" onclick="toggleAttendanceDetails()">View Details</button>
        <div id="attendanceDetails" class="scrollable-attendance" style="display: none;">`;

    students.forEach(student => {
        if (student.attendance.length > 0) {
            report += `
                <div class="student-attendance">
                    <h4>${student.name} (${student.id}) - ${student.course}</h4>
                    <ul>
            `;
            student.attendance.forEach((record, index) => {
                report += `
                        <li>
                            <strong>Date:</strong> ${record.date} | 
                            <strong>Status:</strong> ${record.status} | 
                            <strong>Notes:</strong> ${record.notes || 'None'} 
                            <button onclick="deleteAttendance('${student.id}', ${index})" style="margin-left: 10px; background: #dc3545; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">Delete</button>
                        </li>
                `;
            });
            report += `
                    </ul>
                </div>
            `;
        }
    });
    if (students.every(student => student.attendance.length === 0)) {
        report += '<p>No attendance records found.</p>';
    }
    report += '</div>';
    return report;
}

function generateEnrollmentReport() {
    const courseStudents = {};
    students.forEach(student => {
        if (!courseStudents[student.course]) {
            courseStudents[student.course] = [];
        }
        courseStudents[student.course].push(student);
    });

    let report = `
        <h3>Enrollment Statistics</h3>
        <p>Total Students: ${students.length}</p>
    `;
    Object.entries(courseStudents).forEach(([course, courseStudentsList]) => {
        report += `
            <h4>${course}: ${courseStudentsList.length} students</h4>
            <ul>
        `;
        courseStudentsList.forEach(student => {
            report += `
                <li>
                    ${student.name} (${student.id}) - Enrolled: ${new Date(student.enrollmentDate).toLocaleDateString()} 
                    <button onclick="deleteStudent('${student.id}')" style="margin-left: 10px; background: #dc3545; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">Delete Student</button>
                </li>
            `;
        });
        report += `</ul>`;
    });
    if (students.length === 0) {
        report += '<p>No students enrolled.</p>';
    }
    return report;
}

// Utility Functions
function checkLoginStatus() {
    const savedUser = localStorage.getItem('sis_currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showMainApp();
    }
}

function showMainApp() {
    authTabs.style.display = 'none';
    mainApp.style.display = 'block';
    userInfo.style.display = 'flex';
    loggedInUser.textContent = `Welcome, ${currentUser.username} (${currentUser.role})`;

    if (currentUser.role === 'student') {
        mainNav.style.display = 'none';
        // Automatically show enrollment tab for students
        document.getElementById('enrollment').classList.add('active');
    } else {
        mainNav.style.display = 'flex';
    }
}

function logout() {
    currentUser = null;
    localStorage.removeItem('sis_currentUser');
    authTabs.style.display = 'block';
    mainApp.style.display = 'none';
    mainNav.style.display = 'none';
    userInfo.style.display = 'none';
    document.querySelector('[data-auth-tab="login"]').click();
    showNotification('Logged out successfully', 'success');
}

function showNotification(message, type) {
    // Simple notification implementation
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 2rem;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        z-index: 1000;
        background: ${type === 'success' ? 'var(--success)' : 'var(--error)'};
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function loadStudentsList() {
  const studentsList = document.getElementById('studentsList');
  
  if (students.length === 0) {
    studentsList.innerHTML = '<div class="no-students">No students enrolled yet</div>';
    return;
  }

  studentsList.innerHTML = students.map(student => `
    <div class="student-card" data-id="${student.id}" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
      <div style="flex: 1;">
        <h4>${student.name}</h4>
        <p><strong>ID:</strong> ${student.id}</p>
        <p><strong>Email:</strong> ${student.email}</p>
        <p><strong>Course:</strong> ${student.course}</p>
        <p><strong>Enrolled:</strong> ${new Date(student.enrollmentDate).toLocaleDateString()}</p>
        <p><strong>Average Grade:</strong> ${calculateAverageGrade(student.grades)}</p>
        <p><strong>Attendance:</strong> ${student.attendance.length} records</p>
        <button class="delete-student-btn">Delete</button>
      </div>
      ${student.profilePic ? `<img src="${student.profilePic}" alt="Profile Picture" style="width: 120px; height: 100%; border-radius: 8px; object-fit: contain; flex-shrink: 0;">` : ''}
    </div>
  `).join('');

  // Add event listeners to all delete buttons
  const deleteButtons = document.querySelectorAll('.delete-student-btn');
  deleteButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      const studentCard = e.target.closest('.student-card');
      const studentId = studentCard.getAttribute('data-id');
      if (confirm(`Are you sure you want to delete student ID: ${studentId}?`)) {
        deleteStudent(studentId);
      }
    });
  });
}

async function deleteStudent(studentId) {
  students = students.filter(student => student.id !== studentId);
  await saveStudents();
  loadStudentsList();
  showNotification('Student deleted successfully!', 'success');
}

async function deleteGrade(studentId, gradeIndex) {
  const student = students.find(s => s.id === studentId);
  if (student && student.grades[gradeIndex]) {
    student.grades.splice(gradeIndex, 1);
    await saveStudents();
    // Regenerate the grade report
    if (document.querySelector('.tab-btn.active[data-tab="reports"]')) {
      generateReport('grades');
    }
    showNotification('Grade deleted successfully!', 'success');
  }
}

async function deleteAttendance(studentId, attendanceIndex) {
  const student = students.find(s => s.id === studentId);
  if (student && student.attendance[attendanceIndex]) {
    student.attendance.splice(attendanceIndex, 1);
    await saveStudents();
    // Regenerate the attendance report
    if (document.querySelector('.tab-btn.active[data-tab="reports"]')) {
      generateReport('attendance');
    }
    showNotification('Attendance record deleted successfully!', 'success');
  }
}

const tabs = document.querySelectorAll('.tab-btn');
const contents = document.querySelectorAll('.tab-content');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const targetId = tab.dataset.tab;

    // Role-based access control: prevent students from accessing restricted tabs
    if (currentUser .role === 'student' && ['grades', 'attendance', 'reports', 'manageUsers'].includes(targetId)) {
      alert('Access denied: Students can only access Enrollment.');
      return;
    }

    // Remove active class from all tabs and hide all content sections
    tabs.forEach(t => t.classList.remove('active'));
    contents.forEach(c => c.classList.remove('active'));

    // Add active class to clicked tab and show corresponding content
    tab.classList.add('active');
    const targetContent = document.getElementById(targetId);
    if (targetContent) {
      targetContent.classList.add('active');
    }

    // Render users list when Manage Users tab is activated
    if (targetId === 'manageUsers') {
      renderUsers();
    }
  });
});

const attendanceRecords = {
  studentUsername1: "present",
  studentUsername2: "absent",
  studentUsername3: "late",
  // ...
};

function renderAttendance() {
  const attendanceTableBody = document.querySelector('#attendanceTable tbody');
  attendanceTableBody.innerHTML = ''; // Clear existing rows

  // Assuming you have a list of students, e.g.:
  const students = users.filter(u => u.role === 'student');

  students.forEach(student => {
    // Get attendance status for this student, default to 'absent' if none
    const status = attendanceRecords[student.username] || 'absent';

    // Create table row
    const tr = document.createElement('tr');

    // Student name cell
    const nameTd = document.createElement('td');
    nameTd.textContent = student.username;
    tr.appendChild(nameTd);

    // Status cell with label and color
    const statusTd = document.createElement('td');
    statusTd.textContent = status.charAt(0).toUpperCase() + status.slice(1); // Capitalize

    // Add color coding
    if (status === 'present') {
      statusTd.style.color = 'green';
    } else if (status === 'late') {
      statusTd.style.color = 'orange';
    } else if (status === 'absent') {
      statusTd.style.color = 'red';
    }

    tr.appendChild(statusTd);

    attendanceTableBody.appendChild(tr);
  });
}

function updateVisibilityByRole() {
  const tabs = document.querySelectorAll('.tab-btn');

  tabs.forEach(tab => {
    if (currentUser .role === 'student') {
      // Show only Enrollment tab for students
      if (tab.dataset.tab === 'enrollment') {
        tab.style.display = 'inline-block';
      } else {
        tab.style.display = 'none';
        tab.classList.remove('active'); // Remove active if hidden
      }
    } else {
      // Show all tabs for teachers/admins
      tab.style.display = 'inline-block';
    }
  });

  // Optionally, activate Enrollment tab by default for students
  if (currentUser .role === 'student') {
    const enrollmentTab = document.querySelector('button[data-tab="enrollment"]');
    if (enrollmentTab) {
      enrollmentTab.classList.add('active');
    }
  }
}

const usersTableBody = document.querySelector('#usersTable tbody');

// Function to render users list in Manage Users tab
function renderUsers() {
  usersTableBody.innerHTML = ''; // Clear existing rows

  users.forEach((user, index) => {
    const tr = document.createElement('tr');

    // Username cell
    const usernameTd = document.createElement('td');
    usernameTd.textContent = user.username;
    tr.appendChild(usernameTd);

    // Email cell
    const emailTd = document.createElement('td');
    emailTd.textContent = user.email || '';
    tr.appendChild(emailTd);

    // Role cell
    const roleTd = document.createElement('td');
    roleTd.textContent = user.role;
    tr.appendChild(roleTd);

    // Action cell with Delete button
    const actionTd = document.createElement('td');
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.classList.add('delete-user-btn');

    // Disable delete button for current logged-in user to prevent self-deletion
    if (user.username === currentUser .username) {
      deleteBtn.disabled = true;
      deleteBtn.title = "You cannot delete your own account";
      deleteBtn.style.opacity = '0.5';
      deleteBtn.style.cursor = 'not-allowed';
    }

    deleteBtn.addEventListener('click', () => {
      if (confirm(`Are you sure you want to delete user "${user.username}"? This action cannot be undone.`)) {
        deleteUser (index);
      }
    });

    actionTd.appendChild(deleteBtn);
    tr.appendChild(actionTd);

    usersTableBody.appendChild(tr);
  });
}

// Function to delete user by index
async function deleteUser (userIndex) {
  // Remove user from users array
  users.splice(userIndex, 1);

  await saveUsers();

  // If the deleted user is currently logged in (should not happen due to disable), log out
  if (currentUser  && !users.some(u => u.username === currentUser .username)) {
    alert('Your account has been deleted. Logging out.');
    logout(); // Your existing logout function
    return;
  }

  // Re-render users list
  renderUsers();

  alert('User  deleted successfully.');
}

// Function to toggle attendance details visibility
function toggleAttendanceDetails() {
  const details = document.getElementById('attendanceDetails');
  const button = document.getElementById('toggleAttendanceDetails');
  if (details.style.display === 'none') {
    details.style.display = 'block';
    button.textContent = 'Hide Details';
  } else {
    details.style.display = 'none';
    button.textContent = 'View Details';
  }
}



