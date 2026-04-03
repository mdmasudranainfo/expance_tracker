# 📊 Database Schema Documentation

Complete MongoDB schema for the Expense Tracker Backend application.

---

## Collection Overview

### 1. 👤 Users (`users`)
User authentication and profile management.

**Fields:**
- `_id`: ObjectId (Primary Key)
- `name`: String (required, trimmed)
- `email`: String (required, unique, lowercase, trimmed)
- `password`: String (optional, required for "credentials" provider, excluded from queries)
- `image`: String (default: "")
- `provider`: String - "credentials" | "google" (default: "credentials")
- `role`: String - "admin" | "user" (default: "user")
- `defaultWorkspaceId`: ObjectId (ref: Workspace, optional)
- `createdAt`: Date (auto-managed)
- `updatedAt`: Date (auto-managed)

**Indexes:**
- `email`: Unique index for fast lookups

---

### 2. 🏢 Workspaces (`workspaces`)
Workspace/organization management for multi-user collaboration.

**Fields:**
- `_id`: ObjectId (Primary Key)
- `name`: String (required, trimmed)
- `description`: String (default: "")
- `ownerId`: ObjectId (ref: User, required)
- `isPersonal`: Boolean (default: false)
- `currency`: String (default: "BDT")
- `createdAt`: Date (auto-managed)
- `updatedAt`: Date (auto-managed)

**Indexes:**
- `ownerId`: Index for fast owner-based queries

---

### 3. 👥 Workspace Members (`workspacemembers`)
Manages user membership and access to workspaces.

**Fields:**
- `_id`: ObjectId (Primary Key)
- `workspaceId`: ObjectId (ref: Workspace, required)
- `userId`: ObjectId (ref: User, required)
- `role`: String - "viewer" | "editor" (default: "viewer")
- `invitedBy`: ObjectId (ref: User, required)
- `createdAt`: Date (auto-managed)
- `updatedAt`: Date (auto-managed)

**Indexes:**
- Compound unique index: `{ workspaceId, userId }` (prevents duplicate memberships)

---

### 4. 💰 Wallets (`wallets`)
Financial accounts/wallets within workspaces.

**Fields:**
- `_id`: ObjectId (Primary Key)
- `workspaceId`: ObjectId (ref: Workspace, required)
- `name`: String (required, trimmed)
- `type`: String - "cash" | "bank" | "mobile" (required)
- `balance`: Number (default: 0)
- `currency`: String (default: "BDT")
- `createdAt`: Date (auto-managed)
- `updatedAt`: Date (auto-managed)

**Indexes:**
- `workspaceId`: Index for fast workspace-based queries

---

### 5. 🏷️ Categories (`categories`)
Transaction categorization (income/expense).

**Fields:**
- `_id`: ObjectId (Primary Key)
- `workspaceId`: ObjectId (ref: Workspace, required)
- `name`: String (required, trimmed)
- `type`: String - "expense" | "income" (required)
- `isDefault`: Boolean (default: false)
- `createdAt`: Date (auto-managed)
- `updatedAt`: Date (auto-managed)

**Indexes:**
- Compound index: `{ workspaceId, type }` for filtered queries

---

### 6. 💸 Transactions (`transactions`)
Financial transactions (expenses, income, transfers).

**Fields:**
- `_id`: ObjectId (Primary Key)
- `workspaceId`: ObjectId (ref: Workspace, required)
- `userId`: ObjectId (ref: User, required)
- `walletId`: ObjectId (ref: Wallet, optional for transfers)
- `categoryId`: ObjectId (ref: Category, optional for transfers)
- `type`: String - "expense" | "income" | "transfer" (required)
- `amount`: Number (required, min: 0)
- `note`: String (default: "")
- `date`: Date (required, default: now)
- `receiptUrl`: String (Cloudinary URL, default: "")
- `fromWalletId`: ObjectId (ref: Wallet, for transfers)
- `toWalletId`: ObjectId (ref: Wallet, for transfers)
- `createdAt`: Date (auto-managed)
- `updatedAt`: Date (auto-managed)

**Indexes:**
- `{ workspaceId, userId }`: For user-specific queries
- `walletId`: For wallet-based queries
- `categoryId`: For category-based queries
- `type`: For transaction type filtering
- `date`: For date-based sorting/filtering

---

### 7. 💵 Budgets (`budgets`)
Monthly budget tracking per category.

**Fields:**
- `_id`: ObjectId (Primary Key)
- `workspaceId`: ObjectId (ref: Workspace, required)
- `categoryId`: ObjectId (ref: Category, optional)
- `amount`: Number (required, min: 0)
- `month`: Number (required, 1-12)
- `year`: Number (required)
- `createdAt`: Date (auto-managed)
- `updatedAt`: Date (auto-managed)

**Indexes:**
- Compound unique index: `{ workspaceId, categoryId, month, year }` (prevents duplicate budgets)

---

### 8. 🔔 Notifications (`notifications`)
User notifications system.

**Fields:**
- `_id`: ObjectId (Primary Key)
- `userId`: ObjectId (ref: User, required)
- `workspaceId`: ObjectId (ref: Workspace, optional)
- `type`: String - "budget_exceed" | "reminder" (required)
- `message`: String (required)
- `isRead`: Boolean (default: false)
- `createdAt`: Date (auto-managed)
- `updatedAt`: Date (auto-managed)

**Indexes:**
- Compound index: `{ userId, isRead }` for unread notification queries

---

### 9. 📜 Activity Logs (`activitylogs`)
Audit trail for user actions.

**Fields:**
- `_id`: ObjectId (Primary Key)
- `userId`: ObjectId (ref: User, required)
- `workspaceId`: ObjectId (ref: Workspace, required)
- `action`: String (e.g., "CREATE_EXPENSE")
- `entity`: String (e.g., "transaction", "wallet")
- `entityId`: ObjectId (ID of the affected entity)
- `metadata`: Object (additional context, default: {})
- `createdAt`: Date (auto-managed)
- `updatedAt`: Date (auto-managed)

**Indexes:**
- `{ userId, workspaceId }`: For user-workspace activity
- `{ entity, entityId }`: For entity-specific activity

---

## 🔑 Key Features

### Data Integrity
- **Unique constraints**: Email, workspace-member combinations, monthly budgets
- **Referential integrity**: All references use MongoDB ObjectId with ref
- **Validation**: Required fields, enum values, min/max constraints

### Performance Optimization
- **Strategic indexing**: All frequently queried fields are indexed
- **Compound indexes**: For complex queries and uniqueness constraints
- **Efficient lookups**: Population-ready references

### Security
- **Password protection**: Excluded from queries by default
- **Role-based access**: Admin/user roles at user level
- **Permission levels**: Viewer/editor roles at workspace level

### Scalability
- **Multi-workspace support**: Users can belong to multiple workspaces
- **Transfer support**: Transactions can move money between wallets
- **Flexible categories**: Optional budget categories
- **Extensible metadata**: Activity logs support arbitrary metadata

---

## 📝 Usage Examples

### Import Models
```typescript
import { User, Workspace, Transaction } from "@/src/backend/models";
// or import individually
import User from "@/src/backend/models/User";
```

### Import Interfaces
```typescript
import { IUser, ITransaction, IWorkspace } from "@/src/backend/interface";
// or import individually
import type IUser from "@/src/backend/interface/User.interface";
```

### Create User
```typescript
await connectMongoDB();
const user = await User.create({
  name: "John Doe",
  email: "john@example.com",
  password: "securepassword",
  provider: "credentials",
});
```

### Query with Population
```typescript
const transaction = await Transaction.findById(id)
  .populate("userId", "name email")
  .populate("walletId", "name type")
  .populate("categoryId", "name type");
```

---

## 🔄 Relationships

```
User (1) ──→ (M) Workspace (owner)
User (1) ──→ (M) WorkspaceMember
Workspace (1) ──→ (M) WorkspaceMember
Workspace (1) ──→ (M) Wallet
Workspace (1) ──→ (M) Category
Workspace (1) ──→ (M) Transaction
Workspace (1) ──→ (M) Budget
Workspace (1) ──→ (M) Notification
Workspace (1) ──→ (M) ActivityLog
User (1) ──→ (M) Transaction
User (1) ──→ (M) Notification
User (1) ──→ (M) ActivityLog
Wallet (1) ──→ (M) Transaction
Category (1) ──→ (M) Transaction
```

---

## 📚 Best Practices

1. **Always connect to MongoDB** before operations
2. **Use population** for referenced documents
3. **Handle errors** gracefully (duplicate keys, validation)
4. **Index optimization** - query using indexed fields when possible
5. **Password security** - never expose in API responses
6. **Soft deletes** - consider adding `deletedAt` for audit trails
7. **Transactions** - use MongoDB sessions for multi-document operations

---

Generated on: April 3, 2026
