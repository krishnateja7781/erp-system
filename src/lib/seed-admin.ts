
/**
 * Seed admin user for local JSON-based ERP.
 * This file replaces the Firebase admin seeding logic.
 * The initial admin data is already seeded in src/data/users.json and src/data/admins.json.
 * 
 * Default admin credentials:
 *   Email:    admin@ssn.edu.in
 *   Password: Admin@123
 */

import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

const DATA_DIR = path.join(process.cwd(), 'src', 'data');

async function seedAdmin() {
  const usersPath = path.join(DATA_DIR, 'users.json');
  const adminsPath = path.join(DATA_DIR, 'admins.json');

  const email = 'admin@ssn.edu.in';
  const password = 'Admin@123';
  const name = 'System Administrator';

  // Check if admin already exists
  const users: any[] = fs.existsSync(usersPath) ? JSON.parse(fs.readFileSync(usersPath, 'utf-8')) : [];
  const existing = users.find((u: any) => u.email === email);
  if (existing) {
    console.log('Admin user already exists:', email);
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const uid = 'admin-' + Date.now().toString(36);
  const now = new Date().toISOString();

  const newUser = { id: uid, uid, email, role: 'admin', name, passwordHash: hashedPassword, createdAt: now, updatedAt: now };
  const newAdmin = { id: uid, uid, user_uid: uid, email, name, staffId: 'ADM001', department: 'Administration', designation: 'System Administrator', passwordHash: hashedPassword, createdAt: now, updatedAt: now };

  users.push(newUser);
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2), 'utf-8');

  const admins: any[] = fs.existsSync(adminsPath) ? JSON.parse(fs.readFileSync(adminsPath, 'utf-8')) : [];
  admins.push(newAdmin);
  fs.writeFileSync(adminsPath, JSON.stringify(admins, null, 2), 'utf-8');

  console.log('Admin user seeded successfully!');
  console.log('Email:', email);
  console.log('Password:', password);
}

seedAdmin().catch(console.error);
